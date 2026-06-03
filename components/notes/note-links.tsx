"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    Link01Icon,
    MagicWand01Icon,
    Cancel01Icon,
    Add01Icon,
} from "@hugeicons/core-free-icons"

import {
    addLink,
    linksForNote,
    removeLink,
    suggestLinks,
} from "@/app/actions/links"
import type { NoteLinkWithTarget } from "@/lib/db/repo"
import type { LinkSuggestion } from "@/lib/ai/retrieval/links"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const SUGGESTION_LIMIT = 5

// Source-note links + AI-suggested links surface. Refresh is triggered by
// the parent editor via `refreshKey` (changes whenever side-effects run).
export function NoteLinks({
    noteId,
    refreshKey,
}: {
    noteId: string
    refreshKey: number
}) {
    const [links, setLinks] = useState<NoteLinkWithTarget[] | null>(null)
    const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([])
    const [busyId, setBusyId] = useState<string | null>(null)

    const load = useCallback(async () => {
        const [existing, suggested] = await Promise.all([
            linksForNote(noteId),
            suggestLinks(noteId, SUGGESTION_LIMIT),
        ])
        setLinks(existing)
        setSuggestions(suggested)
    }, [noteId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after await
        void load()
    }, [load, refreshKey])

    const handleAccept = useCallback(
        async (target: LinkSuggestion) => {
            setBusyId(target.id)
            try {
                await addLink(noteId, target.id)
                await load()
            } finally {
                setBusyId(null)
            }
        },
        [load, noteId]
    )

    const handleRemove = useCallback(
        async (targetId: string) => {
            setBusyId(targetId)
            try {
                await removeLink(noteId, targetId)
                await load()
            } finally {
                setBusyId(null)
            }
        },
        [load, noteId]
    )

    if (links === null) {
        return (
            <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-7 w-full" />
            </div>
        )
    }

    if (links.length === 0 && suggestions.length === 0) return null

    return (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <HugeiconsIcon icon={Link01Icon} className="size-3.5" />
                Linked notes
            </div>

            {links.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {links.map((l) => (
                        <Badge
                            key={l.target_note_id}
                            variant="secondary"
                            className="gap-1 pr-1"
                        >
                            <Link
                                href={`/notes/${l.target_note_id}`}
                                className="hover:underline"
                            >
                                {l.target_title || "Untitled"}
                            </Link>
                            <button
                                type="button"
                                aria-label="Remove link"
                                disabled={busyId === l.target_note_id}
                                onClick={() => handleRemove(l.target_note_id)}
                                className="rounded-sm p-0.5 hover:bg-muted-foreground/20 disabled:opacity-50"
                            >
                                <HugeiconsIcon
                                    icon={Cancel01Icon}
                                    className="size-3"
                                />
                            </button>
                        </Badge>
                    ))}
                </div>
            ) : null}

            {suggestions.length > 0 && (
                <>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <HugeiconsIcon
                            icon={MagicWand01Icon}
                            className="size-3.5"
                        />
                        Suggested
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((s) => (
                            <Button
                                key={s.id}
                                variant="outline"
                                size="sm"
                                disabled={busyId === s.id}
                                onClick={() => handleAccept(s)}
                                className="h-6 gap-1 border-dashed px-2 text-xs font-normal"
                                title={`Similarity ${(s.score * 100).toFixed(0)}%`}
                            >
                                <HugeiconsIcon
                                    icon={Add01Icon}
                                    className="size-3"
                                />
                                <span>{s.title}</span>
                            </Button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
