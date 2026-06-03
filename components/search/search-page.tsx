"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"

import { searchNotes } from "@/app/actions/search"
import type { FulltextHit } from "@/lib/search/fulltext"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

const DEBOUNCE_MS = 150

export function SearchPageClient() {
    const [query, setQuery] = useState("")
    const [hits, setHits] = useState<FulltextHit[] | null>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const trimmed = query.trim()
        if (!trimmed) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- clear when empty
            setHits([])
            setLoading(false)
            return
        }
        setLoading(true)
        const handle = setTimeout(async () => {
            const next = await searchNotes(trimmed, 30)
            setHits(next)
            setLoading(false)
        }, DEBOUNCE_MS)
        return () => clearTimeout(handle)
    }, [query])

    return (
        <div className="flex flex-col gap-4">
            <div className="relative max-w-xl">
                <HugeiconsIcon
                    icon={Search01Icon}
                    className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search across notes…"
                    className="pl-9"
                    autoFocus
                />
            </div>

            {loading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                    ))}
                </div>
            ) : query.trim() === "" ? (
                <p className="text-sm text-muted-foreground">
                    Type to search note titles and content.
                </p>
            ) : hits && hits.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No matches for &quot;{query.trim()}&quot;.
                </p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {hits?.map((hit) => (
                        <li key={hit.id}>
                            <Link
                                href={`/notes/${hit.id}`}
                                className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
                            >
                                <h2 className="truncate font-medium">
                                    {hit.title}
                                </h2>
                                {hit.snippet && (
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                        {hit.snippet}
                                    </p>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
