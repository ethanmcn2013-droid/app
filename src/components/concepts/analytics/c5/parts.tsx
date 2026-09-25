"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import { answerFor, PROMISES, type Answer } from "./answers";
import { ChartView, Glyph, saysOf, type Link } from "./charts";
import { ALL, PROJECTS, projectById, type Part, type ProjectData } from "./data";
import { MOST_ASKED, NEEDS, STARTERS, marked, questionById, rank, textFor, verdict, type Question } from "./questions";
import s from "./c5.module.css";

export type How = "card" | "chip" | "typed" | "pin" | "suggest";
export type Entry =
  | { key: string; kind: "answer"; qid: string; scope: string; how: How; typed?: string; fuzzy?: boolean; lift?: string }
  | { key: string; kind: "miss"; typed: string; scope: string; offers: string[] };
export type Pin = { key: string; qid: string; scope: string; on: string; then?: string };

const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ── icons ──────────────────────────────────────────────────────────────── */

function Icon({ name }: { name: "ask" | "chevron" | "pin" | "pinned" | "copy" | "check" | "arrow" | "close" | "back" | "enter" }) {
  const p = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "ask":
      return (
        <svg {...p} width={20} height={20} viewBox="0 0 20 20">
          <circle cx="9" cy="9" r="6" />
          <path d="M13.5 13.5 17 17" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...p} width={12} height={12} viewBox="0 0 12 12">
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      );
    case "pin":
      return (
        <svg {...p}>
          <path d="M6 2.5h4l-.5 4 2 2v1h-7v-1l2-2z" />
          <path d="M8 9.5V14" />
        </svg>
      );
    case "pinned":
      return (
        <svg {...p} fill="currentColor">
          <path d="M6 2.5h4l-.5 4 2 2v1h-7v-1l2-2z" />
          <path d="M8 9.5V14" fill="none" />
        </svg>
      );
    case "copy":
      return (
        <svg {...p}>
          <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
          <path d="M3 10.5V3.5A1 1 0 0 1 4 2.5h6.5" />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...p}>
          <path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" />
        </svg>
      );
    case "close":
      return (
        <svg {...p} width={12} height={12} viewBox="0 0 12 12">
          <path d="m3 3 6 6M9 3l-6 6" />
        </svg>
      );
    case "back":
      return (
        <svg {...p}>
          <path d="M13 8H3.5M7 4.5 3.5 8 7 11.5" />
        </svg>
      );
    case "enter":
      return (
        <svg {...p} width={14} height={14} viewBox="0 0 16 16">
          <path d="M13 3.5v5a1.5 1.5 0 0 1-1.5 1.5H4M7 7 4 10l3 3" />
        </svg>
      );
  }
}

function Dot({ tone }: { tone: string }) {
  return <span className={s.dot} style={{ background: tone }} aria-hidden />;
}

/* ── The question field, with the Project as a chip inside it ──────────── */

