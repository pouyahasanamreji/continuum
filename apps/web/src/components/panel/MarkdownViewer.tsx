import { useEffect, useState } from "react";
import { MarkdownBody } from "./MarkdownBody";
import { TokenCountBadge } from "./TokenCountBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { API_BASE, withProject } from "@/lib/api";
import { useActiveProject } from "@/lib/use-active-project";

// Subset of api/Plot|api/Knowledge — additional fields (id, projectId, createdAt, deletedAt) are ignored by the viewer.
interface JsonShape {
  content: string;
  updatedAt?: string;
}

interface Props {
  endpoint: "plot" | "knowledge";
  emptyMessage?: string;
}

function relTime(ts: string): string {
  const diffMs = Date.now() - new Date(ts).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function MarkdownViewer({ endpoint, emptyMessage }: Props) {
  const activeProject = useActiveProject();

  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; text: string; updatedAt?: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (!activeProject) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    const path = withProject(`/api/orchestrator/${endpoint}`, activeProject);
    const run = async () => {
      try {
        const r = await fetch(`${API_BASE}${path}`, { credentials: "omit" });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const json = (await r.json()) as JsonShape;
        if (!cancelled)
          setState({
            kind: "ready",
            text: json.content,
            updatedAt: json.updatedAt,
          });
      } catch (err) {
        if (!cancelled)
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeProject, endpoint]);

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

  if (state.kind === "loading" || state.kind === "idle") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Failed to load</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{state.message}</p>
        </CardContent>
      </Card>
    );
  }
  if (!state.text || state.text.trim() === "") {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyMessage ?? "No content."}
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {state.updatedAt !== undefined ? (
          <Badge variant="secondary">
            Last updated {relTime(state.updatedAt)}
          </Badge>
        ) : (
          <span />
        )}
        <TokenCountBadge endpoint={endpoint} project={activeProject} />
      </div>
      <MarkdownBody text={state.text} />
    </div>
  );
}
