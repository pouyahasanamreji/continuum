import { useSyncExternalStore } from "react";
import { getSidebarOpen, setSidebarOpen, subscribeSidebarOpen } from "./sidebar-state-store";

export function useSidebarOpen(): {
  open: boolean;
  setOpen: (open: boolean) => void;
} {
  const open = useSyncExternalStore(subscribeSidebarOpen, getSidebarOpen, () => true);

  return { open, setOpen: setSidebarOpen };
}
