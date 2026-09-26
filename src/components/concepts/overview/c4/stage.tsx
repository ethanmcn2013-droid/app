"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { KIND_LABEL, PEOPLE, PROJECTS, type Decision, type Evidence } from "./data";
import { Avatar, SendPreview, VerdictDot } from "./consequence";
import { verdictFor } from "./model";
import { Check, Clock, FileIcon, KindIcon, Pulse, TaskIcon } from "./icons";
import s from "./c4.module.css";

function EvidenceBlock({ items }: { items: Evidence[] }) {
  const quote = items.find((e) => e.type === "message");
  const facts = items.filter((e) => e.type !== "message");
  return (
    <div className={s.evidenceBlock}>
      {quote && quote.type === "message" && (
        <figure className={s.quote}>
          <Avatar id={quote.who} size={22} />
          <blockquote className={s.quoteText}>&ldquo;{quote.quote}&rdquo;</blockquote>
          <figcaption className={s.quoteMeta}>
            {PEOPLE[quote.who].name}, {quote.meta}
          </figcaption>
        </figure>
      )}
      <ul className={s.facts} aria-label="Evidence">
        {facts.map((e, i) => {
          const Icon = e.type === "activity" ? Pulse : e.type === "file" ? FileIcon : TaskIcon;
          return (
            <li key={i} className={s.fact}>
              <Icon size={14} />
              <span className={s.factTitle}>{e.title}</span>
              <span className={s.factMeta}>{e.meta}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function KindChip({ kind }: { kind: Decision["kind"] }) {
  return (
    <span className={`${s.kind} ${s[`kind_${kind}`]}`}>
      <KindIcon kind={kind} size={14} />
      {KIND_LABEL[kind]}
    </span>
  );
}

export function ProjectTile({ id, size = 18 }: { id: Decision["project"]; size?: number }) {
  const p = PROJECTS[id];
  return (
    <span className={s.tile} style={{ width: size, height: size, fontSize: size * 0.55, background: p.tone }} aria-hidden="true">
      {p.initial}
    </span>
  );
}

type CardProps = {
  decision: Decision;
  focus: number;
  /** The choice just committed: it shows a tick for a beat before the card files away. */
  committing: number | null;
  onFocus: (i: number) => void;
  onChoose: (i: number) => void;
  onDefer: (i: number) => void;
  deferOpen: boolean;
  setDeferOpen: (v: boolean) => void;
  showProject: boolean;
  touch: boolean;
  moot: { by: Decision["tracks"][number]["owner"]; at: string; text: string } | null;
  onMootNext: () => void;
  consequenceSlot?: React.ReactNode;
};

export function DecisionCard(p: CardProps) {
  const { decision: d } = p;
  const reduce = useReducedMotion();
  const deferBtn = useRef<HTMLButtonElement>(null);
  const [more, setMore] = useState(false);
  // Only phones clamp the context (three lines); wider screens always show all of it.
  const long = d.context.length > 120;

  return (
    <article className={s.card} aria-labelledby={`q-${d.id}`}>
      <div className={p.moot ? `${s.cardBody} ${s.cardBodyMoot}` : s.cardBody}>
        <header className={s.cardTop}>
          <KindChip kind={d.kind} />
          {p.showProject && (
            <span className={s.cardProject}>
              <ProjectTile id={d.project} size={16} />
              {PROJECTS[d.project].short}
            </span>
          )}
          <span className={s.since}>{d.since}</span>
        </header>
        <h2 id={`q-${d.id}`} className={s.question}>
          {d.question}
        </h2>
        <div className={s.contextWrap}>
          <p id={`ctx-${d.id}`} className={long && !more ? `${s.context} ${s.contextClamped}` : s.context}>
            {d.context}
          </p>
          {long && (
            <button
              type="button"
              className={s.moreBtn}
              aria-expanded={more}
              aria-controls={`ctx-${d.id}`}
              onClick={() => setMore((v) => !v)}
            >
              {more ? "Less" : "More"}
            </button>
          )}
        </div>
        <EvidenceBlock items={d.evidence} />

        <div className={s.choices} role="group" aria-label="Your options">
          {d.choices.map((c, i) => {
            const focused = p.focus === i;
            const v = verdictFor(d, c);
            const done = p.committing === i;
            return (
              <button
                key={c.id}
                id={`choice-${d.id}-${i}`}
                type="button"
                className={`${s.choice} ${focused ? s.choiceFocused : ""} ${done ? s.choiceCommitted : ""}`}
                aria-pressed={p.touch ? focused : undefined}
                aria-describedby={`h-${d.id}-${c.id}`}
                onMouseEnter={(e) => {
                  p.onFocus(i);
                  // Keep keyboard focus and the previewed choice on the same card.
                  const a = document.activeElement;
                  if (a instanceof HTMLElement && a !== e.currentTarget && a.id.startsWith(`choice-${d.id}-`)) {
                    e.currentTarget.focus({ preventScroll: true });
                  }
                }}
                onFocus={() => p.onFocus(i)}
                onClick={() => p.onChoose(i)}
                disabled={!!p.moot}
              >
                <span className={s.choiceKey} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={s.choiceText}>
                  <span className={s.choiceLabel}>{c.label}</span>
                  <span id={`h-${d.id}-${c.id}`} className={s.choiceHint}>
                    {c.hint}
                    <span className={s.srOnly}>. {v.chip}, {v.gap}.</span>
                  </span>
                </span>
                <span className={s.choiceVerdict} data-verdict={v.kind} aria-hidden="true">
                  <VerdictDot v={v} />
                  {v.gap}
                </span>
                <span className={s.choiceEnter} aria-hidden="true">
                  {done ? (
                    <span className={s.choiceEnterTick}>
                      <Check size={14} />
                    </span>
                  ) : (
                    <span className={s.choiceEnterText}>{p.touch ? "Tap again" : "Enter"}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {p.consequenceSlot}

        <div className={s.cardFoot}>
          <div className={s.deferWrap}>
            <button
              ref={deferBtn}
              type="button"
              className={`${s.ghostBtn} ${s.deferBtn}`}
              aria-haspopup="menu"
              aria-expanded={p.deferOpen}
              onClick={() => p.setDeferOpen(!p.deferOpen)}
              disabled={!!p.moot}
            >
              <Clock size={14} />
              Not now
              <kbd className={s.kbd}>D</kbd>
            </button>
            {p.deferOpen && (
              <>
                <button type="button" className={s.menuScrim} aria-label="Close" onClick={() => p.setDeferOpen(false)} />
                <motion.div
                  role="menu"
                  className={s.menu}
                  initial={{ opacity: 0, y: reduce ? 0 : -4, scale: reduce ? 1 : 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: reduce ? 0 : 0.14 }}
                  onKeyDown={(e) => {
                    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
                    const i = items.indexOf(document.activeElement as HTMLButtonElement);
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      items[(i + 1) % items.length]?.focus();
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      items[(i - 1 + items.length) % items.length]?.focus();
                    } else if (e.key === "Escape") {
                      e.stopPropagation();
                      p.setDeferOpen(false);
                      deferBtn.current?.focus();
                    }
                  }}
                >
                  <p className={s.menuLabel}>Bring this back</p>
                  {d.defer.map((o, i) => (
                    <button
                      key={o.id}
                      role="menuitem"
                      type="button"
                      className={s.menuItem}
                      autoFocus={i === 0}
                      onClick={() => p.onDefer(i)}
                    >
                      <span>{o.label}</span>
                      <span className={s.menuDetail}>{o.detail}</span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </div>
          <ul className={s.legendKeys} aria-label="Keyboard">
            <li>
              <kbd className={s.kbd}>1</kbd>
              <span className={s.kbdDash}>–</span>
              <kbd className={s.kbd}>{d.choices.length}</kbd>
              choose
            </li>
            <li>
              <kbd className={s.kbd}>↑</kbd>
              <kbd className={s.kbd}>↓</kbd>
              compare
            </li>
            <li>
              <kbd className={s.kbd}>J</kbd>
              <kbd className={s.kbd}>K</kbd>
              skip
            </li>
            <li>
              <kbd className={s.kbd}>Z</kbd>
              undo
            </li>
          </ul>
        </div>
      </div>

      <SendPreview choice={d.choices[p.focus]} />

      {p.moot && (
        <motion.div
          className={s.moot}
          role="status"
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.24 }}
        >
          <span className={s.mootIcon}>
            <Check size={16} />
          </span>
          <div className={s.mootText}>
            <p className={s.mootTitle}>
              {PEOPLE[p.moot.by].name} sorted this at {p.moot.at}
            </p>
            <p className={s.mootSub}>{p.moot.text} Moving you on.</p>
            <span className={s.mootTrack} aria-hidden="true">
              <motion.span
                className={s.mootFill}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: reduce ? 0 : 2.8, ease: "linear" }}
              />
            </span>
          </div>
          <button type="button" className={s.secondaryBtn} onClick={p.onMootNext}>
            Next now
          </button>
        </motion.div>
      )}
    </article>
  );
}
