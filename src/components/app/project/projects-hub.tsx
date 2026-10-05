"use client";

/**
 * Projects hub (v3 redesign, 24 Sep 2026): `/app/project`.
 *
 * Top: every Project the viewer can open. The Console (3 Oct 2026) is the
 * default view: one measured row per Project under the figures that matter
 * this week. The Cards view behind the switcher is the earlier grid, with the
 * same facts each Project's overview shows. Opening a Project from either
 * runs the guarded Active Project switch, so the page reloads on that Project
 * with the URL, chrome and content moving together (ADR 0001, D-022).
 *
 * Below: the open Project's overview.
 *
 * With Active Project V3 off (no provider, so `useActiveProject()` is null)
 * or no hub read, the index is not rendered and the overview is the page.
 */

import { useEffect, useId, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActiveProject, type ActiveProjectContextValue } from "@/components/app/active-project-provider";
import { projectColor } from "@/components/shell/app-sidebar";
import { ShellIcon } from "@/components/shell/shell-icons";
import { MonthlyTemplateChoice } from "@/components/studio-bar/monthly-template-choice";
import { isDemoMode } from "@/lib/access-mode";
import { useToast } from "@/components/primitives/toast";
import { sendNudgeAction } from "@/server/actions/nudge";
import { createProjectAction } from "@/server/actions/planning";
import type { ProjectOverviewData } from "@/server/actions/project-overview";
import { monogramOf, type ChooserRow } from "@/lib/projects/project-chooser";
import { parseProjectId, type ProjectId } from "@/lib/projects/project-ref";
import { buildConsole, type ConsoleFilter, type ConsoleRow, type ConsoleView } from "@/lib/projects/project-console";
import { buildProjectUrl, withActiveProject } from "@/lib/projects/project-url";
import {
  formatProjectDate,
  openTaskLabel,
  progressPercent,
  projectStatusOption,
  targetDatePassed,
  taskProgressLabel,
  trailingSpan,
  type ProjectCardStats,
  type ProjectHub,
  type ProjectHubCard,
} from "@/lib/projects/project-hub";
import { ProjectConsole, type ConsoleNudgeState, type ConsoleSurface } from "./project-console";
import { ProjectViewSwitch } from "./project-view-switch";
import { ProjectOverview, type ProjectDeclaredState, type ProjectOverviewLinks } from "./project-overview";
import { StatusPill } from "./project-status-pill";
import styles from "./projects-hub.module.css";

const OVERVIEW_ANCHOR = "project-overview";

/** Every overview link carries its Project (ADR 0001 §8). */
function overviewLinks(workspaceId: string): ProjectOverviewLinks {
  const id = parseProjectId(workspaceId);
  const contextual = (path: string) => (id ? withActiveProject(path, id) : path);
  return {
    tasks: id ? buildProjectUrl({ surface: "tasks" }, id) : "/app/tasks",
    timeline: id ? buildProjectUrl({ surface: "timeline" }, id) : "/app/timeline",
    notes: id ? buildProjectUrl({ surface: "notes" }, id) : "/app/notes",
    addTask: contextual("/app/tasks?create=task"),
    task: (taskId) => contextual(`/app/tasks?task=${encodeURIComponent(taskId)}`),
  };
}

