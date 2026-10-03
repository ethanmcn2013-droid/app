"use client";

import { useState, useTransition } from "react";
import { SectionHeader } from "../settings-app";
import { Callout, SettingsGroup, SettingsRow, cx, ui } from "../settings-ui";

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
        title="Privacy and data"
        description="Download a copy of everything we hold for you, or delete your account for good."
      />

      {/* Export */}
      <SettingsGroup>
        <SettingsRow
          label="Export your data"
          description="A complete JSON file of your profile, every project you own, all tasks and notes, and your footprint in shared projects. Attachment files are not included, only their details."
        >
          <a
            href="/api/account/export"
            download
            className={ui.button}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 2.5v7.5M4.75 6.75 8 10l3.25-3.25M3 13.25h10" />
            </svg>
            Download export
          </a>
        </SettingsRow>
      </SettingsGroup>

      {/* Delete account */}
      <SettingsGroup
        title="Delete account"
        description="This permanently deletes your sign-in account and all personal data. Projects you own are deleted too. This cannot be undone."
        tone="danger"
      >
        <div className="px-4 py-4 md:px-5">
          <label htmlFor="delete-account-confirm" className="block text-[13.5px] font-medium text-[color:var(--v3-text)]">
            Type your email address to confirm
          </label>
          <p className="mt-0.5 text-[12.5px] text-[color:var(--v3-text-2)]">
            <span className="font-mono text-[12px] text-[color:var(--v3-text)]">{userEmail}</span>
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="delete-account-confirm"
              type="email"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setDeleteError(null);
              }}
              placeholder={userEmail}
              disabled={pending}
              autoComplete="off"
              className={cx(ui.input, "sm:max-w-[320px]")}
            />
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || pending}
              className={ui.dangerSolid}
            >
              {pending ? "Deleting account…" : "Delete account permanently"}
            </button>
          </div>

          {deleteError ? (
            <div className="mt-3">
              <Callout tone="danger" role="alert">
                <div className="flex items-start gap-3">
                  <p className="flex-1">{deleteError}</p>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!canDelete || pending}
                    className={ui.danger}
                  >
                    Retry
                  </button>
                </div>
              </Callout>
            </div>
          ) : null}
        </div>
      </SettingsGroup>
    </div>
  );
}
