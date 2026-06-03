"use server"

import { repo } from "@/lib/db"
import type { NoteLinkWithTarget } from "@/lib/db/repo"
import {
    suggestLinksForNote,
    type LinkSuggestion,
} from "@/lib/ai/retrieval/links"

export async function linksForNote(
    noteId: string
): Promise<NoteLinkWithTarget[]> {
    return repo.links.forNote(noteId)
}

export async function addLink(
    sourceNoteId: string,
    targetNoteId: string,
    relationship?: string | null
): Promise<void> {
    await repo.links.add(sourceNoteId, targetNoteId, relationship ?? null)
}

export async function removeLink(
    sourceNoteId: string,
    targetNoteId: string
): Promise<void> {
    await repo.links.remove(sourceNoteId, targetNoteId)
}

export async function suggestLinks(
    noteId: string,
    k = 5
): Promise<LinkSuggestion[]> {
    return suggestLinksForNote(noteId, k)
}
