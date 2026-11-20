"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useDemoLinks, useSurfaceHref } from "../../demo/links";
import { answerFor, type Answer, type See } from "./ask-answers";
import { ChartView, Glyph, saysOf, type Link as MarkLink } from "./ask-charts";
import type { AskWorld, Part, ProjectData } from "./ask-data";
import { useWorld } from "./live";
import { MOST_ASKED, NEEDS, STARTERS, answers, isFilesQuestion, marked, projectIn, questionById, rank, textFor, verdict, type Match, type Question } from "./ask-questions";
import { nextKey, type AskEntry, type AskPin } from "./store";
import s from "./ask.module.css";

export type How = "card" | "chip" | "typed" | "pin" | "suggest" | "link";
export type Entry = AskEntry;
export type Pin = AskPin;

const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ── icons ──────────────────────────────────────────────────────────────── */

function Icon({ name }: { name: "ask" | "chevron" | "pin" | "pinned" | "copy" | "check" | "arrow" | "close" | "back" | "enter" | "wall" | "replay" }) {
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
    case "wall":
      return (
        <svg {...p}>
          <rect x="2" y="2.5" width="5" height="4.5" rx="1" />
          <rect x="9" y="2.5" width="5" height="4.5" rx="1" />
          <rect x="2" y="9" width="5" height="4.5" rx="1" />
          <rect x="9" y="9" width="5" height="4.5" rx="1" />
        </svg>
      );
    case "replay":
      return (
        <svg {...p}>
          <path d="M2.5 13.5h11" />
          <path d="M5 4.2v6.6l5.5-3.3z" />
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

function AllDots() {
  const { ask } = useWorld();
  return (
    <span className={s.allDots} aria-hidden>
      {ask.active.slice(0, 3).map((p) => (
        <Dot key={p.id} tone={p.tone} />
      ))}
    </span>
  );
}

/* ── Typed questions: one honest path from words to an answer ───────────── */

/** The questions an answer can be offered in place of a miss: closest first, only ones with something to say. */
function answerable(typed: string, p: ProjectData) {
  const can = (id: string) => answerFor(id, p).status === "ok";
  const near = rank(typed, p)
    .map((m) => m.q.id)
    .filter(can);
  const fallback = ["on-course", "late", "who-busy", "left", "coming-up", "done-week"].filter(can);
  return [...new Set([...near, ...fallback])].slice(0, 3);
}

/**
 * Turn typed words into a thread entry. A project the question names sets the
 * scope; what was written down goes to Files; a weak match says it is the
 * closest question; nothing close says so and offers what can be answered.
 */
export function resolveTyped(typed: string, scopeId: string, how: How, world: AskWorld, pick?: Match): AskEntry {
  const projectById = world.byId;
  const named = projectIn(typed, world.projects);
  const target = named && projectById(named.id).id === named.id ? named.id : scopeId;
  if (isFilesQuestion(typed)) return { key: nextKey(), kind: "files", typed, scope: target };
  const p = projectById(target);
  const m = pick ?? answers(typed, p)[0];
  if (!m) return { key: nextKey(), kind: "miss", typed, scope: target, offers: answerable(typed, p) };
  const exact = textFor(m.q, p).toLowerCase() === typed.toLowerCase();
  const fuzzy = !exact && verdict(m) !== "sure";
  const from = named && target !== scopeId ? `Answered for ${p.name}, the project your question names.` : undefined;
  return { key: nextKey(), kind: "answer", qid: m.q.id, scope: target, how, typed: exact ? undefined : typed, fuzzy, lift: how === "typed" ? `sugg-${m.q.id}` : undefined, from };
}

/* ── The question field ─────────────────────────────────────────────────── */

export function AskField({
  scope,
  onEntry,
  inputRef,
  compact,
}: {
  compact: boolean;
  scope: ProjectData;
  /** A typed question, resolved: an answer, a miss, or a hand-off to Files. */
  onEntry: (entry: AskEntry) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const world = useWorld().ask;
  const projectById = world.byId;
  const disabled = false;
  // A project named in the question is the one the suggestions answer for.
  const named = projectIn(value, world.projects);
  const target = named ? projectById(named.id) : scope;
  const files = isFilesQuestion(value);
  const matches = useMemo(() => (files ? [] : answers(value, target).slice(0, 5)), [value, target, files]);
  const open = focused && value.trim().length > 0 && !disabled;
  const top = matches[0];
  const judged = verdict(top);
  const idx = Math.min(active, Math.max(matches.length - 1, 0));
  const ghostQ = matches.find((m) => textFor(m.q, target).toLowerCase().startsWith(value.toLowerCase()));
  const ghost = value.length > 1 && ghostQ ? textFor(ghostQ.q, target).slice(value.length) : "";

  function submit(pick?: number) {
    const typed = value.trim();
    if (!typed) return;
    const m = pick === undefined ? matches[idx] : matches[pick];
    setValue("");
    setActive(0);
    onEntry(resolveTyped(typed, scope.id, "typed", world, m));
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
          placeholder={compact ? "Ask a question" : scope.status === "all" ? "What do you want to know across your projects?" : `What do you want to know about ${scope.short}?`}
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
          aria-label={`Ask a question about ${scope.status === "all" ? "all your projects" : scope.name}`}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {value.trim() && !disabled ? (
        <button type="button" className={s.enterKey} onMouseDown={(e) => e.preventDefault()} onClick={() => submit()} aria-label="Ask">
          <Icon name="enter" />
        </button>
      ) : (
        <kbd className={s.slashKey} title="Press / to ask from anywhere on the page">
          /
        </kbd>
      )}
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
              {files ? "That is about what is written in a file" : matches.length === 0 ? "No close question yet" : judged === "sure" ? "Questions I can answer" : "Closest questions I can answer"}
              <span className={s.suggestScope}>
                {target.status === "all" ? <AllDots /> : <Dot tone={target.tone} />} {target.short}
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
                    {marked(textFor(m.q, target), value).map((w, k) =>
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
              {files ? (
                <li className={s.suggestNone}>Press Enter to ask Files, which reads what was written: quotes, prices, versions and approvals.</li>
              ) : matches.length === 0 ? (
                <li className={s.suggestNone}>Press Enter and I will suggest a few questions I can answer.</li>
              ) : null}
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

/* ── One answer ─────────────────────────────────────────────────────────── */

function Sentence({ parts, link, says }: { parts: Part[]; link: MarkLink; says: Record<string, string> }) {
  const to = useDemoLinks();
  return (
    <>
      {parts.map((x, i) =>
        typeof x === "string" ? (
          <span key={i}>{x}</span>
        ) : x.task || x.project ? (
          <Link
            key={i}
            href={x.task ? to.task(x.task) : to.project(x.project!)}
            prefetch={false}
            className={`${s.b} ${s.bLink} ${x.marks.length ? s.bLinked : ""} ${link.hot && x.marks.some((m) => link.hot?.has(m)) ? s.bLit : ""}`}
            onMouseEnter={() => x.marks.length && link.point(x.marks, x.marks.length === 1 ? says[x.marks[0]] ?? "" : "")}
            onMouseLeave={link.leave}
            onFocus={() => x.marks.length && link.point(x.marks, x.marks.length === 1 ? says[x.marks[0]] ?? "" : "")}
            onBlur={link.leave}
          >
            {x.b}
          </Link>
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
  onSee,
  asked,
}: {
  entry: Extract<Entry, { kind: "answer" }>;
  newest: boolean;
  compact: boolean;
  pinned: boolean;
  onPin: () => void;
  onFollow: (qid: string, lift: string) => void;
  onSee: (see: See) => void;
  asked: Set<string>;
}) {
  const reduce = useReducedMotion();
  const to = useDemoLinks();
  const scope = useWorld().ask.byId(entry.scope);
  const q = questionById(entry.qid);
  const a: Answer = useMemo(() => answerFor(entry.qid, scope), [entry.qid, scope]);
  const says = useMemo(() => (a.chart ? saysOf(a.chart) : {}), [a]);
  const [hover, setHover] = useState<{ ids: string[]; say: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const link: MarkLink = {
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
          You asked “{entry.typed}”. This is the nearest question I can answer:
        </p>
      )}
      {entry.from && <p className={s.closest}>{entry.from}</p>}
      <header className={s.answerHead}>
        <motion.h2 layoutId={lift} className={s.answerQ} transition={{ duration: 0.45, ease: EASE }}>
          {textFor(q, scope)}
        </motion.h2>
        <div className={s.answerMeta}>
          {scope.status === "all" ? (
            <span className={s.scopePill}>
              <AllDots />
              {scope.short}
            </span>
          ) : (
            <Link className={`${s.scopePill} ${s.scopePillLink}`} href={to.project(scope.id)} prefetch={false} title={`Open ${scope.name}`}>
              <Dot tone={scope.tone} />
              {scope.short}
            </Link>
          )}
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

      {(a.act || a.see) && (
        <motion.div
          className={s.act}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: lift ? 0.32 : 0.1 }}
        >
          {a.act && <ActButton act={a.act} />}
          {a.see && (
            <button type="button" className={s.seeButton} onClick={() => onSee(a.see!)}>
              <Icon name={a.see.lens === "replay" ? "replay" : "wall"} />
              {a.see.label}
            </button>
          )}
        </motion.div>
      )}

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
      ) : a.see ? null : (
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
                {a.why.rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`${link.hot && r.marks?.some((m) => link.hot?.has(m)) ? s.whyLit : ""}`}
                    onMouseEnter={() => r.marks?.length && link.point(r.marks, r.marks.length === 1 ? says[r.marks[0]] ?? "" : "")}
                    onMouseLeave={link.leave}
                  >
                    <th scope="row">
                      {r.task || r.project ? (
                        <Link className={`${s.whyLabel} ${s.whyLink}`} href={r.task ? to.task(r.task) : to.project(r.project!)} prefetch={false}>
                          {r.label}
                        </Link>
                      ) : (
                        <span className={s.whyLabel}>{r.label}</span>
                      )}
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

function ActButton({ act }: { act: NonNullable<Answer["act"]> }) {
  const [done, setDone] = useState(false);
  const href = useSurfaceHref();
  if (act.to)
    return (
      <Link className={s.actButton} href={href(act.to)} prefetch={false}>
        {act.label}
        <Icon name="arrow" />
      </Link>
    );
  return (
    <span className={s.actWrap} aria-live="polite">
      {done ? (
        <>
          <span className={s.actDone}>
            <Icon name="check" />
            {act.done}
          </span>
          <button type="button" className={s.actUndo} onClick={() => setDone(false)}>
            Undo
          </button>
        </>
      ) : (
        <button type="button" className={s.actButton} onClick={() => setDone(true)}>
          {act.label}
          <Icon name="arrow" />
        </button>
      )}
    </span>
  );
}

export function MissBlock({ entry, onAsk }: { entry: Extract<Entry, { kind: "miss" }>; onAsk: (qid: string) => void }) {
  const scope = useWorld().ask.byId(entry.scope);
  const to = useDemoLinks();
  return (
    <article className={`${s.answer} ${s.miss}`} aria-label="A question I can’t answer yet">
      <p className={s.closest}>You asked “{entry.typed}”.</p>
      <p className={`${s.sentence} ${s.sentenceThin}`}>I can’t answer that yet.</p>
      <p className={s.missNote}>
        Analytics answers how the work is going. If this is about what someone wrote or quoted, Files can look.
        {entry.offers.length ? ` Questions I can answer about ${scope.status === "all" ? "your projects" : scope.short}:` : ""}
      </p>
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
        <Link className={s.missFiles} href={to.surface("files", undefined, { q: entry.typed })} prefetch={false}>
          Ask Files
          <Icon name="arrow" />
        </Link>
      </div>
    </article>
  );
}

/** A question about what was written: Files answers it, with the words already typed. */
export function FilesBlock({ entry }: { entry: Extract<Entry, { kind: "files" }> }) {
  const to = useDemoLinks();
  return (
    <article className={`${s.answer} ${s.miss}`} aria-label="A question for Files">
      <p className={s.closest}>You asked “{entry.typed}”.</p>
      <p className={`${s.sentence} ${s.sentenceThin}`}>That is about what is written in a file.</p>
      <p className={s.missNote}>Files reads quotes, prices, versions and who said or approved what. Analytics answers how the work is going.</p>
      <div className={s.act}>
        <Link className={s.actButton} href={to.surface("files", undefined, { q: entry.typed })} prefetch={false}>
          Ask Files
          <Icon name="arrow" />
        </Link>
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
  const scope = useWorld().ask.byId(pin.scope);
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
            {scope.status === "all" ? <AllDots /> : <Dot tone={scope.tone} />}
            {scope.short}
          </span>
          <Glyph kind={q.kind} />
        </span>
        <span className={s.pinQ}>{textFor(q, scope)}</span>
        <span className={s.pinA}>{a.plain}</span>
        <span className={s.pinFoot}>{pin.on}</span>
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
