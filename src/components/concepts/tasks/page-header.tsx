"use client";

/**
 * The one Tasks header, wired to the demo store, so Board, List and Calendar
 * show the same scope, the same numbers, the same stuck sentence, the same
 * team and the same primary action, in the same places.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  TEAM,
  WORKSPACE,
  countsIn,
  doneThisWeek,
  fmtDate,
  personById,
  stuckSentence,
  stuckTasks,
  type DemoState,
  type ProjectId,
  type TeamPersonId,
} from "../demo/store";
import { useDemoStore } from "../demo/store/client";
import { HealthSentence, PrimaryButton, StuckButton, SummaryLine, TasksHeader } from "./header";
import { nudge, useNudged } from "./nudge";
import { liveActiveProjects, liveProject } from "./projects";
import { storeScope, useTaskScope, type TaskScope } from "./scope";
import styles from "./tasks.module.css";

const hue = (n?: number) => `var(--v3-project-${n ?? 2})`;

/** Numbers for the header, from the store, inside the scope. */
export function useScopedFacts(scope: TaskScope) {
  const { project, owner } = scope;
  const select = useCallback(
    (s: DemoState) => {
      const sc = storeScope({ project, owner });
      const c = countsIn(s, sc);
      return { counts: c, doneWeek: doneThisWeek(s, sc).length, stuck: stuckTasks(s, sc), lead: stuckSentence(s, sc) };
    },
    [project, owner],
  );
  return useDemoStore(select);
}

/* ── Scope pill and its menu ─────────────────────────────────────────── */

