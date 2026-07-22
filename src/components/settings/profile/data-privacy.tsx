"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * Data & Privacy section for the profile settings page.
 *
 * Provides a "Download my data" action that hits GET /api/account/export,
 * which returns a JSON file containing everything the Signal Studio suite
 * holds for the signed-in user across Tasks, Notes, Timeline, and Signal.
 * The browser's native download mechanism handles the file save.
 */
export function DataPrivacy() {
  const { user } = useUser();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    setError(null);
    setDone(false);

    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.message ?? `Export failed (${res.status}). Try again.`,
        );
      }

      // Derive the filename from the Content-Disposition header if present,
      // otherwise build one from the current date and user id.
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const date = new Date().toISOString().slice(0, 10);
      const clerkId = user?.id ?? "unknown";
      const filename =
        match?.[1] ?? `signal-export-${clerkId}-${date}.json`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mt-10 rounded-lg border border-line-soft bg-white p-5">
      <h2 className="text-[14px] font-semibold tracking-tight text-ink">
        Data and privacy
      </h2>
      <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.6] text-ink-quiet">
        Download a copy of everything Signal Studio holds for your account
        across Tasks, Notes, Timeline, and Signal. The file is JSON and
        includes your profile, workspaces, notes, and preferences. OAuth
        tokens and internal credentials are not included.
      </p>
      <div className="mt-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-bg-sunken/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? "Preparing download..." : "Download my data"}
        </button>
      </div>
      {done && !error ? (
        <p className="mt-2 text-[12px] text-ink-quiet">
          Your data file is ready. Check your downloads folder.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-[12px] text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
