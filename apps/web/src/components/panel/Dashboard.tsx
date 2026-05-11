import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE, getJson, withProject } from "@/lib/api";
import { withBase } from "@/lib/base-path";
import { useActiveProject } from "@/lib/use-active-project";
import type { AgentStatus, AgentSummary } from "@/types/agent";

const STATUSES: AgentStatus[] = ["draft", "active", "merged", "abandoned"];
const MCP_URL = `${API_BASE}/mcp`;

interface PaginatedAgents {
  data: AgentSummary[];
  hasNextPage: boolean;
}

export function Dashboard() {
  const activeProject = useActiveProject();
  const [agents, setAgents] = useState<AgentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!activeProject) {
      setAgents(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setAgents(null);
    setError(null);
    getJson<PaginatedAgents>(
      withProject("/api/orchestrator/agents?limit=50", activeProject),
    )
      .then((res) => {
        if (!Array.isArray(res.data)) {
          throw new Error("Malformed agents response");
        }
        if (!cancelled) setAgents(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  const counts: Record<AgentStatus, number> = {
    draft: 0,
    active: 0,
    merged: 0,
    abandoned: 0,
  };
  if (agents) {
    for (const a of agents) counts[a.status] += 1;
  }

  const copyMcp = async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (!activeProject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active project</CardTitle>
          <CardDescription>
            Select a project from the sidebar switcher, or create one in{" "}
            <a className="underline" href={withBase("/projects")}>
              Projects
            </a>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATUSES.map((s) => (
          <Card key={s}>
            <CardHeader className="pb-2">
              <CardDescription className="capitalize">{s}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {agents === null ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  counts[s]
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load agents</CardTitle>
            <CardDescription className="text-destructive">
              {error}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>MCP server URL</CardTitle>
          <CardDescription>
            Point an MCP-aware client at this endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <code className="rounded bg-muted px-3 py-1 text-sm">{MCP_URL}</code>
          <Button onClick={copyMcp} size="sm" variant="secondary">
            {copied ? "Copied" : "Copy"}
          </Button>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <a href={withBase("/plot")} className="block">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle>PLOT</CardTitle>
              <CardDescription>Orchestrator protocol</CardDescription>
            </CardHeader>
          </Card>
        </a>
        <a href={withBase("/knowledge")} className="block">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle>Knowledge</CardTitle>
              <CardDescription>Lessons learned across dispatches</CardDescription>
            </CardHeader>
          </Card>
        </a>
        <a href={withBase("/agents")} className="block">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle>Agents</CardTitle>
              <CardDescription>All agent records</CardDescription>
            </CardHeader>
          </Card>
        </a>
      </section>
    </div>
  );
}
