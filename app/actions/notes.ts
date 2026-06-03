"use server"

import { repo } from "@/lib/db"
import type { NoteWithTags } from "@/types/db"
import type { NotesListOptions } from "@/lib/db/repo"

export async function listNotes(
    opts: NotesListOptions = {}
): Promise<NoteWithTags[]> {
    return repo.notes.list(opts)
}

export async function getNote(id: string): Promise<NoteWithTags | null> {
    return repo.notes.get(id)
}

export async function createNote(title: string, content = "") {
    return repo.notes.create({ title, content })
}

export async function updateNote(
    id: string,
    patch: { title?: string; content?: string; summary?: string | null }
) {
    return repo.notes.update(id, patch)
}

export async function softDeleteNote(id: string) {
    await repo.notes.softDelete(id)
}
