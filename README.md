# continuum

Turborepo monorepo for the **Continuum** — a project-scoped orchestration server exposed primarily over MCP (Model Context Protocol), with an optional REST surface and a web panel.

The orchestrator tracks **projects**, their per-project **plot** (PLOT.md workflow protocol), **knowledge** base, and a **registry of agents** (draft → active → merged/abandoned), persisted in SQLite. AI clients drive it via MCP tools; humans browse it via the web panel.

## Stack

| App / package | Tech |
| --- | --- |
| [`apps/api`](apps/api) | NestJS 11, `@rekog/mcp-nest`, `better-sqlite3`, Zod, class-validator, Swagger |
| [`apps/web`](apps/web) | Astro 6, React 19 islands, Tailwind CSS 4, shadcn/ui, TanStack Table |
| [`packages/typescript-config`](packages/typescript-config) | Shared `tsconfig` bases (`@repo/typescript-config`) |
| Tooling | Turborepo 2, pnpm workspaces, Prettier 3 |

## Prerequisites

- Node `>=22.12.0`
- pnpm `>=10.33` (repo pins `pnpm@10.33.2`)

The `pnpm-workspace.yaml` whitelists native builds for `better-sqlite3`, `@nestjs/core`, `@swc/core`, `esbuild`, `msw`, `sharp`. Run `pnpm approve-builds` if pnpm prompts on first install.

## Quick start

```bash
pnpm install
pnpm dev
```

This boots both apps via Turborepo:

- API → <http://localhost:7776> (Swagger UI at `/docs`)
- Web → <http://localhost:7777>

