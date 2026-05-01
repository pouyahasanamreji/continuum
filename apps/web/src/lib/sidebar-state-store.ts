const KEY = "continuum.sidebarOpen";
const LEGACY_COOKIE_NAME = "sidebar_state";
const BROADCAST_TYPE = "sidebar-open-change";
const channel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("continuum")
    : null;

const listeners = new Set<() => void>();
let memoryOpen: boolean | null = null;
let useMemoryFallback = false;

export function getSidebarOpen(): boolean {
  if (typeof window === "undefined") return true;

  if (useMemoryFallback && memoryOpen !== null) return memoryOpen;

  const stored = readStoredOpen();
  if (stored !== null) return stored;

  const cookie = readLegacyCookieOpen();
  if (cookie !== null) return cookie;

  return true;
}

export function setSidebarOpen(open: boolean): void {
  if (typeof window === "undefined") return;

  memoryOpen = open;
  try {
    window.localStorage.setItem(KEY, String(open));
    useMemoryFallback = false;
  } catch {
    useMemoryFallback = true;
    // Keep the in-memory value so subscribers still observe this change.
  }

  notify();
  channel?.postMessage({ type: BROADCAST_TYPE });
}

export function subscribeSidebarOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStoredOpen(): boolean | null {
  try {
    return parseOpen(window.localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function readLegacyCookieOpen(): boolean | null {
  if (typeof document === "undefined") return null;

  for (const entry of document.cookie.split(";")) {
    const [name, ...valueParts] = entry.trim().split("=");
    if (name === LEGACY_COOKIE_NAME) {
      return parseOpen(valueParts.join("="));
    }
  }

  return null;
}

function parseOpen(value: string | null | undefined): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function notifyExternalChange(): void {
  useMemoryFallback = false;
  notify();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) notifyExternalChange();
  });

  channel?.addEventListener("message", (event) => {
    const data = (event as MessageEvent<{ type?: string }>).data;
    if (data?.type === BROADCAST_TYPE) notifyExternalChange();
  });
}
