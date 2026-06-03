"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    Add01Icon,
    Sent02Icon,
    StopCircleIcon,
    Delete02Icon,
    MessageMultiple01Icon,
    CodeSquareIcon,
    Note01Icon,
} from "@hugeicons/core-free-icons"

import {
    appendMessage,
    createConversation,
    deleteConversation,
    listConversations,
    listMessages,
    renameConversation,
} from "@/app/actions/conversations"
import type { Conversation, Message } from "@/types/db"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

type Mode = "chat" | "coding"

type LiveMessage = Message & { streaming?: boolean }

export function ChatView() {
    const [conversations, setConversations] = useState<Conversation[] | null>(
        null
    )
    const [activeId, setActiveId] = useState<string | null>(null)
    const [messages, setMessages] = useState<LiveMessage[]>([])
    const [input, setInput] = useState("")
    const [mode, setMode] = useState<Mode>("chat")
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const abortRef = useRef<AbortController | null>(null)
    const threadRef = useRef<HTMLDivElement | null>(null)

    const refreshConversations = useCallback(async () => {
        const list = await listConversations()
        setConversations(list)
        return list
    }, [])

    useEffect(() => {
        let cancelled = false
        void (async () => {
            const list = await refreshConversations()
            if (cancelled) return
            if (list.length > 0) setActiveId(list[0].id)
        })()
        return () => {
            cancelled = true
        }
    }, [refreshConversations])

    useEffect(() => {
        if (!activeId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- clear when no active conversation
            setMessages([])
            return
        }
        let cancelled = false
        void listMessages(activeId).then((rows) => {
            if (!cancelled) setMessages(rows)
        })
        return () => {
            cancelled = true
        }
    }, [activeId])

    useEffect(() => {
        threadRef.current?.scrollTo({
            top: threadRef.current.scrollHeight,
            behavior: "smooth",
        })
    }, [messages])

    const handleNew = useCallback(async () => {
        const convo = await createConversation(null)
        await refreshConversations()
        setActiveId(convo.id)
        setMessages([])
        setError(null)
    }, [refreshConversations])

    const handleDelete = useCallback(
        async (id: string) => {
            await deleteConversation(id)
            const list = await refreshConversations()
            if (activeId === id) {
                setActiveId(list[0]?.id ?? null)
            }
        },
        [activeId, refreshConversations]
    )

    const handleStop = useCallback(() => {
        abortRef.current?.abort()
    }, [])

    const handleSend = useCallback(async () => {
        const trimmed = input.trim()
        if (!trimmed || sending) return
        setError(null)
        setSending(true)

        let conversationId = activeId
        if (!conversationId) {
            const convo = await createConversation(trimmed.slice(0, 60))
            conversationId = convo.id
            setActiveId(conversationId)
            await refreshConversations()
        } else {
            const current = conversations?.find((c) => c.id === conversationId)
            if (current && !current.title) {
                await renameConversation(conversationId, trimmed.slice(0, 60))
                await refreshConversations()
            }
        }

        const userMsg = await appendMessage(conversationId, "user", trimmed)
        setMessages((prev) => [...prev, userMsg])
        setInput("")

        const history = await listMessages(conversationId)

        const controller = new AbortController()
        abortRef.current = controller
        const assistantId = `streaming-${Date.now()}`
        const placeholder: LiveMessage = {
            id: assistantId,
            conversation_id: conversationId,
            role: "assistant",
            content: "",
            created_at: new Date().toISOString(),
            streaming: true,
        }
        setMessages((prev) => [...prev, placeholder])

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    mode,
                    messages: history.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            })

            if (!response.ok || !response.body) {
                const text = await response.text()
                throw new Error(text || `Request failed (${response.status})`)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let acc = ""
            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                acc += decoder.decode(value, { stream: true })
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId ? { ...m, content: acc } : m
                    )
                )
            }
            acc += decoder.decode()

            const saved = await appendMessage(conversationId, "assistant", acc)
            setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? saved : m))
            )
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId
                            ? {
                                  ...m,
                                  streaming: false,
                                  content: m.content + "\n\n_(stopped)_",
                              }
                            : m
                    )
                )
            } else {
                setError(err instanceof Error ? err.message : String(err))
                setMessages((prev) => prev.filter((m) => m.id !== assistantId))
            }
        } finally {
            abortRef.current = null
            setSending(false)
        }
    }, [activeId, conversations, input, mode, refreshConversations, sending])

    const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            void handleSend()
        }
    }

    return (
        <div className="flex h-full min-h-0 flex-1 gap-4">
            <ConversationList
                conversations={conversations}
                activeId={activeId}
                onSelect={setActiveId}
                onNew={handleNew}
                onDelete={handleDelete}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div
                    ref={threadRef}
                    className="flex-1 overflow-y-auto rounded-lg border bg-card"
                >
                    {messages.length === 0 ? (
                        <EmptyThread />
                    ) : (
                        <div className="flex flex-col gap-4 p-4">
                            {messages.map((m) => (
                                <MessageBubble key={m.id} message={m} />
                            ))}
                        </div>
                    )}
                </div>

                {error && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <div className="relative">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder={
                            mode === "coding"
                                ? "Ask a coding question… (notes grounding off)"
                                : "Message your second brain… (Enter to send, Shift+Enter for newline)"
                        }
                        className="min-h-24 resize-none pr-24 pb-10"
                        disabled={sending}
                    />
                    <div className="absolute right-2 bottom-2 flex items-center gap-1">
                        {sending ? (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleStop}
                            >
                                <HugeiconsIcon icon={StopCircleIcon} />
                                Stop
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleSend}
                                disabled={!input.trim()}
                            >
                                <HugeiconsIcon icon={Sent02Icon} />
                                Send
                            </Button>
                        )}
                    </div>
                    <div className="absolute bottom-2 left-2">
                        <ModeToggle
                            mode={mode}
                            onChange={setMode}
                            disabled={sending}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function ConversationList({
    conversations,
    activeId,
    onSelect,
    onNew,
    onDelete,
}: {
    conversations: Conversation[] | null
    activeId: string | null
    onSelect: (id: string) => void
    onNew: () => void
    onDelete: (id: string) => void
}) {
    return (
        <aside className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border bg-card p-3">
            <Button onClick={onNew} size="sm" className="w-full justify-start">
                <HugeiconsIcon icon={Add01Icon} />
                New chat
            </Button>
            <ScrollArea className="flex-1">
                {conversations === null ? (
                    <div className="flex flex-col gap-2 py-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-9 w-full" />
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <p className="px-2 py-4 text-xs text-muted-foreground">
                        No conversations yet.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-0.5 py-1">
                        {conversations.map((c) => (
                            <li key={c.id}>
                                <ConversationRow
                                    conversation={c}
                                    active={c.id === activeId}
                                    onSelect={() => onSelect(c.id)}
                                    onDelete={() => onDelete(c.id)}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </ScrollArea>
        </aside>
    )
}

function ConversationRow({
    conversation,
    active,
    onSelect,
    onDelete,
}: {
    conversation: Conversation
    active: boolean
    onSelect: () => void
    onDelete: () => void
}) {
    return (
        <div
            className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
                active
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/40"
            )}
        >
            <button
                type="button"
                onClick={onSelect}
                className="flex-1 truncate text-left"
            >
                {conversation.title || "Untitled"}
            </button>
            <button
                type="button"
                aria-label="Delete conversation"
                onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                }}
                className="rounded-sm p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20"
            >
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
            </button>
        </div>
    )
}

function EmptyThread() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
            <HugeiconsIcon
                icon={MessageMultiple01Icon}
                className="size-10"
                strokeWidth={1.5}
            />
            <p className="text-sm">
                Ask anything. Your conversations live locally on this device.
            </p>
        </div>
    )
}

