import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusIcon } from "lucide-react";
import { DataTable } from "./data-table";
import { makeColumns } from "./columns";
import { KnowledgeDetailDialog } from "./KnowledgeDetailDialog";
import { KnowledgeFormDialog } from "./KnowledgeFormDialog";
import { DeleteKnowledgeAlert } from "./DeleteKnowledgeAlert";
import { getJson, withProject } from "@/lib/api";
import { useActiveProject } from "@/lib/use-active-project";
import type { AgentFull } from "@/types/agent";
import type { KnowledgeFull } from "@/types/knowledge";

const DEBOUNCE_MS = 200;

export function KnowledgePage() {
  const activeProject = useActiveProject();
  const [rows, setRows] = useState<KnowledgeFull[] | null>(null);
  const [agents, setAgents] = useState<AgentFull[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selected, setSelected] = useState<KnowledgeFull | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<KnowledgeFull | null>(null);
  const [deleting, setDeleting] = useState<KnowledgeFull | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const refresh = useCallback(async () => {
    if (!activeProject) return;
    try {
      if (debouncedQ.trim() === "") {
        const res = await getJson<{
          data: KnowledgeFull[];
          hasNextPage: boolean;
        }>(withProject("/api/orchestrator/knowledge?limit=50", activeProject));
        setRows(res.data);
      } else {
        const url = withProject(
          `/api/orchestrator/knowledge/search?q=${encodeURIComponent(debouncedQ)}&limit=50`,
          activeProject,
        );
        const res = await getJson<KnowledgeFull[]>(url);
        setRows(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [activeProject, debouncedQ]);

  useEffect(() => {
    if (!activeProject) {
      setRows(null);
      setAgents([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setRows(null);
    setError(null);
    void Promise.all([
      getJson<{ data: AgentFull[]; hasNextPage: boolean }>(
        withProject("/api/orchestrator/agents?limit=50", activeProject),
      ),
    ])
      .then(([agentRes]) => {
        if (!cancelled) setAgents(agentRes.data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const agentSlugById = useCallback(
    (agentId: number): string | null => {
      const a = agents.find((x) => x.id === agentId);
      return a?.slug ?? null;
    },
    [agents],
  );

  const columns = useMemo(
    () =>
      makeColumns({
        agentSlugById,
        onEdit: (row) => {
          setEditing(row);
          setFormMode("edit");
        },
        onDelete: (row) => setDeleting(row),
      }),
    [agentSlugById],
  );

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
          <CardTitle>Failed to load knowledge</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Knowledge</h2>
          <p className="text-sm text-muted-foreground">
            Lessons learned across dispatches.
          </p>
        </div>
        <Button onClick={() => setFormMode("create")}>
          <PlusIcon className="mr-2 size-4" />
          New lesson
        </Button>
      </div>

      <Input
        placeholder="Search lessons (substring of slug or content)..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />

      {rows === null ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <DataTable columns={columns} data={rows} onRowClick={setSelected} />
      )}

      <KnowledgeDetailDialog
        knowledge={selected}
        agentSlugById={agentSlugById}
        onOpenChange={(o) => !o && setSelected(null)}
      />

      <KnowledgeFormDialog
        open={formMode !== null}
        mode={formMode ?? "create"}
        project={activeProject}
        agents={agents}
        initial={formMode === "edit" ? editing : null}
        onOpenChange={(o) => {
          if (!o) {
            setFormMode(null);
            setEditing(null);
          }
        }}
        onSaved={() => {
          setFormMode(null);
          setEditing(null);
          void refresh();
        }}
      />

      <DeleteKnowledgeAlert
        knowledge={deleting}
        project={activeProject}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          void refresh();
        }}
      />
    </div>
  );
}
