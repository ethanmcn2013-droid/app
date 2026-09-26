"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import s from "./ledger.module.css";
import {
  ME,
  PEOPLE,
  SEED_PROJECTS,
  STATUS_LABEL,
  TEMPLATES,
  addDays,
  daysFromToday,
  isPastDue,
  nextMilestone,
  sum,
  type KindId,
  type PersonId,
  type Project,
  type StatusId,
} from "./data";
import {
  DEFAULT_COLS,
  VIEWS,
  fitColumns,
  applyFilters,
  emptyMessage,
  filterKey,
  filterParts,
  groupProjects,
  sortProjects,
  type ColId,
  type ColState,
  type Filter,
  type GroupId,
  type Sort,
  type ViewId,
  GROUPS,
} from "./model";
import { Avatar, Icon, Kbd, StatusGlyph, trend } from "./parts";
import {
  DateEditor,
  DisplayMenu,
  FilterBar,
  GroupMenu,
  OwnerMenu,
  Popover,
  StatusEditor,
  rectOf,
  type DatePreview,
  type PreviewState,
  type Rect,
} from "./popovers";
import { LedgerTable, SkeletonRows, statusWhy, type EditKind, type Item } from "./table";
import { Peek } from "./peek";
import { CompareView } from "./compare";
import { Hub } from "./hub";
import { CommandMenu, type Command } from "./command";
import { CreateRow, type Draft } from "./create";
import { MobileList } from "./mobile";

type PopKind = EditKind | "group" | "display" | "filter" | "keys";
type Pop = { kind: PopKind; ids: string[]; rect: Rect; side?: "below" | "left" };
type Toast = { id: number; text: string; undo?: () => void };

const PHONE = "(max-width: 720px)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useIsPhone() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

/** Content width of an element, tracked with a ResizeObserver. */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export default function ProjectLedgerConcept() {
  return (
    <MotionConfig reducedMotion="user">
      <Ledger />
    </MotionConfig>
  );
}

let toastSeq = 0;
let projectSeq = 0;