type Citation = {
    id: string
    title: string
    sources: ("fts" | "semantic")[]
}

function ModeToggle({
    mode,
    onChange,
    disabled,
}: {
    mode: Mode
    onChange: (m: Mode) => void
    disabled?: boolean
}) {
    const next: Mode = mode === "chat" ? "coding" : "chat"
    const icon = mode === "coding" ? CodeSquareIcon : Note01Icon
    const label = mode === "coding" ? "Coding" : "Notes"
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(next)}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            title={
                mode === "coding"
                    ? "Coding mode — switch to notes mode"
                    : "Notes mode — switch to coding mode"
            }
        >
            <HugeiconsIcon icon={icon} className="size-3.5" />
            {label}
        </Button>
    )
}

function MessageBubble({ message }: { message: LiveMessage }) {
    const isUser = message.role === "user"
    const { citations, reasoning, content } = useMemo(
        () => parseAssistantStream(message.content),
        [message.content]
    )

    return (
        <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-[min(90%,42rem)] rounded-lg px-3 py-2 text-sm",
                    isUser
                        ? "bg-primary text-primary-foreground"
                        : "border bg-background"
                )}
            >
                {reasoning && (
                    <details className="mb-2 rounded border border-dashed bg-muted/40 p-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer select-none">
                            Reasoning
                        </summary>
                        <pre className="mt-1 font-sans whitespace-pre-wrap">
                            {reasoning}
                        </pre>
                    </details>
                )}
                <div className="break-words whitespace-pre-wrap">
                    {content || (message.streaming ? "…" : "")}
                </div>
                {!isUser && citations.length > 0 && (
                    <Citations citations={citations} />
                )}
            </div>
        </div>
    )
}

function Citations({ citations }: { citations: Citation[] }) {
    return (
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
            <span>Sources:</span>
            {citations.map((c) => (
                <Link key={c.id} href={`/notes/${c.id}`}>
                    <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-accent"
                        title={c.sources.join(" + ")}
                    >
                        {c.title}
                    </Badge>
                </Link>
            ))}
        </div>
    )
}

// Stream framing:
//   <context>[…]</context>     — JSON array of Citation, may appear 0+ times
//   <think>…</think>           — reasoning tokens (optional)
//   …content…                  — actual assistant output
function parseAssistantStream(raw: string): {
    citations: Citation[]
    reasoning: string
    content: string
} {
    let rest = raw
    const byId = new Map<string, Citation>()
    while (rest.startsWith("<context>")) {
        const close = rest.indexOf("</context>")
        if (close < 0) {
            // Still streaming — wait for the closing tag.
            return { citations: [...byId.values()], reasoning: "", content: "" }
        }
        const json = rest.slice("<context>".length, close)
        try {
            const parsed = JSON.parse(json) as Citation[]
            for (const c of parsed) {
                const existing = byId.get(c.id)
                if (!existing) {
                    byId.set(c.id, { ...c, sources: [...c.sources] })
                } else {
                    for (const s of c.sources) {
                        if (!existing.sources.includes(s)) {
                            existing.sources.push(s)
                        }
                    }
                }
            }
        } catch {
            // Ignore malformed; skip past the tag.
        }
        rest = rest.slice(close + "</context>".length)
    }
    const citations = [...byId.values()]
    if (!rest.startsWith("<think>")) {
        return { citations, reasoning: "", content: rest }
    }
    const close = rest.indexOf("</think>")
    if (close < 0) {
        return {
            citations,
            reasoning: rest.slice("<think>".length),
            content: "",
        }
    }
    return {
        citations,
        reasoning: rest.slice("<think>".length, close),
        content: rest.slice(close + "</think>".length),
    }
}
