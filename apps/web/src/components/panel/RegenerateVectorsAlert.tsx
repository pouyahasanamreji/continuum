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

interface Props {
  open: boolean;
  summary: "model" | "dim" | "both";
  totalKnowledge: number;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function describe(
  summary: Props["summary"],
  totalKnowledge: number,
): string {
  if (summary === "model") {
    return `You changed the embedder model. Re-embed all ${totalKnowledge} knowledge rows with the new model?`;
  }
  if (summary === "dim") {
    return `You changed the embedding dimension. Drop the vector table and re-embed all ${totalKnowledge} knowledge rows at the new dim?`;
  }
  return `You changed the embedder model and dimension. Drop the vector table and re-embed all ${totalKnowledge} knowledge rows?`;
}

export function RegenerateVectorsAlert({
  open,
  summary,
  totalKnowledge,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regenerate all vectors?</AlertDialogTitle>
          <AlertDialogDescription>
            {describe(summary, totalKnowledge)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Regenerating..." : "Regenerate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