function Ledger() {
  const isPhone = useIsPhone();
  const rootRef = useRef<HTMLDivElement>(null);
  const filterBtn = useRef<HTMLButtonElement>(null);
  const groupBtn = useRef<HTMLButtonElement>(null);
  const displayBtn = useRef<HTMLButtonElement>(null);
  const keysBtn = useRef<HTMLButtonElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const areaWidth = useWidth(areaRef);

  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS);
  const [view, setView] = useState<ViewId>("active");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [groupBy, setGroupBy] = useState<GroupId>("none");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [cols, setCols] = useState<ColState[]>(DEFAULT_COLS);
  const [sort, setSort] = useState<Sort>({ col: "date", dir: 1 });
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[] | null>(null);
  // Bumped when compare closes, so the rows' glyphs and names remount and fly back into place.
  const [flyBack, setFlyBack] = useState(0);
  const [cmpClosing, setCmpClosing] = useState(false);
  const closeCompare = () => {
    if (cmpClosing) return;
    // Two steps: compare stays on screen for one frame of the flight while the rows remount and
    // take over its glyphs and names, then it leaves.
    setCmpClosing(true);
    setFlyBack((n) => n + 1);
    window.setTimeout(() => {
      setCompareIds(null);
      setCmpClosing(false);
    }, 260);
  };
  const [hubId, setHubId] = useState<string | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [creating, setCreating] = useState<{ kind: KindId; name?: string; key: number } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cmdk, setCmdk] = useState(false);
  // Until the first shortcut is used, the shortcuts button spells itself out; after that it folds to "?".
  const [usedKeys, setUsedKeys] = useState(false);
  const chord = useRef<{ key: string; at: number } | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<PreviewState>("live");
  const [booting, setBooting] = useState(true);
  const [datePreview, setDatePreview] = useState<DatePreview | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setBooting(false), 650);
    return () => window.clearTimeout(t);
  }, []);

  /* ── Derived ─────────────────────────────────────────────────────── */

  const live = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  const activeProjects = live.filter((p) => p.status !== "wrapped");
  const viewDef = VIEWS.find((v) => v.id === view)!;
  const inView = useMemo(() => live.filter(viewDef.test), [live, viewDef]);
  const filtered = useMemo(() => applyFilters(inView, filters), [inView, filters]);
  const sorted = useMemo(() => sortProjects(filtered, sort), [filtered, sort]);
  const groups = useMemo(() => groupProjects(sorted, groupBy), [sorted, groupBy]);
  const items: Item[] = useMemo(
    () =>
      groupBy === "none"
        ? sorted.map((project) => ({ type: "row" as const, project }))
        : groups.flatMap((group) => [
            { type: "group" as const, group, collapsed: collapsed.has(group.key) },
            ...(collapsed.has(group.key) ? [] : group.projects.map((project) => ({ type: "row" as const, project }))),
          ]),
    [groupBy, sorted, groups, collapsed],
  );
  const rows = useMemo(() => items.flatMap((i) => (i.type === "row" ? [i.project] : [])), [items]);
  // Column priority: at narrower widths the lowest-priority columns step aside.
  const visibleCols = areaWidth ? fitColumns(cols, areaWidth).cols : cols.filter((c) => !c.hidden);
  const byId = (id: string | null) => (id ? projects.find((p) => p.id === id) : undefined);
  const peekProject = byId(peekId);
  const hubProject = byId(hubId);
  const zero = preview === "empty";
  const loading = !zero && (booting || preview === "loading");

  const counts = {
    risk: activeProjects.filter((p) => p.status === "at_risk").length,
    off: activeProjects.filter((p) => p.status === "off_track").length,
    past: activeProjects.filter(isPastDue).length,
  };
  const attention = counts.risk + counts.off;
  const mineCount = activeProjects.filter((p) => p.owner === ME).length;

  /* Footer sums follow the rows on screen, or the selection when there is one. */
  const selectedRows = rows.filter((p) => selected.has(p.id));
  const sumOf = selectedRows.length ? selectedRows : rows;
  const tDone = sum(sumOf.map((p) => p.done));
  const tTotal = sum(sumOf.map((p) => p.total));
  const tLate = sum(sumOf.map((p) => p.overdue));
  const tNet = sum(sumOf.map((p) => sum(p.sparkAdded) - sum(p.sparkDone)));
  const tTrend = trend(tNet);
  const tSoon = sumOf.filter((p) => {
    const d = daysFromToday(p.date);
    return p.status !== "wrapped" && d >= 0 && d <= 30;
  }).length;
  const tMs = sumOf.filter((p) => {
    const m = nextMilestone(p);
    if (!m) return false;
    const d = daysFromToday(m.date);
    return d >= 0 && d <= 7;
  }).length;
  const tRisk = sumOf.filter((p) => p.status === "at_risk").length;
  const tOff = sumOf.filter((p) => p.status === "off_track").length;
  const tPast = sumOf.filter(isPastDue).length;
  const totals = {
    name: (
      <span className={s.tfLead}>
        {selectedRows.length ? `${selectedRows.length} selected` : `${rows.length} ${rows.length === 1 ? "project" : "projects"}`}
      </span>
    ),
    status: (
      <span className={s.tfStatus} aria-label={`${tOff} off track, ${tRisk} at risk, ${tPast} past date`}>
        {tOff > 0 && (
          <span>
            <StatusGlyph status="off_track" /> {tOff}
          </span>
        )}
        {tRisk > 0 && (
          <span>
            <StatusGlyph status="at_risk" /> {tRisk}
          </span>
        )}
        {tPast > 0 && (
          <span>
            <Icon.clock size={12} /> {tPast}
          </span>
        )}
        {tOff + tRisk + tPast === 0 && "All on track"}
      </span>
    ),
    health: (
      <span className={s.tfTrend} data-dir={tTrend.dir}>
        {tTrend.dir === "down" ? "↓ " : tTrend.dir === "up" ? "↑ " : ""}
        {tTrend.words}
      </span>
    ),
    progress: (
      <span>
        {tDone}
        <span className={s.progressOf}>/{tTotal}</span>
        {tLate > 0 && <span className={s.tfLate}> · {tLate} late</span>}
      </span>
    ),
    milestone: <span>{tMs === 0 ? "None due this week" : `${tMs} due this week`}</span>,
    date: <span>{tSoon === 0 ? "None in 30 days" : `${tSoon} in the next 30 days`}</span>,
  };

  /** Saved views scroll sideways when they run out of room; a fade marks the hidden end. */
  const markOverflow = (el: HTMLElement | null) => {
    if (!el) return;
    el.dataset.more = el.scrollWidth - el.clientWidth - el.scrollLeft > 2 ? "end" : "";
  };

  /* ── Helpers ─────────────────────────────────────────────────────── */

  const toast = (text: string, undo?: () => void) => {
    const id = ++toastSeq;
    setToasts((t) => [...t.slice(-2), { id, text, undo }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  };

  const usedShortcut = () => {
    if (!usedKeys) setUsedKeys(true);
  };

  /* Quick filters in the header: each toggles, and G then N, P or M reaches it from the keyboard.
     (G then A belongs to the app launcher everywhere, so it is left alone.) */
  const PAST: Filter = { field: "past", value: "yes" };
  const quick = {
    attention: view === "risk" && filters.length === 0,
    past: view === "active" && filters.length === 1 && filterKey(filters[0]) === filterKey(PAST) && !filters[0].negate,
    mine: view === "mine" && filters.length === 0,
  };
  const applyQuick = (k: keyof typeof quick) => {
    setSelected(new Set());
    if (quick[k]) {
      setView("active");
      setFilters([]);
      return;
    }
    if (k === "attention") {
      setView("risk");
      setFilters([]);
    } else if (k === "past") {
      setView("active");
      setFilters([PAST]);
    } else {
      setView("mine");
      setFilters([]);
    }
  };

  const focusRoot = () => rootRef.current?.focus({ preventScroll: true });

  const closePop = () => {
    setPop(null);
    setDatePreview(null);
    focusRoot();
  };

  const patch = (ids: string[], fn: (p: Project) => Project) => {
    const before = projects;
    setProjects((ps) => ps.map((p) => (ids.includes(p.id) ? fn(p) : p)));
    return () => setProjects(before);
  };

  const setStatus = (ids: string[], status: StatusId, reason: string) => {
    const text = reason || `Marked ${STATUS_LABEL[status].toLowerCase()}`;
    const undo = patch(ids, (p) => ({
      ...p,
      status,
      statusReason: reason || (status === "on_track" ? "Back on track." : status === "wrapped" ? "Wrapped up." : p.statusReason),
      history: [...p.history, { status, date: "2026-09-25", by: ME, reason: text }],
      activity: [{ id: `a-${Date.now()}-${p.id}`, who: ME, text, minsAgo: 0, kind: "status" }, ...p.activity],
      updatedMins: 0,
      updatedBy: ME,
    }));
    const who = ids.length === 1 ? byId(ids[0])?.name : `${ids.length} projects`;
    toast(
      reason ? `${who}: ${STATUS_LABEL[status].toLowerCase()}. Your reason is posted as an update.` : `${who} marked ${STATUS_LABEL[status].toLowerCase()}.`,
      undo,
    );
  };

  const setOwner = (ids: string[], owner: PersonId) => {
    const undo = patch(ids, (p) => ({
      ...p,
      owner,
      people: p.people.includes(owner) ? p.people : [owner, ...p.people],
      updatedMins: 0,
      updatedBy: ME,
    }));
    toast(`${PEOPLE[owner].short} now owns ${ids.length === 1 ? byId(ids[0])?.name : `${ids.length} projects`}.`, undo);
  };

  const commitDate = (plan: DatePreview) => {
    const undo = patch(plan.ids, (p) => ({
      ...p,
      date: plan.iso ?? addDays(p.date, plan.delta ?? 0),
      updatedMins: 0,
      updatedBy: ME,
    }));
    toast(
      plan.ids.length > 1
        ? `Moved ${plan.ids.length} dates by ${plan.delta! > 0 ? "+" : ""}${plan.delta} days.`
        : `Date moved for ${byId(plan.ids[0])?.name}.`,
      undo,
    );
  };

  const archive = (ids: string[]) => {
    const undo = patch(ids, (p) => ({ ...p, archived: true }));
    setSelected(new Set());
    if (peekId && ids.includes(peekId)) setPeekId(null);
    toast(`Archived ${ids.length === 1 ? byId(ids[0])?.name : `${ids.length} projects`}.`, undo);
  };

  const wrap = (id: string) => setStatus([id], "wrapped", "");

  const create = (d: Draft) => {
    const tpl = TEMPLATES.find((t) => t.kind === d.kind);
    const id = `new-${++projectSeq}`;
    const tones = [1, 2, 3, 4, 5, 6, 7, 8];
    const p: Project = {
      id,
      name: d.name,
      purpose: "A new project. Add a line about what it's for.",
      kind: d.kind,
      tone: tones[(projects.length + projectSeq) % 8],
      status: "on_track",
      statusReason: "Just created.",
      history: [{ status: "on_track", date: "2026-09-25", by: ME, reason: "Created." }],
      owner: d.owner,
      people: d.owner === ME ? [ME] : [d.owner, ME],
      start: "2026-09-25",
      date: d.date,
      done: 0,
      total: tpl?.tasks ?? 0,
      overdue: 0,
      sparkDone: Array(14).fill(0),
      sparkAdded: [...Array(13).fill(0), tpl?.tasks ?? 0],
      milestones: [{ id: `${id}-m`, name: "Kick-off", date: addDays("2026-09-25", 3), done: false }],
      tasks: [],
      links: [],
      activity: [{ id: `${id}-a`, who: ME, text: "Created the project", minsAgo: 0, kind: "task" }],
      updatedMins: 0,
      updatedBy: ME,
      isNew: true,
    };
    setProjects((ps) => [p, ...ps]);
    setCreating(null);
    if (view === "wrapped" || view === "risk") setView("active");
    setFilters([]);
    setCursor(id);
    setFlashId(id);
    if (zero) setPreview("live");
    window.setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1800);
    toast(`Created ${d.name}.`);
    focusRoot();
  };

  const openEditor = (kind: PopKind, ids: string[], el?: Element | null) => {
    let target = el ?? null;
    const cell = ids[0] ? document.querySelector(`[data-row="${ids[0]}"] [data-col="${kind}"]`) : null;
    if (!target && cell) target = cell.querySelector("button");
    // Date edits sit beside the date column, so the ghost preview stays visible.
    const beside = kind === "date" && !isPhone && !hubId && cell && (ids.length > 1 || target?.closest("[data-row]"));
    if (beside) target = cell;
    const rect = rectOf(target) ?? { x: window.innerWidth / 2 - 140, y: 160, w: 0, h: 0 };
    setPop({ kind, ids, rect, side: beside ? "left" : "below" });
  };

  const moveCursor = (d: 1 | -1) => {
    if (!rows.length) return;
    const i = rows.findIndex((p) => p.id === cursor);
    const next = i < 0 ? (d === 1 ? rows[0] : rows[rows.length - 1]) : rows[Math.max(0, Math.min(rows.length - 1, i + d))];
    setCursor(next.id);
    if (peekId) setPeekId(next.id);
  };

  const toggleSelect = (id: string, range = false) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && anchor) {
        const a = rows.findIndex((p) => p.id === anchor);
        const b = rows.findIndex((p) => p.id === id);
        if (a >= 0 && b >= 0) {
          for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(rows[i].id);
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAnchor(id);
    setCursor(id);
  };

  const startCompare = () => {
    const ids = rows.filter((p) => selected.has(p.id)).map((p) => p.id);
    if (isPhone) return;
    if (ids.length < 2 || ids.length > 3) {
      toast(ids.length > 3 ? "Compare works with two or three projects." : "Select two or three projects with X, then press C.");
      return;
    }
    setPeekId(null);
    setCompareIds(ids);
  };

  const startCreate = (kind: KindId = "event", name?: string) => {
    setHubId(null);
    setCompareIds(null);
    setPeekId(null);
    setCreating({ kind, name, key: Date.now() });
    rootRef.current?.querySelector("[data-scroller]")?.scrollTo({ top: 0 });
  };

  const toggleFilter = (f: Filter) => {
    setFilters((fs) => (fs.some((x) => filterKey(x) === filterKey(f)) ? fs.filter((x) => filterKey(x) !== filterKey(f)) : [...fs, f]));
  };

  /* ── Keyboard ────────────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      // A ticked row checkbox keeps focus, but the ledger keys should still work from it.
      const toggle = tag === "INPUT" && ["checkbox", "radio"].includes((t as HTMLInputElement).type);
      const typing = (tag === "INPUT" && !toggle) || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && !e.shiftKey && e.key.toLowerCase() === "k") {
        // Our own command menu while the ledger is on screen.
        e.preventDefault();
        e.stopPropagation();
        setPop(null);
        setCmdk((o) => !o);
        usedShortcut();
        return;
      }
      if (pop && e.key === "Escape" && !typing) {
        e.preventDefault();
        closePop();
        return;
      }
      if (typing || cmdk || pop || meta || e.altKey) return;
      if ((e.key === "Enter" || e.key === " ") && (tag === "BUTTON" || toggle)) return;

      if (hubId) {
        if (e.key === "Escape") {
          e.preventDefault();
          setHubId(null);
        }
        return;
      }
      if (compareIds) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeCompare();
        }
        return;
      }
      const target = cursor ?? rows[0]?.id ?? null;
      const editIds = selected.size ? rows.filter((p) => selected.has(p.id)).map((p) => p.id) : target ? [target] : [];
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const pending = chord.current && Date.now() - chord.current.at < 1200 ? chord.current.key : null;
      chord.current = null;
      if (pending === "g" && (key === "n" || key === "p" || key === "m")) {
        e.preventDefault();
        applyQuick(key === "n" ? "attention" : key === "p" ? "past" : "mine");
        usedShortcut();
        return;
      }
      let handled = true;
      switch (key) {
        case "g":
          chord.current = { key: "g", at: Date.now() };
          break;
        case "?":
          openEditor("keys", [], keysBtn.current);
          break;
        case "j":
        case "ArrowDown":
          moveCursor(1);
          break;
        case "k":
        case "ArrowUp":
          moveCursor(-1);
          break;
        case "x":
          if (target) toggleSelect(target, e.shiftKey);
          break;
        case " ":
          if (target) {
            setCursor(target);
            setPeekId((p) => (p === target ? null : target));
          }
          break;
        case "Enter":
          if (target) setHubId(target);
          break;
        case "s":
          if (editIds.length) openEditor("status", editIds);
          break;
        case "d":
          if (editIds.length) openEditor("date", editIds);
          break;
        case "o":
          if (editIds.length) openEditor("owner", editIds);
          break;
        case "c":
          startCompare();
          break;
        case "/":
          openEditor("filter", [], filterBtn.current);
          break;
        case "n":
          startCreate();
          break;
        case "Escape":
          if (peekId) setPeekId(null);
          else if (selected.size) setSelected(new Set());
          else if (creating) setCreating(null);
          else handled = false;
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        usedShortcut();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => markOverflow(el));
    ro.observe(el);
    return () => ro.disconnect();
    // markOverflow only touches the element's dataset; re-run when the ledger view remounts.
  }, [hubId]);

  useEffect(() => {
    if (!cursor) return;
    document.querySelector(`[data-row="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  /* ── Pieces ──────────────────────────────────────────────────────── */

  const popProjects = pop ? pop.ids.map((id) => byId(id)).filter(Boolean) as Project[] : [];
  // Rows that can fly into compare: two or three selected, or the ones compare is showing.
  const fly = new Set<string>(compareIds ?? (selected.size >= 2 && selected.size <= 3 ? [...selected] : []));
  const single = popProjects.length === 1 ? popProjects[0] : undefined;
  const selectedIds = rows.filter((p) => selected.has(p.id)).map((p) => p.id);
  const hasFilters = filters.length > 0;

  const header = (
    <header className={s.header}>
      <div className={s.titleRow}>
        <div className={s.titleBlock}>
          <h1 className={s.h1}>Projects</h1>
        </div>
        <div className={s.titleActions}>
          {!isPhone && (
            <>
              <button
                ref={keysBtn}
                type="button"
                className={s.btnGhost}
                data-folded={usedKeys || undefined}
                aria-label="Keyboard shortcuts"
                aria-keyshortcuts="?"
                onClick={(e) => openEditor("keys", [], e.currentTarget)}
              >
                {!usedKeys && <span>Shortcuts</span>}
                <Kbd>?</Kbd>
              </button>
              <button type="button" className={s.btnGhost} onClick={() => setCmdk(true)}>
                <Icon.search size={14} /> Commands <Kbd>⌘K</Kbd>
              </button>
            </>
          )}
          <button type="button" className={s.btnPrimary} onClick={() => startCreate()} aria-keyshortcuts="n">
            <Icon.plus size={14} /> {isPhone ? "New" : "New project"} {!isPhone && <Kbd>N</Kbd>}
          </button>
        </div>
      </div>
      {!zero && (
        <div className={s.quick} role="group" aria-label="Quick filters">
          {attention > 0 && (
            <button type="button" className={s.quickBtn} aria-pressed={quick.attention} aria-keyshortcuts="g n" title="G then N" onClick={() => applyQuick("attention")}>
              <span className={s.quickGlyphs} aria-hidden="true">
                {counts.off > 0 && <StatusGlyph status="off_track" />}
                {counts.risk > 0 && <StatusGlyph status="at_risk" />}
              </span>
              {attention} need{attention === 1 ? "s" : ""} attention
            </button>
          )}
          {counts.past > 0 && (
            <button type="button" className={s.quickBtn} aria-pressed={quick.past} aria-keyshortcuts="g p" title="G then P" onClick={() => applyQuick("past")}>
              <Icon.clock size={13} className={s.quickClock} />
              {counts.past} past {counts.past === 1 ? "its" : "their"} date
            </button>
          )}
          <button type="button" className={s.quickBtn} aria-pressed={quick.mine} aria-keyshortcuts="g m" title="G then M" onClick={() => applyQuick("mine")}>
            <Avatar who={ME} size={16} />
            {mineCount} yours
          </button>
        </div>
      )}
      <div className={s.toolbar}>
        <div className={s.tabs} ref={tabsRef} role="tablist" aria-label="Saved views" onScroll={(e) => markOverflow(e.currentTarget)}>
          {VIEWS.map((v) => {
            const n = live.filter(v.test).length;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                className={s.tab}
                onClick={() => {
                  setView(v.id);
                  setSelected(new Set());
                }}
              >
                {v.label}
                <span className={s.tabCount}>{zero ? 0 : n}</span>
              </button>
            );
          })}
        </div>
        <div className={s.tools}>
          {!isPhone && (
            <div className={s.chips} aria-label="Active filters">
              <AnimatePresence initial={false}>
                {filters.map((f) => {
                  const parts = filterParts(f);
                  return (
                    <motion.span
                      key={filterKey(f)}
                      className={s.chip}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.14 }}
                    >
                      <span className={s.chipField}>{parts.field}</span>
                      <button
                        type="button"
                        className={s.chipOp}
                        title="Flip this filter"
                        onClick={() => setFilters((fs) => fs.map((x) => (filterKey(x) === filterKey(f) ? { ...x, negate: !x.negate } : x)))}
                      >
                        {parts.op}
                      </button>
                      {parts.value && <span className={s.chipValue}>{parts.value}</span>}
                      <button type="button" className={s.chipX} aria-label={`Remove filter ${parts.field} ${parts.op} ${parts.value}`} onClick={() => toggleFilter(f)}>
                        <Icon.close size={12} />
                      </button>
                    </motion.span>
                  );
                })}
              </AnimatePresence>
              {filters.length > 1 && (
                <button type="button" className={s.clearLink} onClick={() => setFilters([])}>
                  Clear
                </button>
              )}
            </div>
          )}
          <button
            ref={filterBtn}
            type="button"
            className={s.toolBtn}
            data-on={hasFilters || undefined}
            aria-keyshortcuts="/"
            onClick={(e) => openEditor("filter", [], e.currentTarget)}
          >
            <Icon.filter size={14} /> {isPhone && hasFilters ? `Filters ${filters.length}` : "Filter"} {!isPhone && <Kbd>/</Kbd>}
          </button>
          <button ref={groupBtn} type="button" className={s.toolBtn} data-on={groupBy !== "none" || undefined} onClick={(e) => openEditor("group", [], e.currentTarget)}>
            <Icon.group size={14} />
            {groupBy === "none" ? "Group" : `Group: ${GROUPS.find((g) => g.id === groupBy)!.label.toLowerCase()}`}
          </button>
          {!isPhone && (
            <button ref={displayBtn} type="button" className={s.toolBtn} aria-label="Display options" onClick={(e) => openEditor("display", [], e.currentTarget)}>
              <Icon.display size={14} />
            </button>
          )}
        </div>
      </div>
      {isPhone && hasFilters && (
        <div className={s.mChips}>
          {filters.map((f) => {
            const parts = filterParts(f);
            return (
              <button key={filterKey(f)} type="button" className={s.chip} onClick={() => toggleFilter(f)} aria-label={`Remove filter ${parts.field} ${parts.op} ${parts.value}`}>
                <span className={s.chipField}>{parts.field}</span> <span className={s.chipOpStatic}>{parts.op}</span> <span className={s.chipValue}>{parts.value}</span>
                <Icon.close size={12} />
              </button>
            );
          })}
        </div>
      )}
    </header>
  );

  const createRow = creating ? (
    <CreateRow
      key={creating.key}
      initialKind={creating.kind}
      initialName={creating.name}
      onCommit={create}
      onCancel={() => {
        setCreating(null);
        focusRoot();
      }}
    />
  ) : null;

  const noResults = !loading && !zero && rows.length === 0 && items.length === 0 && (
    <div className={s.noResults}>
      <span className={s.noResultsIcon}>
        <Icon.filter size={16} />
      </span>
      <p className={s.noResultsText}>{emptyMessage(filters, view)}</p>
      {hasFilters ? (
        <button type="button" className={s.btnGhostSm} onClick={() => setFilters([])}>
          Clear {filters.length === 1 ? "filter" : "filters"}
        </button>
      ) : (
        <button type="button" className={s.btnGhostSm} onClick={() => setView("active")}>
          See all active projects
        </button>
      )}
    </div>
  );

  let body;
  if (isPhone) {
    body = loading ? (
      <ul className={s.mList} aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <li key={i} className={s.mRow} data-skeleton>
            <span className={s.skel} style={{ width: 14, height: 14 }} />
            <span className={s.mSkelLines}>
              <span className={s.skel} style={{ width: `${50 + ((i * 17) % 30)}%` }} />
              <span className={s.skel} style={{ width: `${35 + ((i * 11) % 25)}%` }} />
            </span>
          </li>
        ))}
      </ul>
    ) : zero ? (
      <div className={s.zeroPhone}>
        <p className={s.zeroTitle}>No projects yet</p>
        <p className={s.zeroText}>A project holds the tasks, dates and people for one piece of work: a wedding, a refit, a launch.</p>
        <CreateRow hero onCommit={create} onCancel={() => {}} />
      </div>
    ) : (
      <>
        {createRow}
        {noResults}
        <MobileList
          items={items}
          selected={selected}
          flashId={flashId}
          onOpen={(id) => {
            setCursor(id);
            setPeekId(id);
          }}
          onToggleSelect={(id) => toggleSelect(id)}
          onToggleGroup={(k) => setCollapsed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
          onWrap={wrap}
        />
      </>
    );
  } else if (loading || zero) {
    body = (
      <div className={s.tableShell} data-zero={zero || undefined}>
        <LedgerTable
          items={[]}
          cols={visibleCols}
          sort={sort}
          onSort={() => {}}
          cursor={null}
          selected={new Set()}
          peekId={null}
          flashId={null}
          datePreview={null}
          onRowClick={() => {}}
          onToggleSelect={() => {}}
          onSelectAll={() => {}}
          allSelected={false}
          onOpen={() => {}}
          onEdit={() => {}}
          onToggleGroup={() => {}}
          onWrap={() => {}}
          onResize={() => {}}
          onReorder={() => {}}
          grouped={false}
          createRow={<SkeletonRows cols={visibleCols} n={zero ? 7 : 11} ghost={zero} />}
        />
        {zero && (
          <div className={s.zeroCard}>
            <p className={s.zeroTitle}>No projects yet</p>
            <p className={s.zeroText}>A project holds the tasks, dates and people for one piece of work. Name one and it lands here as a row you can steer.</p>
            <CreateRow hero onCommit={create} onCancel={() => {}} />
            <div className={s.zeroTpl}>
              <span className={s.zeroTplLabel}>Or start from</span>
              {TEMPLATES.slice(0, 4).map((t) => (
                <button key={t.id} type="button" className={s.tplChip} onClick={() => { setPreview("live"); startCreate(t.kind, `${t.name}, `); }}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  } else {
    body = (
      <>
        <LedgerTable
          items={items}
          cols={visibleCols}
          sort={sort}
          onSort={(c) => setSort((cur) => (cur.col === c ? { col: c, dir: cur.dir === 1 ? -1 : 1 } : { col: c, dir: 1 }))}
          cursor={cursor}
          selected={selected}
          peekId={peekId}
          flashId={flashId}
          datePreview={datePreview}
          editing={pop && (pop.kind === "date" || pop.kind === "status" || pop.kind === "owner") ? { kind: pop.kind, ids: pop.ids } : null}
          totals={totals}
          totalsHidden={selectedRows.length > 0}
          fly={fly}
          flyKey={flyBack}
          flying={cmpClosing}
          onRowClick={(id) => {
            setCursor(id);
            setPeekId(id);
          }}
          onToggleSelect={toggleSelect}
          onSelectAll={() => setSelected((sel) => (rows.length && rows.every((p) => sel.has(p.id)) ? new Set() : new Set(rows.map((p) => p.id))))}
          allSelected={rows.length > 0 && rows.every((p) => selected.has(p.id))}
          onOpen={(id) => setHubId(id)}
          onEdit={(kind, id, el) => {
            setCursor(id);
            openEditor(kind, selected.has(id) && selected.size > 1 ? selectedIds : [id], el);
          }}
          onToggleGroup={(k) => setCollapsed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
          onWrap={wrap}
          onResize={(id: ColId, w) => setCols((cs) => cs.map((c) => (c.id === id ? { ...c, width: w } : c)))}
          onReorder={(from, to) =>
            setCols((cs) => {
              const next = cs.filter((c) => c.id !== from);
              const at = next.findIndex((c) => c.id === to);
              const fromIdx = cs.findIndex((c) => c.id === from);
              const toIdx = cs.findIndex((c) => c.id === to);
              next.splice(fromIdx < toIdx ? at + 1 : at, 0, cs.find((c) => c.id === from)!);
              return next;
            })
          }
          grouped={groupBy !== "none"}
          createRow={createRow}
        />
        {noResults}
      </>
    );
  }

  return (
    <div className={s.root} ref={rootRef} tabIndex={-1} data-phone={isPhone || undefined}>
      {hubProject ? (
        <div className={s.scroller} data-scroller>
          <Hub
            project={hubProject}
            onBack={() => {
              setHubId(null);
              setCursor(hubProject.id);
            }}
            onEdit={(kind, el) => openEditor(kind, [hubProject.id], el)}
            onToggleMilestone={(mid) =>
              setProjects((ps) =>
                ps.map((p) =>
                  p.id === hubProject.id ? { ...p, milestones: p.milestones.map((m) => (m.id === mid ? { ...m, done: !m.done } : m)), updatedMins: 0, updatedBy: ME } : p,
                ),
              )
            }
            onPost={(text) =>
              setProjects((ps) =>
                ps.map((p) =>
                  p.id === hubProject.id
                    ? { ...p, activity: [{ id: `a-${Date.now()}`, who: ME, text, minsAgo: 0, kind: "note" }, ...p.activity], updatedMins: 0, updatedBy: ME }
                    : p,
                ),
              )
            }
          />
        </div>
      ) : (
        <motion.div className={s.scroller} data-scroller layoutScroll>
          {header}
          <div className={s.tableArea} ref={areaRef}>
            {body}
          </div>
          <div className={s.bottomSpace} />
        </motion.div>
      )}

      <AnimatePresence>
        {peekProject && !hubId && !compareIds && (
          <Peek
            key={isPhone ? "sheet" : "panel"}
            project={peekProject}
            index={Math.max(0, rows.findIndex((p) => p.id === peekProject.id))}
            total={rows.length}
            mobile={isPhone}
            onClose={() => {
              setPeekId(null);
              focusRoot();
            }}
            onOpen={() => setHubId(peekProject.id)}
            onStep={moveCursor}
            onEdit={(kind, el) => openEditor(kind, [peekProject.id], el)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {compareIds && !hubId && (
          <CompareView
            projects={compareIds.map((id) => byId(id)).filter(Boolean) as Project[]}
            pool={rows.length >= 2 ? rows : activeProjects}
            onChange={setCompareIds}
            onClose={closeCompare}
            closing={cmpClosing}
            onOpen={(id) => {
              setCompareIds(null);
              setHubId(id);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedIds.length > 0 && !hubId && !compareIds && (
          <motion.div
            className={s.bulk}
            data-peek={(peekProject && !isPhone) || undefined}
            role="toolbar"
            aria-label="Selected projects"
            initial={{ opacity: 0, y: 16, x: isPhone ? 0 : "-50%" }}
            animate={{ opacity: 1, y: 0, x: isPhone ? 0 : "-50%" }}
            exit={{ opacity: 0, y: 16, x: isPhone ? 0 : "-50%" }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
          >
            <span className={s.bulkCount}>
              <span className={s.bulkNum}>{selectedIds.length}</span> selected
              {!isPhone && (
                <span className={s.bulkSum}>
                  {tDone}/{tTotal} done{tLate > 0 && <span className={s.tfLate}>, {tLate} late</span>}
                </span>
              )}
            </span>
            <span className={s.bulkSep} />
            <button type="button" className={s.bulkBtn} onClick={(e) => openEditor("status", selectedIds, e.currentTarget)}>
              <StatusGlyph status="on_track" /> {isPhone ? "Status" : "Change status"} {!isPhone && <Kbd>S</Kbd>}
            </button>
            <button type="button" className={s.bulkBtn} onClick={(e) => openEditor("owner", selectedIds, e.currentTarget)}>
              <Icon.person size={14} /> {isPhone ? "Owner" : "Set owner"} {!isPhone && <Kbd>O</Kbd>}
            </button>
            <button type="button" className={s.bulkBtn} onClick={(e) => openEditor("date", selectedIds, e.currentTarget)}>
              <Icon.calendar size={14} /> {isPhone ? "Date" : "Move date"} {!isPhone && <Kbd>D</Kbd>}
            </button>
            {!isPhone && (
              <button type="button" className={s.bulkBtn} onClick={() => archive(selectedIds)}>
                <Icon.archive size={14} /> Archive
              </button>
            )}
            {isPhone ? (
              <span className={s.bulkNote}>Compare works on a wider screen</span>
            ) : (
              <button
                type="button"
                className={s.bulkCompare}
                disabled={selectedIds.length < 2 || selectedIds.length > 3}
                title={selectedIds.length < 2 ? "Select one more to compare" : selectedIds.length > 3 ? "Compare up to three" : undefined}
                onClick={startCompare}
              >
                <Icon.compare size={14} /> Compare <Kbd>C</Kbd>
              </button>
            )}
            <button type="button" className={s.iconBtn} aria-label="Clear selection (Esc)" onClick={() => setSelected(new Set())}>
              <Icon.close size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={s.toasts} data-peek={(peekProject && !isPhone && !hubId && !compareIds) || undefined} aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={s.toast}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
            >
              <span>{t.text}</span>
              {t.undo && (
                <button
                  type="button"
                  className={s.toastUndo}
                  onClick={() => {
                    t.undo!();
                    setToasts((ts) => ts.filter((x) => x.id !== t.id));
                  }}
                >
                  Undo
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {pop && (
        <Popover
          rect={pop.rect}
          side={pop.side}
          height={pop.kind === "date" ? 408 : 320}
          mobile={isPhone}
          onClose={closePop}
          width={pop.kind === "date" ? 288 : pop.kind === "filter" ? 320 : pop.kind === "display" ? 264 : pop.kind === "status" ? 300 : pop.kind === "keys" ? 300 : 240}
          align={pop.kind === "filter" || pop.kind === "group" || pop.kind === "display" || pop.kind === "keys" ? "end" : "start"}
          label={
            pop.kind === "status"
              ? "Change status"
              : pop.kind === "owner"
                ? "Set owner"
                : pop.kind === "date"
                  ? "Move date"
                  : pop.kind === "group"
                    ? "Group by"
                    : pop.kind === "filter"
                      ? "Filter"
                      : pop.kind === "keys"
                        ? "Keyboard shortcuts"
                        : "Display"
          }
        >
          {pop.kind === "status" && (
            <StatusEditor
              current={single?.status}
              count={popProjects.length}
              note={single ? statusWhy(single) : null}
              onCommit={(st, r) => {
                setStatus(pop.ids, st, r);
                closePop();
              }}
            />
          )}
          {pop.kind === "owner" && (
            <OwnerMenu
              current={single?.owner}
              onPick={(o) => {
                setOwner(pop.ids, o);
                closePop();
              }}
            />
          )}
          {pop.kind === "date" && popProjects.length > 0 && (
            <DateEditor
              projects={popProjects}
              onPreview={setDatePreview}
              onCommit={(plan) => {
                commitDate(plan);
                closePop();
              }}
            />
          )}
          {pop.kind === "keys" && <ShortcutList />}
          {pop.kind === "group" && (
            <GroupMenu
              current={groupBy}
              onPick={(g) => {
                setGroupBy(g);
                setCollapsed(new Set());
                closePop();
              }}
            />
          )}
          {pop.kind === "filter" && (
            <FilterBar
              filters={filters}
              onToggle={toggleFilter}
              onRemoveLast={() => setFilters((fs) => fs.slice(0, -1))}
              countFor={(f) => applyFilters(inView, [f]).length}
            />
          )}
          {pop.kind === "display" && (
            <DisplayMenu
              cols={cols}
              onToggle={(id) => setCols((cs) => cs.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c)))}
              onMove={(id, dir) =>
                setCols((cs) => {
                  const i = cs.findIndex((c) => c.id === id);
                  const j = i + dir;
                  if (j < 1 || j >= cs.length) return cs;
                  const next = [...cs];
                  [next[i], next[j]] = [next[j], next[i]];
                  return next;
                })
              }
              onReset={() => setCols(DEFAULT_COLS)}
              preview={preview}
              onPreview={(p) => {
                setPreview(p);
                if (p !== "loading") setBooting(false);
              }}
            />
          )}
        </Popover>
      )}

      <AnimatePresence>
        {cmdk && (
          <CommandMenu
            projects={activeProjects}
            onClose={() => {
              setCmdk(false);
              focusRoot();
            }}
            onRun={(c: Command) => {
              setCmdk(false);
              if (c.type === "go") {
                setHubId(c.id);
              } else if (c.type === "new") {
                startCreate();
              } else if (c.type === "template") {
                const t = TEMPLATES.find((x) => x.id === c.id)!;
                startCreate(t.kind, `${t.name}, `);
              } else if (c.type === "group") {
                setHubId(null);
                setGroupBy(c.by);
              } else if (c.type === "view") {
                setHubId(null);
                setView(c.id);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["J", "K"], label: "Move up and down" },
  { keys: ["space"], label: "Peek at a project" },
  { keys: ["↵"], label: "Open it" },
  { keys: ["X"], label: "Select, with shift for a range" },
  { keys: ["S"], label: "Change status" },
  { keys: ["D"], label: "Move the date" },
  { keys: ["O"], label: "Set the owner" },
  { keys: ["C"], label: "Compare two or three selected" },
  { keys: ["G", "N"], label: "Show what needs attention" },
  { keys: ["G", "P"], label: "Show projects past their date" },
  { keys: ["G", "M"], label: "Show yours" },
  { keys: ["/"], label: "Filter" },
  { keys: ["N"], label: "New project" },
  { keys: ["⌘K"], label: "Commands" },
];

function ShortcutList() {
  return (
    <div className={s.keysPop}>
      <p className={s.keysTitle}>Keyboard shortcuts</p>
      <ul className={s.keysList}>
        {SHORTCUTS.map((k) => (
          <li key={k.label} className={s.keysItem}>
            <span>{k.label}</span>
            <span className={s.keysKeys}>
              {k.keys.map((x, i) => (
                <Kbd key={i}>{x}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
