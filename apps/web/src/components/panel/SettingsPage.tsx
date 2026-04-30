import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson, patchJson, postJson } from "@/lib/api";
import { RegenerateVectorsAlert } from "./RegenerateVectorsAlert";

interface AppSettingsResponse {
  anthropicApiKey: string | null;
  anthropicTokenizerModel: string | null;
  embedderUrl: string | null;
  embedderModel: string | null;
  embedderDim: number | null;
  effective: {
    anthropicApiKey: "db" | "env" | "unset";
    anthropicTokenizerModel: "db" | "env" | "default";
    embedderUrl: "db" | "env" | "unset";
    embedderModel: "db" | "env" | "default";
    embedderDim: "db" | "env" | "default";
  };
}

interface VectorizeStatus {
  totalKnowledge: number;
  totalVectors: number;
  missing: number;
  stale: number;
  currentDim: number;
}

interface VectorizeResult {
  processed: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

type FormShape = {
  anthropicApiKey: string;
  anthropicTokenizerModel: string;
  embedderUrl: string;
  embedderModel: string;
  embedderDim: string;
};
type Effective = AppSettingsResponse["effective"];

type RegenSummary = "model" | "dim" | "both";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      form: FormShape;
      baseline: FormShape;
      effective: Effective;
      saving: boolean;
      savedAt: number | null;
      status: VectorizeStatus | null;
      regen: {
        open: boolean;
        summary: RegenSummary;
        targetDim: number | undefined;
        busy: boolean;
      };
      lastResult: { processed: number; total: number; errors: number } | null;
    };

const SETTINGS_ENDPOINT = "/api/orchestrator/settings";
const STATUS_ENDPOINT = "/api/orchestrator/knowledge/vectorize-status";
const VECTORIZE_ENDPOINT = "/api/orchestrator/knowledge/vectorize";

function toForm(r: AppSettingsResponse): FormShape {
  return {
    anthropicApiKey: r.anthropicApiKey ?? "",
    anthropicTokenizerModel: r.anthropicTokenizerModel ?? "",
    embedderUrl: r.embedderUrl ?? "",
    embedderModel: r.embedderModel ?? "",
    embedderDim: r.embedderDim?.toString() ?? "",
  };
}

