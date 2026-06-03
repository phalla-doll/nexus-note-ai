"use server"

import { repo } from "@/lib/db"
import type { Tag } from "@/types/db"

export async function listTags(): Promise<Tag[]> {
    return repo.tags.list()
}

export async function upsertTag(name: string): Promise<Tag> {
    return repo.tags.upsertByName(name)
}

export async function setTagsForNote(noteId: string, tagIds: string[]) {
    await repo.tags.setForNote(noteId, tagIds)
}

export async function tagsForNote(noteId: string): Promise<Tag[]> {
    return repo.tags.forNote(noteId)
}
