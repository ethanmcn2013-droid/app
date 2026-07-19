"use client";

// Production mount for the approved hybrid interior. Renders the verbatim
// OptionHybrid (brief + view bar + view + planning rail) minus its own SuiteRail
// — production's left rail and top header remain, per the founder's spec — and
// backs it with real workspace data through HybridStoreProvider.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTagDefs } from "@/lib/domain-context";
import { HybridStoreProvider } from "./hybrid-store";
import { useLabStore } from "./store";
import { setRuntimeLabels, setRuntimePeople } from "./fixtures";
import { tagToLabel } from "./adapter";
import { OptionHybrid } from "./options/hybrid/option-hybrid";
import { BulkToolbar } from "./shared/bulk-toolbar";
import { CommandPalette } from "./shared/command-palette";
import { TaskInspector } from "./shared/task-inspector";
import type { LabDensity, LabLabel, LabPerson, LabRouteState, LabView } from "./types";
import styles from "./hybrid-workspace.module.css";

export type HybridWorkspaceProps = {
  view: LabView;
  people?: LabPerson[];
  labels?: LabLabel[];
};

function Experience({ route, onRouteChange }: { route: LabRouteState; onRouteChange: (patch: Partial<LabRouteState>) => void }) {
  const store = useLabStore();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target.matches("input, textarea, select, [contenteditable=true]");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (!editing && event.key.toLowerCase() === "c" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const inSurface = target === document.body || target.dataset.workSurface === "true";
        if (inSurface && !store.readOnly) {
          event.preventDefault();
          store.addTask("queued");
        }
      }
      if (!editing && event.key === "Escape" && store.selectedIds.length > 0 && !store.inspectedId) {
        if (target.closest('[data-task-menu="true"], [aria-label="Task command palette"]')) return;
        event.preventDefault();
        store.clearSelection();
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
      <TaskInspector />
      <BulkToolbar />
      <CommandPalette onClose={() => setPaletteOpen(false)} open={paletteOpen} />
      <div aria-live="polite" className={styles.srOnly}>{store.announcement}</div>
    </div>
  );
}

export function HybridWorkspace({ view, people, labels }: HybridWorkspaceProps) {
  const router = useRouter();
  const tagDefs = useTagDefs();
  const [density, setDensity] = useState<LabDensity>("compact");

  // Populate the runtime registries so avatars/labels resolve to live workspace
  // data on first paint. Labels come from the workspace tag definitions so chips
  // render in their real colours. Idempotent; safe to run each render.
  const resolvedLabels = useMemo<LabLabel[]>(
    () => labels ?? tagDefs.map((tag) => tagToLabel(tag.name, tag.color)),
    [labels, tagDefs],
  );
  setRuntimeLabels(resolvedLabels);
  if (people) setRuntimePeople(people);

  const route = useMemo<LabRouteState>(
    () => ({ option: "hybrid", view, dataset: "normal", density, mode: "default", task: null }),
    [density, view],
  );

  const onRouteChange = useCallback(
    (patch: Partial<LabRouteState>) => {
      if (patch.density) setDensity(patch.density);
      if (patch.view && patch.view !== view) router.push(`/app/${patch.view}`);
    },
    [router, view],
  );

  return (
    <HybridStoreProvider>
      <Experience onRouteChange={onRouteChange} route={route} />
    </HybridStoreProvider>
  );
}
