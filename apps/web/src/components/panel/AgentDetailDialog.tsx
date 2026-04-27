import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownBody } from "./MarkdownBody";
import { agentToMarkdown } from "@/lib/agent-markdown";
import { useActiveProject } from "@/lib/use-active-project";
import type { AgentFull } from "@/types/agent";

interface Props {
  agent: AgentFull | null;
  onOpenChange: (open: boolean) => void;
}

export function AgentDetailDialog({ agent, onOpenChange }: Props) {
  const activeProject = useActiveProject();
  return (
    <Dialog open={agent !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
            <MarkdownBody text={agentToMarkdown(agent)} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
