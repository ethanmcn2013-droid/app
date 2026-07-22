import Link from "next/link";

/**
 * Data and privacy pointer.
 *
 * Export and account deletion live on the primary settings surface at
 * /app/settings, under the "Privacy and data" tab (Phase 4.2). Both actions
 * there hit the same cross-module endpoints (/api/account/export and
 * /api/account/delete), which cover Tasks, Notes, Timeline, and Signal. This
 * profile page keeps a single quiet pointer to that surface instead of a
 * second set of controls, so there is one place to export or delete.
 */
export function DataPrivacy() {
  return (
    <div className="mt-10 rounded-lg border border-line-soft bg-white p-5">
      <h2 className="text-[14px] font-semibold tracking-tight text-ink">
        Data and privacy
      </h2>
      <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.6] text-ink-quiet">
        Export a copy of everything Signal Studio holds for your account, or
        delete your account, from the Privacy and data tab in Settings. The
        export and deletion both cover Tasks, Notes, Timeline, and Signal.
      </p>
      <div className="mt-3">
        <Link
          href="/app/settings"
          className="inline-flex rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-bg-sunken/60"
        >
          Open Privacy and data
        </Link>
      </div>
    </div>
  );
}
