"use client";

/* Ask for a tool: say what you need, and the tool assembles itself from your Project. */

import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ALREADY_ON, GUEST_COUNTS, projectById, toolById, type ProjectId, type ToolId } from "./data";
import { completion, interpret, type Result } from "./match";
import { Countdown, Timer } from "./micro";
import { Check, Pin, Undo } from "./glyphs";
import { ChecklistDatePreview, Preview, provenance, type Provenance } from "./previews";
import { AlreadyOn, AtoZ, KeyBar, NeedField, ProjectDot, RailCard, SuggestionPhrases, ToolTile, WhereItCameFrom, type OnRow } from "./parts";
import s from "./c4.module.css";

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");
const EASE = [0.2, 0.8, 0.2, 1] as const;

/** How each tool reads when it is offered as another way to meet the same need. */
const ALT_LINE: Partial<Record<ToolId, string>> = {
  guests: "Everyone in one list, with their reply",
  rsvp: "Guests answer themselves",
  seating: "Once replies are in",
  runsheet: "The same day, for suppliers",
  countdown: "Days to go, with milestones",
  receipts: "Snap it, and it adds up",
  deposits: "Money you are still owed",
  checklist: "Tick through what is left",
  social: "Posts for the run-up",
  deadlines: "The next hand-in, counted down",
  studytimer: "Focus in twenty-five minutes",
  forward: "Forward an email, get a task",
  whatsapp: "One group, next to the work",
  gifts: "Who gave what, and thank-yous",
  forms: "Ask anything, collect answers",
  payments: "Take a deposit by card",
  budget: "What is planned and spent",
  notes: "Write it down for later",
  weather: "The forecast for the day",
  rota: "Who is working when",
};

type Keep = { key: string; tool: ToolId; project: ProjectId; label?: string };

