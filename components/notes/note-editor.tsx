"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import { getNote, softDeleteNote, updateNote } from "@/app/actions/notes"
import { refreshNoteSideEffects } from "@/app/actions/note-jobs"
import type { NoteWithTags } from "@/types/db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { MarkdownEditor } from "@/components/editor/editor"
import { TagPicker } from "@/components/notes/tag-picker"
import { NoteLinks } from "@/components/notes/note-links"
import { NoteAttachments } from "@/components/notes/note-attachments"
import type { Tag } from "@/types/db"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type Status = "idle" | "saving" | "saved" | "error"

const AUTOSAVE_MS = 500
// AI side effects (embedding + summary) run after a longer idle window
// to avoid burning model calls on every keystroke autosave.
const SIDE_EFFECTS_MS = 5000

export function NoteEditor({ id }: { id: string }) {
    const router = useRouter()
    const [note, setNote] = useState<NoteWithTags | null>(null)
    const [notFound, setNotFound] = useState(false)
    const [title, setTitle] = useState("")
    const [content, setContent] = useState("")
    const [status, setStatus] = useState<Status>("idle")
    const dirty = useRef(false)
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const sideEffectsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [aiRefreshKey, setAiRefreshKey] = useState(0)

    useEffect(() => {
        let cancelled = false
        void getNote(id).then((found) => {
            if (cancelled) return
            if (!found) {
                setNotFound(true)
                return
            }
            setNote(found)
            setTitle(found.title)
            setContent(found.content)
        })
        return () => {
            cancelled = true
        }
    }, [id])

    const persist = useCallback(
        async (nextTitle: string, nextContent: string) => {
            setStatus("saving")
            try {
                const updated = await updateNote(id, {
                    title: nextTitle,
                    content: nextContent,
                })
                setNote((prev) => (prev ? { ...prev, ...updated } : prev))
                setStatus("saved")
                dirty.current = false
                if (sideEffectsTimer.current)
                    clearTimeout(sideEffectsTimer.current)
                sideEffectsTimer.current = setTimeout(() => {
                    void refreshNoteSideEffects(id)
                        .then(() => setAiRefreshKey((k) => k + 1))
                        .catch(() => {
                            // Background job — failures are non-fatal.
                        })
                }, SIDE_EFFECTS_MS)
            } catch {
                setStatus("error")
            }
        },
        [id]
    )

    const scheduleSave = useCallback(
        (nextTitle: string, nextContent: string) => {
            dirty.current = true
            setStatus("idle")
            if (saveTimer.current) clearTimeout(saveTimer.current)
            saveTimer.current = setTimeout(() => {
                void persist(nextTitle, nextContent)
            }, AUTOSAVE_MS)
        },
        [persist]
    )

    useEffect(() => {
        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current)
            if (sideEffectsTimer.current) clearTimeout(sideEffectsTimer.current)
        }
    }, [])

    const handleDelete = useCallback(async () => {
        await softDeleteNote(id)
        router.push("/notes")
    }, [id, router])

    if (notFound) {
        return (
            <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                    This note doesn&apos;t exist.
                </p>
                <Button variant="outline" onClick={() => router.push("/notes")}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} />
                    Back to notes
                </Button>
            </div>
        )
    }

    if (!note) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/notes")}
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} />
                    All notes
                </Button>
                <span
                    className="ml-auto text-xs text-muted-foreground"
                    aria-live="polite"
                >
                    {statusLabel(status)}
                </span>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                        >
                            <HugeiconsIcon icon={Delete02Icon} />
                            Delete
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Delete this note?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                It will be moved to trash and stop appearing in
                                your list.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            <Input
                value={title}
                placeholder="Untitled"
                onChange={(event) => {
                    const next = event.target.value
                    setTitle(next)
                    scheduleSave(next, content)
                }}
                className="border-none px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0 md:text-3xl"
            />

            <TagPicker
                noteId={id}
                selected={note.tags}
                onChange={(tags: Tag[]) =>
                    setNote((prev) => (prev ? { ...prev, tags } : prev))
                }
            />

            <NoteLinks noteId={id} refreshKey={aiRefreshKey} />

            <MarkdownEditor
                value={content}
                onChange={(next) => {
                    setContent(next)
                    scheduleSave(title, next)
                }}
            />

            <NoteAttachments
                noteId={id}
                onInsertReference={(markdown) => {
                    const next = content
                        ? `${content.trimEnd()}\n\n${markdown}\n`
                        : `${markdown}\n`
                    setContent(next)
                    scheduleSave(title, next)
                }}
            />
        </div>
    )
}

function statusLabel(status: Status) {
    switch (status) {
        case "saving":
            return "Saving…"
        case "saved":
            return "Saved"
        case "error":
            return "Save failed"
        default:
            return ""
    }
}