export function ProjectsHub({
  hub,
  data,
  initialView = "console",
  initialFilter = "all",
}: {
  hub: ProjectHub | null;
  data: ProjectOverviewData;
  /** From the address (`?view=`), so the server paints the chosen view. */
  initialView?: ConsoleView;
  /** From the address (`?show=`), so a link can open on one tab. */
  initialFilter?: ConsoleFilter;
}) {
  const activeProject = useActiveProject();
  const [declared, setDeclared] = useState<ProjectDeclaredState>({
    status: data.declaredStatus,
    targetDate: data.targetDate,
  });
  const showIndex = hub !== null && activeProject !== null;
  const openRow =
    hub?.kind === "ready"
      ? hub.cards.find((card) => card.row.id === data.workspaceId)?.row ??
        hub.archived.find((row) => row.id === data.workspaceId)
      : undefined;

  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={`${styles.inner} mx-auto w-full ${showIndex ? "max-w-[1320px]" : "max-w-[1180px]"} px-4 md:px-8`}>
        {showIndex ? (
          <>
            <ProjectsIndex
              hub={hub}
              data={data}
              declared={declared}
              activeProject={activeProject}
              initialView={initialView}
              initialFilter={initialFilter}
            />
            <div className={styles.divider} role="presentation" />
          </>
        ) : null}
        <div id={OVERVIEW_ANCHOR} className={styles.overview}>
          <ProjectOverview
            data={data}
            titleLevel={showIndex ? 2 : 1}
            identityColor={projectColor(data.workspaceId)}
            monogram={openRow?.monogram ?? monogramOf(data.displayName)}
            links={overviewLinks(data.workspaceId)}
            onDeclaredChange={setDeclared}
          />
        </div>
      </div>
    </div>
  );
}

// ── Index ────────────────────────────────────────────────────────────

function writeViewToAddress(view: ConsoleView) {
  const url = new URL(window.location.href);
  if (view === "cards") url.searchParams.set("view", "cards");
  else url.searchParams.delete("view");
  window.history.replaceState(window.history.state, "", url);
}

