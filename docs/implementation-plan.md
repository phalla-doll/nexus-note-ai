# NexusNote AI — Implementation Plan

## Project state

Phase 1 plan steps 1–6 are shipped (2026-06-03). Step 7 (file uploads) is deferred until R2 / D1 are wired. The app boots into an `/notes` shell with Tiptap markdown editing, tags, full-text search, and a ⌘K palette — all backed by an in-browser IndexedDB driver behind a swappable `Repo` interface.

## Decisions locked in

1. **Storage = Cloudflare D1 production** via REST. `lib/db/d1-driver.ts` is server-only; client components reach data through server actions under `app/actions/`. IDB was removed — there is no local fallback.
2. **Editor stores Markdown** via `tiptap-markdown`. `Note.content` is plain markdown — keeps embeddings, semantic search, and AI prompts portable.
3. **No auth in Phase 1.** Single-user; passcode vs Cloudflare Access deferred until deploy lands.
4. **Deploy target deferred.** Local browser only; Cloudflare Pages vs Vercel decided when D1/R2 are wired.

## What's shipped (Phase 1)

- **App shell** at `app/(app)/layout.tsx` with sidebar nav (`components/app/app-sidebar.tsx`) for Notes / Search / Chat / Graph / Canvas / Projects / Settings. `/` redirects to `/notes`.
- **Data layer** — schema mirror in `types/db.ts`; `Repo` interface (`lib/db/repo.ts`); IndexedDB driver (`lib/db/idb-driver.ts`) covering notes, tags, note_tags with soft/hard delete and tag filtering.
- **Notes CRUD** — `/notes` list (filter input, tag-chip filter, empty state, debounced 500ms autosave). `/notes/[id]` editor with title, tag picker, markdown editor, soft-delete confirm.
- **Tiptap markdown editor** at `components/editor/editor.tsx` with sticky toolbar (bold/italic/strike, H1/H2, bullet/numbered/task lists, quote, code block, link). `@tailwindcss/typography` registered via `@plugin` in `app/globals.css`.
- **Tags** — `TagPicker` (Command + Popover combobox with create-on-the-fly) and `TagFilter` chip strip on the list.
- **Full-text search** — `lib/search/fulltext.ts` (MiniSearch, 5s cache invalidation). `/search` page with debounced input + snippets. Global ⌘K palette (`components/app/command-palette.tsx`) for note search, quick "new note", and navigation.

## Deferred from Phase 1

- **Step 7 — file uploads**: parked until R2 is wired so keys make sense.
- **Backlinks / slash commands** in the editor: Phase 3.
- **D1 swap**: Phase 1b. Add `lib/db/d1-driver.ts`, swap the export in `lib/db/index.ts`. _Prod DB is now provisioned — see below._
- **Auth**: revisit with deploy target.

## Infrastructure (locked in 2026-06-03)

- **Deploy target: Cloudflare.**
- **Account:** Mantha account (`e63e1c513f59ba1e5c5a83d2931cf61b`).
- **D1 prod database:** `nexus-note-ai-prod` (id `f5ffd20e-3946-41f1-8702-ca3fc1381a6a`, region APAC).
- **Config:** `wrangler.jsonc` at repo root, binding `DB`, `migrations_dir: "migrations"`.
- **Schema applied:** `migrations/0001_init.sql` — all README tables, FK constraints, useful indexes, and an FTS5 virtual table `notes_fts` with INSERT/UPDATE/DELETE triggers.

Operational notes:
- Always export `CLOUDFLARE_ACCOUNT_ID=e63e1c513f59ba1e5c5a83d2931cf61b` before `wrangler d1 …` (the logged-in account has multiple workspaces).
- The Next.js runtime choice (`@opennextjs/cloudflare` vs `@cloudflare/next-on-pages`) is still open — pick when wiring `lib/db/d1-driver.ts`.

## Phase 2 — AI integration (in progress)

Shipped:
- `lib/ai/providers/nvidia.ts` — OpenAI-compatible client pointed at NVIDIA Build. `NVIDIA_MODELS.chat` = `meta/llama-3.3-70b-instruct`, `coding` = `openai/gpt-oss-120b`. Server-only.
- `lib/ai/prompts/chat.ts` — system prompt scaffold.
- `app/api/chat/route.ts` — POST streaming text endpoint. Reasoning tokens are wrapped in `<think>…</think>` so the client can fold them into a collapsible section.
- IDB `conversationsRepo` + `messagesRepo` (DB version bumped to 2 with a forward-compatible migration).
- `/chat` page with conversation list, streaming thread, abortable send, and per-conversation persistence.
- `.env.example` documents `NVIDIA_API_KEY`. `.gitignore` exception added so the example is tracked.

