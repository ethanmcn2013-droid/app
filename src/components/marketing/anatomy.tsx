"use client";

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useInView,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SectionHeading } from "./features";

// ─────────────────────────────────────────────────────────────
// Motion grammar — every curve has a job.
// outExpo: confident exits, "settled" feel. Default reveal.
// inOut:   bidirectional crossfades, pill swaps. Neutral.
// backOut: enter with a hair of overshoot. Avatars, pills.
// snap:    spring config tuned for hover spotlight. Tactile.
// ─────────────────────────────────────────────────────────────
const EASE = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  backOut: [0.34, 1.56, 0.64, 1] as const,
};
const SPRING_SNAP = { type: "spring" as const, stiffness: 360, damping: 26 };
const SPRING_SOFT = { type: "spring" as const, stiffness: 220, damping: 24 };

type Slot =
  | "title"
  | "priority"
  | "due"
  | "idle"
  | "comments"
  | "assignee";

const ANN: { slot: Slot; label: string; note: string }[] = [
  { slot: "title", label: "Title", note: "Plain language. No jargon, no IDs." },
  {
    slot: "priority",
    label: "Priority chip",
    note: "Surfaces only when above P2. Quiet rest of the time.",
  },
  {
    slot: "due",
    label: "Due date",
    note: "Relative when near, absolute when far. Auto-formatted.",
  },
  {
    slot: "idle",
    label: "Idle indicator",
    note: "Appears at 2 days. Drives the stuck-work prompt.",
  },
  {
    slot: "comments",
    label: "Comment count",
    note: "A single click opens the thread inline. No modal.",
  },
  {
    slot: "assignee",
    label: "Assignee stack",
    note: "Live presence — pulses when the user is actively in the card.",
  },
];

type Stage = {
  live: boolean;
  presence: boolean;
  lock: boolean;
  comments: number;
  typing: boolean;
  dueHours: number;
  caption: boolean;
  // ephemeral counters — increment to fire a one-shot motion
  lockBloom: number;
  presenceRipple: number;
};

const BASE: Stage = {
  live: false,
  presence: false,
  lock: false,
  comments: 11,
  typing: false,
  dueHours: 8,
  caption: false,
  lockBloom: 0,
  presenceRipple: 0,
};

export function Anatomy() {
  const [active, setActive] = useState<Slot | null>(null);

  return (
    <MotionConfig reducedMotion="user">
      <section id="anatomy" className="mt-32 scroll-mt-24 md:mt-40">
        <div className="mx-auto w-full max-w-[1240px] px-6">
          <SectionHeading
            eyebrow="Anatomy of a card"
            title={
              <>
                Every detail{" "}
                <span className="text-ink-soft/60">earns its place.</span>
              </>
            }
          />
          <p className="mt-5 max-w-[58ch] text-[16px] leading-[1.55] text-ink-soft">
            A card holds twelve signals. Most of them are quiet — they only step
            forward when the moment calls for them. Idle days appear when work
            stalls. The lock outline shows when someone is in the card. Comments
            stream when the conversation is live.
          </p>
          <p className="mt-3 max-w-[58ch] text-[13px] text-ink-quiet">
            Watch the card live, or hover a signal — on the card or in the
            index — to see them speak to each other.
          </p>

          <div className="mt-12 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
            <DemoCard active={active} setActive={setActive} />
            <Annotations active={active} setActive={setActive} />
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}

// ─────────────────────────────────────────────────────────────
// Choreographed loop. Beats land on intent, not on the metronome.
// ─────────────────────────────────────────────────────────────
function useChoreography(active: boolean) {
  const [stage, setStage] = useState<Stage>(BASE);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, ms));

    const loop = async () => {
      while (!cancelled) {
        setStage(BASE);
        await wait(1400);
        if (cancelled) return;

        // BEAT — first comment tick (the card is "being watched")
        setStage((s) => ({ ...s, comments: 12 }));
        await wait(1900);
        if (cancelled) return;

        // BEAT — lock outline draws (someone enters)
        setStage((s) => ({ ...s, lock: true, lockBloom: s.lockBloom + 1 }));
        await wait(900);
        if (cancelled) return;

        // BEAT — EM avatar joins (secondary: DV reacts)
        setStage((s) => ({
          ...s,
          presence: true,
          presenceRipple: s.presenceRipple + 1,
        }));
        await wait(450);
        if (cancelled) return;

        // BEAT — caption types in
        setStage((s) => ({ ...s, caption: true }));
        await wait(700);
        if (cancelled) return;

        // BEAT — idle → live swap (the actual product behavior)
        setStage((s) => ({ ...s, live: true }));
        await wait(950);
        if (cancelled) return;

        // BEAT — due hours countdown, one step per beat
        for (let h = 7; h >= 5; h--) {
          setStage((s) => ({ ...s, dueHours: h }));
          await wait(850);
          if (cancelled) return;
        }

        // BEAT — typing → comment tick
        setStage((s) => ({ ...s, typing: true }));
        await wait(900);
        if (cancelled) return;
        setStage((s) => ({ ...s, typing: false, comments: 13 }));
        await wait(1400);
        if (cancelled) return;

        // BEAT — EM leaves, caption fades
        setStage((s) => ({ ...s, presence: false, caption: false }));
        await wait(450);
        if (cancelled) return;

        // BEAT — live → idle
        setStage((s) => ({ ...s, live: false }));
        await wait(500);
        if (cancelled) return;

        // BEAT — lock fades + due resets
        setStage((s) => ({ ...s, lock: false, dueHours: 8 }));
        await wait(1300);
      }
    };

    loop();
    return () => {
      cancelled = true;
    };
  }, [active]);

  return stage;
}

