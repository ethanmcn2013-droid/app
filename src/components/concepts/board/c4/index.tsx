"use client";

import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { PROJECTS, STAGES, STAGE_BY_KEY, type Card, type Project, type StageKey } from "./data";
import { HISTORY_DAYS, OPEN_STAGES, ORDER, flowAt, isStuck, nextStage, usualTimes, type Placed } from "./model";
import { AgedCard, PackCard } from "./card";
import { FlowStrip, TimeMachine, type BoardHealth } from "./flow";
import { Avatar, Sparkline } from "./parts";
import { CardDrawer, JourneyPopover, Scrim, StuckTriage, Toast } from "./sheets";
import { Icon } from "./icons";
import styles from "./flow.module.css";

type ToastState = { id: number; text: string; undo?: () => void } | null;
type Hover = { id: string; rect: { x: number; y: number; top: number; w: number } } | null;

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export default function FlowAndFriction() {
  const [projectId, setProjectId] = useState("rebrand");
  const [cardsBy, setCardsBy] = useState<Record<string, Card[]>>(() => Object.fromEntries(PROJECTS.map((p) => [p.id, p.cards])));
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [stuckOnly, setStuckOnly] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const [packs, setPacks] = useState<Record<string, string[]>>({});
  const [calloutHidden, setCalloutHidden] = useState<Record<string, boolean>>({});
  const [nudged, setNudged] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [triage, setTriage] = useState(false);
  const [hover, setHover] = useState<Hover>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<StageKey | null>(null);
  const [activeStage, setActiveStage] = useState<StageKey>("todo");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [switcher, setSwitcher] = useState(false);

  const timer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Partial<Record<StageKey, HTMLElement | null>>>({});

  const project = PROJECTS.find((p) => p.id === projectId) as Project;
  const cards = cardsBy[projectId];
  const people = project.people;
  const live = day === 0;
  const isNew = project.created > -7;

  const usual = useMemo(() => usualTimes(cards), [cards]);
  const flows = useMemo(() => flowAt(cards, day), [cards, day]);
  const openPlaced = useMemo(() => OPEN_STAGES.flatMap((k) => flows[k].cards), [flows]);
  const stuck = useMemo(
    () => openPlaced.filter((p) => isStuck(p.age, usual[p.stage])).sort((a, b) => b.age - a.age),
    [openPlaced, usual],
  );
  const sparkMax = Math.max(...OPEN_STAGES.map((k) => Math.max(...flows[k].spark)), 1);

  const health: BoardHealth = useMemo(() => {
    if (isNew) return { kind: "new" };
    const pooled = (["review", "waiting", "doing", "todo"] as StageKey[]).find((k) => flows[k].pooled);
    if (pooled) return { kind: "pooled", stage: pooled };
    const oldest = Math.max(0, ...openPlaced.map((p) => p.age));
    if (stuck.length === 0 && oldest <= 3) return { kind: "healthy", oldest: Math.max(oldest, 1) };
    return { kind: "none" };
  }, [isNew, flows, openPlaced, stuck.length]);

  const pack = live ? (packs[projectId] ?? []).filter((id) => flows.review.cards.some((p) => p.card.id === id)) : [];

  /* Who the bottleneck is waiting on, for the remedy callout. */
  const bottleneck = (() => {
    if (health.kind !== "pooled" || health.stage !== "review") return null;
    const counts = new Map<string, Placed[]>();
    for (const p of flows.review.cards) if (p.card.approver) counts.set(p.card.approver, [...(counts.get(p.card.approver) ?? []), p]);
    let best: [string, Placed[]] | null = null;
    for (const entry of counts) if (!best || entry[1].length > best[1].length) best = entry;
    if (!best || best[1].length < 3) return null;
    return { approver: people.find((p) => p.id === best[0]), items: best[1] };
  })();

  /* ── Feedback ──────────────────────────────────────────────────── */

  function say(text: string, undo?: () => void) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    const id = Number(nextId("t").slice(2));
    setToast({ id, text, undo });
    toastTimer.current = window.setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 5200);
  }

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  /* ── Time machine ──────────────────────────────────────────────── */

  function stopReplay() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  }

  function togglePlay() {
    if (timer.current) return stopReplay();
    let d = day >= 0 ? -(HISTORY_DAYS - 1) : day;
    setDay(d);
    setHover(null);
    setPlaying(true);
    timer.current = window.setInterval(() => {
      d += 1;
      setDay(d);
      if (d >= 0) stopReplay();
    }, 620);
  }

  function scrubTo(d: number) {
    stopReplay();
    setHover(null);
    setDay(Math.max(-(HISTORY_DAYS - 1), Math.min(0, d)));
  }

  /* ── Changing work ─────────────────────────────────────────────── */

  function updateCards(fn: (list: Card[]) => Card[]) {
    setCardsBy((prev) => ({ ...prev, [projectId]: fn(prev[projectId]) }));
  }

  function snapshot() {
    const before = cardsBy[projectId];
    const pid = projectId;
    return () => setCardsBy((prev) => ({ ...prev, [pid]: before }));
  }

  function moveCard(id: string, to: StageKey) {
    const card = cards.find((c) => c.id === id);
    const current = openPlaced.concat(flows.done.cards).find((p) => p.card.id === id);
    if (!card || !live || (current && current.stage === to)) return;
    const restore = snapshot();
    updateCards((list) =>
      list.map((c) =>
        c.id !== id
          ? c
          : {
              ...c,
              history: [...c.history, { stage: to, day: 0 }],
              blocker: to === "waiting" ? (c.blocker ?? { who: "a reply", since: 0 }) : c.blocker,
            },
      ),
    );
    const from = current?.stage;
    const verb =
      to === "done" && from === "review"
        ? "Approved"
        : from && ORDER[to] < ORDER[from] && from !== "waiting" && to !== "waiting"
          ? `Sent back to ${STAGE_BY_KEY[to].name}`
          : `Moved to ${STAGE_BY_KEY[to].name}`;
    say(`${verb}: ${card.title}`, restore);
  }

  function nudge(p: Placed) {
    const approver = people.find((x) => x.id === p.card.approver);
    const who = p.stage === "waiting" ? p.card.blocker?.who : p.stage === "review" ? approver?.first : people.find((x) => x.id === p.card.owner)?.first;
    setNudged((s) => new Set(s).add(p.card.id));
    say(`Nudge sent to ${who ?? "them"}. We will not nudge again before Monday.`);
  }

  function split(p: Placed) {
    const restore = snapshot();
    const newId = nextId(p.card.id);
    updateCards((list) => {
      const out: Card[] = [];
      for (const c of list) {
        if (c.id !== p.card.id) {
          out.push(c);
          continue;
        }
        out.push({ ...c, title: `${c.title}, part 1` });
        out.push({ id: newId, title: `${c.title}, part 2`, owner: c.owner, approver: c.approver, history: [{ stage: "todo", day: 0 }] });
      }
      return out;
    });
    say(`Split in two. Part 2 is waiting in To do.`, restore);
  }

  function rename(id: string, title: string) {
    updateCards((list) => list.map((c) => (c.id === id ? { ...c, title } : c)));
  }

  function addTask() {
    const title = draft.trim();
    if (!title) return setComposing(false);
    const id = nextId("new");
    const owner = person ?? people[0].id;
    updateCards((list) => [...list, { id, title, owner, history: [{ stage: "todo", day: 0 }] }]);
    setDraft("");
    say(`Added to To do: ${title}`);
  }

  function makePack() {
    if (!bottleneck) return;
    const ids = bottleneck.items.map((p) => p.card.id);
    setPacks((p) => ({ ...p, [projectId]: ids }));
    setNudged((s) => {
      const n = new Set(s);
      ids.forEach((id) => n.add(id));
      return n;
    });
    say(`Sent ${ids.length} things to ${bottleneck.approver?.first ?? "them"} as one review pack.`, () => {
      setPacks((p) => ({ ...p, [projectId]: [] }));
      setNudged((s) => {
        const n = new Set(s);
        ids.forEach((id) => n.delete(id));
        return n;
      });
    });
  }

  function switchProject(id: string) {
    stopReplay();
    setProjectId(id);
    setDay(0);
    setOpenId(null);
    setSwitcher(false);
    setStuckOnly(false);
    setPerson(null);
    setHover(null);
  }

  /* ── Navigation ────────────────────────────────────────────────── */

  function jumpTo(stage: StageKey) {
    setActiveStage(stage);
    const el = columnRefs.current[stage];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest", inline: "start" });
    el?.focus({ preventScroll: true });
  }

  function onBoardScroll() {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth + 4) return;
    const first = columnRefs.current.todo;
    const w = first ? first.getBoundingClientRect().width + 12 : el.clientWidth;
    const i = Math.max(0, Math.min(STAGES.length - 1, Math.round(el.scrollLeft / w)));
    if (STAGES[i].key !== activeStage) setActiveStage(STAGES[i].key);
  }

  const onKey = useEffectEvent((e: globalThis.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (switcher) return setSwitcher(false);
      if (openId) return setOpenId(null);
      if (triage) return setTriage(false);
      if (composing) return setComposing(false);
      setHover(null);
      return;
    }
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (openId || triage) return;
    const k = e.key.toLowerCase();
    if (k === "s") setStuckOnly((v) => !v);
    else if (e.key === "[") scrubTo(day - 1);
    else if (e.key === "]") scrubTo(day + 1);
    else if (k === "t") scrubTo(0);
    else if (k === "n" && live) {
      e.preventDefault();
      setComposing(true);
    } else return;
  });

  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  function cardKey(e: KeyboardEvent<HTMLDivElement>, p: Placed) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpenId(p.card.id);
    } else if (e.shiftKey && e.key === "ArrowRight") {
      e.preventDefault();
      const n = nextStage(p.stage);
      if (n) moveCard(p.card.id, n);
    } else if (e.shiftKey && e.key === "ArrowLeft") {
      e.preventDefault();
      const i = STAGES.findIndex((s) => s.key === p.stage);
      if (i > 0) moveCard(p.card.id, STAGES[i - 1].key);
    }
  }

  /* ── Drag and drop ─────────────────────────────────────────────── */

  function onDragStart(e: DragEvent<HTMLDivElement>, id: string) {
    if (!live) return e.preventDefault();
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setHover(null);
    setDragId(id);
  }

  function onDrop(e: DragEvent<HTMLElement>, stage: StageKey) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDropStage(null);
    setDragId(null);
    if (id) moveCard(id, stage);
  }

  /* ── Derived view ──────────────────────────────────────────────── */

  const visible = (p: Placed) => (!person || p.card.owner === person) && (!stuckOnly || isStuck(p.age, usual[p.stage]));
  const openCard = openId ? cards.find((c) => c.id === openId) : null;
  const openPlacedCard = openId ? openPlaced.concat(flows.done.cards).find((p) => p.card.id === openId) ?? null : null;
  const hoverPlaced = hover ? openPlaced.find((p) => p.card.id === hover.id) : null;
  const openCount = openPlaced.length;
  const doneWeek = flows.done.cards.filter((p) => p.since > day - 7).length;
  const showCallout = live && !!bottleneck && pack.length === 0 && !calloutHidden[projectId];

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.root} data-past={!live || undefined} data-dragging={dragId ? "" : undefined}>
        <header className={styles.head}>
          <div className={styles.titleRow}>
            <h1 className={styles.h1}>Tasks</h1>
            <div className={styles.switchWrap}>
              <button
                type="button"
                className={styles.switch}
                aria-haspopup="menu"
                aria-expanded={switcher}
                onClick={() => setSwitcher((v) => !v)}
              >
                <span className={styles.projectTile} style={{ "--tone": `var(--v3-project-${project.tone})` } as CSSProperties} aria-hidden="true">
                  {project.name.replace(/^The /, "").slice(0, 1)}
                </span>
                <span className={styles.switchName}>{project.name}</span>
                <Icon.chevronDown size={14} />
              </button>
              <AnimatePresence>
                {switcher ? (
                  <>
                    <div className={styles.menuCatch} onClick={() => setSwitcher(false)} aria-hidden="true" />
                    <motion.div
                      className={styles.menu}
                      role="menu"
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.14 }}
                    >
                      {PROJECTS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={p.id === projectId}
                          className={styles.menuItem}
                          onClick={() => switchProject(p.id)}
                        >
                          <span className={styles.projectTile} style={{ "--tone": `var(--v3-project-${p.tone})` } as CSSProperties} aria-hidden="true">
                            {p.name.replace(/^The /, "").slice(0, 1)}
                          </span>
                          <span className={styles.menuText}>
                            <span className={styles.menuName}>{p.name}</span>
                            <span className={styles.menuSub}>
                              {p.team} · {p.id === "rebrand" ? "Review is filling up" : p.created > -7 ? "Started today" : "Everything is moving"}
                            </span>
                          </span>
                          {p.id === projectId ? <Icon.check size={15} /> : null}
                        </button>
                      ))}
                    </motion.div>
                  </>
                ) : null}
              </AnimatePresence>
            </div>

            <div className={styles.headActions}>
              <div className={styles.people} role="group" aria-label="Show one person's work">
                {people
                  .filter((p) => cards.some((c) => c.owner === p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={styles.personButton}
                      aria-pressed={person === p.id}
                      data-dim={(person && person !== p.id) || undefined}
                      onClick={() => setPerson((v) => (v === p.id ? null : p.id))}
                      title={`Only ${p.first}'s work`}
                    >
                      <Avatar person={p} size={26} />
                      <span className={styles.srOnly}>Only {p.first}&apos;s work</span>
                    </button>
                  ))}
              </div>
              <button
                type="button"
                className={styles.stuckChip}
                aria-pressed={stuckOnly}
                onClick={() => setStuckOnly((v) => !v)}
                disabled={stuck.length === 0 && !stuckOnly}
                title="Show only work that has sat longer than usual (S)"
              >
                <Icon.hourglass size={14} />
                Stuck
                <span className={styles.chipCount}>{stuck.length}</span>
              </button>
              {stuck.length > 0 ? (
                <button type="button" className={styles.ghostButton} onClick={() => setTriage(true)}>
                  Clear stuck work
                </button>
              ) : null}
              <button
                type="button"
                className={styles.newButton}
                onClick={() => {
                  scrubTo(0);
                  setComposing(true);
                }}
              >
                <Icon.plus size={15} />
                <span className={styles.newText}>New task</span>
              </button>
            </div>
          </div>
          <p className={styles.subline}>
            {openCount} open · {doneWeek} done this week · {project.team}
          </p>
        </header>

        {stuck.length > 0 ? (
          <div className={styles.phonePin}>
            <button type="button" className={styles.stuckPill} onClick={() => setTriage(true)}>
              <Icon.hourglass size={14} />
              Stuck · {stuck.length}
              <span className={styles.pillHint}>Oldest {stuck[0].age}d</span>
            </button>
          </div>
        ) : null}

        <section className={styles.flowBand} aria-label="Flow">
          <FlowStrip flows={flows} usual={usual} day={day} active={activeStage} health={health} onJump={jumpTo} />
          <TimeMachine day={day} playing={playing} disabled={isNew} onDay={scrubTo} onPlay={togglePlay} />
        </section>

        <LayoutGroup id={`board-${projectId}`}>
          <div className={styles.board} ref={scroller} onScroll={onBoardScroll}>
            {STAGES.map((s) => {
              const f = flows[s.key];
              const inPack = s.key === "review" ? pack : [];
              const list = f.cards.filter((p) => visible(p) && !inPack.includes(p.card.id));
              const packItems = f.cards.filter((p) => inPack.includes(p.card.id));
              const pooled = health.kind === "pooled" && health.stage === s.key;
              const stuckHere = f.cards.filter((p) => isStuck(p.age, usual[s.key])).length;
              return (
                <section
                  key={s.key}
                  ref={(el) => {
                    columnRefs.current[s.key] = el;
                  }}
                  tabIndex={-1}
                  className={styles.column}
                  data-stage={s.key}
                  data-pooled={pooled || undefined}
                  data-drop={(dragId && dropStage === s.key) || undefined}
                  aria-labelledby={`c4-col-${s.key}`}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    if (dropStage !== s.key) setDropStage(s.key);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropStage((v) => (v === s.key ? null : v));
                  }}
                  onDrop={(e) => onDrop(e, s.key)}
                >
                  <header className={styles.colHead}>
                    <div className={styles.colTitleRow}>
                      <h2 id={`c4-col-${s.key}`} className={styles.colTitle}>
                        {s.name}
                        <span className={styles.colCount}>{f.cards.length}</span>
                      </h2>
                      {isNew ? null : (
                        <Sparkline
                          values={f.spark}
                          max={s.key === "done" ? Math.max(...f.spark, 1) : sparkMax}
                          label={`${s.name} over the last 14 days: ${f.spark[0]} then, ${f.spark[f.spark.length - 1]} now`}
                        />
                      )}
                    </div>
                    {isNew ? (
                      <p className={styles.colMeta}>{s.key === "todo" ? "History builds up as work moves" : "No history yet"}</p>
                    ) : s.key === "done" ? (
                      <p className={styles.colMeta}>
                        {f.inWeek} finished this week
                      </p>
                    ) : (
                      <p className={styles.colMeta}>
                        <span>
                          +{f.inWeek} in · {f.outWeek} out
                        </span>
                        {f.outFortnight === 0 && f.cards.length > 0 && Math.max(...f.cards.map((p) => p.age)) >= 7 ? (
                          <span className={styles.colWarn}>Nothing has left in 2 weeks</span>
                        ) : pooled ? (
                          <span className={styles.colWarn}>Coming in faster than going out</span>
                        ) : stuckHere > 0 ? (
                          <span className={styles.colSoft}>{stuckHere} over usual</span>
                        ) : (
                          <span className={styles.colSoft}>usually {usual[s.key]}d here</span>
                        )}
                      </p>
                    )}
                  </header>

                  <div className={styles.stack}>
                    {s.key === "review" && showCallout && bottleneck ? (
                      <div className={styles.callout}>
                        <div className={styles.calloutHead}>
                          <Avatar person={bottleneck.approver} size={24} />
                          <p className={styles.calloutText}>
                            <strong>{bottleneck.approver?.first} has {bottleneck.items.length} things to approve.</strong> Send her a batch?
                          </p>
                        </div>
                        <p className={styles.calloutSub}>One message, one link, everything in the order it has waited.</p>
                        <div className={styles.calloutActions}>
                          <button type="button" className={styles.primaryButtonSmall} onClick={makePack}>
                            <Icon.stack size={14} />
                            Make a review pack
                          </button>
                          <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => setCalloutHidden((v) => ({ ...v, [projectId]: true }))}
                          >
                            Not now
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {packItems.length > 0 ? (
                      <PackCard
                        items={packItems}
                        approver={people.find((p) => p.id === packItems[0].card.approver)}
                        onOpen={(id) => setOpenId(id)}
                        onUnpack={() => setPacks((p) => ({ ...p, [projectId]: [] }))}
                      />
                    ) : null}

                    {list.map((p) => (
                      <AgedCard
                        key={p.card.id}
                        placed={p}
                        usual={usual[p.stage]}
                        owner={people.find((x) => x.id === p.card.owner)}
                        approver={people.find((x) => x.id === p.card.approver)}
                        day={day}
                        nudged={nudged.has(p.card.id)}
                        selected={openId === p.card.id}
                        canDrag={live}
                        fresh={!live && p.since === day}
                        onOpen={() => setOpenId(p.card.id)}
                        onRing={(el) => {
                          const r = el.getBoundingClientRect();
                          setHover({ id: p.card.id, rect: { x: r.left, y: r.bottom, top: r.top, w: r.width } });
                        }}
                        onRingLeave={() => setHover(null)}
                        onDragStart={(e) => onDragStart(e, p.card.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setDropStage(null);
                        }}
                        onKey={(e) => cardKey(e, p)}
                      />
                    ))}

                    {list.length === 0 && packItems.length === 0 ? (
                      <p className={styles.empty}>
                        {stuckOnly && f.cards.length ? "Nothing stuck here." : person && f.cards.length ? "Nothing of theirs here." : s.empty}
                      </p>
                    ) : null}

                    {s.key === "todo" && live ? (
                      composing ? (
                        <form
                          className={styles.composer}
                          onSubmit={(e) => {
                            e.preventDefault();
                            addTask();
                          }}
                        >
                          <input
                            className={styles.composerInput}
                            value={draft}
                            autoFocus
                            placeholder="What needs doing?"
                            aria-label="New task name"
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => !draft.trim() && setComposing(false)}
                          />
                          <span className={styles.composerHint}>Enter to add · Esc to close</span>
                        </form>
                      ) : (
                        <button type="button" className={styles.addButton} onClick={() => setComposing(true)}>
                          <Icon.plus size={14} />
                          Add task
                          <kbd className={styles.kbd}>N</kbd>
                        </button>
                      )
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </LayoutGroup>

        <p className={styles.keys}>
          <kbd className={styles.kbd}>[</kbd> <kbd className={styles.kbd}>]</kbd> step through days · <kbd className={styles.kbd}>S</kbd> stuck only ·{" "}
          <kbd className={styles.kbd}>Shift</kbd> + <kbd className={styles.kbd}>→</kbd> move a card on
        </p>

        <AnimatePresence>
          {hover && hoverPlaced && !dragId ? (
            <JourneyPopover key={hover.id} placed={hoverPlaced} usual={usual[hoverPlaced.stage]} day={day} rect={hover.rect} />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {openCard ? <Scrim key="scrim-d" onClose={() => setOpenId(null)} /> : null}
          {openCard ? (
            <CardDrawer
              key={`drawer-${openCard.id}-${day}`}
              card={openCard}
              placed={openPlacedCard}
              people={people}
              usual={usual}
              day={day}
              nudged={nudged.has(openCard.id)}
              onClose={() => setOpenId(null)}
              onRename={(t) => rename(openCard.id, t)}
              onMove={(to) => {
                moveCard(openCard.id, to);
                setOpenId(null);
              }}
              onNudge={() => openPlacedCard && nudge(openPlacedCard)}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {triage ? <Scrim key="scrim-t" onClose={() => setTriage(false)} /> : null}
          {triage ? (
            <StuckTriage
              key="triage"
              items={stuck}
              people={people}
              usual={usual}
              nudged={nudged}
              onClose={() => setTriage(false)}
              onNudge={nudge}
              onMoveOn={(p) => {
                const n = nextStage(p.stage);
                if (n) moveCard(p.card.id, n);
              }}
              onSplit={split}
              onOpen={(id) => {
                setTriage(false);
                setOpenId(id);
              }}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {toast ? <Toast key={toast.id} text={toast.text} onUndo={toast.undo ? () => (toast.undo?.(), setToast(null)) : undefined} onClose={() => setToast(null)} /> : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
