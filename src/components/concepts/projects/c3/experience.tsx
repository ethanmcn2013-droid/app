"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, I, Kbd, StatusDot, cardHandle, useFocusTrap, useIsPhone } from "./bits";
import { Card, CompactRow, WrappedCard } from "./card";
import { CheckIn, Summary, type Draft } from "./checkin";
import { LANES, ME, STATUS_LABEL, TODAY, type Action, type ActionOption, type Lane, type Project, type Status } from "./data";
import { Hub } from "./hub";
import {
  EMPTY,
  SCENARIOS,
  buildProjects,
  laneOf,
  openSignals,
  type Answer,
  type PState,
  type Scenario,
} from "./logic";
import s from "./c3.module.css";

type Mode = "board" | "checkin" | "summary";
type Toast = { id: number; text: string; undo?: () => void };

const REASONS: Record<Exclude<Lane, "wrapped">, string[]> = {
  needs: ["I want to step in", "The client is worried", "The date is too close to leave"],
  watch: ["The owner has it handled", "Waiting on a supplier", "Not urgent yet"],
  smooth: ["Sorted offline", "The signals are out of date", "Not worth a look this week"],
};

export function Experience({ scenario, onScenario }: { scenario: Scenario; onScenario: (s: Scenario) => void }) {
  const isPhone = useIsPhone();
  const reduce = useReducedMotion() ?? false;
  const [projects] = useState(() => buildProjects(scenario));
  const [pstate, setPstate] = useState<Record<string, PState>>({});
  const [mode, setMode] = useState<Mode>("board");
  const [hubId, setHubId] = useState<string | null>(null);
  const [checked, setChecked] = useState<null | "Monday" | "today">(scenario === "checked" ? "Monday" : null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  // The answers the board has settled on. They lag `answers` by a beat, so the
  // cards visibly move to their new lanes when you come back from the summary.
  const [laneAnswers, setLaneAnswers] = useState<Record<string, Answer>>({});
  const [justMoved, setJustMoved] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [ciIndex, setCiIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [wrappedPref, setWrappedPref] = useState<boolean | null>(null);
  const [pendingMove, setPendingMove] = useState<{ id: string; lane: Exclude<Lane, "wrapped"> } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [swipedOnce, setSwipedOnce] = useState(false);
  const seq = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Each mode is its own page: start it at the top.
  useEffect(() => {
    rootRef.current?.scrollTo({ top: 0 });
  }, [mode]);

  const get = useCallback((id: string) => pstate[id] ?? EMPTY, [pstate]);
  const update = useCallback((id: string, fn: (st: PState) => PState) => {
    setPstate((prev) => ({ ...prev, [id]: fn(prev[id] ?? EMPTY) }));
  }, []);

  const toast = useCallback((text: string, undo?: () => void) => {
    seq.current += 1;
    const id = seq.current;
    setToasts((t) => [...t.slice(-2), { id, text, undo }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);
  const dismissToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  /* ── derived ── */
  const active = useMemo(() => projects.filter((p) => !p.wrapped), [projects]);
  const lanes = useMemo(() => {
    const by: Record<Lane, Project[]> = { needs: [], watch: [], smooth: [], wrapped: [] };
    for (const p of projects) {
      if (filter === "mine" && p.owner !== ME) continue;
      by[laneOf(p, get(p.id), laneAnswers[p.id])].push(p);
    }
    by.needs.sort((a, b) => a.daysOut - b.daysOut);
    return by;
  }, [projects, filter, get, laneAnswers]);
  const counts = useMemo(() => {
    const c: Record<Lane, number> = { needs: 0, watch: 0, smooth: 0, wrapped: 0 };
    for (const p of projects) c[laneOf(p, get(p.id), laneAnswers[p.id])] += 1;
    return c;
  }, [projects, get, laneAnswers]);
  const queue = useMemo(() => {
    const order: Lane[] = ["needs", "watch", "smooth"];
    const at = (p: Project) => order.indexOf(laneOf(p, get(p.id), laneAnswers[p.id]));
    return [...active].sort((a, b) => at(a) - at(b));
    // The queue is fixed for the length of a check-in run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, startedAt]);
  const allWrapped = active.length === 0;
  const calmNeeds = !allWrapped && filter === "all" && lanes.needs.length === 0;
  const wrappedOpen = wrappedPref ?? false;
  const hub = hubId ? projects.find((p) => p.id === hubId) ?? null : null;

  /* ── actions ── */
  const runAction = useCallback(
    (p: Project, a: Action, option?: ActionOption) => {
      if (a.kind === "open") {
        setHubId(p.id);
        return;
      }
      const before = pstate[p.id] ?? EMPTY;
      update(p.id, (st) => ({
        ...st,
        done: [...st.done, a.id],
        resolved: a.kind !== "nudge" && a.signalId ? [...st.resolved, a.signalId] : st.resolved,
        nudged: a.kind === "nudge" && a.signalId ? [...st.nudged, a.signalId] : st.nudged,
      }));
      toast(option?.toast ?? a.toast ?? "Done.", () => update(p.id, () => before));
    },
    [pstate, toast, update],
  );

  const snooze = useCallback(
    (p: Project, signalId?: string) => {
      const st = pstate[p.id] ?? EMPTY;
      const target = signalId ?? openSignals(p, st).find((x) => x.weight !== "fine")?.id;
      if (!target) {
        toast(`Nothing to snooze on ${p.name}.`);
        return;
      }
      update(p.id, (x) => ({ ...x, snoozed: [...x.snoozed, target] }));
      toast("Snoozed until Friday 2 October. It comes back if anything changes.", () =>
        update(p.id, (x) => ({ ...x, snoozed: x.snoozed.filter((id) => id !== target) })),
      );
    },
    [pstate, toast, update],
  );

  const unsnooze = (p: Project, signalId: string) =>
    update(p.id, (x) => ({ ...x, snoozed: x.snoozed.filter((id) => id !== signalId) }));

  const confirmMove = (reason: string) => {
    if (!pendingMove) return;
    const p = projects.find((x) => x.id === pendingMove.id);
    if (!p) return;
    const lane = pendingMove.lane;
    const before = pstate[p.id] ?? EMPTY;
    const natural = laneOf(p, { ...before, override: undefined }, laneAnswers[p.id]);
    update(p.id, (st) => ({ ...st, override: lane === natural ? undefined : { lane, reason } }));
    setPendingMove(null);
    const title = LANES.find((l) => l.id === lane)?.title ?? "";
    toast(`Moved ${p.name} to ${title.toLowerCase()}. The reason is saved to its history.`, () => update(p.id, () => before));
  };

  const requestMove = (id: string, lane: Lane) => {
    if (lane === "wrapped") return;
    const p = projects.find((x) => x.id === id);
    if (!p || p.wrapped) return;
    if (laneOf(p, get(id), laneAnswers[id]) === lane) return;
    setPendingMove({ id, lane });
  };

  const clearOverride = (p: Project) => update(p.id, (st) => ({ ...st, override: undefined }));

  const toggleNext = (p: Project, title: string) =>
    update(p.id, (st) => ({
      ...st,
      done: st.done.includes(`next:${title}`) ? st.done.filter((x) => x !== `next:${title}`) : [...st.done, `next:${title}`],
    }));

  /* ── check-in ── */
  const startCheckIn = useCallback(
    (fresh: boolean) => {
      setHubId(null);
      if (fresh) {
        setStartedAt(Date.now());
        setCiIndex(0);
        setDrafts(
          Object.fromEntries(Object.entries(answers).map(([id, a]) => [id, { status: a.status, line: a.line }])),
        );
      }
      setMode("checkin");
    },
    [answers],
  );

  const finishCheckIn = () => {
    const next: Record<string, Answer> = {};
    const skippedNow: string[] = [];
    for (const [id, d] of Object.entries(drafts)) {
      if (d.status) next[id] = { status: d.status, line: d.line.trim() };
      else if (d.skipped) skippedNow.push(id);
    }
    setAnswers(next);
    setSkippedIds(skippedNow);
    setElapsed(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    setChecked("today");
    setMode("summary");
  };

  /** Which projects this check-in moves on the board, worst destination first. */
  const pendingMoves = useMemo(() => {
    const order: Lane[] = ["needs", "watch", "smooth"];
    return active
      .map((p) => ({ p, from: laneOf(p, get(p.id), laneAnswers[p.id]), to: laneOf(p, get(p.id), answers[p.id]) }))
      .filter((m) => m.from !== m.to)
      .sort((a, b) => order.indexOf(a.to) - order.indexOf(b.to));
  }, [active, get, laneAnswers, answers]);

  // Back on the board: show the lanes as they were, then let the answers land.
  const settleBoard = () => {
    setMode("board");
    const moves = pendingMoves;
    const next = answers;
    if (!moves.length) {
      setLaneAnswers(next);
      return;
    }
    const land = () => {
      setLaneAnswers(next);
      setJustMoved(moves.map((m) => m.p.id));
      toast(settleToast(moves));
      window.setTimeout(() => setJustMoved([]), 2600);
    };
    if (reduce) land();
    else window.setTimeout(land, 480);
  };

  const touched = queue.filter((q) => drafts[q.id]?.status || drafts[q.id]?.skipped).length;
  const inProgress = mode === "board" && startedAt > 0 && checked !== "today" && (touched > 0 || ciIndex > 0);

  /* ── the check-in strip: this week's ritual, visible on the board ── */
  const stripPhase: "todo" | "paused" | "today" | "monday" = inProgress
    ? "paused"
    : checked === "today"
      ? "today"
      : checked === "Monday"
        ? "monday"
        : "todo";
  const stripDots = queue.map((q) => {
    const status: Status | null =
      stripPhase === "today"
        ? answers[q.id]?.status ?? null
        : stripPhase === "monday"
          ? q.suggestion.status
          : stripPhase === "paused"
            ? drafts[q.id]?.status ?? null
            : null;
    const skipped = stripPhase === "today" ? skippedIds.includes(q.id) : stripPhase === "paused" ? !!drafts[q.id]?.skipped : false;
    return { id: q.id, name: q.name, status, skipped };
  });
  const answeredCount = stripDots.filter((d) => d.status).length;

  useEffect(() => {
    if (mode !== "board") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" && hubId) setHubId(null);
      if (hubId || pendingMove) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        startCheckIn(!inProgress);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, hubId, pendingMove, startCheckIn, inProgress]);

  const moving = pendingMove ? projects.find((p) => p.id === pendingMove.id) : null;
  const movingLane = pendingMove ? LANES.find((l) => l.id === pendingMove.lane) : null;

  return (
    <div ref={rootRef} className={`${s.root} thin-scroll`} data-mode={mode}>
      {mode === "board" ? (
        <div className={s.board}>
          <header className={s.head}>
            <div className={s.headText}>
              <p className={s.eyebrow}>{TODAY}</p>
              <h1 className={s.title}>Projects</h1>
              <p className={s.summary}>
                {allWrapped ? (
                  "Nothing is running right now. Here is what finished lately."
                ) : (
                  <>
                    <SummaryPart tone="needs" n={counts.needs} label={counts.needs === 1 ? "needs you" : "need you"} zero="Nothing needs you" reduce={reduce} />
                    {counts.watch > 0 ? (
                      <SummaryPart tone="watch" n={counts.watch} label="to keep an eye on" lead={counts.smooth > 0 ? ", " : " and "} reduce={reduce} />
                    ) : null}
                    {counts.smooth > 0 ? <SummaryPart tone="smooth" n={counts.smooth} label="running smoothly" lead=" and " reduce={reduce} /> : null}
                    .
                  </>
                )}
              </p>
            </div>
            {allWrapped ? null : (
              <div className={s.headActions}>
                <div className={s.segmented} role="group" aria-label="Show projects">
                  <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                    Everyone&rsquo;s
                  </button>
                  <button type="button" aria-pressed={filter === "mine"} onClick={() => setFilter("mine")}>
                    <Avatar id={ME} size={16} />
                    Mine
                  </button>
                </div>
                <button type="button" className={s.btnGhost} onClick={() => toast("New project started. Give it a name and it will show up here.")}>
                  <I.plus size={14} />
                  New project
                </button>
              </div>
            )}
          </header>

          {allWrapped ? null : (
            <section className={s.strip} data-phase={stripPhase} aria-label="Weekly check-in">
              <ol className={s.stripDots} aria-label={`${answeredCount} of ${queue.length} projects checked in this week`}>
                {stripDots.map((d, i) => (
                  <li
                    key={d.id}
                    className={s.stripDot}
                    title={`${d.name}: ${d.status ? STATUS_LABEL[d.status] : d.skipped ? "skipped for now" : "not yet"}`}
                  >
                    <StatusDot
                      status={d.status}
                      skipped={d.skipped}
                      size={12}
                      settle={stripPhase === "today" && !reduce}
                      delay={stripPhase === "today" ? 200 + i * 70 : undefined}
                    />
                    <span className={s.srOnly}>
                      {d.name}: {d.status ? STATUS_LABEL[d.status] : d.skipped ? "skipped for now" : "not yet"}
                    </span>
                  </li>
                ))}
              </ol>
              <div className={s.stripText}>
                <p className={s.stripTitle}>
                  {stripPhase === "todo"
                    ? "This week\u2019s check-in"
                    : stripPhase === "paused"
                      ? "Check-in paused"
                      : stripPhase === "today"
                        ? "Checked in today"
                        : "Checked in Monday 21 Sep"}
                </p>
                <p className={s.stripNote}>
                  {stripPhase === "todo" ? (
                    <>
                      <span className={s.stripLong}>0 of {queue.length} this week · due Monday 28 Sep · about a minute</span>
                      <span className={s.stripShort}>0 of {queue.length} · due Mon 28 Sep</span>
                    </>
                  ) : stripPhase === "paused" ? (
                    `${touched - answeredCount ? `${answeredCount} answered, ${touched - answeredCount} skipped for now · ` : ""}Next up: ${queue[Math.min(ciIndex, queue.length - 1)]?.name}`
                  ) : stripPhase === "today" ? (
                    `${answeredCount} of ${queue.length} in ${elapsed < 90 ? `${elapsed} seconds` : `${Math.round(elapsed / 60)} minutes`} · ${movesPhrase(queue, answers)}`
                  ) : (
                    "Next one due Monday 28 Sep"
                  )}
                </p>
              </div>
              <div className={s.stripActions}>
                {stripPhase === "today" ? (
                  <>
                    <button type="button" className={s.linkBtn} onClick={() => startCheckIn(true)}>
                      Do it again
                    </button>
                    <button type="button" className={s.btn} onClick={() => setMode("summary")}>
                      See the summary
                      <I.arrowRight size={13} />
                    </button>
                  </>
                ) : stripPhase === "monday" ? (
                  <button type="button" className={s.btn} onClick={() => startCheckIn(true)}>
                    Do it again
                  </button>
                ) : (
                  <button type="button" className={s.btnPrimary} onClick={() => startCheckIn(!inProgress)}>
                    <I.play size={12} />
                    {stripPhase === "paused" ? `Resume (${touched} of ${queue.length})` : "Start check-in"}
                    <Kbd>C</Kbd>
                  </button>
                )}
              </div>
            </section>
          )}

          {allWrapped ? (
            <div className={s.allWrapped}>
              <div className={s.allWrappedMark} aria-hidden>
                <I.check size={22} />
              </div>
              <h2 className={s.allWrappedTitle}>Every project is wrapped</h2>
              <p className={s.allWrappedText}>
                Nothing is waiting on you or anyone else. When the next project starts, it will show up here with its first
                signals after a few tasks.
              </p>
              <button type="button" className={s.btnPrimary} onClick={() => toast("New project started.")}>
                <I.plus size={14} /> New project
              </button>
            </div>
          ) : null}

          <LayoutGroup>
            <div className={s.lanes} data-all-wrapped={allWrapped} data-calm={calmNeeds}>
              {LANES.map((lane) => {
                if (allWrapped ? lane.id !== "wrapped" : lane.id === "wrapped") return null;
                if (lane.id === "needs" && calmNeeds) {
                  return (
                    <section key="needs" className={s.calmBar} aria-labelledby="c3-calm">
                      <span className={s.calmBarMark} aria-hidden>
                        <I.check size={15} />
                      </span>
                      <div>
                        <h2 id="c3-calm" className={s.calmBarTitle}>
                          Nothing needs you this week
                        </h2>
                        <p className={s.calmBarText}>
                          {checked === "today" ? "You checked in today." : "Last check-in Monday 14 Sep at 9:12."} Everything
                          else is moving with someone on it.
                        </p>
                      </div>
                    </section>
                  );
                }
                const items = lanes[lane.id];
                const movedAt = (id: string) => justMoved.indexOf(id);
                return (
                  <LaneColumn
                    key={lane.id}
                    lane={lane.id}
                    title={lane.title}
                    hint={lane.hint}
                    count={items.length}
                    reduce={reduce}
                    droppable={!isPhone && lane.id !== "wrapped"}
                    onDropCard={(id) => requestMove(id, lane.id)}
                  >
                    {items.length === 0 ? (
                      <EmptyLane lane={lane.id} filter={filter} />
                    ) : lane.id === "smooth" ? (
                      <div className={s.rowList}>
                        {items.map((p) => (
                          <CompactRow
                            key={p.id}
                            project={p}
                            st={get(p.id)}
                            answer={laneAnswers[p.id]}
                            moved={movedAt(p.id)}
                            isPhone={isPhone}
                            reduce={reduce}
                            onOpen={() => setHubId(p.id)}
                            onClearOverride={() => clearOverride(p)}
                          />
                        ))}
                      </div>
                    ) : (
                      items.map((p, i) => (
                        <Card
                          key={p.id}
                          project={p}
                          st={get(p.id)}
                          lane={lane.id}
                          answer={laneAnswers[p.id]}
                          moved={movedAt(p.id)}
                          isPhone={isPhone}
                          reduce={reduce}
                          hintSwipe={isPhone && !swipedOnce && lane.id === "needs" && i === 0}
                          onSwiped={() => setSwipedOnce(true)}
                          onOpen={() => setHubId(p.id)}
                          onAction={(a, o) => runAction(p, a, o)}
                          onSnooze={(sid) => snooze(p, sid)}
                          onUnsnooze={(sid) => unsnooze(p, sid)}
                          onMove={(l) => requestMove(p.id, l)}
                          onClearOverride={() => clearOverride(p)}
                        />
                      ))
                    )}
                    {lane.id === "smooth" && lanes.wrapped.length > 0 ? (
                      <div className={s.wrappedFoot}>
                        <button
                          type="button"
                          className={s.wrappedToggle}
                          aria-expanded={wrappedOpen}
                          aria-controls="c3-wrapped-list"
                          onClick={() => setWrappedPref(!wrappedOpen)}
                        >
                          <I.check size={12} />
                          <span className={s.wrappedToggleText}>{lanes.wrapped.length} wrapped recently</span>
                          <span className={s.wrappedChevron} data-open={wrappedOpen}>
                            <I.chevron size={12} />
                          </span>
                        </button>
                        <AnimatePresence initial={false}>
                          {wrappedOpen ? (
                            <motion.div
                              key="wrapped"
                              id="c3-wrapped-list"
                              className={s.wrappedList}
                              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
                            >
                              <div className={s.wrappedListInner}>
                                {lanes.wrapped.map((p) => (
                                  <WrappedCard key={p.id} project={p} reduce={reduce} onOpen={() => setHubId(p.id)} />
                                ))}
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    ) : null}
                  </LaneColumn>
                );
              })}
            </div>
          </LayoutGroup>

          <footer className={s.states}>
            <span className={s.statesLabel}>Preview a state</span>
            <div className={s.statesList}>
              {SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  className={s.stateChip}
                  aria-pressed={sc.id === scenario}
                  onClick={() => onScenario(sc.id)}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </footer>
        </div>
      ) : null}

      {mode === "checkin" ? (
        <CheckIn
          queue={queue}
          pstate={pstate}
          index={ciIndex}
          setIndex={setCiIndex}
          drafts={drafts}
          setDrafts={setDrafts}
          isPhone={isPhone}
          reduce={reduce}
          startedAt={startedAt}
          onPause={() => setMode("board")}
          onFinish={finishCheckIn}
        />
      ) : null}

      {mode === "summary" ? (
        <Summary
          projects={queue.length ? queue : active}
          answers={answers}
          skipped={skippedIds}
          elapsed={elapsed}
          reduce={reduce}
          boardMoves={pendingMoves.map((m) => ({ id: m.p.id, name: m.p.name, to: m.to }))}
          onDone={settleBoard}
          onAgain={() => startCheckIn(true)}
          onToast={toast}
        />
      ) : null}

      <AnimatePresence>
        {hub ? (
          <Hub
            key="hub"
            project={hub}
            st={get(hub.id)}
            lane={laneOf(hub, get(hub.id), laneAnswers[hub.id])}
            answer={answers[hub.id]}
            isPhone={isPhone}
            reduce={reduce}
            onClose={() => setHubId(null)}
            restoreTo={() => cardHandle(hub.id)}
            onAction={(a, o) => runAction(hub, a, o)}
            onToggleNext={(t) => toggleNext(hub, t)}
            onToast={toast}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {moving && movingLane && pendingMove ? (
          <MoveDialog
            key="move"
            restoreTo={() => cardHandle(moving.id)}
            name={moving.name}
            laneTitle={movingLane.title}
            laneHint={movingLane.hint}
            reasons={REASONS[pendingMove.lane]}
            onCancel={() => setPendingMove(null)}
            onConfirm={confirmMove}
          />
        ) : null}
      </AnimatePresence>

      <div className={s.toasts} aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout={!reduce}
              className={s.toast}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <span className={s.toastTick} aria-hidden>
                <I.check size={12} />
              </span>
              <span className={s.toastText}>{t.text}</span>
              {t.undo ? (
                <button
                  type="button"
                  className={s.toastUndo}
                  onClick={() => {
                    t.undo?.();
                    dismissToast(t.id);
                  }}
                >
                  Undo
                </button>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const LANE_PHRASE: Record<Lane, [string, string]> = {
  needs: ["now needs you", "now need you"],
  watch: ["is now one to keep an eye on", "are now ones to keep an eye on"],
  smooth: ["is running smoothly again", "are running smoothly again"],
  wrapped: ["is wrapped", "are wrapped"],
};

function nameList(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
}

/** "3 projects moved. Winter season launch now needs you." Leads with the worst destination. */
function settleToast(moves: { p: Project; to: Lane }[]) {
  const worst = moves[0].to;
  const names = moves.filter((m) => m.to === worst).map((m) => m.p.name);
  const tail = `${nameList(names)} ${LANE_PHRASE[worst][names.length === 1 ? 0 : 1]}.`;
  if (moves.length === 1) return `Your check-in moved one project. ${tail}`;
  return `${moves.length} projects moved. ${tail}`;
}

/** "2 slipped, 1 recovered", or that nothing changed. */
function movesPhrase(queue: Project[], answers: Record<string, Answer>) {
  const rank: Record<Status, number> = { on: 0, risk: 1, off: 2 };
  let slipped = 0;
  let recovered = 0;
  for (const q of queue) {
    const now = answers[q.id]?.status;
    const prev = q.history[q.history.length - 1]?.status;
    if (!now || !prev || now === prev) continue;
    if (rank[now] > rank[prev]) slipped += 1;
    else recovered += 1;
  }
  const parts = [slipped ? `${slipped} slipped` : "", recovered ? `${recovered} recovered` : ""].filter(Boolean);
  return parts.length ? parts.join(", ") : "nothing changed since last week";
}

function SummaryPart({
  tone,
  n,
  label,
  lead,
  zero,
  reduce,
}: {
  tone: string;
  n: number;
  label: string;
  lead?: string;
  zero?: string;
  reduce: boolean;
}) {
  const isZero = n === 0 && !!zero;
  return (
    <>
      {lead}
      <span className={s.sumPart} data-tone={isZero ? "smooth" : tone} data-zero={isZero || undefined}>
        {isZero ? (
          <b className={s.sumNum}>{zero}</b>
        ) : (
          <>
            <b className={s.sumNum}>
              <Ticker n={n} reduce={reduce} />
            </b>{" "}
            {label}
          </>
        )}
      </span>
    </>
  );
}

function LaneColumn({
  lane,
  title,
  hint,
  count,
  reduce,
  droppable,
  onDropCard,
  children,
}: {
  lane: Lane;
  title: string;
  hint: string;
  count: number;
  reduce: boolean;
  droppable: boolean;
  onDropCard: (id: string) => void;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  const headingId = `c3-lane-${lane}`;
  return (
    <section
      className={s.lane}
      data-lane={lane}
      data-over={over}
      aria-labelledby={headingId}
      onDragOver={
        droppable
          ? (e) => {
              if (!e.dataTransfer.types.includes("text/x-c3-project")) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (!over) setOver(true);
            }
          : undefined
      }
      onDragLeave={
        droppable
          ? (e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
            }
          : undefined
      }
      onDrop={
        droppable
          ? (e) => {
              e.preventDefault();
              setOver(false);
              const id = e.dataTransfer.getData("text/x-c3-project");
              if (id) onDropCard(id);
            }
          : undefined
      }
    >
      <header className={s.laneHead}>
        <div className={s.laneTitleRow}>
          <span className={s.laneDot} aria-hidden />
          <h2 className={s.laneTitle} id={headingId}>
            {title}
          </h2>
          <span className={s.laneCount}>
            <Ticker n={count} reduce={reduce} />
          </span>
        </div>
        <p className={s.laneHint}>{hint}</p>
      </header>
      <div className={s.laneBody}>{children}</div>
      {over ? <div className={s.dropHint}>Drop to move it here</div> : null}
    </section>
  );
}

/** A number that rolls to its new value, up or down, when the board settles. */
function Ticker({ n, reduce }: { n: number; reduce: boolean }) {
  const [shown, setShown] = useState({ n, dir: 1 });
  if (shown.n !== n) setShown({ n, dir: n > shown.n ? 1 : -1 });
  const dir = n === shown.n ? shown.dir : n > shown.n ? 1 : -1;
  if (reduce) return <>{n}</>;
  return (
    <span className={s.ticker}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={n}
          className={s.tickerNum}
          initial={{ y: dir > 0 ? "80%" : "-80%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: dir > 0 ? "-80%" : "80%", opacity: 0 }}
          transition={{ duration: 0.34, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function EmptyLane({ lane, filter }: { lane: Lane; filter: "all" | "mine" }) {
  if (lane === "needs") {
    return (
      <div className={s.calm}>
        <span className={s.calmMark} aria-hidden>
          <I.check size={14} />
        </span>
        <div>
          <p className={s.calmTitle}>Nothing needs you this week</p>
          <p className={s.calmText}>Last check-in Monday 14 Sep at 9:12.</p>
        </div>
      </div>
    );
  }
  return (
    <p className={s.emptyLane}>
      {lane === "wrapped"
        ? "Nothing wrapped in the last 30 days."
        : filter === "mine"
          ? "None of yours here."
          : "Nothing here this week."}
    </p>
  );
}

function MoveDialog({
  restoreTo,
  name,
  laneTitle,
  laneHint,
  reasons,
  onCancel,
  onConfirm,
}: {
  restoreTo: () => HTMLElement | null;
  name: string;
  laneTitle: string;
  laneHint: string;
  reasons: string[];
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [picked, setPicked] = useState(reasons[0]);
  const [own, setOwn] = useState("");
  const reason = own.trim() || picked;
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, restoreTo);
  return (
    <>
      <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} />
      <motion.div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="c3-move-title"
        className={s.dialog}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        <h2 id="c3-move-title" className={s.dialogTitle}>
          Move {name} to {laneTitle.toLowerCase()}?
        </h2>
        <p className={s.dialogText}>
          {laneHint} It stays there until you move it back, or until something new happens on the project.
        </p>
        <p className={s.dialogLabel}>Why?</p>
        <div className={s.reasonChips}>
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              className={s.reasonChip}
              aria-pressed={!own.trim() && picked === r}
              onClick={() => {
                setPicked(r);
                setOwn("");
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <input
          className={s.dialogInput}
          value={own}
          onChange={(e) => setOwn(e.target.value)}
          placeholder="Or write your own reason"
          aria-label="Your own reason"
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(reason);
          }}
        />
        <p className={s.dialogNote}>The move and the reason go into the project&rsquo;s history, so the team can see why.</p>
        <div className={s.dialogActions}>
          <button type="button" className={s.btn} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={s.btnPrimary} onClick={() => onConfirm(reason)} autoFocus>
            Move to {laneTitle.toLowerCase()}
          </button>
        </div>
      </motion.div>
    </>
  );
}
