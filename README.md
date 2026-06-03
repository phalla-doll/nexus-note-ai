# NexusNote AI

## Personal AI Knowledge Platform

### Mission

NexusNote AI is a personal AI-powered second brain designed for developers, creators, and lifelong learners.

Unlike traditional note-taking applications, NexusNote focuses on:

* Knowledge retention
* Knowledge discovery
* AI-assisted thinking
* Visual knowledge mapping
* Long-term project memory

The system should become an extension of the user's memory and reasoning process.

---

# Technology Stack

## Frontend

### Framework

* Next.js 16+
* React 19+
* TypeScript

### UI

* TailwindCSS 4
* Shadcn/UI
* Lucide Icons

### State Management

* Zustand

### Forms

* React Hook Form
* Zod

### Data Fetching

* TanStack Query

---

# Editor

## Rich Text

Primary choice:

* Tiptap

Features:

* Markdown support
* Slash commands
* Tables
* Code blocks
* Mermaid diagrams
* Images
* File embeds
* Backlinks

---

# Infinite Canvas

## TLDraw

Canvas capabilities:

* Infinite workspace
* Visual note mapping
* Diagram creation
* Knowledge graph visualization
* Whiteboarding

Users can:

* Drag notes onto canvas
* Connect concepts
* Organize project ideas
* Create mind maps

---

# Infrastructure

## Cloudflare

### Cloudflare D1

Stores:

* Notes
* Projects
* Tags
* Relationships
* Conversations
* Embeddings metadata
* User settings

### Cloudflare R2

Stores:

* Images
* PDFs
* Screenshots
* Videos
* Audio files
* Canvas exports

### Cloudflare Workers

Future usage:

* AI processing jobs
* OCR jobs
* Embedding generation
* Background tasks

---

# AI Layer

## Provider

NVIDIA Build API

Endpoint:

```text
https://integrate.api.nvidia.com/v1
```

OpenAI-compatible architecture.

---

## Supported Models

### Primary Chat Model

```text
meta/llama-3.3-70b-instruct
```

Used for:

* Chat
* Summaries
* Q&A
* Reasoning

---

### Coding Assistant

```text
openai/gpt-oss-120b
```

Used for:

* Code explanations
* Architecture analysis
* Refactoring suggestions

---

# Architecture

```text
User
 │
 ▼
Next.js App
 │
 ├── Notes
 ├── Search
 ├── Graph
 ├── Canvas
 ├── Projects
 └── AI Chat
 │
 ▼
AI Gateway
 │
 ├── Chat
 ├── Embeddings
 ├── Summaries
 ├── Auto Linking
 └── Knowledge Graph
 │
 ▼
NVIDIA Build API
 │
 ▼
Cloudflare D1
 │
 ▼
Cloudflare R2
```

---

# Core Features

---

## Feature 1 — Notes

### Create Notes

Supported:

* Markdown
* Rich text
* Code snippets
* Images
* Attachments

Example:

```markdown
# Angular Signals

Signals are Angular's reactive primitive.

## Related

[[RxJS]]
[[Change Detection]]
[[Performance]]
```

---

## Feature 2 — AI Chat With Notes

Ask:

```text
What do I know about Angular Signals?
```

```text
Show all notes related to Cloudflare.
```

```text
Summarize everything I learned this month.
```

Process:

1. User submits question
2. Search relevant notes
3. Build AI context
4. Query NVIDIA model
5. Return answer with citations

---

## Feature 3 — Semantic Search

Traditional search:

```text
signals
```

Semantic search:

```text
Angular reactive state management
```

Should still find:

```text
Angular Signals
```

---

## Feature 4 — Hybrid Search

Search architecture:

```text
Query
 │
 ├── Full Text Search
 ├── Semantic Search
 │
 ▼
Result Fusion
 │
 ▼
Ranked Results
```

Benefits:

* Accurate keyword matching
* Natural language discovery

---

## Feature 5 — Backlinks

Automatic note relationships.

Example:

```markdown
Cloudflare D1 uses SQLite.
```

System creates:

```text
Cloudflare D1
    ↔ SQLite

Cloudflare D1
    ↔ Database
```

---

## Feature 6 — AI Auto Linking

When note is saved:

AI extracts:

* Technologies
* Concepts
* Projects
* People
* Relationships

Generated automatically:

```json
[
  {
    "target": "SQLite",
    "relationship": "uses"
  },
  {
    "target": "Cloudflare",
    "relationship": "provider"
  }
]
```

