"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { countWord, HARVEST, KIND_LABEL, ORCHARD, PEOPLE, weekday, type Decision, type ProjectId } from "./data";
import { clockAt, loadsFor, standing, verdictFor, type Outcome, type Outcomes } from "./model";
import { Consequence, VerdictDot } from "./consequence";
import { DecisionCard, ProjectTile } from "./stage";
import { AllClear } from "./all-clear";
import { ArrowRight, Check, Chevron, Clock, Dots, Undo } from "./icons";
import s from "./c4.module.css";

type Scope = "project" | "all";
type Scenario = "morning" | "empty";

const ALL: Decision[] = [ORCHARD[0], ORCHARD[1], HARVEST, ORCHARD[2], ORCHARD[3], ORCHARD[4]];

// Touch behaviour (tap to preview, tap again to commit, swipe) follows the
// pointer, not the width: a laptop at 1024px still gets one-click choices.
const TOUCH_QUERY = "(pointer: coarse)";

function subscribe(cb: () => void) {
  const m = window.matchMedia(TOUCH_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

function useTouch() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false,
  );
}

function minutes(n: number) {
  const m = Math.max(1, Math.round(n * 0.8));
  return m === 1 ? "About a minute." : `About ${countWord(m).toLowerCase()} minutes.`;
}

type Toast = { id: string; text: string; undo: boolean; n: number };

/* How the outgoing card leaves: into its rail row when filed, or up and down when skipping. */
type Flight = { kind: "filed" | "next" | "prev"; dx?: number; dy?: number; sx?: number; sy?: number };