export default function Concept() {
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const typing = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [text, setText] = useState("");
  const [project, setProject] = useState<ProjectId>("mf");
  const [pinnedProject, setPinnedProject] = useState(false);
  const [sel, setSel] = useState({ key: "", i: 0 });
  const [more, setMore] = useState<string | null>(null);
  const [kept, setKept] = useState<Keep[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [refine, setRefine] = useState({ meal: false, plus: false });
  const [feedback, setFeedback] = useState<"closed" | "open" | "sent">("closed");
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);

  const need = useDeferredValue(text);
  const result: Result = useMemo(() => interpret(need, project), [need, project]);

  // Where the answer lands: a need can carry its own Project (the essay lives on Riverside survey).
  const home =
    !pinnedProject && result.kind === "answers" && result.home
      ? result.home
      : !pinnedProject && result.kind === "micro" && result.micro.kind === "countdown" && result.micro.project
        ? result.micro.project
        : project;

  const ids: ToolId[] = useMemo(() => {
    if (result.kind === "answers") return [result.lead, ...result.alts, ...(more === result.intent ? result.more : [])];
    if (result.kind === "already") return [result.tool, ...result.alts, ...(more === result.intent ? result.more : [])];
    if (result.kind === "none") return ["checklist", "forms", "notes"];
    return [];
  }, [result, more]);

  const resultKey = `${result.kind}:${ids.join(",")}:${home}`;
  const selIdx = sel.key === resultKey ? Math.min(sel.i, Math.max(0, ids.length - 1)) : 0;
  const current = ids[selIdx];
  const keptKey = (tool: ToolId, p: ProjectId) => `${tool}:${p}`;
  const isKept = (tool: ToolId) => kept.some((k) => k.key === keptKey(tool, home));

  const microKey = result.kind === "micro" ? (result.micro.kind === "timer" ? `timer:${result.micro.label}:${home}` : `cd:${result.micro.iso}:${home}`) : "";
  const microPinned = kept.some((k) => k.key === microKey);

  /* ── actions ────────────────────────────────────────────────────── */

  const say = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(
    () => () => {
      if (typing.current) clearInterval(typing.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // "/" puts you back in the field from anywhere on the page.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== "/" || el.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const stopTyping = () => {
    if (typing.current) clearInterval(typing.current);
    typing.current = null;
  };

  const resetExtras = () => {
    setMore(null);
    setFeedback("closed");
    setRefine({ meal: false, plus: false });
  };

  const typeIn = (phrase: string, p?: ProjectId) => {
    stopTyping();
    resetExtras();
    if (p) {
      setProject(p);
      setPinnedProject(false);
    }
    inputRef.current?.focus({ preventScroll: true });
    if (reduced) {
      setText(phrase);
      return;
    }
    let i = 0;
    setText("");
    typing.current = setInterval(() => {
      i += 1;
      setText(phrase.slice(0, i));
      if (i >= phrase.length) stopTyping();
    }, 26);
  };

  const onChange = (v: string) => {
    stopTyping();
    setText(v);
    if (!v) resetExtras();
  };

  const clear = () => {
    stopTyping();
    setText("");
    resetExtras();
    inputRef.current?.focus();
  };

  const move = (d: number) => {
    if (ids.length < 2) return;
    setSel({ key: resultKey, i: (selIdx + d + ids.length) % ids.length });
  };

  const keep = (tool: ToolId, label?: string, key = keptKey(tool, home)) => {
    if (kept.some((k) => k.key === key)) return;
    setKept((k) => [{ key, tool, project: home, label }, ...k]);
    setFresh(key);
    say(`${label ?? toolById(tool).name} is on for ${projectById(home).short}`);
  };
  const undo = (key: string) => {
    setKept((k) => k.filter((x) => x.key !== key));
    say("Undone. Nothing was kept.");
  };

  const open = (label: string, p: ProjectId | "all") => say(`Opening ${label}${p === "all" ? "" : ` on ${projectById(p).short}`}`);

  const enter = () => {
    if (result.kind === "micro") {
      if (!microPinned) pinMicro();
      return;
    }
    if (result.kind === "already" && selIdx === 0) {
      open(toolById(result.tool).name, home);
      return;
    }
    if ((result.kind === "answers" || result.kind === "none" || result.kind === "already") && current) {
      if (isKept(current)) open(toolById(current).name, home);
      else keep(current, result.kind === "none" && current === "checklist" ? result.item : undefined);
    }
  };

  const pinMicro = () => {
    if (result.kind !== "micro") return;
    const m = result.micro;
    const label = m.kind === "timer" ? m.label : `Countdown to ${m.label.replace(/^\w+ /, "")}`;
    keep(m.kind === "timer" ? "studytimer" : "countdown", label, microKey);
  };

  const ghost = completion(text);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (ghost && result.kind === "short") typeIn(text + ghost);
      else enter();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (text) clear();
      else inputRef.current?.blur();
    } else if (e.key === "Tab" && ghost && !e.shiftKey) {
      e.preventDefault();
      onChange(text + ghost);
    }
  };

  const pickTool = (t: ToolId) => {
    document.getElementById("c4-top")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    typeIn(toolById(t).name);
  };

  const onRows: OnRow[] = [
    ...kept.map((k) => ({ key: k.key, tool: k.tool, project: k.project as ProjectId | "all", used: "Just now", label: k.label })),
    ...ALREADY_ON.map((o) => ({ ...o, key: `${o.tool}:${o.project}` })).filter((o) => !kept.some((k) => k.key === o.key)),
  ];

  /* ── what to show ───────────────────────────────────────────────── */

  const idle = result.kind === "idle";
  const hasAnswer = !idle && result.kind !== "short";
  const enterLabel =
    result.kind === "micro"
      ? microPinned
        ? undefined
        : "Pin"
      : result.kind === "already" && selIdx === 0
        ? "Open"
        : current && (result.kind === "answers" || result.kind === "none" || result.kind === "already")
          ? isKept(current)
            ? "Open"
            : "Keep"
          : undefined;

  const status =
    result.kind === "answers" || result.kind === "already"
      ? `${ids.length} ways to do this, best first`
      : result.kind === "none"
        ? "Nothing exact yet. Here is the closest."
        : result.kind === "ask"
          ? "One question first"
          : result.kind === "micro"
            ? "Made on the spot"
            : "";

  // The phone's bottom bar carries the one main action.
  let dockAction: { label: string; run: () => void; done?: boolean } | null = null;
  if (result.kind === "micro") dockAction = microPinned ? { label: `Pinned to ${projectById(home).short}`, run: () => {}, done: true } : { label: `Pin to ${projectById(home).short}`, run: pinMicro };
  else if (result.kind === "already" && selIdx === 0) dockAction = { label: "Open it", run: () => open(toolById(result.tool).name, home) };
  else if (current && (result.kind === "answers" || result.kind === "none" || result.kind === "already"))
    dockAction = isKept(current)
      ? { label: `Open ${toolById(current).noun}`, run: () => open(toolById(current).name, home), done: true }
      : { label: `Keep this ${toolById(current).noun}`, run: () => keep(current, result.kind === "none" && current === "checklist" ? result.item : undefined) };

  return (
    <MotionConfig reducedMotion="user">
      <div className={cx(s.root, hasAnswer && s.rootActive)}>
        <div className={s.page} id="c4-top">
          <header className={s.hero}>
            <h1 className={s.h1}>What do you need?</h1>
            <p className={s.sub}>Say it in your own words. The tool puts itself together from what is already in your Project, so you can see it working before you keep it.</p>
          </header>

          <div className={s.dock}>
            {dockAction && (
              <div className={s.dockBar}>
                <button type="button" className={cx(s.primary, s.dockKeep, dockAction.done && s.primaryDone)} onClick={dockAction.run}>
                  {dockAction.done && <Check />}
                  {dockAction.label}
                </button>
              </div>
            )}
            <NeedField
              inputRef={inputRef}
              value={text}
              onChange={onChange}
              onKeyDown={onKeyDown}
              project={home}
              onProject={(p) => {
                setProject(p);
                setPinnedProject(true);
              }}
              ghost={ghost}
              onClear={clear}
            />
            {idle && <SuggestionPhrases onPick={typeIn} />}
            {result.kind === "short" && (
              <p className={s.nudge}>
                Keep going. Say what you want to do, like <button type="button" className={s.inlineLink} onClick={() => typeIn("plan the day hour by hour", "mf")}>plan the day hour by hour</button>.
              </p>
            )}
          </div>

          <div className={s.statusRow}>
            <p className={s.status} aria-live="polite">
              {hasAnswer ? status : ""}
            </p>
            {hasAnswer && (
              <KeyBar
                count={ids.length}
                onUp={() => move(-1)}
                onDown={() => move(1)}
                onEnter={enterLabel ? enter : undefined}
                enterLabel={enterLabel}
                onEsc={clear}
                tab={!!ghost}
                onTab={() => onChange(text + ghost)}
              />
            )}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {hasAnswer && (
              <motion.section
                key={result.kind === "micro" ? microKey : `${result.kind}:${home}:${ids[0] ?? ""}`}
                className={cx(s.results, (result.kind === "micro" || result.kind === "ask") && s.resultsSolo)}
                aria-label="Answers"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }}
                transition={{ duration: 0.34, ease: EASE }}
              >
                {result.kind === "ask" && (
                  <article className={cx(s.card, s.askCard)}>
                    <h2 className={s.askQ}>{result.question}</h2>
                    <p className={s.askSub}>
                      &lsquo;{text.trim()}&rsquo; could mean either. Pick one and the answer follows.
                    </p>
                    <div className={s.askOpts}>
                      {result.options.map((o) => (
                        <button key={o.label} type="button" className={s.askBtn} onClick={() => typeIn(o.need)}>
                          <span className={s.askLabel}>{o.label}</span>
                          <span className={s.askNeed}>{o.need}</span>
                        </button>
                      ))}
                    </div>
                  </article>
                )}

                {result.kind === "micro" && (
                  <article className={cx(s.card, s.microCard)}>
                    <div className={s.cardHead}>
                      <ToolTile tool={result.micro.kind === "timer" ? "studytimer" : "countdown"} size="l" />
                      <div className={s.cardTitles}>
                        <span className={s.badge}>Made on the spot</span>
                        <h2 className={s.cardTitle}>{result.micro.kind === "timer" ? result.micro.label : `Countdown to ${result.micro.label}`}</h2>
                      </div>
                    </div>
                    <div className={s.microBody}>{result.micro.kind === "timer" ? <Timer seconds={result.micro.seconds} label={result.micro.label} /> : <Countdown iso={result.micro.iso} />}</div>
                    <WhereItCameFrom p={{ line: result.micro.why }} />
                    <footer className={s.cardFoot}>
                      {microPinned ? (
                        <KeptNote
                          title={`Pinned to ${projectById(home).short}`}
                          line={`It sits at the top of ${projectById(home).short}, and under Already on.`}
                          onUndo={() => undo(microKey)}
                        />
                      ) : (
                        <>
                          <button type="button" className={cx(s.primary, s.cardKeep)} onClick={pinMicro}>
                            <Pin /> Pin to {projectById(home).short}
                          </button>
                          <span className={s.footNote}>It already works here. Pin it to keep it with the Project.</span>
                        </>
                      )}
                    </footer>
                  </article>
                )}

                {(result.kind === "answers" || result.kind === "already" || result.kind === "none") && current && (
                  <>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`${current}:${home}`}
                        className={s.leadWrap}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={{ duration: 0.28, ease: EASE }}
                      >
                        {result.kind === "already" && selIdx === 0 ? (
                          <AlreadyCard tool={result.tool} project={home} onOpen={() => open(toolById(result.tool).name, home)} onOther={() => move(1)} />
                        ) : (
                          <AnswerCard
                            tool={current}
                            project={home}
                            lead={selIdx === 0 && result.kind === "answers"}
                            none={result.kind === "none" && current === "checklist" ? result.item : undefined}
                            homeNote={result.kind === "answers" && result.home && home === result.home && !pinnedProject ? result.homeWhy : undefined}
                            onUseProject={() => {
                              setPinnedProject(true);
                            }}
                            chipProject={project}
                            refine={refine}
                            onRefine={(k) => setRefine((r) => ({ ...r, [k]: !r[k] }))}
                            kept={isKept(current)}
                            onKeep={() => keep(current, result.kind === "none" && current === "checklist" ? result.item : undefined)}
                            onUndo={() => undo(keptKey(current, home))}
                            onOpen={() => open(toolById(current).name, home)}
                            showMore={more !== (result.kind === "none" ? "none" : result.intent)}
                            onMore={() => {
                              const k = result.kind === "none" ? "none" : result.intent;
                              setMore(k);
                            }}
                            feedback={feedback}
                            onFeedback={setFeedback}
                            need={text}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>

                    <aside className={s.railCol} aria-label="Other ways">
                      <p className={s.railHead}>{result.kind === "none" ? "Close, not exact" : "Ways to do it"}</p>
                      <ul className={s.railList}>
                        {ids.map((id, i) => {
                          const moreStart = result.kind === "none" ? 99 : 1 + (result.kind === "answers" ? result.alts.length : result.alts.length);
                          return (
                            <motion.li
                              key={id}
                              layout="position"
                              initial={i >= moreStart ? { opacity: 0, y: 8 } : false}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.28, delay: i >= moreStart ? (i - moreStart) * 0.06 : 0, ease: EASE }}
                            >
                              {i === moreStart && <p className={s.railSub}>More ways</p>}
                              <RailCard
                                tool={id}
                                title={i === 0 && result.kind === "already" ? `Your ${toolById(id).name}` : i === 0 && result.kind === "none" ? "Checklist with a date" : toolById(id).name}
                                line={i === 0 && result.kind === "already" ? `Already on ${projectById(home).short}` : i === 0 && result.kind === "none" ? "The closest thing" : ALT_LINE[id] ?? toolById(id).line}
                                rank={i === 0 ? (result.kind === "already" ? "You have this" : result.kind === "none" ? "Closest" : "Best fit") : i < moreStart ? "Another way" : "Also"}
                                selected={i === selIdx}
                                kept={isKept(id)}
                                onSelect={() => setSel({ key: resultKey, i })}
                              />
                            </motion.li>
                          );
                        })}
                      </ul>
                      {more && (
                        <a className={s.railBrowse} href="#c4-browse">
                          Still not it? Browse everything, A to Z
                        </a>
                      )}
                    </aside>
                  </>
                )}
              </motion.section>
            )}
          </AnimatePresence>

          <div className={s.lower}>
            <AlreadyOn items={onRows} fresh={fresh} onOpen={(r) => open(r.label ?? toolById(r.tool).name, r.project)} />
            <AtoZ onPick={pickTool} />
          </div>
        </div>

        <div className={s.toastDock} aria-live="polite">
          <AnimatePresence>
            {toast && (
              <motion.p key={toast.id} className={s.toast} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2 }}>
                {toast.msg}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

