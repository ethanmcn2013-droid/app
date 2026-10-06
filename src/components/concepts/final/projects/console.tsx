"use client";

/**
 * Projects, Console view: every active project as one measured row, under a
 * row of four figures that say what matters this week. Filters across the
 * top, grouped by how each project is doing. Every figure is read from the
 * demo store's selectors, so it agrees with Home, Tasks, Files and Analytics,
 * and every action (Nudge) goes back through the store.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useDemoLinks } from "../../demo/links";
import { HealthMark, healthKey } from "../../demo/health";
import {
  PROJECT_FILTERS,
  STUCK_DAYS,
  TODAY,
  ageInStatus,
  daysBetween,
  daysLate,
  fmtDate,
  fmtDay,
  fmtDays,
  lateAcrossVenue,
  nameOf,
  nextBigDay,
  personById,
  projectFilterCounts,
  projectGlance,
  projectsFiltered,
  standingSummary,
  waitingOnName,
  weekDone,
  type DemoState,
  type ProjectFilter,
  type ProjectGlance,
  type ProjectStanding,
} from "../../demo/store";
import { KIND_LABEL } from "./data";
import { nudgeTask, undo as undoStore, useDemoStore } from "../../demo/store/client";
import c from "./console.module.css";

/* ── Filters: in the address as ?show=, so a card can link to one ──── */

const SHOW: Record<ProjectFilter, string | undefined> = {
  all: undefined,
  attention: "needs-a-look",
  mine: "yours",
  events: "events",
  works: "works",
  wrapped: "wrapped",
};

const FILTER_LABEL: Record<ProjectFilter, string> = {
  all: "All",
  attention: "Needs a look",
  mine: "Led by you",
  events: "Weddings and events",
  works: "Venue and works",
  wrapped: "Wrapped",
};

const filterFrom = (show: string | null): ProjectFilter => (PROJECT_FILTERS.find((f) => SHOW[f] === show) ?? "all");

const GROUPS: { id: ProjectStanding | "wrapped"; label: string }[] = [
  { id: "attention", label: "Needs a look" },
  { id: "on_track", label: "On track" },
  { id: "too_early", label: "Too early to tell" },
  { id: "wrapped", label: "Wrapped" },
];

/** Bars and the entrance play once per tab: the first time the console is seen. */
let seenOnce = false;

const wholeState = (s: DemoState) => s;

type Toast = (text: string, undo?: () => void) => void;

export function Console({
  query,
  hydrated,
  onOpen,
  onClearQuery,
  reportOrder,
  toast,
}: {
  query: string;
  hydrated: boolean;
  onOpen: (id: string) => void;
  onClearQuery: () => void;
  reportOrder: (ids: string[]) => void;
  toast: Toast;
}) {
  const state = useDemoStore(wholeState);
  const params = useSearchParams();
  // The address says which filter; a tab answers at once and writes the address after.
  const fromUrl = filterFrom(params?.get("show") ?? null);
  const [filter, setFilterNow] = useState(fromUrl);
  const [seenUrl, setSeenUrl] = useState(fromUrl);
  if (fromUrl !== seenUrl) {
    setSeenUrl(fromUrl);
    setFilterNow(fromUrl);
  }
  const links = useDemoLinks();
  const [enter] = useState(() => !seenOnce);
  useEffect(() => {
    if (hydrated) seenOnce = true;
  }, [hydrated]);

  const counts = useMemo(() => projectFilterCounts(state), [state]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projectsFiltered(state, filter)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.short.toLowerCase().includes(q))
      .map((p) => projectGlance(state, p.id)!)
      .filter(Boolean);
  }, [state, filter, query]);

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => (r.project.wrapped ? "wrapped" : r.standing) === g.id) })).filter((g) => g.rows.length > 0),
    [rows],
  );
  const order = groups.flatMap((g) => g.rows.map((r) => r.project.id));
  const orderKey = order.join(",");
  useEffect(() => {
    reportOrder(orderKey ? orderKey.split(",") : []);
  }, [orderKey, reportOrder]);

  const setFilter = (next: ProjectFilter) => {
    setFilterNow(next);
    const url = new URL(window.location.href);
    const v = SHOW[next];
    if (v) url.searchParams.set("show", v);
    else url.searchParams.delete("show");
    window.history.replaceState(window.history.state, "", url);
  };

  if (!hydrated) return <ConsoleSkeleton />;

  return (
    <div className={c.root} data-enter={enter || undefined}>
      <FilterTabs filter={filter} counts={counts} onPick={setFilter} />
      <Cards state={state} filterHref={(f) => `${links.surface("projects")}${SHOW[f] ? `?show=${SHOW[f]}` : ""}`} onOpen={onOpen} />
      <section className={c.list} aria-label={`${FILTER_LABEL[filter]} projects`} id="console-rows">
        {groups.length === 0 ? (
          <Empty filter={filter} query={query} onClearQuery={onClearQuery} onAll={() => setFilter("all")} />
        ) : (
          <RowList groups={groups} onOpen={onOpen} toast={toast} />
        )}
      </section>
    </div>
  );
}

