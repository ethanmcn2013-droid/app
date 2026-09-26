"use client";

import s from "./ledger.module.css";
import { daysFromToday, fmtDate, fmtRelative, statusLooksStale, type Project } from "./data";
import { rollup } from "./model";
import { Avatar, Icon, StatusGlyph, StatusPill, Swatch } from "./parts";
import type { Item } from "./table";

export function MobileList({
  items,
  selected,
  flashId,
  onOpen,
  onToggleSelect,
  onToggleGroup,
  onWrap,
}: {
  items: Item[];
  selected: Set<string>;
  flashId: string | null;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleGroup: (key: string) => void;
  onWrap: (id: string) => void;
}) {
  const selecting = selected.size > 0;
  return (
    <ul className={s.mList} aria-label="Projects">
      {items.map((it) => {
        if (it.type === "group") {
          const g = it.group;
          return (
            <li key={`g-${g.key}`} className={s.mGroup}>
              <button type="button" className={s.groupBtn} aria-expanded={!it.collapsed} onClick={() => onToggleGroup(g.key)}>
                <Icon.chevron size={14} className={s.groupChevron} />
                {g.status && <StatusGlyph status={g.status} />}
                {g.owner && <Avatar who={g.owner} size={18} />}
                {g.kind && <span className={s.kindDot} data-kind={g.kind} />}
                <span className={s.groupLabel}>{g.label}</span>
                <span className={s.groupRoll}>{rollup(g)}</span>
              </button>
            </li>
          );
        }
        const p: Project = it.project;
        const n = daysFromToday(p.date);
        const tone = p.status === "wrapped" ? "done" : n < 0 ? "past" : n <= 14 ? "soon" : undefined;
        const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
        const isSel = selected.has(p.id);
        const past = n < 0 && p.status !== "wrapped";
        return (
          <li key={p.id} className={s.mRow} data-row={p.id} data-selected={isSel || undefined} data-flash={flashId === p.id || undefined}>
            <button
              type="button"
              className={s.mSelect}
              aria-pressed={isSel}
              aria-label={`${isSel ? "Deselect" : "Select"} ${p.name}`}
              onClick={() => onToggleSelect(p.id)}
            >
              {isSel ? (
                <span className={s.mChecked}>
                  <Icon.check size={12} />
                </span>
              ) : selecting ? (
                <span className={s.mUnchecked} />
              ) : (
                <Swatch tone={p.tone} name={p.name} size={20} />
              )}
            </button>
            <button type="button" className={s.mMain} onClick={() => (selecting ? onToggleSelect(p.id) : onOpen(p.id))}>
              <span className={s.mLine1}>
                <span className={s.mName}>{p.name}</span>
                <StatusPill status={p.status} compact stale={statusLooksStale(p)} past={past} />
              </span>
              <span className={s.mLine2}>
                <span className={s.mDate} data-tone={tone}>
                  {past ? `Ended ${-n} ${n === -1 ? "day" : "days"} ago` : `${fmtRelative(p.date)}, ${fmtDate(p.date)}`}
                </span>
                <span className={s.mProg}>
                  <span className={s.mProgTrack}>
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  {p.done}/{p.total}
                  {p.overdue > 0 && <span className={s.progressLate}>· {p.overdue} late</span>}
                </span>
              </span>
            </button>
            {past && (
              <button type="button" className={s.mWrap} onClick={() => onWrap(p.id)} aria-label={`Wrap up ${p.name}`}>
                Wrap up
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
