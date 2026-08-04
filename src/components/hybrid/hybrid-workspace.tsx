"use client";

// Production mount for the approved hybrid interior. Renders the verbatim
// OptionHybrid (brief + view bar + view + planning rail) minus its own SuiteRail
// — production's left rail and top header remain, per the founder's spec — and
// backs it with real workspace data through HybridStoreProvider.

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTagDefs, useWorkspaceMembers } from "@/lib/domain-context";
import { useRoomTools } from "@/components/app/room/room-tools-context";
import { TASKS_VIEW_PATHS } from "@/lib/product-urls";
import { HybridStoreProvider } from "./hybrid-store";
import { useLabStore } from "./store";
import { setRuntimeLabels, setRuntimePeople } from "./fixtures";
import { tagToLabel, userToPerson } from "./adapter";
import { OptionHybrid } from "./options/hybrid/option-hybrid";
import { BulkToolbar } from "./shared/bulk-toolbar";
import type { LabLabel, LabPerson, LabRouteState, LabView } from "./types";
import styles from "./hybrid-workspace.module.css";

export type HybridWorkspaceProps = {
  view: LabView;
  people?: LabPerson[];
  labels?: LabLabel[];
};

function Experience({ route, onRouteChange }: { route: LabRouteState; onRouteChange: (patch: Partial<LabRouteState>) => void }) {
  const store = useLabStore();

  // Chrome-level surfaces (command palette via ⌘K, quick-create via "c",
  // and the task detail panel) are production's own, mounted globally in the
  // app layout — the hybrid interior defers to them rather than shipping the
  // lab stubs, so their interaction contracts stay intact. We keep only the
  // two surface-local shortcuts the lab owns: Escape clears a selection, and
  // Enter on the empty surface opens the active/first task's detail panel.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target.matches("input, textarea, select, [contenteditable=true]");
      if (editing) return;
      const onSurface = target === document.body || target.dataset.workSurface === "true";
      if (event.key === "Escape" && store.selectedIds.length > 0 && !store.inspectedId) {
        if (target.closest('[data-task-menu="true"], [role="dialog"]')) return;
        event.preventDefault();
        store.clearSelection();
        return;
      }
      if (event.key === "Enter" && onSurface) {
        const id = store.activeId ?? store.tasks[0]?.id;
        if (id) {
          event.preventDefault();
          store.openTask(id);
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [store]);

  return (
    <div className={styles.root} data-density={route.density} data-task-count={store.tasks.length}>
      <div className={styles.stage}>
        <OptionHybrid hideSuiteRail onRouteChange={onRouteChange} route={route} />
      </div>
      <BulkToolbar />
      <div aria-live="polite" className={styles.srOnly}>{store.announcement}</div>
    </div>
  );
}

export function HybridWorkspace({ view, people, labels }: HybridWorkspaceProps) {
  const router = useRouter();
  const tagDefs = useTagDefs();
  const memberMeta = useWorkspaceMembers();
  // Density lives in the room tools (T·125) so saved views capture and
  // restore it — the panel promises "view, filters, sort, and density".
  const { density, setDensity } = useRoomTools();

  // Populate the runtime registries so avatars/labels resolve to live workspace
  // data on first paint. Labels come from the workspace tag definitions so chips
  // render in their real colours; people come from real workspace members so
  // the assign menu offers colleagues, never design-lab fixtures. Both set
  // unconditionally: an empty workspace roster must read as empty, not fall
  // back to fake people. Idempotent; safe to run each render.
  const resolvedLabels = useMemo<LabLabel[]>(
    () => labels ?? tagDefs.map((tag) => tagToLabel(tag.name, tag.color)),
    [labels, tagDefs],
  );
  const resolvedPeople = useMemo<LabPerson[]>(
    () =>
      people ??
      memberMeta.map((member) =>
        userToPerson(member.id, {
          name: member.name,
          initials: member.initials,
          color: member.color,
          role: member.role === "owner" ? "Owner" : "",
        }),
      ),
    [people, memberMeta],
  );
  setRuntimeLabels(resolvedLabels);
  setRuntimePeople(resolvedPeople);

  const route = useMemo<LabRouteState>(
    () => ({ option: "hybrid", view, dataset: "normal", density, mode: "default", task: null }),
    [density, view],
  );

  const onRouteChange = useCallback(
    (patch: Partial<LabRouteState>) => {
      if (patch.density) setDensity(patch.density);
      if (patch.view && patch.view !== view) {
        router.push(TASKS_VIEW_PATHS[patch.view]);
      }
    },
    [router, view],
  );

  return (
    <HybridStoreProvider>
      <Experience onRouteChange={onRouteChange} route={route} />
    </HybridStoreProvider>
  );
}
