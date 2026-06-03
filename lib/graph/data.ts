import "server-only"

import { repo } from "@/lib/db"
import { d1Query } from "@/lib/db/d1-driver"
import { cosineSimilarity } from "@/lib/ai/embeddings"

export type GraphNode = {
    id: string
    title: string
    tag_count: number
    link_count: number
}

export type GraphEdge = {
    source: string
    target: string
    type: "link" | "similarity"
    score?: number
}

export type GraphData = {
    nodes: GraphNode[]
    edges: GraphEdge[]
}

// Similarity edges: keep top-K per node above MIN_SCORE, then dedupe
// undirected. Bumped above the link-suggestion threshold so the graph
// stays readable instead of "everything connects to everything."
const SIMILARITY_K = 3
const SIMILARITY_MIN_SCORE = 0.55

export async function getGraphData(): Promise<GraphData> {
    const [noteRows, linkRows, embeddings] = await Promise.all([
        d1Query<{
            id: string
            title: string
            tag_count: number
            link_count: number
        }>(
            `SELECT n.id, n.title,
                    COUNT(DISTINCT nt.tag_id) AS tag_count,
                    COUNT(DISTINCT nl.target_note_id) AS link_count
             FROM notes n
             LEFT JOIN note_tags nt ON nt.note_id = n.id
             LEFT JOIN note_links nl ON nl.source_note_id = n.id
             WHERE n.deleted_at IS NULL
             GROUP BY n.id`
        ),
        d1Query<{ source_note_id: string; target_note_id: string }>(
            `SELECT nl.source_note_id, nl.target_note_id
             FROM note_links nl
             JOIN notes s ON s.id = nl.source_note_id
             JOIN notes t ON t.id = nl.target_note_id
             WHERE s.deleted_at IS NULL AND t.deleted_at IS NULL`
        ),
        repo.embeddings.all(),
    ])

    const nodes: GraphNode[] = noteRows.map((r) => ({
        id: r.id,
        title: r.title || "Untitled",
        tag_count: r.tag_count ?? 0,
        link_count: r.link_count ?? 0,
    }))

    const linkEdges: GraphEdge[] = linkRows.map((l) => ({
        source: l.source_note_id,
        target: l.target_note_id,
        type: "link",
    }))

    // Top-K per node by cosine sim, then undirected dedupe.
    const seen = new Set<string>()
    for (const e of linkEdges) {
        seen.add(undirectedKey(e.source, e.target))
    }

    const similarityEdges: GraphEdge[] = []
    if (embeddings.length > 1) {
        for (const src of embeddings) {
            const scored = embeddings
                .filter((other) => other.note_id !== src.note_id)
                .map((other) => ({
                    target: other.note_id,
                    score: cosineSimilarity(src.embedding, other.embedding),
                }))
                .filter((s) => s.score >= SIMILARITY_MIN_SCORE)
                .sort((a, b) => b.score - a.score)
                .slice(0, SIMILARITY_K)

            for (const s of scored) {
                const key = undirectedKey(src.note_id, s.target)
                if (seen.has(key)) continue
                seen.add(key)
                similarityEdges.push({
                    source: src.note_id,
                    target: s.target,
                    type: "similarity",
                    score: s.score,
                })
            }
        }
    }

    return { nodes, edges: [...linkEdges, ...similarityEdges] }
}

function undirectedKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`
}
