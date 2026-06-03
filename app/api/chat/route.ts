import { z } from "zod"
import type OpenAI from "openai"

import { getNvidiaClient, NVIDIA_MODELS } from "@/lib/ai/providers/nvidia"
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts/chat"
import {
    formatContextBlock,
    retrieveNotesForQuery,
    type RetrievedNote,
} from "@/lib/ai/retrieval/notes"
import { executeSearchNotes, SEARCH_NOTES_TOOL } from "@/lib/ai/tools/notes"

export const runtime = "nodejs"

const MessageSchema = z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
})

const BodySchema = z.object({
    messages: z.array(MessageSchema).min(1),
    mode: z.enum(["chat", "coding"]).default("chat"),
    useNotes: z.boolean().default(true),
})

const RETRIEVAL_K = 5
const MAX_TOOL_HOPS = 2

type Citation = {
    id: string
    title: string
    sources: ("fts" | "semantic")[]
}

function notesToCitations(notes: RetrievedNote[]): Citation[] {
    return notes.map((n) => ({
        id: n.id,
        title: n.title || "Untitled",
        sources: n.sources,
    }))
}

// Strip the framing tags we emit (<context>…</context>, <think>…</think>)
// from any assistant turn before replaying it as model history. The LLM
// shouldn't see its own UI framing.
function cleanForReplay(content: string): string {
    return content
        .replace(/<context>[\s\S]*?<\/context>/g, "")
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .trim()
}

// Streams plain UTF-8 chunks of assistant text. Framing tags:
//   <context>[…JSON Citation[]…]</context>   — may appear 0+ times
//   <think>…</think>                          — reasoning tokens
//   …                                         — assistant content
export async function POST(request: Request) {
    let body: z.infer<typeof BodySchema>
    try {
        body = BodySchema.parse(await request.json())
    } catch (error) {
        return Response.json(
            { error: error instanceof Error ? error.message : "Invalid body" },
            { status: 400 }
        )
    }

    const client = getNvidiaClient()
    const model =
        body.mode === "coding" ? NVIDIA_MODELS.coding : NVIDIA_MODELS.chat

    // First pass: optional always-inject of top-k notes for the latest
    // user turn. The model can still ask for more via the tool.
    const systemMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        [{ role: "system", content: CHAT_SYSTEM_PROMPT }]
    let initialCitations: Citation[] = []

    if (body.useNotes && body.mode !== "coding") {
        const lastUser = [...body.messages]
            .reverse()
            .find((m) => m.role === "user")
        if (lastUser?.content?.trim()) {
            try {
                const notes = await retrieveNotesForQuery(
                    lastUser.content,
                    RETRIEVAL_K
                )
                const block = formatContextBlock(notes)
                if (block) {
                    systemMessages.push({ role: "system", content: block })
                    initialCitations = notesToCitations(notes)
                }
            } catch {
                // Retrieval failure shouldn't break chat.
            }
        }
    }

    const history: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        body.messages.map((m) => ({
            role: m.role,
            content:
                m.role === "assistant" ? cleanForReplay(m.content) : m.content,
        }))

    const useTools = body.useNotes && body.mode !== "coding"
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        ...systemMessages,
        ...history,
    ]

    const encoder = new TextEncoder()

    const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                if (initialCitations.length > 0) {
                    controller.enqueue(
                        encoder.encode(
                            `<context>${JSON.stringify(initialCitations)}</context>`
                        )
                    )
                }

                let hopsRemaining = MAX_TOOL_HOPS
                while (true) {
                    const result = await streamOneTurn(
                        client,
                        model,
                        messages,
                        useTools && hopsRemaining > 0,
                        controller,
                        encoder
                    )

                    if (result.kind === "done") break

                    // Tool calls: execute, add tool results to history,
                    // loop for another turn.
                    hopsRemaining--
                    messages.push({
                        role: "assistant",
                        content: result.assistantContent || null,
                        tool_calls: result.toolCalls.map((tc) => ({
                            id: tc.id,
                            type: "function" as const,
                            function: {
                                name: tc.name,
                                arguments: tc.args,
                            },
                        })),
                    })

                    for (const tc of result.toolCalls) {
                        if (tc.name === "search_notes") {
                            const exec = await executeSearchNotes(
                                tc.id,
                                tc.args
                            )
                            if (exec.notes.length > 0) {
                                controller.enqueue(
                                    encoder.encode(
                                        `<context>${JSON.stringify(
                                            notesToCitations(exec.notes)
                                        )}</context>`
                                    )
                                )
                            }
                            messages.push({
                                role: "tool",
                                tool_call_id: tc.id,
                                content: exec.formatted,
                            })
                        } else {
                            messages.push({
                                role: "tool",
                                tool_call_id: tc.id,
                                content: `Unknown tool: ${tc.name}`,
                            })
                        }
                    }
                }

                controller.close()
            } catch (error) {
                controller.error(error)
            }
        },
    })

    return new Response(readable, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
        },
    })
}

type AccumulatedToolCall = { id: string; name: string; args: string }

type TurnResult =
    | { kind: "done" }
    | {
          kind: "tool_calls"
          toolCalls: AccumulatedToolCall[]
          assistantContent: string
      }

async function streamOneTurn(
    client: OpenAI,
    model: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    withTools: boolean,
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder
): Promise<TurnResult> {
    const stream = await client.chat.completions.create({
        model,
        stream: true,
        temperature: 0.7,
        top_p: 1,
        max_tokens: 4096,
        messages,
        ...(withTools
            ? {
                  tools: [SEARCH_NOTES_TOOL],
                  tool_choice: "auto" as const,
              }
            : {}),
    })

    const toolCalls = new Map<number, AccumulatedToolCall>()
    let sentReasoningOpen = false
    let sentReasoningClose = false
    let assistantContent = ""
    let finishReason: string | null = null

    for await (const chunk of stream) {
        const choice = chunk.choices[0]
        const delta = choice?.delta as
            | {
                  content?: string | null
                  reasoning_content?: string | null
                  tool_calls?: {
                      index: number
                      id?: string
                      function?: { name?: string; arguments?: string }
                  }[]
              }
            | undefined
        if (!delta) continue

        if (delta.reasoning_content) {
            if (!sentReasoningOpen) {
                controller.enqueue(encoder.encode("<think>"))
                sentReasoningOpen = true
            }
            controller.enqueue(encoder.encode(delta.reasoning_content))
        }
        if (delta.content) {
            if (sentReasoningOpen && !sentReasoningClose) {
                controller.enqueue(encoder.encode("</think>"))
                sentReasoningClose = true
            }
            controller.enqueue(encoder.encode(delta.content))
            assistantContent += delta.content
        }
        if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
                const acc = toolCalls.get(tc.index) ?? {
                    id: "",
                    name: "",
                    args: "",
                }
                if (tc.id) acc.id = tc.id
                if (tc.function?.name) acc.name = tc.function.name
                if (tc.function?.arguments) acc.args += tc.function.arguments
                toolCalls.set(tc.index, acc)
            }
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason
    }

    if (sentReasoningOpen && !sentReasoningClose) {
        controller.enqueue(encoder.encode("</think>"))
    }

    if (finishReason === "tool_calls" && toolCalls.size > 0) {
        return {
            kind: "tool_calls",
            toolCalls: Array.from(toolCalls.values()).filter((tc) => tc.name),
            assistantContent,
        }
    }
    return { kind: "done" }
}
