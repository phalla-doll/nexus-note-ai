import { PageShell } from "@/components/app/page-shell"
import { NotesList } from "@/components/notes/notes-list"

export default function NotesPage() {
    return (
        <PageShell
            title="Notes"
            description="Capture, edit, and link your thoughts."
        >
            <NotesList />
        </PageShell>
    )
}
