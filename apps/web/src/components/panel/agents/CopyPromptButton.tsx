import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  implPrompt: string;
}

export function CopyPromptButton({ implPrompt }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(implPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={handleCopy}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {copied ? "Copied" : "Copy prompt"}
    </Button>
  );
}
