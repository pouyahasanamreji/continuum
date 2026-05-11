import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getJson, withProject } from "@/lib/api";
import type { AgentFull } from "@/types/agent";

interface Props {
  slug: string;
  project: string;
}

export function CopyPromptButton({ slug, project }: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    setError(false);
    try {
      const agent = await getJson<AgentFull>(
        withProject(
          `/api/orchestrator/agents/${encodeURIComponent(slug)}`,
          project,
        ),
      );
      await navigator.clipboard.writeText(agent.implPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 1500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={handleCopy}
      onMouseDown={(e) => e.stopPropagation()}
      disabled={busy}
    >
      {error ? "Failed" : busy ? "Copying..." : copied ? "Copied" : "Copy prompt"}
    </Button>
  );
}
