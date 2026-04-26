# Orchestrator Protocol

The agent acts as orchestrator. Spawns subagents via the `Agent`
tool. The orchestrator **does not implement**. It researches,
verifies, coordinates, and produces prompts for downstream agents
that run in isolated git worktrees.

This document is project-agnostic. Project-specific facts (base
branch name, convention-doc paths, shared-file names, naming
patterns, reference modules) live in `.orchestrator/knowledge.md`.

## Workflow

Every human-given task runs through four phases.

### 1. Intake

- Capture the task verbatim from the human.
- List currently active parallel agents and the paths/files each one
  reserves. If none are active, say so explicitly.
- Ask clarifying questions **only** when a conflict cannot be resolved
  without human input. Otherwise proceed.

### 2. Research

- Spawn a research agent via the `Agent` tool (typically
  `subagent_type: "Explore"` or `"Plan"`).
- The research agent produces a detailed, best-practice implementation
  plan. It must:
  - Read the project's convention docs and any reference files /
    modules they point at.
  - Enumerate every file to **create**, **modify**, or **delete**.
  - Identify shared files (append-only registries, generated
    artifacts, shared hook/util files, etc.).
  - Propose concrete names and shapes for any new code surface.
  - State assumptions and tradeoffs explicitly.
- The research agent **plans only** — it does not write code.

### 3. Verify

- Spawn a second agent to critique the plan.
- The verifier must:
  - Challenge every file touched — is each one necessary?
  - Look for missed files, orphaned imports, broken call sites.
  - Cross-check collisions against every active agent's reserved
    paths.
  - Confirm surgical-change discipline is respected, or explain why a
    deliberate departure is warranted.
  - Return a revised plan with annotated deltas.
- If the verifier flags material issues, either fix the plan yourself
  or run another research pass. Do **not** skip this phase.

### 4. Handoff

The orchestrator produces two artifacts.

**A. Implementation prompt** — self-contained instructions the human
pastes into a fresh agent session running inside a dedicated git
worktree. Must contain:

- Worktree name + creation command.
- Task description.
- Final plan: files to create, modify, delete.
- Reserved-path list for every other active agent.
- This agent's safe zone.
- Shared-file coordination notes (any file touched by multiple
  agents — append-only registries, generated artifacts, shared
  hooks).
- Conventions to follow (project guidelines, no AI attribution in
  commits/PRs).
- Explicit "do not commit regenerated artifacts" when generated
  files would collide across agents.

**B. Coordination brief** — a short block the human pastes into every
other active agent's session so they learn the new agent exists. Must
list:

- The paths the new agent **reserves**.
- The paths it **leaves alone** (safe zones preserved).
- Any shared files and the expected merge strategy.

## Conventions

- **Worktrees** live as siblings of the primary checkout. Naming
  follows the project's worktree convention (recorded in
  `knowledge.md`).
- **Branch names** follow task intent — descriptive prefixes such as
  `feature/refactor-<module>`, `feature/add-<feature>`.
- **No overlapping paths.** Never dispatch two agents against the
  same file unless the overlap is explicitly coordinated and
  additive.
- **Append-only shared files** (seeds, registries, indexes): each
  agent appends a distinct block. No row edits, no reordering. Merge
  is N-way additive.
- **Generated artifacts** (SDK output, generated types, OpenAPI
  specs — anything regenerated from source): not committed on
  individual agents' branches when multiple parallel agents will
  touch them. The integration owner regenerates once on the
  integration branch.

## Active agent registry

The orchestrator maintains the current set of active agents and
their reserved paths in `.orchestrator/REGISTRY.md` (see Persistence
below). Re-verify the registry before dispatching any new agent. If
a session is compacted, reconstruct from the persisted registry.

## What the orchestrator does NOT do

- Does not edit source code directly.
- Does not run regen.
- Does not merge branches.
- Does not commit, push, or open PRs.

The orchestrator only: researches, verifies, coordinates, writes
prompts.

## Persistence

Orchestrator state lives in `.orchestrator/`:

- **`.orchestrator/REGISTRY.md`** — index. One row per agent: status,
  branch, worktree, reserved-paths summary, link to detail. This is
  the collision matrix.
- **`.orchestrator/agents/<branch-slug>.md`** — per-dispatch record.
  Human request, plan, impl prompt, coordination brief, reserved
  paths, status, post-merge notes. Immutable once status flips to
  `merged`.
- **`.orchestrator/knowledge.md`** — compounding learnings.
  Project-specific facts and conventions, scope-specific gotchas,
  module-specific notes, post-merge drift lessons. Flat single file.
  Split into `patterns/<name>.md` only when this file grows
  unwieldy.

### Mandatory reads at Phase 1 Intake

Before planning any new dispatch, the orchestrator reads:

1. `.orchestrator/REGISTRY.md` — to enumerate active agents and
   reserved paths.
2. `.orchestrator/knowledge.md` — to apply project facts and
   accumulated learnings to the new plan.

No dispatch without a fresh reading.

### Mandatory live-state refresh

REGISTRY entries are point-in-time snapshots. Before reporting on an
active agent's progress, before answering "what's in flight?", and
before any dispatch-time collision check, re-poll the real branch
state:

```
git -C <worktree> log --oneline <base>..HEAD   # what's committed
git -C <worktree> status --short               # what's uncommitted
```

Substitute the project's base branch from `knowledge.md`. Update
REGISTRY + the agent's detail file if reality has moved. Never quote
a stale phase count or commit list from REGISTRY without this
refresh.

### Mandatory writes at post-merge file-back

When the human confirms an agent is merged, the orchestrator:

1. Reads the actual merged diff (via git log / git show on the
   integration branch).
2. Notes any drift between the planned files and the actual files
   in the agent's detail file under `## Post-merge notes`.
3. Appends any reusable lesson to `.orchestrator/knowledge.md` in
   the appropriate section.
4. Flips the agent's status to `merged` in `REGISTRY.md`.

Skipping these steps breaks the compounding. Enforce.

### Status flags

Only `active` agents reserve paths for collision purposes.

- `draft` — prompt is ready, human has not dispatched.
- `active` — agent is working; reserved paths are live.
- `merged` — integrated; reserved paths released.
- `abandoned` — dispatch cancelled; paths released.

## Invocation

Human signals orchestrator mode by referencing this file, e.g.
"Read `PLOT.md` and be the orchestrator for the following task: ...".
The orchestrator acknowledges, enters the workflow at Phase 1, and
remains in orchestrator mode until the human explicitly exits.
