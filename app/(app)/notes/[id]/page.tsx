import { PageShell } from "@/components/app/page-shell"
import { NoteEditor } from "@/components/notes/note-editor"

export default async function NotePage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    return (
        <PageShell title="Note" description="Edit and link your thoughts.">
            <NoteEditor id={id} />
        </PageShell>
    )
}
