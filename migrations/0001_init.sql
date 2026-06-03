-- 0001_init — initial schema matching README.md tables.
-- Adds FK enforcement (PRAGMA), useful secondary indexes, and a
-- contentless FTS5 index over notes for phase-1 full-text search.

PRAGMA defer_foreign_keys = TRUE;

-- ---------- notes ----------
CREATE TABLE notes (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    summary    TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE INDEX idx_notes_updated_at ON notes (updated_at DESC);
CREATE INDEX idx_notes_deleted_at ON notes (deleted_at);

-- ---------- tags ----------
CREATE TABLE tags (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- ---------- note_tags ----------
CREATE TABLE note_tags (
    note_id TEXT NOT NULL,
    tag_id  TEXT NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)  REFERENCES tags  (id) ON DELETE CASCADE
);

CREATE INDEX idx_note_tags_tag ON note_tags (tag_id);

-- ---------- note_links ----------
CREATE TABLE note_links (
    source_note_id TEXT NOT NULL,
    target_note_id TEXT NOT NULL,
    relationship   TEXT,
    PRIMARY KEY (source_note_id, target_note_id),
    FOREIGN KEY (source_note_id) REFERENCES notes (id) ON DELETE CASCADE,
    FOREIGN KEY (target_note_id) REFERENCES notes (id) ON DELETE CASCADE
);

CREATE INDEX idx_note_links_target ON note_links (target_note_id);

-- ---------- note_embeddings ----------
CREATE TABLE note_embeddings (
    note_id    TEXT PRIMARY KEY,
    embedding  TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
);

-- ---------- projects ----------
CREATE TABLE projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL
);

-- ---------- files ----------
CREATE TABLE files (
    id         TEXT PRIMARY KEY,
    note_id    TEXT,
    filename   TEXT,
    mime_type  TEXT,
    r2_key     TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE SET NULL
);

CREATE INDEX idx_files_note ON files (note_id);

-- ---------- conversations ----------
CREATE TABLE conversations (
    id         TEXT PRIMARY KEY,
    title      TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_conversations_created_at ON conversations (created_at DESC);

-- ---------- messages ----------
CREATE TABLE messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);

-- ---------- canvas_documents ----------
CREATE TABLE canvas_documents (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- ---------- canvas_nodes ----------
CREATE TABLE canvas_nodes (
    id         TEXT PRIMARY KEY,
    canvas_id  TEXT NOT NULL,
    node_type  TEXT NOT NULL,
    position_x REAL,
    position_y REAL,
    data       TEXT,
    FOREIGN KEY (canvas_id) REFERENCES canvas_documents (id) ON DELETE CASCADE
);

CREATE INDEX idx_canvas_nodes_canvas ON canvas_nodes (canvas_id);

-- ---------- canvas_edges ----------
CREATE TABLE canvas_edges (
    id        TEXT PRIMARY KEY,
    canvas_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    FOREIGN KEY (canvas_id) REFERENCES canvas_documents (id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES canvas_nodes     (id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES canvas_nodes     (id) ON DELETE CASCADE
);

CREATE INDEX idx_canvas_edges_canvas ON canvas_edges (canvas_id);

-- ---------- ai_jobs ----------
CREATE TABLE ai_jobs (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL,
    status     TEXT NOT NULL,
    payload    TEXT,
    result     TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_ai_jobs_status ON ai_jobs (status, created_at);

-- ---------- FTS5 over notes ----------
-- Contentless FTS index. Kept in sync via app-level upserts (or triggers,
-- once we have a final policy). content='notes' lets us reference the
-- backing table without duplicating storage.
CREATE VIRTUAL TABLE notes_fts USING fts5 (
    title,
    content,
    content='notes',
    content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER notes_fts_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts (rowid, title, content)
    VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER notes_fts_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts (notes_fts, rowid, title, content)
    VALUES ('delete', old.rowid, old.title, old.content);
END;

CREATE TRIGGER notes_fts_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts (notes_fts, rowid, title, content)
    VALUES ('delete', old.rowid, old.title, old.content);
    INSERT INTO notes_fts (rowid, title, content)
    VALUES (new.rowid, new.title, new.content);
END;
