// Canonical orchestrator-protocol template seeded into every new
// project's plots row (project_create) and as the default plot
// content when project_migrate creates a fresh project record.
// This template is INTENTIONALLY divergent from the outer
// <orchestrator-root>/PLOT.md: the outer file describes the
// human-facing orchestrator workflow; this inner template describes
// orchestration via MCP tool calls (plot, plot_update, knowledge_list,
// knowledge_search, knowledge_get, knowledge_create, knowledge_update,
// knowledge_delete, registry_list, agent_*). No auto-sync.

export const DEFAULT_PLOT_TEMPLATE: string = `# Orchestrator Protocol

The agent acts as orchestrator. Spawns subagents via the \`Agent\`
tool. The orchestrator **does not implement**. It researches,
verifies, coordinates, and produces prompts for downstream agents
that run in isolated git worktrees.

Orchestrator state — protocol text, project knowledge, and the
agent registry — is persisted by the continuum MCP
service. Drive the workflow by calling MCP tools, NOT by editing
files under \`.orchestrator/\`. Every project-scoped tool takes
\`project\` as its first argument: the canonical absolute path
of the project root as registered with \`project_create\` /
\`project_migrate\`. If you run inside a git worktree of the
project, still pass the canonical project path — not the worktree
path — or the service throws \`project_not_found\`.

This document is project-agnostic. Project-specific facts (base
branch name, worktree-naming convention, shared-file names,
reference modules) live as knowledge lessons. Enumerate via
\`knowledge_list({project})\` and pull relevant ones via
\`knowledge_search({project, q})\`.

## Workflow

Every human-given task runs through four phases.

### 1. Intake

- Capture the task verbatim from the human.
- Call \`registry_list({project})\`. The response includes ALL
  agents (\`draft\` / \`active\` / \`merged\` /
  \`abandoned\`). For collision purposes, filter to
  \`status === 'active'\`. Drill into any specific agent with
  \`agent_get({project, slug})\`.
- Call \`knowledge_list({project})\` to enumerate accumulated lessons
  (slug, agentId, content, timestamps).
- Call \`knowledge_search({project, q})\` for each topical keyword
  drawn from the human task (modules, files, error names, concepts).
  Surface every matching lesson before research; lessons are how
  prior dispatches teach this one.
- If no agents are active, say so explicitly.
- Ask clarifying questions **only** when a conflict cannot be
  resolved without human input. Otherwise proceed.

### 2. Research

- Spawn a research agent via the \`Agent\` tool (typically
  \`subagent_type: "Explore"\` or \`"Plan"\`).
- The research agent produces a detailed, best-practice
  implementation plan. It must:
  - Read the project conventions surfaced by \`knowledge_list\` /
    \`knowledge_search\` and any reference files / modules they
    point at.
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
    paths (re-fetched via \`registry_list\` filtered to
    \`active\`, plus \`agent_get({project, slug})\` for detail).
  - Confirm surgical-change discipline is respected, or explain
    why a deliberate departure is warranted.
  - Return a revised plan with annotated deltas.
- If the verifier flags material issues, either fix the plan
  yourself or run another research pass. Do **not** skip this
  phase.

### 4. Handoff

The orchestrator produces two artifacts and persists them via
\`agent_create\`.

**A. Implementation prompt** (\`implPrompt\`) — self-contained
instructions the human pastes into a fresh agent session running
inside a dedicated git worktree. Must contain:

- Worktree name + creation command.
- Task description.
- Final plan: files to create, modify, delete.
- Reserved-path list for every other active agent.
- This agent's safe zone.
- Shared-file coordination notes (any file touched by multiple
  agents — append-only registries, generated artifacts, shared
  hooks).
- Conventions to follow (project guidelines, no AI attribution
  in commits/PRs).
- Explicit "do not commit regenerated artifacts" when generated
  files would collide across agents.

**B. Coordination brief** (\`coordinationBrief\`) — a short block
the human pastes into every other active agent's session so they
learn the new agent exists. Must list:

- The paths the new agent **reserves**.
- The paths it **leaves alone** (safe zones preserved).
- Any shared files and the expected merge strategy.

Persist both via:

\`\`\`
agent_create({
  project,           // canonical project root path
  slug,              // ^[a-z][a-z0-9-]*$
  branch,            // e.g. feature/refactor-foo
  worktree,          // absolute path to the worktree checkout
  reservedPaths,     // string[]; defaults to []
  request,           // verbatim human task — non-empty by convention
  plan,              // final agreed plan after Verify — non-empty
  implPrompt,        // artifact A above — non-empty
  coordinationBrief, // artifact B above — non-empty
})
\`\`\`

Newly created agents land in status \`draft\`. Flip to
\`active\` via
\`agent_update({project, slug, status: 'active'})\` when the human
dispatches.

## Conventions

- **Worktrees** live as siblings of the primary checkout. Naming
  follows the project's worktree convention (recorded in knowledge —
  read via \`knowledge_list\`).
- **Branch names** follow task intent — descriptive prefixes
  such as \`feature/refactor-<module>\`,
  \`feature/add-<feature>\`.
- **No overlapping paths.** Never dispatch two agents against the
  same file unless the overlap is explicitly coordinated and
  additive.
- **Append-only shared files** (seeds, registries, indexes):
  each agent appends a distinct block. No row edits, no
  reordering. Merge is N-way additive.
- **Generated artifacts** (SDK output, generated types, OpenAPI
  specs — anything regenerated from source): not committed on
  individual agents' branches when multiple parallel agents will
  touch them. The integration owner regenerates once on the
  integration branch.

## What the orchestrator does NOT do

- Does not edit source code directly.
- Does not run regen.
- Does not merge branches.
- Does not commit, push, or open PRs.

The orchestrator only: researches, verifies, coordinates, writes
prompts, and persists records via MCP tools.

## Persistence — MCP tools

Orchestrator state is persisted by the continuum MCP
service. There are no \`.orchestrator/\` files to read or write.

| Concern | Tool |
| --- | --- |
| Read this protocol | \`plot({project})\` |
| Edit this protocol | \`plot_update({project, diff})\` |
| List agents (collision matrix) | \`registry_list({project})\` |
| Inspect one agent | \`agent_get({project, slug})\` |
| Create new dispatch record | \`agent_create({project, slug, branch, worktree, reservedPaths, request, plan, implPrompt, coordinationBrief})\` |
| Update agent (status, paths, notes) | \`agent_update({project, slug, ...})\` |
| List knowledge lessons | \`knowledge_list({project})\` |
| Search knowledge by keyword | \`knowledge_search({project, q, limit?})\` |
| Read one lesson | \`knowledge_get({project, slug})\` |
| Record a new lesson | \`knowledge_create({project, agentSlug, slug, content})\` |
| Replace a lesson body | \`knowledge_update({project, slug, content?, agentSlug?})\` |
| Retire a lesson | \`knowledge_delete({project, slug})\` |

\`plot_update\` applies unified-diff patches with **zero fuzz**.
Diff headers are validated by exact regex — both header lines
must appear on their own line, case-sensitive, with at least one
whitespace between marker and path:

\`\`\`
--- a/PLOT.md
+++ b/PLOT.md
@@ -<old-start>,<old-len> +<new-start>,<new-len> @@
 context line
-removed line
+added line
\`\`\`

Hunk-context lines must match current content exactly. On any
mismatch the service throws \`hunk_mismatch\` (with the failed
\`@@\` header in the detail) or \`invalid_diff_headers\`.
Recovery: re-read with \`plot\`, regenerate the diff against
current content, retry. Never invent context.

Note: \`knowledge_update\` is whole-content replace; pass the full
new \`content\`. There is no diff format for lesson edits.

### Mandatory reads at Phase 1 Intake

Before planning any new dispatch, the orchestrator calls:

1. \`registry_list({project})\` — to enumerate agents and the
   paths each \`active\` row reserves.
2. \`agent_get({project, slug})\` — drill into specific agents
   when collision details matter.
3. \`knowledge_list({project})\` — to enumerate every recorded
   lesson (slug + agentId + timestamps).
4. \`knowledge_search({project, q})\` — for each topical keyword
   from the human task. Surface every matching lesson before
   planning research; lessons are how prior dispatches teach this
   one.

No dispatch without a fresh reading.

### Mandatory live-state refresh

Registry rows are point-in-time snapshots of plan + reserved
paths; they do NOT track real branch state. Before reporting on
an active agent's progress, before answering "what's in
flight?", and before any dispatch-time collision check, re-poll
the real branch state directly via the shell (the MCP service
does not proxy git):

\`\`\`
git -C <worktree> log --oneline <base>..HEAD   # what's committed
git -C <worktree> status --short               # what's uncommitted
\`\`\`

Substitute the project's base branch from the project knowledge.
If reality has moved (status flipped, paths shifted), reflect it
via \`agent_update\`. Never quote a stale phase count or commit
list from the registry without this refresh.

### Mandatory writes at post-merge file-back

When the human confirms an agent is merged, the orchestrator:

1. Reads the actual merged diff via shell git
   (\`git log\` / \`git show\` on the integration branch).
2. Calls
   \`agent_update({project, slug, status: 'merged', mergedCommit, postMergeNotes})\`
   where:
   - \`mergedCommit\` is the integration-branch SHA, 7-40 chars.
     Less than 7 fails \`invalid_merged_commit\`; missing fails
     \`missing_merged_commit\`. Already-merged records can patch
     \`mergedCommit\` later (without a status change) if the
     SHA was wrong.
   - \`postMergeNotes\` describes any drift between planned
     and actual files.
3. Records any reusable lesson via
   \`knowledge_create({project, agentSlug:<this-agent-slug>, slug:<descriptive-kebab-slug>, content:<lesson-body>})\`.
   Each lesson is one row; structure prose under any internal
   headings you want, but the row is the unit of addressability.

Skipping these steps breaks the compounding. Enforce.

### Status flags

Allowed transitions: \`draft → active\`,
\`active → merged | abandoned\`. \`agent_update\` enforces this
and throws \`invalid_transition\` on anything else.
\`merged\` requires \`mergedCommit\`; \`abandoned\`
requires \`abandonedReason\`. A patch that changes nothing
throws \`no_change\`. Only \`active\` agents reserve paths
for collision purposes.

- \`draft\` — record persisted, human has not dispatched.
- \`active\` — agent is working; reserved paths are live.
- \`merged\` — integrated; reserved paths released. Requires
  \`mergedCommit\`.
- \`abandoned\` — dispatch cancelled; paths released. Requires
  \`abandonedReason\`.

## Invocation

The human signals orchestrator mode by referencing the protocol
(e.g. "Read the orchestrator PLOT via the MCP and be the
orchestrator for the following task: ..."). On entry, call
\`plot({project})\` to load this document, acknowledge, enter
the workflow at Phase 1, and remain in orchestrator mode until
the human explicitly exits.
`;