export function AskField({
  scope,
  onScope,
  onAsk,
  onMiss,
  inputRef,
  compact,
}: {
  compact: boolean;
  scope: ProjectData;
  onScope: (id: string) => void;
  onAsk: (qid: string, how: How, typed?: string, fuzzy?: boolean, lift?: string) => void;
  onMiss: (typed: string, offers: string[]) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const disabled = scope.status === "empty";
  const matches = useMemo(() => rank(value, scope).filter((m) => m.score >= 2).slice(0, 5), [value, scope]);
  const open = focused && value.trim().length > 0 && !disabled;
  const top = matches[0];
  const judged = verdict(top);
  const idx = Math.min(active, Math.max(matches.length - 1, 0));
  const ghostQ = matches.find((m) => textFor(m.q, scope).toLowerCase().startsWith(value.toLowerCase()));
  const ghost = value.length > 1 && ghostQ ? textFor(ghostQ.q, scope).slice(value.length) : "";

  function submit(pick?: number) {
    const typed = value.trim();
    if (!typed) return;
    const m = pick === undefined ? matches[idx] : matches[pick];
    setValue("");
    setActive(0);
    if (!m) {
      const offers = rank(typed, scope)
        .slice(0, 3)
        .map((x) => x.q.id);
      onMiss(typed, offers.length === 3 ? offers : ["on-course", "late", "who-busy"]);
      return;
    }
    const exact = textFor(m.q, scope).toLowerCase() === typed.toLowerCase();
    const fuzzy = !exact && (verdict(m) !== "sure" || (pick === undefined && idx === 0 && judged === "closest"));
    onAsk(m.q.id, "typed", exact ? undefined : typed, fuzzy, `sugg-${m.q.id}`);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Tab" && ghost && !e.shiftKey) {
      e.preventDefault();
      setValue(value + ghost);
    } else if (e.key === "Escape") {
      if (value) setValue("");
      else inputRef.current?.blur();
    }
  }

  return (
    <div className={`${s.field} ${open ? s.fieldOpen : ""} ${disabled ? s.fieldDisabled : ""}`}>
      <span className={s.fieldIcon}>
        <Icon name="ask" />
      </span>
      <div className={s.inputWrap}>
        <div className={s.ghost} aria-hidden>
          <span className={s.ghostTyped}>{value}</span>
          {open && ghost && <span className={s.ghostRest}>{ghost}</span>}
        </div>
        <input
          ref={inputRef}
          className={s.input}
          value={value}
          disabled={disabled}
          placeholder={disabled ? (compact ? "Add a few tasks first" : `Add a few tasks to ${scope.name} first`) : compact ? "Ask a question" : "What do you want to know?"}
          onChange={(e) => {
            setValue(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[idx] ? `${listId}-${idx}` : undefined}
          aria-label="Ask a question about your work"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {value.trim() && !disabled ? (
        <button type="button" className={s.enterKey} onMouseDown={(e) => e.preventDefault()} onClick={() => submit()} aria-label="Ask">
          <Icon name="enter" />
        </button>
      ) : (
        <kbd className={s.slashKey} aria-hidden>
          /
        </kbd>
      )}
      <ScopeChip scope={scope} onScope={onScope} />
      <AnimatePresence>
        {open && (
          <motion.div
            className={s.suggest}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            <div className={s.suggestHead}>
              {matches.length === 0 ? "No close question yet" : judged === "sure" ? "Questions I can answer" : "Closest questions I can answer"}
              <span className={s.suggestScope}>
                <Dot tone={scope.tone} /> {scope.name}
              </span>
            </div>
            <ul id={listId} role="listbox" className={s.suggestList}>
              {matches.map((m, i) => (
                <li
                  key={m.q.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === idx}
                  className={`${s.suggestItem} ${i === idx ? s.suggestActive : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => submit(i)}
                >
                  <Glyph kind={m.q.kind} />
                  <motion.span layoutId={`sugg-${m.q.id}`} className={s.suggestText}>
                    {marked(textFor(m.q, scope), value).map((w, k) =>
                      w.on ? (
                        <mark key={k} className={s.hl}>
                          {w.piece}
                        </mark>
                      ) : (
                        <span key={k}>{w.piece}</span>
                      ),
                    )}
                  </motion.span>
                  {i === idx && <span className={s.suggestHint}>Enter</span>}
                </li>
              ))}
              {matches.length === 0 && <li className={s.suggestNone}>Press Enter and I will suggest a few questions I can answer.</li>}
            </ul>
            {ghost && (
              <div className={s.suggestFoot}>
                <kbd className={s.kbd}>Tab</kbd> completes the question
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScopeChip({ scope, onScope }: { scope: ProjectData; onScope: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);
  const options = [...PROJECTS, ALL];
  return (
    <div className={s.scope} ref={wrap}>
      <button type="button" className={s.scopeButton} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)}>
        <span className={s.scopeIn}>in</span>
        {scope.status !== "all" && <Dot tone={scope.tone} />}
        <span className={s.scopeName}>{scope.name}</span>
        <Icon name="chevron" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            className={s.scopeMenu}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: EASE }}
          >
            <div className={s.scopeMenuHead}>Ask about</div>
            {options.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={p.id === scope.id}
                className={`${s.scopeItem} ${p.id === scope.id ? s.scopeItemOn : ""}`}
                onClick={() => {
                  onScope(p.id);
                  setOpen(false);
                }}
              >
                {p.status === "all" ? <span className={s.allDots} aria-hidden><Dot tone="var(--v3-project-3)" /><Dot tone="var(--v3-project-5)" /><Dot tone="var(--v3-project-2)" /></span> : <Dot tone={p.tone} />}
                <span className={s.scopeItemText}>
                  <span className={s.scopeItemName}>{p.name}</span>
                  <span className={s.scopeItemKind}>{p.status === "empty" ? "No tasks yet" : p.status === "all" ? "Compare your Projects" : p.kind}</span>
                </span>
                {p.id === scope.id && <Icon name="check" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Starter questions ──────────────────────────────────────────────────── */

export function Starters({ scope, onAsk, lift }: { scope: ProjectData; onAsk: (qid: string, how: How, typed?: string, fuzzy?: boolean, lift?: string) => void; lift: boolean }) {
  return (
    <div className={s.starters}>
      {NEEDS.map((need, gi) => (
        <section key={need} className={s.need} aria-label={need}>
          <h2 className={s.needTitle}>{need}</h2>
          {STARTERS.filter((q) => q.need === need).map((q, i) => (
            <motion.button
              key={q.id}
              type="button"
              className={s.card}
              onClick={() => onAsk(q.id, "card", undefined, false, `card-${q.id}`)}
              initial={lift ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: EASE, delay: 0.04 * (gi * 2 + i) }}
            >
              <span className={s.cardTop}>
                <Glyph kind={q.kind} />
                {q.id === MOST_ASKED && <span className={s.most}>Most asked</span>}
              </span>
              <motion.span layoutId={lift ? `card-${q.id}` : undefined} className={s.cardQ}>
                {textFor(q, scope)}
              </motion.span>
              <span className={s.cardHint}>{q.hint}</span>
            </motion.button>
          ))}
        </section>
      ))}
    </div>
  );
}

export function EmptyProject({ scope }: { scope: ProjectData }) {
  return (
    <div className={s.empty}>
      <div className={s.emptyHead}>
        <p className={s.emptyTitle}>Ask me something once there are a few tasks. Here is what I will be able to tell you.</p>
        <a className={s.emptyAction} href={PRODUCT_APP_PATHS.tasks}>
          Add tasks to {scope.name}
          <Icon name="arrow" />
        </a>
      </div>
      <div className={s.starters}>
        {NEEDS.map((need) => (
          <section key={need} className={s.need} aria-label={need}>
            <h2 className={s.needTitle}>{need}</h2>
            {STARTERS.filter((q) => q.need === need).map((q) => (
              <div key={q.id} className={`${s.card} ${s.cardOff}`} aria-disabled>
                <span className={s.cardTop}>
                  <Glyph kind={q.kind} muted />
                </span>
                <span className={s.cardQ}>{textFor(q, scope)}</span>
                <span className={s.cardHint}>{PROMISES[q.id]}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ── One answer ─────────────────────────────────────────────────────────── */

function Sentence({ parts, link, says }: { parts: Part[]; link: Link; says: Record<string, string> }) {
  return (
    <>
      {parts.map((x, i) =>
        typeof x === "string" ? (
          <span key={i}>{x}</span>
        ) : (
          <span
            key={i}
            className={`${s.b} ${x.marks.length ? s.bLinked : ""} ${link.hot && x.marks.some((m) => link.hot?.has(m)) ? s.bLit : ""}`}
            tabIndex={x.marks.length ? 0 : undefined}
            onMouseEnter={() => x.marks.length && link.point(x.marks, x.marks.length === 1 ? says[x.marks[0]] ?? "" : "")}
            onMouseLeave={link.leave}
            onFocus={() => x.marks.length && link.point(x.marks, x.marks.length === 1 ? says[x.marks[0]] ?? "" : "")}
            onBlur={link.leave}
          >
            {x.b}
          </span>
        ),
      )}
    </>
  );
}

export function AnswerBlock({
  entry,
  newest,
  compact,
  pinned,
  onPin,
  onFollow,
  asked,
}: {
  entry: Extract<Entry, { kind: "answer" }>;
  newest: boolean;
  compact: boolean;
  pinned: boolean;
  onPin: () => void;
  onFollow: (qid: string, lift: string) => void;
  asked: Set<string>;
}) {
  const reduce = useReducedMotion();
  const scope = projectById(entry.scope);
  const q = questionById(entry.qid);
  const a: Answer = useMemo(() => answerFor(entry.qid, scope), [entry.qid, scope]);
  const says = useMemo(() => (a.chart ? saysOf(a.chart) : {}), [a]);
  const [hover, setHover] = useState<{ ids: string[]; say: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const link: Link = {
    hot: hover ? new Set(hover.ids) : null,
    point: (ids, say) => setHover({ ids, say }),
    leave: () => setHover(null),
  };
  const lift = newest && !reduce ? entry.lift : undefined;

  function copy() {
    const text = `${scope.name}: ${a.plain}`;
    try {
      void navigator.clipboard?.writeText(text).catch(() => undefined);
    } catch {
      /* clipboard can be blocked; the button still confirms the intent */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const readout = hover?.say || a.note;

  return (
    <article className={s.answer} aria-label={textFor(q, scope)}>
      {entry.fuzzy && entry.typed && (
        <p className={s.closest}>
          You asked “{entry.typed}”. Closest question I can answer:
        </p>
      )}
      <header className={s.answerHead}>
        <motion.h2 layoutId={lift} className={s.answerQ} transition={{ duration: 0.45, ease: EASE }}>
          {textFor(q, scope)}
        </motion.h2>
        <div className={s.answerMeta}>
          <span className={s.scopePill}>
            {scope.status === "all" ? (
              <span className={s.allDots} aria-hidden>
                <Dot tone="var(--v3-project-3)" />
                <Dot tone="var(--v3-project-5)" />
                <Dot tone="var(--v3-project-2)" />
              </span>
            ) : (
              <Dot tone={scope.tone} />
            )}
            {scope.name}
          </span>
          {a.status === "ok" && (
            <>
              <button type="button" className={`${s.tool} ${pinned ? s.toolOn : ""}`} onClick={onPin} aria-pressed={pinned}>
                <Icon name={pinned ? "pinned" : "pin"} />
                {pinned ? "Pinned" : "Pin"}
              </button>
              <button type="button" className={s.tool} onClick={copy}>
                <Icon name={copied ? "check" : "copy"} />
                <span aria-live="polite">{copied ? "Copied" : "Copy as sentence"}</span>
              </button>
            </>
          )}
        </div>
      </header>

      <motion.p
        className={`${s.sentence} ${a.status === "thin" ? s.sentenceThin : ""}`}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: lift ? 0.25 : 0.05 }}
      >
        <Sentence parts={a.sentence} link={link} says={says} />
      </motion.p>

      {a.chart ? (
        <motion.figure
          className={s.figure}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: lift ? 0.35 : 0.12 }}
        >
          <ChartView chart={a.chart} link={link} compact={compact} />
          <figcaption className={`${s.readout} ${hover?.say ? s.readoutOn : ""}`} aria-live="polite">
            {readout}
          </figcaption>
        </motion.figure>
      ) : (
        <div className={s.thinFigure}>
          <Glyph kind={q.kind} muted />
          <span>The chart appears here once there is enough to show.</span>
        </div>
      )}

      <motion.div
        className={s.after}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: lift ? 0.5 : 0.25 }}
      >
        {a.why && (
          <section className={s.why} aria-label="Why I think this">
            <h3 className={s.afterTitle}>Why I think this</h3>
            <table className={s.whyTable}>
              {a.why.head.some(Boolean) && (
                <thead>
                  <tr>
                    {a.why.head.map((h, i) => (
                      <th key={i} scope="col" className={i ? s.num : ""}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {a.why.rows.slice(0, 5).map((r) => (
                  <tr
                    key={r.id}
                    className={`${link.hot && r.marks?.some((m) => link.hot?.has(m)) ? s.whyLit : ""}`}
                    onMouseEnter={() => r.marks?.length && link.point(r.marks, r.marks.length === 1 ? says[r.marks[0]] ?? "" : "")}
                    onMouseLeave={link.leave}
                  >
                    <th scope="row">
                      <span className={s.whyLabel}>{r.label}</span>
                      {r.sub && <span className={s.whySub}>{r.sub}</span>}
                    </th>
                    {r.cells.map((c, i) => (
                      <td key={i} className={s.num}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {a.why.foot && <p className={s.whyFoot}>{a.why.foot}</p>}
          </section>
        )}
        <section className={s.next} aria-label="Ask next">
          <h3 className={s.afterTitle}>{a.status === "thin" ? "I can tell you this instead" : "Ask next"}</h3>
          <div className={s.chips}>
            {a.follow.map((fid) => {
              const fq = questionById(fid);
              const done = asked.has(fid);
              return (
                <button key={fid} type="button" className={`${s.chip} ${done ? s.chipDone : ""}`} onClick={() => onFollow(fid, `chip-${entry.key}-${fid}`)}>
                  <Glyph kind={fq.kind} />
                  <span className={s.chipText}>{textFor(fq, scope)}</span>
                  <span className={s.chipArrow}>
                    <Icon name="arrow" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </motion.div>
    </article>
  );
}

export function MissBlock({ entry, onAsk }: { entry: Extract<Entry, { kind: "miss" }>; onAsk: (qid: string) => void }) {
  const scope = projectById(entry.scope);
  return (
    <article className={`${s.answer} ${s.miss}`} aria-label="A question I cannot answer yet">
      <p className={s.closest}>You asked “{entry.typed}”.</p>
      <p className={`${s.sentence} ${s.sentenceThin}`}>I cannot answer that yet. Try one of these.</p>
      <div className={`${s.chips} ${s.chipsRow}`}>
        {entry.offers.map((id) => {
          const q = questionById(id);
          return (
            <button key={id} type="button" className={s.chip} onClick={() => onAsk(id)}>
              <Glyph kind={q.kind} />
              <span className={s.chipText}>{textFor(q, scope)}</span>
              <span className={s.chipArrow}>
                <Icon name="arrow" />
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

/* ── Your answers: pinned, and kept current ─────────────────────────────── */

export function Pins({ pins, onOpen, onRemove }: { pins: Pin[]; onOpen: (p: Pin) => void; onRemove: (key: string) => void }) {
  return (
    <section className={s.pins} aria-labelledby="c5-pins">
      <div className={s.pinsHead}>
        <h2 id="c5-pins" className={s.pinsTitle}>
          Your answers
        </h2>
        <p className={s.pinsSub}>Pin an answer to keep it here. Each one stays current as the work changes.</p>
      </div>
      {pins.length === 0 ? (
        <p className={s.pinsEmpty}>Nothing pinned yet. Use Pin on any answer.</p>
      ) : (
        <div className={s.pinRow}>
          <AnimatePresence initial={false}>
            {pins.map((p) => (
              <PinCard key={p.key} pin={p} onOpen={() => onOpen(p)} onRemove={() => onRemove(p.key)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function PinCard({ pin, onOpen, onRemove }: { pin: Pin; onOpen: () => void; onRemove: () => void }) {
  const scope = projectById(pin.scope);
  const q = questionById(pin.qid);
  const a = useMemo(() => answerFor(pin.qid, scope), [pin.qid, scope]);
  return (
    <motion.div
      layout
      className={s.pin}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <button type="button" className={s.pinOpen} onClick={onOpen}>
        <span className={s.pinTop}>
          <span className={s.pinScope}>
            <Dot tone={scope.status === "all" ? "var(--v3-text-3)" : scope.tone} />
            {scope.name}
          </span>
          <Glyph kind={q.kind} />
        </span>
        <span className={s.pinQ}>{textFor(q, scope)}</span>
        <span className={s.pinA}>{a.plain}</span>
        <span className={s.pinFoot}>
          {pin.on}
          {pin.then && <span className={s.pinThen}>{pin.then}</span>}
        </span>
      </button>
      <button type="button" className={s.pinRemove} onClick={onRemove} aria-label={`Unpin “${textFor(q, scope)}”`}>
        <Icon name="close" />
      </button>
    </motion.div>
  );
}

export function Back({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={s.back} onClick={onClick}>
      <Icon name="back" />
      {children}
    </button>
  );
}

export type { Question };
export const styleVar = (v: Record<string, string | number>) => v as CSSProperties;
