const RAW = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

export function withBase(path: string): string {
  if (!path) return RAW || "/";
  if (!path.startsWith("/")) return path;
  if (RAW && path.startsWith(`${RAW}/`)) return path;
  if (RAW && path === RAW) return path;
  return `${RAW}${path}`;
}