Phase 2 retrieval / RAG stack (shipped):
- `lib/ai/embeddings/` — NVIDIA `nvidia/nv-embedqa-e5-v5` via `embedPassage` / `embedQuery`. Stored as JSON in `note_embeddings.embedding`.
- `lib/search/hybrid.ts` — FTS5 + cosine-similarity fused with Reciprocal Rank Fusion. In-memory; swap to Cloudflare Vectorize when notes grow past ~10k.
- `lib/ai/retrieval/notes.ts` — `retrieveNotesForQuery` clamps notes to 1200 chars and formats a context block.
- `lib/ai/tools/notes.ts` — `search_notes` tool definition for OpenAI-compatible function calling.
- `app/api/chat/route.ts` — always-inject top-5 PLUS exposes `search_notes` (max 2 tool hops). Emits framing tags: `<context>{json}</context>` for citations, `<think>…</think>` for reasoning. Strips framing from stored assistant turns before replay.
- `components/chat/chat-view.tsx` — parses framing; renders source chips linked back to notes.
- `app/actions/note-jobs.ts` — `refreshNoteSideEffects` embeds + summarizes via `Promise.allSettled` on a 5s post-autosave debounce in the editor.
- `lib/ai/summary/` + `lib/ai/prompts/summary.ts` — single-sentence summaries land in `Note.summary`.

Next slices (shipped):
- **Coding mode toggle** — `ModeToggle` in the chat composer (`components/chat/chat-view.tsx`). Switches `mode: "chat" | "coding"` in the request body; route already uses `NVIDIA_MODELS.coding` (`openai/gpt-oss-120b`) and skips retrieval in coding mode.
- **Note summaries surfaced** — `components/notes/notes-list.tsx` prefers `note.summary` over the raw content preview, with a subtle `SparklesIcon` hint.
- **Auto-link notes** — `lib/ai/retrieval/links.ts#suggestLinksForNote` cosine-sims against the source's embedding (`MIN_SCORE = 0.45`). `components/notes/note-links.tsx` shows existing links as removable chips + suggestions as dashed-outline "add" buttons. Refreshes after the 5s side-effects pass.
- **Embedding backfill** — `app/actions/backfill.ts#backfillNoteAi` finds notes missing embedding or summary and runs `refreshNoteSideEffects` serially. Surfaced in `/settings` via `components/settings/ai-backfill.tsx`.

Still deferred:
- **Vectorize migration** — when notes pass ~10k. Driver swap behind `EmbeddingsRepo`.
- **Backlinks / `[[wiki-link]]`** in the editor — Phase 3.

## Graph view (shipped 2026-06-03)

- `lib/graph/data.ts#getGraphData()` returns `{ nodes, edges }`. Nodes carry `tag_count + link_count` (drives node size). Edges are typed `"link"` (from `note_links`, drawn solid) or `"similarity"` (top-K=3 per node cosine ≥0.55, undirected-deduped, drawn dashed).
- `app/actions/graph.ts#loadGraph` exposes the data.
- `components/graph/graph-view.tsx` — Cytoscape + `cose-bilkent` layout. Toolbar with similarity toggle and refresh. Tap node → navigate to that note. Hover → neighborhood highlight.
- Ambient type declaration for `cytoscape-cose-bilkent` at `types/cytoscape-cose-bilkent.d.ts`.
- Performance: O(N²) similarity loop — fine up to ~1k notes, breaks at scale. Migration path = Vectorize + precomputed nearest-neighbor table.

## R2 file uploads (shipped 2026-06-03)

- Bucket: `nexus-note-ai-files` in the Mantha account.
- `wrangler.jsonc` declares the `FILES` binding (for future Worker code).
- `lib/storage/r2.ts` — `@aws-sdk/client-s3` against `https://${accountId}.r2.cloudflarestorage.com`. Helpers: `putObject`, `getPresignedGetUrl`, `deleteObject`, `buildR2Key`.
- `FilesRepo` on the Repo interface; D1 driver writes/reads the `files` table.
- Routes: `POST /api/files` (multipart, ≤25 MB), `GET /api/files/[id]` (302 → 5-min presigned R2 URL).
- Server actions: `app/actions/files.ts` — list + delete (drops the R2 object too).
- UI: `components/notes/note-attachments.tsx` — drag-drop + click-to-upload + per-file "Insert" → appends markdown reference. Images use `![…]`, others use `[…]`. Mounted below the markdown editor in `note-editor.tsx`.
- Env: `R2_BUCKET_NAME` (default `nexus-note-ai-files`), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Documented in `.env.example`.

