const KEY = "continuum.activeProject";
const EVENT = "continuum:active-project-change";
const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("continuum") : null;

const listeners = new Set<() => void>();

export function getActiveProject(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setActiveProject(path: string | null): void {
  if (typeof window === "undefined") return;
  if (path === null) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, path);
  notify();
  channel?.postMessage({ type: "active-project-change" });
}

export function subscribeActiveProject(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  for (const cb of listeners) cb();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) notify();
  });
  channel?.addEventListener("message", (e) => {
    const data = (e as MessageEvent<{ type?: string }>).data;
    if (data?.type === "active-project-change") notify();
  });
}
