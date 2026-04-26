import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { broadcastProjectsMutated, patchJson } from "@/lib/api";
import { encodeProjectPath } from "@/lib/project-encoding";
import type { ProjectFull } from "@/types/project";

interface Props {
  project: ProjectFull | null;
  onOpenChange: (open: boolean) => void;
  onRenamed: (project: ProjectFull) => void;
}

export function RenameProjectDialog({
  project,
  onOpenChange,
  onRenamed,
}: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setError(null);
      setBusy(false);
    }
  }, [project]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setError(null);
    setBusy(true);
    try {
      const enc = encodeProjectPath(project.path);
      const updated = await patchJson<ProjectFull>(
        `/api/orchestrator/projects/${enc}`,
        { name: name.trim() },
      );
      broadcastProjectsMutated();
      onRenamed(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Dialog open={project !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            {project ? (
              <span className="font-mono text-xs">{project.path}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
