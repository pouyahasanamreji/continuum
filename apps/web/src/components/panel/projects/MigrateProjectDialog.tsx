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

interface RootPick {
  rootName: string | null;
  plotContent: string | null;
}

interface StatePick {
  rootName: string | null;
  knowledgeContent: string | null;
  agents: Array<{ slug: string; content: string }>;
  rejected: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMigrated?: () => void;
}

const SLUG_FILE_RE = /^[a-z][a-z0-9-]*\.md$/;
const MAX_FILES = 5000;

function rootSegment(path: string): string {
  const i = path.indexOf("/");
  return i === -1 ? path : path.slice(0, i);
}

export function MigrateProjectDialog({ open, onOpenChange, onMigrated }: Props) {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [rootPick, setRootPick] = useState<RootPick | null>(null);
  const [statePick, setStatePick] = useState<StatePick | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);

  const reset = () => {
    setPath("");
    setName("");
    setRootPick(null);
    setStatePick(null);
    setBusy(false);
    setError(null);
    setResult(null);
  };

  const onRootPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (!files || files.length === 0) {
      setRootPick({ rootName: null, plotContent: null });
      return;
    }
    if (files.length > MAX_FILES) {
      setError(
        `Folder contains ${files.length} files (limit ${MAX_FILES}). Pick a tighter folder.`,
      );
      setRootPick(null);
      return;
    }
    let plotContent: string | null = null;
    let rootName: string | null = null;
    for (const f of Array.from(files)) {
      const rel = f.webkitRelativePath;
      if (!rel) continue;
      if (rootName === null) rootName = rootSegment(rel);
      const root = rootName;
      if (root && rel === `${root}/PLOT.md`) {
        plotContent = await f.text();
      }
    }
    setRootPick({ rootName, plotContent });
  };

  const onStatePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (!files || files.length === 0) {
      setStatePick({
        rootName: null,
        knowledgeContent: null,
        agents: [],
        rejected: [],
      });
      setError(
        "Empty folder (or browser denied permission). Try selecting the folder again.",
      );
      return;
    }
    if (files.length > MAX_FILES) {
      setError(
        `Folder contains ${files.length} files (limit ${MAX_FILES}). Pick a tighter folder.`,
      );
      setStatePick(null);
      return;
    }
    let knowledgeContent: string | null = null;
    let rootName: string | null = null;
    const agents: Array<{ slug: string; content: string }> = [];
    const rejected: string[] = [];
    for (const f of Array.from(files)) {
      const rel = f.webkitRelativePath;
      if (!rel) continue;
      if (rootName === null) rootName = rootSegment(rel);
      const root = rootName;
      if (!root) continue;
      if (rel === `${root}/knowledge.md`) {
        knowledgeContent = await f.text();
        continue;
      }
      const agentPrefix = `${root}/agents/`;
      if (rel.startsWith(agentPrefix)) {
        const filename = rel.slice(agentPrefix.length);
        if (filename.includes("/")) continue;
        if (!SLUG_FILE_RE.test(filename)) {
          if (filename.endsWith(".md")) rejected.push(filename);
          continue;
        }
        const slug = filename.slice(0, -3);
        agents.push({ slug, content: await f.text() });
      }
    }
    setStatePick({ rootName, knowledgeContent, agents, rejected });
  };

  const submitDisabled =
    busy ||
    path.trim() === "" ||
    !(
      rootPick?.plotContent !== undefined && rootPick?.plotContent !== null ||
      statePick?.knowledgeContent !== undefined &&
        statePick?.knowledgeContent !== null ||
      (statePick?.agents.length ?? 0) > 0
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const trimmedPath = path.trim().replace(/\/+$/, "") || "/";
      const body: MigrationBody = { path: trimmedPath };
      if (name.trim()) body.name = name.trim();
      if (rootPick?.plotContent !== null && rootPick?.plotContent !== undefined) {
        body.plotContent = rootPick.plotContent;
      }
      if (
        statePick?.knowledgeContent !== null &&
        statePick?.knowledgeContent !== undefined
      ) {
        body.knowledgeContent = statePick.knowledgeContent;
      }
      if (statePick && statePick.agents.length > 0) {
        body.agents = statePick.agents;
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
            Upserts PLOT.md, knowledge.md, and agents/*.md from local folders
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
                onChange={(e) => void onRootPick(e)}
                disabled={busy}
                className="block w-full text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Reads PLOT.md from the folder root.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                .orchestrator state folder
              </label>
              <input
                type="file"
                multiple
                /* @ts-expect-error non-standard */
                webkitdirectory=""
                onChange={(e) => void onStatePick(e)}
                disabled={busy}
                className="block w-full text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Pick the <code>.orchestrator/</code> directory directly. Reads{" "}
                <code>knowledge.md</code> and <code>agents/&lt;slug&gt;.md</code>{" "}
                (lowercase slug).
              </p>
            </div>

            {(rootPick || statePick) && (
              <div className="space-y-2 rounded-md border p-3 text-xs font-mono">
                {rootPick ? (
                  <div>
                    <div>Project root: {rootPick.rootName ?? "(none)"}/</div>
                    <div className="pl-4">
                      PLOT.md:{" "}
                      {rootPick.plotContent !== null
                        ? `${rootPick.plotContent.length} chars`
                        : "not found"}
                    </div>
                  </div>
                ) : null}
                {statePick ? (
                  <div>
                    <div>State folder: {statePick.rootName ?? "(none)"}/</div>
                    <div className="pl-4">
                      knowledge.md:{" "}
                      {statePick.knowledgeContent !== null
                        ? `${statePick.knowledgeContent.length} chars`
                        : "not found"}
                    </div>
                    <div className="pl-4">
                      agents: {statePick.agents.length} file(s)
                      {statePick.agents.length > 0
                        ? ` — ${statePick.agents.map((a) => a.slug).join(", ")}`
                        : ""}
                    </div>
                    {statePick.rejected.length > 0 ? (
                      <div className="pl-4 text-amber-600">
                        Rejected (uppercase / bad slug):{" "}
                        {statePick.rejected.join(", ")}
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