**Operational requirement before first use:** user creates an S3-style R2 API token in the dashboard (R2 → Manage R2 API Tokens → Create) with Object Read & Write on the bucket. The OAuth wrangler login doesn't have R2 scope, so the bucket itself was created via dashboard (or via `wrangler login` re-auth with R2 scope).

## Original step-by-step plan (reference)

Phase 1 in this order. Each step ships a usable slice.

### 1. App shell & routing skeleton

- `app/(app)/layout.tsx` with `components/ui/sidebar.tsx` (already installed) hosting nav: Notes, Search, Chat, Graph, Canvas, Projects, Settings.
- Route stubs: `app/(app)/notes/page.tsx`, `notes/[id]/page.tsx`, `search`, `chat`, `projects`, `settings`.
- Replace `app/page.tsx` with a redirect to `/notes`.
- Hugeicons for nav (NOT lucide).

### 2. Data layer — local-first first, D1 later

- Define schema types in `types/db.ts` mirroring README SQL (notes, tags, note_tags, note_links, files, projects, conversations, messages, ai_jobs, canvas_*).
- Build `lib/db/` with a thin repository interface (`notesRepo`, `tagsRepo`, …) so we can swap the driver.
- Phase 1a driver: in-browser persistence (IndexedDB via `idb` or a JSON file on the Node side). Phase 1b: Cloudflare D1 via `@cloudflare/next-on-pages` or a Workers-bound `Env`. Decision needed: are we deploying to Cloudflare Pages from the start, or Vercel for dev and CF later? That changes how `lib/db` is wired.
- IDs: `nanoid` or `crypto.randomUUID()`. Timestamps: ISO strings (matches README schema).

### 3. Notes CRUD (no editor yet)

- Server Actions in `app/(app)/notes/actions.ts` for create/update/delete/list/get.
- List page: `components/notes/notes-list.tsx` using `Table` or a simple card list, plus a `Command`-driven quick-create.
- Detail page: title input + plain `<Textarea>` for content as a placeholder until Tiptap lands.
- React Hook Form + Zod for the create/edit form (already installed).

### 4. Tiptap editor

- `pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-task-list @tiptap/extension-placeholder` + markdown serializer.
- `components/editor/editor.tsx` — controlled, content stored as HTML or Markdown (recommend Markdown for portability with embeddings later).
- Slash command + `[[backlink]]` extension can come in Phase 3; just leave a hook for it.

### 5. Tags

- Tag combobox using `components/ui/command.tsx` on the note detail page; create-on-the-fly.
- Tag filter chips on the notes list.

### 6. Search (Phase 1 = full-text only)

- `lib/search/fulltext.ts`: SQLite FTS5 virtual table when on D1; in-memory `MiniSearch` for the local driver.
- Global cmd-K palette using `Command` primitive, results link into `/notes/[id]`.
- Leave room for `lib/search/hybrid.ts` (FTS + semantic fusion) in Phase 2.

### 7. File uploads (stub)

- Local: write to `/tmp` or skip until R2 binding is set up. Recommend deferring to Phase 1.5 once D1 is wired so R2 keys make sense.

### Cross-cutting

- State: Zustand stores under `stores/` only for genuinely client-shared state (sidebar collapse, editor draft). Server data through Server Actions + revalidation — don't add TanStack Query unless we hit a real need (the README lists it; defer).
- Auth: README mentions it but it's a single-user "second brain." Skip real auth in Phase 1 and add a single-user passcode or Cloudflare Access later. Worth confirming.
- Read `node_modules/next/dist/docs/` before writing any route handler, server action, or caching code — Next 16 has shifted defaults.

## Open decisions before coding

1. **Deploy target now**: Cloudflare Pages from day one (wire D1 immediately), or Vercel + local SQLite first, swap later?
2. **Auth in Phase 1**: skip / single-user passcode / Cloudflare Access?
3. **Editor content format**: Markdown (better for embeddings/portability) or Tiptap JSON (richer fidelity)?
4. **Storage for Phase 1 if not on CF yet**: IndexedDB (client-only, no server actions hitting a DB) or local SQLite via `better-sqlite3` (server-side, mirrors D1 SQL)?
