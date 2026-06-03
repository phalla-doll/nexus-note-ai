import "server-only"

import type OpenAI from "openai"

import {
    formatContextBlock,
    retrieveNotesForQuery,
    type RetrievedNote,
} from "@/lib/ai/retrieval/notes"

export type ToolName = "search_notes"

export const SEARCH_NOTES_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
    type: "function",
    function: {
        name: "search_notes",
        description:
            "Search the user's personal notes by topic, keyword, or question. Returns the most relevant notes with content. Use this when the user asks about their own notes, projects, ideas, or anything in their second brain that wasn't already included in the system context.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description:
                        "Natural-language query. Topical phrases work best; full sentences are fine.",
                },
                k: {
                    type: "integer",
                    description: "How many notes to return (1–10).",
                    minimum: 1,
                    maximum: 10,
                },
            },
            required: ["query"],
        },
    },
}

export type ToolExecution = {
    toolCallId: string
    notes: RetrievedNote[]
    formatted: string
}

export async function executeSearchNotes(
    toolCallId: string,
    rawArgs: string
): Promise<ToolExecution> {
    let parsed: { query?: string; k?: number } = {}
    try {
        parsed = JSON.parse(rawArgs)
    } catch {
        parsed = {}
    }
    const query = (parsed.query ?? "").toString()
    const k = Math.max(1, Math.min(10, Number(parsed.k ?? 5)))
    const notes = await retrieveNotesForQuery(query, k)
    return {
        toolCallId,
        notes,
        formatted:
            notes.length === 0
                ? "No matching notes found."
                : formatContextBlock(notes),
    }
}
