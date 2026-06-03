"use server"

import { d1Query } from "@/lib/db/d1-driver"
import { refreshNoteSideEffects } from "./note-jobs"

export type BackfillResult = {
    candidates: number
    succeeded: number
    failed: number
}

// Find notes that are missing either an embedding or a summary and run
// the standard side-effects pipeline on each. Serial so we don't hammer
// the model provider — small personal volume makes that fine.
export async function backfillNoteAi(): Promise<BackfillResult> {
    const rows = await d1Query<{ id: string }>(
        `SELECT n.id
         FROM notes n
         LEFT JOIN note_embeddings ne ON ne.note_id = n.id
         WHERE n.deleted_at IS NULL
           AND (ne.note_id IS NULL OR n.summary IS NULL OR n.summary = '')`
    )

    let succeeded = 0
    let failed = 0
    for (const row of rows) {
        try {
            await refreshNoteSideEffects(row.id)
            succeeded++
        } catch {
            failed++
        }
    }

    return { candidates: rows.length, succeeded, failed }
}
