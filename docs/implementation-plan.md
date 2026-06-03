# NexusNote AI — Implementation Plan

## Project state

Fresh scaffold: Next.js 16 / React 19, shadcn primitives all installed (43 components), `app/page.tsx` is the default starter, and `lib/` only has `utils.ts`. No DB wiring, no editor, no AI, no auth — everything from the README is greenfield. Phase 1 (notes CRUD, editor, tags, search) is the immediate scope per `CLAUDE.md`.

## Recommended implementation plan

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
