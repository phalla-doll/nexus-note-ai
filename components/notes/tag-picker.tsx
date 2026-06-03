"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    Tag01Icon,
    Cancel01Icon,
    Tick02Icon,
    Add01Icon,
} from "@hugeicons/core-free-icons"

import { listTags, setTagsForNote, upsertTag } from "@/app/actions/tags"
import type { Tag } from "@/types/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export function TagPicker({
    noteId,
    selected,
    onChange,
}: {
    noteId: string
    selected: Tag[]
    onChange: (next: Tag[]) => void
}) {
    const [open, setOpen] = useState(false)
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [query, setQuery] = useState("")

    const refreshAll = useCallback(async () => {
        setAllTags(await listTags())
    }, [])

    useEffect(() => {
        if (!open) return
        // eslint-disable-next-line react-hooks/set-state-in-effect -- async load on open
        void refreshAll()
    }, [open, refreshAll])

    const selectedIds = useMemo(
        () => new Set(selected.map((t) => t.id)),
        [selected]
    )

    const persist = useCallback(
        async (next: Tag[]) => {
            onChange(next)
            await setTagsForNote(
                noteId,
                next.map((t) => t.id)
            )
        },
        [noteId, onChange]
    )

    const toggle = useCallback(
        async (tag: Tag) => {
            const next = selectedIds.has(tag.id)
                ? selected.filter((t) => t.id !== tag.id)
                : [...selected, tag]
            await persist(next)
        },
        [persist, selected, selectedIds]
    )

    const handleCreate = useCallback(async () => {
        const name = query.trim()
        if (!name) return
        const tag = await upsertTag(name)
        setQuery("")
        await refreshAll()
        if (!selectedIds.has(tag.id)) {
            await persist([...selected, tag])
        }
    }, [persist, query, refreshAll, selected, selectedIds])

    const handleRemove = useCallback(
        async (tag: Tag) => {
            await persist(selected.filter((t) => t.id !== tag.id))
        },
        [persist, selected]
    )

    const normalizedQuery = query.trim().toLowerCase()
    const exactMatch = allTags.some(
        (t) => t.name.toLowerCase() === normalizedQuery
    )
    const canCreate = normalizedQuery.length > 0 && !exactMatch

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {selected.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
                    <span>{tag.name}</span>
                    <button
                        type="button"
                        aria-label={`Remove ${tag.name}`}
                        onClick={() => handleRemove(tag)}
                        className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                    >
                        <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                    </button>
                </Badge>
            ))}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-muted-foreground"
                    >
                        <HugeiconsIcon icon={Tag01Icon} className="size-4" />
                        <span>
                            {selected.length === 0 ? "Add tags" : "Edit"}
                        </span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-0">
                    <Command>
                        <CommandInput
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Search or create…"
                        />
                        <CommandList>
                            <CommandEmpty>No matches.</CommandEmpty>
                            {allTags.length > 0 && (
                                <CommandGroup heading="Tags">
                                    {allTags.map((tag) => {
                                        const checked = selectedIds.has(tag.id)
                                        return (
                                            <CommandItem
                                                key={tag.id}
                                                value={tag.name}
                                                onSelect={() => toggle(tag)}
                                            >
                                                <HugeiconsIcon
                                                    icon={Tick02Icon}
                                                    className={
                                                        checked
                                                            ? "size-4 opacity-100"
                                                            : "size-4 opacity-0"
                                                    }
                                                />
                                                <span>{tag.name}</span>
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            )}
                            {canCreate && (
                                <CommandGroup>
                                    <CommandItem
                                        value={`__create__${query}`}
                                        onSelect={handleCreate}
                                    >
                                        <HugeiconsIcon
                                            icon={Add01Icon}
                                            className="size-4"
                                        />
                                        <span>
                                            Create &quot;{query.trim()}&quot;
                                        </span>
                                    </CommandItem>
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
