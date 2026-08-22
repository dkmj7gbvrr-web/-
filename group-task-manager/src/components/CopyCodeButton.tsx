"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードAPIが使えない環境では何もしない
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleCopy} className="shrink-0">
      {copied ? "コピーしました" : "コピー"}
    </Button>
  );
}
