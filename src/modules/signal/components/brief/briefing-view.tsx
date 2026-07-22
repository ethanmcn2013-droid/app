"use client";

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { useState, useTransition } from "react";
import type { BriefItem, Briefing } from "../../lib/briefing/types";
import { ageNote, graceNote, greeting, summaryLine } from "../../lib/briefing/voice";
import {
  recordBriefingFeedback,
  type FeedbackVerdict,
} from "../../app/signal-feedback-actions";

// ─────────────────────────────────────────────────────────────
// Motion grammar · Signal Studio Motion Contract v1.
//
// These are JS-side mirrors of the CSS contract tokens. Motion/react
// does not read CSS custom properties at runtime, so we keep named
// constants here that exactly match the :root values in globals.css.
//
//   EASE_OUT    → --ease-out       arrivals
//   EASE_IN_OUT → --ease-standard  crossfades
//
// Duration budget (UI ≤ --motion-moderate = 320ms):
//   fadeUp: --motion-base   220ms  page-settle entrance
//   arrow:  --motion-fast   140ms  micro-affordance rotation
//   expand: --motion-moderate 320ms accordion open/close
//
// Reduced motion: MotionConfig reducedMotion="user" collapses
// every animation to zero, accessibility prefs win in one line.
// ─────────────────────────────────────────────────────────────
// --ease-out: cubic-bezier(0, 0, 0.2, 1); ds-allow: Motion needs a JS tuple for the established briefing arrival choreography.
const EASE_OUT = [0, 0, 0.2, 1] as const;
// --ease-standard: cubic-bezier(0.2, 0, 0, 1); ds-allow: Motion needs a JS tuple for the established briefing pulse choreography.
const EASE_STANDARD = [0.2, 0, 0, 1] as const;

const bucketAccents = {
  attention: "var(--brand)",
  risks: "var(--brand)",
} as const;

/**
 * The in-app render of the briefing. Mirrors the email's hierarchy
 * but earns its extra cost on the web, motion-led reveals, the
 * reader-cursor hover affordance, and the motion accordion for
 * "why this →" expansions (the one thing email by design omits).
 */
export function BriefingView({
  briefing,
  generatedAtLabel,
  firstName,
  scopeLabel,
  scopeKind,
}: {
  briefing: Briefing;
  generatedAtLabel: string;
  firstName?: string | null;
  scopeLabel?: string;
  scopeKind?: "workspace" | "planningPeriod";
}) {
  return (
    <MotionConfig reducedMotion="user">
      {/* Page-settle entrance: gentle stagger, not a feed pop.
          staggerChildren 0.06s × ~5 children ≤ --motion-moderate. */}
      <motion.article
        className="mx-auto w-full max-w-[640px] px-6 py-12"
        initial="hidden"
        animate="shown"
        variants={{
          shown: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
        }}
      >
        <Header stamp={generatedAtLabel} scopeLabel={scopeLabel} scopeKind={scopeKind} />

        {briefing.isEmpty ? (
          <AllClear
            greetingLine={greeting(briefing.greetingHour, firstName)}
            headline={briefing.emptyStateHeadline}
            body={briefing.emptyStateBody}
          />
        ) : (
          <>
            <motion.h1
              className="mb-3 text-[32px] font-semibold leading-[1.15] tracking-[-0.035em]"
              style={{ color: "var(--ink)" }}
              variants={fadeUp}
            >
              {greeting(briefing.greetingHour, firstName)}
            </motion.h1>

            {summaryLine(briefing) ? (
              <motion.p
                className="mb-10 text-[15.5px] leading-[1.55]"
                style={{ color: "var(--ink-soft)" }}
                variants={fadeUp}
              >
                {summaryLine(briefing)}
              </motion.p>
            ) : null}

            <Bucket
              title="Needs attention"
              items={briefing.needsAttention}
              accent={bucketAccents.attention}
            />
            {/* "Moving well" is cut from the default morning brief.
                The just-shipped trigger weight is the lowest of six
                (100/1000); the engine had already decided this is
                not the signal. The bucket data still lives on the
                Briefing object, a future "what shipped" surface
                may consume it, but the morning read does not. */}
            <Bucket
              title="Quiet risks"
              items={briefing.quietRisks}
              accent={bucketAccents.risks}
            />
            {/* "Suggested focus" is cut. The block was a sorted
                re-projection of attention + risks already on the
                page, the same items, second time on screen, under
                a different header. The Needs-attention items are
                already the focus. The suggestedFocus array stays on
                the Briefing object for the email render and future
                surfaces; the web brief does not double up. */}

            <motion.p
              className="mt-12 text-[11px] tracking-[0.14em]"
              style={{ color: "var(--ink-soft)" }}
              variants={fadeUp}
            >
              {graceNote(briefing)}
            </motion.p>
          </>
        )}
      </motion.article>
    </MotionConfig>
  );
}