function spotlightAnim(slot: Slot, active: Slot | null) {
  const on = active === slot;
  const off = !!active && active !== slot;
  return {
    boxShadow: on
      ? "0 0 0 2px rgba(79,70,229,0.22), 0 8px 20px -8px rgba(79,70,229,0.45)"
      : "0 0 0 0px rgba(79,70,229,0), 0 0px 0px 0px rgba(79,70,229,0)",
    opacity: off ? 0.4 : 1,
    y: on ? -1 : 0,
  };
}

function DemoCard({
  active,
  setActive,
}: {
  active: Slot | null;
  setActive: (s: Slot | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { amount: 0.35 });
  const revealInView = useInView(wrapRef, { amount: 0.35, once: true });
  const stage = useChoreography(inView);

  const hoverProps = (s: Slot) => ({
    onMouseEnter: () => setActive(s),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(s),
    onBlur: () => setActive(null),
    tabIndex: 0,
    role: "button" as const,
    "aria-label": `Highlight ${s}`,
  });

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.085,
        delayChildren: 0.15,
      },
    },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: EASE.outExpo },
    },
  };

  return (
    <div
      ref={wrapRef}
      className="relative flex items-center justify-center rounded-3xl border border-line-soft bg-gradient-to-b from-bg-elevated to-bg-sunken/60 px-6 py-20"
      onMouseLeave={() => setActive(null)}
    >
      {/* Ambient ground glow — intensifies on focus + on "active" beats */}
      <motion.div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-3xl"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(79,70,229,0.10), transparent 60%)",
        }}
        animate={{ opacity: active || stage.lock ? 1 : 0.55 }}
        transition={{ duration: 0.7, ease: EASE.inOut }}
      />

      <motion.div
        className="relative w-[300px] rounded-[12px] border bg-white p-3.5"
        animate={{
          y: active ? -3 : stage.lock ? -1.2 : 0,
          scale: active ? 1.04 : 1,
          boxShadow: active
            ? "0 28px 58px -18px rgba(20,21,26,0.28), 0 0 0 1px rgba(20,21,26,0.05)"
            : "0 18px 44px -16px rgba(20,21,26,0.22), 0 0 0 1px rgba(20,21,26,0.04)",
        }}
        transition={SPRING_SOFT}
        style={{ transformOrigin: "center center" }}
      >
        {/* Lock outline — drawn via motion's pathLength */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0"
          width="100%"
          height="100%"
          style={{ overflow: "visible" }}
        >
          <motion.rect
            x="0.75"
            y="0.75"
            width="calc(100% - 1.5px)"
            height="calc(100% - 1.5px)"
            rx="11"
            ry="11"
            fill="none"
            stroke="rgb(79,70,229)"
            strokeWidth="1.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: stage.lock ? 1 : 0,
              opacity: stage.lock ? 1 : 0,
            }}
            transition={{
              pathLength: {
                duration: stage.lock ? 0.95 : 0.55,
                ease: stage.lock ? EASE.outExpo : EASE.inOut,
              },
              opacity: {
                duration: 0.4,
                ease: EASE.inOut,
                delay: stage.lock ? 0 : 0.2,
              },
            }}
          />
        </svg>

        {/* Lock bloom — one-shot inset flash when the outline lands */}
        <AnimatePresence>
          {stage.lock && (
            <motion.div
              key={`bloom-${stage.lockBloom}`}
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[12px]"
              initial={{ opacity: 0, boxShadow: "inset 0 0 0px rgba(79,70,229,0)" }}
              animate={{
                opacity: [0, 0.9, 0],
                boxShadow: [
                  "inset 0 0 0px rgba(79,70,229,0)",
                  "inset 0 0 22px rgba(79,70,229,0.32)",
                  "inset 0 0 0px rgba(79,70,229,0)",
                ],
              }}
              transition={{ duration: 1.2, ease: EASE.outExpo, delay: 0.85 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={revealInView ? "visible" : "hidden"}
        >
          {/* Top row — title + priority */}
          <div className="flex items-start justify-between gap-2">
            <motion.span
              {...hoverProps("title")}
              variants={itemVariants}
              animate={spotlightAnim("title", active)}
              transition={SPRING_SNAP}
              className="rounded-[5px] -mx-1 px-1 text-[14px] font-medium leading-snug text-ink outline-none cursor-pointer"
            >
              Finalise run-of-show · ceremony to reception
            </motion.span>
            <motion.span
              {...hoverProps("priority")}
              variants={itemVariants}
              animate={spotlightAnim("priority", active)}
              transition={SPRING_SNAP}
              className="rounded-md border border-red-200 bg-red-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-red-600 outline-none cursor-pointer"
            >
              P0
            </motion.span>
          </div>

          {/* Middle row — due + assignee */}
          <div className="mt-3 flex items-center justify-between">
            <motion.div
              {...hoverProps("due")}
              variants={itemVariants}
              animate={spotlightAnim("due", active)}
              transition={SPRING_SNAP}
              className="-mx-1 flex items-center gap-1.5 rounded-md px-1 outline-none cursor-pointer"
            >
              <span className="rounded-md bg-bg-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-soft">
                Tomorrow
              </span>
              <span
                className="relative inline-block tabular-nums text-[10.5px] text-ink-quiet"
                style={{ minWidth: 14 }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={stage.dueHours}
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                    transition={SPRING_SNAP}
                    className="inline-block"
                  >
                    {stage.dueHours}h
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.div>

            <motion.div
              {...hoverProps("assignee")}
              variants={itemVariants}
              animate={spotlightAnim("assignee", active)}
              transition={SPRING_SNAP}
              className="relative flex items-center rounded-full outline-none cursor-pointer"
            >
              {/* Slow ambient presence halo (only when EM is present) */}
              <motion.span
                aria-hidden
                className="pointer-events-none absolute"
                style={{
                  inset: "-4px -4px -4px auto",
                  width: 26,
                  borderRadius: 9999,
                  background:
                    "radial-gradient(closest-side, rgba(79,70,229,0.55), rgba(79,70,229,0) 70%)",
                }}
                animate={{
                  opacity: stage.presence ? [0.5, 1, 0.5] : 0,
                  scale: stage.presence ? [0.95, 1.12, 0.95] : 0.9,
                }}
                transition={{
                  duration: 2.6,
                  ease: "easeInOut",
                  repeat: stage.presence ? Infinity : 0,
                }}
              />
              {/* One-shot ripple ring on the moment EM joins */}
              <AnimatePresence>
                {stage.presence && (
                  <motion.span
                    key={`ripple-${stage.presenceRipple}`}
                    aria-hidden
                    className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 rounded-full border"
                    style={{
                      borderColor: "rgba(79,70,229,0.45)",
                      width: 20,
                      height: 20,
                      marginRight: -2,
                    }}
                    initial={{ scale: 0.8, opacity: 0.8 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.1, ease: EASE.outExpo }}
                  />
                )}
              </AnimatePresence>

              <div className="flex -space-x-1.5">
                {/* DV — gets a secondary squash when EM joins */}
                <motion.span
                  className="relative inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold uppercase text-white ring-2 ring-white"
                  style={{ background: "var(--user-david)", zIndex: 2 }}
                  animate={{
                    scale: stage.presence ? [1, 0.93, 1.04, 1] : 1,
                  }}
                  transition={{
                    duration: 0.7,
                    times: [0, 0.25, 0.6, 1],
                    ease: EASE.outExpo,
                  }}
                >
                  DV
                </motion.span>
                <AnimatePresence>
                  {stage.presence && (
                    <motion.span
                      key="em"
                      className="relative inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold uppercase text-white ring-2 ring-white"
                      style={{ background: "rgb(79,70,229)", zIndex: 1 }}
                      initial={{ opacity: 0, scale: 0.5, x: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.7, x: -4 }}
                      transition={SPRING_SNAP}
                    >
                      EM
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* Bottom row — idle/live pill + comments */}
          <div className="mt-3 flex items-center gap-2">
            <motion.div
              {...hoverProps("idle")}
              variants={itemVariants}
              animate={spotlightAnim("idle", active)}
              transition={SPRING_SNAP}
              className="relative inline-flex items-center rounded outline-none cursor-pointer"
              layout
            >
              <AnimatePresence mode="wait" initial={false}>
                {stage.live ? (
                  <motion.span
                    key="live"
                    layout
                    initial={{ opacity: 0, scale: 0.85, y: 2 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -2 }}
                    transition={{
                      duration: 0.42,
                      ease: EASE.backOut,
                    }}
                    className="inline-flex items-center gap-1 rounded border px-1.5 py-[2px] text-[10px] font-medium"
                    style={{
                      borderColor: "rgba(46, 160, 110, 0.35)",
                      background: "rgba(46, 160, 110, 0.10)",
                      color: "rgb(36, 120, 84)",
                    }}
                  >
                    <motion.span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: "rgb(46, 160, 110)" }}
                      animate={{
                        scale: [0.9, 1.2, 0.9],
                        opacity: [0.65, 1, 0.65],
                      }}
                      transition={{
                        duration: 1.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    Live
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    layout
                    initial={{ opacity: 0, scale: 0.92, y: -2 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 2 }}
                    transition={{
                      duration: 0.4,
                      ease: EASE.inOut,
                    }}
                    className="inline-flex items-center gap-1 rounded border border-amber-200/70 bg-amber-50 px-1.5 py-[2px] text-[10px] font-medium text-amber-700"
                  >
                    <motion.svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      animate={{ opacity: [0.55, 1, 0.55] }}
                      transition={{
                        duration: 2.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" strokeLinecap="round" />
                    </motion.svg>
                    Idle 4d
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              {...hoverProps("comments")}
              variants={itemVariants}
              animate={spotlightAnim("comments", active)}
              transition={SPRING_SNAP}
              className="-mx-1 inline-flex items-center gap-1 rounded px-1 text-[10.5px] text-ink-quiet outline-none cursor-pointer"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span
                className="relative inline-block tabular-nums"
                style={{ minWidth: 14 }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={stage.comments}
                    initial={{ y: 10, opacity: 0, scale: 0.85 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: -10, opacity: 0, scale: 0.85 }}
                    transition={SPRING_SNAP}
                    className="inline-block"
                    style={{
                      color:
                        stage.comments > 11 ? "var(--ink, #14151a)" : undefined,
                    }}
                  >
                    {stage.comments}
                  </motion.span>
                </AnimatePresence>
              </span>
              <AnimatePresence>
                {stage.typing && (
                  <motion.span
                    key="typing"
                    aria-hidden
                    className="ml-0.5 inline-flex items-end gap-0.5"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.22, ease: EASE.inOut }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="block h-1 w-1 rounded-full bg-ink-soft"
                        animate={{
                          y: [0, -2, 0],
                          opacity: [0.35, 1, 0.35],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.14,
                        }}
                      />
                    ))}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {/* Caption — types in letter by letter */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
        <Caption visible={stage.caption} text="Someone is in the card" />
      </div>
    </div>
  );
}

function Caption({ visible, text }: { visible: boolean; text: string }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          className="inline-flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {Array.from(text).map((ch, i) => (
            <motion.span
              key={`${ch}-${i}`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.28,
                delay: i * 0.022,
                ease: EASE.outExpo,
              }}
              style={{ display: "inline-block", whiteSpace: "pre" }}
            >
              {ch === " " ? " " : ch}
            </motion.span>
          ))}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function Annotations({
  active,
  setActive,
}: {
  active: Slot | null;
  setActive: (s: Slot | null) => void;
}) {
  return (
    <ol className="space-y-1">
      {ANN.map((a, i) => {
        const isOn = active === a.slot;
        const isOff = !!active && active !== a.slot;
        return (
          <li key={a.slot}>
            <motion.button
              type="button"
              onMouseEnter={() => setActive(a.slot)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(a.slot)}
              onBlur={() => setActive(null)}
              animate={{
                background: isOn
                  ? "rgba(79,70,229,0.05)"
                  : "rgba(79,70,229,0)",
                opacity: isOff ? 0.5 : 1,
              }}
              transition={{ duration: 0.2, ease: EASE.inOut }}
              className="group grid w-full grid-cols-[auto_1fr] items-start gap-3 rounded-xl px-3 py-3 text-left outline-none"
            >
              <motion.span
                className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold"
                animate={{
                  borderColor: isOn
                    ? "rgba(79,70,229,0.6)"
                    : "rgba(20,21,26,0.12)",
                  backgroundColor: isOn ? "rgba(79,70,229,0.95)" : "#fff",
                  color: isOn ? "#fff" : "#535560",
                  scale: isOn ? 1.06 : 1,
                }}
                transition={SPRING_SNAP}
              >
                {i + 1}
              </motion.span>
              <div>
                <div className="text-[13.5px] font-medium text-ink">
                  {a.label}
                </div>
                <div className="mt-0.5 text-[13px] leading-[1.55] text-ink-soft">
                  {a.note}
                </div>
              </div>
            </motion.button>
          </li>
        );
      })}
    </ol>
  );
}
