import { Suspense } from "react";
import Link from "next/link";
import { HybridWorkspace } from "@/components/hybrid/hybrid-workspace";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";
import { TemplatedToast } from "@/components/app/templated-toast";
import { VenueWelcomeCard } from "@/components/welcome/venue-welcome-card";
import {
  detectVenueWelcome,
  markVenueEntitlementReached,
} from "@/server/db/venue-welcome";
import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import {
  DEMO_SPONSOR_NAME,
  DEMO_WORKSPACE_SLUG,
} from "@/server/demo/tasks-demo";

export const metadata = { title: "Board · Tasks · Signal Studio" };

/**
 * The neutral refusal. Missing, forbidden, deleted and malformed collapse
 * here — a caller naming a Project they may not open learns nothing about
 * whether it exists (ADR 0001 §4).
 *
 * Renders inside the AMBIENT runtime mount — no `searchParams` — in both
 * flag states: the chrome around a refusal shows the Project the caller
 * actually has open, never the one the URL failed to name.
 */
function ProjectUnavailable() {
  return (
    <TasksRuntimePageMount>
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-[16px] font-semibold text-ink">Project unavailable</div>
        <div className="max-w-[34ch] text-[13px] text-ink-soft">
          This link does not name a project you can open. It may have been
          deleted, or the link is stale.
        </div>
        <Link
          href="/app/home"
          className="mt-2 text-[12.5px] text-ink-quiet underline underline-offset-2 transition-colors hover:text-ink-soft"
        >
          Go to Home
        </Link>
      </div>
    </TasksRuntimePageMount>
  );
}

/**
 * The link names a Project the caller genuinely holds — just not the one the
 * runtime shell above this page loaded.
 *
 * Rendering the board here would put A's tasks under a URL that says B: the
 * exact inequality ADR 0001 §2 calls a release blocker, and the reason the
 * Full Briefing's carried `workspaceId` was worth carrying. The board is
 * withheld and the disagreement is stated instead.
 *
 * With the flag off — production today — it cannot be honoured: the Tasks
 * runtime is fetched by `TasksRuntimeShell`, mounted from `layout.tsx`, and a
 * Next.js layout receives no `searchParams`. With the flag on, D-022's page
 * mount makes the shell CAPABLE of following the parameter, but this
 * withholding deliberately stays until the founder-selected switch control
 * (D-025) is on screen: the card names a project switcher, and honouring the
 * URL before that control exists would trade a stated disagreement for a
 * navigation nobody can see or reverse. Retiring it is the integration step's
 * change, not this one.
 *
 * Like the neutral refusal above, the card renders inside the AMBIENT
 * runtime mount: the chrome shows the Project the caller actually has open,
 * which is what "You have a different project open" refers to.
 */
function ProjectMismatch({ name }: { name: string }) {
  return (
    <TasksRuntimePageMount>
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-[16px] font-semibold text-ink">
          This link opens {name}
        </div>
        <div className="max-w-[36ch] text-[13px] text-ink-soft">
          You have a different project open. Switch to {name} from the project
          switcher to see this board.
        </div>
        <Link
          href="/app/home"
          className="mt-2 text-[12.5px] text-ink-quiet underline underline-offset-2 transition-colors hover:text-ink-soft"
        >
          Go to Home
        </Link>
      </div>
    </TasksRuntimePageMount>
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; workspaceId?: string | string[] }>;
}) {
  const sp = await searchParams;

  // ── WP3 defect 6 / D-014: the destination now consumes `workspaceId` ─────
  //
  // The Full Briefing's link builder emits it
  // (`ledger-task-target.ts:53-57`); this page used to read only `welcome`
  // and drop it, and the shell then fell back to the cookie. So the carried
  // Project was discarded at the last step and the link silently landed on
  // whatever Project happened to be active.
  //
  // Home is the opposite defect and is fixed on the builder side (WP9): it
  // never carries the Project at all. Do not bundle them.
  if (sp.workspaceId !== undefined && !isDemoMode()) {
    const requested = await resolveProjectForRoute(sp.workspaceId);
    if (requested.kind !== "ready" && requested.kind !== "archived") {
      return <ProjectUnavailable />;
    }
    // What the shell above this page actually loaded: the same bare-entry
    // resolution it runs, with no explicit Project.
    const ambient = await resolveProjectForRoute(undefined);
    const ambientId =
      ambient.kind === "ready" || ambient.kind === "archived"
        ? ambient.workspaceId
        : null;
    if (ambientId !== requested.workspaceId) {
      return <ProjectMismatch name={requested.name} />;
    }
  }

  let venue: { sponsorName: string; sponsorSlug: string } | null = null;
  if (sp.welcome === "venue") {
    if (isDemoMode()) {
      venue = {
        sponsorName: DEMO_SPONSOR_NAME,
        sponsorSlug: DEMO_WORKSPACE_SLUG,
      };
    } else {
      const me = await getCurrentUser();
      venue = await detectVenueWelcome(me);
      if (venue) {
        await markVenueEntitlementReached(me);
      }
    }
  }

  // The board itself follows the URL: the page mount hands the shell this
  // page's own `workspaceId`. While the withholding above is in force the
  // parameter can only ever equal the ambient resolution by the time this
  // renders, so flag-on behaviour is unchanged until the mismatch state is
  // retired — at which point the shell simply follows the link.
  return (
    <TasksRuntimePageMount searchParams={searchParams}>
      <HybridWorkspace view="board" />
      <Suspense fallback={null}>
        <TemplatedToast />
      </Suspense>
      {venue ? (
        <VenueWelcomeCard
          sponsorName={venue.sponsorName}
          sponsorSlug={venue.sponsorSlug}
        />
      ) : null}
    </TasksRuntimePageMount>
  );
}
