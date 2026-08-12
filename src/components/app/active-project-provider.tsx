"use client";

/**
 * Shared Active Project provider — plan §3.4 and §3.5.
 *
 * ── Why this shape, and not the obvious one ────────────────────────────────
 *
 * A Next.js layout persists across navigation and, by design, never receives
 * updated search parameters: it is not re-rendered on a client-side transition,
 * so a `searchParams` prop on it would go stale silently (Next.js
 * `useSearchParams` reference, "Layouts").  The provider therefore cannot learn
 * the Active Project from the layout's props.
 *
 * The tempting fix — calling the search-params hook in the provider itself —
 * is the trap. That hook client-side-renders the whole Client Component tree
 * up to the nearest Suspense boundary; called from a provider that wraps the
 * entire `/app` shell, that is a full-route client-render bailout of every
 * signed-in surface.
 *
 * So the hook is quarantined in `ActiveProjectUrlBridge`: a component that
 * renders nothing, sits under its own explicit `<Suspense>`, and exists only
 * to publish the live route into provider state. The bailout it can cause is
 * bounded to a component with no output.
 *
 * ── What may be painted, and when ──────────────────────────────────────────
 *
 * Authority is the server's. The provider holds three things and no more:
 *
 *   - the live route (from the bridge) — a *neutral pending hint* only. Raw
 *     client `workspaceId` never supplies a Project name, capability or data
 *     scope;
 *   - the committed snapshot (from `ActiveProjectRouteSync`) — the only source
 *     that may be painted, because it is the Project the server verified for
 *     this exact route;
 *   - a bootstrap Project id from the validated cookie — used for a pending
 *     destination hint and nothing else. On a cold direct URL for B it is
 *     never painted: showing cookie-fallback A there is precisely the
 *     wrong-Project substitution this wave exists to remove.
 *
 * State lives in one reducer rather than several `useState` pairs plus mirror
 * refs. That is not tidiness: the commit rule has to see the live transition
 * and the committed snapshot *together and atomically*, and reading a mirror
 * ref during render is exactly the pattern this repo's `react-hooks/refs` rule
 * refuses.
 */

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useTransition,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ProjectId, ProjectSummary } from "@/lib/projects/project-ref";
import { parseProjectId } from "@/lib/projects/project-ref";
import { PROJECT_URL_PARAM, type ProjectDestination } from "@/lib/projects/project-url";
import {
  chromeFor,
  initialActiveProjectState,
  reduceActiveProject,
  routeKey,
  type ActiveProjectPending,
  type ChromeProjection,
  type LiveTransition,
  type RouteSnapshot,
} from "@/lib/projects/route-snapshot";
import { switchActiveProjectAction } from "@/server/actions/active-project";

export type { ActiveProjectPending };

export type ActiveProjectContextValue = Readonly<{
  /** False when `SIGNAL_ACTIVE_PROJECT_V3_ENABLED` is off. */
  enabled: boolean;
  live: LiveTransition;
  /** What the chrome is allowed to paint right now. */
  chrome: ChromeProjection;
  pending: ActiveProjectPending | null;
  /** Set after a failed switch: `Couldn't open B. You're still in A.` */
  lastError: string | null;
  /** Publish a server-verified snapshot. The reducer decides whether it commits. */
  publishSnapshot: (snapshot: RouteSnapshot) => void;
  /**
   * Synchronous selection guard. Returns false when a switch is already
   * pending — see the note on `pendingRef` below.
   */
  selectProject: (
    project: Pick<ProjectSummary, "id" | "name">,
    destination: ProjectDestination,
  ) => boolean;
}>;

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

export function useActiveProject(): ActiveProjectContextValue | null {
  return useContext(ActiveProjectContext);
}

/**
 * The quarantined hook. Renders nothing; publishes the live route.
 *
 * The Suspense fallback around it is deliberately `null`: this component
 * paints no pixels, so a fallback with geometry would introduce the very
 * layout shift a "stable chrome fallback" is meant to prevent. Stability comes
 * from the other end — while no verified snapshot matches the live route,
 * `chrome` reports `skeleton` and the Project trigger renders at a fixed width
 * (`ACTIVE_PROJECT_TRIGGER_SKELETON_WIDTH`). The chrome never collapses, and
 * it never guesses.
 */
