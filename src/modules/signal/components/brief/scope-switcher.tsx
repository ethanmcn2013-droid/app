"use client";

import { useEffect, useState } from "react";
import type {
  PlanningCatalog,
  SignalScope,
} from "../../lib/planning-periods/scope";
import { setSignalScope } from "../../server/signal-planning-scope-actions";

function key(scope: SignalScope): string {
  return scope.kind === "workspace"
    ? `workspace:${scope.workspaceId}`
    : `planningPeriod:${scope.planningPeriodId}`;
}

export function SignalScopeSwitcher({
  catalog,
  activeScope,
  demo = false,
}: {
  catalog: PlanningCatalog;
  activeScope: SignalScope;
  demo?: boolean;
}) {
  const [selected, setSelected] = useState(key(activeScope));
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
      className="mx-auto flex w-full max-w-[960px] items-end gap-3 px-6 pt-8 sm:px-8"
      aria-label="Signal scope"
    >
      <label className="grid flex-1 gap-1">
        {/* The ledger's mono metadata register (11px / 0.06em / --ink-quiet),
            not a fourth uppercase micro-label at its own tracking. */}
        <span
          className="text-[11px] tracking-[0.06em] text-[color:var(--ink-quiet)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Briefing scope
        </span>
        {/* min-h-[44px], never min-h-10: --space-10 is 64px in this system,
            so the class would silently yield a 64px band. No component-level
            ring either — the global :focus-visible outline is the only focus
            mark, and --brand is deprecated. */}
        <select
          name="scope"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="min-h-[44px] border-0 border-b border-[color:var(--hairline)] bg-transparent text-[14px] font-normal normal-case tracking-normal text-[color:var(--ink)]"
        >
          {catalog.periods.map((period) => (
            <option key={period.id} value={`planningPeriod:${period.id}`}>
              {period.name} · Planning period
            </option>
          ))}
          {catalog.workspaces.map((workspace) => (
            <option key={workspace.id} value={`workspace:${workspace.id}`}>
              {workspace.name} · Workspace
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={selected === key(activeScope)}
        /* Pill radius inline: the global :focus-visible rule also sets
           border-radius: 6px, which squared the pill on focus. */
        style={{ borderRadius: "var(--radius-pill)" }}
        className="min-h-[44px] border border-[color:var(--hairline)] px-4 text-[13px] text-[color:var(--ink-soft)] disabled:opacity-40"
      >
        Show
      </button>
    </form>
  );
}
