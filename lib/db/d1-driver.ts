import "server-only"

import { nanoid } from "nanoid"

import type {
    Conversation,
    FileRecord,
    Message,
    NewNote,
    Note,
    NoteEmbedding,
    NoteWithTags,
    Tag,
} from "@/types/db"
import type {
    ConversationsRepo,
    EmbeddingsRepo,
    FilesRepo,
    LinksRepo,
    MessagesRepo,
    NoteLinkWithTarget,
    NotesListOptions,
    NotesRepo,
    Repo,
    StoredEmbedding,
    TagsRepo,
} from "./repo"

// D1 REST client — talks to the prod database from any server-side context
// (server actions, route handlers). Configured via env:
//   CLOUDFLARE_ACCOUNT_ID
//   CLOUDFLARE_D1_DATABASE_ID
//   CLOUDFLARE_API_TOKEN  (D1 edit permission)

type D1Row = Record<string, unknown>

type D1QueryResult<T> = {
    results?: T[]
    success: boolean
    meta?: Record<string, unknown>
}

type D1Response<T> = {
    result: D1QueryResult<T>[]
    success: boolean
    errors: { code: number; message: string }[]
    messages: unknown[]
}

let cachedConfig: {
    url: string
    token: string
} | null = null

function getConfig() {
    if (cachedConfig) return cachedConfig
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID
    const token = process.env.CLOUDFLARE_API_TOKEN
    if (!accountId || !databaseId || !token) {
        throw new Error(
            "Missing D1 env. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN in .env.local."
        )
    }
    cachedConfig = {
        url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
        token,
    }
    return cachedConfig
}

async function d1<T = D1Row>(
    sql: string,
    params: unknown[] = []
): Promise<T[]> {
    const { url, token } = getConfig()
    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
        cache: "no-store",
    })
    if (!res.ok) {
        throw new Error(`D1 HTTP ${res.status}: ${await res.text()}`)
    }
    const json = (await res.json()) as D1Response<T>
    if (!json.success) {
        throw new Error(
            `D1 error: ${json.errors.map((e) => e.message).join("; ")}`
        )
    }
    return json.result[0]?.results ?? []
}

// Batch multiple statements in a single round trip (atomic per D1 docs).
async function d1Batch(
    statements: { sql: string; params?: unknown[] }[]
): Promise<void> {
    const { url, token } = getConfig()
    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(statements),
        cache: "no-store",
    })
    if (!res.ok) {
        throw new Error(`D1 HTTP ${res.status}: ${await res.text()}`)
    }
    const json = (await res.json()) as D1Response<D1Row>
    if (!json.success) {
        throw new Error(
            `D1 error: ${json.errors.map((e) => e.message).join("; ")}`
        )
    }
}

function nowIso() {
    return new Date().toISOString()
}

// ---- notes -------------------------------------------------------------

