import "server-only"

import { d1Query } from "@/lib/db/d1-driver"

// D1 FTS5 (notes_fts) full-text search. Triggers in 0001_init.sql keep the
// virtual table in sync with notes on every INSERT / UPDATE / DELETE.
// Phase 2 will fuse this with semantic results in lib/search/hybrid.ts.

export type FulltextHit = {
    id: string
    title: string
    snippet: string
    updated_at: string
}

function sanitizeQuery(raw: string): string {
    // FTS5 query string: quote each token so user input can't break the
    // syntax; AND them together. Drop empty tokens.
    const tokens = raw
        .trim()
        .split(/\s+/)
        .map((t) => t.replace(/["']/g, ""))
        .filter(Boolean)
    if (tokens.length === 0) return ""
    return tokens.map((t) => `"${t}"*`).join(" ")
}

export async function searchFulltext(
    query: string,
    limit = 20
): Promise<FulltextHit[]> {
    const match = sanitizeQuery(query)
    if (!match) return []
    const rows = await d1Query<{
        id: string
        title: string
        snippet: string
        updated_at: string
    }>(
        `SELECT n.id, n.title, n.updated_at,
                snippet(notes_fts, 1, '', '', '…', 16) AS snippet
         FROM notes_fts
         JOIN notes n ON n.rowid = notes_fts.rowid
         WHERE notes_fts MATCH ?
           AND n.deleted_at IS NULL
         ORDER BY rank
         LIMIT ?`,
        [match, limit]
    )
    return rows
}
