"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

/**
 * /lab/welcome-b — venue-branded welcome, variant B: hosted.
 *
 * The venue's identity is genuinely present at this one moment: its own
 * crest and its own colour, welcoming the couple by name, sitting next to
 * Signal Studio's without either being diminished. Clicking "Begin the
 * plan" plays the one choreographed moment this variant exists to test:
 * Glenmara House's colour, crest, and voice recede, and Signal Studio's
 * own palette and the couple's own plan take over. Review-only: no auth,
 * no data, no server actions. Fixture per brief: Glenmara House · Mara
 * and Finn · 19 September.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const VENUE_NAME = "Glenmara House";
const VENUE_INK = "#24402e";
const VENUE_CREAM = "#f6f1e3";
const VENUE_SERIF =
  "'Iowan Old Style', 'Palatino Linotype', Georgia, 'Times New Roman', serif";

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform group-hover:translate-x-0.5"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

/**
 * Glenmara House's mark: a seal ring around an interlocked G/H, drawn as
 * geometry rather than clip-art so it reads clean at both hero size and
 * credit-line size. The venue's name is always set beside it as real
 * text, so the mark itself is decorative and stays out of the a11y tree.
 */
function VenueCrest({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="1.3" />
      <circle
        cx="32"
        cy="32"
        r="22.5"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.45"
      />
      <line x1="32" y1="3.2" x2="32" y2="7.6" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <line x1="32" y1="56.4" x2="32" y2="60.8" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <line x1="32" y1="22" x2="32" y2="41" stroke="currentColor" strokeWidth="0.7" opacity="0.45" />
      <text
        x="23.5"
        y="32.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={VENUE_SERIF}
        fontSize="18"
        fill="currentColor"
      >
        G
      </text>
      <text
        x="40.5"
        y="32.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={VENUE_SERIF}
        fontSize="18"
        fill="currentColor"
      >
        H
      </text>
      <rect
        x="30.4"
        y="46.2"
        width="2.6"
        height="2.6"
        transform="rotate(45 31.7 47.5)"
        fill="currentColor"
        opacity="0.8"
      />
    </svg>
  );
}

