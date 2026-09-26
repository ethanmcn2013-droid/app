"use client";

/* The Dispatch. The shared timeline as a quiet run of letters from the
   people organising it: what's new, whether it's going well, and a way to
   hear about the next one without an account. Front-end only, invented
   sample data, nothing is sent anywhere. */

import { Newsreader } from "next/font/google";
import { motion, useReducedMotion } from "motion/react";
import { Fragment, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  MOMENTS,
  WORLDS,
  WORLD_ORDER,
  buildPage,
  dayNum,
  fromDayNum,
  short,
  type Iso,
  type MomentId,
  type Page,
  type WorldId,
} from "./data";
import { DispatchView, PassedLine } from "./dispatch";
import { Standing } from "./standing";
import { PhoneFollow, SubscribeCard, type Channel, type Sub } from "./subscribe";
import { EventCard, StudioMark } from "./extras";
import s from "./c5.module.css";

const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--dp-serif-font",
  display: "swap",
});

/* ── Last visit: read once per page load, remembered per story ─────── */

const LS = "signal-dispatch-c5-last:";
const prevCache = new Map<string, Iso | null>();
function readPrev(key: string): Iso | null {
  if (!prevCache.has(key)) {
    let v: Iso | null = null;
    try {
      v = (window.localStorage.getItem(LS + key) as Iso | null) ?? null;
    } catch {
      v = null;
    }
    prevCache.set(key, v);
  }
  return prevCache.get(key) ?? null;
}
function writePrev(key: string, date: Iso) {
  try {
    window.localStorage.setItem(LS + key, date);
  } catch {
    /* private window: every visit reads as the first, which is fine */
  }
}
const noSubscribe = () => () => {};

