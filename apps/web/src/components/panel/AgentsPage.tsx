import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "./agents/data-table";
import { columns } from "./agents/columns";
import { AgentDetailDialog } from "./AgentDetailDialog";
import { getJson } from "@/lib/api";
import type { AgentFull } from "@/types/agent";

export function AgentsPage() {
  const [agents, setAgents] = useState<AgentFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgentFull | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<AgentFull[]>("/api/orchestrator/agents")
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
  }, []);

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
