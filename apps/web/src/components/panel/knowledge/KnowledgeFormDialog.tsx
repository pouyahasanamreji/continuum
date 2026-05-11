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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { patchJson, postJson } from "@/lib/api";
import type { AgentSummary } from "@/types/agent";
import type { KnowledgeFull } from "@/types/knowledge";

type Mode = "create" | "edit";

interface Props {
  open: boolean;
  mode: Mode;
  project: string;
  agents: AgentSummary[];
  initial: KnowledgeFull | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (k: KnowledgeFull) => void;
}

export function KnowledgeFormDialog({
  open,
  mode,
  project,
  agents,
  initial,
  onOpenChange,
  onSaved,
}: Props) {
  const [slug, setSlug] = useState("");
  const [agentSlug, setAgentSlug] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<"fundamental" | "situational">(
    "situational",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setSlug(initial.slug);
      setAgentSlug(initial.agentSlug);
      setContent(initial.content);
      setKind(initial.kind ?? "situational");
    } else {
      setSlug("");
      setAgentSlug(agents[0]?.slug ?? "");
      setContent("");
      setKind("situational");
    }
    setError(null);
    setBusy(false);
  }, [open, mode, initial, agents]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "create") {
        const created = await postJson<KnowledgeFull>(
          "/api/orchestrator/knowledge",
          { project, agentSlug, slug, content, kind },
        );
        onSaved(created);
      } else {
        if (!initial) throw new Error("missing initial row");
        const body: {
          project: string;
          agentSlug?: string;
          content?: string;
          kind?: "fundamental" | "situational";
        } = { project };
        if (agentSlug && agentSlug !== "") body.agentSlug = agentSlug;
        if (content !== initial.content) body.content = content;
        if (kind !== initial.kind) body.kind = kind;
        const updated = await patchJson<KnowledgeFull>(
          `/api/orchestrator/knowledge/${encodeURIComponent(initial.slug)}`,
          body,
        );
        onSaved(updated);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New lesson" : `Edit ${initial?.slug ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Record a new knowledge lesson under this project."
              : "Replace lesson body and/or reattribute to a different agent."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Slug</label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="kebab-case slug"
              disabled={mode === "edit"}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Agent</label>
            <Select value={agentSlug} onValueChange={setAgentSlug}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.slug} value={a.slug}>
                    {a.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Kind</label>
            <Select
              value={kind}
              onValueChange={(v) =>
                setKind(v as "fundamental" | "situational")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="situational">situational</SelectItem>
                <SelectItem value="fundamental">fundamental</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Content</label>
            <textarea
              className="w-full min-h-48 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                busy ||
                !slug.trim() ||
                !agentSlug ||
                !content.trim()
              }
            >
              {busy
                ? "Saving..."
                : mode === "create"
                  ? "Create"
                  : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
