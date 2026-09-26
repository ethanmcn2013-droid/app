"use client";

/**
 * Projects hub (v3 redesign, 24 Sep 2026): `/app/project`.
 *
 * Top: every Project the viewer can open, as cards with the same facts each
 * Project's overview shows (status, progress, target date, open work).
 * Choosing a card runs the guarded Active Project switch with the Project
 * overview as its destination, so the page reloads on that Project with the
 * URL, chrome and content moving together (ADR 0001, D-022).
 *
 * Below: the open Project's overview.
 *
 * With Active Project V3 off (no provider, so `useActiveProject()` is null)
 * or no hub read, the index is not rendered and the overview is the page.
 */

import { useEffect, useId, useRef, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActiveProject, type ActiveProjectContextValue } from "@/components/app/active-project-provider";
import { projectColor } from "@/components/shell/app-sidebar";
import { ShellIcon } from "@/components/shell/shell-icons";
import { MonthlyTemplateChoice } from "@/components/studio-bar/monthly-template-choice";
import { isDemoMode } from "@/lib/access-mode";
import { createProjectAction } from "@/server/actions/planning";
import type { ProjectOverviewData } from "@/server/actions/project-overview";
import { monogramOf, type ChooserRow } from "@/lib/projects/project-chooser";
import { parseProjectId } from "@/lib/projects/project-ref";
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

export function ProjectsHub({ hub, data }: { hub: ProjectHub | null; data: ProjectOverviewData }) {
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
      <div className={`${styles.inner} mx-auto w-full max-w-[1180px] px-4 md:px-8`}>
        {showIndex ? (
          <>
            <ProjectsIndex hub={hub} data={data} declared={declared} activeProject={activeProject} />
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

function ProjectsIndex({
  hub,
  data,
  declared,
  activeProject,
}: {
  hub: ProjectHub;
  data: ProjectOverviewData;
  declared: ProjectDeclaredState;
  activeProject: ActiveProjectContextValue;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  // Bumped on every "New project" press so an open form takes focus again.
  const [createRequest, setCreateRequest] = useState(0);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const startCreating = () => {
    setCreating(true);
    setCreateRequest((n) => n + 1);
  };
  const cards = hub.kind === "ready" ? hub.cards : [];
  const count = cards.length;

  const subtitle =
    hub.kind !== "ready"
      ? "Your projects, with how each one is going."
      : count === 0
        ? "No active projects yet. Start one below."
        : count === 1
          ? "1 active project. Its overview is below."
          : `${count} active projects. Choose one to see its overview below.`;

  function openCard(row: ChooserRow) {
    if (row.id === data.workspaceId) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(OVERVIEW_ANCHOR)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      return;
    }
    if (!row.selectable) return;
    activeProject.selectProject(row.project, { surface: "project" });
  }

  return (
    <section aria-labelledby="projects-index-title">
      <header className={styles.header}>
        <div>
          <h1 id="projects-index-title" className={styles.title}>Projects</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        {hub.kind === "ready" ? (
          <div className={styles.actions}>
            <button ref={newButtonRef} type="button" className={styles.buttonPrimary} onClick={startCreating}>
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
          <h2 className="sr-only">All projects</h2>
          <ul className={styles.grid}>
            {cards.map((card) => {
              const isOpen = card.row.id === data.workspaceId;
              return (
                <li key={card.row.id}>
                  <ProjectCard
                    card={card}
                    stats={isOpen ? overviewStats(data, declared) : card.stats}
                    isOpen={isOpen}
                    pending={activeProject.pending?.projectId === card.row.id}
                    todayIso={data.todayIso}
                    onOpen={() => openCard(card.row)}
                  />
                </li>
              );
            })}
            <NewProjectCell
              count={count}
              creating={creating}
              createRequest={createRequest}
              onOpen={startCreating}
              onClose={(restoreFocus) => {
                setCreating(false);
                // Escape or Cancel hands focus back to the entry point that
                // is always on screen, never to the top of the document.
                if (restoreFocus) newButtonRef.current?.focus({ preventScroll: true });
              }}
              activeProject={activeProject}
            />
          </ul>
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
