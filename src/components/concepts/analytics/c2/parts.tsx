"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import type { Lever, Project, Risk } from "./data";
import s from "./c2.module.css";

/* ── Rolling number: each digit rolls to its new value ─────────────────── */

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Roll({ value }: { value: number }) {
  const text = String(value);
  return (
    <span className={s.roll}>
      {text.split("").map((ch, i) => {
        const key = text.length - i;
        if (!/\d/.test(ch)) return <span key={`c${key}`}>{ch}</span>;
        return (
          <span key={key} className={s.rollWindow}>
            <span className={s.rollStrip} style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>
              {DIGITS.map((d) => (
                <span key={d} className={s.rollDigit}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/* ── Project switcher ──────────────────────────────────────────────────── */

export function Switcher({
  projects,
  current,
  status,
  onPick,
}: {
  projects: Project[];
  current: Project;
  status: Record<string, { text: string; tone: "good" | "late" | "quiet" }>;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const focusItem = (dir: 1 | -1 | "first" | "last") => {
    const items = Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? []);
    const i = items.findIndex((el) => el === document.activeElement);
    let next = 0;
    if (dir === "first") next = 0;
    else if (dir === "last") next = items.length - 1;
    else next = (i + dir + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div className={s.switcher} ref={wrap}>
      <button
        type="button"
        className={s.switcherButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusItem("first"));
          }
        }}
      >
        <span className={s.tile} style={{ background: `var(--v3-project-${current.tone})` }} aria-hidden="true">
          {current.initials}
        </span>
        <span className={s.switcherName}>{current.name}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={s.chev}>
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={listId}
            role="menu"
            aria-label="Choose a project"
            className={s.menu}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                focusItem(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                focusItem(-1);
              } else if (e.key === "Home") {
                e.preventDefault();
                focusItem("first");
              } else if (e.key === "End") {
                e.preventDefault();
                focusItem("last");
              } else if (e.key === "Escape") {
                setOpen(false);
                wrap.current?.querySelector<HTMLButtonElement>("button")?.focus();
              }
            }}
          >
            <div className={s.menuHead}>Your projects</div>
            {projects.map((p) => {
              const st = status[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={p.id === current.id}
                  className={s.menuItem}
                  onClick={() => {
                    onPick(p.id);
                    setOpen(false);
                  }}
                >
                  <span className={s.tileSmall} style={{ background: `var(--v3-project-${p.tone})` }} aria-hidden="true">
                    {p.initials}
                  </span>
                  <span className={s.menuText}>
                    <span className={s.menuName}>{p.name}</span>
                    <span className={st?.tone === "late" ? s.menuLate : st?.tone === "good" ? s.menuGood : s.menuQuiet}>{st?.text}</span>
                  </span>
                  {p.id === current.id && (
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={s.check}>
                      <path d="M3 7.2 5.8 10 11 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Levers ────────────────────────────────────────────────────────────── */

export type LeverView = Lever & { days: number };

export function Levers({
  levers,
  active,
  onToggle,
  onReset,
  combined,
  occasion,
}: {
  levers: LeverView[];
  active: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
  combined: number | null;
  occasion: string;
}) {
  const reduced = useReducedMotion();
  const helps = levers.filter((l) => l.days <= 0).sort((a, b) => a.days - b.days);
  const hurts = levers.filter((l) => l.days > 0);
  const any = active.length > 0;

  const card = (l: LeverView) => {
    const on = active.includes(l.id);
    const sooner = l.days < 0;
    const amount = Math.abs(l.days);
    return (
      <li key={l.id} className={s.leverItem}>
        <button type="button" role="switch" aria-checked={on} className={on ? s.leverOn : s.lever} onClick={() => onToggle(l.id)}>
          <span className={s.leverTop}>
            <span className={on ? s.toggleOn : s.toggle} aria-hidden="true">
              <span className={s.knob} />
            </span>
            <span className={sooner ? s.effectGood : l.days === 0 ? s.effectFlat : s.effectBad}>
              {l.days === 0 ? "Barely moves it" : `${amount} ${amount === 1 ? "day" : "days"} ${sooner ? "sooner" : "later"}`}
            </span>
          </span>
          <span className={s.leverTitle}>{l.title}</span>
          <span className={s.leverDetail}>{l.detail}</span>
        </button>
      </li>
    );
  };

  return (
    <section className={s.levers} aria-labelledby="c2-levers">
      <div className={s.sectionHead}>
        <h2 id="c2-levers" className={s.h2}>
          What would move it
        </h2>
        <p className={s.sub}>Switch one on and watch the forecast move.</p>
      </div>
      <ul className={s.leverList}>{helps.map(card)}</ul>
      {hurts.length > 0 && (
        <>
          <h3 className={s.h3}>What could push it later</h3>
          <ul className={s.leverList}>{hurts.map(card)}</ul>
        </>
      )}
      <AnimatePresence initial={false}>
        {any && (
          <motion.div
            className={s.whatIf}
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className={s.whatIfInner}>
              <p className={s.whatIfText}>
                {combined !== null && combined !== 0 && (
                  <strong className={s.whatIfStrong}>
                    {`Together: ${Math.abs(combined)} ${Math.abs(combined) === 1 ? "day" : "days"} ${combined < 0 ? "sooner" : "later"}. `}
                  </strong>
                )}
                This is a what-if. Nothing changes until you do it on the board.
              </p>
              <button type="button" className={s.resetButton} onClick={onReset}>
                Reset
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!any && <p className={s.leverFoot}>{`Each one is measured against today's forecast for ${occasion}, on its own.`}</p>}
    </section>
  );
}

/* ── What is in the way ────────────────────────────────────────────────── */

export function Risks({ risks }: { risks: Risk[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const reduced = useReducedMotion();
  return (
    <section className={s.risks} aria-labelledby="c2-risks">
      <div className={s.sectionHead}>
        <h2 id="c2-risks" className={s.h2}>
          What is in the way
        </h2>
        <p className={s.sub}>The open things most likely to hold it up: late, moved again and again, or waiting on someone outside the team.</p>
      </div>
      <ul className={s.riskList}>
        {risks.map((r) => {
          const isOpen = open === r.id;
          return (
            <li key={r.id} className={s.riskItem}>
              <button
                type="button"
                className={s.riskRow}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : r.id)}
              >
                <span className={s.avatar} style={{ background: `var(--v3-project-${r.owner.tone})` }} title={r.owner.name} aria-hidden="true">
                  {r.owner.initials}
                </span>
                <span className={s.riskBody}>
                  <span className={s.riskTitleRow}>
                    <span className={s.riskTitle}>{r.title}</span>
                    <span className={r.tone === "danger" ? s.tagDanger : r.tone === "warning" ? s.tagWarning : s.tagNeutral}>{r.tag}</span>
                  </span>
                  <span className={s.riskReason}>
                    <span className={s.srOnly}>{`${r.owner.name}. `}</span>
                    {r.reason}
                  </span>
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={isOpen ? s.riskChevOpen : s.riskChev}>
                  <path d="M5 3.5 8.5 7 5 10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className={s.riskMore}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={s.riskMoreInner}>
                      <p className={s.riskOwner}>{`${r.owner.name} has this one.`}</p>
                      {r.story.length > 0 ? (
                        <ol className={s.story}>
                          {r.story.map((st) => (
                            <li key={st.date + st.text} className={s.storyItem}>
                              <span className={s.storyDate}>{st.date}</span>
                              <span>{st.text}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className={s.riskOwner}>No changes recorded yet.</p>
                      )}
                      <a className={s.linkButton} href="/app/tasks">
                        Open in Tasks
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
