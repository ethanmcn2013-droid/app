"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import s from "./ledger.module.css";
import { TEMPLATES, daysFromToday, healthOf, isPastDue, nextMilestone, sum, type KindId, type Project } from "./data";
import {
  DEFAULT_COLS,
  GROUPS,
  VIEWS,
  applyFilters,
  emptyMessage,
  filterKey,
  filterParts,
  fitColumns,
  groupProjects,
  sortProjects,
  type ColId,
  type ColState,
  type Filter,
  type GroupId,
  type Sort,
  type ViewId,
} from "./model";
import { Icon, Kbd, StatusGlyph } from "./parts";
import { DisplayMenu, FilterBar, GroupMenu, Popover, rectOf, type DatePreview, type PreviewState, type Rect } from "./popovers";
import { LedgerTable, SkeletonRows, type EditKind, type Item } from "./table";
import { Peek } from "./peek";
import { CreateRow, type Draft } from "./create";
import { MobileList } from "./mobile";
import { matches } from "./shelf";
import { useModKeys } from "../../tasks/keys";
import { setSharedView, useSharedView } from "./live";

let createSeq = 1000;

type LocalPop = { kind: "group" | "display" | "filter" | "keys"; rect: Rect };

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

export type LedgerProps = {
  projects: Project[];
  query: string;
  isPhone: boolean;
  /** Keys work only while nothing sits over the ledger. */
  keysLive: boolean;
  homeId: string | null;
  back: string | null;
  returning: string | null;
  shareCovers: boolean;
  onReturned: () => void;
  editing: { kind: EditKind; ids: string[] } | null;
  datePreview: DatePreview | null;
  compareIds: string[] | null;
  flyKey: number;
  flying: boolean;
  createSignal: number;
  /** A name to start the new project with, when a search found nothing by it. */
  createName: string;
  onCreateNamed: (name: string) => void;
  /** A project just made here: the cursor lands on it and it glows once. */
  freshId: string | null;
  onOpen: (id: string) => void;
  onEdit: (kind: EditKind, ids: string[], el?: Element | null, beside?: boolean) => void;
  onCompare: (ids: string[]) => void;
  onCreate: (d: Draft) => void;
  onWrap: (id: string) => void;
  onWrapMany: (ids: string[]) => void;
  onUnwrap?: (id: string) => void;
  toast: (text: string) => void;
  reportOrder: (ids: string[]) => void;
};

