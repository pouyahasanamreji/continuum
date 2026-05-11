import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "./agents/data-table";
import { makeAgentColumns } from "./agents/columns";
import { AgentDetailDialog } from "./AgentDetailDialog";
import { TablePagination } from "./TablePagination";
import { getJson, getPaginatedJson, withProject } from "@/lib/api";
import { withBase } from "@/lib/base-path";
import { useActiveProject } from "@/lib/use-active-project";
import type { AgentFull, AgentSummary } from "@/types/agent";

const PAGE_SIZE = 10;

export function AgentsPage() {
  const activeProject = useActiveProject();
  const [agents, setAgents] = useState<AgentSummary[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgentFull | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const projectPageKeyRef = useRef<string | null>(null);
  const emptyNextFromPageRef = useRef<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [activeProject, page]);

  useEffect(() => {
    if (!activeProject) {
      projectPageKeyRef.current = null;
      emptyNextFromPageRef.current = null;
      setAgents(null);
      setHasNextPage(false);
      setError(null);
      return;
    }
    if (projectPageKeyRef.current !== activeProject) {
      projectPageKeyRef.current = activeProject;
      emptyNextFromPageRef.current = null;
      if (page !== 1) {
        setAgents(null);
        setHasNextPage(false);
        setError(null);
        setPage(1);
        return;
      }
    }
    let cancelled = false;
    setAgents(null);
    setError(null);
    getPaginatedJson<AgentSummary>(
      withProject(
        `/api/orchestrator/agents?page=${page}&limit=${PAGE_SIZE}`,
        activeProject,
      ),
      "agents",
    )
      .then((res) => {
        if (cancelled) return;
        if (res.data.length === 0 && page > 1) {
          emptyNextFromPageRef.current = page - 1;
          setHasNextPage(false);
          setPage((current) => Math.max(1, current - 1));
          return;
        }
        setAgents(res.data);
        setHasNextPage(
          res.hasNextPage && emptyNextFromPageRef.current !== page,
        );
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject, page]);

  const columns = useMemo(
    () => makeAgentColumns(activeProject ?? ""),
    [activeProject],
  );

  const openRow = async (row: AgentSummary) => {
    if (!activeProject) return;
    setSelectedLoading(true);
    try {
      const full = await getJson<AgentFull>(
        withProject(
          `/api/orchestrator/agents/${encodeURIComponent(row.slug)}`,
          activeProject,
        ),
      );
      setSelected(full);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSelectedLoading(false);
    }
  };

  if (!activeProject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active project</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a project from the sidebar, or create one in{" "}
            <a className="underline" href={withBase("/projects")}>
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
      <div>
        <DataTable
          columns={columns}
          data={agents}
          onRowClick={(row) => void openRow(row)}
        />
        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          rowCount={agents.length}
          hasNextPage={hasNextPage}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      </div>
      <AgentDetailDialog
        agent={selected}
        loading={selectedLoading}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}
