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
  knowledgeContent: string | null;
  agents: Array<{ slug: string; content: string }>;
  rejected: string[];
  rootName: string | null;
  fileCount: number;
  warnDotfileStrip: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMigrated?: () => void;
}

const SLUG_FILE_RE = /^[a-z][a-z0-9-]*\.md$/;
const MAX_FILES = 5000;

export function MigrateProjectDialog({ open, onOpenChange, onMigrated }: Props) {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);

  const reset = () => {
    setPath("");
    setName("");
    setPicked(null);
    setBusy(false);
    setError(null);
    setResult(null);
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setError("No files selected (or browser denied permission).");
      setPicked(null);
      return;
    }
    if (files.length > MAX_FILES) {
      setError(
        `Folder contains ${files.length} files (limit ${MAX_FILES}). Pick a tighter folder.`,
      );
      setPicked(null);
      return;
    }
    setError(null);

    let plotContent: string | null = null;
    let knowledgeContent: string | null = null;
    const agents: Array<{ slug: string; content: string }> = [];
    const rejected: string[] = [];
    let rootName: string | null = null;
    let sawAnyOrchestratorFile = false;

    for (const file of Array.from(files)) {
      const rel = file.webkitRelativePath;
      if (!rel) continue;
      const segments = rel.split("/");
      if (rootName === null) rootName = segments[0] ?? null;
      const tail = segments.slice(1);

      if (tail.length === 1 && tail[0] === "PLOT.md") {
        plotContent = await file.text();
        continue;
      }

      if (
        tail.length === 2 &&
        tail[0] === ".orchestrator" &&
        tail[1] === "knowledge.md"
      ) {
        knowledgeContent = await file.text();
        sawAnyOrchestratorFile = true;
        continue;
      }

      if (
        tail.length === 3 &&
        tail[0] === ".orchestrator" &&
        tail[1] === "agents"
      ) {
        const basename = tail[2]!;
        if (basename === "REGISTRY.md") {
          sawAnyOrchestratorFile = true;
          continue;
        }
        if (SLUG_FILE_RE.test(basename)) {
          const content = await file.text();
          agents.push({ slug: basename.replace(/\.md$/, ""), content });
          sawAnyOrchestratorFile = true;
        } else if (basename.endsWith(".md")) {
          rejected.push(basename);
          sawAnyOrchestratorFile = true;
        }
        continue;
      }
    }

    const warnDotfileStrip = plotContent !== null && !sawAnyOrchestratorFile;

    setPicked({
      plotContent,
      knowledgeContent,
      agents,
      rejected,
      rootName,
      fileCount: files.length,
      warnDotfileStrip,
    });
  };

  const submitDisabled =
    busy ||
    path.trim() === "" ||
    !picked ||
    !(
      picked.plotContent !== null ||
      picked.knowledgeContent !== null ||
      picked.agents.length > 0
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const trimmedPath = path.trim().replace(/\/+$/, "") || "/";
      const body: MigrationBody = { path: trimmedPath };
      if (name.trim()) body.name = name.trim();
      if (picked?.plotContent !== null && picked?.plotContent !== undefined) {
        body.plotContent = picked.plotContent;
      }
      if (
        picked?.knowledgeContent !== null &&
        picked?.knowledgeContent !== undefined
      ) {
        body.knowledgeContent = picked.knowledgeContent;
      }
      if (picked && picked.agents.length > 0) {
        body.agents = picked.agents;
      }
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
            Upserts PLOT.md, knowledge.md, and agents/*.md from a local folder
            into SQLite. Browser reads files; backend writes under the path you
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Project root folder</label>
              <input
                type="file"
                multiple
                /* @ts-expect-error non-standard */
                webkitdirectory=""
                onChange={(e) => void onPick(e)}
                disabled={busy}
                className="block w-full text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Reads PLOT.md, <code>.orchestrator/knowledge.md</code>, and{" "}
                <code>.orchestrator/agents/&lt;slug&gt;.md</code> (lowercase
                slug).
              </p>
            </div>

            {picked && (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div className="font-medium">
                  Detected in {picked.rootName ?? "(unknown)"}/:
                </div>
                <div>
                  PLOT.md:{" "}
                  {picked.plotContent !== null
                    ? `${picked.plotContent.length} chars`
                    : "not found"}
                </div>
                <div>
                  .orchestrator/knowledge.md:{" "}
                  {picked.knowledgeContent !== null
                    ? `${picked.knowledgeContent.length} chars`
                    : "not found"}
                </div>
                <div>
                  .orchestrator/agents/: {picked.agents.length} file(s)
                  {picked.agents.length > 0 &&
                    ` — ${picked.agents.map((a) => a.slug).join(", ")}`}
                </div>
                {picked.rejected.length > 0 && (
                  <div className="text-amber-600">
                    Rejected (slug regex / case): {picked.rejected.join(", ")}
                  </div>
                )}
                {picked.warnDotfileStrip && (
                  <div className="text-amber-600 mt-2">
                    Browser may have stripped <code>.orchestrator/</code>. Try
                    Firefox, or paste the affected files manually via the MCP{" "}
                    <code>project_migrate</code> tool.
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
