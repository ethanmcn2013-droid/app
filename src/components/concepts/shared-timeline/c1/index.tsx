"use client";

/* The Road There: the shared timeline as a story read top to bottom,
   one chapter per milestone, with a sticky path that fills to today and
   a countdown that ends at the day. */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildStory,
  dayNum,
  fmtDay,
  fmtDM,
  fmtLong,
  fmtMonth,
  fmtWeekday,
  fmtYear,
  icsFor,
  type Audience,
  type Chapter,
  type PreviewState,
  type Story,
} from "./data";
import { Instrument, ProgressLine } from "./instrument";
import { Plate } from "./art";
import s from "./c1.module.css";

type Phase = "past" | "now" | "next" | "day";

export default function TheRoadThere() {
  const [audience, setAudience] = useState<Audience>("wedding");
  const [state, setState] = useState<PreviewState>("live");
  const story = useMemo(() => buildStory(audience, state), [audience, state]);
  const [active, setActive] = useState<string>("cover");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();

  /* Which section sits across the reading line (40% down the screen). */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-section]"),
    );
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting)
            setActive(e.target.getAttribute("data-section") ?? "cover");
      },
      { root, rootMargin: "-40% 0px -58% 0px", threshold: 0 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [story]);

  const choose = useCallback((a: Audience, st: PreviewState) => {
    setAudience(a);
    setState(st);
    setActive("cover");
    rootRef.current?.scrollTo({ top: 0 });
  }, []);

  const jump = useCallback(
    (id: string) => {
      const el = rootRef.current?.querySelector<HTMLElement>(
        `[data-section="${id}"]`,
      );
      el?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start",
      });
    },
    [reduce],
  );

  const activeChapter = story.chapters.find((c) => c.id === active);
  const phase: Phase =
    active === "day"
      ? "day"
      : active === "today"
        ? "now"
        : activeChapter && activeChapter.status !== "done"
          ? "next"
          : "past";

  return (
    <div
      ref={rootRef}
      className={s.root}
      data-audience={audience}
      data-final={phase === "day" || undefined}
      data-after={state === "after" || undefined}
    >
      <PhoneBar story={story} active={active} />
      <div className={s.layout}>
        <aside className={s.instrument} aria-label="Where the plan stands">
          <Countdown story={story} phase={phase} active={activeChapter} />
          <Instrument story={story} active={active} onJump={jump} />
        </aside>

        <main className={s.story}>
          <Cover story={story} onJump={jump} />
          {state === "dayof" ? <DayCard story={story} top /> : null}
          {story.chapters.length > 0 ? (
            <Overview story={story} active={active} onJump={jump} />
          ) : null}

          {story.chapters.map((c, i) => (
            <div key={c.id} className={s.chapterSlot}>
              {i === story.todayIndex ? <TodayDivider story={story} /> : null}
              <ChapterView chapter={c} story={story} />
            </div>
          ))}
          {story.todayIndex === story.chapters.length &&
          story.chapters.length > 0 &&
          story.daysToGo > 0 ? (
            <TodayDivider story={story} />
          ) : null}
          {state === "early" ? (
            <p className={s.promise}>
              <span className={s.promiseMark} aria-hidden="true" />
              More chapters will appear here as plans come together.
            </p>
          ) : null}
          {state === "empty" ? (
            <p className={s.emptyLine}>{story.emptyLine}</p>
          ) : null}

          {state === "dayof" ? null : <DayCard story={story} />}
          <Footer story={story} />
        </main>
      </div>
      <ConceptControls audience={audience} state={state} onChoose={choose} />
    </div>
  );
}

/* ── countdown ─────────────────────────────────────────────────────── */

