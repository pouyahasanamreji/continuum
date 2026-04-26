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
import { API_BASE, getJson } from "@/lib/api";
import type { AgentFull, AgentStatus } from "@/types/agent";

const STATUSES: AgentStatus[] = ["draft", "active", "merged", "abandoned"];
const MCP_URL = `${API_BASE}/mcp`;

export function Dashboard() {
  const [agents, setAgents] = useState<AgentFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        <a href="/plot" className="block">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle>PLOT</CardTitle>
              <CardDescription>Orchestrator protocol</CardDescription>
            </CardHeader>
          </Card>
        </a>
        <a href="/knowledge" className="block">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle>Knowledge</CardTitle>
              <CardDescription>Project knowledge document</CardDescription>
            </CardHeader>
          </Card>
        </a>
        <a href="/agents" className="block">
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