function ActiveProjectUrlBridge({
  onRoute,
}: {
  onRoute: (pathname: string, workspaceId: ProjectId | null) => void;
}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const workspaceId = parseProjectId(searchParams?.get(PROJECT_URL_PARAM));

  useEffect(() => {
    onRoute(pathname, workspaceId);
  }, [onRoute, pathname, workspaceId]);

  return null;
}

/** Fixed width so the Project trigger holds its place while unverified. */
export const ACTIVE_PROJECT_TRIGGER_SKELETON_WIDTH = 168;

export function ActiveProjectProvider({
  enabled,
  bootstrapProjectId,
  children,
}: {
  enabled: boolean;
  /**
   * Shape-validated cookie value from the server. Cheap by contract: the
   * `/app` shell must not run a membership query to render chrome. Because the
   * projection never paints it, an unauthorized or stale value is inert.
   */
  bootstrapProjectId: string | null;
  children: React.ReactNode;
}) {
  const bootstrap = useMemo(
    () => parseProjectId(bootstrapProjectId),
    [bootstrapProjectId],
  );

  const [state, dispatch] = useReducer(
    reduceActiveProject,
    undefined,
    initialActiveProjectState,
  );

  const [, startTransition] = useTransition();

  /**
   * The synchronous half of the one-selection guard (plan §3.5 step 1).
   *
   * State is not sufficient here. Two clicks inside one React batch both read
   * the pre-batch `pending`, both dispatch, and two `Set-Cookie` responses race
   * — which is the multi-click race this action was written to remove. A ref
   * mutated in the event handler, before any `await`, is the only thing that
   * serializes them. It is never read or written during render.
   */
  const pendingRef = useRef(false);

  const onRoute = useCallback(
    (pathname: string, workspaceId: ProjectId | null) => {
      dispatch({ type: "route", routeKey: routeKey(pathname, workspaceId) });
    },
    [],
  );

  const publishSnapshot = useCallback((snapshot: RouteSnapshot) => {
    dispatch({ type: "snapshot", snapshot });
  }, []);

  const selectProject = useCallback(
    (
      project: Pick<ProjectSummary, "id" | "name">,
      destination: ProjectDestination,
    ): boolean => {
      // Synchronous. Everything below this line may be batched; this may not.
      if (pendingRef.current) return false;
      pendingRef.current = true;

      // Step 2: the trigger reads `Opening <B>…` while committed A stays
      // visibly A. The provider never relabels A's data as B.
      dispatch({
        type: "select-started",
        pending: { projectId: project.id, label: `Opening ${project.name}…` },
      });

      const fail = (message: string) => {
        pendingRef.current = false;
        dispatch({ type: "select-failed", message });
      };

      startTransition(() => {
        void (async () => {
          try {
            const result = await switchActiveProjectAction({
              workspaceId: project.id,
              destination,
            });
            // A successful switch redirects and never returns.
            fail(
              result.reason === "archived"
                ? `${project.name} is archived. Open it read-only from Archived.`
                : `Couldn't open ${project.name}. You're still in the current project.`,
            );
          } catch {
            fail(
              `Couldn't open ${project.name}. You're still in the current project.`,
            );
          }
        })();
      });

      return true;
    },
    [],
  );

  const chrome = useMemo(
    () => chromeFor(state, bootstrap),
    [state, bootstrap],
  );

  const value = useMemo<ActiveProjectContextValue>(
    () => ({
      enabled,
      live: state.live,
      chrome,
      pending: state.pending,
      lastError: state.lastError,
      publishSnapshot,
      selectProject,
    }),
    [
      enabled,
      state.live,
      state.pending,
      state.lastError,
      chrome,
      publishSnapshot,
      selectProject,
    ],
  );

  return (
    <ActiveProjectContext.Provider value={value}>
      <Suspense fallback={null}>
        <ActiveProjectUrlBridge onRoute={onRoute} />
      </Suspense>
      {children}
    </ActiveProjectContext.Provider>
  );
}
