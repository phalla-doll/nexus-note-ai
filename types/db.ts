// Schema types mirroring README SQL. Strings = TEXT, numbers = REAL/INT.
// Timestamps are ISO strings to match the SQL spec and survive D1.

export type Note = {
    id: string
    title: string
    content: string
    summary: string | null
    created_at: string
    updated_at: string
    deleted_at: string | null
}

export type Tag = {
    id: string
    name: string
}

export type NoteTag = {
    note_id: string
    tag_id: string
}

export type NoteLink = {
    source_note_id: string
    target_note_id: string
    relationship: string | null
}

export type NoteEmbedding = {
    note_id: string
    embedding: string
    updated_at: string
}

export type Project = {
    id: string
    name: string
    description: string | null
    created_at: string
}

export type FileRecord = {
    id: string
    note_id: string | null
    filename: string | null
    mime_type: string | null
    r2_key: string | null
    created_at: string
}

export type Conversation = {
    id: string
    title: string | null
    created_at: string
}

export type Message = {
    id: string
    conversation_id: string
    role: "user" | "assistant" | "system" | "tool"
    content: string
    created_at: string
}

export type CanvasDocument = {
    id: string
    name: string
    created_at: string
}

export type CanvasNode = {
    id: string
    canvas_id: string
    node_type: string
    position_x: number | null
    position_y: number | null
    data: string | null
}

export type CanvasEdge = {
    id: string
    canvas_id: string
    source_id: string
    target_id: string
}

export type AiJob = {
    id: string
    type: string
    status: "pending" | "running" | "succeeded" | "failed"
    payload: string | null
    result: string | null
    created_at: string
}

export type NewNote = Pick<Note, "title" | "content"> &
    Partial<Pick<Note, "summary">>

export type NoteWithTags = Note & { tags: Tag[] }
