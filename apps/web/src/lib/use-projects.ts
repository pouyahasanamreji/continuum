import { useCallback, useEffect, useRef, useState } from "react";
import { getPaginatedJson } from "./api";
import type { ProjectFull } from "@/types/project";

interface UseProjectsOptions {
  page?: number;
  limit?: number;
}

export function useProjects(options: UseProjectsOptions = {}) {
  const page = options.page ?? 1;
  const limit = options.limit ?? 50;
  const [projects, setProjects] = useState<ProjectFull[] | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    try {
      const res = await getPaginatedJson<ProjectFull>(
        `/api/orchestrator/projects?page=${page}&limit=${limit}`,
        "projects",
      );
      if (requestId !== requestIdRef.current) return;
      setProjects(res.data);
      setHasNextPage(res.hasNextPage);
      setError(null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [limit, page]);

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

  return { projects, hasNextPage, loading, error, refresh };
}
