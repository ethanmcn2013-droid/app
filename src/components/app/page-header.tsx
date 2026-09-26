"use client";

import { usePathname } from "next/navigation";
import { useDomain } from "@/lib/domain-context";
import { pageHeaderTitle } from "./page-header-context";

/** Pull the part of the workspace title before " · " for the H1.
 *  e.g. "Q3 Launch · Plays in motion" → "Q3 Launch". */
function shortenTitle(t: string): string {
  const idx = t.indexOf(" · ");
  return idx > 0 ? t.slice(0, idx) : t;
}

/**
 * v3 page header: one title row shared by every utility page (Inbox, My
 * tasks, Settings, Archive). Aligned to the same 1180px page column as
 * Home so the title and the content below start on one edge. Navigation
 * lives in the shell, so there is no drawer button here any more.
 *
 * Tasks draws its own header (src/components/tasks/tasks-header.tsx): the
 * view switch, share, export and print live there, so a utility page can
 * never grow task view tabs or board actions.
 */
export function AppPageHeader({
  description,
  actions,
}: {
  /** Kept for callers that still pass a highlight; titles come from the route. */
  active?: string;
  /** One plain sentence under the title. */
  description?: React.ReactNode;
  /** Page-level actions on the right of the title row. */
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const pack = useDomain();
  const projectName = pack.workspaceName?.trim() || pack.boardName || shortenTitle(pack.workspaceTitle);
  const title = pageHeaderTitle(pathname, projectName);
  const subtitle = description ?? (title === "Settings" ? <>Project · {projectName}</> : null);

  return (
    <header className="mx-auto w-full max-w-[1180px] px-4 pb-2 pt-6 md:px-8 md:pt-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--v3-text)] md:text-[26px]">
            <span className="block truncate">{title}</span>
          </h1>
          {subtitle ? (
            <p className="mt-1 truncate text-[13.5px] text-[color:var(--v3-text-2)]" title={typeof subtitle === "string" ? subtitle : undefined}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
