import "server-only"

import { repo } from "@/lib/db"
import { d1Query } from "@/lib/db/d1-driver"
import { cosineSimilarity, embedQuery } from "@/lib/ai/embeddings"

// Hybrid retrieval: FTS5 lexical hits + cosine-sim semantic hits,
// fused with Reciprocal Rank Fusion (k=60). Returns full note rows so
// callers can pick what to do (snippet, full content, etc.).
//
// Scaling: this loads every embedding into memory per-request. Fine up
// to ~10k notes; swap in Cloudflare Vectorize when it stops being.

export type HybridHit = {
    id: string
    title: string
    content: string
    updated_at: string
    score: number
    sources: ("fts" | "semantic")[]
}

const RRF_K = 60

function sanitizeFtsQuery(raw: string): string {
    const tokens = raw
        .trim()
        .split(/\s+/)
        .map((t) => t.replace(/["']/g, ""))
        .filter((t) => t.length > 1)
    if (tokens.length === 0) return ""
    return tokens.map((t) => `"${t}"*`).join(" OR ")
}

async function ftsRanked(query: string, k: number) {
    const match = sanitizeFtsQuery(query)
    if (!match) return []
    return d1Query<{
        id: string
        title: string
        content: string
        updated_at: string
    }>(
        `SELECT n.id, n.title, n.content, n.updated_at
         FROM notes_fts
         JOIN notes n ON n.rowid = notes_fts.rowid
         WHERE notes_fts MATCH ?
           AND n.deleted_at IS NULL
         ORDER BY rank
         LIMIT ?`,
        [match, k]
    )
}

async function semanticRanked(query: string, k: number) {
    const queryVec = await embedQuery(query)
    const stored = await repo.embeddings.all()
    if (stored.length === 0) return []
    const scored = stored
        .map((s) => ({
            note_id: s.note_id,
            score: cosineSimilarity(queryVec, s.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
    if (scored.length === 0) return []
    const ids = scored.map((s) => s.note_id)
    const placeholders = ids.map(() => "?").join(",")
    const notes = await d1Query<{
        id: string
        title: string
        content: string
        updated_at: string
    }>(
        `SELECT id, title, content, updated_at
         FROM notes
         WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
        ids
    )
    const byId = new Map(notes.map((n) => [n.id, n]))
    return scored
        .map((s) => byId.get(s.note_id))
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
}

export async function searchHybrid(query: string, k = 5): Promise<HybridHit[]> {
    const pool = Math.max(k * 4, 20)
    const [ftsHits, semanticHits] = await Promise.all([
        ftsRanked(query, pool),
        semanticRanked(query, pool).catch(
            () => [] as Awaited<ReturnType<typeof semanticRanked>>
        ),
    ])

    type Acc = HybridHit & { rrf: number }
    const merged = new Map<string, Acc>()

    const add = (
        note: {
            id: string
            title: string
            content: string
            updated_at: string
        },
        rank: number,
        source: "fts" | "semantic"
    ) => {
        const inc = 1 / (RRF_K + rank)
        const existing = merged.get(note.id)
        if (existing) {
            existing.rrf += inc
            existing.score = existing.rrf
            if (!existing.sources.includes(source))
                existing.sources.push(source)
        } else {
            merged.set(note.id, {
                id: note.id,
                title: note.title,
                content: note.content,
                updated_at: note.updated_at,
                score: inc,
                rrf: inc,
                sources: [source],
            })
        }
    }

    ftsHits.forEach((h, i) => add(h, i + 1, "fts"))
    semanticHits.forEach((h, i) => add(h, i + 1, "semantic"))

    return Array.from(merged.values())
        .sort((a, b) => b.rrf - a.rrf)
        .slice(0, k)
        .map(
            (acc): HybridHit => ({
                id: acc.id,
                title: acc.title,
                content: acc.content,
                updated_at: acc.updated_at,
                score: acc.score,
                sources: acc.sources,
            })
        )
}
