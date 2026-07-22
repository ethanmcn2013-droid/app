"use client";

import { useState } from "react";

export function PublicUrlChip({ url }: { url: string }) {
  const display = url.replace(/^https?:\/\//, "");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <span
        className="font-mono text-xs"
        style={{ color: "var(--ink-quiet)" }}
      >
        {display}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy public link"}
        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
        style={{
          borderColor: "var(--border)",
          color: copied ? "var(--status-done)" : "var(--ink-soft)",
          background: "var(--bg-elev)",
        }}
      >
        {copied ? (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12l5 5 9-11" />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
            Copy link
          </>
        )}
      </button>
    </div>
  );
}
