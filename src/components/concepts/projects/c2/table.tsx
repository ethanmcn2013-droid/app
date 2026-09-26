"use client";

import { motion } from "motion/react";
import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import s from "./ledger.module.css";
import {
  PEOPLE,
  STATUS_LABEL,
  addDays,
  daysFromToday,
  fmtAgo,
  fmtDate,
  fmtRelative,
  fmtWeekday,
  isPastDue,
  lateMilestones,
  nextMilestone,
  statusLooksStale,
  sum,
  type Project,
} from "./data";
import { COL_META, rollup, type ColId, type ColState, type Group, type Sort } from "./model";
import type { DatePreview } from "./popovers";
import { Avatar, AvatarStack, DayBars, Icon, MilestoneWhen, OpenTrend, Progress, StatusGlyph, StatusPill, Swatch, openSeries, trend } from "./parts";

export type Item = { type: "group"; group: Group; collapsed: boolean } | { type: "row"; project: Project };
export type EditKind = "status" | "owner" | "date";

/** The shared flight between a ledger row and a compare column. */
export const FLY = { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const };

/** Project takes the leftover width; its ColState width is the floor for the current content width. */
export function gridTemplate(cols: ColState[]) {
  return cols.map((c) => (c.id === "name" ? `minmax(${c.width}px, 1fr)` : `${c.width}px`)).join(" ");
}

type Hover = { rect: DOMRect; node: ReactNode } | null;
export type ShowTip = (el: HTMLElement, node: ReactNode, now?: boolean) => void;

/** Why a status deserves a second look, in plain words. Shown on hover, on focus and in the status editor. */
export function statusWhy(p: Project): { title: string; text: string } | null {
  const n = daysFromToday(p.date);
  if (isPastDue(p)) {
    return {
      title: "Past its date",
      text: `The date was ${fmtWeekday(p.date)} ${fmtDate(p.date)}, ${n === -1 ? "yesterday" : `${-n} days ago`}. Wrap it up if it's done, or move the date.`,
    };
  }
  if (statusLooksStale(p)) {
    const late = lateMilestones(p);
    return {
      title: "Check this status",
      text: `Marked on track, but ${late.map((m) => m.name).join(" and ")} ${late.length === 1 ? "is" : "are"} late. Is it still on track?`,
    };
  }
  return null;
}

