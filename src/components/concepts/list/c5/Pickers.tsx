"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  diffDays,
  FOR_OPTIONS,
  monthName,
  PEOPLE,
  QUICK_DATES,
  TODAY,
  toDate,
  weekday,
  type Person,
  type PersonId,
} from "./data";
import { Icon } from "./icons";
import { useMounted } from "./hooks";
import s from "./c5.module.css";

/* ── Avatar ────────────────────────────────────────────────────────── */

export function Avatar({ person, size = 28 }: { person: Person | null; size?: number }) {
  if (!person) {
    return (
      <span className={s.avatarNone} style={{ width: size, height: size }} aria-hidden>
        <Icon.hand size={Math.round(size * 0.52)} />
      </span>
    );
  }
  return (
    <span
      className={person.external ? `${s.avatar} ${s.avatarExternal}` : s.avatar}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.4)),
        ["--hue" as string]: `var(--v3-project-${person.hue})`,
      }}
      aria-hidden
    >
      {person.name.slice(0, 1)}
    </span>
  );
}

/* ── Floating surface: popover on desktop, bottom sheet on phone ──── */

export type Placement = { x: "left" | "right"; y: "down" | "up" };

export function Floating({
  open,
  phone,
  title,
  placement,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  phone: boolean;
  title: string;
  placement: Placement;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  useEffect(() => {
    if (!open || phone) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = window.setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, phone, onClose]);

  if (phone) {
    if (!mounted) return null;
    return createPortal(
      <AnimatePresence>
        {open && (
          <div className={s.sheetLayer} key="sheet">
            <motion.div
              className={s.scrim}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className={s.sheet}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <div className={s.sheetGrab} aria-hidden />
              <div className={s.sheetHead}>
                <h2 className={s.sheetTitle}>{title}</h2>
                <button type="button" className={s.iconButton} onClick={onClose} aria-label="Close">
                  <Icon.close />
                </button>
              </div>
              <div className={s.sheetBody}>{children}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body,
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-label={title}
          className={[
            s.popover,
            placement.x === "right" ? s.popRight : "",
            placement.y === "up" ? s.popUp : "",
            wide ? s.popWide : "",
          ].join(" ")}
          initial={{ opacity: 0, y: placement.y === "up" ? 4 : -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: placement.y === "up" ? 4 : -4, scale: 0.98, transition: { duration: 0.1 } }}
          transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <p className={s.popTitle}>{title}</p>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Date ──────────────────────────────────────────────────────────── */

export function DatePicker({ value, onPick }: { value: string | null; onPick: (iso: string | null) => void }) {
  const start = useMemo(() => {
    // Monday of this week
    const d = toDate(TODAY);
    const back = (d.getDay() + 6) % 7;
    return addDays(TODAY, -back);
  }, []);
  const days = Array.from({ length: 35 }, (_, i) => addDays(start, i));
  const firstMonth = toDate(days[0]).getMonth();
  const lastMonth = toDate(days[days.length - 1]).getMonth();
  const label = firstMonth === lastMonth ? monthName(firstMonth) : `${monthName(firstMonth)} and ${monthName(lastMonth)}`;

  return (
    <div className={s.datePicker}>
      <div className={s.quickRow}>
        {QUICK_DATES.map((q) => (
          <button
            type="button"
            key={q.label}
            className={q.iso === value ? `${s.quick} ${s.quickOn}` : s.quick}
            onClick={() => onPick(q.iso)}
          >
            <span>{q.label}</span>
            <span className={s.quickSub}>
              {q.iso ? `${weekday(q.iso).slice(0, 3)} ${toDate(q.iso).getDate()}` : ""}
            </span>
          </button>
        ))}
      </div>
      <p className={s.calLabel}>{label}</p>
      <div className={s.calGrid} role="grid" aria-label="Pick a day">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className={s.calHead} aria-hidden>
            {d}
          </span>
        ))}
        {days.map((iso) => {
          const past = diffDays(iso) < 0;
          const d = toDate(iso);
          const cls = [
            s.calDay,
            iso === TODAY ? s.calToday : "",
            iso === value ? s.calOn : "",
            d.getDate() === 1 ? s.calFirst : "",
          ].join(" ");
          return (
            <button
              type="button"
              key={iso}
              className={cls}
              disabled={past}
              onClick={() => onPick(iso)}
              aria-label={`${weekday(iso)} ${d.getDate()} ${monthName(d.getMonth())}`}
              aria-pressed={iso === value}
            >
              {d.getDate() === 1 ? `${monthName(d.getMonth()).slice(0, 3)} 1` : d.getDate()}
            </button>
          );
        })}
      </div>
      <button type="button" className={value === null ? `${s.plainOption} ${s.plainOptionOn}` : s.plainOption} onClick={() => onPick(null)}>
        <Icon.clock />
        No date yet
      </button>
    </div>
  );
}

/* ── Person ────────────────────────────────────────────────────────── */

export function PersonPicker({
  value,
  onPick,
  noneLabel,
  exclude,
}: {
  value: PersonId | null;
  onPick: (id: PersonId | null) => void;
  noneLabel: string;
  exclude?: PersonId | null;
}) {
  const [q, setQ] = useState("");
  const list = PEOPLE.filter((p) => p.id !== exclude).filter((p) =>
    `${p.name} ${p.role} ${p.from ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <div className={s.pickList}>
      <input
        className={s.pickSearch}
        placeholder="Find a person"
        value={q}
        autoFocus
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && list[0]) onPick(list[0].id);
        }}
        aria-label="Find a person"
      />
      <div className={s.pickScroll}>
        {list.map((p) => (
          <button type="button" key={p.id} className={s.pickRow} onClick={() => onPick(p.id)} aria-pressed={p.id === value}>
            <Avatar person={p} size={24} />
            <span className={s.pickName}>{p.name}</span>
            <span className={s.pickMeta}>{p.from ?? p.role}</span>
            {p.id === value && <Icon.check className={s.pickCheck} />}
          </button>
        ))}
        {list.length === 0 && <p className={s.pickEmpty}>Nobody by that name yet.</p>}
      </div>
      <button type="button" className={value === null ? `${s.plainOption} ${s.plainOptionOn}` : s.plainOption} onClick={() => onPick(null)}>
        <Icon.hand />
        {noneLabel}
      </button>
    </div>
  );
}

/* ── For whom ──────────────────────────────────────────────────────── */

export function ForPicker({ value, onPick }: { value: string | null; onPick: (v: string | null) => void }) {
  const [q, setQ] = useState("");
  const options = [...FOR_OPTIONS, ...PEOPLE.map((p) => p.name)];
  const filtered = options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
  const typed = q.trim();
  return (
    <div className={s.pickList}>
      <input
        className={s.pickSearch}
        placeholder="A client, an event or a person"
        value={q}
        autoFocus
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && typed) onPick(filtered[0] ?? typed);
        }}
        aria-label="Who it is for"
      />
      <div className={s.pickScroll}>
        {typed && !options.some((o) => o.toLowerCase() === typed.toLowerCase()) && (
          <button type="button" className={s.pickRow} onClick={() => onPick(typed)}>
            <span className={s.pickPlus}>
              <Icon.plus size={14} />
            </span>
            <span className={s.pickName}>for {typed}</span>
          </button>
        )}
        {filtered.map((o) => {
          const person = PEOPLE.find((p) => p.name === o) ?? null;
          return (
            <button type="button" key={o} className={s.pickRow} onClick={() => onPick(o)} aria-pressed={o === value}>
              {person ? <Avatar person={person} size={24} /> : <span className={s.pickFor} aria-hidden>{o.replace(/^the /, "").slice(0, 1).toUpperCase()}</span>}
              <span className={s.pickName}>{o}</span>
              <span className={s.pickMeta}>{person ? (person.from ?? person.role) : "Client or event"}</span>
              {o === value && <Icon.check className={s.pickCheck} />}
            </button>
          );
        })}
      </div>
      <button type="button" className={value === null ? `${s.plainOption} ${s.plainOptionOn}` : s.plainOption} onClick={() => onPick(null)}>
        <Icon.close />
        Nobody in particular
      </button>
    </div>
  );
}

/* ── Waiting on ────────────────────────────────────────────────────── */

export function WaitingPicker({
  value,
  what,
  exclude,
  onPick,
}: {
  value: PersonId | null;
  what: string | null;
  exclude: PersonId | null;
  onPick: (id: PersonId | null, what: string | null) => void;
}) {
  const [who, setWho] = useState<PersonId | null>(value);
  const [thing, setThing] = useState(what ?? "");
  return (
    <div className={s.pickList}>
      <div className={s.pickScroll}>
        {PEOPLE.filter((p) => p.id !== exclude).map((p) => (
          <button
            type="button"
            key={p.id}
            className={who === p.id ? `${s.pickRow} ${s.pickRowOn}` : s.pickRow}
            onClick={() => setWho(p.id)}
            aria-pressed={who === p.id}
          >
            <Avatar person={p} size={24} />
            <span className={s.pickName}>{p.name}</span>
            <span className={s.pickMeta}>{p.from ?? p.role}</span>
            {who === p.id && <Icon.check className={s.pickCheck} />}
          </button>
        ))}
      </div>
      <label className={s.waitField}>
        <span>Waiting on what</span>
        <input
          className={s.pickSearch}
          placeholder="the budget, the numbers"
          value={thing}
          onChange={(e) => setThing(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && who) onPick(who, thing.trim() || null);
          }}
        />
      </label>
      <div className={s.popActions}>
        <button type="button" className={s.ghostButton} onClick={() => onPick(null, null)}>
          Not waiting
        </button>
        <button type="button" className={s.primaryButton} disabled={!who} onClick={() => onPick(who, thing.trim() || null)}>
          Save
        </button>
      </div>
    </div>
  );
}

