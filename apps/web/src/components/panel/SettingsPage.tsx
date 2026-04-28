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
import { getJson, patchJson } from "@/lib/api";

interface AppSettingsResponse {
  anthropicApiKey: string | null;
  anthropicTokenizerModel: string | null;
  effective: {
    anthropicApiKey: "db" | "env" | "unset";
    anthropicTokenizerModel: "db" | "env" | "default";
  };
}

type FormShape = { anthropicApiKey: string; anthropicTokenizerModel: string };
type Effective = AppSettingsResponse["effective"];

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
    };

const ENDPOINT = "/api/orchestrator/settings";

function toForm(r: AppSettingsResponse): FormShape {
  return {
    anthropicApiKey: r.anthropicApiKey ?? "",
    anthropicTokenizerModel: r.anthropicTokenizerModel ?? "",
  };
}

export function SettingsPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const r = await getJson<AppSettingsResponse>(ENDPOINT);
        if (cancelled) return;
        const form = toForm(r);
        setState({
          kind: "ready",
          form,
          baseline: form,
          effective: r.effective,
          saving: false,
          savedAt: null,
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

  const { form, baseline, effective, saving, savedAt } = state;
  const dirty =
    form.anthropicApiKey !== baseline.anthropicApiKey ||
    form.anthropicTokenizerModel !== baseline.anthropicTokenizerModel;
  const showSavedBadge =
    savedAt !== null && Date.now() - savedAt < 3000 && savedTick >= 0;

  const setForm = (patch: Partial<FormShape>) => {
    setState((s) =>
      s.kind === "ready" ? { ...s, form: { ...s.form, ...patch } } : s,
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "ready" || !dirty || saving) return;
    setState({ ...state, saving: true });
    const body: Partial<FormShape> = {};
    if (form.anthropicApiKey !== baseline.anthropicApiKey)
      body.anthropicApiKey = form.anthropicApiKey;
    if (form.anthropicTokenizerModel !== baseline.anthropicTokenizerModel)
      body.anthropicTokenizerModel = form.anthropicTokenizerModel;
    try {
      const r = await patchJson<AppSettingsResponse>(ENDPOINT, body);
      const newForm = toForm(r);
      setState({
        kind: "ready",
        form: newForm,
        baseline: newForm,
        effective: r.effective,
        saving: false,
        savedAt: Date.now(),
      });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <form onSubmit={onSubmit}>
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
        <CardFooter className="flex items-center gap-2">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {showSavedBadge && <Badge variant="secondary">Saved</Badge>}
        </CardFooter>
      </Card>
    </form>
  );
}
