"use client";

/**
 * Projects, Console view (v3 redesign, 3 Oct 2026): every Project the viewer
 * can open as one measured row, under the figures that say what matters this
 * week, with tabs across the top and rows grouped by how each is doing.
 *
 * This component only draws. Every word and number arrives in the model
 * (`src/lib/projects/project-console.ts`), every destination and action
 * through props, so the same component renders the real page and the
 * many-project review fixture.
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  CONSOLE_FILTERS,
  CONSOLE_FILTER_LABEL,
  CONSOLE_FILTER_PARAM,
  consoleEmptyWords,
  consoleGroups,
  type ConsoleCell,
  type ConsoleFilter,
  type ConsoleGroup,
  type ConsoleMark,
  type ConsoleModel,
  type ConsoleRow,
  type ConsoleSegment,
} from "@/lib/projects/project-console";
import c from "./project-console.module.css";

export type ConsoleSurface = "project" | "tasks" | "timeline";

export type ConsoleNudgeState = "sending" | "sent" | "limited";

export type ProjectConsoleProps = Readonly<{
  model: ConsoleModel;
  initialFilter: ConsoleFilter;
  query: string;
  onClearQuery: () => void;
  /** The Project whose overview is on the page below. */
  openProjectId: string | null;
  /** A Project being opened right now. */
  pendingProjectId: string | null;
  hrefFor: (projectId: string, surface: ConsoleSurface) => string;
  taskHref: (projectId: string, taskId: string) => string;
  /** Where "This week" leads, or null when no one page shows that figure. */
  weekHref: string | null;
  /** A plain click on a row, a card or a menu item. */
  onGo: (projectId: string, surface: ConsoleSurface) => void;
  /**
   * A plain click on a row's name: show the Project as a record without
   * opening it, with `order` the rows as listed for previous and next. Absent,
   * the row opens the Project as before. The row's Open button always opens.
   */
  onPeek?: (projectId: string, order: readonly string[]) => void;
  /** Absent where reminders cannot be sent; the menu then has no Nudge. */
  onNudge?: (row: ConsoleRow) => void;
  nudgeState?: Readonly<Record<string, ConsoleNudgeState>>;
}>;

/** Bars and the entrance play once per tab: the first time the console is seen. */
let seenOnce = false;

const plainClick = (event: ReactMouseEvent) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);

function writeFilterToAddress(filter: ConsoleFilter) {
  const url = new URL(window.location.href);
  const value = CONSOLE_FILTER_PARAM[filter];
  if (value) url.searchParams.set("show", value);
  else url.searchParams.delete("show");
  window.history.replaceState(window.history.state, "", url);
}

