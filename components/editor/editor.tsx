"use client"

import { useEffect, useState } from "react"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { Markdown } from "tiptap-markdown"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
    TextBoldIcon,
    TextItalicIcon,
    TextStrikethroughIcon,
    Heading01Icon,
    Heading02Icon,
    QuotesIcon,
    CodeSquareIcon,
    LeftToRightListDashIcon,
    LeftToRightListNumberIcon,
    CheckmarkSquare01Icon,
    Link01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type MarkdownStorage = { getMarkdown?: () => string }

function getMarkdown(editor: Editor): string {
    const storage = (editor.storage as unknown as Record<string, unknown>)
        .markdown as MarkdownStorage | undefined
    return storage?.getMarkdown?.() ?? ""
}

export type MarkdownEditorProps = {
    value: string
    onChange: (markdown: string) => void
    placeholder?: string
    className?: string
}

export function MarkdownEditor({
    value,
    onChange,
    placeholder = "Start writing…",
    className,
}: MarkdownEditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                // tiptap-markdown owns the markdown shortcuts; let starter-kit
                // handle the rest with sane defaults.
                link: {
                    openOnClick: false,
                    autolink: true,
                    HTMLAttributes: { rel: "noopener noreferrer" },
                },
            }),
            Placeholder.configure({ placeholder }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Markdown.configure({
                html: false,
                tightLists: true,
                linkify: true,
                breaks: false,
                transformPastedText: true,
                transformCopiedText: true,
            }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: cn(
                    "prose prose-sm max-w-none focus:outline-none dark:prose-invert",
                    "min-h-[60vh] leading-relaxed"
                ),
            },
        },
        onUpdate({ editor }) {
            const md = getMarkdown(editor)
            onChange(md)
        },
    })

    // Keep editor in sync when the source value changes from outside
    // (e.g. switching between notes). Skip when content already matches
    // to avoid clobbering the cursor while typing.
    useEffect(() => {
        if (!editor) return
        const current = getMarkdown(editor)
        if (current === value) return
        editor.commands.setContent(value, { emitUpdate: false })
    }, [editor, value])

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    )
}

function Toolbar({ editor }: { editor: Editor | null }) {
    const [linkOpen, setLinkOpen] = useState(false)

    if (!editor) return null

    return (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-md border bg-background/95 p-1 backdrop-blur">
            <ToolbarButton
                icon={TextBoldIcon}
                label="Bold"
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
                icon={TextItalicIcon}
                label="Italic"
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
                icon={TextStrikethroughIcon}
                label="Strikethrough"
                active={editor.isActive("strike")}
                onClick={() => editor.chain().focus().toggleStrike().run()}
            />
            <Divider />
            <ToolbarButton
                icon={Heading01Icon}
                label="Heading 1"
                active={editor.isActive("heading", { level: 1 })}
                onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
            />
            <ToolbarButton
                icon={Heading02Icon}
                label="Heading 2"
                active={editor.isActive("heading", { level: 2 })}
                onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
            />
            <Divider />
            <ToolbarButton
                icon={LeftToRightListDashIcon}
                label="Bullet list"
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
                icon={LeftToRightListNumberIcon}
                label="Numbered list"
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
                icon={CheckmarkSquare01Icon}
                label="Task list"
                active={editor.isActive("taskList")}
                onClick={() => editor.chain().focus().toggleTaskList().run()}
            />
            <Divider />
            <ToolbarButton
                icon={QuotesIcon}
                label="Quote"
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
            <ToolbarButton
                icon={CodeSquareIcon}
                label="Code block"
                active={editor.isActive("codeBlock")}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            />
            <ToolbarButton
                icon={Link01Icon}
                label="Link"
                active={editor.isActive("link")}
                onClick={() => setLinkOpen(true)}
            />
            <LinkDialog
                editor={editor}
                open={linkOpen}
                onOpenChange={setLinkOpen}
            />
        </div>
    )
}

function LinkDialog({
    editor,
    open,
    onOpenChange,
}: {
    editor: Editor
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const [url, setUrl] = useState("")

    useEffect(() => {
        if (!open) return
        const previous = editor.getAttributes("link").href as string | undefined
        setUrl(previous ?? "https://")
    }, [open, editor])

    const hasExistingLink = editor.isActive("link")

    function applyLink(next: string) {
        const trimmed = next.trim()
        if (trimmed === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
        } else {
            editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: trimmed })
                .run()
        }
        onOpenChange(false)
    }

    function removeLink() {
        editor.chain().focus().extendMarkRange("link").unsetLink().run()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {hasExistingLink ? "Edit link" : "Insert link"}
                    </DialogTitle>
                    <DialogDescription>
                        Enter a URL to link the selected text.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                        e.preventDefault()
                        applyLink(url)
                    }}
                >
                    <Label htmlFor="link-url">URL</Label>
                    <Input
                        id="link-url"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com"
                        autoFocus
                    />
                    <DialogFooter className="mt-2">
                        {hasExistingLink && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={removeLink}
                            >
                                Remove link
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit">
                            {hasExistingLink ? "Update" : "Insert"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function ToolbarButton({
    icon,
    label,
    active,
    onClick,
}: {
    icon: IconSvgElement
    label: string
    active: boolean
    onClick: () => void
}) {
    return (
        <Button
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={label}
            title={label}
            onClick={onClick}
        >
            <HugeiconsIcon icon={icon} />
        </Button>
    )
}

function Divider() {
    return <Separator orientation="vertical" className="mx-0.5 h-5" />
}