export function ProjectsIndex({
  hub,
  data,
  declared,
  activeProject,
  initialView,
  initialFilter,
}: {
  hub: ProjectHub;
  data: ProjectOverviewData;
  declared: ProjectDeclaredState;
  activeProject: ActiveProjectContextValue;
  initialView: ConsoleView;
  initialFilter: ConsoleFilter;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [view, setViewNow] = useState(initialView);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  // Bumped on every "New project" press so an open form takes focus again.
  const [createRequest, setCreateRequest] = useState(0);
  const [nudgeState, setNudgeState] = useState<Record<string, ConsoleNudgeState>>({});
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Mount-stable "today" for when the server could not say; the React
  // Compiler forbids impure calls in render.
  const [clientToday] = useState(() => new Date().toISOString().slice(0, 10));
  const startCreating = () => {
    setCreating(true);
    setCreateRequest((n) => n + 1);
  };
  const closeCreating = (restoreFocus: boolean) => {
    setCreating(false);
    // Escape or Cancel hands focus back to the entry point that is always on
    // screen, never to the top of the document.
    if (restoreFocus) newButtonRef.current?.focus({ preventScroll: true });
  };
  const setView = (next: ConsoleView) => {
    setViewNow(next);
    writeViewToAddress(next);
  };

  const ready = hub.kind === "ready";
  const cards = ready ? hub.cards : EMPTY_CARDS;
  const facts = ready ? hub.console : null;
  const today = facts?.today ?? data.todayIso ?? clientToday;

  const model = useMemo(
    () =>
      buildConsole(
        cards.map((card) => ({
          id: card.row.id,
          name: card.row.name,
          role: card.row.role,
          selectable: card.row.selectable,
          blockedReason: card.row.blockedReason,
          openCount: card.row.activeRootTaskCount,
          stats: card.row.id === data.workspaceId ? overviewStats(data, declared) : card.stats,
          facts: facts?.byProject[card.row.id] ?? null,
        })),
        today,
      ),
    [cards, facts, data, declared, today],
  );

  const needle = query.trim().toLowerCase();
  const shownCards = needle ? cards.filter((card) => card.row.name.toLowerCase().includes(needle)) : cards;

  function go(projectId: string, surface: ConsoleSurface) {
    if (projectId === data.workspaceId) {
      if (surface === "project") {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.getElementById(OVERVIEW_ANCHOR)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      } else {
        router.push(buildProjectUrl({ surface }, projectId as ProjectId));
      }
      return;
    }
    const row = cards.find((card) => card.row.id === projectId)?.row;
    if (!row || !row.selectable) return;
    activeProject.selectProject(row.project, { surface });
  }

  async function nudge(row: ConsoleRow) {
    if (!row.nudge || nudgeState[row.id]) return;
    const who = row.nudge.who;
    setNudgeState((state) => ({ ...state, [row.id]: "sending" }));
    const clear = () =>
      setNudgeState((state) => {
        const next = { ...state };
        delete next[row.id];
        return next;
      });
    try {
      const result = await sendNudgeAction(row.nudge.taskId);
      if (!result.ok) {
        clear();
        toast("The reminder was not sent", { body: "Nothing changed. Open the task to see who it is with.", tone: "warn" });
      } else if (result.nudgedCount === 0) {
        setNudgeState((state) => ({ ...state, [row.id]: "limited" }));
        toast(`${who} was already nudged today`, { body: "One reminder a day at most, so nothing was sent." });
      } else {
        // Name the people the reminder reached, which is not always the one
        // the button named: a task can have several assignees, and each has
        // their own one-a-day limit.
        const title = row.nudge.title;
        const reached = result.nudged.map((person) => person.name);
        const named = reached.includes(who);
        const first = named ? who : reached[0]!;
        const others = reached.length - 1;
        const everyone = others === 0 ? first : `${first} and ${others} ${others === 1 ? "other" : "others"}`;
        if (named) {
          setNudgeState((state) => ({ ...state, [row.id]: "sent" }));
          toast(`Nudged ${everyone}`, { body: `A reminder about “${title}” is on its way.` });
        } else if (result.alreadyNudged.some((person) => person.name === who)) {
          setNudgeState((state) => ({ ...state, [row.id]: "limited" }));
          toast(`${who} was already nudged today`, { body: `The reminder about “${title}” went to ${everyone}.` });
        } else {
          clear();
          toast(`Nudged ${everyone}`, { body: `A reminder about “${title}” is on its way.` });
        }
      }
    } catch {
      clear();
      toast("The reminder was not sent", { body: "Something went wrong. Try again in a moment.", tone: "warn" });
    }
  }

  // One page shows the same week only when there is one Project to show.
  const weekHref =
    cards.length === 1 && cards[0]!.row.id === data.workspaceId ? withActiveProject("/app/analytics", cards[0]!.row.id) : null;

  return (
    <section aria-labelledby="projects-index-title">
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 id="projects-index-title" className={styles.title}>Projects</h1>
          {ready ? (
            <p className={styles.summary}>
              {model.summary.map((part, index) => (
                <span key={part.text} className={styles.summaryPart}>
                  <span data-tone={part.tone}>{part.text}</span>
                  {index < model.summary.length - 1 ? <span className={styles.summaryDot} aria-hidden="true">·</span> : null}
                </span>
              ))}
            </p>
          ) : (
            <p className={styles.subtitle}>Your projects, with how each one is going.</p>
          )}
        </div>
        {ready ? (
          <div className={styles.actions}>
            <ProjectViewSwitch view={view} onPick={setView} />
            <label className={styles.search}>
              <span className="sr-only">Find a project</span>
              <SearchGlyph />
              <input
                ref={searchRef}
                type="search"
                className={styles.searchInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && query) {
                    event.preventDefault();
                    setQuery("");
                  }
                }}
                placeholder="Find a project"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button ref={newButtonRef} type="button" className={`${styles.buttonPrimary} ${styles.newButton}`} onClick={startCreating}>
              <ShellIcon.plus size={14} />
              New project
            </button>
          </div>
        ) : null}
      </header>

      {activeProject.lastError ? (
        <div className={styles.notice} data-tone="danger" role="status">
          <span className={styles.noticeIcon}><ShellIcon.alert /></span>
          <p className={styles.noticeBody}>{activeProject.lastError}</p>
        </div>
      ) : null}

      {hub.kind === "unavailable" ? (
        <div className={styles.notice} role="status">
          <span className={styles.noticeIcon}><ShellIcon.alert /></span>
          <div className={styles.noticeBody}>
            <p className={styles.noticeTitle}>Your projects couldn’t load</p>
            <p>The project you have open is below. Try again in a moment.</p>
          </div>
          <button type="button" className={styles.button} onClick={() => router.refresh()}>
            Try again
          </button>
        </div>
      ) : (
        <div className={styles.index}>
          {view === "console" ? (
            <>
              {creating ? (
                <div className={styles.newPanel}>
                  <NewProjectForm focusRequest={createRequest} onClose={closeCreating} activeProject={activeProject} />
                </div>
              ) : null}
              <ProjectConsole
                model={model}
                initialFilter={initialFilter}
                query={query}
                onClearQuery={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                openProjectId={data.workspaceId}
                pendingProjectId={activeProject.pending?.projectId ?? null}
                hrefFor={(projectId, surface) => buildProjectUrl({ surface }, projectId as ProjectId)}
                taskHref={(projectId, taskId) => withActiveProject(`/app/tasks?task=${encodeURIComponent(taskId)}`, projectId as ProjectId)}
                weekHref={weekHref}
                onGo={go}
                onNudge={isDemoMode() ? undefined : nudge}
                nudgeState={nudgeState}
              />
            </>
          ) : (
            <>
              <h2 className="sr-only">All projects</h2>
              <ul className={styles.grid}>
                {shownCards.map((card) => {
                  const isOpen = card.row.id === data.workspaceId;
                  return (
                    <li key={card.row.id}>
                      <ProjectCard
                        card={card}
                        stats={isOpen ? overviewStats(data, declared) : card.stats}
                        isOpen={isOpen}
                        pending={activeProject.pending?.projectId === card.row.id}
                        todayIso={today}
                        onOpen={() => go(card.row.id, "project")}
                      />
                    </li>
                  );
                })}
                {needle ? null : (
                  <NewProjectCell
                    count={cards.length}
                    creating={creating}
                    createRequest={createRequest}
                    onOpen={startCreating}
                    onClose={closeCreating}
                    activeProject={activeProject}
                  />
                )}
              </ul>
              {needle && shownCards.length === 0 ? (
                <p className={styles.footnote}>No project called “{query.trim()}” here.</p>
              ) : null}
            </>
          )}
          {hub.statsUnavailable ? (
            <p className={styles.footnote}>Progress for the other projects couldn’t load. Open one to see it.</p>
          ) : null}
          {hub.truncated ? (
            <p className={styles.footnote}>Showing the first {cards.length + hub.archived.length} projects you belong to.</p>
          ) : null}
          {hub.archived.length > 0 ? <ArchivedProjects rows={hub.archived} /> : null}
        </div>
      )}
    </section>
  );
}

