// Repository interface. Production driver is Cloudflare D1
// (./d1-driver) — server-only, accessed via server actions.

import type {
    Conversation,
    FileRecord,
    Message,
    NewNote,
    Note,
    NoteEmbedding,
    NoteLink,
    NoteWithTags,
    Tag,
} from "@/types/db"

export type NotesListOptions = {
    tagIds?: string[]
    query?: string
    includeDeleted?: boolean
}

export interface NotesRepo {
    list(opts?: NotesListOptions): Promise<NoteWithTags[]>
    get(id: string): Promise<NoteWithTags | null>
    create(input: NewNote): Promise<Note>
    update(
        id: string,
        patch: Partial<Pick<Note, "title" | "content" | "summary">>
    ): Promise<Note>
    softDelete(id: string): Promise<void>
    hardDelete(id: string): Promise<void>
}

export interface TagsRepo {
    list(): Promise<Tag[]>
    upsertByName(name: string): Promise<Tag>
    setForNote(noteId: string, tagIds: string[]): Promise<void>
    forNote(noteId: string): Promise<Tag[]>
    remove(id: string): Promise<void>
}

export interface ConversationsRepo {
    list(): Promise<Conversation[]>
    get(id: string): Promise<Conversation | null>
    create(title?: string | null): Promise<Conversation>
    rename(id: string, title: string): Promise<Conversation>
    remove(id: string): Promise<void>
}

export interface MessagesRepo {
    listForConversation(conversationId: string): Promise<Message[]>
    append(
        conversationId: string,
        role: Message["role"],
        content: string
    ): Promise<Message>
}

export type StoredEmbedding = {
    note_id: string
    embedding: number[]
    updated_at: string
}

export interface EmbeddingsRepo {
    upsert(noteId: string, embedding: number[]): Promise<void>
    get(noteId: string): Promise<NoteEmbedding | null>
    all(): Promise<StoredEmbedding[]>
    remove(noteId: string): Promise<void>
}

export type NoteLinkWithTarget = NoteLink & {
    target_title: string
}

export interface LinksRepo {
    forNote(noteId: string): Promise<NoteLinkWithTarget[]>
    add(
        sourceNoteId: string,
        targetNoteId: string,
        relationship?: string | null
    ): Promise<void>
    remove(sourceNoteId: string, targetNoteId: string): Promise<void>
}

export interface FilesRepo {
    listForNote(noteId: string): Promise<FileRecord[]>
    get(id: string): Promise<FileRecord | null>
    create(input: {
        noteId: string | null
        filename: string
        mimeType: string | null
        r2Key: string
    }): Promise<FileRecord>
    remove(id: string): Promise<void>
}

export interface Repo {
    notes: NotesRepo
    tags: TagsRepo
    conversations: ConversationsRepo
    messages: MessagesRepo
    embeddings: EmbeddingsRepo
    links: LinksRepo
    files: FilesRepo
}