/* ── the lead answer ─────────────────────────────────────────────── */

function AnswerCard({
  tool,
  project,
  lead,
  none,
  homeNote,
  onUseProject,
  chipProject,
  refine,
  onRefine,
  kept,
  onKeep,
  onUndo,
  onOpen,
  showMore,
  onMore,
  feedback,
  onFeedback,
  need,
}: {
  tool: ToolId;
  project: ProjectId;
  lead: boolean;
  none?: string;
  homeNote?: string;
  onUseProject: () => void;
  chipProject: ProjectId;
  refine: { meal: boolean; plus: boolean };
  onRefine: (k: "meal" | "plus") => void;
  kept: boolean;
  onKeep: () => void;
  onUndo: () => void;
  onOpen: () => void;
  showMore: boolean;
  onMore: () => void;
  feedback: "closed" | "open" | "sent";
  onFeedback: (f: "closed" | "open" | "sent") => void;
  need: string;
}) {
  const t = toolById(tool);
  const p = projectById(project);
  const title = none ? "Nothing does exactly that yet" : `${t.name} for ${p.short}`;
  const prov: Provenance = provenance(tool, project, none);
  const guestsLive = tool === "guests" && project === "mf";
  const line = prov.line + (guestsLive && refine.meal ? ` Meal choices for ${GUEST_COUNTS.meals} people came from the same note.` : "") + (guestsLive && refine.plus ? ` ${GUEST_COUNTS.plusOnes} plus-ones are marked with +1.` : "");

  return (
    <article className={cx(s.card, kept && s.cardKept)}>
      <div className={s.cardHead}>
        <ToolTile tool={tool} size="l" />
        <div className={s.cardTitles}>
          <span className={s.badge}>{kept ? "On" : none ? "Closest" : lead ? "Best fit" : "Another way"}</span>
          <h2 className={s.cardTitle}>{title}</h2>
          <p className={s.cardLine}>{none ? `The closest is a Checklist with a date. ${t.line}.` : `${t.line}.`}</p>
        </div>
      </div>

      {homeNote && (
        <p className={s.homeNote}>
          <ProjectDot id={project} /> Put on {p.short}, where {homeNote} is.
          <button type="button" className={s.inlineLink} onClick={onUseProject}>
            Use {projectById(chipProject).short} instead
          </button>
        </p>
      )}

      <div className={s.frame}>
        <div className={s.frameBar}>
          <span className={s.frameName}>
            {t.name} <span className={s.frameSep}>·</span> {p.short}
          </span>
          <span className={cx(s.frameState, kept && s.frameStateOn)}>{kept ? "On" : "Preview, nothing saved yet"}</span>
        </div>
        <div className={s.frameBody}>{none ? <ChecklistDatePreview item={none} project={project} /> : <Preview tool={tool} project={project} meal={refine.meal} plus={refine.plus} />}</div>
      </div>

      <WhereItCameFrom p={{ ...prov, line }} />

      {guestsLive && (
        <div className={s.refine} role="group" aria-label="Add to the guest list">
          <span className={s.refineLabel}>Add to it</span>
          <button type="button" className={s.refineChip} aria-pressed={refine.meal} onClick={() => onRefine("meal")}>
            {refine.meal && <Check size={12} />} Meal choices
          </button>
          <button type="button" className={s.refineChip} aria-pressed={refine.plus} onClick={() => onRefine("plus")}>
            {refine.plus && <Check size={12} />} Plus-ones
          </button>
        </div>
      )}

      <footer className={s.cardFoot}>
        {kept ? (
          <KeptNote
            title={`${t.name} is on for ${p.short}`}
            line={`Find it in the ${p.short} sidebar, and under Already on. Nothing has been sent to anyone.`}
            onOpen={onOpen}
            openLabel={`Open ${t.noun}`}
            onUndo={onUndo}
          />
        ) : (
          <>
            <button type="button" className={cx(s.primary, s.cardKeep)} onClick={onKeep}>
              Keep this {t.noun}
            </button>
            {none ? (
              feedback === "closed" ? (
                <button type="button" className={s.secondary} onClick={() => onFeedback("open")}>
                  Tell us what you meant
                </button>
              ) : null
            ) : (
              showMore && (
                <button type="button" className={s.secondary} onClick={onMore}>
                  Not quite. Show me more
                </button>
              )
            )}
            {!none && <span className={s.footNote}>Turn it off any time. Nothing goes to guests or suppliers until you say so.</span>}
          </>
        )}
      </footer>

      <AnimatePresence initial={false}>
        {none && feedback !== "closed" && (
          <motion.div className={s.feedback} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: EASE }}>
            {feedback === "open" ? (
              <FeedbackForm need={need} onSend={() => onFeedback("sent")} onCancel={() => onFeedback("closed")} />
            ) : (
              <p className={s.feedbackDone}>
                <Check /> Thanks. The people who build Signal Studio read every one of these, and this helps decide what comes next.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

function FeedbackForm({ need, onSend, onCancel }: { need: string; onSend: () => void; onCancel: () => void }) {
  return (
    <form
      className={s.fbForm}
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <label className={s.fbLabel} htmlFor="c4-fb">
        What would the right tool do?
      </label>
      <textarea id="c4-fb" className={s.fbText} rows={3} defaultValue={`I wanted ${need.trim()}. It would `} />
      <div className={s.fbRow}>
        <button type="submit" className={s.primary}>
          Send to the Signal Studio team
        </button>
        <button type="button" className={s.secondary} onClick={onCancel}>
          Not now
        </button>
      </div>
    </form>
  );
}

function AlreadyCard({ tool, project, onOpen, onOther }: { tool: ToolId; project: ProjectId; onOpen: () => void; onOther: () => void }) {
  const t = toolById(tool);
  const p = projectById(project);
  return (
    <article className={cx(s.card, s.alreadyCard)}>
      <div className={s.cardHead}>
        <ToolTile tool={tool} size="l" />
        <div className={s.cardTitles}>
          <span className={cx(s.badge, s.badgeOn)}>
            <Check size={12} /> You already have this
          </span>
          <h2 className={s.cardTitle}>
            {t.name} on {p.short}
          </h2>
          <p className={s.cardLine}>It is already on and up to date. Here is where it stands today.</p>
        </div>
      </div>
      <div className={s.frame}>
        <div className={s.frameBar}>
          <span className={s.frameName}>
            {t.name} <span className={s.frameSep}>·</span> {p.short}
          </span>
          <span className={cx(s.frameState, s.frameStateOn)}>On, used today</span>
        </div>
        <div className={s.frameBody}>
          <Preview tool={tool} project={project} meal={false} plus={false} />
        </div>
      </div>
      <footer className={s.cardFoot}>
        <button type="button" className={cx(s.primary, s.cardKeep)} onClick={onOpen}>
          Open it
        </button>
        <button type="button" className={s.secondary} onClick={onOther}>
          Show other ways
        </button>
      </footer>
    </article>
  );
}

function KeptNote({ title, line, onOpen, openLabel, onUndo }: { title: string; line: string; onOpen?: () => void; openLabel?: string; onUndo: () => void }): ReactNode {
  return (
    <div className={s.keptNote}>
      <span className={s.keptMark} aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22">
          <motion.path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: EASE, delay: 0.1 }} />
        </svg>
      </span>
      <span className={s.keptText}>
        <strong>{title}</strong>
        <span>{line}</span>
      </span>
      <span className={s.keptActions}>
        {onOpen && openLabel && (
          <button type="button" className={cx(s.primary, s.cardKeep)} onClick={onOpen}>
            {openLabel}
          </button>
        )}
        <button type="button" className={s.secondary} onClick={onUndo}>
          <Undo /> Undo
        </button>
      </span>
    </div>
  );
}
