import { useEffect, useState } from "react";
import { MarkdownBody } from "./MarkdownBody";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { API_BASE } from "@/lib/api";

interface JsonShape {
  content: string;
  updatedAt?: number;
}

interface Props {
  url: string;
  format: "text" | "json";
  emptyMessage?: string;
}

function relTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function MarkdownViewer({ url, format, emptyMessage }: Props) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; text: string; updatedAt?: number }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
        const r = await fetch(fullUrl, { credentials: "omit" });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        if (format === "text") {
          const text = await r.text();
          if (!cancelled) setState({ kind: "ready", text });
        } else {
          const json = (await r.json()) as JsonShape;
          if (!cancelled)
            setState({
              kind: "ready",
              text: json.content,
              updatedAt: json.updatedAt,
            });
        }
      } catch (err) {
        if (!cancelled)
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [url, format]);

  if (state.kind === "loading") {
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
      {state.updatedAt !== undefined ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Last updated {relTime(state.updatedAt)}
          </Badge>
        </div>
      ) : null}
      <MarkdownBody text={state.text} />
    </div>
  );
}
