"use client";

/**
 * Studio Bar chrome plumbing (T·94).
 *
 * The Studio Bar renders at the synchronous layout level so the black
 * frame paints instantly and never re-blanks (the same monotonic-reveal
 * contract SuiteChrome held, LOADING_SYSTEM.md §4). But its live cells —
 * workspace switcher, scope capsule — need auth-gated data that resolves
 * inside <AppShell>, and its actions — command field, create — must reach
 * providers (PaletteRoot, AddTaskRoot) that mount inside AppShell too.
 *
 * Two one-way bridges solve both without moving the bar into the
 * Suspense boundary:
 *
 *   data  → StudioChromeProvider holds state above the bar;
 *           StudioChromePublisher (mounted in the Tasks runtime) fills it
 *           after server data resolves. Module identity is pathname-owned
 *           and remains visible even when this optional Tasks data is null.
 *   action → the bar dispatches window CustomEvents; StudioChromeBridge
 *           (mounted inside PaletteRoot + AddTaskRoot) listens and calls
 *           the real openers. Same pub/sub grammar as ToastBridge and
 *           SuiteContextPublisher.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePalette } from "@/components/app/palette/command-palette";
import { useAddTask } from "@/components/app/add-task/add-task-context";

export type StudioWorkspaceOption = Readonly<{ id: string; name: string }>;

export type StudioChromeData = Readonly<{
  workspaces: readonly StudioWorkspaceOption[];
  activeWorkspaceId: string;
  /** Planning-period name for the scope capsule; null when none. */
  periodName: string | null;
  /** Short workspace title (before " · ") for the scope capsule. */
  workspaceTitle: string;
  /** Licence edition label for the header slot (Phase 1). Null when the
   *  account holds no named edition — the slot then renders nothing.
   *  Bound to real entitlement data via editionLabel(); never hardcoded. */
  edition: string | null;
}>;

type Ctx = {
  data: StudioChromeData | null;
  setData: (data: StudioChromeData | null) => void;
};

const StudioChromeContext = createContext<Ctx | null>(null);

export const STUDIO_PALETTE_EVENT = "studio-bar:palette";
export const STUDIO_CREATE_EVENT = "studio-bar:create";

export function StudioChromeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StudioChromeData | null>(null);
  const value = useMemo(() => ({ data, setData }), [data]);
  return (
    <StudioChromeContext.Provider value={value}>
      {children}
    </StudioChromeContext.Provider>
  );
}

export function useStudioChrome(): Ctx {
  const v = useContext(StudioChromeContext);
  if (!v) {
    throw new Error("useStudioChrome must be inside <StudioChromeProvider>");
  }
  return v;
}

/** Pull the part of the workspace title before " · " for the capsule. */
function shortenTitle(t: string): string {
  const idx = t.indexOf(" · ");
  return idx > 0 ? t.slice(0, idx) : t;
}

/**
 * Mounted inside the Tasks runtime once its authorised server data resolves.
 * The workspace identity comes from the real workspace row; domain packs are
 * vocabulary, never a source of account identity.
 */
export function StudioChromePublisher({
  workspaces,
  activeWorkspaceId,
  periodName,
  workspaceTitle,
  edition = null,
}: {
  workspaces: readonly StudioWorkspaceOption[];
  activeWorkspaceId: string;
  periodName: string | null;
  /** The authorised workspace's real name, not a domain-pack example. */
  workspaceTitle: string;
  /** Licence edition label; null when the account has no named edition. */
  edition?: string | null;
}) {
  const { setData } = useStudioChrome();
  const shortWorkspaceTitle = shortenTitle(workspaceTitle);
  useEffect(() => {
    setData({
      workspaces,
      activeWorkspaceId,
      periodName,
      workspaceTitle: shortWorkspaceTitle,
      edition,
    });
    return () => {
      // Tasks is the only product that publishes this optional workspace
      // metadata. Clear it when that runtime unmounts so an edition or scope
      // from Tasks can never leak into Notes, Timeline, or Signal.
      setData(null);
    };
  }, [
    setData,
    workspaces,
    activeWorkspaceId,
    periodName,
    shortWorkspaceTitle,
    edition,
  ]);
  return null;
}

/**
 * Mounted inside PaletteRoot + AddTaskRoot. Turns the bar's window
 * events into real opens.
 */
export function StudioChromeBridge() {
  const { openPalette } = usePalette();
  const { openDialog } = useAddTask();
  useEffect(() => {
    const onPalette = (e: Event) => {
      const query = (e as CustomEvent<{ query?: string }>).detail?.query;
      openPalette(query ?? "");
    };
    const onCreate = () => openDialog();
    window.addEventListener(STUDIO_PALETTE_EVENT, onPalette);
    window.addEventListener(STUDIO_CREATE_EVENT, onCreate);
    return () => {
      window.removeEventListener(STUDIO_PALETTE_EVENT, onPalette);
      window.removeEventListener(STUDIO_CREATE_EVENT, onCreate);
    };
  }, [openPalette, openDialog]);
  return null;
}
