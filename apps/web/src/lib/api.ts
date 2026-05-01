import { setActiveProject } from "./active-project-store";

export const API_BASE =
  import.meta.env.PUBLIC_API_BASE_URL ?? "http://127.0.0.1:7776";

async function handle(r: Response): Promise<Response> {
  if (r.status === 404) {
    const body = await r
      .clone()
      .json()
      .catch(() => ({}) as Record<string, unknown>);
    const errors = (body as { errors?: Record<string, string> }).errors;
    if (errors?.project === "projectNotFound") {
      setActiveProject(null);
    }
  }
  if (!r.ok) {
    const body = await r
      .clone()
      .text()
      .catch(() => "");
    throw new Error(`${r.status} ${r.statusText}${body ? `: ${body}` : ""}`);
  }
  return r;
}

export async function getJson<T>(path: string): Promise<T> {
  const r = await handle(
    await fetch(`${API_BASE}${path}`, { credentials: "omit" }),
  );
  return (await r.json()) as T;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasNextPage: boolean;
}

export async function getPaginatedJson<T>(
  path: string,
  label: string,
): Promise<PaginatedResponse<T>> {
  const body = await getJson<unknown>(path);
  if (typeof body !== "object" || body === null) {
    throw new Error(`Malformed ${label} response`);
  }
  const data = (body as { data?: unknown }).data;
  const hasNextPage = (body as { hasNextPage?: unknown }).hasNextPage;
  if (!Array.isArray(data) || typeof hasNextPage !== "boolean") {
    throw new Error(`Malformed ${label} response`);
  }
  return { data: data as T[], hasNextPage };
}

export async function getText(path: string): Promise<string> {
  const r = await handle(
    await fetch(`${API_BASE}${path}`, { credentials: "omit" }),
  );
  return await r.text();
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const r = await handle(
    await fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return (await r.json()) as T;
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const r = await handle(
    await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return (await r.json()) as T;
}

export async function deleteRequest(path: string): Promise<void> {
  await handle(
    await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      credentials: "omit",
    }),
  );
}

export function withProject(path: string, project: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}project=${encodeURIComponent(project)}`;
}

export function broadcastProjectsMutated(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel("continuum");
  try {
    ch.postMessage({ type: "projects-mutated" });
  } finally {
    ch.close();
  }
}