function Countdown({
  story,
  phase,
  active,
}: {
  story: Story;
  phase: Phase;
  active?: Chapter;
}) {
  const reduce = useReducedMotion();
  const fade = reduce
    ? {
        initial: false as const,
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] as const },
      };
  const caption =
    story.daysToGo < 0
      ? "Looking back"
      : story.daysToGo === 0
        ? "It's happening"
        : phase === "past"
          ? "What's happened so far"
          : phase === "now"
            ? "This is where we are now"
            : phase === "next"
              ? "What's next"
              : "The day";
  const where =
    phase === "day"
      ? story.place
      : active
        ? `Chapter ${active.n} of ${story.chapters.length}: ${active.title}`
        : story.chapters.length
          ? `${story.chapters.filter((c) => c.status === "done").length} of ${story.chapters.length} chapters done`
          : "The story starts soon";

  return (
    <div className={s.count}>
      <div className={s.countCaption} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={caption} className={s.captionText} {...fade}>
            {caption}
          </motion.span>
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {phase === "day" ? (
          <motion.p key="date" className={s.countFigure} {...fade}>
            <span className={s.countBig}>{fmtDay(story.day)}</span>
            <span className={s.countUnit}>
              {fmtMonth(story.day)} {fmtYear(story.day)}
              <span className={s.countSub}>{fmtWeekday(story.day)}</span>
            </span>
          </motion.p>
        ) : story.countNumber ? (
          <motion.p key="n" className={s.countFigure} {...fade}>
            <span className={s.countBig}>{story.countNumber}</span>
            <span className={s.countUnit}>{story.countWords}</span>
          </motion.p>
        ) : (
          <motion.p key="words" className={s.countFigure} {...fade}>
            <span className={s.countWordsOnly}>{story.countWords}</span>
          </motion.p>
        )}
      </AnimatePresence>
      <div className={s.countWhere}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={where} {...fade} className={s.whereText}>
            {where}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── phone bar ─────────────────────────────────────────────────────── */

function PhoneBar({ story, active }: { story: Story; active: string }) {
  const chapter = story.chapters.find((c) => c.id === active);
  const left =
    active === "day"
      ? story.dayTitle
      : chapter
        ? `Chapter ${chapter.n} of ${story.chapters.length}`
        : story.chapters.length
          ? `${story.chapters.length} chapters`
          : "The story so far";
  const right = story.countNumber
    ? `${story.countNumber} ${story.countWords}`
    : story.countWords;
  return (
    <div className={s.phoneBar}>
      <div className={s.phoneBarRow}>
        <span className={s.phoneBarLeft}>{left}</span>
        <span className={s.phoneBarRight}>{right}</span>
      </div>
      <ProgressLine story={story} active={active} />
    </div>
  );
}

/* ── cover ─────────────────────────────────────────────────────────── */

function Cover({
  story,
  onJump,
}: {
  story: Story;
  onJump: (id: string) => void;
}) {
  const eyebrow =
    story.state === "dayof"
      ? "Today is the day"
      : story.state === "after"
        ? story.afterCover
        : story.from;
  const firstId = story.chapters[0]?.id;
  return (
    <header className={s.cover} data-section="cover">
      <div className={s.coverArt} aria-hidden="true">
        <span className={s.bloomA} />
        <span className={s.bloomB} />
        <span className={s.bloomC} />
      </div>
      <p className={s.eyebrow}>{eyebrow}</p>
      <h1 className={s.title} data-long={story.state === "long" || undefined}>
        {story.name}
      </h1>
      <p className={s.subline}>
        <span className={s.tnum}>{fmtLong(story.day)}</span>
        <span className={s.sep} aria-hidden="true" />
        {story.place}
      </p>
      <div className={s.welcome}>
        {story.state === "after" ? (
          <p>{story.afterBody}</p>
        ) : story.state === "dayof" ? (
          <p>{story.dayofBody}</p>
        ) : (
          story.welcome.map((p) => <p key={p}>{p}</p>)
        )}
        <p className={s.signoff}>{story.signoff}</p>
      </div>
      {story.state === "dayof" ? (
        <button type="button" className={s.begin} onClick={() => onJump("day")}>
          See how today runs
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M7 2v10M3 8l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : firstId ? (
        <button
          type="button"
          className={s.begin}
          onClick={() => onJump(firstId)}
        >
          {story.state === "after"
            ? "Read how it came together"
            : "Start from the beginning"}
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M7 2v10M3 8l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
    </header>
  );
}

/* ── phone overview: the path, once, as a table of contents ────────── */

function Overview({
  story,
  active,
  onJump,
}: {
  story: Story;
  active: string;
  onJump: (id: string) => void;
}) {
  const hereAtEnd =
    story.todayIndex === story.chapters.length && story.daysToGo > 0;
  return (
    <nav className={s.overview} aria-label="Chapters">
      <p className={s.overviewHead}>
        <span>The road so far</span>
        <span className={s.tnum}>
          {story.chapters.filter((c) => c.status === "done").length} of{" "}
          {story.chapters.length} done
        </span>
      </p>
      <ol className={s.overviewList}>
        {story.chapters.map((c, i) => (
          <li
            key={c.id}
            className={s.overviewItem}
            data-status={c.status}
            data-on={c.id === active || undefined}
          >
            {i === story.todayIndex ? (
              <span className={s.overviewHere}>
                <span className={s.overviewHereDot} aria-hidden="true" />
                You are here, {fmtDM(story.today)}
              </span>
            ) : null}
            <button
              type="button"
              className={s.overviewBtn}
              onClick={() => onJump(c.id)}
            >
              <span className={s.overviewDot} aria-hidden="true" />
              <span className={s.overviewDate}>{fmtDM(c.date)}</span>
              <span className={s.overviewTitle}>{c.title}</span>
            </button>
          </li>
        ))}
        <li
          className={s.overviewItem}
          data-status="day"
          data-here={hereAtEnd || undefined}
        >
          {hereAtEnd ? (
            <span className={s.overviewHere}>
              <span className={s.overviewHereDot} aria-hidden="true" />
              You are here, {fmtDM(story.today)}
            </span>
          ) : null}
          <button
            type="button"
            className={s.overviewBtn}
            onClick={() => onJump("day")}
          >
            <span className={s.overviewDot} aria-hidden="true" />
            <span className={s.overviewDate}>{fmtDM(story.day)}</span>
            <span className={s.overviewTitle}>{story.dayTitle}</span>
          </button>
        </li>
      </ol>
    </nav>
  );
}

/* ── chapter ───────────────────────────────────────────────────────── */

function ChapterView({
  chapter: c,
  story,
}: {
  chapter: Chapter;
  story: Story;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.article
      className={s.chapter}
      data-section={c.id}
      data-status={c.status}
      aria-labelledby={`ch-${c.id}`}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <p className={s.dateline}>
        <span className={s.datelineDay}>{fmtDay(c.date)}</span>
        <span className={s.datelineRest}>
          <span>{fmtMonth(c.date)}</span>
          <span className={s.datelineYear}>
            {fmtWeekday(c.date)}, {fmtYear(c.date)}
          </span>
        </span>
        <span className={s.chapterNo}>
          Chapter {c.n}
          <span className={s.chapterOf}> of {story.chapters.length}</span>
        </span>
      </p>
      <h2 id={`ch-${c.id}`} className={s.chapterTitle}>
        {c.title}
      </h2>
      <p className={s.chapterBody}>{c.body}</p>
      {c.quote ? (
        <blockquote className={s.quote}>
          <p>{c.quote.text}</p>
          <footer>{c.quote.by}</footer>
        </blockquote>
      ) : null}
      {c.people ? (
        <dl className={s.people}>
          {c.people.map((p) => (
            <div key={p.role} className={s.person}>
              <dt>{p.role}</dt>
              <dd className={s.tnum}>{p.name}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {c.art ? <Plate kind={c.art} /> : null}
      {c.forYou ? (
        <p className={s.forYou}>
          <span className={s.forYouLabel}>For you</span>
          {c.forYou}
        </p>
      ) : null}
      <p className={s.status} data-status={c.status}>
        <StatusGlyph status={c.status} />
        {c.statusLine}
      </p>
    </motion.article>
  );
}

function StatusGlyph({ status }: { status: Chapter["status"] }) {
  if (status === "done")
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={s.glyph}
      >
        <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.16" />
        <path
          d="M5 8.2l2 2 4-4.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (status === "next")
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={s.glyph}
      >
        <circle
          cx="8"
          cy="8"
          r="6.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="8" cy="8" r="2.6" fill="currentColor" />
      </svg>
    );
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={s.glyph}
    >
      <circle
        cx="8"
        cy="8"
        r="6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="2.4 2.2"
      />
    </svg>
  );
}

function TodayDivider({ story }: { story: Story }) {
  const left = story.chapters.length - story.todayIndex;
  return (
    <div
      className={s.divider}
      data-section="today"
      role="separator"
      aria-label="Today"
    >
      <span className={s.dividerRule} aria-hidden="true" />
      <span className={s.dividerPill}>
        <span className={s.dividerDot} aria-hidden="true" />
        You are here, {fmtLong(story.today)}
      </span>
      <p className={s.dividerNote}>
        {left > 0 ? (
          <>
            Still to come: <span className={s.tnum}>{left}</span>{" "}
            {left === 1 ? "chapter" : "chapters"}, then the day.
          </>
        ) : (
          <>Everything is in place. All that&rsquo;s left is the day.</>
        )}
      </p>
    </div>
  );
}

/* ── the day ───────────────────────────────────────────────────────── */

function DayCard({ story, top }: { story: Story; top?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const now = story.nowMinutes;
  const upNext =
    now === null ? -1 : story.runningOrder.findIndex((r) => r.minutes > now);

  const addToCalendar = () => {
    const blob = new Blob([icsFor(story)], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${story.calendarTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* A preview frame may block the clipboard; the confirmation still helps. */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const past = story.daysToGo < 0;
  return (
    <section
      className={s.day}
      data-section="day"
      data-top={top || undefined}
      aria-labelledby="the-day"
    >
      <p className={s.dayDateline}>
        <span className={s.tnum}>{fmtLong(story.day)}</span>
      </p>
      <h2 id="the-day" className={s.dayTitle}>
        {top ? "Today's plan" : story.dayTitle}
      </h2>
      <p className={s.dayBody}>
        {top
          ? "Here's how today runs. If anything moves, it moves here first."
          : story.dayBody}
      </p>

      <ol className={s.running} aria-label="Running order">
        {story.runningOrder.map((r, i) => {
          const isPast = now !== null && i < upNext;
          const isNext = i === upNext;
          return (
            <li
              key={r.time}
              className={s.runItem}
              data-past={isPast || undefined}
              data-next={isNext || undefined}
            >
              <span className={s.runTime}>{r.time}</span>
              <span className={s.runWhat}>
                {r.what}
                <span className={s.runWhere}>{r.where}</span>
              </span>
              {isNext ? <span className={s.runNext}>Up next</span> : null}
            </li>
          );
        })}
      </ol>

      <dl className={s.notes}>
        {story.dayNotes.map((n) => (
          <div key={n.label} className={s.note}>
            <dt>{n.label}</dt>
            <dd>{n.value}</dd>
          </div>
        ))}
      </dl>

      {past ? null : (
        <div className={s.actions}>
          {top ? null : (
            <button type="button" className={s.primary} onClick={addToCalendar}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <rect
                  x="2"
                  y="3"
                  width="12"
                  height="11"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              {saved ? "Calendar file saved" : "Add the day to your calendar"}
            </button>
          )}
          <button type="button" className={s.secondary} onClick={share}>
            {copied ? "Link copied" : "Copy the link to this page"}
          </button>
        </div>
      )}
      {top ? null : (
        <p className={s.dayCountdown}>
          {story.daysToGo > 0 ? (
            <>
              <span className={s.tnum}>{story.daysToGo}</span>{" "}
              {story.daysToGo === 1 ? "day" : "days"} from today.
            </>
          ) : story.daysToGo === 0 ? (
            "Today."
          ) : (
            story.since
          )}
        </p>
      )}
    </section>
  );
}

function Footer({ story }: { story: Story }) {
  const days = Math.max(0, dayNum(story.day) - dayNum(story.today));
  return (
    <footer className={s.footer}>
      <p className={s.updated}>
        {story.updated}
        {days > 0 ? (
          <span className={s.footerMeta}>
            This page updates itself as plans change.
          </span>
        ) : null}
      </p>
      <p className={s.made}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="6.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="8" cy="8" r="2.2" fill="currentColor" />
        </svg>
        Made with Signal Studio
      </p>
    </footer>
  );
}

/* ── concept-only controls ─────────────────────────────────────────── */

const STATES: { id: PreviewState; label: string; hint: string }[] = [
  { id: "live", label: "As it is today", hint: "25 September, mid-plan" },
  { id: "early", label: "Early days", hint: "Two chapters, a long way off" },
  { id: "dayof", label: "On the day", hint: "Running order first" },
  { id: "after", label: "Afterwards", hint: "A thank-you and a record" },
  { id: "empty", label: "Nothing yet", hint: "Just the cover and the date" },
  { id: "long", label: "A very long name", hint: "How the title wraps" },
];

function ConceptControls({
  audience,
  state,
  onChoose,
}: {
  audience: Audience;
  state: PreviewState;
  onChoose: (a: Audience, s: PreviewState) => void;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div className={s.controls} ref={panelRef}>
      <AnimatePresence>
        {open ? (
          <motion.div
            className={s.statesPanel}
            role="radiogroup"
            aria-label="Preview states"
            initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <p className={s.statesHead}>Preview states</p>
            {STATES.map((st) => (
              <button
                key={st.id}
                type="button"
                role="radio"
                aria-checked={st.id === state}
                className={s.stateBtn}
                onClick={() => {
                  onChoose(audience, st.id);
                  setOpen(false);
                }}
              >
                <span className={s.stateRadio} aria-hidden="true" />
                <span className={s.stateText}>
                  {st.label}
                  <span className={s.stateHint}>{st.hint}</span>
                </span>
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className={s.pill}>
        <span className={s.pillLabel}>See it as</span>
        <div className={s.seg} role="radiogroup" aria-label="See it as">
          {(["wedding", "launch", "class"] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={a === audience}
              className={s.segBtn}
              onClick={() => onChoose(a, state)}
            >
              {a === "wedding"
                ? "Wedding"
                : a === "launch"
                  ? "Launch"
                  : "Class"}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={s.statesBtn}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={s.statesBtnLong}>Preview states</span>
          <span className={s.statesBtnShort}>States</span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M2 6.5L5 3.5l3 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