// fadeUp: page-settling entrance, not a feed pop. --motion-base (220ms).
const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  shown: {
    opacity: 1,
    y: 0,
    // --motion-base 220ms + --ease-out
    transition: { duration: 0.22, ease: EASE_OUT },
  },
};

function Header({
  stamp,
  scopeLabel,
  scopeKind,
}: {
  stamp: string;
  scopeLabel?: string;
  scopeKind?: "workspace" | "planningPeriod";
}) {
  return (
    <motion.div className="mb-6" variants={fadeUp}>
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--ink-soft)" }}
      >
        Daily Signal · {stamp}
      </p>
      {scopeLabel ? (
        <p className="mt-2 text-[13px]" style={{ color: "var(--ink-soft)" }}>
          {scopeKind === "planningPeriod" ? "Planning period" : "Workspace"} · {scopeLabel}
        </p>
      ) : null}
    </motion.div>
  );
}

/**
 * One bucket. Items use a quiet reader-cursor affordance: the active row
 * gains an accent rule while every other row keeps full readable contrast.
 */
function Bucket({
  title,
  items,
  accent,
  muted,
}: {
  title: string;
  items: BriefItem[];
  accent: string;
  muted?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  if (items.length === 0) return null;

  return (
    <motion.section
      className="mb-9"
      variants={{
        shown: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
      }}
    >
      <motion.div
        className="mb-4 flex items-center gap-2.5"
        variants={fadeUp}
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: accent }}
        />
        <h2
          className="text-[13px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: muted ? "var(--ink-soft)" : "var(--ink)" }}
        >
          {title}
        </h2>
      </motion.div>

      <ul
        className="space-y-5"
        onMouseLeave={() => setActiveId(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setActiveId(null);
          }
        }}
      >
        {items.map((item) => (
          <BriefRow
            key={item.id}
            item={item}
            accent={accent}
            muted={muted}
            activeId={activeId}
            setActiveId={setActiveId}
          />
        ))}
      </ul>
    </motion.section>
  );
}

function BriefRow({
  item,
  accent,
  muted,
  activeId,
  setActiveId,
}: {
  item: BriefItem;
  accent: string;
  muted?: boolean;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = activeId === item.id;

  return (
    <motion.li
      variants={fadeUp}
      onMouseEnter={() => setActiveId(item.id)}
      onFocus={() => setActiveId(item.id)}
      className="relative pl-3"
      style={{
        borderLeft: `2px solid ${isActive ? accent : "transparent"}`,
        transition: "border-color 220ms ease",
      }}
    >
      <p
        className="text-[16px] leading-[1.5]"
        style={{ color: "var(--ink)" }}
      >
        {item.text}
      </p>
      <p
        className="mt-1 text-[12px]"
        style={{ color: "var(--ink-soft)" }}
      >
        from {item.sourceLabel}
        {item.ageDays ? ` · ${ageNote(item.trigger, item.ageDays)}` : null}
      </p>
      {item.reasons.length > 0 && !muted && (
        <WhyThisAccordion
          open={open}
          setOpen={setOpen}
          reasons={item.reasons}
        />
      )}
      {!muted && (
        <FeedbackControl itemKey={item.id} triggerId={item.trigger} />
      )}
    </motion.li>
  );
}

/**
 * Useful / not-useful, the one feedback signal the product collects
 * (PRODUCT.md §2.4). One quiet tap per item; tuning happens off the
 * aggregate. Optimistic: the tap is acknowledged immediately and the
 * write is fire-and-forget through a fail-safe server action, so the
 * reader never waits and never sees an error if the store isn't ready.
 */
function FeedbackControl({
  itemKey,
  triggerId,
}: {
  itemKey: string;
  triggerId: string;
}) {
  const [chosen, setChosen] = useState<FeedbackVerdict | null>(null);
  const [, startTransition] = useTransition();

  if (chosen) {
    return (
      <p className="mt-2 text-[11.5px]" style={{ color: "var(--ink-soft)" }}>
        {chosen === "useful" ? "Thanks, noted." : "Thanks, I'll show less of this."}
      </p>
    );
  }

  const tap = (verdict: FeedbackVerdict) => {
    setChosen(verdict);
    startTransition(() => {
      void recordBriefingFeedback(itemKey, verdict, triggerId);
    });
  };

  return (
    <div className="mt-2 flex items-center gap-3">
      <span className="text-[11.5px]" style={{ color: "var(--ink-soft)" }}>
        Useful?
      </span>
      <button
        type="button"
        onClick={() => tap("useful")}
        className="text-[11.5px] transition-colors"
        style={{ color: "var(--ink-soft)" }}
        aria-label="This was useful"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => tap("not-useful")}
        className="text-[11.5px] transition-colors"
        style={{ color: "var(--ink-soft)" }}
        aria-label="This was not useful"
      >
        Not really
      </button>
    </div>
  );
}