/* ── Filter tabs ─────────────────────────────────────────────────── */

function FilterTabs({ filter, counts, onPick }: { filter: ProjectFilter; counts: Record<ProjectFilter, number>; onPick: (f: ProjectFilter) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const at = PROJECT_FILTERS.indexOf(filter);
    const to = e.key === "ArrowRight" ? at + 1 : e.key === "ArrowLeft" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? PROJECT_FILTERS.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const next = PROJECT_FILTERS[(to + PROJECT_FILTERS.length) % PROJECT_FILTERS.length];
    onPick(next);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-filter="${next}"]`)?.focus());
  };
  // Keep the chosen tab in view when the row scrolls (phone).
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-filter="${filter}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [filter]);
  return (
    <div className={c.tabsWrap}>
      <div ref={ref} className={c.tabs} role="tablist" aria-label="Show projects" onKeyDown={onKey}>
        {PROJECT_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            data-filter={f}
            aria-selected={f === filter}
            aria-controls="console-rows"
            tabIndex={f === filter ? 0 : -1}
            className={c.tab}
            onClick={() => onPick(f)}
          >
            {FILTER_LABEL[f]}
            <span className={c.tabCount}>{counts[f]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── The four figures ────────────────────────────────────────────── */

function Cards({ state, filterHref, onOpen }: { state: DemoState; filterHref: (f: ProjectFilter) => string; onOpen: (id: string) => void }) {
  const links = useDemoLinks();
  const st = useMemo(() => standingSummary(state), [state]);
  const big = useMemo(() => nextBigDay(state), [state]);
  const late = useMemo(() => lateAcrossVenue(state), [state]);
  const week = useMemo(() => weekDone(state), [state]);
  const active = st.offTrack.length + st.atRisk.length + st.onTrack.length + st.tooEarly.length;
  const looks = st.offTrack.length + st.atRisk.length;
  const first = st.first;
  const weekMax = Math.max(1, ...week.days.map((d) => d.done));
  const today = week.days.findIndex((d) => d.day === TODAY);

  return (
    <div className={c.cards}>
      <Card
        href={filterHref("attention")}
        title="Needs a look"
        meta={`${active} active`}
        figure={looks}
        unit={looks === 1 ? "project at risk or off track" : "projects at risk or off track"}
        bar={
          <Segments
            label={`${st.offTrack.length} off track, ${st.atRisk.length} at risk, ${st.onTrack.length + st.tooEarly.length} on track`}
            parts={[
              ...st.offTrack.map((p) => ({ key: p.id, tone: "late" as const, title: `${p.name}: off track` })),
              ...st.atRisk.map((p) => ({ key: p.id, tone: "risk" as const, title: `${p.name}: at risk` })),
              ...st.onTrack.map((p) => ({ key: p.id, tone: "calm" as const, title: `${p.name}: on track` })),
              ...st.tooEarly.map((p) => ({ key: p.id, tone: "early" as const, title: `${p.name}: too early to tell` })),
            ]}
          />
        }
        caption={first ? <><strong>{first.short}</strong> first · {fmtCountdown(first.date)}</> : "Every project is on track"}
      />
      {big ? (
        <Card
          href={links.project(big.project.id)}
          onOpen={() => onOpen(big.project.id)}
          title="Next big day"
          meta={big.project.short}
          figure={big.days}
          unit={big.days === 1 ? "day to go" : "days to go"}
          bar={<Bar value={big.counts.done / Math.max(1, big.counts.total)} label={`${big.counts.done} of ${big.counts.total} tasks done`} />}
          caption={
            <>
              {fmtCountdown(big.project.date)} · <span className={c.num}>{big.counts.done}</span> of <span className={c.num}>{big.counts.total}</span> done
            </>
          }
        />
      ) : (
        <Card title="Next big day" meta="" figure={0} unit="weddings or events ahead" bar={<Bar value={0} label="" />} caption="Nothing booked yet" />
      )}
      <Card
        href={late.oldest ? links.task(late.oldest.id, "list") : links.surface("tasks/list")}
        title="Late across the venue"
        meta={`${late.byProject.length} ${late.byProject.length === 1 ? "project" : "projects"}`}
        figure={late.total}
        unit={late.total === 1 ? "task past its date" : "tasks past their date"}
        tone={late.total ? "late" : undefined}
        bar={
          <Segments
            label={late.byProject.map((x) => `${x.project.short} ${x.late}`).join(", ") || "Nothing late"}
            parts={late.byProject.map((x) => ({ key: x.project.id, tone: "late" as const, weight: x.late, title: `${x.project.name}: ${x.late} late` }))}
          />
        }
        caption={late.oldest ? <>Oldest: <strong>{late.oldest.title}</strong> · {fmtDays(daysLate(late.oldest))}</> : "Nothing is late"}
      />
      <Card
        href={links.surface("analytics")}
        title="This week"
        meta={`${fmtDate(week.days[0].day)} to ${fmtDate(week.days[6].day)}`}
        figure={week.pace.thisWeek}
        unit={week.pace.thisWeek === 1 ? "task done so far" : "tasks done so far"}
        bar={
          <Days
            days={week.days.map((d, i) => ({ key: d.day, value: d.done / weekMax, today: i === today, future: d.future, title: `${fmtDay(d.day)}: ${d.future ? "still to come" : `${d.done} done`}`, letter: fmtDay(d.day).slice(0, 1) }))}
            label={week.days.map((d) => `${fmtDay(d.day).slice(0, 3)} ${d.future ? "to come" : d.done}`).join(", ")}
          />
        }
        caption={
          <>
            <span className={c.num}>{week.pace.lastWeek}</span> last week
            {week.busiest ? (
              <>
                {" "}
                · most in <strong>{week.busiest.project.short}</strong> (<span className={c.num}>{week.busiest.done}</span>)
              </>
            ) : null}
          </>
        }
      />
    </div>
  );
}

function Card({
  href,
  onOpen,
  title,
  meta,
  figure,
  unit,
  bar,
  caption,
  tone,
}: {
  href?: string;
  onOpen?: () => void;
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
      <span className={c.cardGo} aria-hidden="true">
        <Arrow />
      </span>
    </>
  );
  if (!href) return <div className={c.card}>{body}</div>;
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      className={c.card}
      onClick={(e) => {
        if (!onOpen || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onOpen();
      }}
    >
      {body}
    </Link>
  );
}

type Tone = "late" | "risk" | "calm" | "early";

function Segments({ parts, label }: { parts: { key: string; tone: Tone; weight?: number; title: string }[]; label: string }) {
  return (
    <span className={c.segments} role="img" aria-label={label}>
      {parts.length === 0 ? <span className={c.segment} data-tone="empty" /> : null}
      {parts.map((p, i) => (
        <span key={p.key} className={c.segment} data-tone={p.tone} title={p.title} style={{ flexGrow: p.weight ?? 1, "--i": i } as CSSProperties} />
      ))}
    </span>
  );
}

function Days({ days, label }: { days: { key: string; value: number; today: boolean; future: boolean; title: string; letter: string }[]; label: string }) {
  return (
    <span className={c.days} role="img" aria-label={label}>
      {days.map((d, i) => (
        <span key={d.key} className={c.day} data-today={d.today || undefined} data-future={d.future || undefined} title={d.title} style={{ "--i": i } as CSSProperties}>
          <span className={c.dayTrack}>
            <span className={c.dayFill} style={{ "--p": d.value } as CSSProperties} />
          </span>
        </span>
      ))}
    </span>
  );
}

function Bar({ value, tone, label }: { value: number; tone?: Tone; label: string }) {
  const p = Math.max(0, Math.min(1, value));
  return (
    <span className={c.bar} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
      <span className={c.fill} data-tone={tone} style={{ "--p": p } as CSSProperties} />
    </span>
  );
}

/* ── Rows ────────────────────────────────────────────────────────── */

function RowList({ groups, onOpen, toast }: { groups: { id: string; label: string; rows: ProjectGlance[] }[]; onOpen: (id: string) => void; toast: Toast }) {
  const ids: string[] = groups.flatMap((g) => g.rows.map((r) => r.project.id));
  const [active, setActive] = useState<string | null>(null);
  const current = active && ids.includes(active) ? active : ids[0];
  const listRef = useRef<HTMLDivElement>(null);

  const focusRow = (id: string) => {
    setActive(id);
    listRef.current?.querySelector<HTMLElement>(`[data-console-row="${id}"]`)?.focus();
  };

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (!t.matches("[data-console-row]") || e.altKey || e.metaKey || e.ctrlKey) return;
    const at = ids.indexOf(t.dataset.consoleRow ?? "");
    const to =
      e.key === "ArrowDown" || e.key === "j" ? at + 1 : e.key === "ArrowUp" || e.key === "k" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? ids.length - 1 : null;
    if (to === null || to < 0 || to >= ids.length) return;
    e.preventDefault();
    focusRow(ids[to]);
  };

  let n = 0;
  return (
    <div ref={listRef} className={c.groups} onKeyDown={onKey}>
      {groups.map((g) => (
        <div key={g.id} className={c.group} role="group" aria-labelledby={`console-group-${g.id}`}>
          <h2 className={c.groupHead} id={`console-group-${g.id}`}>
            {g.label}
            <span className={c.groupCount}>{g.rows.length}</span>
          </h2>
          {g.rows.map((r) => (
            <Row key={r.project.id} g={r} index={n++} current={r.project.id === current} onFocusRow={() => setActive(r.project.id)} onOpen={onOpen} toast={toast} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Row({ g, index, current, onFocusRow, onOpen, toast }: { g: ProjectGlance; index: number; current: boolean; onFocusRow: () => void; onOpen: (id: string) => void; toast: Toast }) {
  const links = useDemoLinks();
  const router = useRouter();
  const p = g.project;
  const wrapped = !!p.wrapped;
  const lead = personById(p.lead);
  const health = wrapped ? null : healthKey(p.health, p.tooEarly && p.health === "on_track");
  const open = (e: ReactMouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(p.id);
  };

  const items: MenuItem[] = [];
  if (g.nudge) {
    items.push(
      g.nudgedToday
        ? { id: "nudge", label: `Nudged ${g.nudge.who} today`, hint: g.nudge.task.title, disabled: true }
        : {
            id: "nudge",
            label: `Nudge ${g.nudge.who}`,
            hint: g.nudge.task.title,
            run: () => {
              nudgeTask(g.nudge!.task.id);
              toast(`Nudged ${g.nudge!.who} about “${g.nudge!.task.title}”.`, () => undoStore());
            },
          },
    );
  }
  if (!wrapped) {
    items.push({ id: "tasks", label: "Open its tasks", hint: `${g.counts.open} open`, run: () => router.push(links.surface("tasks/board", undefined, { project: p.id })) });
    items.push({ id: "timeline", label: "See the timeline", hint: "Big dates and tasks in time", run: () => router.push(links.surface("overview", undefined, { project: p.id })) });
  }
  items.push({ id: "open", label: "Open the project", run: () => onOpen(p.id) });

  return (
    <div className={c.row} data-row={p.id} style={{ "--i": Math.min(index, 10) } as CSSProperties}>
      <a
        href={links.project(p.id)}
        className={c.rowLink}
        data-console-row={p.id}
        tabIndex={current ? 0 : -1}
        onFocus={onFocusRow}
        onClick={open}
        aria-label={`${p.name}. ${health ? statusText(health) : "Wrapped"}. Open the project`}
      >
        <span className={c.name}>
          <span className={c.mark}>{health ? <HealthMark health={health} size={14} label={statusText(health)} /> : <span className={c.wrappedMark} aria-hidden="true" />}</span>
          <span className={c.nameText}>{p.name}</span>
        </span>
        <span className={c.sub}>
          {KIND_LABEL[p.kind]} · {lead?.initials ?? ""}
          {p.lead === "orla" ? <span className={c.you}> · yours</span> : null}
        </span>
      </a>
      <DoneCell g={g} />
      <NextCell g={g} />
      <LateCell g={g} />
      <WaitingCell g={g} />
      <div className={c.actions}>
        <a href={links.project(p.id)} className={c.openBtn} tabIndex={current ? 0 : -1} onClick={open} aria-label={`Open ${p.name}`}>
          Open
          <Arrow />
        </a>
        <RowMenu items={items} label={`More for ${p.name}`} tabIndex={current ? 0 : -1} />
      </div>
    </div>
  );
}

function statusText(h: ReturnType<typeof healthKey>) {
  return h === "on_track" ? "On track" : h === "at_risk" ? "At risk" : h === "off_track" ? "Off track" : "Too early to tell";
}

function Cell({ label, value, bar, caption, tone }: { label: string; value: ReactNode; bar: ReactNode; caption: ReactNode; tone?: Tone }) {
  return (
    <div className={c.cell}>
      <span className={c.cellTop}>
        <span className={c.cellLabel}>{label}</span>
        <span className={c.cellValue} data-tone={tone}>
          {value}
        </span>
      </span>
      {bar}
      <span className={c.cellCaption} data-tone={tone}>
        {caption}
      </span>
    </div>
  );
}

function DoneCell({ g }: { g: ProjectGlance }) {
  const f = g.forecast;
  const { done, total } = g.counts;
  const p = g.project;
  let caption: ReactNode;
  let tone: Tone | undefined;
  if (p.wrapped) caption = `Wrapped ${fmtDate(p.wrapped.on)}`;
  else if (total === 0) caption = "No tasks yet";
  else if (f.verdict === "done") caption = done === total ? "All done" : "Only work for after the day is left";
  else if (f.verdict === "too_early") caption = "Too early to say when";
  else if (f.verdict === "behind" && f.finish) {
    tone = "risk";
    caption = `At this pace, done ${fmtDate(f.finish)}, ${fmtDays(-(f.spare ?? 0))} after its date`;
  } else if (f.verdict === "behind") {
    tone = "risk";
    caption = "Nothing finished lately, so no finish date";
  } else if (f.finish) caption = `Likely done ${fmtDay(f.finish)}, ${f.spare === 0 ? "on the day" : `${fmtDays(f.spare ?? 0)} to spare`}`;
  return (
    <Cell
      label="Done"
      value={
        <>
          <span className={c.num}>{done}</span> of <span className={c.num}>{total}</span>
        </>
      }
      bar={<Bar value={total ? done / total : 0} tone={tone} label={`${done} of ${total} tasks done`} />}
      caption={caption}
      tone={tone}
    />
  );
}

function NextCell({ g }: { g: ProjectGlance }) {
  const m = g.next;
  if (!m)
    return <Cell label="Next big date" value={<span className={c.quiet}>None</span>} bar={<Bar value={0} label="" />} caption={g.project.wrapped ? "All big dates done" : "No big dates ahead"} />;
  const n = daysBetween(TODAY, m.date);
  const late = n < 0;
  return (
    <Cell
      label="Next big date"
      value={late ? <span className={c.num}>{fmtDays(-n)} late</span> : n === 0 ? "Today" : n === 1 ? "Tomorrow" : <span className={c.num}>in {fmtDays(n)}</span>}
      bar={<Bar value={g.nextElapsed} tone={late ? "late" : undefined} label={late ? `${m.title} is ${fmtDays(-n)} late` : `${m.title} ${n === 0 ? "is today" : `in ${fmtDays(n)}`}`} />}
      caption={
        <>
          {m.title} · {fmtDay(m.date)}
        </>
      }
      tone={late ? "late" : undefined}
    />
  );
}

function LateCell({ g }: { g: ProjectGlance }) {
  const n = g.late.length;
  const oldest = g.late[0];
  return (
    <Cell
      label="Late"
      value={n ? <span className={c.num}>{n} {n === 1 ? "task" : "tasks"}</span> : <span className={c.quiet}>None</span>}
      bar={<Bar value={g.counts.open ? Math.max(n ? 0.08 : 0, n / g.counts.open) : 0} tone="late" label={n ? `${n} of ${g.counts.open} open tasks are late` : ""} />}
      caption={oldest ? <>Oldest: {oldest.title} · {fmtDays(daysLate(oldest))}</> : "Nothing late"}
      tone={n ? "late" : undefined}
    />
  );
}

function WaitingCell({ g }: { g: ProjectGlance }) {
  const t = g.waiting[0];
  if (!t) return <Cell label="Waiting on" value={<span className={c.quiet}>Nobody</span>} bar={<Bar value={0} label="" />} caption="Nothing waiting" />;
  const days = ageInStatus(t);
  const stuck = days >= STUCK_DAYS;
  const who = waitingOnName(t) ?? nameOf(t.owner);
  const nudged = g.nudgedToday && g.nudge?.task.id === t.id;
  const more = g.waiting.length - 1;
  return (
    <Cell
      label="Waiting on"
      value={<span className={c.whoValue}>{who}</span>}
      bar={<Bar value={Math.min(1, days / (STUCK_DAYS * 2))} tone={stuck ? "risk" : undefined} label={`${who}, ${fmtDays(days)}`} />}
      caption={
        <>
          <span className={c.num}>{fmtDays(days)}</span>
          {nudged ? <span className={c.nudged}> · nudged today</span> : <> · {t.title}</>}
          {more > 0 && !nudged ? <span className={c.quiet}> · {more} more</span> : null}
        </>
      }
      tone={stuck ? "risk" : undefined}
    />
  );
}

/* ── The row menu: a proper menu, arrow keys and Escape ──────────── */

type MenuItem = { id: string; label: string; hint?: string; disabled?: boolean; run?: () => void };

function RowMenu({ items, label, tabIndex }: { items: MenuItem[]; label: string; tabIndex: number }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const itemEls = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];

  useEffect(() => {
    if (!open) return;
    itemEls()[0]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const els = itemEls();
    const at = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      els[(at + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      (e.key === "Home" ? els[0] : els[els.length - 1])?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      close(false);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const hit = els.find((el, i) => i > at && el.textContent?.toLowerCase().startsWith(e.key.toLowerCase())) ?? els.find((el) => el.textContent?.toLowerCase().startsWith(e.key.toLowerCase()));
      hit?.focus();
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
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
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
        <div ref={menu} className={c.menu} role="menu" aria-label={label} onKeyDown={onMenuKey}>
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={it.disabled || undefined}
              className={c.menuItem}
              data-id={it.id}
              onClick={() => {
                if (it.disabled) return;
                close();
                it.run?.();
              }}
            >
              <span className={c.menuLabel}>{it.label}</span>
              {it.hint ? <span className={c.menuHint}>{it.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

/* ── Empty and loading ───────────────────────────────────────────── */

function Empty({ filter, query, onClearQuery, onAll }: { filter: ProjectFilter; query: string; onClearQuery: () => void; onAll: () => void }) {
  if (query.trim())
    return (
      <div className={c.empty}>
        <p className={c.emptyTitle}>No project called “{query.trim()}” here.</p>
        <p className={c.emptyText}>Check the spelling, or look across every project.</p>
        <button type="button" className={c.emptyAction} onClick={onClearQuery}>
          Clear the search
        </button>
      </div>
    );
  const words: Record<ProjectFilter, [string, string]> = {
    all: ["No projects yet.", "Start one with New project."],
    attention: ["Nothing needs a look. That is the point.", "Every project is on track. When one slips, it shows up here first."],
    mine: ["You do not lead any projects right now.", "Projects you lead show up here."],
    events: ["No weddings or events on the books.", "When one is booked, it shows up here."],
    works: ["No venue works under way.", "Repairs and upkeep show up here."],
    wrapped: ["Nothing wrapped yet.", "Finished projects rest here."],
  };
  const [title, text] = words[filter];
  return (
    <div className={c.empty} data-kind={filter === "attention" ? "calm" : undefined}>
      {filter === "attention" ? (
        <span className={c.emptyMark} aria-hidden="true">
          <HealthMark health="on_track" size={20} />
        </span>
      ) : null}
      <p className={c.emptyTitle}>{title}</p>
      <p className={c.emptyText}>{text}</p>
      {filter !== "all" ? (
        <button type="button" className={c.emptyAction} onClick={onAll}>
          See all projects
        </button>
      ) : null}
    </div>
  );
}

export function ConsoleSkeleton() {
  return (
    <div className={c.root} aria-busy="true" aria-label="Loading projects">
      <div className={c.tabsWrap}>
        <div className={c.tabs}>
          {[44, 104, 92, 150, 120, 76].map((w, i) => (
            <span key={i} className={c.skelTab} style={{ width: w }} />
          ))}
        </div>
      </div>
      <div className={c.cards}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={c.card} data-skeleton="">
            <span className={c.skelLine} style={{ width: "46%" }} />
            <span className={c.skelBig} />
            <span className={c.skelBar} />
            <span className={c.skelLine} style={{ width: "72%" }} />
          </div>
        ))}
      </div>
      <div className={c.list}>
        <div className={c.groups}>
          <div className={c.group}>
            <span className={c.skelLine} style={{ width: 110, height: 12, margin: "6px 0 10px" }} />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={c.row} data-skeleton="">
                <span className={c.rowLink}>
                  <span className={c.skelLine} style={{ width: "70%" }} />
                  <span className={c.skelLine} style={{ width: "40%", marginTop: 8 }} />
                </span>
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className={c.cell}>
                    <span className={c.skelLine} style={{ width: "80%" }} />
                    <span className={c.skelBar} />
                    <span className={c.skelLine} style={{ width: "60%" }} />
                  </div>
                ))}
                <div className={c.actions} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Small parts ─────────────────────────────────────────────────── */

/** "in 8 days · Sat 3 Oct", "today · Fri 25 Sep", "3 days ago · Tue 22 Sep". */
function fmtCountdown(iso: string) {
  const n = daysBetween(TODAY, iso);
  const rel = n === 0 ? "today" : n === 1 ? "tomorrow" : n > 0 ? `in ${fmtDays(n)}` : `${fmtDays(-n)} ago`;
  return `${rel} · ${fmtDay(iso)}`;
}

function Arrow() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />
    </svg>
  );
}