const notes: NotesRepo = {
    async list(opts: NotesListOptions = {}) {
        const where: string[] = []
        const params: unknown[] = []
        if (!opts.includeDeleted) where.push("deleted_at IS NULL")
        if (opts.query) {
            where.push("(title LIKE ? OR content LIKE ?)")
            const like = `%${opts.query}%`
            params.push(like, like)
        }
        const clause = where.length ? `WHERE ${where.join(" AND ")}` : ""
        const rows = await d1<Note>(
            `SELECT * FROM notes ${clause} ORDER BY updated_at DESC`,
            params
        )
        const ids = rows.map((n) => n.id)
        const tagsByNote = await tagsForNotes(ids)
        const withTags: NoteWithTags[] = rows.map((n) => ({
            ...n,
            tags: tagsByNote.get(n.id) ?? [],
        }))
        if (opts.tagIds?.length) {
            const required = new Set(opts.tagIds)
            return withTags.filter((n) => {
                const has = new Set(n.tags.map((t) => t.id))
                for (const id of required) if (!has.has(id)) return false
                return true
            })
        }
        return withTags
    },

    async get(id) {
        const rows = await d1<Note>(
            "SELECT * FROM notes WHERE id = ? LIMIT 1",
            [id]
        )
        if (!rows[0]) return null
        const tagsByNote = await tagsForNotes([id])
        return { ...rows[0], tags: tagsByNote.get(id) ?? [] }
    },

    async create(input: NewNote) {
        const ts = nowIso()
        const note: Note = {
            id: nanoid(),
            title: input.title,
            content: input.content,
            summary: input.summary ?? null,
            created_at: ts,
            updated_at: ts,
            deleted_at: null,
        }
        await d1(
            `INSERT INTO notes (id, title, content, summary, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, NULL)`,
            [note.id, note.title, note.content, note.summary, ts, ts]
        )
        return note
    },

    async update(id, patch) {
        const sets: string[] = []
        const params: unknown[] = []
        if (patch.title !== undefined) {
            sets.push("title = ?")
            params.push(patch.title)
        }
        if (patch.content !== undefined) {
            sets.push("content = ?")
            params.push(patch.content)
        }
        if (patch.summary !== undefined) {
            sets.push("summary = ?")
            params.push(patch.summary)
        }
        sets.push("updated_at = ?")
        const updatedAt = nowIso()
        params.push(updatedAt)
        params.push(id)
        await d1(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`, params)
        const fresh = await d1<Note>(
            "SELECT * FROM notes WHERE id = ? LIMIT 1",
            [id]
        )
        if (!fresh[0]) throw new Error(`Note ${id} not found`)
        return fresh[0]
    },

    async softDelete(id) {
        await d1("UPDATE notes SET deleted_at = ? WHERE id = ?", [nowIso(), id])
    },

    async hardDelete(id) {
        // FK ON DELETE CASCADE handles note_tags / note_links / note_embeddings.
        await d1("DELETE FROM notes WHERE id = ?", [id])
    },
}

// ---- tags --------------------------------------------------------------

async function tagsForNotes(noteIds: string[]): Promise<Map<string, Tag[]>> {
    if (noteIds.length === 0) return new Map()
    const placeholders = noteIds.map(() => "?").join(",")
    const rows = await d1<{ note_id: string } & Tag>(
        `SELECT nt.note_id, t.id, t.name
         FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
         WHERE nt.note_id IN (${placeholders})`,
        noteIds
    )
    const map = new Map<string, Tag[]>()
    for (const row of rows) {
        const list = map.get(row.note_id) ?? []
        list.push({ id: row.id, name: row.name })
        map.set(row.note_id, list)
    }
    return map
}

const tags: TagsRepo = {
    async list() {
        return d1<Tag>("SELECT id, name FROM tags ORDER BY name COLLATE NOCASE")
    },

    async upsertByName(name) {
        const normalized = name.trim()
        if (!normalized) throw new Error("Tag name required")
        const existing = await d1<Tag>(
            "SELECT id, name FROM tags WHERE name = ? LIMIT 1",
            [normalized]
        )
        if (existing[0]) return existing[0]
        const tag: Tag = { id: nanoid(), name: normalized }
        await d1("INSERT INTO tags (id, name) VALUES (?, ?)", [
            tag.id,
            tag.name,
        ])
        return tag
    },

    async setForNote(noteId, tagIds) {
        const batch: { sql: string; params?: unknown[] }[] = [
            {
                sql: "DELETE FROM note_tags WHERE note_id = ?",
                params: [noteId],
            },
            ...tagIds.map((tagId) => ({
                sql: "INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)",
                params: [noteId, tagId],
            })),
        ]
        await d1Batch(batch)
    },

    async forNote(noteId) {
        return d1<Tag>(
            `SELECT t.id, t.name FROM note_tags nt
             JOIN tags t ON t.id = nt.tag_id
             WHERE nt.note_id = ?
             ORDER BY t.name COLLATE NOCASE`,
            [noteId]
        )
    },

    async remove(id) {
        await d1("DELETE FROM tags WHERE id = ?", [id])
    },
}

// ---- conversations -----------------------------------------------------

const conversations: ConversationsRepo = {
    async list() {
        return d1<Conversation>(
            "SELECT * FROM conversations ORDER BY created_at DESC"
        )
    },

    async get(id) {
        const rows = await d1<Conversation>(
            "SELECT * FROM conversations WHERE id = ? LIMIT 1",
            [id]
        )
        return rows[0] ?? null
    },

    async create(title) {
        const convo: Conversation = {
            id: nanoid(),
            title: title ?? null,
            created_at: nowIso(),
        }
        await d1(
            "INSERT INTO conversations (id, title, created_at) VALUES (?, ?, ?)",
            [convo.id, convo.title, convo.created_at]
        )
        return convo
    },

    async rename(id, title) {
        await d1("UPDATE conversations SET title = ? WHERE id = ?", [title, id])
        const fresh = await this.get(id)
        if (!fresh) throw new Error(`Conversation ${id} not found`)
        return fresh
    },

    async remove(id) {
        // FK CASCADE drops messages.
        await d1("DELETE FROM conversations WHERE id = ?", [id])
    },
}

// ---- messages ----------------------------------------------------------

const messages: MessagesRepo = {
    async listForConversation(conversationId) {
        return d1<Message>(
            `SELECT * FROM messages WHERE conversation_id = ?
             ORDER BY created_at ASC`,
            [conversationId]
        )
    },

    async append(conversationId, role, content) {
        const msg: Message = {
            id: nanoid(),
            conversation_id: conversationId,
            role,
            content,
            created_at: nowIso(),
        }
        await d1(
            `INSERT INTO messages (id, conversation_id, role, content, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [msg.id, msg.conversation_id, msg.role, msg.content, msg.created_at]
        )
        return msg
    },
}

// ---- embeddings --------------------------------------------------------

const embeddings: EmbeddingsRepo = {
    async upsert(noteId, embedding) {
        const serialized = JSON.stringify(embedding)
        await d1(
            `INSERT INTO note_embeddings (note_id, embedding, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(note_id) DO UPDATE SET
                 embedding = excluded.embedding,
                 updated_at = excluded.updated_at`,
            [noteId, serialized, nowIso()]
        )
    },

    async get(noteId) {
        const rows = await d1<NoteEmbedding>(
            "SELECT * FROM note_embeddings WHERE note_id = ? LIMIT 1",
            [noteId]
        )
        return rows[0] ?? null
    },

    async all() {
        const rows = await d1<{
            note_id: string
            embedding: string
            updated_at: string
        }>(
            `SELECT ne.note_id, ne.embedding, ne.updated_at
             FROM note_embeddings ne
             JOIN notes n ON n.id = ne.note_id
             WHERE n.deleted_at IS NULL`
        )
        return rows.map<StoredEmbedding>((r) => ({
            note_id: r.note_id,
            embedding: JSON.parse(r.embedding) as number[],
            updated_at: r.updated_at,
        }))
    },

    async remove(noteId) {
        await d1("DELETE FROM note_embeddings WHERE note_id = ?", [noteId])
    },
}

// ---- links -------------------------------------------------------------

const links: LinksRepo = {
    async forNote(noteId) {
        return d1<NoteLinkWithTarget>(
            `SELECT nl.source_note_id, nl.target_note_id, nl.relationship,
                    n.title AS target_title
             FROM note_links nl
             JOIN notes n ON n.id = nl.target_note_id
             WHERE nl.source_note_id = ?
               AND n.deleted_at IS NULL
             ORDER BY n.updated_at DESC`,
            [noteId]
        )
    },

    async add(sourceNoteId, targetNoteId, relationship = null) {
        if (sourceNoteId === targetNoteId) {
            throw new Error("Cannot link a note to itself")
        }
        await d1(
            `INSERT INTO note_links (source_note_id, target_note_id, relationship)
             VALUES (?, ?, ?)
             ON CONFLICT(source_note_id, target_note_id) DO UPDATE SET
                 relationship = excluded.relationship`,
            [sourceNoteId, targetNoteId, relationship]
        )
    },

    async remove(sourceNoteId, targetNoteId) {
        await d1(
            "DELETE FROM note_links WHERE source_note_id = ? AND target_note_id = ?",
            [sourceNoteId, targetNoteId]
        )
    },
}

// ---- files -------------------------------------------------------------

const files: FilesRepo = {
    async listForNote(noteId) {
        return d1<FileRecord>(
            `SELECT * FROM files
             WHERE note_id = ?
             ORDER BY created_at DESC`,
            [noteId]
        )
    },

    async get(id) {
        const rows = await d1<FileRecord>(
            "SELECT * FROM files WHERE id = ? LIMIT 1",
            [id]
        )
        return rows[0] ?? null
    },

    async create(input) {
        const record: FileRecord = {
            id: nanoid(),
            note_id: input.noteId,
            filename: input.filename,
            mime_type: input.mimeType,
            r2_key: input.r2Key,
            created_at: nowIso(),
        }
        await d1(
            `INSERT INTO files (id, note_id, filename, mime_type, r2_key, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                record.id,
                record.note_id,
                record.filename,
                record.mime_type,
                record.r2_key,
                record.created_at,
            ]
        )
        return record
    },

    async remove(id) {
        await d1("DELETE FROM files WHERE id = ?", [id])
    },
}

export const d1Repo: Repo = {
    notes,
    tags,
    conversations,
    messages,
    embeddings,
    links,
    files,
}

// Exposed for the search layer so it can run raw FTS5 queries.
export { d1 as d1Query }