export default function Concept() {
  const reduce = useReducedMotion();
  const touch = useTouch();
  const rootRef = useRef<HTMLDivElement>(null);

  const [scope, setScope] = useState<Scope>("project");
  const [scenario, setScenario] = useState<Scenario>("morning");
  const [outcomes, setOutcomes] = useState<Outcomes>({});
  const [history, setHistory] = useState<string[]>([]);
  const [activeId, setActiveId] = useState("olives");
  const [focus, setFocus] = useState(0);
  const [peek, setPeek] = useState(false);
  const [flight, setFlight] = useState<Flight>({ kind: "next" });
  const [committing, setCommitting] = useState<number | null>(null);
  const [deferOpen, setDeferOpen] = useState(false);
  const [statesOpen, setStatesOpen] = useState(false);
  const [cqOpen, setCqOpen] = useState(true);
  const [moot, setMoot] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const toastTimer = useRef<number | undefined>(undefined);
  const toastSeq = useRef(0);
  const mootTimer = useRef<number | undefined>(undefined);
  const commitTimer = useRef<number | undefined>(undefined);
  const scrollTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(mootTimer.current);
      window.clearTimeout(commitTimer.current);
      window.clearTimeout(scrollTimer.current);
    },
    [],
  );
  const setMotionKind = (kind: Flight["kind"]) => setFlight({ kind });

  const decisions = scenario === "empty" ? [] : scope === "all" ? ALL : ORCHARD;
  const pending = decisions.filter((d) => !outcomes[d.id]);

  // The active card is the requested one or, once filed, the next one still waiting.
  const startIdx = Math.max(0, decisions.findIndex((d) => d.id === activeId));
  let active: Decision | undefined;
  for (let k = 0; k < decisions.length; k++) {
    const d = decisions[(startIdx + k) % decisions.length];
    if (!outcomes[d.id]) {
      active = d;
      break;
    }
  }
  const showOverview = peek || !active;
  const position = active ? decisions.indexOf(active) + 1 : decisions.length;
  const focusIdx = active ? Math.min(focus, active.choices.length - 1) : 0;

  const decidedCount = decisions.filter((d) => outcomes[d.id]?.type === "decided").length;
  const deferredList = decisions.filter((d) => outcomes[d.id]?.type === "deferred");
  const mootCount = decisions.filter((d) => outcomes[d.id]?.type === "moot").length;

  // One model feeds the choice panel and the whole picture, so their numbers cannot drift.
  const inView: ProjectId[] = scope === "all" ? ["orchard", "harvest"] : ["orchard"];
  const state = standing(decisions, outcomes, scenario === "empty");
  const loads = loadsFor(state, inView);

  /* ── actions ─────────────────────────────────────────────────────── */

  function showToast(t: Omit<Toast, "n">) {
    window.clearTimeout(toastTimer.current);
    toastSeq.current += 1;
    setToast({ ...t, n: toastSeq.current });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }

  function resetCard(delay = 0) {
    setFocus(0);
    setDeferOpen(false);
    setCqOpen(true);
    window.clearTimeout(scrollTimer.current);
    const go = () => rootRef.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    if (delay) scrollTimer.current = window.setTimeout(go, delay);
    else go();
  }

  /* Aim the outgoing card at its row in the rail (or the stepper), measured before it moves. */
  function aimAt(id: string): Flight {
    const card = document.getElementById(`card-${id}`);
    const rows = Array.from(document.querySelectorAll<HTMLElement>(`[data-rail="${id}"]`));
    const row = rows.find((el) => el.getClientRects().length > 0);
    if (reduce || !card || !row) return { kind: "filed" };
    const c = card.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    return { kind: "filed", dx: r.left - c.left, dy: r.top - c.top, sx: r.width / c.width, sy: r.height / c.height };
  }

  function file(d: Decision, o: Outcome) {
    setFlight(aimAt(d.id));
    setOutcomes((prev) => ({ ...prev, [d.id]: o }));
    setHistory((h) => [...h, d.id]);
    resetCard(reduce ? 0 : 340);
  }

  function commit(i: number) {
    if (!active || moot || committing !== null) return;
    const c = active.choices[i];
    if (!c) return;
    const d = active;
    const at = clockAt(Object.keys(outcomes).length);
    setFocus(i);
    setCommitting(i);
    // A beat on the ticked choice, then the card files itself away.
    commitTimer.current = window.setTimeout(
      () => {
        setCommitting(null);
        file(d, { type: "decided", choice: i, at });
        showToast({ id: d.id, text: c.filed, undo: true });
      },
      reduce ? 0 : 200,
    );
  }

  function defer(i: number) {
    if (!active || committing !== null) return;
    const opt = active.defer[i];
    file(active, { type: "deferred", option: i, at: clockAt(Object.keys(outcomes).length) });
    showToast({ id: active.id, text: `Back ${opt.label.toLowerCase()}`, undo: true });
  }

  function undo(id: string) {
    window.clearTimeout(commitTimer.current);
    setCommitting(null);
    setOutcomes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setHistory((h) => h.filter((x) => x !== id));
    setMotionKind("prev");
    setActiveId(id);
    setPeek(false);
    setToast(null);
    resetCard();
  }

  function step(dir: 1 | -1) {
    if (!active || pending.length < 2) return;
    const i = pending.indexOf(active);
    const next = pending[(i + dir + pending.length) % pending.length];
    setMotionKind(dir === 1 ? "next" : "prev");
    setActiveId(next.id);
    resetCard();
  }

  function open(id: string) {
    setMotionKind("next");
    setActiveId(id);
    setPeek(false);
    resetCard();
  }

  function resolveMoot(id: string) {
    window.clearTimeout(mootTimer.current);
    const d = decisions.find((x) => x.id === id);
    const m = d?.moot ?? { by: d?.tracks[0].owner ?? "aoife", at: "09:14", text: "" };
    setMotionKind("filed");
    setOutcomes((prev) => ({ ...prev, [id]: { type: "moot", at: m.at, by: m.by, text: m.text } }));
    setMoot(null);
    resetCard();
  }

  function simulateMoot() {
    setStatesOpen(false);
    if (!active) return;
    const id = active.id;
    setDeferOpen(false);
    setMoot(id);
    mootTimer.current = window.setTimeout(() => resolveMoot(id), reduce ? 4000 : 3000);
  }

  function resetMorning(next: Scenario) {
    window.clearTimeout(mootTimer.current);
    setScenario(next);
    setOutcomes({});
    setHistory([]);
    setActiveId(scope === "all" ? ALL[0].id : ORCHARD[0].id);
    setMoot(null);
    setPeek(false);
    setToast(null);
    setStatesOpen(false);
    setMotionKind("next");
    resetCard();
  }

  function deferAll() {
    setStatesOpen(false);
    const at = clockAt(Object.keys(outcomes).length);
    const next = { ...outcomes };
    for (const d of pending) next[d.id] = { type: "deferred", option: 0, at };
    setOutcomes(next);
    setHistory((h) => [...h, ...pending.map((d) => d.id)]);
    setMotionKind("filed");
  }

  function choose(i: number) {
    // With a finger the first tap previews, the second commits.
    if (touch && focusIdx !== i) {
      setFocus(i);
      return;
    }
    commit(i);
  }

  /* ── keyboard ────────────────────────────────────────────────────── */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (committing !== null) return;
      if (deferOpen || statesOpen) {
        if (e.key === "Escape") {
          setDeferOpen(false);
          setStatesOpen(false);
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "z" && history.length) {
        e.preventDefault();
        undo(history[history.length - 1]);
        return;
      }
      if (showOverview) {
        if (e.key === "Escape" && peek && pending.length > 0) {
          e.preventDefault();
          setPeek(false);
        }
        return;
      }
      if (!active || moot) return;
      if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < active.choices.length) {
          e.preventDefault();
          commit(i);
        }
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = active.choices.length;
        const next = (focusIdx + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
        setFocus(next);
        document.getElementById(`choice-${active.id}-${next}`)?.focus({ preventScroll: true });
      } else if (e.key === "Enter" && t?.tagName !== "BUTTON") {
        e.preventDefault();
        commit(focusIdx);
      } else if (k === "j") {
        step(1);
      } else if (k === "k") {
        step(-1);
      } else if (k === "d") {
        e.preventDefault();
        setDeferOpen(true);
      } else if (k === "o") {
        e.preventDefault();
        setPeek(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ── swipe up to advance (phone): only once the card is read to the end ── */

  function onPanEnd(_: PointerEvent, info: PanInfo) {
    const r = rootRef.current;
    if (!touch || !r) return;
    const atEnd = r.scrollTop + r.clientHeight >= r.scrollHeight - 8;
    if (atEnd && (info.offset.y < -90 || info.velocity.y < -600) && Math.abs(info.offset.x) < 60) step(1);
  }

  /* ── header copy ─────────────────────────────────────────────────── */

  const projectsIn = new Set(decisions.map((d) => d.project)).size;
  let line: string;
  if (scenario === "empty")
    line =
      scope === "all"
        ? "A quiet morning. Both projects are on track."
        : "A quiet morning. The Orchard is on track for the tasting on 1 Aug.";
  else if (!showOverview) {
    line =
      pending.length === decisions.length
        ? `${countWord(decisions.length)} things need your call this morning${projectsIn > 1 ? `, across ${countWord(projectsIn).toLowerCase()} projects` : ""}. ${minutes(pending.length)}`
        : `${countWord(pending.length)} left. ${minutes(pending.length)}`;
  } else if (pending.length > 0) {
    line = `${countWord(pending.length)} ${pending.length === 1 ? "decision is" : "decisions are"} still waiting for you. Here is the whole picture.`;
  } else {
    const parts: string[] = [];
    if (decidedCount) parts.push(`made ${decidedCount === 1 ? "one call" : `${countWord(decidedCount).toLowerCase()} calls`}`);
    if (deferredList.length) parts.push(`deferred ${deferredList.length}`);
    const first = parts.length ? `You ${parts.join(" and ")}.` : "";
    const sorted = mootCount ? ` ${mootCount === 1 ? "One" : countWord(mootCount)} sorted ${mootCount === 1 ? "itself" : "themselves"}.` : "";
    const soonest = deferredList
      .map((d) => {
        const o = outcomes[d.id];
        return o.type === "deferred" ? d.defer[o.option].until : 99;
      })
      .sort((a, b) => a - b)[0];
    const until =
      soonest === undefined
        ? " Nothing else needs you today."
        : soonest === 16
          ? " Nothing else needs you until noon."
          : ` Nothing else needs you until ${soonest === 17 ? "Friday" : weekday(soonest)}.`;
    const lead = decidedCount + mootCount > 0 ? "All clear." : "Everything is set aside for later.";
    line = `${lead} ${first}${sorted}${until}`.replace(/\s+/g, " ").trim();
  }

  /*
   * Filing is sequenced: the choice ticks, the card's content fades while its
   * box squeezes into the rail row, the rail tick springs, then the next card
   * rises. AnimatePresence waits for the exit, so the two cards never overlap.
   */
  const cardVariants = {
    enter: (f: Flight) => ({ opacity: 0, x: 0, y: reduce ? 0 : f.kind === "prev" ? -20 : 24, scaleX: 1, scaleY: 1 }),
    center: { opacity: 1, y: 0, x: 0, scaleX: 1, scaleY: 1 },
    exit: (f: Flight) =>
      reduce
        ? { opacity: 0, transition: { duration: 0.12 } }
        : f.kind === "filed" && f.dx !== undefined
          ? {
              x: f.dx,
              y: f.dy,
              scaleX: f.sx,
              scaleY: f.sy,
              opacity: [1, 1, 0],
              transition: { duration: 0.28, ease: [0.55, 0, 0.2, 1] as const, opacity: { duration: 0.28, times: [0, 0.8, 1] } },
            }
          : f.kind === "filed"
            ? { opacity: 0, scale: 0.96, transition: { duration: 0.2 } }
            : { opacity: 0, y: f.kind === "prev" ? 20 : -20, transition: { duration: 0.16 } },
  };
  const contentVariants = {
    enter: { opacity: 1 },
    center: { opacity: 1 },
    exit: (f: Flight) => (f.kind === "filed" && !reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 1 }),
  };
  const ghostVariants = {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: (f: Flight) => (f.kind === "filed" && !reduce ? { opacity: 1 } : { opacity: 0, transition: { duration: 0 } }),
  };
  const filing = flight.kind === "filed";

  const activeDecision = active;

  return (
    <div ref={rootRef} className={s.root} data-touch={touch ? "" : undefined}>
      <div className={s.frame}>
        <header className={s.head}>
          <div className={s.headText}>
            <p className={s.eyebrow}>
              Thursday 16 July
              <span className={s.dotSep} aria-hidden="true" />
              {scope === "all" ? "All projects" : "The Orchard, events"}
            </p>
            <h1 className={s.h1}>Overview</h1>
            <div className={s.lineWrap} aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={line}
                  className={s.line}
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduce ? 0 : -10 }}
                  transition={{ duration: reduce ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {line}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <div className={s.headActions}>
            <div className={s.segmented} role="radiogroup" aria-label="Scope">
              {(["project", "all"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={scope === v}
                  className={scope === v ? `${s.segBtn} ${s.segBtnOn}` : s.segBtn}
                  onClick={() => {
                    setScope(v);
                    setMotionKind("next");
                    resetCard();
                  }}
                >
                  {v === "project" ? (
                    <>
                      <ProjectTile id="orchard" size={14} />
                      The Orchard
                    </>
                  ) : (
                    "All projects"
                  )}
                </button>
              ))}
            </div>
            {!showOverview ? (
              <button type="button" className={s.secondaryBtn} onClick={() => setPeek(true)}>
                Whole picture
                <kbd className={s.kbd}>O</kbd>
              </button>
            ) : pending.length > 0 ? (
              <button type="button" className={s.primaryBtn} onClick={() => setPeek(false)}>
                Back to decisions
                <kbd className={s.kbdOnAccent}>Esc</kbd>
              </button>
            ) : null}
            <div className={s.statesWrap}>
              <button
                type="button"
                className={s.iconBtn}
                aria-label="Preview a state"
                title="Preview a state"
                aria-haspopup="menu"
                aria-expanded={statesOpen}
                onClick={() => setStatesOpen((v) => !v)}
              >
                <Dots size={16} />
              </button>
              {statesOpen && (
                <>
                  <button type="button" className={s.menuScrim} aria-label="Close" onClick={() => setStatesOpen(false)} />
                  <div role="menu" className={`${s.menu} ${s.menuRight}`}>
                    <p className={s.menuLabel}>Preview a state</p>
                    <button role="menuitem" type="button" className={s.menuItem} autoFocus onClick={() => resetMorning("morning")}>
                      <span>Start the morning again</span>
                    </button>
                    <button role="menuitem" type="button" className={s.menuItem} onClick={simulateMoot} disabled={!active || showOverview}>
                      <span>A teammate sorts this one</span>
                      <span className={s.menuDetail}>While you read it</span>
                    </button>
                    <button role="menuitem" type="button" className={s.menuItem} onClick={deferAll} disabled={!pending.length}>
                      <span>Put everything off</span>
                    </button>
                    <button role="menuitem" type="button" className={s.menuItem} onClick={() => resetMorning("empty")}>
                      <span>Nothing needs you today</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {decisions.length > 0 && !showOverview && (
          <div className={s.stepBar}>
            <AnimatePresence mode="popLayout" initial={false}>
              {toast ? (
                <motion.div
                  key={`r${toast.n}`}
                  className={s.stepReceiptWrap}
                  initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduce ? 0 : -6 }}
                  transition={{ duration: reduce ? 0 : 0.18 }}
                >
                  <Receipt toast={toast} onUndo={undo} />
                </motion.div>
              ) : (
                <motion.nav
                  key="steps"
                  className={s.stepper}
                  aria-label={`Decision ${position} of ${decisions.length}`}
                  initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduce ? 0 : -6 }}
                  transition={{ duration: reduce ? 0 : 0.18 }}
                >
                  <ol className={s.steps}>
                    {decisions.map((d) => {
                      const o = outcomes[d.id];
                      const state = o ? o.type : d === active ? "now" : "waiting";
                      return (
                        <li key={d.id} className={s.step} data-state={state} data-rail={d.id}>
                          <button
                            type="button"
                            className={s.stepBtn}
                            aria-current={d === active ? "step" : undefined}
                            onClick={() =>
                              o?.type === "decided" || o?.type === "moot" ? setPeek(true) : o ? undo(d.id) : open(d.id)
                            }
                          >
                            <span className={s.stepMark} aria-hidden="true">
                              {o?.type === "decided" || o?.type === "moot" ? (
                                <Check size={10} />
                              ) : o?.type === "deferred" ? (
                                <Clock size={10} />
                              ) : null}
                            </span>
                            <span className={s.stepTitle}>{d.short}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </motion.nav>
              )}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {showOverview ? (
            <motion.div
              key="overview"
              className={s.overviewWrap}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.24 }}
            >
              {scenario === "empty" && (
                <motion.div
                  className={s.calmHero}
                  initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0 : 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <span className={s.calmIcon}>
                    <Check size={18} />
                  </span>
                  <span className={s.calmText}>
                    <span className={s.calmTitle}>Nothing needs your call</span>
                    <span className={s.calmSub}>
                      The next thing that might is Priya&rsquo;s seating plan, Mon 20 Jul. It comes here when it is ready.
                    </span>
                  </span>
                </motion.div>
              )}
              <AllClear
                decisions={decisions}
                outcomes={outcomes}
                state={state}
                inView={inView}
                showProject={scope === "all"}
                clean={scenario === "empty"}
                onUndo={undo}
                onOpen={open}
              />
            </motion.div>
          ) : (
            activeDecision && (
              <motion.div
                key="stack"
                className={s.stack}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.2 } }}
              >
                <nav className={s.spine} aria-label="This morning's decisions">
                  <p className={s.spineCount}>This morning</p>
                  <ol className={s.spineList}>
                    {decisions.map((d) => {
                      const o = outcomes[d.id];
                      const isNow = d === activeDecision;
                      const sub = o
                        ? o.type === "decided"
                          ? d.choices[o.choice].filed
                          : o.type === "deferred"
                            ? `Back ${d.defer[o.option].label.toLowerCase()}`
                            : `${PEOPLE[o.by].name} sorted it`
                        : KIND_LABEL[d.kind];
                      const state = o ? o.type : isNow ? "now" : "waiting";
                      const fresh = toast?.id === d.id;
                      return (
                        <li
                          key={d.id}
                          className={s.spineItem}
                          data-state={state}
                          data-fresh={fresh ? "" : undefined}
                          data-rail={d.id}
                        >
                          <button
                            type="button"
                            className={s.spineBtn}
                            aria-current={isNow ? "step" : undefined}
                            onClick={() => (o?.type === "decided" || o?.type === "moot" ? setPeek(true) : o ? undo(d.id) : open(d.id))}
                          >
                            <span className={s.spineMark} aria-hidden="true">
                              <AnimatePresence mode="popLayout" initial={false}>
                                {o?.type === "decided" || o?.type === "moot" ? (
                                  <motion.span
                                    key="done"
                                    className={s.spineTick}
                                    initial={{ scale: reduce ? 1 : 0.2, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 20, delay: 0.26 }}
                                  >
                                    <Check size={11} />
                                  </motion.span>
                                ) : o?.type === "deferred" ? (
                                  <motion.span key="later" className={s.spineLater} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <Clock size={11} />
                                  </motion.span>
                                ) : (
                                  <motion.span key="ring" className={s.spineRing} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
                                )}
                              </AnimatePresence>
                            </span>
                            <span className={s.spineText}>
                              <span className={s.spineTitle}>
                                {scope === "all" && <ProjectTile id={d.project} size={13} />}
                                {d.short}
                              </span>
                              <span className={s.spineSub}>{sub}</span>
                            </span>
                          </button>
                          <AnimatePresence initial={false}>
                            {fresh && toast.undo && (
                              <motion.div
                                key={toast.n}
                                className={s.spineUndoWrap}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: reduce ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                              >
                                <button type="button" className={s.spineUndo} onClick={() => undo(d.id)}>
                                  <Undo size={12} />
                                  Undo
                                  <kbd className={s.kbd}>Z</kbd>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      );
                    })}
                  </ol>
                </nav>

                <div className={s.stageCol}>
                  <AnimatePresence mode="wait" initial={false} custom={flight}>
                    <motion.div
                      key={activeDecision.id}
                      id={`card-${activeDecision.id}`}
                      className={s.cardMotion}
                      custom={flight}
                      variants={cardVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={reduce ? { duration: 0.12 } : { type: "spring", stiffness: 300, damping: 30, mass: 0.9 }}
                      style={{ transformOrigin: "0 0" }}
                      onPanEnd={onPanEnd}
                    >
                      <motion.span className={s.cardGhost} custom={flight} variants={ghostVariants} aria-hidden="true" />
                      <motion.div className={s.cardContent} custom={flight} variants={contentVariants}>
                      <DecisionCard
                        decision={activeDecision}
                        focus={focusIdx}
                        committing={committing}
                        onFocus={(i) => !touch && setFocus(i)}
                        onChoose={choose}
                        onDefer={defer}
                        deferOpen={deferOpen}
                        setDeferOpen={setDeferOpen}
                        showProject={scope === "all"}
                        touch={touch}
                        moot={
                          moot === activeDecision.id
                            ? (activeDecision.moot ?? { by: activeDecision.tracks[0].owner, at: "09:14", text: "" })
                            : null
                        }
                        onMootNext={() => resolveMoot(activeDecision.id)}
                        consequenceSlot={
                          <div className={s.peekCq}>
                            <button
                              type="button"
                              className={s.peekToggle}
                              aria-expanded={cqOpen}
                              onClick={() => setCqOpen((v) => !v)}
                            >
                              <span className={s.peekLabel}>If you choose {focusIdx + 1}</span>
                              <span className={s.peekSummary}>{activeDecision.choices[focusIdx].summary}</span>
                              <span className={cqOpen ? `${s.peekChevron} ${s.peekChevronOpen}` : s.peekChevron}>
                                <Chevron size={16} />
                              </span>
                            </button>
                            <AnimatePresence initial={false}>
                              {cqOpen && (
                                <motion.div
                                  className={s.peekBody}
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: reduce ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
                                >
                                  <Consequence decision={activeDecision} choiceIndex={focusIdx} loads={loads} compact />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        }
                      />
                      </motion.div>
                    </motion.div>
                  </AnimatePresence>

                  <p className={s.swipeHint}>Swipe up at the end for the next one</p>
                </div>

                <aside className={s.cqCol} aria-label="If you choose this">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeDecision.id}
                      initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: reduce ? 0.12 : 0.1 } }}
                      transition={{ duration: reduce ? 0.12 : 0.24, delay: reduce ? 0 : filing ? 0.24 : 0.04 }}
                    >
                      <Consequence decision={activeDecision} choiceIndex={focusIdx} loads={loads} />
                    </motion.div>
                  </AnimatePresence>
                </aside>

                <div className={s.thumbBar}>
                  <ThumbChoice decision={activeDecision} index={focusIdx} />
                  <button type="button" className={s.thumbLater} onClick={() => setDeferOpen(true)} disabled={!!moot}>
                    <Clock size={16} />
                    Not now
                  </button>
                  <button
                    type="button"
                    className={s.thumbGo}
                    onClick={() => commit(focusIdx)}
                    disabled={!!moot}
                    aria-label={`Choose ${focusIdx + 1}: ${activeDecision.choices[focusIdx].label}`}
                  >
                    Choose {focusIdx + 1}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {showOverview && (
        <div className={s.toastDock}>
          <AnimatePresence initial={false}>
            {toast && (
              <motion.div
                key={`o${toast.n}`}
                initial={{ opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: reduce ? 0 : 8 }}
                transition={{ duration: reduce ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <Receipt toast={toast} onUndo={undo} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <p className={s.srOnly} role="status">
        {toast ? `${toast.text}. Press Z to undo.` : ""}
      </p>
    </div>
  );
}

function Receipt({ toast, onUndo }: { toast: Toast; onUndo: (id: string) => void }) {
  return (
    <span className={s.receiptPill}>
      <span className={s.toastTick}>
        <Check size={12} />
      </span>
      <span className={s.receiptPillText}>{toast.text}</span>
      {toast.undo && (
        <button type="button" className={s.receiptUndo} onClick={() => onUndo(toast.id)}>
          <Undo size={13} />
          Undo
          <kbd className={s.kbd}>Z</kbd>
        </button>
      )}
    </span>
  );
}

function ThumbChoice({ decision, index }: { decision: Decision; index: number }) {
  const c = decision.choices[index];
  const v = verdictFor(decision, c);
  return (
    <div className={s.thumbChoice} aria-hidden="true">
      <span className={s.thumbKey}>{index + 1}</span>
      <span className={s.thumbText}>
        <span className={s.thumbLabel}>{c.label}</span>
        <span className={s.thumbVerdict} data-verdict={v.kind}>
          <VerdictDot v={v} />
          {v.chip}, {v.gap.charAt(0).toLowerCase() + v.gap.slice(1)}
        </span>
      </span>
    </div>
  );
}
