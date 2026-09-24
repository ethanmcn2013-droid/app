"use client";

import { useEffect, useState } from "react";
import type {
  PlanningCatalog,
  SignalScope,
} from "../../lib/planning-periods/scope";
import { setSignalScope } from "../../server/signal-planning-scope-actions";
import styles from "../overview/overview.module.css";

function key(scope: SignalScope): string {
  return scope.kind === "workspace"
    ? `workspace:${scope.workspaceId}`
    : `planningPeriod:${scope.planningPeriodId}`;
}

/**
 * The Overview's project control: which Project the read covers. Sits in the
 * page header beside the page's own actions.
 *
 * Per project only (founder direction, 24 Sep 2026: "no need for program
 * views"). Planning periods are never offered here. A planning-period URL
 * requested directly is still authorized and read by the server exactly as
 * before; this control simply offers the way back to a single Project.
 *
 * Changing the select does not navigate on its own. Keyboard users move
 * through options with the arrow keys, and a select that submits on change
 * would reload the page under them; "Show" commits the choice.
 */
export function SignalScopeSwitcher({
  catalog,
  activeScope,
  demo = false,
}: {
  catalog: PlanningCatalog;
  activeScope: SignalScope;
  demo?: boolean;
}) {
  const activeKey = activeScope.kind === "workspace" ? key(activeScope) : "";
  const [selected, setSelected] = useState(activeKey);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("contextVersion", "2");
    if (activeScope.kind === "workspace") {
      url.searchParams.set("workspaceId", activeScope.workspaceId);
      url.searchParams.delete("planningPeriodId");
    } else {
      url.searchParams.set("planningPeriodId", activeScope.planningPeriodId);
      url.searchParams.delete("workspaceId");
    }
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event("signal-suite-context-change"));
  }, [activeScope]);
  function showDemoScope() {
    const [kind, id] = selected.split(":", 2);
    const url = new URL(window.location.href);
    url.searchParams.set("contextVersion", "2");
    url.searchParams.delete("workspaceId");
    url.searchParams.delete("planningPeriodId");
    if (kind === "workspace") url.searchParams.set("workspaceId", id ?? "");
    if (kind === "planningPeriod") {
      url.searchParams.set("planningPeriodId", id ?? "");
    }
    window.location.assign(url);
  }
  const unchanged = selected === activeKey;
  // Nothing to choose: one Project, already the one being read.
  if (catalog.workspaces.length < 2 && activeScope.kind === "workspace") {
    return null;
  }
  return (
    <form
      action={demo ? undefined : setSignalScope}
      onSubmit={
        demo
          ? (event) => {
              event.preventDefault();
              showDemoScope();
            }
          : undefined
      }
      className={styles.scopeForm}
      aria-label="Overview project"
    >
      <label className={styles.selectWrap}>
        <span className="sr-only">Project</span>
        <select
          name="scope"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className={styles.select}
        >
          {activeKey === "" ? (
            <option value="" disabled>
              Choose a project
            </option>
          ) : null}
          {catalog.workspaces.map((project) => (
            <option key={project.id} value={`workspace:${project.id}`}>
              {project.name}
            </option>
          ))}
        </select>
        <svg
          className={styles.selectChevron}
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
        </svg>
      </label>
      {unchanged || selected === "" ? null : (
        <button type="submit" className={styles.button}>
          Show
        </button>
      )}
    </form>
  );
}
