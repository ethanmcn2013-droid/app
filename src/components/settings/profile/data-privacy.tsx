/**
 * Account export stays reachable outside the project-bound Tasks shell.
 * A native download uses the existing authenticated, private/no-store endpoint;
 * Next navigation/prefetch and an active project are not prerequisites.
 */
export function DataPrivacy() {
  return (
    <div className="mt-10 rounded-lg border border-line-soft bg-bg-elevated p-5">
      <h2 className="text-[14px] font-semibold tracking-tight text-ink">
        Data and privacy
      </h2>
      <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.6] text-ink-quiet">
        Download your account data as JSON, including your owned projects and
        personal Notes. Uploaded files and Google Drive file contents are not
        included. Any unavailable sections are marked in the download.
      </p>
      <div className="mt-3">
        <a
          href="/api/account/export"
          download
          className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-bg-elevated px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-bg-sunken/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Download account JSON
        </a>
      </div>
    </div>
  );
}
