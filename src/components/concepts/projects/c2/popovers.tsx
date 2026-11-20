"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import s from "./ledger.module.css";
import {
  KINDS,
  OWNERS,
  PEOPLE,
  STATUSES,
  TODAY,
  addDays,
  daysFromToday,
  fmtDate,
  fmtRelative,
  fmtWeekday,
  parseDate,
  toIso,
  toTime,
  type PersonId,
  type Project,
  type StatusId,
} from "./data";
import { COL_META, GROUPS, filterKey, filterLabel, type ColState, type Filter, type GroupId } from "./model";
import { Avatar, Icon, Kbd, StatusGlyph } from "./parts";

export type Rect = { x: number; y: number; w: number; h: number };

export function rectOf(el: Element | null | undefined): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/* ── Popover shell: fixed layer, flips above when needed, sheet on phones ── */

export function Popover({
  rect,
  width = 260,
  align = "start",
  label,
  onClose,
  mobile,
  side = "below",
  height = 420,
  children,
}: {
  side?: "below" | "left";
  /** Expected height, used to keep a side popover on screen. */
  height?: number;
  rect: Rect;
  width?: number;
  align?: "start" | "end";
  label: string;
  onClose: () => void;
  mobile?: boolean;
  children: ReactNode;
}) {
  const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const below = vh - (rect.y + rect.h);
  const up = below < 320 && rect.y > below;
  let left = align === "end" ? rect.x + rect.w - width : rect.x;
  left = Math.max(12, Math.min(left, vw - width - 12));
  let style: CSSProperties = up
    ? { left, bottom: vh - rect.y + 6, width }
    : { left, top: rect.y + rect.h + 6, width };
  let caret: number | null = null;
  if (side === "left" && rect.x - width - 12 > 12) {
    // Sit beside the edited cell, top edge level with its row, so the ghost preview of the new
    // date stays in view. Near the bottom of the screen the popover lifts, and the caret still
    // points at the cell.
    const top = Math.max(12, Math.min(rect.y - 6, vh - height - 12));
    style = { left: rect.x - width - 12, top, width };
    caret = rect.y + rect.h / 2 - top;
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  if (mobile) {
    return (
      <div className={s.layer} onKeyDown={onKey}>
        <motion.div className={s.scrim} onMouseDown={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
        <motion.div
          className={s.sheetPop}
          role="dialog"
          aria-label={label}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 520, damping: 42 }}
        >
          <div className={s.sheetHandle} aria-hidden="true" />
          {children}
        </motion.div>
      </div>
    );
  }

  return (
    <div className={s.layer} onKeyDown={onKey}>
      <div className={s.layerCatch} onMouseDown={onClose} />
      <motion.div
        className={s.pop}
        style={style}
        role="dialog"
        aria-label={label}
        initial={{ opacity: 0, y: up ? 4 : -4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
        data-side={caret !== null ? "left" : undefined}
      >
        {children}
        {caret !== null && <span className={s.popCaret} style={{ top: caret }} aria-hidden="true" />}
      </motion.div>
    </div>
  );
}

/* ── Menu: keyboard list with optional search and single-key picks ───── */

export type MenuItem = {
  id: string;
  label: ReactNode;
  text?: string;
  icon?: ReactNode;
  hint?: ReactNode;
  shortcut?: string;
  checked?: boolean;
  section?: string;
};

export function Menu({
  items,
  onSelect,
  search,
  placeholder,
  initial,
  footer,
  header,
}: {
  header?: ReactNode;
  items: MenuItem[];
  onSelect: (id: string) => void;
  search?: boolean;
  placeholder?: string;
  initial?: string;
  footer?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(
    () =>
      q
        ? items.filter((it) => (it.text ?? String(it.label)).toLowerCase().includes(q.toLowerCase()))
        : items,
    [items, q],
  );
  const [active, setActive] = useState(() => Math.max(0, items.findIndex((i) => i.id === initial)));
  const idx = Math.min(active, Math.max(0, shown.length - 1));
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (input.current ?? root.current)?.focus();
  }, []);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || (!search && e.key === "j")) {
      e.preventDefault();
      setActive((idx + 1) % Math.max(1, shown.length));
    } else if (e.key === "ArrowUp" || (!search && e.key === "k")) {
      e.preventDefault();
      setActive((idx - 1 + shown.length) % Math.max(1, shown.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[idx]) onSelect(shown[idx].id);
    } else if (!search && !e.metaKey && !e.ctrlKey) {
      const hit = items.find((i) => i.shortcut && i.shortcut === e.key);
      if (hit) {
        e.preventDefault();
        onSelect(hit.id);
      }
    }
  };

  return (
    <div className={s.menu} ref={root} tabIndex={-1} onKeyDown={onKey} role="presentation">
      {header}
      {search && (
        <div className={s.menuSearch}>
          <Icon.search size={14} />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            className={s.menuInput}
          />
        </div>
      )}
      <div className={s.menuList} role="listbox" aria-activedescendant={shown[idx] ? `mi-${shown[idx].id}` : undefined}>
        {shown.length === 0 && <div className={s.menuEmpty}>No matches</div>}
        {shown.map((it, i) => {
          const head = it.section && (i === 0 || shown[i - 1].section !== it.section) ? it.section : null;
          return (
            <div key={it.id}>
              {head && <div className={s.menuSection}>{head}</div>}
              <div
                id={`mi-${it.id}`}
                role="option"
                aria-selected={i === idx}
                data-active={i === idx || undefined}
                className={s.menuItem}
                onMouseMove={() => i !== idx && setActive(i)}
                onClick={() => onSelect(it.id)}
              >
                {it.icon && <span className={s.menuIcon}>{it.icon}</span>}
                <span className={s.menuLabel}>{it.label}</span>
                {it.checked && <Icon.check size={14} className={s.menuCheck} />}
                {it.hint && <span className={s.menuHint}>{it.hint}</span>}
                {it.shortcut && !it.hint && <Kbd>{it.shortcut}</Kbd>}
              </div>
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}

/* ── Status editor: pick, then a required reason for risk ─────────────── */

export function StatusEditor({
  current,
  count,
  note,
  onCommit,
}: {
  current?: StatusId;
  count: number;
  /** Why this status deserves a second look, so keyboard users get the same explanation as hover. */
  note?: { title: string; text: string } | null;
  onCommit: (status: StatusId, reason: string) => void;
}) {
  const [pending, setPending] = useState<StatusId | null>(null);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);

  if (pending) {
    const label = pending === "at_risk" ? "at risk" : "off track";
    const submit = () => {
      if (!reason.trim()) {
        setTried(true);
        return;
      }
      onCommit(pending, reason.trim());
    };
    return (
      <div className={s.reason}>
        <div className={s.reasonHead}>
          <StatusGlyph status={pending} />
          <span>
            Why is {count > 1 ? `this set` : "it"} {label}?
          </span>
        </div>
        <input
          autoFocus
          className={s.reasonInput}
          value={reason}
          maxLength={120}
          placeholder="One line, for example: caterer hasn't confirmed"
          aria-label="Reason"
          aria-invalid={tried && !reason.trim()}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className={s.reasonFoot}>
          <span className={s.reasonNote} data-error={(tried && !reason.trim()) || undefined}>
            {tried && !reason.trim() ? "A reason is needed so the team knows what changed." : "Posted to the project as an update."}
          </span>
          <button type="button" className={s.btnGhostSm} onClick={() => setPending(null)}>
            Back
          </button>
          <button type="button" className={s.btnPrimarySm} onClick={submit}>
            Post <Kbd>↵</Kbd>
          </button>
        </div>
      </div>
    );
  }

  return (
    <Menu
      header={
        note ? (
          <div className={s.statusNote}>
            <Icon.clock size={14} />
            <span>
              <strong>{note.title}.</strong> {note.text}
            </span>
          </div>
        ) : null
      }
      initial={current}
      items={STATUSES.map((st) => ({
        id: st.id,
        label: st.label,
        text: st.label,
        icon: <StatusGlyph status={st.id} />,
        shortcut: st.key,
        checked: st.id === current,
      }))}
      onSelect={(id) => {
        const st = id as StatusId;
        if (st === "at_risk" || st === "off_track") setPending(st);
        else onCommit(st, "");
      }}
    />
  );
}

/* ── Owner ──────────────────────────────────────────────────────────── */

export function OwnerMenu({ current, onPick }: { current?: PersonId; onPick: (p: PersonId) => void }) {
  const ids = [...OWNERS, ...(Object.keys(PEOPLE) as PersonId[]).filter((p) => !OWNERS.includes(p))];
  return (
    <Menu
      search
      placeholder="Set owner"
      initial={current}
      items={ids.map((p, i) => ({
        id: p,
        text: PEOPLE[p].name,
        label: (
          <span className={s.ownerOpt}>
            <span>{PEOPLE[p].short}</span>
            <span className={s.ownerRole}>{PEOPLE[p].role}</span>
          </span>
        ),
        icon: <Avatar who={p} size={18} />,
        checked: p === current,
        section: i < OWNERS.length ? "Team" : "Collaborators",
      }))}
      onSelect={(id) => onPick(id as PersonId)}
    />
  );
}

/* ── Date: type it, shift it, or pick it. Previews as ghost text. ─────── */

export type DatePreview = { ids: string[]; delta?: number; iso?: string };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function DateEditor({
  projects,
  onPreview,
  onCommit,
}: {
  projects: Project[];
  onPreview: (p: DatePreview | null) => void;
  onCommit: (p: DatePreview) => void;
}) {
  const bulk = projects.length > 1;
  const ids = projects.map((p) => p.id);
  const [text, setText] = useState("");
  const [delta, setDelta] = useState(0);
  const [pickIso, setPickIso] = useState<string | null>(null);
  const first = projects[0];
  const [month, setMonth] = useState(() => {
    const d = new Date(toTime(first.date));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });

  const parsed = text ? parseDate(text) : null;
  const shiftMatch = text.trim().match(/^([+-])\s*(\d+)\s*(d|w)?$/i);
  const typedDelta = shiftMatch ? (shiftMatch[1] === "-" ? -1 : 1) * Number(shiftMatch[2]) * (shiftMatch[3]?.toLowerCase() === "w" ? 7 : 1) : null;

  const plan: DatePreview | null =
    typedDelta !== null
      ? { ids, delta: typedDelta }
      : parsed && !bulk
        ? { ids, iso: parsed }
        : parsed && bulk
          ? { ids, delta: daysFromToday(parsed) - daysFromToday(first.date) }
          : pickIso
            ? bulk
              ? { ids, delta: daysFromToday(pickIso) - daysFromToday(first.date) }
              : { ids, iso: pickIso }
            : delta
              ? { ids, delta }
              : null;

  const shift = (n: number) => {
    const next = delta + n;
    setDelta(next);
    setText("");
    setPickIso(null);
    onPreview(next ? { ids, delta: next } : null);
  };

  const commit = () => {
    if (plan) onCommit(plan);
  };

  const newDateFor = (p: Project) =>
    plan?.iso ? plan.iso : plan?.delta ? addDays(p.date, plan.delta) : p.date;

  // Month grid
  const firstDay = Date.UTC(month.y, month.m, 1);
  const lead = (new Date(firstDay).getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => toIso(Date.UTC(month.y, month.m, i + 1)))];
  const target = newDateFor(first);
  const currentDates = new Set(projects.map((p) => p.date));

  return (
    <div className={s.dateEd}>
      <div className={s.dateInputRow}>
        <Icon.calendar size={14} />
        <input
          autoFocus
          className={s.dateInput}
          value={text}
          placeholder={bulk ? "Try +7, -3, +2w or 12 Dec" : "Try 12 Dec, in 3 weeks or +7"}
          aria-label="New date"
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            setDelta(0);
            setPickIso(null);
            const p = v ? parseDate(v) : null;
            const sm = v.trim().match(/^([+-])\s*(\d+)\s*(d|w)?$/i);
            if (sm) onPreview({ ids, delta: (sm[1] === "-" ? -1 : 1) * Number(sm[2]) * (sm[3]?.toLowerCase() === "w" ? 7 : 1) });
            else if (p) onPreview(bulk ? { ids, delta: daysFromToday(p) - daysFromToday(first.date) } : { ids, iso: p });
            else onPreview(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
      </div>
      <div className={s.dateParsed} aria-live="polite">
        {plan ? (
          bulk ? (
            <span>
              Shift {projects.length} dates by{" "}
              <strong>
                {plan.delta! > 0 ? "+" : ""}
                {plan.delta} day{Math.abs(plan.delta!) === 1 ? "" : "s"}
              </strong>
            </span>
          ) : (
            <span>
              {fmtDate(first.date)} <Icon.arrowRight size={12} /> <span className={s.dateParsedTo}><strong>{fmtWeekday(target)} {fmtDate(target)}</strong>, {fmtRelative(target).toLowerCase()}</span>
            </span>
          )
        ) : text ? (
          <span className={s.dateMiss}>Try Fri, 12 Dec or +7</span>
        ) : (
          <span>
            {bulk ? (
              <>
                {projects.length} dates, starting {fmtWeekday(first.date)} {fmtDate(first.date)}
              </>
            ) : (
              <>
                Currently {fmtWeekday(first.date)} {fmtDate(first.date, toTime(first.date) >= toTime("2027-01-01"))}
              </>
            )}
          </span>
        )}
      </div>
      <div className={s.shiftRow} role="group" aria-label="Shift dates">
        {[-7, -1, 1, 7, 14].map((n) => (
          <button key={n} type="button" className={s.shiftBtn} onClick={() => shift(n)}>
            {n > 0 ? "+" : "−"}
            {Math.abs(n) === 7 ? "1w" : Math.abs(n) === 14 ? "2w" : "1d"}
          </button>
        ))}
      </div>
      <div className={s.cal}>
        <div className={s.calHead}>
          <button type="button" className={s.calNav} aria-label="Previous month" onClick={() => setMonth((m) => (m.m === 0 ? { y: m.y - 1, m: 11 } : { y: m.y, m: m.m - 1 }))}>
            <Icon.chevron size={14} className={s.flip} />
          </button>
          <span>
            {MONTH_NAMES[month.m]} {month.y}
          </span>
          <button type="button" className={s.calNav} aria-label="Next month" onClick={() => setMonth((m) => (m.m === 11 ? { y: m.y + 1, m: 0 } : { y: m.y, m: m.m + 1 }))}>
            <Icon.chevron size={14} />
          </button>
        </div>
        <div className={s.calGrid}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className={s.calDow}>
              {d}
            </span>
          ))}
          {cells.map((iso, i) =>
            iso ? (
              <button
                key={iso}
                type="button"
                className={s.calDay}
                data-today={iso === TODAY || undefined}
                data-current={currentDates.has(iso) || undefined}
                data-target={(plan && iso === target) || undefined}
                data-past={daysFromToday(iso) < 0 || undefined}
                aria-label={fmtDate(iso, true)}
                onClick={() => {
                  setPickIso(iso);
                  setText("");
                  setDelta(0);
                  onPreview(bulk ? { ids, delta: daysFromToday(iso) - daysFromToday(first.date) } : { ids, iso });
                }}
              >
                {Number(iso.slice(8))}
              </button>
            ) : (
              <span key={`e${i}`} />
            ),
          )}
        </div>
      </div>
      <div className={s.dateFoot}>
        <span className={s.dateFootNote}>{bulk ? "New dates show in the table before you confirm." : "Enter to save"}</span>
        <button type="button" className={s.btnPrimarySm} disabled={!plan} onClick={commit}>
          {bulk ? `Move ${projects.length} dates` : "Save date"}
        </button>
      </div>
    </div>
  );
}

/* ── Group by ───────────────────────────────────────────────────────── */

export function GroupMenu({ current, onPick }: { current: GroupId; onPick: (g: GroupId) => void }) {
  return (
    <Menu
      initial={current}
      items={GROUPS.map((g, i) => ({ id: g.id, label: g.label, text: g.label, checked: g.id === current, shortcut: String(i) }))}
      onSelect={(id) => onPick(id as GroupId)}
    />
  );
}

/* ── Display: columns and preview states ─────────────────────────────── */

export type PreviewState = "live" | "loading" | "empty";

export function DisplayMenu({
  cols,
  onToggle,
  onMove,
  onReset,
  preview,
  onPreview,
}: {
  cols: ColState[];
  onToggle: (id: ColState["id"]) => void;
  onMove: (id: ColState["id"], dir: -1 | 1) => void;
  onReset: () => void;
  preview: PreviewState;
  onPreview: (p: PreviewState) => void;
}) {
  return (
    <div className={s.display}>
      <div className={s.menuSection}>Columns</div>
      <ul className={s.colList}>
        {cols.map((c, i) => (
          <li key={c.id} className={s.colItem}>
            <label className={s.colLabel}>
              <input
                type="checkbox"
                className={s.check}
                checked={!c.hidden}
                disabled={c.id === "name"}
                onChange={() => onToggle(c.id)}
              />
              <span>{COL_META[c.id].label}</span>
            </label>
            {c.id !== "name" && (
              <span className={s.colMove}>
                <button type="button" className={s.iconBtnXs} aria-label={`Move ${COL_META[c.id].label} left`} disabled={i <= 1} onClick={() => onMove(c.id, -1)}>
                  <Icon.arrowUp size={12} />
                </button>
                <button type="button" className={s.iconBtnXs} aria-label={`Move ${COL_META[c.id].label} right`} disabled={i === cols.length - 1} onClick={() => onMove(c.id, 1)}>
                  <Icon.arrowDown size={12} />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className={s.displayNote}>Drag headers to reorder, drag their edges to resize.</p>
      <button type="button" className={s.btnGhostSm} onClick={onReset}>
        Reset columns
      </button>
      <div className={s.displayDivider} />
      <div className={s.menuSection}>Preview state</div>
      <div className={s.segment} role="radiogroup" aria-label="Preview state">
        {(
          [
            ["live", "Live"],
            ["loading", "Loading"],
            ["empty", "No projects"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={preview === id} className={s.segmentBtn} onClick={() => onPreview(id)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Filter bar: Raycast-style, type to find a field and value ────────── */

type Suggestion = { f: Filter; section: string; icon: ReactNode };

const SUGGESTIONS: Suggestion[] = [
  ...STATUSES.filter((st) => st.id !== "wrapped").map((st) => ({ f: { field: "status" as const, value: st.id }, section: "Status", icon: <StatusGlyph status={st.id} /> })),
  ...KINDS.map((k) => ({ f: { field: "kind" as const, value: k.id }, section: "Kind", icon: <span className={s.kindDot} data-kind={k.id} /> })),
  ...OWNERS.map((p) => ({ f: { field: "owner" as const, value: p }, section: "Owner", icon: <Avatar who={p} size={16} /> })),
  { f: { field: "overdue", value: "yes" }, section: "Tasks", icon: <Icon.clock size={14} /> },
  { f: { field: "past", value: "yes" }, section: "Date", icon: <Icon.clock size={14} /> },
  { f: { field: "within", value: "14" }, section: "Date", icon: <Icon.calendar size={14} /> },
  { f: { field: "within", value: "30" }, section: "Date", icon: <Icon.calendar size={14} /> },
];

export function FilterBar({
  filters,
  onToggle,
  onRemoveLast,
  countFor,
}: {
  filters: Filter[];
  onToggle: (f: Filter) => void;
  onRemoveLast: () => void;
  countFor: (f: Filter) => number;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = SUGGESTIONS.filter((sg) => {
    const hay = `${filterLabel(sg.f)} ${sg.section}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const idx = Math.min(active, Math.max(0, shown.length - 1));
  const on = new Set(filters.map(filterKey));

  return (
    <div className={s.fbar}>
      <div className={s.fbarInputRow}>
        <Icon.filter size={14} />
        <input
          autoFocus
          className={s.fbarInput}
          value={q}
          placeholder={filters.length ? "Add another filter" : "Filter by status, kind, owner…"}
          aria-label="Filter projects"
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((idx + 1) % Math.max(1, shown.length));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((idx - 1 + shown.length) % Math.max(1, shown.length));
            } else if (e.key === "Enter" && shown[idx]) {
              e.preventDefault();
              onToggle(shown[idx].f);
              setQ("");
            } else if (e.key === "Backspace" && !q && filters.length) {
              onRemoveLast();
            }
          }}
        />
        <Kbd>esc</Kbd>
      </div>
      <div className={s.menuList} role="listbox">
        {shown.length === 0 && <div className={s.menuEmpty}>No filter matches “{q}”</div>}
        {shown.map((sg, i) => {
          const head = i === 0 || shown[i - 1].section !== sg.section ? sg.section : null;
          const n = countFor(sg.f);
          return (
            <div key={filterKey(sg.f)}>
              {head && <div className={s.menuSection}>{head}</div>}
              <div
                role="option"
                aria-selected={i === idx}
                data-active={i === idx || undefined}
                className={s.menuItem}
                onMouseMove={() => i !== idx && setActive(i)}
                onClick={() => {
                  onToggle(sg.f);
                  setQ("");
                }}
              >
                <span className={s.menuIcon}>{sg.icon}</span>
                <span className={s.menuLabel}>{filterLabel(sg.f)}</span>
                {on.has(filterKey(sg.f)) ? <Icon.check size={14} className={s.menuCheck} /> : <span className={s.menuHint}>{n}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className={s.fbarFoot}>
        <span>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> choose
        </span>
        <span>
          <Kbd>↵</Kbd> add
        </span>
        <span>
          <Kbd>⌫</Kbd> remove last
        </span>
      </div>
    </div>
  );
}