In dev, the API stores SQLite at `./.local-data/orchestrator.db` (set by `apps/api`'s `mcp:dev` script and the default `pnpm dev` flow). Without `ORCHESTRATOR_DB_PATH` it falls back to `/data/orchestrator.db`, which is the production container path.

### Optional dev embedder

The wrapper dev compose file can run Hugging Face Text Embeddings Inference
(TEI) for `google/embeddinggemma-300m`:

```bash
HF_TOKEN=... docker compose -f /Users/h.amreji/Pers/continuum/docker-compose.dev.yml --profile embedder up embedder
```

`google/embeddinggemma-300m` is gated on Hugging Face. Accept the model license
there first, then pass `HF_TOKEN`. TEI is exposed to host/local API processes at
`http://127.0.0.1:8080/v1/embeddings`; from the compose API container use
`http://embedder:80/v1/embeddings`.

For TEI, set `EMBEDDER_MODEL=google/embeddinggemma-300m` and
`EMBEDDER_DIM=768`. For Ollama, the API default model remains `embeddinggemma`
and the endpoint style remains `/api/embed`. Panel settings stored in SQLite
override env vars, so clear or update stale settings when changing embedder
configuration. Regenerate knowledge vectors after changing model or dimension.

## Repo layout

```text
.
├── apps/
│   ├── api/                  NestJS server (MCP + optional REST + Swagger)
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── database/     better-sqlite3 service + migrations (schema v5)
│   │       ├── project/      project_* MCP tools + REST controller
│   │       ├── plot/         plot / plot_update tools + PLOT.md template
│   │       ├── knowledge/    knowledge_get / knowledge_update tools
│   │       ├── agent/        agent_* + registry_list tools
│   │       ├── migration/    project_migrate (bulk upsert) tool
│   │       ├── agent-statuses/
│   │       ├── common/       shared DTOs / guards
│   │       └── utils/
│   └── web/                  Astro panel
│       └── src/
│           ├── pages/        index, projects, agents, knowledge, plot
│           ├── layouts/      PanelLayout.astro
│           ├── components/
│           │   ├── panel/    page-scoped React islands
│           │   └── ui/       shadcn/ui primitives
│           ├── hooks/  lib/  styles/  types/
├── packages/
│   └── typescript-config/    base tsconfigs consumed as workspace:*
├── .local-data/              dev SQLite (gitignored)
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## API — `apps/api` (`@continuum/api`)

NestJS 11 app that bootstraps with:

- URI versioning enabled (e.g. `/v1/...`)
- Global `ValidationPipe` (`whitelist`, `transform`, throws `422` with `{ status, errors }`)
- 5 MB JSON / urlencoded body limit
- Swagger document at `/docs`
- CORS enabled when `CORS_ORIGIN` is set (`*` or comma-separated origins)
- Listens on `0.0.0.0:${PORT ?? 7776}`

### MCP transport

`McpModule.forRoot` registers transport `STREAMABLE_HTTP` (stateful — UUID session ids) with name `continuum` v0.1.0. Tools are declared with `@Tool()` decorators (`@rekog/mcp-nest`) and validated with Zod schemas.

### MCP tools

All tools are project-scoped; `project` is a canonical absolute path that doubles as the project key.

| Domain | Tool | Purpose |
| --- | --- | --- |
| Project | `project_list` | List projects in the registry |
| | `project_get` | Fetch one project |
| | `project_create` | Create project, seed PLOT.md + knowledge |
| | `project_rename` | Rename a project |
| | `project_delete` | Cascade-delete project + agents |
| Plot | `plot` | Read PLOT.md |
| | `plot_update` | Apply unified diff to PLOT.md |
| Knowledge | `knowledge_get` | Read knowledge (optionally a `## section`) |
| | `knowledge_update` | Apply unified diff to knowledge |
| Agent | `registry_list` | List all agents for a project |
| | `agent_get` | Fetch agent by slug |
| | `agent_create` | Create draft agent |
| | `agent_update` | Update / transition agent status |
| Migration | `project_migrate` | Bulk upsert project + plot + knowledge + agents |

Updates to plot and knowledge use **unified git-format diffs** (via the `diff` package), not full overwrites — patch-friendly and surfaces conflicts.

### REST surface (optional)

Each domain module exposes a `@Controller('api/orchestrator')` only when `PANEL_REST_ENABLED=true`. Disabled by default; the panel currently consumes the API through this gate.

### Persistence

`OrchestratorDbService` opens a `better-sqlite3` handle with:

- `journal_mode = WAL`
- `foreign_keys = ON`
- `busy_timeout = 5000`

Schema is migrated forward on boot (current version 6). Tables include `projects`, `plots` + `plot_history`, `knowledge` + `knowledge_history`, `agents`, `app_settings`. Soft-delete columns (`deleted_at`) are tracked where applicable. Destructive migrations are blocked unless `NODE_ENV !== 'production'` or `ORCHESTRATOR_ALLOW_DESTRUCTIVE_MIGRATE=1`.

### Agent state machine

Agents transition `draft → active → merged | abandoned`. `agent_update` enforces transitions and timestamps (`dispatched_at`, `merged_at`); `merged` requires a commit SHA (≥7 chars). `reserved_paths` (JSON) declare paths an agent owns inside its worktree to prevent collisions.

### Plot template

Every new project is seeded with a PLOT.md template (`apps/api/src/plot/default-template.ts`) describing the orchestration protocol: **Intake → Research → Verify → Implement**, with the implementation phase running in an isolated `git worktree` scoped by `reserved_paths`.

### Scripts (`apps/api`)

```bash
pnpm -F @continuum/api dev          # nest start --watch
pnpm -F @continuum/api mcp:dev      # dev with ORCHESTRATOR_DB_PATH=./.local-data/orchestrator.db
pnpm -F @continuum/api build        # nest build → dist/
pnpm -F @continuum/api start:prod   # node dist/main
pnpm -F @continuum/api test         # jest unit tests (*.spec.ts under src/)
pnpm -F @continuum/api test:e2e     # jest e2e (test/jest-e2e.json)
pnpm -F @continuum/api lint         # eslint --fix
pnpm -F @continuum/api check-types  # tsc --noEmit
```

### Environment variables

> Settings can also be configured via the panel at `/settings`. Panel values stored in `app_settings` (SQLite, **plaintext**) take precedence over env vars. Env remains supported for headless deploys.

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `7776` | HTTP port |
| `CORS_ORIGIN` | _unset_ (CORS off) | `*` or comma-separated origins |
| `ORCHESTRATOR_DB_PATH` | `/data/orchestrator.db` | SQLite file path; dev scripts override to `./.local-data/orchestrator.db` |
| `PANEL_REST_ENABLED` | `false` | Mount REST controllers under `/api/orchestrator` |
| `NODE_ENV` | _unset_ | Production guards destructive migrations |
| `ORCHESTRATOR_ALLOW_DESTRUCTIVE_MIGRATE` | _unset_ | Set to `1` to opt in to destructive migrations in production |
| `ANTHROPIC_API_KEY` | _unset_ | Required for `/api/orchestrator/{plot,knowledge}/token-count`. Server-side only. |
| `ANTHROPIC_TOKENIZER_MODEL` | `claude-opus-4-7` | Model passed to Anthropic `count_tokens`. |
| `EMBEDDER_URL` | _unset_ | Embedding endpoint. Supports Ollama `/api/embed` and OpenAI-compatible `/v1/embeddings` such as TEI. |
| `EMBEDDER_MODEL` | `embeddinggemma` | Model sent to the embedder. Use `google/embeddinggemma-300m` for TEI. |
| `EMBEDDER_DIM` | `768` | Expected embedding dimension used to detect stale vectors. |

## Web — `apps/web` (`@continuum/web`)

Astro 6 multi-page panel with React 19 islands. Tailwind v4 is wired through `@tailwindcss/vite`; UI uses shadcn/ui primitives (Radix + `tailwind-variants`-style components). `@/` aliases `apps/web/src/`.

Pages:

- `/` — landing
- `/projects` — projects list (TanStack Table island)
- `/agents` — agent registry / status board
- `/knowledge` — knowledge viewer (Markdown + GFM + highlight.js via rehype/remark)
- `/plot` — plot viewer/editor

Vite dev server runs on port `7777` with polling watch (works inside containers / mounted volumes).

### Scripts (`apps/web`)

```bash
pnpm -F @continuum/web dev          # astro dev
pnpm -F @continuum/web build        # astro build → dist/
pnpm -F @continuum/web preview      # astro preview
pnpm -F @continuum/web check-types  # astro check && tsc --noEmit
```

## Root scripts (Turborepo)

```bash
pnpm dev          # turbo run dev — both apps in watch
pnpm build        # turbo run build — outputs dist/** and .astro/**
pnpm lint         # turbo run lint
pnpm check-types  # turbo run check-types
pnpm format       # prettier --write across ts/tsx/js/astro/md/json
```

`turbo.json` caches `build`, `lint`, `check-types`; `dev` is `persistent` and uncached. Build inputs include `.env*` files, so changing env triggers rebuilds.

## Conventions

- Prettier: 100-col, double quotes, semicolons, ES5 trailing commas (`.prettierrc.json`).
- Shared TS bases live in `@repo/typescript-config`; both apps consume them as `workspace:*`.
- Domain modules in the API follow a flat NestJS layout: `*.module.ts`, `*.tool.ts` (MCP), `*.controller.ts` (REST, REST-gated), `*.service.ts`, plus DTOs and persistence helpers.
- Mutations to long-form documents (PLOT.md, knowledge) flow through unified diffs, not full-text writes.

## Local data

`./.local-data/` holds the dev SQLite database (`orchestrator.db` + `-wal` + `-shm`). It is gitignored and safe to delete — the next boot recreates and migrates a fresh database.
