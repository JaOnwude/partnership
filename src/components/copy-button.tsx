"use client";

import { useState } from "react";
import { btn } from "./ui";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked on insecure origins; the text is still visible to copy by hand.
    }
  }

  return (
    <button type="button" onClick={copy} className={btn}>
      {copied ? "Copied ✓" : label}
    </button>
  );
}
