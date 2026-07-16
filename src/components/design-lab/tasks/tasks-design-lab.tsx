"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { tasksForDataset } from "./fixtures";
import { replaceLabRoute } from "./query";
import { LabStoreProvider, useLabStore } from "./store";
import type { LabRouteState } from "./types";
import { OptionA } from "./options/a/option-a";
import { OptionB } from "./options/b/option-b";
import { OptionC } from "./options/c/option-c";
import { BulkToolbar } from "./shared/bulk-toolbar";
import { CommandPalette } from "./shared/command-palette";
import { LabRibbon } from "./shared/lab-chrome";
import { TaskInspector } from "./shared/task-inspector";
import { Icon } from "./shared/icons";
import styles from "./tasks-design-lab.module.css";

function LabExperience({ route, onRouteChange }: { route: LabRouteState; onRouteChange: (patch: Partial<LabRouteState>) => void }) {
  const store = useLabStore();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const markHydrated = useCallback((node: HTMLElement | null) => {
    if (node) node.dataset.hydrated = "true";
  }, []);

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
        if (inSurface && !store.readOnly) { event.preventDefault(); store.addTask("queued"); }
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

  const option = route.option === "a" ? <OptionA onRouteChange={onRouteChange} route={route} />
    : route.option === "b" ? <OptionB onRouteChange={onRouteChange} route={route} />
      : <OptionC onRouteChange={onRouteChange} route={route} />;

  return (
    <main className={styles.labRoot} data-density={route.density} data-mode={route.mode} data-task-count={store.tasks.length} ref={markHydrated}>
      <LabRibbon onRouteChange={onRouteChange} route={route} />
      <div className={styles.optionStage}>{option}</div>
      {route.mode === "loading" ? <div aria-label="Loading design-lab state" className={styles.stateOverlay}><div className={styles.loadingCard}><span /><span /><span /><p>Loading workspace tasks…</p></div></div> : null}
      {route.mode === "error" ? <div className={styles.stateOverlay}><div className={styles.errorCard} role="alert"><Icon name="dependency" size={22} /><h2>Workspace tasks could not be loaded</h2><p>The deterministic error state leaves the shell available and never substitutes empty data.</p><button onClick={() => onRouteChange({ mode: "default" })} type="button">Retry fixture</button></div></div> : null}
      <TaskInspector />
      <BulkToolbar />
      <CommandPalette onClose={() => setPaletteOpen(false)} open={paletteOpen} />
      {store.undo ? <div className={styles.undoToast} role="status"><span>{store.announcement}</span><button onClick={store.undoLast} type="button"><Icon name="undo" size={14} />Undo</button></div> : null}
      <div aria-live="polite" className={styles.srOnly}>{store.announcement}</div>
    </main>
  );
}

export function TasksDesignLab({ initialRoute }: { initialRoute: LabRouteState }) {
  const [route, setRoute] = useState(initialRoute);
  const tasks = useMemo(() => route.mode === "empty" ? [] : tasksForDataset(route.dataset), [route.dataset, route.mode]);
  useEffect(() => replaceLabRoute(route), [route]);
  const onRouteChange = useCallback((patch: Partial<LabRouteState>) => {
    setRoute((current) => {
      const next = { ...current, ...patch };
      if (patch.dataset || patch.mode) next.task = null;
      return next;
    });
  }, []);
  const onInspectedChange = useCallback((task: string | null) => onRouteChange({ task }), [onRouteChange]);
  return (
    <LabStoreProvider
      initialInspectedId={route.task}
      initialTasks={tasks}
      key={`${route.dataset}:${route.mode}`}
      onInspectedChange={onInspectedChange}
      readOnly={route.mode === "readonly"}
    >
      <LabExperience onRouteChange={onRouteChange} route={route} />
    </LabStoreProvider>
  );
}
