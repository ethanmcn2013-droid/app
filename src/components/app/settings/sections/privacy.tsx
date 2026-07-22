"use client";

import { useState, useTransition } from "react";
import { SectionHeader } from "../settings-app";

export function PrivacySection({ userEmail }: { userEmail: string }) {
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canDelete = confirmText === userEmail;

  function handleDelete() {
    if (!canDelete) return;
    setDeleteError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/account/delete", { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg =
            typeof body?.message === "string"
              ? body.message
              : `Request failed with status ${res.status}.`;
          setDeleteError(msg);
          return;
        }
        // On success, redirect to the marketing root. Do NOT optimistically
        // redirect before the 200 — the server must confirm deletion first.
        window.location.href = "/";
      } catch (e) {
        setDeleteError((e as Error).message ?? "An unexpected error occurred.");
      }
    });
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Privacy and data"
        title="Your data"
        description="Export a copy of everything we hold for you, or permanently delete your account."
      />

      {/* Export */}
      <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
        <div className="text-[14px] font-semibold text-ink">Export your data</div>
        <p className="mt-1 max-w-[560px] text-[12.5px] leading-[1.55] text-ink-soft">
          Downloads a complete JSON file of your profile, every workspace you
          own, all tasks and notes, and your footprint in shared workspaces.
          Attachment bytes are not included, only metadata.
        </p>
        <div className="mt-4">
          <a
            href="/api/account/export"
            download
            className="inline-block rounded-full border border-line bg-white px-4 py-1.5 text-[12.5px] font-medium text-ink-soft shadow-sm hover:border-ink-soft/30 hover:text-ink"
          >
            Download export
          </a>
        </div>
      </div>

      {/* Delete account */}
      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/40 p-5">
        <div className="text-[14px] font-semibold text-rose-800">
          Delete account
        </div>
        <p className="mt-1 max-w-[560px] text-[12.5px] leading-[1.55] text-rose-700/80">
          This permanently deletes your sign-in account and all personal data.
          Workspaces you own are deleted too. This cannot be undone.
        </p>

        <div className="mt-4">
          <label className="block text-[12px] font-medium text-rose-700">
            Type your email address to confirm
          </label>
          <p className="mt-0.5 text-[11.5px] text-rose-600/70">
            {userEmail}
          </p>
          <input
            type="email"
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value);
              setDeleteError(null);
            }}
            placeholder={userEmail}
            disabled={pending}
            className="mt-2 w-full max-w-sm rounded-md border border-rose-300 bg-white px-3 py-1.5 text-[13px] text-ink shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:opacity-60"
          />
        </div>

        {deleteError ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="flex-1 text-[12px] leading-[1.55] text-rose-700">
              {deleteError}
            </p>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || pending}
              className="flex-shrink-0 rounded-full border border-rose-300 bg-white px-3 py-1 text-[11.5px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || pending}
            className="rounded-full bg-rose-600 px-4 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Deleting account..." : "Delete account permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
