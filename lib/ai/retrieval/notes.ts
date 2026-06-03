import "server-only"

import { searchHybrid } from "@/lib/search/hybrid"

// Note retrieval for chat grounding. Uses hybrid (FTS + semantic) search.

export type RetrievedNote = {
    id: string
    title: string
    content: string
    updated_at: string
    sources: ("fts" | "semantic")[]
}

const MAX_CHARS_PER_NOTE = 1200

function clamp(content: string, max = MAX_CHARS_PER_NOTE): string {
    if (content.length <= max) return content
    return content.slice(0, max).trimEnd() + "…"
}

export async function retrieveNotesForQuery(
    query: string,
    k = 5
): Promise<RetrievedNote[]> {
    if (!query.trim()) return []
    const hits = await searchHybrid(query, k)
    return hits.map((h) => ({
        id: h.id,
        title: h.title,
        content: clamp(h.content),
        updated_at: h.updated_at,
        sources: h.sources,
    }))
}

export function formatContextBlock(notes: RetrievedNote[]): string {
    if (notes.length === 0) return ""
    const sections = notes
        .map((n, i) => {
            const heading = `### Note ${i + 1}: ${n.title || "Untitled"}`
            const meta = `_id: ${n.id} · updated ${n.updated_at}_`
            return `${heading}\n${meta}\n\n${n.content}`
        })
        .join("\n\n---\n\n")
    return `The user's notes that look most relevant to the latest message are below. Treat these as ground truth; cite them by title when you use them.\n\n${sections}`
}
