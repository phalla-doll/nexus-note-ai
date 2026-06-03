"use server"

import { repo } from "@/lib/db"
import { deleteObject } from "@/lib/storage/r2"
import type { FileRecord } from "@/types/db"

export async function listFilesForNote(noteId: string): Promise<FileRecord[]> {
    return repo.files.listForNote(noteId)
}

export async function deleteFile(id: string): Promise<void> {
    const file = await repo.files.get(id)
    if (!file) return
    if (file.r2_key) {
        try {
            await deleteObject(file.r2_key)
        } catch {
            // If R2 delete fails (network, already gone) we still drop the
            // metadata row — orphan objects can be cleaned up out-of-band.
        }
    }
    await repo.files.remove(id)
}