/**
 * Why-this gesture, replaces the browser-default <details> with
 * a motion accordion that cascades reasons in with a stagger.
 * This is the one expansion email by design omits, so the web view
 * owes it real polish.
 */
function WhyThisAccordion({
  open,
  setOpen,
  reasons,
}: {
  open: boolean;
  setOpen: (next: boolean) => void;
  reasons: string[];
}) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[12px] transition-colors"
        style={{
          color: open ? "var(--ink)" : "var(--ink-soft)",
        }}
        aria-expanded={open}
      >
        <motion.span
          className="inline-block"
          animate={{ rotate: open ? 90 : 0 }}
          // --motion-fast 140ms + --ease-out, micro-affordance
          transition={{ duration: 0.14, ease: EASE_OUT }}
        >
          →
        </motion.span>{" "}
        Why this
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            // --motion-moderate 320ms + --ease-out, accordion expand
            transition={{ duration: 0.32, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <motion.div
              className="mt-2 space-y-1.5 pl-3 text-[12.5px]"
              style={{ color: "var(--ink-soft)" }}
              initial="hidden"
              animate="shown"
              exit="hidden"
              variants={{
                shown: { transition: { staggerChildren: 0.06 } },
                hidden: {},
              }}
            >
              {reasons.map((r, i) => (
                <motion.li
                  key={i}
                  className="list-none"
                  variants={{
                    hidden: { opacity: 0, x: -4 },
                    shown: {
                      opacity: 1,
                      x: 0,
                      // --motion-base 220ms + --ease-out
                      transition: { duration: 0.22, ease: EASE_OUT },
                    },
                  }}
                >
                  → {r}
                </motion.li>
              ))}
            </motion.div>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The all-clear, a destination, not a fallback. Silence is the
 * signal: on the days when nothing fires, the product's whole job is
 * this one line, so it gets the display type, the vertical centre of
 * the viewport, and the product's own quiet gesture (the sampled
 * tick of the signal dot). No card. No border. No gray box.
 */
function AllClear({
  greetingLine,
  headline = "Nothing needs your attention right now.",
  body = "No item in this scope crossed Signal's attention rules.",
}: {
  greetingLine: string;
  headline?: string;
  body?: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <section
      aria-label="All clear"
      className="flex min-h-[62dvh] flex-col items-center justify-center text-center"
    >
      {/* The signal dot, ticks once every ~3.6s (the wordmark's
          sampled-cadence gesture). Static under reduced motion. */}
      <motion.span
        aria-hidden
        className="mb-8 inline-block h-2 w-2 rounded-full"
        style={{ background: "var(--brand)" }}
        variants={fadeUp}
        {...(reducedMotion
          ? {}
          : {
              animate: { opacity: [1, 0.3, 1] },
              transition: {
                duration: 0.32,
                ease: EASE_STANDARD,
                repeat: Infinity,
                repeatDelay: 3.28,
              },
            })}
      />

      <motion.p
        className="text-[14px] leading-[1.5]"
        style={{ color: "var(--ink-soft)" }}
        variants={fadeUp}
      >
        {greetingLine}
      </motion.p>

      <motion.h1
        className="mt-3 max-w-[16ch] text-[clamp(30px,7vw,42px)] font-semibold leading-[0.98] tracking-[-0.045em] text-balance"
        style={{ color: "var(--ink)" }}
        variants={fadeUp}
      >
        {headline}
      </motion.h1>

      <motion.p
        className="mt-5 max-w-[44ch] text-[15.5px] leading-[1.55]"
        style={{ color: "var(--ink-soft)" }}
        variants={fadeUp}
      >
        {body}
      </motion.p>

      {/* The honest mechanics, in the quiet register. One escape
          hatch, calm, not a CTA. */}
      <motion.p
        className="mt-14 font-mono text-[11px] tracking-[0.02em]"
        style={{ color: "var(--ink-soft)" }}
        variants={fadeUp}
      >
        Your next briefing builds tomorrow, 6am.{" "}
        <a
          href="/app/board"
          className="underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]"
          style={{ color: "var(--ink-soft)" }}
        >
          Open the Tasks workspace
        </a>
      </motion.p>
    </section>
  );
}

// greeting / summaryLine / graceNote moved to ../../lib/briefing/voice
// (single source of truth across email/text/web).