const EMPTY_CARDS: readonly ProjectHubCard[] = [];

function SearchGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3.25 3.25" />
    </svg>
  );
}

/** The open Project's card reads the overview's own figures, live. */
function overviewStats(data: ProjectOverviewData, declared: ProjectDeclaredState): ProjectCardStats {
  return {
    status: declared.status,
    // A sponsored wedding's date is its wedding date; the old target is
    // history there (see WeddingDateForm), so it never stands in for it.
    targetDate: data.sponsoredWeddingDate ? data.sponsoredWeddingDate.weddingDate : declared.targetDate,
    purpose: data.purpose,
    total: data.taskStats.total,
    complete: data.taskStats.complete,
    overdue: data.taskStats.overdue,
  };
}

function roleLine(row: ChooserRow): string {
  const parts: string[] = [];
  if (row.disambiguator) parts.push(row.disambiguator);
  if (row.project.planningPeriod) parts.push(row.project.planningPeriod.name);
  parts.push(row.role === "member" ? "You’re a member" : row.role === "owner" ? "You’re a co-owner" : "You own this");
  return parts.join(" · ");
}

// ── Card ─────────────────────────────────────────────────────────────

function ProjectCard({
  card,
  stats,
  isOpen,
  pending,
  todayIso,
  onOpen,
}: {
  card: ProjectHubCard;
  stats: ProjectCardStats | null;
  isOpen: boolean;
  pending: boolean;
  todayIso?: string;
  onOpen: () => void;
}) {
  const { row } = card;
  // Mount-stable "today" for the late-date check; the React Compiler forbids
  // impure calls in render.
  const [today] = useState(() => todayIso ?? new Date().toISOString().slice(0, 10));
  const status = projectStatusOption(stats?.status ?? null);
  const open = stats ? Math.max(0, stats.total - stats.complete) : row.activeRootTaskCount;
  const pct = stats ? progressPercent(stats.complete, stats.total) : 0;
  const late = stats ? targetDatePassed(stats.targetDate, stats.status, today) : false;
  const subtitle = !row.selectable ? row.blockedReason : stats?.purpose ?? roleLine(row);

  return (
    <article
      className={styles.card}
      data-active={isOpen ? "" : undefined}
      data-blocked={row.selectable ? undefined : ""}
      aria-busy={pending || undefined}
    >
      <div className={styles.cardTop}>
        <span className={styles.monogram} style={{ background: projectColor(row.id) }} aria-hidden="true">
          {row.monogram}
        </span>
        <div className={styles.cardHeading}>
          <h3 className={styles.cardName}>
            <button
              type="button"
              className={styles.cardButton}
              onClick={onOpen}
              disabled={!row.selectable}
              aria-current={isOpen ? "true" : undefined}
              aria-label={isOpen ? `${row.accessibleName} Its overview is below.` : row.accessibleName}
              title={row.name}
            >
              {row.name}
            </button>
          </h3>
          <p className={styles.cardSub} data-tone={row.selectable ? undefined : "warning"} title={subtitle ?? undefined}>
            {subtitle}
          </p>
        </div>
        <span className={styles.cardStatus}>
          <StatusPill label={status.label} tone={status.tone} />
        </span>
      </div>

      <div className={styles.cardProgress}>
        <div className={styles.progressLine}>
          <span>{stats ? taskProgressLabel(stats.complete, stats.total) : "Progress shows once it’s open"}</span>
          {stats && stats.total > 0 ? <span className={styles.progressPct}>{pct}%</span> : null}
        </div>
        <div className={styles.bar} aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className={styles.cardFoot}>
        {stats?.targetDate ? (
          <span className={styles.meta} data-tone={late ? "danger" : undefined} title={late ? "Target date has passed" : "Target date"}>
            <CalendarGlyph />
            {formatProjectDate(stats.targetDate)}
          </span>
        ) : (
          <span className={styles.meta} data-quiet="">
            <CalendarGlyph />
            No target date
          </span>
        )}
        <span className={styles.meta}>
          <OpenGlyph />
          {openTaskLabel(open)}
          {stats && stats.overdue > 0 ? <span className={styles.overdue}>· {stats.overdue} overdue</span> : null}
        </span>
        <span className={styles.footEnd}>
          {isOpen ? (
            <span className={styles.viewing}>Viewing</span>
          ) : pending ? (
            <span className={styles.opening} role="status">Opening…</span>
          ) : row.selectable ? (
            <span className={styles.go} aria-hidden="true"><ShellIcon.arrowRight size={14} /></span>
          ) : null}
        </span>
      </div>
    </article>
  );
}

function CalendarGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.75h11M5.5 2v2.5M10.5 2v2.5" />
    </svg>
  );
}

function OpenGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="5.25" />
      <path d="M8 2.75a5.25 5.25 0 0 1 0 10.5Z" fill="currentColor" stroke="none" opacity="0.35" />
    </svg>
  );
}

// ── New project ──────────────────────────────────────────────────────

function NewProjectCell({
  count,
  creating,
  createRequest,
  onOpen,
  onClose,
  activeProject,
}: {
  count: number;
  creating: boolean;
  createRequest: number;
  onOpen: () => void;
  onClose: (restoreFocus: boolean) => void;
  activeProject: ActiveProjectContextValue;
}) {
  const span3 = trailingSpan(count, 3);
  const span2 = trailingSpan(count, 2);
  const style = { "--span-3": span3, "--span-2": span2 } as CSSProperties;
  return (
    <li
      className={styles.newCell}
      style={style}
      data-wide3={span3 > 1 ? "" : undefined}
      data-wide2={span2 > 1 ? "" : undefined}
      data-creating={creating ? "" : undefined}
    >
      {creating ? (
        <NewProjectForm focusRequest={createRequest} onClose={onClose} activeProject={activeProject} />
      ) : (
        <button type="button" className={styles.newTile} onClick={onOpen}>
          <span className={styles.newIcon}><ShellIcon.plus /></span>
          <span className={styles.newText}>
            <span className={styles.newTitle}>New project</span>
            <span className={styles.newHint}>Give it a name. Its tasks, notes and timeline stay together.</span>
          </span>
          <span className={styles.newTileKbd} aria-hidden="true">
            Start <ShellIcon.arrowRight size={14} />
          </span>
        </button>
      )}
    </li>
  );
}

