import { ChevronRightIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownBody } from "./MarkdownBody";
import { useActiveProject } from "@/lib/use-active-project";
import type { AgentFull } from "@/types/agent";

interface Props {
  agent: AgentFull | null;
  onOpenChange: (open: boolean) => void;
}

const fmt = (ts: string | null): string => ts ?? "—";
const orDash = (s: string | null): string =>
  s === null || s === "" ? "—" : s;

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-accent"
        >
          <h3 className="text-sm font-semibold">{title}</h3>
          <ChevronRightIcon className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function MetadataList({ agent }: { agent: AgentFull }) {
  const reserved =
    agent.reservedPaths.length === 0 ? (
      <span>—</span>
    ) : (
      <span className="font-mono">{agent.reservedPaths.join(", ")}</span>
    );
  const merged = agent.mergedAt ? (
    <span>
      {fmt(agent.mergedAt)}{" "}
      <span className="font-mono">({agent.mergedCommit})</span>
    </span>
  ) : (
    <span>—</span>
  );
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Status", value: agent.status },
    { label: "Branch", value: <span className="font-mono">{agent.branch}</span> },
    {
      label: "Worktree",
      value: <span className="font-mono">{agent.worktree}</span>,
    },
    { label: "Reserved paths", value: reserved },
    { label: "Created", value: fmt(agent.createdAt) },
    { label: "Dispatched", value: fmt(agent.dispatchedAt) },
    { label: "Updated", value: fmt(agent.updatedAt) },
    { label: "Merged", value: merged },
    { label: "Abandoned reason", value: orDash(agent.abandonedReason) },
  ];
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AgentDetailDialog({ agent, onOpenChange }: Props) {
  const activeProject = useActiveProject();
  return (
    <Dialog open={agent !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {agent ? `Agent: ${agent.slug}` : "Agent"}
          </DialogTitle>
          <DialogDescription>
            {agent
              ? `${agent.status} · ${agent.branch}`
              : "Select an agent to view details."}
          </DialogDescription>
        </DialogHeader>
        {agent ? (
          <>
            {activeProject ? (
              <p className="text-xs text-muted-foreground">
                Project:{" "}
                <span className="font-mono">{activeProject}</span>
              </p>
            ) : null}
            <div className="space-y-2">
              <Section title="Metadata" defaultOpen>
                <MetadataList agent={agent} />
              </Section>
              <Section
                title="Human request"
                defaultOpen={Boolean(agent.request)}
              >
                <MarkdownBody text={agent.request || "—"} />
              </Section>
              <Section
                title="Final plan summary"
                defaultOpen={Boolean(agent.plan)}
              >
                <MarkdownBody text={agent.plan || "—"} />
              </Section>
              <Section
                title="Implementation prompt"
                defaultOpen={Boolean(agent.implPrompt)}
              >
                <MarkdownBody text={agent.implPrompt || "—"} />
              </Section>
              <Section
                title="Coordination brief"
                defaultOpen={Boolean(agent.coordinationBrief)}
              >
                <MarkdownBody text={agent.coordinationBrief || "—"} />
              </Section>
              <Section
                title="Post-merge notes"
                defaultOpen={Boolean(agent.postMergeNotes)}
              >
                <MarkdownBody text={agent.postMergeNotes || "—"} />
              </Section>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