function parseDim(raw: string): number | null {
  if (raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

export function SettingsPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [r, status] = await Promise.all([
          getJson<AppSettingsResponse>(SETTINGS_ENDPOINT),
          getJson<VectorizeStatus>(STATUS_ENDPOINT),
        ]);
        if (cancelled) return;
        const form = toForm(r);
        setState({
          kind: "ready",
          form,
          baseline: form,
          effective: r.effective,
          saving: false,
          savedAt: null,
          status,
          regen: {
            open: false,
            summary: "model",
            targetDim: undefined,
            busy: false,
          },
          lastResult: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.kind !== "ready" || state.savedAt === null) return;
    const remaining = 3000 - (Date.now() - state.savedAt);
    if (remaining <= 0) return;
    const t = setTimeout(() => setSavedTick((n) => n + 1), remaining);
    return () => clearTimeout(t);
  }, [state]);

  if (state.kind === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Failed to load</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{state.message}</p>
        </CardContent>
      </Card>
    );
  }

  const { form, baseline, effective, saving, savedAt, status, regen, lastResult } =
    state;
  const dirty =
    form.anthropicApiKey !== baseline.anthropicApiKey ||
    form.anthropicTokenizerModel !== baseline.anthropicTokenizerModel ||
    form.embedderUrl !== baseline.embedderUrl ||
    form.embedderModel !== baseline.embedderModel ||
    form.embedderDim !== baseline.embedderDim;
  const showSavedBadge =
    savedAt !== null && Date.now() - savedAt < 3000 && savedTick >= 0;

  const setForm = (patch: Partial<FormShape>) => {
    setState((s) =>
      s.kind === "ready" ? { ...s, form: { ...s.form, ...patch } } : s,
    );
  };

  const refetchStatus = async () => {
    const fresh = await getJson<VectorizeStatus>(STATUS_ENDPOINT);
    setState((s) => (s.kind === "ready" ? { ...s, status: fresh } : s));
  };

  const onBackfill = async () => {
    if (state.kind !== "ready" || !state.status) return;
    const total = state.status.missing;
    try {
      const result = await postJson<VectorizeResult>(VECTORIZE_ENDPOINT, {
        mode: "missing",
      });
      await refetchStatus();
      setState((s) =>
        s.kind === "ready"
          ? {
              ...s,
              lastResult: {
                processed: result.processed,
                total,
                errors: result.errors,
              },
            }
          : s,
      );
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const closeRegen = () => {
    setState((s) =>
      s.kind === "ready"
        ? { ...s, regen: { ...s.regen, open: false, busy: false } }
        : s,
    );
  };

  const onConfirmRegen = async () => {
    if (state.kind !== "ready") return;
    const total = state.status?.totalKnowledge ?? 0;
    setState((s) =>
      s.kind === "ready" ? { ...s, regen: { ...s.regen, busy: true } } : s,
    );
    try {
      const body: { mode: "all"; targetDim?: number } = { mode: "all" };
      if (state.regen.targetDim !== undefined)
        body.targetDim = state.regen.targetDim;
      const result = await postJson<VectorizeResult>(VECTORIZE_ENDPOINT, body);
      await refetchStatus();
      setState((s) =>
        s.kind === "ready"
          ? {
              ...s,
              regen: { ...s.regen, open: false, busy: false },
              lastResult: {
                processed: result.processed,
                total,
                errors: result.errors,
              },
            }
          : s,
      );
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "ready" || !dirty || saving) return;
    const prevModel = baseline.embedderModel;
    const prevDim = baseline.embedderDim;
    setState({ ...state, saving: true });
    const body: {
      anthropicApiKey?: string;
      anthropicTokenizerModel?: string;
      embedderUrl?: string;
      embedderModel?: string;
      embedderDim?: number;
    } = {};
    if (form.anthropicApiKey !== baseline.anthropicApiKey)
      body.anthropicApiKey = form.anthropicApiKey;
    if (form.anthropicTokenizerModel !== baseline.anthropicTokenizerModel)
      body.anthropicTokenizerModel = form.anthropicTokenizerModel;
    if (form.embedderUrl !== baseline.embedderUrl)
      body.embedderUrl = form.embedderUrl;
    if (form.embedderModel !== baseline.embedderModel)
      body.embedderModel = form.embedderModel;
    if (form.embedderDim !== baseline.embedderDim) {
      const parsed = parseDim(form.embedderDim);
      if (parsed !== null) body.embedderDim = parsed;
    }
    try {
      const r = await patchJson<AppSettingsResponse>(SETTINGS_ENDPOINT, body);
      const newForm = toForm(r);
      const modelChanged = newForm.embedderModel !== prevModel;
      const dimChanged = newForm.embedderDim !== prevDim;
      const totalKnowledge = state.status?.totalKnowledge ?? 0;
      const shouldPrompt =
        (modelChanged || dimChanged) && totalKnowledge > 0;
      const summary: RegenSummary =
        dimChanged && modelChanged
          ? "both"
          : dimChanged
            ? "dim"
            : "model";
      const targetDim =
        dimChanged && r.embedderDim !== null ? r.embedderDim : undefined;
      setState({
        kind: "ready",
        form: newForm,
        baseline: newForm,
        effective: r.effective,
        saving: false,
        savedAt: Date.now(),
        status: state.status,
        regen: shouldPrompt
          ? { open: true, summary, targetDim, busy: false }
          : { open: false, summary, targetDim, busy: false },
        lastResult: null,
      });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const lastResultBadge =
    lastResult !== null
      ? `Backfilled ${lastResult.processed} / ${lastResult.total} rows. ${lastResult.errors} errors.`
      : null;

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Anthropic API</CardTitle>
            <CardDescription>
              Used by the token-count badge on PLOT and Knowledge. Saved
              unencrypted to the orchestrator SQLite database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="anthropic-api-key"
              >
                API key
              </label>
              <Input
                id="anthropic-api-key"
                value={form.anthropicApiKey}
                onChange={(e) => setForm({ anthropicApiKey: e.target.value })}
                placeholder="sk-ant-..."
              />
              {effective.anthropicApiKey === "env" &&
                form.anthropicApiKey === "" && (
                  <p className="text-xs text-muted-foreground">
                    Currently provided by environment variable.
                  </p>
                )}
              {effective.anthropicApiKey === "unset" &&
                form.anthropicApiKey === "" && (
                  <p className="text-xs text-muted-foreground">
                    Not set. Token-count requests will return 503.
                  </p>
                )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="anthropic-model">
                Tokenizer model
              </label>
              <Input
                id="anthropic-model"
                value={form.anthropicTokenizerModel}
                onChange={(e) =>
                  setForm({ anthropicTokenizerModel: e.target.value })
                }
                placeholder="claude-opus-4-7"
              />
              {effective.anthropicTokenizerModel === "env" &&
                form.anthropicTokenizerModel === "" && (
                  <p className="text-xs text-muted-foreground">
                    Currently provided by environment variable.
                  </p>
                )}
              {effective.anthropicTokenizerModel === "default" &&
                form.anthropicTokenizerModel === "" && (
                  <p className="text-xs text-muted-foreground">
                    Defaults to <code>claude-opus-4-7</code>.
                  </p>
                )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Embedder</CardTitle>
            <CardDescription>
              Used to vectorize knowledge content on create and update. Point
              this at Ollama <code>/api/embed</code> or an OpenAI-compatible{" "}
              <code>/v1/embeddings</code> endpoint such as TEI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status && status.stale > 0 ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {status.stale} vectors are at the wrong dimension. Click
                Regenerate to re-embed.
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="embedder-url">
                Embedder URL
              </label>
              <Input
                id="embedder-url"
                value={form.embedderUrl}
                onChange={(e) => setForm({ embedderUrl: e.target.value })}
                placeholder="http://embedder:80/v1/embeddings"
              />
              <p className="text-xs text-muted-foreground">
                Compose API to TEI:{" "}
                <code>http://embedder:80/v1/embeddings</code>. Compose API to
                host Ollama:{" "}
                <code>http://host.docker.internal:11434/api/embed</code>. Local
                API to TEI:{" "}
                <code>http://127.0.0.1:8080/v1/embeddings</code>.
              </p>
              {effective.embedderUrl === "env" && form.embedderUrl === "" && (
                <p className="text-xs text-muted-foreground">
                  Currently provided by environment variable.
                </p>
              )}
              {effective.embedderUrl === "unset" && form.embedderUrl === "" && (
                <p className="text-xs text-muted-foreground">
                  Knowledge will be saved without embeddings.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="embedder-model">
                Model
              </label>
              <Input
                id="embedder-model"
                value={form.embedderModel}
                onChange={(e) => setForm({ embedderModel: e.target.value })}
                placeholder="google/embeddinggemma-300m"
              />
              <p className="text-xs text-muted-foreground">
                TEI users should set{" "}
                <code>google/embeddinggemma-300m</code>. Ollama users can leave
                this empty for the app default.
              </p>
              {effective.embedderModel === "env" &&
                form.embedderModel === "" && (
                  <p className="text-xs text-muted-foreground">
                    Currently provided by environment variable.
                  </p>
                )}
              {effective.embedderModel === "default" &&
                form.embedderModel === "" && (
                  <p className="text-xs text-muted-foreground">
                    Defaults to <code>embeddinggemma</code>.
                  </p>
                )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="embedder-dim">
                Dimension
              </label>
              <Input
                id="embedder-dim"
                value={form.embedderDim}
                onChange={(e) => setForm({ embedderDim: e.target.value })}
                placeholder="768"
                inputMode="numeric"
              />
              {effective.embedderDim === "env" && form.embedderDim === "" && (
                <p className="text-xs text-muted-foreground">From env.</p>
              )}
              {effective.embedderDim === "default" &&
                form.embedderDim === "" && (
                  <p className="text-xs text-muted-foreground">
                    Defaults to 768.
                  </p>
                )}
            </div>
            {status ? (
              <p className="text-xs text-muted-foreground">
                {status.totalVectors} / {status.totalKnowledge} vectorized ·
                current dim {status.currentDim}
              </p>
            ) : null}
            {status && status.missing > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void onBackfill()}
              >
                Backfill missing vectors ({status.missing})
              </Button>
            ) : null}
            {lastResultBadge ? (
              <Badge variant="secondary">{lastResultBadge}</Badge>
            ) : null}
          </CardContent>
          <CardFooter className="flex items-center gap-2">
            <Button type="submit" disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {showSavedBadge && <Badge variant="secondary">Saved</Badge>}
          </CardFooter>
        </Card>
      </form>
      <RegenerateVectorsAlert
        open={regen.open}
        summary={regen.summary}
        totalKnowledge={status?.totalKnowledge ?? 0}
        busy={regen.busy}
        onConfirm={() => void onConfirmRegen()}
        onCancel={closeRegen}
      />
    </>
  );
}
