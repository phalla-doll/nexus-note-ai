"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    Note01Icon,
    Search01Icon,
    BubbleChatIcon,
    ConnectIcon,
    GridViewIcon,
    Folder01Icon,
    Settings02Icon,
    Add01Icon,
} from "@hugeicons/core-free-icons"

import { createNote } from "@/app/actions/notes"
import { searchNotes } from "@/app/actions/search"
import type { FulltextHit } from "@/lib/search/fulltext"
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"

const NAV = [
    { href: "/notes", label: "Notes", icon: Note01Icon },
    { href: "/search", label: "Search", icon: Search01Icon },
    { href: "/chat", label: "Chat", icon: BubbleChatIcon },
    { href: "/graph", label: "Graph", icon: ConnectIcon },
    { href: "/canvas", label: "Canvas", icon: GridViewIcon },
    { href: "/projects", label: "Projects", icon: Folder01Icon },
    { href: "/settings", label: "Settings", icon: Settings02Icon },
]

export function CommandPalette() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [hits, setHits] = useState<FulltextHit[]>([])

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                setOpen((prev) => !prev)
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [])

    useEffect(() => {
        if (!open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on close
            setQuery("")
            setHits([])
        }
    }, [open])

    useEffect(() => {
        const trimmed = query.trim()
        if (!trimmed) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- clear when query empty
            setHits([])
            return
        }
        let cancelled = false
        const handle = setTimeout(async () => {
            const next = await searchNotes(trimmed, 8)
            if (!cancelled) setHits(next)
        }, 120)
        return () => {
            cancelled = true
            clearTimeout(handle)
        }
    }, [query])

    const go = useCallback(
        (href: string) => {
            setOpen(false)
            router.push(href)
        },
        [router]
    )

    const handleCreateNote = useCallback(async () => {
        const note = await createNote(query.trim() || "Untitled")
        setOpen(false)
        router.push(`/notes/${note.id}`)
    }, [query, router])

    return (
        <CommandDialog
            open={open}
            onOpenChange={setOpen}
            title="Command palette"
            description="Search notes, navigate, or create."
        >
            <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder="Search notes or jump to…"
            />
            <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                {hits.length > 0 && (
                    <CommandGroup heading="Notes">
                        {hits.map((hit) => (
                            <CommandItem
                                key={hit.id}
                                value={`note:${hit.id}:${hit.title}`}
                                onSelect={() => go(`/notes/${hit.id}`)}
                            >
                                <HugeiconsIcon icon={Note01Icon} />
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate">
                                        {hit.title}
                                    </span>
                                    {hit.snippet && (
                                        <span className="truncate text-xs text-muted-foreground">
                                            {hit.snippet}
                                        </span>
                                    )}
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}
                {hits.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Actions">
                    <CommandItem
                        value="action:new-note"
                        onSelect={handleCreateNote}
                    >
                        <HugeiconsIcon icon={Add01Icon} />
                        <span>
                            {query.trim()
                                ? `Create note "${query.trim()}"`
                                : "Create new note"}
                        </span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Navigate">
                    {NAV.map((item) => (
                        <CommandItem
                            key={item.href}
                            value={`nav:${item.label}`}
                            onSelect={() => go(item.href)}
                        >
                            <HugeiconsIcon icon={item.icon} />
                            <span>{item.label}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    )
}