export function ProjectConsole({
  model,
  initialFilter,
  query,
  onClearQuery,
  openProjectId,
  pendingProjectId,
  hrefFor,
  taskHref,
  weekHref,
  onGo,
  onPeek,
  onNudge,
  nudgeState,
}: ProjectConsoleProps) {
  const [filter, setFilterNow] = useState(initialFilter);
  const [enter] = useState(() => !seenOnce);
  useEffect(() => {
    seenOnce = true;
  }, []);
  const id = useId();
  const panelId = `${id}-rows`;
  const tabId = (f: ConsoleFilter) => `${id}-tab-${f}`;

  const groups = useMemo(() => consoleGroups(model, filter, query), [model, filter, query]);

  // A tab answers at once and writes the address after, so a reload or a
  // copied link opens on the same tab.
  const setFilter = (next: ConsoleFilter) => {
    setFilterNow(next);
    writeFilterToAddress(next);
  };

  return (
    <div className={c.frame}>
      <div className={c.root} data-enter={enter || undefined}>
        <FilterTabs filter={filter} counts={model.counts} onPick={setFilter} tabId={tabId} panelId={panelId} />
        <Cards
          model={model}
          hrefFor={hrefFor}
          taskHref={taskHref}
          weekHref={weekHref}
          onGo={onGo}
          onShowAttention={() => setFilter("attention")}
        />
        <div className={c.list} role="tabpanel" id={panelId} aria-labelledby={tabId(filter)}>
          {groups.length === 0 ? (
            <Empty filter={filter} query={query} onClearQuery={onClearQuery} onAll={() => setFilter("all")} />
          ) : (
            <RowList
              groups={groups}
              idBase={id}
              openProjectId={openProjectId}
              pendingProjectId={pendingProjectId}
              hrefFor={hrefFor}
              onGo={onGo}
              onPeek={onPeek}
              onNudge={onNudge}
              nudgeState={nudgeState}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Filter tabs ─────────────────────────────────────────────────── */

function FilterTabs({
  filter,
  counts,
  onPick,
  tabId,
  panelId,
}: {
  filter: ConsoleFilter;
  counts: Readonly<Record<ConsoleFilter, number>>;
  onPick: (filter: ConsoleFilter) => void;
  tabId: (filter: ConsoleFilter) => string;
  panelId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const at = CONSOLE_FILTERS.indexOf(filter);
    const to =
      event.key === "ArrowRight" ? at + 1 : event.key === "ArrowLeft" ? at - 1 : event.key === "Home" ? 0 : event.key === "End" ? CONSOLE_FILTERS.length - 1 : null;
    if (to === null) return;
    event.preventDefault();
    const next = CONSOLE_FILTERS[(to + CONSOLE_FILTERS.length) % CONSOLE_FILTERS.length]!;
    onPick(next);
    ref.current?.querySelector<HTMLElement>(`[data-filter="${next}"]`)?.focus();
  };
  // Keep the chosen tab in view when the row of tabs scrolls (phone).
  useEffect(() => {
    const strip = ref.current;
    const el = strip?.querySelector<HTMLElement>(`[data-filter="${filter}"]`);
    if (!strip || !el) return;
    const left = el.offsetLeft - 16;
    const right = el.offsetLeft + el.offsetWidth + 16;
    if (left < strip.scrollLeft) strip.scrollLeft = left;
    else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth;
  }, [filter]);
  return (
    <div className={c.tabsWrap}>
      <div ref={ref} className={c.tabs} role="tablist" aria-label="Show projects" onKeyDown={onKey}>
        {CONSOLE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            id={tabId(f)}
            data-filter={f}
            aria-selected={f === filter}
            aria-controls={panelId}
            tabIndex={f === filter ? 0 : -1}
            className={c.tab}
            onClick={() => onPick(f)}
          >
            {CONSOLE_FILTER_LABEL[f]}
            <span className={c.tabCount}>{counts[f]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── The figures ─────────────────────────────────────────────────── */

function Cards({
  model,
  hrefFor,
  taskHref,
  weekHref,
  onGo,
  onShowAttention,
}: {
  model: ConsoleModel;
  hrefFor: ProjectConsoleProps["hrefFor"];
  taskHref: ProjectConsoleProps["taskHref"];
  weekHref: string | null;
  onGo: ProjectConsoleProps["onGo"];
  onShowAttention: () => void;
}) {
  const { attention, nextDate, late, week } = model.cards;
  const cards: ReactNode[] = [
    <Card
      key="attention"
      href={`?show=${CONSOLE_FILTER_PARAM.attention}`}
      onPlainClick={onShowAttention}
      title="Needs a look"
      meta={`${attention.active} active`}
      figure={attention.count}
      unit={attention.count === 1 ? "project at risk or past its date" : "projects at risk or past their date"}
      bar={<Segments parts={attention.segments} label={attention.segmentsLabel} />}
      caption={
        attention.caption ? (
          <>
            <strong>{attention.caption.strong}</strong> {attention.caption.rest}
          </>
        ) : attention.active === 0 ? (
          "No active projects"
        ) : (
          "Nothing is flagged"
        )
      }
    />,
  ];
  if (nextDate) {
    cards.push(
      <Card
        key="next"
        href={hrefFor(nextDate.projectId, "project")}
        onPlainClick={() => onGo(nextDate.projectId, "project")}
        title="Next big date"
        meta={nextDate.projectName}
        figure={nextDate.days}
        unit={nextDate.days === 0 ? "days to go, it is today" : nextDate.days === 1 ? "day to go" : "days to go"}
        bar={
          <Bar
            value={nextDate.total ? nextDate.complete / nextDate.total : 0}
            label={`${nextDate.complete} of ${nextDate.total} tasks done in ${nextDate.projectName}`}
          />
        }
        caption={
          <>
            <strong>{nextDate.title}</strong> · {nextDate.dateLabel}
            {nextDate.total > 0 ? ` · ${nextDate.complete} of ${nextDate.total} done` : ""}
          </>
        }
      />,
    );
  }
  if (late) {
    cards.push(
      <Card
        key="late"
        href={late.oldest ? taskHref(late.oldest.projectId, late.oldest.taskId) : undefined}
        title="Late across your projects"
        meta={late.projects === 1 ? "1 project" : `${late.projects} projects`}
        figure={late.total}
        unit={late.total === 1 ? "task past its date" : "tasks past their date"}
        tone={late.total ? "late" : undefined}
        bar={<Segments parts={late.segments} label={late.segmentsLabel} />}
        caption={
          late.oldest ? (
            <>
              Oldest: <strong>{late.oldest.title}</strong> · {late.oldest.age}
            </>
          ) : late.total ? (
            "Open a project to see which"
          ) : (
            "Nothing is late"
          )
        }
      />,
    );
  }
  if (week) {
    cards.push(
      <Card
        key="week"
        href={weekHref ?? undefined}
        title="This week"
        meta={week.rangeLabel}
        figure={week.total}
        unit={week.total === 1 ? "task done in the last 7 days" : "tasks done in the last 7 days"}
        bar={<Days days={week.days} label={week.daysLabel} />}
        caption={
          <>
            {week.previous} the week before
            {week.busiest ? (
              <>
                {" "}
                · most in <strong>{week.busiest.name}</strong> ({week.busiest.done})
              </>
            ) : null}
          </>
        }
      />,
    );
  }
  return (
    <div className={c.cards} data-count={cards.length}>
      {cards}
    </div>
  );
}

function Card({
  href,
  onPlainClick,
  title,
  meta,
  figure,
  unit,
  bar,
  caption,
  tone,
}: {
  href?: string;
  onPlainClick?: () => void;
  title: string;
  meta: string;
  figure: number;
  unit: string;
  bar: ReactNode;
  caption: ReactNode;
  tone?: "late";
}) {
  const body = (
    <>
      <span className={c.cardHead}>
        <span className={c.cardTitle}>{title}</span>
        <span className={c.cardMeta}>{meta}</span>
      </span>
      <span className={c.figureRow}>
        <span className={c.figure} data-tone={tone}>
          {figure}
        </span>
        <span className={c.unit}>{unit}</span>
      </span>
      {bar}
      <span className={c.cardCaption}>{caption}</span>
      {href ? (
        <span className={c.cardGo} aria-hidden="true">
          <Arrow />
        </span>
      ) : null}
    </>
  );
  if (!href) return <div className={c.card}>{body}</div>;
  return (
    <a
      href={href}
      className={c.card}
      onClick={(event) => {
        if (!onPlainClick || !plainClick(event)) return;
        event.preventDefault();
        onPlainClick();
      }}
    >
      {body}
    </a>
  );
}

function Segments({ parts, label }: { parts: readonly ConsoleSegment[]; label: string }) {
  return (
    <span className={c.segments} role="img" aria-label={label}>
      {parts.length === 0 ? <span className={c.segment} data-tone="empty" /> : null}
      {parts.map((part) => (
        <span key={part.key} className={c.segment} data-tone={part.tone} title={part.title} style={{ flexGrow: part.weight }} />
      ))}
    </span>
  );
}

function Days({
  days,
  label,
}: {
  days: ReadonlyArray<Readonly<{ date: string; share: number; isToday: boolean; title: string }>>;
  label: string;
}) {
  return (
    <span className={c.days} role="img" aria-label={label}>
      {days.map((day) => (
        <span key={day.date} className={c.day} data-today={day.isToday || undefined} title={day.title}>
          <span className={c.dayTrack}>
            <span className={c.dayFill} style={{ "--p": day.share } as CSSProperties} />
          </span>
        </span>
      ))}
    </span>
  );
}

function Bar({ value, tone, label }: { value: number; tone?: "late" | "risk"; label: string }) {
  const p = Math.max(0, Math.min(1, value));
  return (
    <span className={c.bar} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
      <span className={c.fill} data-tone={tone} style={{ "--p": p } as CSSProperties} />
    </span>
  );
}

/* ── Rows ────────────────────────────────────────────────────────── */

type RowShared = Pick<ProjectConsoleProps, "openProjectId" | "pendingProjectId" | "hrefFor" | "onGo" | "onNudge" | "nudgeState"> & {
  /** Set by the list with its own order, so the peek can step through it. */
  onPeek?: (projectId: string) => void;
};

function RowList({
  groups,
  idBase,
  onPeek,
  ...shared
}: { groups: readonly ConsoleGroup[]; idBase: string; onPeek?: ProjectConsoleProps["onPeek"] } & Omit<RowShared, "onPeek">) {
  const ids = groups.flatMap((group) => group.rows.map((row) => row.id));
  const peek = onPeek ? (projectId: string) => onPeek(projectId, ids) : undefined;
  const [active, setActive] = useState<string | null>(null);
  const current = active && ids.includes(active) ? active : ids[0];
  const listRef = useRef<HTMLDivElement>(null);

  // Up and down (or j and k) walk the rows; Tab then reaches a row's actions.
  const onKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.matches("[data-console-row]") || event.altKey || event.metaKey || event.ctrlKey) return;
    const at = ids.indexOf(target.dataset.consoleRow ?? "");
    const to =
      event.key === "ArrowDown" || event.key === "j"
        ? at + 1
        : event.key === "ArrowUp" || event.key === "k"
          ? at - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? ids.length - 1
              : null;
    if (to === null || to < 0 || to >= ids.length) return;
    event.preventDefault();
    const next = ids[to]!;
    setActive(next);
    listRef.current?.querySelector<HTMLElement>(`[data-console-row="${CSS.escape(next)}"]`)?.focus();
  };

  let index = 0;
  return (
    <div ref={listRef} className={c.groups} onKeyDown={onKey}>
      {groups.map((group) => (
        <div key={group.id} className={c.group} role="group" aria-labelledby={`${idBase}-group-${group.id}`}>
          <h2 className={c.groupHead} id={`${idBase}-group-${group.id}`}>
            {group.label}
            <span className={c.groupCount}>{group.rows.length}</span>
          </h2>
          {group.rows.map((row) => (
            <Row key={row.id} row={row} index={index++} current={row.id === current} onFocusRow={() => setActive(row.id)} onPeek={peek} {...shared} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Row({
  row,
  index,
  current,
  onFocusRow,
  openProjectId,
  pendingProjectId,
  hrefFor,
  onGo,
  onPeek,
  onNudge,
  nudgeState,
}: { row: ConsoleRow; index: number; current: boolean; onFocusRow: () => void } & RowShared) {
  const isOpen = row.id === openProjectId;
  const pending = row.id === pendingProjectId;
  const tabIndex = current ? 0 : -1;
  const open = (event: ReactMouseEvent) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    onGo(row.id, "project");
  };
  // The name shows the peek; the open Project's own row still scrolls to its
  // overview below, and a new-tab click still follows the link.
  const peekOrOpen = (event: ReactMouseEvent) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    if (onPeek && !isOpen) onPeek(row.id);
    else onGo(row.id, "project");
  };

  const items: MenuItem[] = [];
  if (row.selectable) {
    const nudged = nudgeState?.[row.id];
    if (onNudge && row.nudge) {
      items.push(
        nudged === "sent" || nudged === "limited"
          ? { id: "nudge", label: nudged === "sent" ? `Nudged ${row.nudge.who}` : `Already nudged ${row.nudge.who} today`, hint: row.nudge.title, disabled: true }
          : nudged === "sending"
            ? { id: "nudge", label: `Nudging ${row.nudge.who}…`, hint: row.nudge.title, disabled: true }
            : { id: "nudge", label: `Nudge ${row.nudge.who}`, hint: `A reminder about: ${row.nudge.title}`, run: () => onNudge(row) },
      );
    }
    items.push({ id: "open", label: isOpen ? "See its overview" : "Open the project", hint: isOpen ? "Further down this page" : undefined, run: () => onGo(row.id, "project") });
    items.push({ id: "tasks", label: "Open its tasks", hint: row.open === 0 ? "Nothing open" : `${row.open} open`, run: () => onGo(row.id, "tasks") });
    items.push({ id: "timeline", label: "See the timeline", hint: "Big dates and tasks in time", run: () => onGo(row.id, "timeline") });
  }

  const nameBlock = (
    <>
      <span className={c.name}>
        <span className={c.mark}>
          <Mark mark={row.mark} />
        </span>
        <span className={c.nameText}>{row.name}</span>
      </span>
      <span className={c.sub} data-tone={row.selectable ? undefined : "warning"}>
        {row.sub}
      </span>
    </>
  );

  return (
    <div
      className={c.row}
      data-row={row.id}
      data-open={isOpen || undefined}
      data-blocked={row.selectable ? undefined : ""}
      aria-busy={pending || undefined}
      style={{ "--i": Math.min(index, 10) } as CSSProperties}
    >
      {row.selectable ? (
        <a
          href={hrefFor(row.id, "project")}
          className={c.rowLink}
          data-console-row={row.id}
          tabIndex={tabIndex}
          onFocus={onFocusRow}
          onClick={peekOrOpen}
          aria-current={isOpen ? "true" : undefined}
          aria-haspopup={onPeek && !isOpen ? "dialog" : undefined}
          aria-label={`${row.name}. ${row.markLabel}. ${isOpen ? "Its overview is below" : onPeek ? "Show a summary" : "Open the project"}`}
        >
          {nameBlock}
        </a>
      ) : (
        // A Project whose name is shared with another cannot be opened from
        // here; the row still says it exists, and why.
        <div className={c.rowLink} data-console-row={row.id} tabIndex={tabIndex} onFocus={onFocusRow} role="group" aria-label={`${row.name}. ${row.sub}`}>
          {nameBlock}
        </div>
      )}
      <Cell label="Done" cell={row.done} />
      <Cell label="Next big date" cell={row.next} />
      <Cell label="Late" cell={row.lateCell} />
      <div className={c.lead}>
        <span className={c.avatar} aria-hidden="true" data-you={row.ledByYou || undefined}>
          {row.lead.initials ?? <PersonGlyph />}
        </span>
        <span className={c.leadText}>
          <span className={c.leadTop}>
            <span className={c.cellLabel}>Lead</span>
            <span className={c.leadName}>{row.lead.name}</span>
          </span>
          <span className={c.leadCaption}>{row.lead.caption}</span>
        </span>
      </div>
      <div className={c.actions}>
        {row.selectable ? (
          <>
            {pending ? (
              <span className={c.opening} role="status">
                Opening…
              </span>
            ) : (
              <a href={hrefFor(row.id, "project")} className={c.openBtn} tabIndex={tabIndex} onClick={open} aria-label={isOpen ? `${row.name}: see its overview below` : `Open ${row.name}`}>
                {isOpen ? "Viewing" : "Open"}
                {isOpen ? <ArrowDown /> : <Arrow />}
              </a>
            )}
            <RowMenu items={items} label={`More for ${row.name}`} tabIndex={tabIndex} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function Cell({ label, cell }: { label: string; cell: ConsoleCell }) {
  return (
    <div className={c.cell}>
      <span className={c.cellTop}>
        <span className={c.cellLabel}>{label}</span>
        <span className={c.cellValue} data-tone={cell.tone} data-quiet={cell.quiet || undefined}>
          {cell.value}
        </span>
      </span>
      <Bar value={cell.bar} tone={cell.tone} label={cell.barLabel} />
      <span className={c.cellCaption} title={cell.caption}>
        {cell.caption}
      </span>
    </div>
  );
}

/* ── Marks: one shape per state, so colour is never the only signal ─ */

export function Mark({ mark, size = 14 }: { mark: ConsoleMark; size?: number }) {
  return (
    <svg className={c.markSvg} data-mark={mark} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {mark === "on_track" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m5.4 8.2 1.8 1.8 3.4-3.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : mark === "at_risk" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />
        </>
      ) : mark === "past_date" ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M8 4.4v4.1M8 11.1v.3" stroke="var(--v3-surface)" strokeWidth="1.7" strokeLinecap="round" />
        </>
      ) : mark === "paused" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.4 5.6v4.8M9.6 5.6v4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : mark === "wrapped" ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5.2 8.2 1.9 1.9 3.7-4" fill="none" stroke="var(--v3-surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" />
      )}
    </svg>
  );
}

/* ── The row menu: a proper menu, arrow keys and Escape ──────────── */

type MenuItem = { id: string; label: string; hint?: string; disabled?: boolean; run?: () => void };

function RowMenu({ items, label, tabIndex }: { items: MenuItem[]; label: string; tabIndex: number }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const itemEls = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];

  useEffect(() => {
    if (!open) return;
    itemEls()[0]?.focus({ preventScroll: true });
    const onDown = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !btn.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const toggle = () => {
    if (!open && btn.current) {
      // Open upward when the menu would run off the bottom of the window.
      const below = window.innerHeight - btn.current.getBoundingClientRect().bottom;
      setUp(below < 56 * items.length + 24);
    }
    setOpen((value) => !value);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const els = itemEls();
    const at = els.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      els[(at + (event.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? els[0] : els[els.length - 1])?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close(false);
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      const starts = (el: HTMLElement) => el.textContent?.toLowerCase().startsWith(event.key.toLowerCase());
      (els.find((el, i) => i > at && starts(el)) ?? els.find(starts))?.focus();
    }
  };

  return (
    <span className={c.menuAnchor}>
      <button
        ref={btn}
        type="button"
        className={c.moreBtn}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        tabIndex={tabIndex}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor">
          <circle cx="3.5" cy="8" r="1.25" />
          <circle cx="8" cy="8" r="1.25" />
          <circle cx="12.5" cy="8" r="1.25" />
        </svg>
      </button>
      {open ? (
        <div ref={menu} className={c.menu} data-up={up || undefined} role="menu" aria-label={label} onKeyDown={onMenuKey}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabled || undefined}
              className={c.menuItem}
              data-id={item.id}
              onClick={() => {
                if (item.disabled) return;
                close();
                item.run?.();
              }}
            >
              <span className={c.menuLabel}>{item.label}</span>
              {item.hint ? <span className={c.menuHint}>{item.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

/* ── Empty ───────────────────────────────────────────────────────── */

function Empty({ filter, query, onClearQuery, onAll }: { filter: ConsoleFilter; query: string; onClearQuery: () => void; onAll: () => void }) {
  const words = consoleEmptyWords(filter, query);
  const searching = query.trim().length > 0;
  return (
    <div className={c.empty} data-kind={words.calm ? "calm" : undefined}>
      {words.calm ? (
        <span className={c.emptyMark} aria-hidden="true">
          <Mark mark="on_track" size={20} />
        </span>
      ) : null}
      <p className={c.emptyTitle}>{words.title}</p>
      <p className={c.emptyText}>{words.text}</p>
      {searching ? (
        <button type="button" className={c.emptyAction} onClick={onClearQuery}>
          Clear the search
        </button>
      ) : filter !== "all" ? (
        <button type="button" className={c.emptyAction} onClick={onAll}>
          See all projects
        </button>
      ) : null}
    </div>
  );
}

/* ── Small parts ─────────────────────────────────────────────────── */

function Arrow() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" />
    </svg>
  );
}

function PersonGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <circle cx="8" cy="5.6" r="2.4" />
      <path d="M3.4 13.2a4.6 4.6 0 0 1 9.2 0" />
    </svg>
  );
}
