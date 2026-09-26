"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent, type KeyboardEvent } from "react";
import clsx from "clsx";
import { DATE_LABEL, DESKS, MOMENTS, stateFor, type DeskState, type Moment, type Task } from "./data";
import { HAND_LIMIT, clock, dur, planDay, remaining, roughly } from "./model";
import { Avatar, DayStrip, EmptySlot, InHandCard, Kbd, OfferSlot, PickUpButton, QueueCard, type FocusState } from "./parts";
import { DonePile, RollingCount, tiltFor } from "./pile";
import { BacklogDrawer } from "./drawer";
import { EndOfDaySummary } from "./wrap";
import { IconChevronDown, IconClock, IconReceipt, IconSun, IconX } from "./icons";
import s from "./desk.module.css";

type Zone = "queue" | "hand" | "done";
type Drag = { id: string; from: Zone | "backlog" };
type Over = { zone: Zone; index: number } | null;
type Flight = { task: Task; from: DOMRect; to: DOMRect; rot: number } | null;
type Toast = { id: number; text: string; undo?: () => void } | null;
type LimitNote = { incoming: string; smallest: string } | null;

const key = (person: string, moment: Moment) => `${person}:${moment}`;

function initialStore(): Record<string, DeskState> {
  const out: Record<string, DeskState> = {};
  for (const desk of DESKS) for (const m of MOMENTS) out[key(desk.person.id, m.id)] = stateFor(desk, m.id);
  return out;
}

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export default function TodaysDesk() {
  const reduce = useReducedMotion();
  const phone = useMedia("(max-width: 760px)");
  const [personId, setPersonId] = useState(DESKS[0].person.id);
  const [moment, setMoment] = useState<Moment>("now");
  const [store, setStore] = useState(initialStore);
  const [view, setView] = useState<"desk" | "wrap">("desk");
  const [moved, setMoved] = useState<Set<string>>(new Set());
  const [closed, setClosed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [spread, setSpread] = useState(false);
  const [offer, setOffer] = useState(false);
  const [limit, setLimit] = useState<LimitNote>(null);
  const [nudge, setNudge] = useState<{ id: string; n: number }>({ id: "", n: 0 });
  const [focus, setFocus] = useState<FocusState>(null);
  const [finishing, setFinishing] = useState<string | null>(null);
  const [flight, setFlight] = useState<Flight>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<Over>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [menu, setMenu] = useState<"person" | "moment" | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const seq = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const desk = DESKS.find((d) => d.person.id === personId) ?? DESKS[0];
  const now = MOMENTS.find((m) => m.id === moment)?.clock ?? 850;
  const st = store[key(personId, moment)];
  const pj = (id: string) => desk.projects.find((p) => p.id === id);

  const plan = planDay(now, st.hand, st.queue, st.done, desk.busy);
  const planned = [...st.hand, ...st.queue].reduce((sum, t) => sum + remaining(t), 0);

  /* Focus timer: ticks once a second while running. */
  const running = focus?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setFocus((f) => (f && f.running ? (f.left <= 1 ? { ...f, left: 0, running: false } : { ...f, left: f.left - 1 }) : f));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const update = (fn: (d: DeskState) => DeskState) => setStore((all) => ({ ...all, [key(personId, moment)]: fn(all[key(personId, moment)]) }));

  const say = (text: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    seq.current += 1;
    setToast({ id: seq.current, text, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 5200);
  };

  const smallestInHand = (hand: Task[]) => [...hand].sort((a, b) => remaining(a) - remaining(b))[0];

  /* ── Actions ─────────────────────────────────────────────────────── */

  const pickUp = (id: string, index?: number) => {
    const task = st.queue.find((t) => t.id === id);
    if (!task) return;
    if (st.hand.length >= HAND_LIMIT) {
      const small = smallestInHand(st.hand);
      setLimit({ incoming: id, smallest: small.id });
      setNudge((n) => ({ id: small.id, n: n.n + 1 }));
      return;
    }
    setLimit(null);
    setOffer(false);
    update((d) => {
      const hand = [...d.hand];
      hand.splice(index ?? hand.length, 0, { ...task, reason: task.reason === "suggested" ? undefined : task.reason });
      return { ...d, queue: d.queue.filter((t) => t.id !== id), hand };
    });
  };

  const pickUpNext = () => {
    const next = st.queue[0];
    if (next) pickUp(next.id);
  };

  const putBack = (id: string, index = 0) => {
    const task = st.hand.find((t) => t.id === id);
    if (!task) return;
    if (focus?.id === id) setFocus(null);
    update((d) => {
      const queue = [...d.queue];
      queue.splice(index, 0, task);
      return { ...d, hand: d.hand.filter((t) => t.id !== id), queue };
    });
  };

  const swapForIncoming = () => {
    if (!limit) return;
    const incoming = st.queue.find((t) => t.id === limit.incoming);
    const out = st.hand.find((t) => t.id === limit.smallest);
    if (!incoming || !out) return setLimit(null);
    update((d) => ({
      ...d,
      hand: d.hand.map((t) => (t.id === out.id ? { ...incoming, reason: incoming.reason === "suggested" ? undefined : incoming.reason } : t)),
      queue: [out, ...d.queue.filter((t) => t.id !== incoming.id)],
    }));
    setLimit(null);
    say(`Put back ${out.title}`);
  };

  const commitDone = (task: Task, from: Zone) => {
    const doneTask = { ...task, doneAt: now, checklist: task.checklist?.map((i) => ({ ...i, done: true })) };
    update((d) => ({
      ...d,
      hand: from === "hand" ? d.hand : d.hand.filter((t) => t.id !== task.id),
      queue: d.queue.filter((t) => t.id !== task.id),
      done: [...d.done.filter((t) => t.id !== task.id), doneTask],
    }));
  };

  const reopen = (id: string) => {
    const task = st.done.find((t) => t.id === id);
    if (!task) return;
    const target = st.hand.length < HAND_LIMIT ? "hand" : "queue";
    update((d) => ({
      ...d,
      done: d.done.filter((t) => t.id !== id),
      [target]: target === "hand" ? [...d.hand, { ...task, doneAt: undefined }] : [{ ...task, doneAt: undefined }, ...d.queue],
    }));
    say(target === "hand" ? `${task.title} is back in hand` : `${task.title} is back at the top of Up next`);
  };

  const finish = (id: string, from: Zone = "hand") => {
    if (finishing || flight) return;
    const task = (from === "hand" ? st.hand : st.queue).find((t) => t.id === id);
    if (!task) return;
    if (focus?.id === id) setFocus(null);
    setLimit(null);
    const afterLanding = () => {
      setOffer(true);
      say(`Done: ${task.title}`, () => reopen(id));
    };

    if (from !== "hand" || reduce || phone) {
      // Reduced motion and phone: a calm fade instead of the arc.
      setFinishing(id);
      window.setTimeout(
        () => {
          setFinishing(null);
          update((d) => ({ ...d, hand: d.hand.filter((t) => t.id !== id) }));
          commitDone(task, from);
          afterLanding();
        },
        reduce ? 120 : 360,
      );
      return;
    }

    setFinishing(id);
    window.setTimeout(() => {
      const card = document.querySelector<HTMLElement>(`[data-card="${id}"]`);
      const landing = document.querySelector<HTMLElement>("[data-pile-landing]");
      setFinishing(null);
      if (!card || !landing) {
        update((d) => ({ ...d, hand: d.hand.filter((t) => t.id !== id) }));
        commitDone(task, "hand");
        afterLanding();
        return;
      }
      setFlight({ task, from: card.getBoundingClientRect(), to: landing.getBoundingClientRect(), rot: tiltFor(id).r });
      update((d) => ({ ...d, hand: d.hand.filter((t) => t.id !== id) }));
    }, 340);
  };

  const land = () => {
    if (!flight) return;
    const task = flight.task;
    commitDone(task, "hand");
    setFlight(null);
    setOffer(true);
    say(`Done: ${task.title}`, () => reopen(task.id));
  };

  const toggleItem = (taskId: string, itemId: string) =>
    update((d) => ({
      ...d,
      hand: d.hand.map((t) =>
        t.id === taskId ? { ...t, checklist: t.checklist?.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) } : t,
      ),
    }));

  const addItem = (taskId: string, text: string) =>
    update((d) => ({
      ...d,
      hand: d.hand.map((t) =>
        t.id === taskId ? { ...t, checklist: [...(t.checklist ?? []), { id: `${taskId}-${text}-${t.checklist?.length ?? 0}`, text, done: false }] } : t,
      ),
    }));

  const toggleFocus = (id: string) => {
    setFocus((f) => {
      if (f?.id === id) return f.left === 0 ? { ...f, left: f.total, running: true } : { ...f, running: !f.running };
      return { id, left: 25 * 60, total: 25 * 60, running: true };
    });
  };

  const reorderQueue = (id: string, index: number) =>
    update((d) => {
      const from = d.queue.findIndex((t) => t.id === id);
      if (from < 0) return d;
      const queue = [...d.queue];
      const [task] = queue.splice(from, 1);
      queue.splice(index > from ? index - 1 : index, 0, task);
      return { ...d, queue };
    });

  const addFromBacklog = (id: string, index?: number) => {
    const item = st.backlog.find((t) => t.id === id);
    if (!item) return;
    const task: Task = { id: item.id, title: item.title, est: item.est, project: item.project, reason: item.late ? "late" : undefined };
    update((d) => {
      const queue = [...d.queue];
      queue.splice(index ?? queue.length, 0, task);
      return { ...d, backlog: d.backlog.filter((t) => t.id !== id), queue };
    });
    setJustAdded(id);
    say(`Added ${item.title} to Up next`, () =>
      update((d) => ({ ...d, queue: d.queue.filter((t) => t.id !== id), backlog: [...d.backlog, item] })),
    );
  };

  const removeSuggestion = (id: string) => {
    const task = st.queue.find((t) => t.id === id);
    update((d) => ({ ...d, queue: d.queue.filter((t) => t.id !== id) }));
    if (task) say(`Left ${task.title} for another day`, () => update((d) => ({ ...d, queue: [...d.queue, task] })));
  };

  const acceptPlan = () => {
    update((d) => ({ ...d, suggested: false, queue: d.queue.map((t) => ({ ...t, reason: t.reason === "suggested" ? undefined : t.reason })) }));
    say("Your day is planned. Pick up the first thing when you are ready.");
  };

  const switchTo = (next: { person?: string; moment?: Moment }) => {
    rootRef.current?.scrollTo({ top: 0 });
    if (next.person) setPersonId(next.person);
    if (next.moment) setMoment(next.moment);
    setMenu(null);
    setView("desk");
    setOffer(false);
    setLimit(null);
    setFocus(null);
    setSpread(false);
    setMoved(new Set());
    setClosed(false);
  };

  /* ── Drag and drop ───────────────────────────────────────────────── */

  const startDrag = (e: DragEvent, id: string, from: Drag["from"]) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    setDrag({ id, from });
    setLimit(null);
  };
  const endDrag = () => {
    setDrag(null);
    setOver(null);
  };

  const overQueue = (e: DragEvent) => {
    if (!drag || drag.from === "done") return;
    e.preventDefault();
    const cards = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("[data-card]"));
    let index = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        index = i;
        break;
      }
    }
    if (over?.zone !== "queue" || over.index !== index) setOver({ zone: "queue", index });
  };

  const dropQueue = (e: DragEvent) => {
    e.preventDefault();
    if (!drag) return;
    const index = over?.zone === "queue" ? over.index : st.queue.length;
    if (drag.from === "queue") reorderQueue(drag.id, index);
    else if (drag.from === "hand") putBack(drag.id, index);
    else if (drag.from === "backlog") addFromBacklog(drag.id, index);
    endDrag();
  };

  const overHand = (e: DragEvent) => {
    if (!drag || drag.from === "backlog") return;
    e.preventDefault();
    if (over?.zone !== "hand") setOver({ zone: "hand", index: st.hand.length });
  };

  const dropHand = (e: DragEvent) => {
    e.preventDefault();
    if (drag?.from === "queue") pickUp(drag.id);
    endDrag();
  };

  const overDone = (e: DragEvent) => {
    if (!drag || (drag.from !== "hand" && drag.from !== "queue")) return;
    e.preventDefault();
    if (over?.zone !== "done") setOver({ zone: "done", index: 0 });
  };

  const dropDone = (e: DragEvent) => {
    e.preventDefault();
    if (drag && (drag.from === "hand" || drag.from === "queue")) {
      const task = (drag.from === "hand" ? st.hand : st.queue).find((t) => t.id === drag.id);
      if (task) {
        update((d) => ({ ...d, hand: d.hand.filter((t) => t.id !== task.id) }));
        commitDone(task, drag.from === "hand" ? "hand" : "queue");
        setOffer(true);
        say(`Done: ${task.title}`, () => reopen(task.id));
      }
    }
    endDrag();
  };

  /* ── Keyboard ────────────────────────────────────────────────────── */

  const queueKey = (e: KeyboardEvent, id: string, index: number) => {
    if (e.target !== e.currentTarget) return;
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-queue] [data-card]"));
    if (e.key === "Enter") {
      e.preventDefault();
      pickUp(id);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      if (e.altKey) {
        const to = Math.max(0, Math.min(st.queue.length, index + (dir > 0 ? 2 : -1)));
        reorderQueue(id, to);
        window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-queue] [data-card="${id}"]`)?.focus());
      } else cards[index + dir]?.focus();
    } else if (e.key === "d" || e.key === "D") {
      e.preventDefault();
      finish(id, "queue");
    }
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey) return;
      if (e.key === "Escape") {
        setMenu(null);
        setLimit(null);
        if (drawer) setDrawer(false);
        return;
      }
      if (el.closest("[data-card]")) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        pickUpNext();
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setDrawer((v) => !v);
      } else if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        setView((v) => (v === "wrap" ? "desk" : "wrap"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ── Derived ─────────────────────────────────────────────────────── */

  const next = st.queue[0];
  const showOffer = offer && !st.suggested && !!next && st.hand.length < HAND_LIMIT && !flight;
  const handFull = st.hand.length >= HAND_LIMIT;
  const slots = Math.max(0, HAND_LIMIT - st.hand.length - (showOffer ? 1 : 0) - (flight ? 1 : 0));
  const queueTime = st.queue.reduce((sum, t) => sum + t.est, 0);
  const evening = moment === "evening";
  const limitSmall = limit ? st.hand.find((t) => t.id === limit.smallest) : undefined;
  const place = desk.place;

  const subline = [
    desk.horizon,
    `${st.hand.length} in hand`,
    `${st.done.length} done today`,
  ];

  return (
    <div ref={rootRef} className={clsx(s.root, drag && s.dragging)} data-view={view}>
      <header className={s.head}>
        <div className={s.headText}>
          <p className={s.eyebrow}>
            <IconSun width={14} height={14} />
            {desk.person.first}&rsquo;s desk
          </p>
          <h1 className={s.h1}>{DATE_LABEL}</h1>
          <p className={s.subline}>
            {subline.map((part, i) => (
              <span key={i}>
                {i === 2 ? (
                  <>
                    <RollingCount value={st.done.length} /> done today
                  </>
                ) : (
                  part
                )}
              </span>
            ))}
          </p>
        </div>
        <div className={s.headTools}>
          <div className={s.menuWrap}>
            <button
              type="button"
              className={s.toolBtn}
              onClick={() => setMenu(menu === "person" ? null : "person")}
              aria-expanded={menu === "person"}
              aria-haspopup="menu"
            >
              <Avatar person={desk.person} size={22} />
              <span className={s.toolLabel}>{desk.person.name}</span>
              <IconChevronDown width={14} height={14} />
            </button>
            <AnimatePresence>
              {menu === "person" && (
                <motion.div
                  className={s.menu}
                  role="menu"
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                >
                  <p className={s.menuHead}>Switch person</p>
                  {DESKS.map((d) => (
                    <button
                      key={d.person.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={d.person.id === personId}
                      className={clsx(s.menuItem, d.person.id === personId && s.menuItemOn)}
                      onClick={() => switchTo({ person: d.person.id })}
                    >
                      <Avatar person={d.person} size={28} />
                      <span>
                        <strong>{d.person.name}</strong>
                        <em>{d.person.role}</em>
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={s.menuWrap}>
            <button
              type="button"
              className={s.toolBtn}
              onClick={() => setMenu(menu === "moment" ? null : "moment")}
              aria-expanded={menu === "moment"}
              aria-haspopup="menu"
              title="See the desk at another time of day"
            >
              <IconClock />
              <span className={s.tabular}>{clock(now)}</span>
              <IconChevronDown width={14} height={14} />
            </button>
            <AnimatePresence>
              {menu === "moment" && (
                <motion.div
                  className={s.menu}
                  role="menu"
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                >
                  <p className={s.menuHead}>See the desk at</p>
                  {MOMENTS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={m.id === moment}
                      className={clsx(s.menuItem, m.id === moment && s.menuItemOn)}
                      onClick={() => switchTo({ moment: m.id })}
                    >
                      <span className={clsx(s.menuClock, s.tabular)}>{clock(m.clock)}</span>
                      <span>
                        <strong>{m.label}</strong>
                        <em>
                          {m.id === "morning" ? "A suggested plan to accept" : m.id === "now" ? "Mid-way through the day" : "Queue cleared, ready to wrap up"}
                        </em>
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            className={clsx(evening && view === "desk" ? s.primaryBtn : s.toolBtn, view === "wrap" && s.toolOn)}
            onClick={() => setView(view === "wrap" ? "desk" : "wrap")}
            aria-pressed={view === "wrap"}
            title="Wrap up (W)"
          >
            <IconReceipt />
            <span className={s.toolLabelKeep}>{view === "wrap" ? "Back to the desk" : "Wrap up"}</span>
          </button>
        </div>
      </header>

      {menu && <button type="button" className={s.menuScrim} aria-label="Close menu" onClick={() => setMenu(null)} />}

      {view === "wrap" ? (
        <EndOfDaySummary
          person={desk.person}
          place={place}
          now={now}
          done={st.done}
          carry={[...st.hand, ...st.queue]}
          moved={moved}
          closed={closed}
          projects={desk.projects}
          onMove={(id) => setMoved((m) => new Set(m).add(id))}
          onMoveAll={() => setMoved(new Set([...st.hand, ...st.queue].map((t) => t.id)))}
          onBack={() => setView("desk")}
          onClose={() => {
            setMoved(new Set([...st.hand, ...st.queue].map((t) => t.id)));
            setClosed(true);
          }}
        />
      ) : (
        <>
          <DayStrip
            now={now}
            segments={plan.segments}
            end={plan.end}
            over={plan.over}
            free={plan.free}
            planned={planned}
            hot={hot}
            onHot={setHot}
          />

          <AnimatePresence initial={false}>
            {st.suggested && (
              <motion.div
                className={s.planBanner}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: reduce ? 0 : 0.3 }}
              >
                <div className={s.planInner}>
                  <div>
                    <p className={s.planTitle}>Here is a start for today</p>
                    <p className={s.planText}>
                      {st.queue.length} things, about {roughly(queueTime)}, picked from what is late, due today or waiting on you. Take out anything that
                      can wait, then plan your day.
                    </p>
                  </div>
                  <button type="button" className={s.primaryBtn} onClick={acceptPlan} disabled={!st.queue.length}>
                    Plan my day
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={s.desk}>
            {/* ── Up next ─────────────────────────────────────────── */}
            <section
              className={clsx(s.zone, s.queueZone, over?.zone === "queue" && s.zoneOver)}
              aria-labelledby="c3-queue"
              data-queue=""
              onDragOver={overQueue}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(null)}
              onDrop={dropQueue}
            >
              <header className={s.zoneHead}>
                <h2 id="c3-queue" className={s.zoneTitle}>
                  {st.suggested ? "Suggested for today" : "Up next"}
                </h2>
                <span className={s.zoneCount}>{st.queue.length}</span>
                {st.queue.length > 0 && <span className={s.zoneTime}>{dur(queueTime)}</span>}
              </header>
              <div className={s.queueList} role="list">
                <AnimatePresence initial={false}>
                  {st.queue.map((task, i) => (
                    <motion.div
                      key={task.id}
                      layout={!reduce}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: finishing === task.id ? 0 : 1, y: 0 }}
                      exit={{ opacity: 0, x: reduce ? 0 : 28, transition: { duration: reduce ? 0.1 : 0.22 } }}
                      transition={{ duration: reduce ? 0 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                      className={s.qWrap}
                    >
                      {over?.zone === "queue" && over.index === i && <span className={s.insert} aria-hidden />}
                      <QueueCard
                        task={task}
                        project={pj(task.project)}
                        offered={showOffer && i === 0}
                        suggested={st.suggested}
                        hot={hot === task.id}
                        dragging={drag?.id === task.id}
                        handFull={handFull}
                        onHot={setHot}
                        onPickUp={() => pickUp(task.id)}
                        onRemove={st.suggested ? () => removeSuggestion(task.id) : undefined}
                        onDragStart={(e) => startDrag(e, task.id, "queue")}
                        onDragEnd={endDrag}
                        onKeyDown={(e) => queueKey(e, task.id, i)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {over?.zone === "queue" && over.index === st.queue.length && st.queue.length > 0 && <span className={s.insert} aria-hidden />}
                {st.queue.length === 0 && (
                  <div className={s.zoneEmpty}>
                    <p className={s.emptyTitle}>{evening || st.done.length > 6 ? "Nothing left for today." : "Up next is empty."}</p>
                    <p className={s.emptyText}>
                      {evening || st.done.length > 6
                        ? "Everything else can wait for Monday."
                        : "Pull something in from everything else when you are ready."}
                    </p>
                    {(evening || st.done.length > 6) && (
                      <button type="button" className={s.softBtn} onClick={() => setView("wrap")}>
                        Wrap up the day
                      </button>
                    )}
                  </div>
                )}
              </div>
              <footer className={s.queueFoot}>
                <button type="button" className={s.linkBtn} onClick={() => setDrawer(true)}>
                  Add from everything else
                </button>
                <span className={s.keyHint}>
                  <Kbd>E</Kbd>
                </span>
              </footer>
            </section>

            {/* ── In hand ─────────────────────────────────────────── */}
            <section
              className={clsx(s.zone, s.handZone, over?.zone === "hand" && (handFull ? s.zoneFull : s.zoneOver))}
              aria-labelledby="c3-hand"
              onDragOver={overHand}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(null)}
              onDrop={dropHand}
            >
              <header className={s.zoneHead}>
                <h2 id="c3-hand" className={s.zoneTitle}>
                  In hand
                </h2>
                <span className={s.handDots} aria-label={`${st.hand.length} of ${HAND_LIMIT}`}>
                  {Array.from({ length: HAND_LIMIT }, (_, i) => (
                    <span key={i} className={clsx(s.handDot, i < st.hand.length && s.handDotOn)} />
                  ))}
                </span>
                <span className={s.zoneCountText}>
                  {st.hand.length} of {HAND_LIMIT}
                </span>
                <button type="button" className={s.pickNext} onClick={pickUpNext} disabled={!next || st.suggested} title="Pick up the top of Up next">
                  Pick up next
                  <Kbd>N</Kbd>
                </button>
              </header>

              <AnimatePresence>
                {limit && limitSmall && (
                  <motion.div
                    className={s.limitNote}
                    role="status"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: reduce ? 0 : 0.22 }}
                  >
                    <p>Three at a time keeps the day honest. Put one back?</p>
                    <div className={s.limitActions}>
                      <button type="button" className={s.ghostBtn} onClick={() => setLimit(null)}>
                        Keep these three
                      </button>
                      <button type="button" className={s.softBtn} onClick={swapForIncoming}>
                        Put back {limitSmall.title}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={s.handList}>
                <AnimatePresence initial={false} mode="popLayout">
                  {st.hand.map((task) => (
                    <motion.div
                      key={task.id}
                      layout={!reduce}
                      className={s.hWrap}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -36, scale: 0.98 }}
                      animate={{ opacity: finishing === task.id && (reduce || phone) ? 0 : 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: reduce ? 0.12 : 0.42, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <InHandCard
                        task={task}
                        project={pj(task.project)}
                        people={desk.team}
                        finishing={finishing === task.id}
                        nudge={nudge.id === task.id ? nudge.n : 0}
                        focus={focus}
                        dimmed={!!focus?.running && focus.id !== task.id}
                        hot={hot === task.id}
                        dragging={drag?.id === task.id}
                        onHot={setHot}
                        onFinish={() => finish(task.id)}
                        onPutBack={() => putBack(task.id)}
                        onToggleItem={(item) => toggleItem(task.id, item)}
                        onAddItem={(text) => addItem(task.id, text)}
                        onFocus={() => toggleFocus(task.id)}
                        onDragStart={(e) => startDrag(e, task.id, "hand")}
                        onDragEnd={endDrag}
                      />
                    </motion.div>
                  ))}
                  {flight && <div key="flight-gap" className={s.slotGhost} aria-hidden />}
                  {showOffer && next && (
                    <OfferSlot key="offer" task={next} project={pj(next.project)} onAccept={() => pickUp(next.id)} onDismiss={() => setOffer(false)} />
                  )}
                </AnimatePresence>
                {st.hand.length === 0 && !showOffer && !flight && (
                  <div className={s.free}>
                    <p className={s.freeTitle}>Your hands are free.</p>
                    <p className={s.freeText}>
                      {st.suggested
                        ? "Plan your day above, then pick up the first thing."
                        : next
                          ? "Pick up the next thing when you are ready."
                          : "Nothing waiting either. Wrap up when you like."}
                    </p>
                    {next && !st.suggested && (
                      <button type="button" className={s.primaryBtn} onClick={pickUpNext}>
                        Pick up {next.title}
                      </button>
                    )}
                  </div>
                )}
                {st.hand.length > 0 && slots > 0 && <EmptySlot count={slots} over={over?.zone === "hand"} />}
              </div>
            </section>

            {/* ── Done today ──────────────────────────────────────── */}
            <DonePile
              done={st.done}
              projects={desk.projects}
              spread={spread}
              over={over?.zone === "done"}
              onSpread={() => setSpread((v) => !v)}
              onReopen={reopen}
              onDragOver={overDone}
              onDragLeave={() => setOver(null)}
              onDrop={dropDone}
            />
          </div>

          <PickUpButton next={st.suggested ? undefined : next} handCount={st.hand.length} onClick={pickUpNext} />

          <div className={s.toastDock}>
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.id}
                className={s.toast}
                role="status"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
              >
                <span>{toast.text}</span>
                {toast.undo && (
                  <button
                    type="button"
                    className={s.toastUndo}
                    onClick={() => {
                      toast.undo?.();
                      setToast(null);
                    }}
                  >
                    Undo
                  </button>
                )}
                <button type="button" className={s.toastClose} onClick={() => setToast(null)} aria-label="Dismiss">
                  <IconX width={12} height={12} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          <BacklogDrawer
            open={drawer}
            backlog={st.backlog}
            team={desk.team}
            projects={desk.projects}
            viewer={desk.person}
            justAdded={justAdded}
            onToggle={() => setDrawer((v) => !v)}
            onAdd={(id) => addFromBacklog(id)}
            onDragStart={(e, id) => startDrag(e, id, "backlog")}
            onDragEnd={endDrag}
          />
        </>
      )}

      {/* The finished card, arcing from the hand to the pile. */}
      {flight && <FlyingCard flight={flight} now={now} onLand={land} />}
    </div>
  );
}

function FlyingCard({ flight, now, onLand }: { flight: NonNullable<Flight>; now: number; onLand: () => void }) {
  const { from, to, rot, task } = flight;
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const lift = Math.min(160, Math.abs(dx) * 0.28 + 60);
  return (
    <motion.div
      className={s.flying}
      style={{ left: from.left, top: from.top, width: from.width, height: from.height }}
      initial={{ x: 0, y: 0, rotate: 0, scale: 1 }}
      animate={{
        x: [0, dx * 0.2, dx * 0.62, dx],
        y: [0, -lift * 0.7, dy * 0.35 - lift, dy],
        width: [from.width, from.width * 0.8, to.width * 1.1, to.width],
        height: [from.height, Math.min(from.height, 140), to.height * 1.05, to.height],
        rotate: [0, -2, rot * 0.6, rot],
        boxShadow: [
          "0 2px 6px rgba(0,0,0,0.08)",
          "0 24px 48px rgba(0,0,0,0.18)",
          "0 18px 36px rgba(0,0,0,0.14)",
          "0 2px 4px rgba(0,0,0,0.08)",
        ],
      }}
      transition={{ duration: 0.78, times: [0, 0.22, 0.62, 1], ease: [0.45, 0, 0.25, 1] }}
      onAnimationComplete={onLand}
      aria-hidden
    >
      <span className={s.pileCheck}>
        <svg viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      </span>
      <span className={s.pileText}>
        <span className={s.flyingTitle}>{task.title}</span>
        <span className={s.pileMeta}>Done at {clock(now)}</span>
      </span>
    </motion.div>
  );
}
