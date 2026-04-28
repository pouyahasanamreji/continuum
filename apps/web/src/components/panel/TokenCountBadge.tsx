import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson, withProject } from "@/lib/api";

interface Props {
  endpoint: "plot" | "knowledge";
  project: string;
}

type State = "loading" | { kind: "ready"; count: number } | "error";

export function TokenCountBadge({ endpoint, project }: Props) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    const path = withProject(
      `/api/orchestrator/${endpoint}/token-count`,
      project,
    );
    const run = async () => {
      try {
        const json = await getJson<{ inputTokens: number; model: string }>(
          path,
        );
        if (!cancelled) setState({ kind: "ready", count: json.inputTokens });
      } catch {
        if (!cancelled) setState("error");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [project, endpoint]);

  if (state === "loading") return <Skeleton className="h-5 w-20" />;
  if (state === "error") return null;
  return (
    <Badge variant="secondary">{state.count.toLocaleString()} tokens</Badge>
  );
}
