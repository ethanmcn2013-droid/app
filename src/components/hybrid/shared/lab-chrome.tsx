"use client";

import { DATASET_LABELS, LAB_DATASETS, LAB_MODES, LAB_OPTIONS, MODE_LABELS, OPTION_LABELS, VIEW_LABELS, LAB_VIEWS, type LabRouteState } from "../types";
import { FIXTURE_MANIFEST_ID, FIXTURE_SHA256 } from "../fixtures";
import { useLabStore } from "../store";
import { Icon } from "./icons";
import styles from "./shared.module.css";

const VIEW_PURPOSES: Record<LabRouteState["view"], string> = {
  board: "Move and prioritize work by status",
  list: "Scan and edit operational task fields",
  timeline: "Plan dated work and explicit unscheduled tasks",
  calendar: "Review commitments by day, week, or agenda",
};

export function LabRibbon({ route, onRouteChange }: { route: LabRouteState; onRouteChange: (patch: Partial<LabRouteState>) => void }) {
  const store = useLabStore();
  return (
    <header className={styles.labRibbon}>
      <div className={styles.labIdentity}>
        <span className={styles.labMark}><Icon name="spark" size={15} /></span>
        <span><strong>Tasks design lab</strong><small>Phase 1 · non-persistent comparison</small></span>
      </div>
      <div aria-label="Design options" className={styles.segmented} role="group">
        {LAB_OPTIONS.map((option) => (
          <button aria-pressed={route.option === option} key={option} onClick={() => onRouteChange({ option })} type="button">
            <b>{option.toUpperCase()}</b><span>{OPTION_LABELS[option]}</span>
          </button>
        ))}
      </div>
      <div className={styles.labSelectors}>
        <label>
          <span>Dataset</span>
          <select aria-label="Dataset" onChange={(event) => onRouteChange({ dataset: event.target.value as LabRouteState["dataset"] })} value={route.dataset}>
            {LAB_DATASETS.map((dataset) => <option key={dataset} value={dataset}>{DATASET_LABELS[dataset]}</option>)}
          </select>
        </label>
        <label>
          <span>State</span>
          <select aria-label="State mode" onChange={(event) => onRouteChange({ mode: event.target.value as LabRouteState["mode"] })} value={route.mode}>
            {LAB_MODES.map((mode) => <option key={mode} value={mode}>{MODE_LABELS[mode]}</option>)}
          </select>
        </label>
        <button className={styles.resetButton} onClick={() => { store.reset(); store.openTask(null); }} type="button"><Icon name="redo" size={14} />Reset</button>
      </div>
      <div className={styles.labTruth} title={`Fixture ${FIXTURE_MANIFEST_ID} · sha256 ${FIXTURE_SHA256}`}>
        <span aria-hidden="true" /> Local lab · session-only · reload resets
      </div>
    </header>
  );
}

export function ViewTabs({ route, onRouteChange, className = "" }: { route: LabRouteState; onRouteChange: (patch: Partial<LabRouteState>) => void; className?: string }) {
  return (
    <nav aria-label="Workspace views" className={`${styles.viewTabs} ${className}`}>
      {LAB_VIEWS.map((view) => (
        <button aria-current={route.view === view ? "page" : undefined} key={view} onClick={() => onRouteChange({ view })} title={VIEW_PURPOSES[view]} type="button">
          <Icon name={view} size={15} />{VIEW_LABELS[view]}
        </button>
      ))}
    </nav>
  );
}

export function ViewTools({
  route,
  onRouteChange,
  children,
  searchValue = "",
  onSearchChange,
  onFilter,
  onSort,
  onFields,
}: {
  route: LabRouteState;
  onRouteChange: (patch: Partial<LabRouteState>) => void;
  children?: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onFilter?: () => void;
  onSort?: () => void;
  onFields?: () => void;
}) {
  const store = useLabStore();
  const viewKey = `${route.view}:${route.dataset}:${route.density}`;
  const saved = store.savedViewKeys.includes(viewKey);
  return (
    <div className={styles.viewTools}>
      <label className={styles.searchBox}>
        <Icon name="search" size={15} /><span className={styles.srOnly}>Search this view</span>
        <input aria-label="Search this view" disabled={!onSearchChange} onChange={(event) => onSearchChange?.(event.target.value)} placeholder={onSearchChange ? "Search" : "Search unavailable"} type="search" value={searchValue} />
        <kbd>/</kbd>
      </label>
      <button disabled={!onFilter} onClick={onFilter} title={onFilter ? "Filter this view" : "No filter control in this option"} type="button"><Icon name="filter" size={15} />Filter</button>
      <button disabled={!onSort} onClick={onSort} title={onSort ? "Sort this view" : "No sort control in this option"} type="button"><Icon name="sort" size={15} />Sort</button>
      <button disabled={!onFields} onClick={onFields} title={onFields ? "Choose visible fields" : "No field control in this option"} type="button"><Icon name="fields" size={15} />Fields</button>
      <label className={styles.compactSelect}>
        <span className={styles.srOnly}>Density</span><Icon name="density" size={15} />
        <select aria-label="Density" onChange={(event) => onRouteChange({ density: event.target.value as LabRouteState["density"] })} value={route.density}>
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
        </select>
      </label>
      {children}
      <button aria-pressed={saved} onClick={() => store.saveView(viewKey)} title="Saved only in this mounted session" type="button">{saved ? "Saved" : "Save view"} <span className={styles.localTag}>local</span></button>
    </div>
  );
}

export function SuiteRail({ active = "workspace" }: { active?: string }) {
  return (
    <aside aria-label="Workspace navigation" className={styles.suiteRail}>
      <a className={styles.signalWordmark} href="#" onClick={(event) => event.preventDefault()}><span>S</span><b>Signal Studio</b></a>
      <nav>
        <a href="#" onClick={(event) => event.preventDefault()}><Icon name="inbox" size={17} />Inbox <small>4</small></a>
        <a href="#" onClick={(event) => event.preventDefault()}><Icon name="agenda" size={17} />My week</a>
        <a aria-current={active === "workspace" ? "page" : undefined} href="#" onClick={(event) => event.preventDefault()}><Icon name="board" size={17} />Workspaces</a>
        <a href="#" onClick={(event) => event.preventDefault()}><Icon name="focus" size={17} />Saved views</a>
      </nav>
      <div className={styles.railPlanning}>
        <span>Planning period</span><strong>Public launch</strong><small>6 Jul – 14 Aug</small>
      </div>
      <nav className={styles.railBottom}>
        <a href="#" onClick={(event) => event.preventDefault()}><Icon name="search" size={17} />Search</a>
        <a href="#" onClick={(event) => event.preventDefault()}><Icon name="settings" size={17} />Settings</a>
      </nav>
      <div className={styles.accountChip}><span>EC</span><b>Ethan</b><small>Founder</small></div>
    </aside>
  );
}
