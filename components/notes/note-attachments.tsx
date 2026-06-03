"use client"

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    AttachmentIcon,
    CloudUploadIcon,
    Cancel01Icon,
    Image01Icon,
    File01Icon,
    Loading02Icon,
} from "@hugeicons/core-free-icons"

import { listFilesForNote, deleteFile } from "@/app/actions/files"
import type { FileRecord } from "@/types/db"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function isImage(mime: string | null | undefined): boolean {
    return typeof mime === "string" && mime.startsWith("image/")
}

function humanSize(file: FileRecord): string {
    // We don't store size yet — best-effort label using filename.
    return file.mime_type ?? "file"
}

function markdownReference(file: FileRecord): string {
    const url = `/api/files/${file.id}`
    const safeName = (file.filename ?? "file").replace(/[\]\[]/g, "")
    return isImage(file.mime_type)
        ? `![${safeName}](${url})`
        : `[${safeName}](${url})`
}

export function NoteAttachments({
    noteId,
    onInsertReference,
}: {
    noteId: string
    onInsertReference?: (markdown: string) => void
}) {
    const [files, setFiles] = useState<FileRecord[] | null>(null)
    const [uploading, setUploading] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement | null>(null)

    const refresh = useCallback(async () => {
        setFiles(await listFilesForNote(noteId))
    }, [noteId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- async load
        void refresh()
    }, [refresh])

    const uploadOne = useCallback(
        async (file: File) => {
            const form = new FormData()
            form.append("file", file)
            form.append("noteId", noteId)
            const res = await fetch("/api/files", {
                method: "POST",
                body: form,
            })
            if (!res.ok) {
                const text = await res.text()
                throw new Error(text || `Upload failed (${res.status})`)
            }
            return (await res.json()) as FileRecord
        },
        [noteId]
    )

    const upload = useCallback(
        async (incoming: FileList | File[]) => {
            const arr = Array.from(incoming)
            if (arr.length === 0) return
            setUploading(true)
            setError(null)
            try {
                for (const file of arr) {
                    const record = await uploadOne(file)
                    if (onInsertReference) {
                        onInsertReference(markdownReference(record))
                    }
                }
                await refresh()
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
            } finally {
                setUploading(false)
            }
        },
        [onInsertReference, refresh, uploadOne]
    )

    const handleDelete = useCallback(
        async (id: string) => {
            await deleteFile(id)
            await refresh()
        },
        [refresh]
    )

    const onDrop = useCallback(
        (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer.files.length > 0) {
                void upload(e.dataTransfer.files)
            }
        },
        [upload]
    )

    const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDragging(true)
    }, [])

    const onDragLeave = useCallback(() => setDragging(false), [])

    return (
        <div className="flex flex-col gap-2">
            <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                    if (e.target.files) void upload(e.target.files)
                    e.target.value = ""
                }}
            />

            <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={cn(
                    "flex flex-col gap-2 rounded-md border border-dashed p-3 transition-colors",
                    dragging
                        ? "border-primary/60 bg-primary/5"
                        : "border-border bg-muted/20"
                )}
            >
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <HugeiconsIcon icon={AttachmentIcon} className="size-3.5" />
                    Attachments
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={uploading}
                        onClick={() => inputRef.current?.click()}
                        className="ml-auto h-6 gap-1 px-2 text-xs"
                    >
                        {uploading ? (
                            <>
                                <HugeiconsIcon
                                    icon={Loading02Icon}
                                    className="size-3.5 animate-spin"
                                />
                                Uploading…
                            </>
                        ) : (
                            <>
                                <HugeiconsIcon
                                    icon={CloudUploadIcon}
                                    className="size-3.5"
                                />
                                Upload
                            </>
                        )}
                    </Button>
                </div>

                {files === null ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                ) : files.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        Drop files here or click upload. Images insert as
                        markdown automatically.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {files.map((file) => (
                            <li
                                key={file.id}
                                className="flex items-center gap-2 rounded border bg-background px-2 py-1.5 text-sm"
                            >
                                <HugeiconsIcon
                                    icon={
                                        isImage(file.mime_type)
                                            ? Image01Icon
                                            : File01Icon
                                    }
                                    className="size-4 shrink-0 text-muted-foreground"
                                />
                                <a
                                    href={`/api/files/${file.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="min-w-0 flex-1 truncate hover:underline"
                                >
                                    {file.filename || "Untitled"}
                                </a>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {humanSize(file)}
                                </span>
                                {onInsertReference && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() =>
                                            onInsertReference(
                                                markdownReference(file)
                                            )
                                        }
                                    >
                                        Insert
                                    </Button>
                                )}
                                <button
                                    type="button"
                                    aria-label="Remove attachment"
                                    onClick={() => handleDelete(file.id)}
                                    className="rounded-sm p-1 text-muted-foreground hover:bg-muted-foreground/20"
                                >
                                    <HugeiconsIcon
                                        icon={Cancel01Icon}
                                        className="size-3"
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
        </div>
    )
}