export function ScopePill({ project, onPick }: { project?: ProjectId; onPick: (id: ProjectId | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openCounts = useDemoStore(useCallback((s: DemoState) => {
    const m = new Map<string, number>();
    for (const t of s.tasks) if (t.status !== "done") m.set(t.project, (m.get(t.project) ?? 0) + 1);
    return m;
  }, []));
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);
  const p = liveProject(project);
  const active = liveActiveProjects();
  const pick = (id: ProjectId | undefined) => {
    setOpen(false);
    onPick(id);
  };
  return (
    <div className={styles.scopeAnchor} ref={ref}>
      <span className={styles.scopeWrap} data-set={p ? "" : undefined}>
        <button
          type="button"
          className={styles.projectPill}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("[role=menuitemradio][aria-checked=true]")?.focus());
            }
          }}
        >
          <span className={styles.projectDot} style={{ "--dot": p ? hue(p.hue) : hue(2) } as CSSProperties} aria-hidden="true" />
          <span className={styles.projectName}>{p ? p.name : WORKSPACE.name}</span>
          <span className={styles.projectKind}>{p ? fmtDate(p.date) : "all projects"}</span>
          <svg width={12} height={12} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
        {p ? (
          <button type="button" className={styles.scopeClear} onClick={() => pick(undefined)} aria-label={`Show every project, not only ${p.short}`}>
            <svg width={12} height={12} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        ) : null}
      </span>
      {open ? (
        <div
          className={styles.scopeMenu}
          role="menu"
          aria-label="Show tasks for"
          onKeyDown={(e) => {
            const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? []);
            const i = items.indexOf(document.activeElement as HTMLElement);
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
            }
          }}
        >
          <button type="button" role="menuitemradio" aria-checked={!project} className={styles.scopeItem} onClick={() => pick(undefined)}>
            <span className={styles.scopeTile} style={{ "--dot": hue(2) } as CSSProperties} aria-hidden="true" />
            <span className={styles.scopeText}>
              <span>{WORKSPACE.name}</span>
              <span className={styles.scopeSub}>All {active.length} projects</span>
            </span>
          </button>
          <p className={styles.scopeLabel}>Projects</p>
          {active.map((x) => (
            <button key={x.id} type="button" role="menuitemradio" aria-checked={project === x.id} className={styles.scopeItem} onClick={() => pick(x.id)}>
              <span className={styles.scopeTile} style={{ "--dot": hue(x.hue) } as CSSProperties} aria-hidden="true" />
              <span className={styles.scopeText}>
                <span>{x.name}</span>
                <span className={styles.scopeSub}>
                  {fmtDate(x.date)} · {openCounts.get(x.id) ?? 0} open
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A narrowing you can take off: "Orla's tasks ×". */
export function FilterChip({ label, onRemove, removeLabel }: { label: ReactNode; onRemove: () => void; removeLabel: string }) {
  return (
    <span className={styles.filterChip}>
      {label}
      <button type="button" className={styles.filterChipX} onClick={onRemove} aria-label={removeLabel}>
        <svg width={11} height={11} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
        </svg>
      </button>
    </span>
  );
}

/** The team, as filters: one face shows that person's tasks. Clients never appear here. */
export function TeamFilter({ owner, onPick }: { owner?: TeamPersonId; onPick: (id: TeamPersonId | undefined) => void }) {
  return (
    <span className={styles.faces} role="group" aria-label="Show one person's tasks">
      {TEAM.map((id) => {
        const p = personById(id)!;
        const on = owner === id;
        return (
          <button
            key={id}
            type="button"
            className={styles.faceButton}
            aria-pressed={on}
            data-dim={owner && !on ? "" : undefined}
            onClick={() => onPick(on ? undefined : id)}
            title={on ? `Showing ${p.first}'s tasks. Click to show everyone's.` : `Only ${p.first}'s tasks`}
            aria-label={`Only ${p.name}'s tasks`}
          >
            <span className={styles.face} style={{ background: hue(p.hue) }}>
              {p.initials}
            </span>
          </button>
        );
      })}
    </span>
  );
}

/** "Orla's tasks". */
export const ownerLabel = (id: TeamPersonId) => `${personById(id)?.first ?? id}'s tasks`;

export type TasksPageHeaderProps = {
  /** Shown after the scope pill when no one person is chosen: "Your week". */
  context?: ReactNode;
  /** What the chosen person's chip says in this view. The board and the list say "Aoife's tasks"; the calendar, "Aoife's week". */
  ownerChip?: (id: TeamPersonId) => string;
  stuckOnly: boolean;
  onStuck: (on: boolean) => void;
  lateOnly: boolean;
  onLate: () => void;
  /** "3 more stuck": the board opens its triage; others filter to stuck. */
  onMoreStuck?: () => void;
  onNewTask: () => void;
  /** The view's own signature action, secondary, beside New task. */
  signature?: ReactNode;
  /** Say something in the view's toast (the nudge confirmation). */
  onSay: (message: string) => void;
};

export function TasksPageHeader(p: TasksPageHeaderProps) {
  const scope = useTaskScope();
  const { counts, doneWeek, stuck, lead } = useScopedFacts(scope);
  const nudged = useNudged();
  // The store words the lead stuck task, so every view says the same thing.
  const nudges = !!lead && lead.actionLabel.startsWith("Nudge");

  const chip = scope.owner ? (p.ownerChip ?? ownerLabel)(scope.owner) : "";

  return (
    <TasksHeader
      pinned
      project={
        <>
          <ScopePill project={scope.project} onPick={(id) => scope.set({ project: id, task: undefined })} />
          {scope.owner ? (
            <FilterChip
              label={chip}
              onRemove={() => scope.set({ owner: undefined })}
              removeLabel={p.ownerChip ? `Back to your week, not ${chip}` : `Show everyone's tasks, not only ${chip}`}
            />
          ) : p.context ? (
            <span className={styles.context}>{p.context}</span>
          ) : null}
        </>
      }
      summary={
        counts.total === 0 ? (
          <p className={styles.summary}>{scope.owner ? `${personById(scope.owner)?.first ?? "They"} has no tasks here` : "No tasks here yet"}</p>
        ) : (
          <SummaryLine doneWeek={doneWeek} open={counts.open} late={counts.late} donePct={counts.pct} lateOnly={p.lateOnly} onLate={p.onLate} />
        )
      }
      health={
        lead ? (
          <HealthSentence
            kind="stuck"
            action={lead.actionLabel}
            onAction={() => (nudges ? p.onSay(nudge(lead.task)) : scope.set({ task: lead.task.id }))}
            actionDone={nudges && nudged.has(lead.task.id) ? "Nudged today" : undefined}
            more={lead.more || undefined}
            onMore={p.onMoreStuck ?? (() => p.onStuck(true))}
          >
            <TaskTitleSentence sentence={lead.sentence} title={lead.task.title} />
          </HealthSentence>
        ) : counts.total > 0 ? (
          <HealthSentence kind="healthy">
            <strong>Nothing is stuck.</strong> Work is moving at its usual pace.
          </HealthSentence>
        ) : null
      }
      actions={
        <>
          <TeamFilter owner={scope.owner} onPick={(id) => scope.set({ owner: id })} />
          {stuck.length > 0 || p.stuckOnly ? <StuckButton count={stuck.length} pressed={p.stuckOnly} onToggle={() => p.onStuck(!p.stuckOnly)} /> : null}
          {p.signature ? <span className={styles.signature}>{p.signature}</span> : null}
          <PrimaryButton onClick={p.onNewTask} shortcut="N">
            New task
          </PrimaryButton>
        </>
      }
    />
  );
}

/** The store's sentence, with the task's title in bold. */
function TaskTitleSentence({ sentence, title }: { sentence: string; title: string }) {
  if (!sentence.startsWith(title)) return <>{sentence}</>;
  return (
    <>
      <strong>{title}</strong>
      {sentence.slice(title.length)}
    </>
  );
}

/** On a phone, New task is one round button at the bottom right. `lift` clears a bar under it. */
export function NewTaskFab({ onClick, lift = 0 }: { onClick: () => void; lift?: number }) {
  return (
    <button type="button" className={styles.fab} style={{ "--lift": `${lift}px` } as CSSProperties} onClick={onClick} aria-label="New task">
      <svg width={22} height={22} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
    </button>
  );
}

const typingIn = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
};

/**
 * N opens New task, everywhere in Tasks, unless you are typing or inside a
 * dialog. That includes the list with a cell selected: a selected cell is not
 * being typed in until Enter, F2 or another character starts it, so N stays
 * New task there too. The key is claimed (`preventDefault`), so the frame
 * leaves it alone.
 */
export function useNewTaskKey(onNew: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || typingIn(e.target)) return;
      if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) return;
      e.preventDefault();
      onNew();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNew, enabled]);
}

/**
 * `?new=1` opens New task with the cursor in the title, then leaves the
 * address. Home's New task button and N on the other surfaces arrive this way.
 */
export function useNewTaskParam(onNew: () => void, enabled = true) {
  const { fresh, set } = useTaskScope();
  useEffect(() => {
    if (!fresh || !enabled) return;
    onNew();
    set({ new: undefined });
  }, [fresh, enabled, onNew, set]);
}
