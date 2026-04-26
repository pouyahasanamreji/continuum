import { useState } from "react";
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
import { broadcastProjectsMutated, postJson } from "@/lib/api";
import type { ProjectFull } from "@/types/project";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (project: ProjectFull) => void;
}

export function CreateProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPath("");
    setName("");
    setError(null);
    setBusy(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body: { path: string; name?: string } = { path };
      if (name.trim()) body.name = name.trim();
      const created = await postJson<ProjectFull>(
        "/api/orchestrator/projects",
        body,
      );
      broadcastProjectsMutated();
      onCreated(created);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Identify the project by its canonical absolute path (`pwd` of the
            working tree).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Path</label>
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/Users/you/projects/example"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Name <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="defaults to basename"
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
            <Button type="submit" disabled={busy || !path.trim()}>
              {busy ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
