import { useCallback, useEffect, useState } from "react";
import { getJson } from "./api";
import type { ProjectFull } from "@/types/project";

interface PaginatedProjects {
  data: ProjectFull[];
  hasNextPage: boolean;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJson<PaginatedProjects>(
        "/api/orchestrator/projects?limit=50",
      );
      setProjects(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("continuum");
    const handler = (e: MessageEvent<{ type?: string }>) => {
      if (e.data?.type === "projects-mutated") void refresh();
    };
    ch.addEventListener("message", handler);
    return () => {
      ch.removeEventListener("message", handler);
      ch.close();
    };
  }, [refresh]);

  return { projects, loading, error, refresh };
}
