"use client"

import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tag01Icon } from "@hugeicons/core-free-icons"

import { listTags } from "@/app/actions/tags"
import type { Tag } from "@/types/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function TagFilter({
    selectedIds,
    onChange,
}: {
    selectedIds: string[]
    onChange: (next: string[]) => void
}) {
    const [tags, setTags] = useState<Tag[]>([])

    useEffect(() => {
        let cancelled = false
        void listTags().then((next) => {
            if (!cancelled) setTags(next)
        })
        return () => {
            cancelled = true
        }
    }, [])

    if (tags.length === 0) return null

    const selected = new Set(selectedIds)
    const toggle = (id: string) => {
        if (selected.has(id)) {
            onChange(selectedIds.filter((x) => x !== id))
        } else {
            onChange([...selectedIds, id])
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <HugeiconsIcon icon={Tag01Icon} className="size-3.5" />
                Filter
            </span>
            {tags.map((tag) => {
                const active = selected.has(tag.id)
                return (
                    <Badge
                        key={tag.id}
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer select-none"
                        onClick={() => toggle(tag.id)}
                    >
                        {tag.name}
                    </Badge>
                )
            })}
            {selectedIds.length > 0 && (
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-muted-foreground"
                    onClick={() => onChange([])}
                >
                    Clear
                </Button>
            )}
        </div>
    )
}
