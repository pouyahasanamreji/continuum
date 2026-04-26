import { useSyncExternalStore } from "react";
import {
  getActiveProject,
  subscribeActiveProject,
} from "./active-project-store";

export function useActiveProject(): string | null {
  return useSyncExternalStore(
    subscribeActiveProject,
    getActiveProject,
    () => null,
  );
}
