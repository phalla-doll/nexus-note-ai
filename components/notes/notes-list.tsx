"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Note01Icon, SparklesIcon } from "@hugeicons/core-free-icons"

import { createNote, listNotes } from "@/app/actions/notes"
import type { NoteWithTags } from "@/types/db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { TagFilter } from "@/components/notes/tag-filter"

function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    })
}

function previewOf(content: string) {
    return content.replace(/\s+/g, " ").trim().slice(0, 160)
}

export function NotesList() {
    const router = useRouter()
    const [notes, setNotes] = useState<NoteWithTags[] | null>(null)
    const [query, setQuery] = useState("")
    const [tagIds, setTagIds] = useState<string[]>([])
    const [creating, setCreating] = useState(false)

    const load = useCallback(async () => {
        const next = await listNotes({
            query: query.trim() || undefined,
            tagIds: tagIds.length > 0 ? tagIds : undefined,
        })
        setNotes(next)
    }, [query, tagIds])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after await
        void load()
    }, [load])

    const handleCreate = useCallback(async () => {
        setCreating(true)
        try {
            const note = await createNote("Untitled")
            router.push(`/notes/${note.id}`)
        } finally {
            setCreating(false)
        }
    }, [router])

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter notes…"
                    className="max-w-sm"
                />
                <div className="ml-auto">
                    <Button onClick={handleCreate} disabled={creating}>
                        <HugeiconsIcon icon={Add01Icon} />
                        New note
                    </Button>
                </div>
            </div>

            <TagFilter selectedIds={tagIds} onChange={setTagIds} />

            {notes === null ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                    ))}
                </div>
            ) : notes.length === 0 ? (
                <EmptyState onCreate={handleCreate} disabled={creating} />
            ) : (
                <ul className="flex flex-col gap-2">
                    {notes.map((note) => (
                        <li key={note.id}>
                            <Link
                                href={`/notes/${note.id}`}
                                className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="truncate font-medium">
                                        {note.title || "Untitled"}
                                    </h2>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {formatDate(note.updated_at)}
                                    </span>
                                </div>
                                {note.summary ? (
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                        <HugeiconsIcon
                                            icon={SparklesIcon}
                                            className="mr-1 inline size-3 align-[-2px] text-primary/60"
                                        />
                                        {note.summary}
                                    </p>
                                ) : note.content ? (
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                        {previewOf(note.content)}
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">
                                        Empty note
                                    </p>
                                )}
                                {note.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {note.tags.map((tag) => (
                                            <Badge
                                                key={tag.id}
                                                variant="secondary"
                                            >
                                                {tag.name}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

function EmptyState({
    onCreate,
    disabled,
}: {
    onCreate: () => void
    disabled: boolean
}) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <HugeiconsIcon
                icon={Note01Icon}
                className="size-10 text-muted-foreground"
                strokeWidth={1.5}
            />
            <div className="flex flex-col gap-1">
                <p className="font-medium">No notes yet</p>
                <p className="text-sm text-muted-foreground">
                    Start a note to seed your second brain.
                </p>
            </div>
            <Button onClick={onCreate} disabled={disabled} size="sm">
                <HugeiconsIcon icon={Add01Icon} />
                New note
            </Button>
        </div>
    )
}