---

## Feature 7 — Knowledge Graph

Visual representation of knowledge.

Example:

```text
Angular
    │
    ├── Signals
    │
    ├── RxJS
    │
    └── Performance
```

Capabilities:

* Zoom
* Pan
* Filter
* Clustering
* Search

---

## Feature 8 — Infinite Canvas

Canvas supports:

* Notes
* PDFs
* Images
* Diagrams
* AI summaries

Example use cases:

* Architecture design
* Research
* Brainstorming
* Learning maps

---

## Feature 9 — Project Memory

Every project contains:

```text
Requirements
Architecture
Tasks
Notes
Files
Conversations
Decisions
```

Questions:

```text
Why did I choose D1?
```

```text
What architecture decisions were made?
```

AI answers using historical project context.

---

## Feature 10 — Daily Journal

Automatic notes:

```text
2026-06-03
```

Contains:

* Thoughts
* Tasks
* Progress
* Ideas

AI can generate:

* Daily summary
* Weekly review
* Monthly review

---

## Feature 11 — PDF Knowledge Extraction

Upload:

* PDF
* Documentation
* Research papers

AI generates:

```markdown
Summary
Key Concepts
Important Quotes
Action Items
```

---

## Feature 12 — Screenshot Knowledge Extraction

Upload screenshots.

AI extracts:

* Text
* UI structure
* Insights

Stores searchable content.

---

# Database Schema

---

## notes

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

---

## tags

```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
```

---

## note_tags

```sql
CREATE TABLE note_tags (
  note_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (note_id, tag_id)
);
```

---

## note_links

```sql
CREATE TABLE note_links (
  source_note_id TEXT NOT NULL,
  target_note_id TEXT NOT NULL,
  relationship TEXT,
  PRIMARY KEY (
    source_note_id,
    target_note_id
  )
);
```

---

## note_embeddings

```sql
CREATE TABLE note_embeddings (
  note_id TEXT PRIMARY KEY,
  embedding TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## projects

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);
```

---

## files

```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  note_id TEXT,
  filename TEXT,
  mime_type TEXT,
  r2_key TEXT,
  created_at TEXT NOT NULL
);
```

---

## conversations

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT NOT NULL
);
```

---

## messages

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

---

## canvas_documents

```sql
CREATE TABLE canvas_documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

---

## canvas_nodes

```sql
CREATE TABLE canvas_nodes (
  id TEXT PRIMARY KEY,
  canvas_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  position_x REAL,
  position_y REAL,
  data TEXT
);
```

---

## canvas_edges

```sql
CREATE TABLE canvas_edges (
  id TEXT PRIMARY KEY,
  canvas_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL
);
```

---

## ai_jobs

```sql
CREATE TABLE ai_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT,
  result TEXT,
  created_at TEXT NOT NULL
);
```

---

# Folder Structure

```text
src/
│
├── app
│   ├── notes
│   ├── projects
│   ├── graph
│   ├── canvas
│   ├── search
│   ├── chat
│   ├── settings
│   └── api
│
├── components
│   ├── editor
│   ├── graph
│   ├── canvas
│   ├── notes
│   ├── chat
│   └── ui
│
├── lib
│   ├── ai
│   │   ├── providers
│   │   ├── embeddings
│   │   ├── retrieval
│   │   └── prompts
│   │
│   ├── db
│   ├── search
│   ├── graph
│   ├── canvas
│   ├── storage
│   └── utils
│
├── hooks
├── types
├── providers
└── stores
```

---

# MVP Roadmap

## Phase 1

* Authentication
* Notes CRUD
* Markdown editor
* Tags
* File uploads
* Search

---

## Phase 2

* NVIDIA integration
* AI chat
* Note summaries
* Semantic search

---

## Phase 3

* Backlinks
* Knowledge graph
* Auto-linking

---

## Phase 4

* TLDraw canvas
* Visual note mapping
* Research boards

---

## Phase 5

* Project memory
* PDF ingestion
* OCR
* Daily journal AI

---

# Long-Term Vision

The platform should answer questions such as:

```text
What have I learned about Angular Signals?
```

```text
What projects used Cloudflare D1?
```

```text
Why did I choose a specific architecture six months ago?
```

```text
Summarize everything I learned about AI agents.
```

The final product is not a note-taking application.

It is a personal AI memory system that continuously learns from the user's notes, projects, files, and decisions.
