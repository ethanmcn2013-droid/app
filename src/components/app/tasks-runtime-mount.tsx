import "server-only";

import { isActiveProjectV3Enabled } from "@/lib/projects/flags";
import { PROJECT_URL_PARAM } from "@/lib/projects/project-url";
import { TasksRuntimeShell } from "@/components/app/tasks-runtime-shell";

/**
 * Where the Tasks runtime mounts — D-022, the WP6 boundary move.
 *
 * `TasksRuntimeShell` used to be mounted from nine `layout.tsx` files, and a
 * Next.js layout receives no `searchParams` (`LayoutProps` omits what
 * `PageProps` carries), so `/app/tasks?workspaceId=B` could not render B's
 * board: the shell resolved the ambient Project and the URL was ignored.
 * D-022 moves the mount into the page boundaries, which do receive the URL.
 *
 * ── Why this is a flag branch and not a bare move ──────────────────────────
 *
 * The flag gates presentation and routing, and its off path must stay
 * byte-identical to today (`src/lib/projects/flags.ts`, plan §14.2 — the same
 * discipline `ActiveProjectRuntime` in `src/app/app/layout.tsx` pins with
 * `if (!isActiveProjectV3Enabled()) return children`). A layout survives a
 * navigation inside its own segment; a page does not. Moving the fetch into
 * the pages unconditionally would therefore change what a flag-off user sees,
 * with the flag still off in production:
 *
 *   - Board ↔ List ↔ Schedule ↔ Calendar would unmount and refetch the whole
 *     runtime instead of keeping it mounted, and every provider the shell owns
 *     (board data, palette, detail panel, toasts, focus mode) would lose its
 *     state on a view switch.
 *   - `tasks/loading.tsx` is designed to draw inside the settled chrome
 *     ("chrome exists here, so the wait stays in the content region"); with
 *     the shell inside the page the tracing would paint bare, with no sidebar
 *     around it.
 *   - A shell failure would land in the segment's `error.tsx` instead of the
 *     /app boundary.
 *
 * So exactly one of these two components renders the shell per request,
 * selected by the flag:
 *
 *   - **Flag off** (production today): `TasksRuntimeLayoutMount` renders the
 *     shell from the segment layout, exactly as the nine layouts always have.
 *     The page half returns its children untouched — it does not even read
 *     `searchParams`.
 *   - **Flag on**: the layout half returns children untouched and the page
 *     half mounts the shell, handing it the page's own `?workspaceId=` as
 *     `requestedProjectId`. The shell authorizes it — never trusts it — via
 *     `resolveProjectForRoute`'s explicit branch, so the board can follow the
 *     URL. This is the capability D-025's Studio Bar control switches with.
 *
 * ── Which pages pass `searchParams`, and which deliberately do not ─────────
 *
 * Passing the parameter moves the whole runtime — chrome, palette, and the
 * board data in `TasksProvider` — to the requested Project. That is only
 * coherent where the page's own content moves with it:
 *
 *   - The four Tasks views and `/app/my-tasks` render entirely from the
 *     shell's providers, and `/app/your-work` is user-scoped: pass it.
 *   - `/app/project` and `/app/archived` reads are verified against the
 *     explicit Project by the page itself: pass it.
 *   - An archived `/app/task/[id]` carries its stored, proven Project into
 *     the mount. It never uses an incoming query to choose object authority.
 *     Flag-off mismatches first offer the explicit selection POST.
 *   - `/app/inbox`, `/app/import` and `/app/settings` fetch
 *     their content through the ambient resolution (`requireRouteProjectId`),
 *     (ADR 0001 §9). Handing only their chrome an explicit Project would render B's
 *     chrome over A's content — the exact inequality ADR 0001 §2 calls a
 *     release blocker — so these pages mount the runtime with no parameter
 *     and both halves stay on the ambient Project. None of them is a
 *     `PROJECT_DESTINATION_SURFACES` entry, so the switcher never emits a
 *     `workspaceId` at them.
 */

/**
 * The one member of a page's `searchParams` promise this seam consumes. Next
 * 16 hands pages `searchParams` as a promise; it is awaited here, and only on
 * the flag-on path, so the flag-off tree never touches it.
 */
export type TasksRuntimeSearchParams = Promise<{
  [K in typeof PROJECT_URL_PARAM]?: string | string[];
}>;

/**
 * The layout half. Mounts the Tasks runtime only while the flag is off —
 * byte-identical to the tree the nine layouts have always produced. Flag on,
 * the segment's page owns the mount; rendering the shell here too would fetch
 * the runtime twice and pin the chrome to the ambient Project the page just
 * moved off.
 */
export function TasksRuntimeLayoutMount({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isActiveProjectV3Enabled()) return children;
  return <TasksRuntimeShell>{children}</TasksRuntimeShell>;
}

/**
 * The page half. Flag off it returns children untouched — the layout half is
 * rendering the shell, and reading `searchParams` here would change nothing
 * except opting the page into work nobody consumes. Flag on it mounts the
 * shell with the page's explicit Project, when the page chooses to supply
 * one.
 *
 * A repeated (`string[]`) or malformed value is passed through as absent
 * rather than rejected here: validity is the shell's decision
 * (`parseProjectId` inside `TasksRuntimeShell`, pinned by
 * `route-authz-contract.test.mjs`), and `canonicaliseProjectUrl` already
 * establishes that a repeated explicit Project is not an explicit Project.
 */
export async function TasksRuntimePageMount({
  searchParams,
  snapshotRequestedProjectId,
  children,
}: {
  /**
   * The page's own `searchParams` promise. Omit it on surfaces whose content
   * is resolved ambiently — see the module docblock for the policy.
   */
  searchParams?: TasksRuntimeSearchParams;
  /** Object routes use the stored Project for data, and the actual URL query
   * for snapshot matching. Undefined preserves ordinary query-route behavior. */
  snapshotRequestedProjectId?: string | null;
  children: React.ReactNode;
}) {
  if (!isActiveProjectV3Enabled()) return children;
  const requested = searchParams
    ? (await searchParams)[PROJECT_URL_PARAM]
    : null;
  return (
    <TasksRuntimeShell
      requestedProjectId={typeof requested === "string" ? requested : null}
      snapshotRequestedProjectId={snapshotRequestedProjectId}
    >
      {children}
    </TasksRuntimeShell>
  );
}
