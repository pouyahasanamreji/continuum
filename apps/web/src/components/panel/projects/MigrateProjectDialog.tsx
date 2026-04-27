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
import { setActiveProject } from "@/lib/active-project-store";

interface MigrationResult {
  projectPath: string;
  created: boolean;
  plotUpdated: boolean;
  knowledgeUpdated: boolean;
  agentsUpserted: number;
  agentsSkipped: number;
  warnings: string[];
}

interface MigrationBody {
  path: string;
  name?: string;
  plotContent?: string;
  knowledgeContent?: string;
  agents?: Array<{ slug: string; content: string }>;
}

interface Picked {
  plotContent: string | null;
  plotFilename: string | null;
  knowledgeContent: string | null;
  knowledgeFilename: string | null;
  registryIgnored: boolean;
  agents: Array<{ slug: string; content: string }>;
  knowledgeRejected: string[];
  agentsRejected: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMigrated?: () => void;
}

const SLUG_FILE_RE = /^[a-z][a-z0-9-]*\.md$/;

const initialPicked: Picked = {
  plotContent: null,
  plotFilename: null,
  knowledgeContent: null,
  knowledgeFilename: null,
  registryIgnored: false,
  agents: [],
  knowledgeRejected: [],
  agentsRejected: [],
};

export function MigrateProjectDialog({ open, onOpenChange, onMigrated }: Props) {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Picked>(initialPicked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);

  const reset = () => {
    setPath("");
    setName("");
    setPicked(initialPicked);
    setBusy(false);
    setError(null);
    setResult(null);
  };

  const onPickPlot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.name !== "PLOT.md") {
      setError(`Expected PLOT.md, got "${f.name}". Filename is case-sensitive.`);
      e.target.value = "";
      return;
    }
    setError(null);
    const content = await f.text();
    setPicked((p) => ({ ...p, plotContent: content, plotFilename: f.name }));
  };

  const onPickKnowledge = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    let knowledgeContent: string | null = null;
    let knowledgeFilename: string | null = null;
    let registryIgnored = false;
    const rejected: string[] = [];
    for (const f of Array.from(files)) {
      if (f.name === "knowledge.md") {
        knowledgeContent = await f.text();
        knowledgeFilename = f.name;
      } else if (f.name === "REGISTRY.md") {
        registryIgnored = true;
      } else {
        rejected.push(f.name);
      }
    }
    setPicked((p) => ({
      ...p,
      knowledgeContent,
      knowledgeFilename,
      registryIgnored,
      knowledgeRejected: rejected,
    }));
  };

  const onPickAgents = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    const agents: Array<{ slug: string; content: string }> = [];
    const rejected: string[] = [];
    for (const f of Array.from(files)) {
      if (SLUG_FILE_RE.test(f.name)) {
        const content = await f.text();
        agents.push({ slug: f.name.replace(/\.md$/, ""), content });
      } else {
        rejected.push(f.name);
      }
    }
    setPicked((p) => ({ ...p, agents, agentsRejected: rejected }));
  };

  const hasAny =
    picked.plotContent !== null ||
    picked.knowledgeContent !== null ||
    picked.agents.length > 0;

  const submitDisabled = busy || path.trim() === "" || !hasAny;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const trimmedPath = path.trim().replace(/\/+$/, "") || "/";
      const body: MigrationBody = { path: trimmedPath };
      if (name.trim()) body.name = name.trim();
      if (picked.plotContent !== null) body.plotContent = picked.plotContent;
      if (picked.knowledgeContent !== null) {
        body.knowledgeContent = picked.knowledgeContent;
      }
      if (picked.agents.length > 0) body.agents = picked.agents;
      const r = await postJson<MigrationResult>(
        "/api/orchestrator/projects/migrate",
        body,
      );
      broadcastProjectsMutated();
      setActiveProject(r.projectPath);
      setResult(r);
      onMigrated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const allRejected = [...picked.knowledgeRejected, ...picked.agentsRejected];
  const showPreview =
    picked.plotContent !== null ||
    picked.knowledgeContent !== null ||
    picked.agents.length > 0 ||
    picked.registryIgnored ||
    allRejected.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Migrate project from folder</DialogTitle>
          <DialogDescription>
            Upserts PLOT.md, knowledge.md, and agents/*.md into SQLite. Pick
            the files individually below. Backend writes under the path you
            type. Never deletes.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <div className="font-medium">Migration complete</div>
            <div className="rounded-md border p-3 text-xs font-mono">
              <div>path: {result.projectPath}</div>
              <div>created: {String(result.created)}</div>
              <div>plotUpdated: {String(result.plotUpdated)}</div>
              <div>knowledgeUpdated: {String(result.knowledgeUpdated)}</div>
              <div>agentsUpserted: {result.agentsUpserted}</div>
              <div>agentsSkipped: {result.agentsSkipped}</div>
            </div>
            {result.warnings.length > 0 ? (
              <div className="space-y-1">
                <div className="text-xs font-medium">Warnings</div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Path <span className="text-destructive">*</span>
              </label>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/Users/you/projects/example"
                autoFocus
                required
                disabled={busy}
              />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">PLOT.md (single file)</label>
              <Input
                type="file"
                accept=".md,text/markdown"
                onChange={(e) => void onPickPlot(e)}
                disabled={busy}
              />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">
                knowledge.md (multi — REGISTRY.md is ignored)
              </label>
              <Input
                type="file"
                accept=".md,text/markdown"
                multiple
                onChange={(e) => void onPickKnowledge(e)}
                disabled={busy}
              />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">agents/*.md (multi)</label>
              <Input
                type="file"
                accept=".md,text/markdown"
                multiple
                onChange={(e) => void onPickAgents(e)}
                disabled={busy}
              />
            </div>

            {showPreview && (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div className="font-medium">Selected:</div>
                <div>
                  PLOT.md:{" "}
                  {picked.plotContent !== null
                    ? `${picked.plotContent.length} chars`
                    : "not selected"}
                </div>
                <div>
                  knowledge.md:{" "}
                  {picked.knowledgeContent !== null
                    ? `${picked.knowledgeContent.length} chars`
                    : "not selected"}
                </div>
                <div>
                  agents: {picked.agents.length} file(s)
                  {picked.agents.length > 0 &&
                    ` — ${picked.agents.map((a) => a.slug).join(", ")}`}
                </div>
                {picked.registryIgnored && (
                  <div className="text-amber-600">
                    REGISTRY.md ignored — not stored in DB.
                  </div>
                )}
                {allRejected.length > 0 && (
                  <div className="text-amber-600">
                    Rejected (wrong filename / case): {allRejected.join(", ")}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Name <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="defaults to basename of path"
                disabled={busy}
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
              <Button type="submit" disabled={submitDisabled}>
                {busy ? "Migrating..." : "Migrate"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
