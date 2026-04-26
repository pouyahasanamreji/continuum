import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { broadcastProjectsMutated, deleteRequest } from "@/lib/api";
import { encodeProjectPath } from "@/lib/project-encoding";
import { setActiveProject, getActiveProject } from "@/lib/active-project-store";
import type { ProjectFull } from "@/types/project";

interface Props {
  project: ProjectFull | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (project: ProjectFull) => void;
}

export function DeleteProjectAlert({
  project,
  onOpenChange,
  onDeleted,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!project) return;
    setError(null);
    setBusy(true);
    try {
      const enc = encodeProjectPath(project.path);
      await deleteRequest(`/api/orchestrator/projects/${enc}`);
      if (getActiveProject() === project.path) setActiveProject(null);
      broadcastProjectsMutated();
      onDeleted(project);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={project !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
            Cascades plot, knowledge, and all agents under{" "}
            <span className="font-mono text-xs">{project?.path}</span>. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
