import "server-only"

import { repo } from "@/lib/db"
import { d1Query } from "@/lib/db/d1-driver"
import { cosineSimilarity } from "@/lib/ai/embeddings"

export type LinkSuggestion = {
    id: string
    title: string
    score: number
}

const MIN_SCORE = 0.45

// Suggest other notes most semantically similar to the source note.
// Filters out: self, already-linked targets, soft-deleted notes, and
// matches below MIN_SCORE so the UI doesn't surface noise.
export async function suggestLinksForNote(
    noteId: string,
    k = 5
): Promise<LinkSuggestion[]> {
    const source = await repo.embeddings.get(noteId)
    if (!source) return []
    const sourceVec = JSON.parse(source.embedding) as number[]

    const existing = await repo.links.forNote(noteId)
    const exclude = new Set<string>([
        noteId,
        ...existing.map((l) => l.target_note_id),
    ])

    const allEmbeddings = await repo.embeddings.all()
    const scored = allEmbeddings
        .filter((e) => !exclude.has(e.note_id))
        .map((e) => ({
            note_id: e.note_id,
            score: cosineSimilarity(sourceVec, e.embedding),
        }))
        .filter((s) => s.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, k)

    if (scored.length === 0) return []

    const ids = scored.map((s) => s.note_id)
    const placeholders = ids.map(() => "?").join(",")
    const titles = await d1Query<{ id: string; title: string }>(
        `SELECT id, title FROM notes
         WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
        ids
    )
    const byId = new Map(titles.map((t) => [t.id, t.title]))
    return scored
        .map((s) => {
            const title = byId.get(s.note_id)
            if (!title && title !== "") return null
            return {
                id: s.note_id,
                title: title || "Untitled",
                score: s.score,
            }
        })
        .filter((s): s is LinkSuggestion => s !== null)
}
