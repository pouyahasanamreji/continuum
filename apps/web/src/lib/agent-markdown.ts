import type { AgentFull } from "@/types/agent";

const fmt = (ts: number | null): string =>
  ts === null ? "—" : new Date(ts).toISOString();

const orDash = (s: string | null): string => (s === null || s === "" ? "—" : s);

export function agentToMarkdown(a: AgentFull): string {
  const reserved =
    a.reservedPaths.length === 0
      ? "—"
      : a.reservedPaths.map((p) => `\`${p}\``).join(", ");
  return `# Agent: ${a.slug}

- **Status**: ${a.status}
- **Branch**: ${a.branch}
- **Worktree**: \`${a.worktree}\`
- **Reserved paths**: ${reserved}
- **Created**: ${fmt(a.createdAt)}
- **Dispatched**: ${fmt(a.dispatchedAt)}
- **Updated**: ${fmt(a.updatedAt)}
- **Merged**: ${a.mergedAt ? `${fmt(a.mergedAt)} (\`${a.mergedCommit}\`)` : "—"}
- **Abandoned reason**: ${orDash(a.abandonedReason)}

## Human request (verbatim)

${a.request || "—"}

## Final plan summary

${a.plan || "—"}

## Implementation prompt

${a.implPrompt || "—"}

## Coordination brief

${a.coordinationBrief || "—"}

## Post-merge notes

${a.postMergeNotes || "—"}
`;
}
