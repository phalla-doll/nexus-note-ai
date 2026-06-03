"use server"

import { repo } from "@/lib/db"
import { embedPassage } from "@/lib/ai/embeddings"
import { summarizeNote } from "@/lib/ai/summary"

// Background-style work attached to a note save. Each side effect is
// independent — a failure in one shouldn't block the other or the save
// path that triggered it.
export async function refreshNoteSideEffects(noteId: string): Promise<void> {
    const note = await repo.notes.get(noteId)
    if (!note || note.deleted_at) return

    await Promise.allSettled([
        (async () => {
            const text = `${note.title}\n\n${note.content}`.trim()
            if (!text) return
            const vec = await embedPassage(text)
            await repo.embeddings.upsert(noteId, vec)
        })(),
        (async () => {
            const summary = await summarizeNote(note.title, note.content)
            if (summary) {
                await repo.notes.update(noteId, { summary })
            }
        })(),
    ])
}
