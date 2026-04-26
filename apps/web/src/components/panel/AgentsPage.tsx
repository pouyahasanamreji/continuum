import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "./agents/data-table";
import { columns } from "./agents/columns";
import { AgentDetailDialog } from "./AgentDetailDialog";
import { getJson, withProject } from "@/lib/api";
import { useActiveProject } from "@/lib/use-active-project";
import type { AgentFull } from "@/types/agent";

export function AgentsPage() {
  const activeProject = useActiveProject();
  const [agents, setAgents] = useState<AgentFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgentFull | null>(null);

  useEffect(() => {
    if (!activeProject) {
      setAgents(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setAgents(null);
    setError(null);
    getJson<AgentFull[]>(
      withProject("/api/orchestrator/agents", activeProject),
    )
      .then((data) => {
        if (!cancelled) setAgents(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  if (!activeProject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active project</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a project from the sidebar, or create one in{" "}
            <a className="underline" href="/projects">
              Projects
            </a>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Failed to load agents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (agents === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      <DataTable columns={columns} data={agents} onRowClick={setSelected} />
      <AgentDetailDialog
        agent={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}
