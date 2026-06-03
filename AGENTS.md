# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Commands

- `pnpm dev` — start Next.js dev server
- `pnpm build` — production build
- `pnpm start` — run production build
- `pnpm lint` — ESLint (flat config in `eslint.config.mjs`, extends `eslint-config-next`)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm format` — Prettier write across `**/*.{ts,tsx}`

Package manager is **pnpm** (see `pnpm-workspace.yaml`, `pnpm-lock.yaml`). Do not use npm/yarn.

## Next.js version warning

This project uses **Next.js 16** with React 19. This is NOT the Next.js you know — APIs, conventions, and file structure may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. Heed deprecation notices.

Treat anything you "remember" about Next.js routing, server components, caching, config, or APIs as suspect — verify against the local docs in `node_modules/next/dist/docs/` first.

## Project layout

The README's `src/` tree is the **intended target structure** for the build-out, not the current state. Today the repo follows Next.js's root-level layout:

- `app/` — App Router (currently just `layout.tsx`, `page.tsx`, `globals.css`)
- `components/ui/` — shadcn/ui primitives (generated, do not hand-edit lightly)
- `components/` — app-level components (e.g. `theme-provider.tsx`)
- `lib/` — shared utilities (`lib/utils.ts` exports `cn`)
- `hooks/` — React hooks
- Path alias `@/*` → repo root (see `tsconfig.json`)

When adding features described in the README (notes, chat, graph, canvas, search, projects, AI providers, db), follow the directory map in README.md §"Folder Structure" — but place them under the root, not under `src/`, to match the existing convention.

## UI stack

- **shadcn/ui** configured via `components.json`: style `radix-nova`, base color `olive`, icon library **hugeicons** (`@hugeicons/react` + `@hugeicons/core-free-icons`), RSC enabled. Use `pnpm dlx shadcn@latest add <component>` rather than copy-pasting.
- **Prefer shadcn primitives** in `components/ui/` for any UI need before reaching for a custom component or another library. If a suitable primitive isn't installed yet, add it via the shadcn CLI rather than building from scratch.
- **Do not modify the classes or internals of files under `components/ui/`** unless the user explicitly asks for it. These are generated primitives; customize via props, `className` overrides on the consumer, or theme tokens in `app/globals.css` instead.
- **Tailwind v4** (PostCSS plugin, no `tailwind.config.*` — config lives in `app/globals.css` via `@theme`).
- Prefer `cn()` from `@/lib/utils` for class merging. Prettier is configured with `tailwindFunctions: ["cn", "cva"]` so classes inside those get sorted.
- Icons: hugeicons, not lucide (despite what the README says).

## Formatting / style

`.prettierrc`: 4-space indent, no semicolons, double quotes, `printWidth: 80`, `trailingComma: "es5"`, LF line endings. Run `pnpm format` before committing — the most recent commit was a project-wide reformat to these rules.

## Architecture intent (forward-looking)

The product is a personal AI second-brain. The planned data/AI flow (see README for full detail):

- **Storage:** Cloudflare D1 (notes, tags, links, embeddings metadata, projects, conversations, canvas docs/nodes/edges, ai_jobs) + Cloudflare R2 (files).
- **AI provider:** NVIDIA Build API (`https://integrate.api.nvidia.com/v1`, OpenAI-compatible). Primary chat model `meta/llama-3.3-70b-instruct`; coding model `openai/gpt-oss-120b`. AI provider code belongs under `lib/ai/{providers,embeddings,retrieval,prompts}`.
- **Editor:** Tiptap (planned). **Canvas:** TLDraw (planned). Neither is installed yet.
- **Search:** hybrid full-text + semantic, fused before ranking.

None of the AI/db/editor/canvas layers exist in code yet — phase 1 (notes CRUD, editor, tags, search) is the current scope per the roadmap.