export default function WelcomeHostedLabPage() {
  // false = Glenmara House is hosting. true = the handover has played
  // and this is the couple's own space. One-way: there is no route back
  // inside the moment, matching how the real redemption flow works.
  const [handedOver, setHandedOver] = useState(false);
  const reduceMotion = Boolean(useReducedMotion());

  const mountedRef = useRef(false);
  const ownHeadingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new heading only on the real handover, never on
  // first mount, so screen reader users get the "you're in" announcement
  // at the moment it actually happens.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (handedOver) ownHeadingRef.current?.focus();
  }, [handedOver]);

  // Parent blocks orchestrate timing only; each child owns its own
  // opacity/position via `item` below. The one exception is `recede`,
  // where the whole hosted block moves as a single unit rather than
  // unwinding item by item — a quick, decisive exit rather than a
  // lingering one.
  const hostedContainer = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.09,
        delayChildren: reduceMotion ? 0 : 0.05,
      },
    },
    recede: {
      opacity: 0,
      y: reduceMotion ? 0 : -14,
      transition: { duration: reduceMotion ? 0 : 0.5, ease: EASE },
    },
  };

  const ownContainer = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.09,
        // Let the hosted block clear most of the way before the
        // couple's own content starts arriving.
        delayChildren: reduceMotion ? 0 : 0.3,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0 : 0.55, ease: EASE },
    },
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-ink">
      {/* Environmental wash: Glenmara cream while hosted, Signal Studio
          white once the couple has begun. Every other change in the
          moment plays out on top of this one continuous surface. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        animate={{ backgroundColor: handedOver ? "#ffffff" : VENUE_CREAM }}
        transition={{ duration: reduceMotion ? 0 : 0.7, ease: EASE }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(1100px 620px at 12% -8%, ${VENUE_INK}14, transparent 60%)`,
        }}
        animate={{ opacity: handedOver ? 0 : 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.7, ease: EASE }}
      />

      <div className="relative z-10 flex min-h-screen w-full flex-col justify-center px-6 py-16 sm:px-10">
        <div className="mx-auto grid w-full max-w-[600px]">
          {/* Hosted scene: Glenmara House genuinely present. */}
          <motion.div
            className="col-start-1 row-start-1 flex flex-col gap-9 sm:gap-11"
            variants={hostedContainer}
            initial="hidden"
            animate={handedOver ? "recede" : "show"}
            inert={handedOver}
            aria-hidden={handedOver}
          >
            <motion.div
              variants={item}
              className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
            >
              <div className="flex items-center gap-3.5">
                <span style={{ color: VENUE_INK }}>
                  <VenueCrest size={52} />
                </span>
                <div>
                  <p
                    className="text-[17px] leading-tight"
                    style={{ fontFamily: VENUE_SERIF, color: VENUE_INK }}
                  >
                    {VENUE_NAME}
                  </p>
                  <p
                    className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: VENUE_INK, opacity: 0.6 }}
                  >
                    Co. Limerick
                  </p>
                </div>
              </div>
              <p className="text-[13px] font-medium tracking-[-0.01em] text-ink-faint sm:pt-1">
                Signal Studio<span className="text-accent">.</span>
              </p>
            </motion.div>

            <div className="flex flex-col gap-5">
              <motion.p
                variants={item}
                className="font-mono text-[11px] uppercase tracking-[0.16em]"
                style={{ color: VENUE_INK }}
              >
                Compliments of Glenmara House
              </motion.p>
              <motion.h1
                variants={item}
                className="h-title max-w-[16ch] text-ink outline-none"
              >
                A Signal Studio workspace for Mara and Finn.
              </motion.h1>
              <motion.p
                variants={item}
                className="max-w-[46ch] text-[17px] leading-[1.65] text-ink-soft"
              >
                Glenmara House set it up ahead of the wedding on 19
                September, so the planning has one place to live. It
                already holds the ceremony outline, the supplier list,
                and the shape of the day.
              </motion.p>
            </div>

            <motion.div variants={item}>
              <button
                type="button"
                onClick={() => setHandedOver(true)}
                className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium text-white shadow-[0_16px_40px_-16px_rgba(36,64,46,0.5)] transition-transform hover:-translate-y-px"
                style={{ backgroundColor: VENUE_INK }}
              >
                Begin the plan
                <ArrowIcon />
              </button>
            </motion.div>
          </motion.div>

          {/* Own scene: Signal Studio's, and from here, the couple's. */}
          <motion.div
            className="col-start-1 row-start-1 flex flex-col gap-9 sm:gap-11"
            variants={ownContainer}
            initial="hidden"
            animate={handedOver ? "show" : "hidden"}
            inert={!handedOver}
            aria-hidden={!handedOver}
          >
            <motion.div
              variants={item}
              className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
            >
              <p className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
                Signal Studio<span className="text-accent">.</span>
              </p>
              <div className="flex items-center gap-2.5 sm:flex-row-reverse">
                <span className="text-ink-faint">
                  <VenueCrest size={26} />
                </span>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  Compliments of Glenmara House
                </p>
              </div>
            </motion.div>

            <div className="flex flex-col gap-5">
              <motion.h1
                ref={ownHeadingRef}
                tabIndex={-1}
                variants={item}
                className="h-title max-w-[15ch] text-ink outline-none"
              >
                This is Mara and Finn&rsquo;s <span className="marker">plan</span> now.
              </motion.h1>
              <motion.p
                variants={item}
                className="max-w-[42ch] text-[17px] leading-[1.65] text-ink-soft"
              >
                Glenmara House will not see what goes in it from here.
                Start with the ceremony outline, or come back to it
                later.
              </motion.p>
            </div>

            <motion.div variants={item}>
              <Link
                href="/app/tasks?welcome=venue&v=glenmara-house"
                className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-[15px] font-medium text-white transition-transform hover:-translate-y-px"
                style={{ boxShadow: "var(--shadow-indigo)" }}
              >
                Open the plan
                <ArrowIcon />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Lab identification chip. Preview-only, not part of the product. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-full border border-line-soft bg-white/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet shadow-float backdrop-blur"
      >
        Lab B &middot; hosted
      </div>
    </main>
  );
}