export default function SharedTimelineDispatch() {
  const [worldId, setWorldId] = useState<WorldId>("class");
  const [moment, setMoment] = useState<MomentId>("live");
  const [simReturn, setSimReturn] = useState(true);
  const [thanked, setThanked] = useState<Set<string>>(() => new Set());
  const [sub, setSub] = useState<Sub>({ status: "idle", channel: "email", value: "" });

  const page = useMemo(() => buildPage(worldId, moment), [worldId, moment]);
  const key = `${worldId}:${moment}`;

  // undefined on the server and during hydration: no marker until we know.
  const stored = useSyncExternalStore<Iso | null | undefined>(
    noSubscribe,
    () => readPrev(key),
    () => undefined,
  );
  useEffect(() => {
    writePrev(key, page.today);
  }, [key, page.today]);

  const lastSeen: Iso | null | undefined = simReturn ? fromDayNum(dayNum(page.today) - 10) : stored;

  const toggleThanks = useCallback((id: string) => {
    setThanked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onSubmit = useCallback((channel: Channel, value: string) => {
    setSub({ status: "sent", channel, value });
    window.setTimeout(() => {
      setSub((p) => (p.status === "sent" ? { ...p, status: "on" } : p));
    }, 2200);
  }, []);
  const onChange = useCallback(() => setSub((p) => ({ ...p, status: "idle" })), []);

  return (
    <div className={`${s.root} ${serif.variable}`}>
      <ConceptBar
        worldId={worldId}
        moment={moment}
        simReturn={simReturn}
        onWorld={setWorldId}
        onMoment={setMoment}
        onReturn={setSimReturn}
      />
      <div className={s.page}>
        <main className={s.main} key={key}>
          <Letters page={page} lastSeen={lastSeen} thanked={thanked} onThank={toggleThanks} />
        </main>
        <aside className={s.aside} aria-label="Follow along">
          <div className={s.asideSticky}>
            <SubscribeCard sub={sub} finished={moment === "finished"} onSubmit={onSubmit} onChange={onChange} />
            <EventCard page={page} />
          </div>
        </aside>
      </div>
      <footer className={s.footer}>
        <p className={s.footerLine}>You&rsquo;re reading a page {page.world.sharer} shared with you.</p>
        <StudioMark />
      </footer>
      <PhoneFollow sub={sub} finished={moment === "finished"} onSubmit={onSubmit} onChange={onChange} />
    </div>
  );
}

/* ── The column ────────────────────────────────────────────────────── */

function Letters({
  page,
  lastSeen,
  thanked,
  onThank,
}: {
  page: Page;
  lastSeen: Iso | null | undefined;
  thanked: Set<string>;
  onThank: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const { world, feed, today } = page;
  const seen = lastSeen ? dayNum(lastSeen) : null;
  const isFresh = (d: Iso) => seen !== null && dayNum(d) > seen;
  const freshIds = feed.filter((f) => f.kind === "dispatch" && isFresh(f.date)).map((f) => (f.kind === "dispatch" ? f.d.id : ""));
  const freshCount = freshIds.length;
  // The marker sits under the last new letter, if anything older follows.
  let markerAfter = -1;
  feed.forEach((f, i) => {
    if (f.kind === "dispatch" && isFresh(f.date)) markerAfter = i;
  });
  if (markerAfter === feed.length - 1) markerAfter = -1;

  const dateOf = (label: string) => page.marks.find((k) => k.m.label === label)?.date;
  const enter = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay: 0.05 + Math.min(i, 6) * 0.06, ease: [0.2, 0.8, 0.2, 1] as const },
        };

  return (
    <>
      {lastSeen ? (
        <motion.p className={s.welcome} {...enter(0)} role="status">
          <span className={s.welcomeDot} data-none={freshCount === 0 || undefined} aria-hidden="true" />
          {freshCount > 0 ? (
            <>
              <span>
                Welcome back. <strong>{freshCount === 1 ? "One new update" : `${freshCount} new updates`}</strong> since you
                last looked on {short(lastSeen)}.
              </span>
              <a className={s.welcomeLink} href={`#update-${freshIds[0]}`}>
                Read {freshCount === 1 ? "it" : "them"}
              </a>
            </>
          ) : (
            <span>Welcome back. Nothing new since you last looked.</span>
          )}
        </motion.p>
      ) : null}

      <header className={s.mast}>
        <motion.p className={s.kicker} {...enter(0)}>
          {world.kicker}
        </motion.p>
        <motion.h1 className={s.title} {...enter(1)}>
          {world.title}
        </motion.h1>
        <motion.p className={s.byline} {...enter(1)}>
          {world.byline}
        </motion.p>
        <motion.p className={s.status} data-tone={page.tone} {...enter(2)}>
          <span className={s.statusDot} aria-hidden="true" />
          <span>{page.status}</span>
        </motion.p>
        <motion.div {...enter(3)}>
          <Standing page={page} />
        </motion.div>
      </header>

      {page.moment === "first" ? (
        <p className={s.firstNote}>
          <svg viewBox="0 0 16 16" className={s.firstGlyph} aria-hidden="true">
            <path d="M3 4.5 h10 v7 h-10 z M3 4.5 L 8 8.5 L 13 4.5" />
          </svg>
          {world.firstIntro}
        </p>
      ) : null}

      {page.upcoming.length && page.moment !== "finished" ? (
        <motion.section className={s.row} data-kind="upcoming" aria-labelledby="dp-coming" {...enter(4)}>
          <div className={s.rail} data-upcoming>
            <span className={s.railNode} data-hollow aria-hidden="true" />
            <span className={s.railQuiet}>Ahead</span>
          </div>
          <div className={s.coming}>
            <h2 id="dp-coming" className={s.comingTitle}>
              Coming up
            </h2>
            <ol className={s.comingList}>
              {page.upcoming.map((k) => (
                <li key={k.m.id} className={s.comingItem} data-next={k.state === "next" || undefined}>
                  <span className={s.comingDate}>{short(k.date)}</span>
                  <span className={s.comingLabel}>
                    {k.m.label}
                    {k.moved ? <span className={s.comingMoved}> · new date</span> : null}
                  </span>
                  {k.state === "next" ? <span className={s.comingRel}>{relTo(today, k.date)}</span> : null}
                </li>
              ))}
            </ol>
          </div>
        </motion.section>
      ) : null}

      <h2 className={s.srOnly}>Updates, newest first</h2>
      <div className={s.feed}>
        {feed.map((f, i) => (
          <Fragment key={f.kind === "dispatch" ? f.d.id : `m-${f.m.id}`}>
            <motion.div {...enter(i + 5)}>
              {f.kind === "dispatch" ? (
                <DispatchView
                  d={f.d}
                  fresh={isFresh(f.date)}
                  thanked={thanked.has(f.d.id)}
                  onThank={() => onThank(f.d.id)}
                  dateOf={dateOf}
                  today={today}
                  first={page.moment === "first"}
                />
              ) : (
                <PassedLine m={f.m} date={f.date} />
              )}
            </motion.div>
            {i === markerAfter && lastSeen ? (
              <div className={s.row} data-kind="marker">
                <div className={s.rail} data-marker aria-hidden="true" />
                <p className={s.marker}>
                  <span className={s.markerRule} aria-hidden="true" />
                  <span className={s.markerLabel}>
                    <svg viewBox="0 0 12 12" aria-hidden="true" className={s.markerGlyph}>
                      <path d="M6 9.5 V 2.8 M3 5.6 L 6 2.6 L 9 5.6" />
                    </svg>
                    New since you last looked on {short(lastSeen)}
                  </span>
                  <span className={s.markerRule} aria-hidden="true" />
                </p>
              </div>
            ) : null}
          </Fragment>
        ))}
        <div className={s.row} data-kind="start">
          <div className={s.rail} data-start aria-hidden="true" />
          <p className={s.startLine}>
            {feed.length > 1 ? "That's every update since the start." : "More updates will appear above this one."}
          </p>
        </div>
      </div>

      <div className={s.phoneOnly}>
        <EventCard page={page} />
      </div>
    </>
  );
}

function relTo(today: Iso, d: Iso) {
  const n = dayNum(d) - dayNum(today);
  if (n <= 0) return "today";
  if (n === 1) return "tomorrow";
  if (n < 14) return `in ${n} days`;
  const w = Math.round(n / 7);
  return w < 9 ? `in ${w} weeks` : `in ${Math.round(n / 30.4)} months`;
}

/* ── Reviewer controls (concept only) ──────────────────────────────── */

function ConceptBar({
  worldId,
  moment,
  simReturn,
  onWorld,
  onMoment,
  onReturn,
}: {
  worldId: WorldId;
  moment: MomentId;
  simReturn: boolean;
  onWorld: (w: WorldId) => void;
  onMoment: (m: MomentId) => void;
  onReturn: (v: boolean) => void;
}) {
  return (
    <div className={s.concept} role="region" aria-label="Concept preview controls">
      <span className={s.conceptTag}>Concept preview</span>
      <label className={s.conceptField}>
        <span>Story</span>
        <select className={s.conceptSelect} value={worldId} onChange={(e) => onWorld(e.target.value as WorldId)}>
          {WORLD_ORDER.map((w) => (
            <option key={w} value={w}>
              {WORLDS[w].pick}
            </option>
          ))}
        </select>
      </label>
      <label className={s.conceptField}>
        <span>Moment</span>
        <select className={s.conceptSelect} value={moment} onChange={(e) => onMoment(e.target.value as MomentId)}>
          {MOMENTS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className={s.conceptToggle}>
        <input type="checkbox" className={s.conceptCheck} checked={simReturn} onChange={(e) => onReturn(e.target.checked)} />
        <span className={s.conceptSwitch} aria-hidden="true" />
        <span>Returning 10 days later</span>
      </label>
    </div>
  );
}