const TEMPLATE_CHOICE_CLASSES = {
  wrap: styles.templateWrap,
  choice: styles.templateChoice,
  help: styles.templateHelp,
  status: styles.templateStatus,
};

/**
 * The same creation paths as the Projects sidebar's "Add project" row: a
 * named blank Project (`createProjectAction`, then the guarded switch,
 * landing on the new Project's overview here rather than its board), or the
 * Monthly business rhythm starter.
 */
function NewProjectForm({
  focusRequest,
  onClose,
  activeProject,
}: {
  focusRequest: number;
  onClose: (restoreFocus: boolean) => void;
  activeProject: ActiveProjectContextValue;
}) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusRequest]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.trim();
    if (!name || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createProjectAction(name, null);
        const id = parseProjectId(result.id);
        if (!id) {
          onClose(false);
          router.refresh();
          return;
        }
        const selection = activeProject.selectProject({ id, name }, { surface: "project" });
        onClose(false);
        if (selection.kind !== "started") router.refresh();
      } catch {
        // Keep the draft so the name can be amended and tried again.
        setError("That project couldn’t be created. Check the name and try again.");
      }
    });
  }

  return (
    <form
      className={styles.newForm}
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) {
          event.preventDefault();
          onClose(true);
        }
      }}
    >
      <label htmlFor={inputId} className={styles.newLabel}>Name your project</label>
      <div className={styles.newRow}>
        <input
          id={inputId}
          ref={inputRef}
          className={styles.newInput}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="For example, Spring launch"
          maxLength={80}
          disabled={pending}
          aria-describedby={`${inputId}-hint`}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
        />
        <div className={styles.newButtons}>
          <button type="submit" className={styles.buttonPrimary} disabled={pending || !draft.trim()}>
            {pending ? "Creating…" : "Create project"}
          </button>
          <button type="button" className={styles.button} onClick={() => onClose(true)} disabled={pending}>
            Cancel
          </button>
        </div>
      </div>
      {error ? (
        <p id={`${inputId}-hint`} className={styles.newError} role="alert">{error}</p>
      ) : (
        <p id={`${inputId}-hint`} className={styles.newHint}>It opens here as soon as it’s ready. Esc to cancel.</p>
      )}
      {/* Review never writes, so the starter (which creates a real Project
          with tasks) is offered only where it can run, as in the sidebar. */}
      {!isDemoMode() ? (
        <MonthlyTemplateChoice
          classNames={TEMPLATE_CHOICE_CLASSES}
          pending={pending}
          startTransition={startTransition}
          onCreated={() => onClose(false)}
        />
      ) : null}
    </form>
  );
}

// ── Archived ─────────────────────────────────────────────────────────

/**
 * Archived Projects open read-only through an explicit link (ADR 0001 §5);
 * the switch refuses them, so these are links, never selections.
 */
function ArchivedProjects({ rows }: { rows: readonly ChooserRow[] }) {
  return (
    <details className={styles.archived}>
      <summary className={styles.archivedSummary}>
        <ShellIcon.chevronRight size={14} className={styles.archivedChevron} />
        <ShellIcon.archive size={14} />
        {rows.length === 1 ? "1 archived project" : `${rows.length} archived projects`}
      </summary>
      <ul className={styles.archivedList}>
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={buildProjectUrl({ surface: "project" }, row.id)} className={styles.archivedRow} aria-label={row.accessibleName}>
              <span className={styles.monogram} style={{ background: projectColor(row.id) }} aria-hidden="true">
                {row.monogram}
              </span>
              <span className={styles.archivedMain}>
                <span className={styles.archivedName}>{row.name}</span>
                <span className={styles.archivedMeta}>{row.subtitle}</span>
              </span>
              <ShellIcon.arrowRight size={14} />
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
