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
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownBody } from "../MarkdownBody";
import type { KnowledgeFull } from "@/types/knowledge";

interface Props {
  knowledge: KnowledgeFull | null;
  loading?: boolean;
  agentSlugById: (agentId: number) => string | null;
  onOpenChange: (open: boolean) => void;
}

const fmt = (ts: string | null): string => ts ?? "—";

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
      <CollapsibleContent className="px-2 pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function MetadataList({
  knowledge,
  agentSlugById,
}: {
  knowledge: KnowledgeFull;
  agentSlugById: (agentId: number) => string | null;
}) {
  const agentSlug = agentSlugById(knowledge.agentId);
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Slug", value: <span className="font-mono">{knowledge.slug}</span> },
    {
      label: "Agent",
      value: agentSlug ? (
        <span className="font-mono">{agentSlug}</span>
      ) : (
        <span className="text-muted-foreground">#{knowledge.agentId}</span>
      ),
    },
    { label: "Kind", value: <span className="font-mono">{knowledge.kind}</span> },
    { label: "Created", value: fmt(knowledge.createdAt) },
    { label: "Updated", value: fmt(knowledge.updatedAt) },
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

export function KnowledgeDetailDialog({
  knowledge,
  loading,
  agentSlugById,
  onOpenChange,
}: Props) {
  const open = knowledge !== null || Boolean(loading);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {knowledge ? `Lesson: ${knowledge.slug}` : "Lesson"}
          </DialogTitle>
          <DialogDescription>
            {knowledge
              ? `Recorded by agent #${knowledge.agentId}`
              : loading
                ? "Loading lesson..."
                : "Select a lesson to view details."}
          </DialogDescription>
        </DialogHeader>
        {knowledge ? (
          <div className="space-y-2">
            <Section title="Metadata" defaultOpen>
              <MetadataList
                knowledge={knowledge}
                agentSlugById={agentSlugById}
              />
            </Section>
            <Section title="Content" defaultOpen>
              <MarkdownBody text={knowledge.content || "—"} />
            </Section>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
