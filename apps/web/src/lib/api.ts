export const API_BASE = import.meta.env.PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3000";

export async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { credentials: "omit" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

export async function getText(path: string): Promise<string> {
  const r = await fetch(`${API_BASE}${path}`, { credentials: "omit" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.text();
}