export function LedgerTable({
  items,
  cols,
  sort,
  onSort,
  cursor,
  selected,
  peekId,
  flashId,
  datePreview,
  editing,
  onRowClick,
  onToggleSelect,
  onSelectAll,
  allSelected,
  onOpen,
  onEdit,
  onToggleGroup,
  onWrap,
  onResize,
  onReorder,
  createRow,
  grouped,
  totals,
  totalsHidden,
  fly,
  flyKey = 0,
  flying = false,
}: {
  items: Item[];
  cols: ColState[];
  sort: Sort;
  onSort: (c: ColId) => void;
  cursor: string | null;
  selected: Set<string>;
  peekId: string | null;
  flashId: string | null;
  datePreview: DatePreview | null;
  /** The cell an editor is open on, so the row shows what is being changed. */
  editing?: { kind: EditKind; ids: string[] } | null;
  onRowClick: (id: string) => void;
  onToggleSelect: (id: string, range: boolean) => void;
  onSelectAll: () => void;
  allSelected: boolean;
  onOpen: (id: string) => void;
  onEdit: (kind: EditKind, id: string, el: Element) => void;
  onToggleGroup: (key: string) => void;
  onWrap: (id: string) => void;
  onResize: (id: ColId, width: number) => void;
  onReorder: (from: ColId, to: ColId) => void;
  createRow?: ReactNode;
  grouped: boolean;
  /** Footer sums, keyed by column. */
  totals?: Partial<Record<ColId, ReactNode>>;
  /** While the selection bar is up it carries the sums, so the footer steps back. */
  totalsHidden?: boolean;
  /** Rows whose glyph and name fly into compare. */
  fly?: Set<string>;
  /** Changes when compare closes, so flying rows remount and travel back. */
  flyKey?: number;
  /** True while the glyphs and names are travelling back from compare. */
  flying?: boolean;
}) {
  const [hover, setHover] = useState<Hover>(null);
  const [dragCol, setDragCol] = useState<ColId | null>(null);
  const [dropCol, setDropCol] = useState<ColId | null>(null);
  const tpl = gridTemplate(cols);
  const minWidth = cols.reduce((a, c) => a + c.width, 0);

  const startResize = (e: React.PointerEvent, c: ColState) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const w0 = c.width;
    const move = (ev: PointerEvent) => onResize(c.id, Math.max(COL_META[c.id].min, Math.round(w0 + ev.clientX - x0)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const tipTimer = useRef<number | undefined>(undefined);
  const showTip: ShowTip = (el, node, now) => {
    const rect = el.getBoundingClientRect();
    window.clearTimeout(tipTimer.current);
    // Hover intent: a quick pass over the table never flashes cards. Focus shows at once.
    tipTimer.current = window.setTimeout(() => setHover({ rect, node }), now || hover ? 0 : 320);
  };
  const hideTipNow = () => {
    window.clearTimeout(tipTimer.current);
    setHover(null);
  };

  return (
    <div className={s.table} role="grid" aria-label="Projects" aria-rowcount={items.length} style={{ "--cols": tpl, minWidth } as CSSProperties}>
      <div className={s.thead} role="row">
        {cols.map((c) => {
          const meta = COL_META[c.id];
          const sorted = sort.col === c.id;
          return (
            <div
              key={c.id}
              role="columnheader"
              aria-sort={sorted ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
              className={s.th}
              data-col={c.id}
              data-drop={(dropCol === c.id && dragCol !== c.id) || undefined}
              data-dragging={dragCol === c.id || undefined}
              draggable={c.id !== "name"}
              onDragStart={(e) => {
                setDragCol(c.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", c.id);
              }}
              onDragOver={(e) => {
                if (!dragCol || c.id === "name") return;
                e.preventDefault();
                if (dropCol !== c.id) setDropCol(c.id);
              }}
              onDragLeave={() => setDropCol(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragCol && dragCol !== c.id) onReorder(dragCol, c.id);
                setDragCol(null);
                setDropCol(null);
              }}
              onDragEnd={() => {
                setDragCol(null);
                setDropCol(null);
              }}
            >
              {c.id === "name" && (
                <input
                  type="checkbox"
                  className={s.headCheck}
                  aria-label="Select all visible projects"
                  checked={allSelected}
                  onChange={onSelectAll}
                />
              )}
              <button
                type="button"
                className={s.thBtn}
                disabled={!meta.sortable}
                onClick={() => onSort(c.id)}
                title={meta.hint && meta.hint.length > 2 ? meta.hint : undefined}
              >
                <span>{meta.label}</span>
                {sorted && (sort.dir === 1 ? <Icon.arrowUp size={12} /> : <Icon.arrowDown size={12} />)}
              </button>
              <span
                className={s.resize}
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize ${meta.label}`}
                onPointerDown={(e) => startResize(e, c)}
                onDoubleClick={() => onResize(c.id, meta.def)}
              />
            </div>
          );
        })}
      </div>

      <div className={s.tbody} role="rowgroup">
        {createRow}
        {items.map((it) => {
          if (it.type === "group") {
            const g = it.group;
            return (
              <div key={`g-${g.key}`} className={s.groupRow} role="row">
                <button type="button" className={s.groupBtn} aria-expanded={!it.collapsed} onClick={() => onToggleGroup(g.key)}>
                  <Icon.chevron size={14} className={s.groupChevron} />
                  {g.status && <StatusGlyph status={g.status} />}
                  {g.owner && <Avatar who={g.owner} size={18} />}
                  {g.kind && <span className={s.kindDot} data-kind={g.kind} />}
                  <span className={s.groupLabel}>{g.label}</span>
                  <span className={s.groupRoll}>{rollup(g)}</span>
                </button>
              </div>
            );
          }
          const p = it.project;
          const isCursor = cursor === p.id;
          const isSel = selected.has(p.id);
          const ghost = datePreview && datePreview.ids.includes(p.id) ? (datePreview.iso ?? addDays(p.date, datePreview.delta ?? 0)) : null;
          const editCol = editing && editing.ids.includes(p.id) ? editing.kind : null;
          return (
            <div
              key={p.id}
              role="row"
              aria-selected={isSel}
              data-row={p.id}
              data-cursor={isCursor || undefined}
              data-selected={isSel || undefined}
              data-peek={peekId === p.id || undefined}
              data-flash={flashId === p.id || undefined}
              data-grouped={grouped || undefined}
              data-flying={(flying && fly?.has(p.id)) || undefined}
              className={s.row}
              onClick={() => onRowClick(p.id)}
              onDoubleClick={() => onOpen(p.id)}
            >
              {cols.map((c) => (
                <Cell
                  key={c.id}
                  col={c.id}
                  p={p}
                  ghost={ghost}
                  isSel={isSel}
                  editing={editCol === c.id}
                  fly={!!fly?.has(p.id)}
                  flyKey={flyKey}
                  onToggleSelect={onToggleSelect}
                  onOpen={onOpen}
                  onEdit={onEdit}
                  onWrap={onWrap}
                  showTip={showTip}
                  hideTip={hideTipNow}
                />
              ))}
            </div>
          );
        })}
      </div>

      {totals && items.length > 0 && (
        <div className={s.tfoot} role="row" aria-label="Totals for the projects shown" data-hidden={totalsHidden || undefined}>
          {cols.map((c) => (
            <div key={c.id} role="gridcell" className={s.tf} data-col={c.id}>
              {totals[c.id] ?? null}
            </div>
          ))}
        </div>
      )}

      {hover && (
        <div
          className={s.tip}
          role="tooltip"
          style={{ left: Math.min(hover.rect.left, (typeof window !== "undefined" ? window.innerWidth : 1440) - 300), top: hover.rect.bottom + 6 }}
        >
          {hover.node}
        </div>
      )}
    </div>
  );
}

function Cell({
  col,
  p,
  ghost,
  isSel,
  editing,
  fly,
  flyKey,
  onToggleSelect,
  onOpen,
  onEdit,
  onWrap,
  showTip,
  hideTip,
}: {
  flyKey: number;
  col: ColId;
  p: Project;
  ghost: string | null;
  isSel: boolean;
  editing: boolean;
  fly: boolean;
  onToggleSelect: (id: string, range: boolean) => void;
  onOpen: (id: string) => void;
  onEdit: (kind: EditKind, id: string, el: Element) => void;
  onWrap: (id: string) => void;
  showTip: ShowTip;
  hideTip: () => void;
}) {
  const stop = (e: MouseEvent) => e.stopPropagation();

  switch (col) {
    case "name": {
      const m = nextMilestone(p);
      const card = (
        <span className={s.tipCard}>
          <span className={s.tipName}>{p.name}</span>
          <span className={s.tipPurpose}>{p.purpose}</span>
          <span className={s.tipNext}>
            <Icon.person size={12} />
            <span>
              {PEOPLE[p.owner].name} owns this · updated {fmtAgo(p.updatedMins)} by {PEOPLE[p.updatedBy].short}
            </span>
          </span>
          {m && (
            <span className={s.tipNext}>
              <Icon.flag size={12} />
              <span>
                Next: {m.name}, <MilestoneWhen m={m} />
              </span>
            </span>
          )}
        </span>
      );
      const glyph = <Swatch tone={p.tone} name={p.name} size={20} />;
      return (
        <div role="gridcell" className={s.td} data-col="name">
          <span className={s.selectSlot}>
            {fly ? (
              <motion.span key={flyKey} layoutId={`c2-glyph-${p.id}`} className={s.flyGlyph} transition={FLY}>
                {glyph}
              </motion.span>
            ) : (
              glyph
            )}
            <input
              type="checkbox"
              className={s.rowCheck}
              checked={isSel}
              aria-label={`Select ${p.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(p.id, e.shiftKey);
              }}
              onChange={() => {}}
            />
          </span>
          <span className={s.name} onMouseEnter={(e) => showTip(e.currentTarget, card)} onMouseLeave={hideTip}>
            {fly ? (
              <motion.span key={flyKey} layoutId={`c2-name-${p.id}`} className={s.flyName} transition={FLY}>
                {p.name}
              </motion.span>
            ) : (
              p.name
            )}
          </span>
          {p.isNew && <span className={s.newTag}>New</span>}
          <button
            type="button"
            className={s.openBtn}
            aria-label={`Open ${p.name}`}
            onClick={(e) => {
              stop(e);
              onOpen(p.id);
            }}
            onFocus={(e) => showTip(e.currentTarget.parentElement ?? e.currentTarget, card, true)}
            onBlur={hideTip}
          >
            <Icon.arrowRight size={14} />
          </button>
        </div>
      );
    }
    case "status": {
      const past = isPastDue(p);
      const stale = !past && statusLooksStale(p);
      const why = statusWhy(p);
      const tip = why ? (
        <span className={s.tipCard}>
          <span className={s.tipName}>{why.title}</span>
          <span className={s.tipPurpose}>{why.text}</span>
        </span>
      ) : p.statusReason && p.status !== "on_track" ? (
        <span>{p.statusReason}</span>
      ) : null;
      return (
        <div role="gridcell" className={s.td} data-col="status" data-editing={editing || undefined}>
          <button
            type="button"
            className={s.cellBtn}
            aria-label={`Status: ${past ? "past its date" : STATUS_LABEL[p.status].toLowerCase()}.${why ? ` ${why.text}` : ""} Change status`}
            onClick={(e) => {
              stop(e);
              onEdit("status", p.id, e.currentTarget);
            }}
            onMouseEnter={(e) => tip && showTip(e.currentTarget, tip)}
            onMouseLeave={hideTip}
            onFocus={(e) => tip && showTip(e.currentTarget, tip, true)}
            onBlur={hideTip}
          >
            <StatusPill status={p.status} stale={stale} past={past} />
          </button>
        </div>
      );
    }
    case "health": {
      const d = sum(p.sparkDone);
      const a = sum(p.sparkAdded);
      const t = trend(a - d, a + d === 0);
      const series = openSeries(p.total, p.done, p.sparkDone, p.sparkAdded);
      const card = (
        <span className={s.healthTip}>
          <strong>{t.dir === "quiet" ? "Quiet for 14 days" : `Open tasks: ${series[0]} two weeks ago, ${series[series.length - 1]} now`}</strong>
          <span className={s.healthTipChart}>
            <DayBars done={p.sparkDone} added={p.sparkAdded} />
          </span>
          <span className={s.legend}>
            <span className={s.legendDone} /> {d} done
            <span className={s.legendAdded} /> {a} added
            <span className={s.legendSep}>each day</span>
          </span>
        </span>
      );
      return (
        <div
          role="gridcell"
          className={s.td}
          data-col="health"
          tabIndex={0}
          aria-label={`Open tasks: ${t.label}. ${d} done and ${a} added in the last 14 days.`}
          onMouseEnter={(e) => showTip(e.currentTarget, card)}
          onMouseLeave={hideTip}
          onFocus={(e) => showTip(e.currentTarget, card, true)}
          onBlur={hideTip}
        >
          <OpenTrend p={p} />
        </div>
      );
    }
    case "progress":
      return (
        <div role="gridcell" className={s.td} data-col="progress">
          <Progress done={p.done} total={p.total} width={32} late={p.overdue} />
        </div>
      );
    case "milestone": {
      const m = nextMilestone(p);
      return (
        <div role="gridcell" className={s.td} data-col="milestone">
          {m ? (
            <span className={s.milestone} title={`${m.name}, ${fmtDate(m.date)}`}>
              <Icon.flag size={12} className={s.milestoneIcon} />
              <span className={s.milestoneName}>{m.name}</span>
              <MilestoneWhen m={m} className={s.milestoneWhen} tight />
            </span>
          ) : (
            <span className={s.muted}>{p.status === "wrapped" ? "All done" : "None set"}</span>
          )}
        </div>
      );
    }
    case "date": {
      const n = daysFromToday(p.date);
      const past = isPastDue(p);
      const tone = p.status === "wrapped" ? "done" : past ? "past" : n <= 14 ? "soon" : undefined;
      return (
        <div role="gridcell" className={s.td} data-col="date" data-editing={editing || undefined}>
          <button
            type="button"
            className={s.dateBtn}
            data-tone={tone}
            aria-label={`Date ${fmtDate(p.date, true)}. Change date`}
            title={past ? `${fmtWeekday(p.date)} ${fmtDate(p.date, true)}` : undefined}
            onClick={(e) => {
              stop(e);
              onEdit("date", p.id, e.currentTarget);
            }}
          >
            {ghost && ghost !== p.date ? (
              <span className={s.dateGhost}>
                <span className={s.dateOld}>{fmtDate(p.date)}</span>
                <Icon.arrowRight size={12} />
                <span className={s.dateNew}>{fmtDate(ghost)}</span>
              </span>
            ) : (
              <>
                <span className={s.dateRel}>
                  {p.status === "wrapped" ? (
                    "Ended"
                  ) : past ? (
                    <>
                      <span className={s.dateEnded}>Ended </span>
                      {n === -1 ? "yesterday" : `${-n} days ago`}
                    </>
                  ) : (
                    fmtRelative(p.date)
                  )}
                </span>
                {!past && <span className={s.dateAbs}>{fmtDate(p.date)}</span>}
              </>
            )}
          </button>
          {past && !ghost && (
            <button
              type="button"
              className={s.wrapLink}
              onClick={(e) => {
                stop(e);
                onWrap(p.id);
              }}
              aria-label={`Wrap up ${p.name}`}
            >
              Wrap up
            </button>
          )}
        </div>
      );
    }
    case "owner":
      return (
        <div role="gridcell" className={s.td} data-col="owner" data-editing={editing || undefined}>
          <button
            type="button"
            className={s.ownerBtn}
            aria-label={`Owner ${PEOPLE[p.owner].name}. Change owner`}
            onClick={(e) => {
              stop(e);
              onEdit("owner", p.id, e.currentTarget);
            }}
          >
            <Avatar who={p.owner} size={22} />
          </button>
        </div>
      );
    case "people":
      return (
        <div role="gridcell" className={s.td} data-col="people">
          <AvatarStack people={p.people} max={3} size={20} />
        </div>
      );
    case "updated":
      return (
        <div role="gridcell" className={s.td} data-col="updated">
          <span className={s.updated} title={`${fmtAgo(p.updatedMins)} by ${PEOPLE[p.updatedBy].name}`}>
            {fmtAgo(p.updatedMins).replace(" ago", "").replace("just now", "now")}
            <span className={s.updatedBy}> · {PEOPLE[p.updatedBy].short}</span>
          </span>
        </div>
      );
  }
}

export function SkeletonRows({ cols, n = 8, ghost }: { cols: ColState[]; n?: number; ghost?: boolean }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={s.row} data-skeleton={ghost ? "ghost" : "load"} aria-hidden="true" style={{ "--i": i } as CSSProperties}>
          {cols.map((c) => (
            <div key={c.id} className={s.td} data-col={c.id}>
              <span className={s.skel} data-col={c.id} style={{ "--w": `${c.id === "name" ? 40 + ((i * 37) % 45) : 55 + ((i * 23) % 35)}%` } as CSSProperties} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
