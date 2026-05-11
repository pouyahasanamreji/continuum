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
import { deleteRequest, withProject } from "@/lib/api";
import type { KnowledgeSummary } from "@/types/knowledge";

interface Props {
  knowledge: KnowledgeSummary | null;
  project: string;
  onOpenChange: (open: boolean) => void;
  onDeleted: (knowledge: KnowledgeSummary) => void;
}

export function DeleteKnowledgeAlert({
  knowledge,
  project,
  onOpenChange,
  onDeleted,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!knowledge) return;
    setError(null);
    setBusy(true);
    try {
      await deleteRequest(
        withProject(
          `/api/orchestrator/knowledge/${encodeURIComponent(knowledge.slug)}`,
          project,
        ),
      );
      onDeleted(knowledge);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={knowledge !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete lesson?</AlertDialogTitle>
          <AlertDialogDescription>
            Hard-deletes the lesson{" "}
            <span className="font-mono text-xs">{knowledge?.slug}</span>. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