/** The ledger lens: every column live, every row editable in place, keyboard first. */
export function Ledger({
  projects,
  query,
  isPhone,
  keysLive,
  homeId,
  back,
  returning,
  shareCovers,
  onReturned,
  editing,
  datePreview,
  compareIds,
  flyKey,
  flying,
  createSignal,
  createName,
  onCreateNamed,
  freshId,
  onOpen,
  onEdit,
  onCompare,
  onCreate,
  onWrap,
  onWrapMany,
  toast,
  reportOrder,
}: LedgerProps) {
  const filterBtn = useRef<HTMLButtonElement>(null);
  const keysBtn = useRef<HTMLButtonElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const areaWidth = useWidth(areaRef);

  const view = useSharedView();
  const setView = (v: ViewId) => setSharedView(v);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [groupBy, setGroupBy] = useState<GroupId>("none");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [cols, setCols] = useState<ColState[]>(DEFAULT_COLS);
  const [sort, setSort] = useState<Sort>({ col: "date", dir: 1 });
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [pop, setPop] = useState<LocalPop | null>(null);
  const [creating, setCreating] = useState<{ kind: KindId; name?: string; template?: string; key: number } | null>(null);
  const [seenSignal, setSeenSignal] = useState(createSignal);
  const [seenBack, setSeenBack] = useState(back);
  const [flashId, setFlashId] = useState<string | null>(null);
  // Until the first shortcut is used, the shortcuts button spells itself out; after that it folds to "?".
  const [usedKeys, setUsedKeys] = useState(false);
  const [preview, setPreview] = useState<PreviewState>("live");

  // The header's New project (or N) opens the create row at the top of the ledger.
  if (createSignal !== seenSignal) {
    setSeenSignal(createSignal);
    setPeekId(null);
    setCreating({ kind: "event", name: createName || undefined, key: createSignal });
  }
  // Back from a home, the cursor rests on the project that was open.
  if (back !== seenBack) {
    setSeenBack(back);
    if (back) setCursor(back);
  }

  /* ── Derived ─────────────────────────────────────────────────────── */

  const live = projects;
  const viewDef = VIEWS.find((v) => v.id === view)!;
  const q = query.trim().toLowerCase();
  const inView = useMemo(() => live.filter(viewDef.test).filter((p) => matches(p, q)), [live, viewDef, q]);
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
  const visibleCols = areaWidth ? fitColumns(cols, areaWidth).cols : cols.filter((c) => !c.hidden);
  const peekProject = peekId ? projects.find((p) => p.id === peekId) : undefined;
  const zero = preview === "empty";
  const loading = !zero && preview === "loading";

  const ids = rows.map((p) => p.id).join(",");
  useEffect(() => {
    reportOrder(ids ? ids.split(",") : []);
  }, [ids, reportOrder]);


  /* Footer sums follow the rows on screen, or the selection when there is one. Every number has its noun. */
  const selectedRows = rows.filter((p) => selected.has(p.id));
  const sumOf = selectedRows.length ? selectedRows : rows;
  const tDone = sum(sumOf.map((p) => p.done));
  const tTotal = sum(sumOf.map((p) => p.total));
  const tLate = sum(sumOf.map((p) => p.overdue));
  const tHealth = { off: 0, risk: 0, on: 0, early: 0, wrapped: 0 };
  for (const p of sumOf) {
    const h = healthOf(p);
    if (!h) tHealth.wrapped += 1;
    else if (h === "off_track") tHealth.off += 1;
    else if (h === "at_risk") tHealth.risk += 1;
    else if (h === "too_early") tHealth.early += 1;
    else tHealth.on += 1;
  }
  const tPast = sumOf.filter(isPastDue).length;
  const tMs = sumOf.filter((p) => {
    const m = nextMilestone(p);
    if (!m) return false;
    const d = daysFromToday(m.date);
    return d >= 0 && d <= 7;
  }).length;
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const footParts: { text: string; tone?: "late" | "risk" }[] = [
    { text: selectedRows.length ? `${selectedRows.length} selected` : plural(rows.length, "project") },
    ...(tHealth.off ? [{ text: `${tHealth.off} off track`, tone: "late" as const }] : []),
    ...(tHealth.risk ? [{ text: `${tHealth.risk} at risk`, tone: "risk" as const }] : []),
    ...(tHealth.on ? [{ text: `${tHealth.on} on track` }] : []),
    ...(tHealth.early ? [{ text: `${tHealth.early} too early to tell` }] : []),
    ...(tHealth.wrapped ? [{ text: `${tHealth.wrapped} wrapped` }] : []),
    ...(tPast ? [{ text: `${tPast} past ${tPast === 1 ? "its" : "their"} date` }] : []),
    { text: `${tTotal - tDone} open ${tTotal - tDone === 1 ? "task" : "tasks"}` },
    ...(tLate ? [{ text: `${tLate} late`, tone: "late" as const }] : []),
    { text: tMs === 0 ? "no big dates this week" : `${plural(tMs, "big date")} this week` },
  ];
  const totals = (
    <span className={s.tfClip}>
      <span className={s.tfLine}>
        {footParts.map((x) => (
          <span key={x.text} className={x.tone === "late" ? s.tfLate : x.tone === "risk" ? s.tfRisk : undefined}>
            <span className={s.tfSep} aria-hidden="true">
              ·
            </span>
            {x.text}
          </span>
        ))}
      </span>
    </span>
  );

  /** Saved views scroll sideways when they run out of room; a fade marks the hidden end. */
  const markOverflow = (el: HTMLElement | null) => {
    if (!el) return;
    el.dataset.more = el.scrollWidth - el.clientWidth - el.scrollLeft > 2 ? "end" : "";
  };

  const usedShortcut = () => {
    if (!usedKeys) setUsedKeys(true);
  };

  const openPop = (kind: LocalPop["kind"], el: Element | null) => {
    const rect = rectOf(el) ?? { x: window.innerWidth / 2 - 140, y: 160, w: 0, h: 0 };
    setPop({ kind, rect });
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

  const selectedIds = rows.filter((p) => selected.has(p.id)).map((p) => p.id);

  const startCompare = () => {
    if (isPhone) return;
    if (selectedIds.length < 2 || selectedIds.length > 3) {
      toast(selectedIds.length > 3 ? "Compare works with two or three projects." : "Select two or three projects with X, then press C.");
      return;
    }
    setPeekId(null);
    onCompare(selectedIds);
  };

  const startCreate = (kind: KindId = "event", name?: string, template?: string) => {
    setPeekId(null);
    setCreating({ kind, name, template, key: ++createSeq });
  };

  const toggleFilter = (f: Filter) => {
    setFilters((fs) => (fs.some((x) => filterKey(x) === filterKey(f)) ? fs.filter((x) => filterKey(x) !== filterKey(f)) : [...fs, f]));
  };

  const edit = (kind: EditKind, targetIds: string[], el?: Element | null) => {
    // Date edits from the ledger sit beside the date column, so the ghost preview stays visible.
    onEdit(kind, targetIds, el, kind === "date" && !isPhone);
  };

  /* ── Keyboard ────────────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!keysLive || pop) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      // A ticked row checkbox keeps focus, but the ledger keys should still work from it.
      const toggle = tag === "INPUT" && ["checkbox", "radio"].includes((t as HTMLInputElement).type);
      const typing = (tag === "INPUT" && !toggle) || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === "Enter" || e.key === " ") && (tag === "BUTTON" || tag === "A" || toggle)) return;
      const target = cursor ?? rows[0]?.id ?? null;
      const editIds = selectedIds.length ? selectedIds : target ? [target] : [];
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      let handled = true;
      switch (key) {
        case "?":
          openPop("keys", keysBtn.current);
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
          if (target && !isPhone) {
            setCursor(target);
            setPeekId((p) => (p === target ? null : target));
          }
          break;
        case "Enter":
          if (target) onOpen(target);
          break;
        case "s":
          if (editIds.length) edit("status", editIds);
          break;
        case "d":
          if (editIds.length) edit("date", editIds);
          break;
        case "o":
          if (editIds.length) edit("owner", editIds);
          break;
        case "c":
          startCompare();
          break;
        case "f":
          openPop("filter", filterBtn.current);
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
        e.stopPropagation();
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
  }, []);

  useEffect(() => {
    if (!cursor) return;
    document.querySelector(`[data-row="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  /* ── Pieces ──────────────────────────────────────────────────────── */

  // Rows that can fly into compare: two or three selected, or the ones compare is showing.
  const fly = new Set<string>(compareIds ?? (selected.size >= 2 && selected.size <= 3 ? [...selected] : []));
  const hasFilters = filters.length > 0;

  const toolbar = (
    <div className={s.header}>
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
                tabIndex={view === v.id ? 0 : -1}
                className={s.tab}
                title={v.hint}
                onClick={() => {
                  setView(v.id);
                  setSelected(new Set());
                }}
                onKeyDown={(e) => {
                  const i = VIEWS.findIndex((x) => x.id === v.id);
                  const to = e.key === "ArrowRight" ? (i + 1) % VIEWS.length : e.key === "ArrowLeft" ? (i - 1 + VIEWS.length) % VIEWS.length : null;
                  if (to === null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setView(VIEWS[to].id);
                  e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[to]?.focus();
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
          <button ref={filterBtn} type="button" className={s.toolBtn} data-on={hasFilters || undefined} aria-keyshortcuts="f" onClick={(e) => openPop("filter", e.currentTarget)}>
            <Icon.filter size={14} /> {isPhone && hasFilters ? `Filters ${filters.length}` : "Filter"} {!isPhone && <Kbd>F</Kbd>}
          </button>
          <button type="button" className={s.toolBtn} data-on={groupBy !== "none" || undefined} onClick={(e) => openPop("group", e.currentTarget)}>
            <Icon.group size={14} />
            {groupBy === "none" ? "Group" : `Group: ${GROUPS.find((g) => g.id === groupBy)!.label.toLowerCase()}`}
          </button>
          {!isPhone && (
            <>
              <button type="button" className={s.toolBtn} aria-label="Display options" onClick={(e) => openPop("display", e.currentTarget)}>
                <Icon.display size={14} />
              </button>
              <button
                ref={keysBtn}
                type="button"
                className={s.toolBtn}
                data-folded={usedKeys || undefined}
                aria-label="Keyboard shortcuts"
                aria-keyshortcuts="?"
                onClick={(e) => openPop("keys", e.currentTarget)}
              >
                {!usedKeys && <span>Shortcuts</span>}
                <Kbd>?</Kbd>
              </button>
            </>
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
    </div>
  );

  const commit = (d: Draft) => {
    setCreating(null);
    if (view === "wrapped" || view === "risk") setView("active");
    setFilters([]);
    onCreate(d);
    if (zero) setPreview("live");
  };

  const createRow = creating ? (
    <CreateRow key={creating.key} initialKind={creating.kind} initialName={creating.name} initialTemplate={creating.template} onCommit={commit} onCancel={() => setCreating(null)} />
  ) : null;

  // A new project lands under the cursor and glows once.
  const [seenFresh, setSeenFresh] = useState<string | null>(null);
  if (freshId && freshId !== seenFresh) {
    setSeenFresh(freshId);
    setCursor(freshId);
    setFlashId(freshId);
  }
  useEffect(() => {
    if (!flashId) return;
    const t = window.setTimeout(() => setFlashId(null), 1800);
    return () => window.clearTimeout(t);
  }, [flashId]);

  const noResults = !loading && !zero && rows.length === 0 && items.length === 0 && (
    <div className={s.noResults}>
      <span className={s.noResultsIcon}>
        <Icon.filter size={16} />
      </span>
      <p className={s.noResultsText}>{q ? `No project matches “${query.trim()}”.` : emptyMessage(filters, view)}</p>
      {q ? (
        <button type="button" className={s.btnPrimarySm} onClick={() => onCreateNamed(query.trim())}>
          Create “{query.trim()}”
        </button>
      ) : null}
      {hasFilters ? (
        <button type="button" className={s.btnGhostSm} onClick={() => setFilters([])}>
          Clear {filters.length === 1 ? "filter" : "filters"}
        </button>
      ) : view !== "active" ? (
        <button type="button" className={s.btnGhostSm} onClick={() => setView("active")}>
          See all active projects
        </button>
      ) : null}
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
        <CreateRow hero onCommit={commit} onCancel={() => {}} />
      </div>
    ) : (
      <>
        {createRow}
        {noResults}
        <MobileList
          items={items}
          selected={selected}
          flashId={flashId}
          homeId={homeId}
          shareCovers={shareCovers}
          returning={returning}
          onReturned={onReturned}
          onOpen={onOpen}
          onToggleSelect={(id) => toggleSelect(id)}
          onToggleGroup={(k) =>
            setCollapsed((c) => {
              const n = new Set(c);
              if (n.has(k)) n.delete(k);
              else n.add(k);
              return n;
            })
          }
          onWrap={onWrap}
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
            <CreateRow hero onCommit={commit} onCancel={() => {}} />
            <div className={s.zeroTpl}>
              <span className={s.zeroTplLabel}>Or start from</span>
              {TEMPLATES.slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={s.tplChip}
                  onClick={() => {
                    setPreview("live");
                    startCreate(t.kind, undefined, t.id);
                  }}
                >
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
          editing={editing}
          totals={totals}
          totalsHidden={false}
          fly={fly}
          flyKey={flyKey}
          flying={flying}
          homeId={homeId}
          shareCovers={shareCovers}
          returning={returning}
          onReturned={onReturned}
          onRowClick={(id) => {
            setCursor(id);
            setPeekId(id);
          }}
          onToggleSelect={toggleSelect}
          onSelectAll={() => setSelected((sel) => (rows.length && rows.every((p) => sel.has(p.id)) ? new Set() : new Set(rows.map((p) => p.id))))}
          allSelected={rows.length > 0 && rows.every((p) => selected.has(p.id))}
          onOpen={onOpen}
          onEdit={(kind, id, el) => {
            setCursor(id);
            edit(kind, selected.has(id) && selected.size > 1 ? selectedIds : [id], el);
          }}
          onToggleGroup={(k) =>
            setCollapsed((c) => {
              const n = new Set(c);
              if (n.has(k)) n.delete(k);
              else n.add(k);
              return n;
            })
          }
          onWrap={onWrap}
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
    <div className={s.ledgerLens}>
      {toolbar}
      <div className={s.tableArea} ref={areaRef}>
        {body}
      </div>
      <div className={s.bottomSpace} />

      <AnimatePresence>
        {peekProject && !homeId && !compareIds && !isPhone && (
          <Peek
            key="panel"
            project={peekProject}
            index={Math.max(0, rows.findIndex((p) => p.id === peekProject.id))}
            total={rows.length}
            onClose={() => setPeekId(null)}
            onOpen={() => onOpen(peekProject.id)}
            onStep={moveCursor}
            onEdit={(kind, el) => edit(kind, [peekProject.id], el)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedIds.length > 0 && !homeId && !compareIds && (
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
                  {tDone} of {tTotal} tasks done{tLate > 0 && <span className={s.tfLate}>, {tLate} late</span>}
                </span>
              )}
            </span>
            <span className={s.bulkSep} />
            <button type="button" className={s.bulkBtn} onClick={(e) => edit("status", selectedIds, e.currentTarget)}>
              <StatusGlyph status="on_track" /> {isPhone ? "How it is doing" : "Change how it is doing"} {!isPhone && <Kbd>S</Kbd>}
            </button>
            <button type="button" className={s.bulkBtn} onClick={(e) => edit("owner", selectedIds, e.currentTarget)}>
              <Icon.person size={14} /> {isPhone ? "Lead" : "Set lead"} {!isPhone && <Kbd>O</Kbd>}
            </button>
            <button type="button" className={s.bulkBtn} onClick={(e) => edit("date", selectedIds, e.currentTarget)}>
              <Icon.calendar size={14} /> {isPhone ? "Date" : "Move date"} {!isPhone && <Kbd>D</Kbd>}
            </button>
            {!isPhone && (
              <button
                type="button"
                className={s.bulkBtn}
                onClick={() => {
                  onWrapMany(selectedIds);
                  setSelected(new Set());
                  if (peekId && selectedIds.includes(peekId)) setPeekId(null);
                }}
              >
                <Icon.check size={14} /> Wrap up
              </button>
            )}
            <button
              type="button"
              className={s.bulkCompare}
              disabled={selectedIds.length < 2 || selectedIds.length > 3}
              title={selectedIds.length < 2 ? "Select one more to compare" : selectedIds.length > 3 ? "Compare up to three" : undefined}
              onClick={startCompare}
            >
              <Icon.compare size={14} /> Compare {!isPhone && <Kbd>C</Kbd>}
            </button>
            <button type="button" className={s.iconBtn} aria-label="Clear selection (Esc)" onClick={() => setSelected(new Set())}>
              <Icon.close size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {pop && (
        <Popover
          rect={pop.rect}
          side="below"
          height={320}
          mobile={isPhone}
          onClose={() => setPop(null)}
          width={pop.kind === "filter" ? 320 : pop.kind === "display" ? 264 : pop.kind === "keys" ? 300 : 240}
          align="end"
          label={pop.kind === "group" ? "Group by" : pop.kind === "filter" ? "Filter" : pop.kind === "keys" ? "Keyboard shortcuts" : "Display"}
        >
          {pop.kind === "keys" && <ShortcutList />}
          {pop.kind === "group" && (
            <GroupMenu
              current={groupBy}
              onPick={(g) => {
                setGroupBy(g);
                setCollapsed(new Set());
                setPop(null);
              }}
            />
          )}
          {pop.kind === "filter" && (
            <FilterBar filters={filters} onToggle={toggleFilter} onRemoveLast={() => setFilters((fs) => fs.slice(0, -1))} countFor={(f) => applyFilters(inView, [f]).length} />
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
              onPreview={setPreview}
            />
          )}
        </Popover>
      )}
    </div>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["J", "K"], label: "Move up and down" },
  { keys: ["space"], label: "Peek at a project" },
  { keys: ["↵"], label: "Open its home" },
  { keys: ["X"], label: "Select, with shift for a range" },
  { keys: ["S"], label: "Change health" },
  { keys: ["D"], label: "Move the date" },
  { keys: ["O"], label: "Set the lead" },
  { keys: ["C"], label: "Compare two or three selected" },
  { keys: ["F"], label: "Filter" },
  { keys: ["/"], label: "Find a project" },
  { keys: ["N"], label: "New project" },
  { keys: ["←", "→"], label: "Previous and next, in a project" },
  { keys: ["esc"], label: "Close this, or go back to the list" },
  { keys: ["MOD K"], label: "Jump anywhere" },
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
                <ModKbd key={i} k={x} />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModKbd({ k }: { k: string }) {
  const { mod } = useModKeys();
  return <Kbd>{k === "MOD K" ? (mod === "⌘" ? "⌘K" : "Ctrl K") : k}</Kbd>;
}
