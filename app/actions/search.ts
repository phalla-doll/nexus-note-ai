"use server"

import { searchFulltext, type FulltextHit } from "@/lib/search/fulltext"

export async function searchNotes(
    query: string,
    limit = 20
): Promise<FulltextHit[]> {
    return searchFulltext(query, limit)
}
