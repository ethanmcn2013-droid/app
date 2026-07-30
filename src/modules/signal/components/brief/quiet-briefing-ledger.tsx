"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useFormStatus } from "react-dom";
import { useState } from "react";
import { openSignalLedgerEntry } from "../../app/signal-ledger-actions";
import type {
  SignalLedgerDTO,
  SignalLedgerEntry,
  SignalLedgerSection,
  SignalLedgerState,
} from "../../lib/analytics/ledger-contract";

/**
 * The Quiet Briefing Ledger.
 *
 * Colour grammar is ported from the Signal marketing hero (studio
 * the-read.tsx): red needs you, amber is coming, green is cleared. Pure hue
 * is spent only on marks; every piece of text takes the ink-mixed tone,
 * because raw amber on paper is 2.15:1 and fails small-text contrast.
 *
 * Mix ratios are the suite's, not invented here: 72% red matches
 * --x-task-danger and --x-timeline-alarm, 52% amber matches
 * --x-task-waiting and --x-timeline-attention, 60% green matches
 * --x-task-success. A fourth product must not invent a fifth ratio.
 *
 * The entrance is CSS on server-rendered markup, deliberately not a
 * motion/react variant. A hidden-then-revealed variant ships the whole
 * ledger at opacity zero and waits for hydration to show it, so the honest
 * skeleton hands off to a blank page for as long as hydration takes. The
 * rise animates transform only, never opacity, for the same reason: with an
 * opacity ramp the frame after the skeleton is still white.
 *
 * Two left edges, deliberately: a hang column carries marks and row rails,
 * and every piece of text sits on one text edge 16px inside it.
 */

const EASE_OUT = [0, 0, 0.2, 1] as const;

const TONES: Record<SignalLedgerState, { mark: string; ink: string }> = {
  needs_attention: {
    mark: "var(--status-blocked)",
    ink: "color-mix(in srgb, var(--status-blocked) 72%, var(--ink))",
  },
  watch: {
    mark: "var(--status-flight)",
    ink: "color-mix(in srgb, var(--status-flight) 52%, var(--ink))",
  },
};

/** The third light: everything Signal read and cleared. */
const CLEAR = {
  mark: "var(--status-done)",
  ink: "color-mix(in srgb, var(--status-done) 60%, var(--ink))",
};

const SECTION_STATE: Record<SignalLedgerSection, SignalLedgerState> = {
  attention: "needs_attention",
  risks: "watch",
};

/** Marks drawn before the pile becomes a crowd. Past this the strip is a
 *  sample and the caption stays authoritative. */
const MARK_CEILING = 24;

/** The pile at mixed amplitude, so it reads as what was taken in rather than
 *  as a bar chart. Fixed table, not arithmetic: the same read must draw the
 *  same pile on the server and on the client. */
const NOISE_HEIGHTS = [7, 10, 5, 9, 6, 11, 8, 6, 9, 7, 5, 10, 8, 6] as const;

/** Stagger position as a plain style. Indices are derived from the data, not
 *  from a counter mutated during render: a mutating closure passed across
 *  component boundaries drifts when React re-invokes a render, which shows up
 *  as a hydration mismatch on the `--i` attribute. */
const at = (index: number) => ({ "--i": index }) as React.CSSProperties;

export function QuietBriefingLedger({ ledger }: { ledger: SignalLedgerDTO }) {
  const attention = ledger.entries.filter((e) => e.section === "attention");
  const risks = ledger.entries.filter((e) => e.section === "risks");
  const coverageSlots = ledger.coverageNote ? 1 : 0;
  const attentionBase = 2 + coverageSlots;
  const risksBase =
    attentionBase + (attention.length > 0 ? attention.length + 1 : 0);
  const closeIndex = risksBase + (risks.length > 0 ? risks.length + 1 : 0);

  return (
    <article className="signal-ledger mx-auto w-full max-w-[960px] px-6 py-8 sm:px-8">
      <style>{LEDGER_CSS}</style>

      <LedgerDateline ledger={ledger} style={at(0)} />

      {ledger.emptyState ? (
        <LedgerEmptyState ledger={ledger} />
      ) : (
        <>
          {/* No `signal-header` class here. It has no rule in LEDGER_CSS, and
              its only effect is to match signal.css's .signal-header, which is
              not layered and so beats the Tailwind border utility, quietly
              downgrading this hairline to --hairline-soft. */}
          <header
            className="signal-rise mb-9 mt-4 flex flex-wrap items-baseline justify-between gap-x-10 gap-y-4 border-b border-[color:var(--hairline)] pb-6"
            style={at(1)}
          >
            <h1 className="signal-text max-w-[540px] text-[36px] font-semibold leading-[1.06] tracking-[-0.035em] text-balance">
              {ledger.heading}
            </h1>
            <Distillation ledger={ledger} />
          </header>

          {ledger.coverageNote ? (
            <aside
              role="status"
              aria-live="polite"
              className="signal-rise mb-8 flex max-w-[510px] gap-2.5 border-y border-[color:var(--hairline-soft)] py-4 text-[13px] leading-[1.55]"
              style={{ ...at(2), color: "var(--ink-soft)" }}
            >
              <Mark
                tone={
                  ledger.freshness === "unavailable"
                    ? TONES.needs_attention
                    : TONES.watch
                }
                className="mt-[7px]"
              />
              <span>{ledger.coverageNote}</span>
            </aside>
          ) : null}

          <LedgerSection
            title="Now"
            section="attention"
            entries={attention}
            base={attentionBase}
            ordinalStart={1}
            leadFirst
          />
          <LedgerSection
            title="Next"
            section="risks"
            entries={risks}
            base={risksBase}
            ordinalStart={attention.length + 1}
          />

          <LedgerClose ledger={ledger} style={at(closeIndex)} />
        </>
      )}
    </article>
  );
}

/**
 * The distillation: what Signal took in, in three weights.
 *
 * Lit marks are the entries on screen, each in its own row's tone, so the
 * graphic cannot claim three urgent items over a page showing one. Mid marks
 * are work that crossed a rule but lost its slot to the display cap; ghosts
 * are what cleared. Every weight maps to a number in the caption or the
 * close, so counting the strip and reading the numbers agree.
 */
function Distillation({ ledger }: { ledger: SignalLedgerDTO }) {
  const counts = ledger.readCounts;
  if (!counts || counts.read <= 0 || counts.read < counts.shown) {
    return (
      <p className="signal-mono" style={{ color: "var(--ink-quiet)" }}>
        {ledger.entries.length}{" "}
        {ledger.entries.length === 1 ? "signal" : "signals"}
      </p>
    );
  }

  const total = Math.min(counts.read, MARK_CEILING);
  const lit = Math.min(counts.shown, total);
  const held = Math.min(Math.max(counts.flagged - counts.shown, 0), total - lit);
  // One tone per ITEM, not per row. `lit` counts items, so cycling over rows
  // drew the wrong colour for any row that merged: a page of one attention row
  // plus one two-item risks row drew red, amber, red where the truth is red,
  // amber, amber, putting two red marks over a single Needs attention row.
  const litTones = ledger.entries.flatMap((entry) =>
    Array.from(
      { length: Math.max(1, entry.receipt.evidenceCount) },
      () => TONES[entry.state]?.mark ?? TONES.watch.mark,
    ),
  );

  return (
    <div className="signal-distill">
      <div
        className="signal-marks"
        role="img"
        aria-label={`${counts.read} items read. ${counts.flagged} crossed a rule. ${counts.shown} shown here. ${counts.cleared} cleared.`}
      >
        {Array.from({ length: total }, (_, index) => {
          const weight =
            index < lit ? "lit" : index < lit + held ? "held" : undefined;
          return (
            <i
              key={index}
              data-weight={weight}
              style={
                {
                  "--h": `${NOISE_HEIGHTS[index % NOISE_HEIGHTS.length]}px`,
                  "--lit": index < lit ? litTones[index] : undefined,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>
      <p className="signal-mono" style={{ color: "var(--ink-quiet)" }}>
        {counts.read} read · {counts.flagged} flagged · {counts.shown} shown
      </p>
    </div>
  );
}

function Mark({
  tone,
  className = "",
}: {
  tone: { mark: string; ink: string };
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`signal-mark ${className}`}
      style={
        { "--mark": tone.mark, "--mark-ink": tone.ink } as React.CSSProperties
      }
    />
  );
}

function LedgerDateline({
  ledger,
  style,
}: {
  ledger: SignalLedgerDTO;
  style: React.CSSProperties;
}) {
  return (
    <div
      className="signal-rise flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
      style={style}
    >
      <p className="signal-kicker">
        <span aria-hidden className="signal-kicker-dot" />
        Today&rsquo;s Signal
      </p>
      <p className="signal-mono" style={{ color: "var(--ink-quiet)" }}>
        {ledger.generatedAtLabel}
        {ledger.scopeLabel ? <> · {scopeLine(ledger)}</> : null}
        <FreshnessNote freshness={ledger.freshness} />
      </p>
    </div>
  );
}

/**
 * Silent when the read is current, which is the normal state. One toned
 * word when it is not; the coverage aside carries the full explanation.
 */
function FreshnessNote({
  freshness,
}: {
  freshness: SignalLedgerDTO["freshness"];
}) {
  if (freshness === "fresh") return null;
  const label =
    freshness === "stale"
      ? "older read"
      : freshness === "partial"
        ? "partial read"
        : "no read";
  const tone =
    freshness === "unavailable" ? TONES.needs_attention.ink : TONES.watch.ink;
  return <span style={{ color: tone }}> · {label}</span>;
}

function scopeLine(ledger: SignalLedgerDTO): string {
  if (!ledger.scopeLabel) return "";
  if (ledger.scopeKind === "planningPeriod") {
    return `Planning period · ${ledger.scopeLabel}`;
  }
  if (ledger.scopeKind === "project") return `Project · ${ledger.scopeLabel}`;
  return ledger.scopeLabel;
}

/** The close: the read ends on a sentence, and the third light lands here. */
function LedgerClose({
  ledger,
  style,
}: {
  ledger: SignalLedgerDTO;
  style: React.CSSProperties;
}) {
  const cleared = ledger.readCounts?.cleared ?? 0;
  if (!ledger.closingLine && cleared === 0) return null;

  return (
    <footer
      className="signal-rise mt-9 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-t border-[color:var(--hairline-soft)] pt-5"
      style={style}
    >
      {ledger.closingLine ? (
        <p
          className="signal-text max-w-[510px] text-[15px] leading-[1.5]"
          style={{ color: "var(--ink)" }}
        >
          {ledger.closingLine}
        </p>
      ) : (
        <span />
      )}
      {cleared > 0 ? (
        <p className="signal-mono inline-flex items-center gap-2">
          <Mark tone={CLEAR} />
          <span style={{ color: CLEAR.ink }}>{cleared} cleared</span>
        </p>
      ) : null}
    </footer>
  );
}

function LedgerSection({
  title,
  section,
  entries,
  base,
  ordinalStart,
  leadFirst = false,
}: {
  title: string;
  section: SignalLedgerSection;
  entries: SignalLedgerEntry[];
  base: number;
  /** Ordinals run continuously across the whole read, as the hero's do:
   *  the numbering is of the briefing, not of a section. */
  ordinalStart: number;
  leadFirst?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  if (entries.length === 0) return null;
  const tone = TONES[SECTION_STATE[section]];

  return (
    <section className="mb-9" aria-labelledby={`signal-ledger-${section}`}>
      <div className="signal-rise signal-section-head" style={at(base)}>
        <Mark tone={tone} />
        <h2 id={`signal-ledger-${section}`} style={{ color: tone.ink }}>
          {title}
        </h2>
      </div>

      <ol
        className="divide-y divide-[color:var(--hairline-soft)]"
        onMouseLeave={() => setActiveId(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setActiveId(null);
          }
        }}
      >
        {entries.map((entry, index) => (
          <LedgerRow
            key={entry.id}
            entry={entry}
            ordinal={ordinalStart + index}
            lead={leadFirst && index === 0}
            active={activeId === entry.id}
            setActiveId={setActiveId}
            style={at(base + 1 + index)}
          />
        ))}
      </ol>
    </section>
  );
}

/**
 * The row, in the hero's three columns: a rail carrying the ordinal, the body,
 * and the one action this row is asking for, anchored at the right edge.
 *
 * The rail deliberately does not repeat the claim word. In the hero the rail's
 * NOW / NEXT *is* the section, because the hero has no section headings; here
 * the headings carry it once, so the rail carries the number instead.
 */
function LedgerRow({
  entry,
  ordinal,
  lead,
  active,
  setActiveId,
  style,
}: {
  entry: SignalLedgerEntry;
  ordinal: number;
  lead: boolean;
  active: boolean;
  setActiveId: (id: string | null) => void;
  style: React.CSSProperties;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const tone = TONES[entry.state] ?? TONES.watch;

  return (
    <li
      className="signal-rise signal-row"
      data-active={active ? "" : undefined}
      data-lead={lead ? "" : undefined}
      onMouseEnter={() => setActiveId(entry.id)}
      onFocus={() => setActiveId(entry.id)}
      style={
        {
          ...style,
          "--tone-ink": tone.ink,
        } as React.CSSProperties
      }
    >
      <span className="signal-row-rail" aria-hidden>
        {String(ordinal).padStart(2, "0")}
      </span>

      <div className="signal-row-body">
        <h3 className="signal-row-title">{entry.text}</h3>
        {entry.detail ? (
          <p className="signal-row-detail">{entry.detail}</p>
        ) : null}
        <p className="signal-row-receipt">
          from {entry.receipt.sourceLabel}
          {entry.receipt.evidenceCount > 1
            ? ` · ${entry.receipt.evidenceCount} items`
            : ""}
          {entry.receipt.ageLabel ? ` · ${entry.receipt.ageLabel}` : ""}
        </p>

        <div className="signal-row-actions">
          {entry.evidenceHref ? (
            <Link
              href={entry.evidenceHref}
              scroll={false}
              className="signal-action signal-action-quiet"
            >
              Evidence
            </Link>
          ) : null}
          {entry.reasons.length > 0 ? (
            <WhyThis
              open={whyOpen}
              onToggle={() => setWhyOpen((current) => !current)}
              panelId={`signal-why-${entry.id}`}
              reasons={entry.reasons}
            />
          ) : null}
        </div>
      </div>

      <div className="signal-row-primary">
        {entry.primaryAction?.href === "/app/tasks" ? (
          // A form post, not a link, and deliberately so: the ledger DTO never
          // lets a source task id reach the URL, so the destination is rebuilt
          // server-side from an opaque entry id. That costs middle-click and
          // open-in-new-tab, which is the price of the id boundary.
          <form action={openSignalLedgerEntry}>
            <input type="hidden" name="entryId" value={entry.id} />
            <SubmitAction label={entry.primaryAction.label} />
          </form>
        ) : entry.primaryAction ? (
          <Link href={entry.primaryAction.href} className="signal-action">
            {entry.primaryAction.label}
            <span aria-hidden>&nbsp;&rarr;</span>
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The primary action is a server round-trip. `aria-disabled` rather than
 * `disabled`, because a disabled control drops keyboard focus to the body and
 * the reader loses their place; the guard below is what actually prevents the
 * second submit. The polite status is the announcement `aria-busy` on a
 * disabled button never makes.
 */
function SubmitAction({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        className="signal-action"
        aria-disabled={pending}
        data-pending={pending ? "" : undefined}
        onClick={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        {label}
        <span aria-hidden>&nbsp;&rarr;</span>
      </button>
      <span role="status" aria-live="polite" className="signal-visually-hidden">
        {pending ? "Opening in Tasks." : ""}
      </span>
    </>
  );
}

function WhyThis({
  open,
  onToggle,
  panelId,
  reasons,
}: {
  open: boolean;
  onToggle: () => void;
  panelId: string;
  reasons: string[];
}) {
  const reduceMotion = useReducedMotion();
  // Zero, not 0.08: an 80ms opacity ramp still commits the panel to full
  // height at opacity 0 on the first frame, which is the same blank-window
  // shape the entrance was fixed to remove, moved into the reduced-motion
  // branch. Reduced motion means present, not briefly invisible.
  const duration = reduceMotion ? 0 : 0.2;

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="signal-action signal-action-quiet"
        aria-controls={panelId}
        aria-expanded={open}
      >
        Why this
        <motion.span
          className="signal-chevron"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration, ease: EASE_OUT }}
          aria-hidden
        >
          &rsaquo;
        </motion.span>
      </button>
      {/* Always rendered so aria-controls resolves. Empty when closed, so it
          costs no height, and never `hidden`: hiding it in the same commit as
          the close collapsed the panel a frame before its own chevron. */}
      <div id={panelId} className="basis-full">
        <AnimatePresence initial={false}>
          {open ? (
            <motion.ul
              className="signal-reasons"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration, ease: EASE_OUT }}
            >
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}

function LedgerEmptyState({ ledger }: { ledger: SignalLedgerDTO }) {
  const coverageLimited = ledger.emptyState?.kind === "coverage";
  const tone = coverageLimited ? TONES.watch : CLEAR;

  return (
    <section
      aria-label={coverageLimited ? "Signal coverage status" : "All clear"}
      className="flex min-h-[62dvh] flex-col items-center justify-center text-center"
    >
      <span
        aria-hidden
        className={`signal-empty-mark mb-8 ${coverageLimited ? "" : "signal-tick"}`}
        style={{ "--mark": tone.mark } as React.CSSProperties}
      />
      <p
        className="signal-rise text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ "--i": 1, color: tone.ink } as React.CSSProperties}
      >
        {coverageLimited ? "Coverage update" : "Briefing complete"}
      </p>
      <h1
        className="signal-rise mt-3 max-w-[540px] text-[36px] font-semibold leading-[1.06] tracking-[-0.035em] text-balance"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        {ledger.emptyState?.headline}
      </h1>
      <p
        className="signal-rise mt-5 max-w-[510px] text-[15px] leading-[1.55]"
        style={{ "--i": 3, color: "var(--ink-soft)" } as React.CSSProperties}
      >
        {ledger.emptyState?.body}
      </p>
      {!coverageLimited ? (
        <p
          className="signal-rise signal-mono mt-14"
          style={{ "--i": 4, color: "var(--ink-soft)" } as React.CSSProperties}
        >
          Signal reads this scope each time you open it.{" "}
          <Link href="/app/tasks" className="underline underline-offset-2">
            Open Tasks
          </Link>
        </p>
      ) : null}
    </section>
  );
}

/**
 * Scoped to .signal-ledger so nothing here can reach another surface.
 *
 * The entrance runs on server-rendered markup and animates transform only:
 * with an opacity ramp the frame after the skeleton is still white, which is
 * the blank window the skeleton exists to avoid. Reduced motion is handled
 * here rather than in JS because it must hold before hydration.
 */
const LEDGER_CSS = `
.signal-ledger {
  /* Two edges: marks and rails hang at 0, all text sits at --hang. */
  --hang: 16px;
  /* The ordinal column. Two mono digits plus air, narrow enough that the
     body still holds a 60-66 character measure at 960px. */
  --rail: 34px;
}

.signal-ledger .signal-rise {
  animation: signal-rise 220ms var(--ease-out) both;
  /* Capped so the footer never lags the heading by more than ~200ms. */
  animation-delay: calc(min(var(--i, 0), 5) * 40ms);
}
@keyframes signal-rise {
  from { transform: translateY(7px); }
  to { transform: none; }
}

.signal-ledger .signal-text { padding-left: var(--hang); }

.signal-ledger .signal-mono {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
}

.signal-ledger .signal-kicker {
  display: flex;
  align-items: baseline;
  gap: 11px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.signal-ledger .signal-kicker-dot {
  width: 5px;
  height: 5px;
  flex: none;
  border-radius: 50%;
  background: var(--ink);
}

/* Marks carry pure hue; a toned edge lifts them over the 3:1 non-text floor,
   which raw amber (2.15:1) and green (2.54:1) miss on their own. */
.signal-ledger .signal-mark {
  display: inline-block;
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--mark);
  border: 1px solid var(--mark-ink, var(--mark));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mark) 14%, transparent);
}

.signal-ledger .signal-section-head {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 12px;
}
.signal-ledger .signal-section-head h2 {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* The distillation sits on the headline's two baselines. Its own breakpoint,
   not sm(640px): the header wraps at ~860px, and between the two the strip
   floated 94px in from the text it captions. */
.signal-ledger .signal-distill {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
@media (min-width: 860px) {
  .signal-ledger .signal-distill { align-items: flex-end; }
}

.signal-ledger .signal-marks {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 15px;
}
.signal-ledger .signal-marks i {
  width: 2px;
  height: var(--h);
  border-radius: 1px;
  /* Cleared: read and let go. */
  background: var(--ink-ghost);
}
/* Crossed a rule but held back by the display cap: present, not surfaced. */
.signal-ledger .signal-marks i[data-weight="held"] {
  background: var(--ink-faint);
}
/* On screen, in its own row's tone. */
.signal-ledger .signal-marks i[data-weight="lit"] {
  height: 15px;
  background: var(--lit);
}

/* The tone is present in the read, not only under a pointer. Both tiers are
   mixed from --tone-ink rather than the pure hue: a 34% pure-hue rail
   measured 1.30:1 flat, within a hair of the page's own 1.23:1 hairline. */
/* The hero's three columns: an ordinal rail, the body, and the one action this
   row is asking for anchored at the right edge. This is what lets a row use
   the canvas instead of stacking four paragraphs down the left. */
.signal-ledger .signal-row {
  position: relative;
  display: grid;
  grid-template-columns: var(--rail) minmax(0, 1fr) auto;
  column-gap: clamp(16px, 2vw, 28px);
  align-items: start;
  /* The rail is 2px of layout, so the padding gives it back: row content lands
     on the same 326 edge as the headline, the section label and the close. */
  padding: 20px 0 20px calc(var(--hang) - 2px);
  border-left: 2px solid color-mix(in srgb, var(--tone-ink) 47%, transparent);
  transition: border-color 140ms var(--ease-out);
}
.signal-ledger .signal-row:first-child { padding-top: 12px; }
.signal-ledger .signal-row[data-active] { border-left-color: var(--tone-ink); }

.signal-ledger .signal-row-rail {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  line-height: 1;
  /* Sits on the title's first baseline rather than its box top. */
  padding-top: 9px;
  /* --ink-faint, not --ink-ghost: the hero sets its ordinals in ghost, but
     ghost on paper is 1.47:1 and this is real text on a product surface, so
     axe fails it. Faint is 4.83:1 and still reads as a quiet index. */
  color: var(--ink-faint);
}
.signal-ledger .signal-row[data-lead] .signal-row-rail { padding-top: 8px; }

.signal-ledger .signal-row-primary {
  padding-top: 2px;
  white-space: nowrap;
}

/* Narrow: the rail becomes a line above the title and the action returns
   beneath the body, the way the hero collapses its own row. */
@media (max-width: 720px) {
  .signal-ledger .signal-row {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 4px;
  }
  .signal-ledger .signal-row-rail,
  .signal-ledger .signal-row[data-lead] .signal-row-rail,
  .signal-ledger .signal-row-primary {
    padding-top: 0;
  }
}

.signal-ledger .signal-row-title {
  max-width: 560px;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.02em;
  text-wrap: pretty;
  color: var(--ink);
}
.signal-ledger .signal-row[data-lead] .signal-row-title {
  font-size: 20px;
  line-height: 1.2;
  letter-spacing: -0.025em;
}
.signal-ledger .signal-row-detail {
  margin-top: 8px;
  max-width: 490px;
  font-size: 15px;
  line-height: 1.55;
  text-wrap: pretty;
  color: var(--ink-soft);
}
.signal-ledger .signal-row-receipt {
  margin-top: 8px;
  max-width: 400px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink-quiet);
}
.signal-ledger .signal-row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 20px;
  margin-top: 4px;
}

/* 44px hit area from padding, so the target is honest without the control
   setting the reading rhythm. */
.signal-ledger .signal-action {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding-block: 11px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  background: none;
  border: 0;
  cursor: pointer;
  transition: color 140ms var(--ease-out);
}
.signal-ledger .signal-action-quiet { font-weight: 400; color: var(--ink-soft); }
.signal-ledger .signal-action:hover { color: var(--tone-ink, var(--ink)); }
.signal-ledger .signal-action[data-pending] { cursor: default; opacity: 0.6; }
.signal-ledger .signal-chevron {
  display: inline-block;
  margin-left: 6px;
  font-size: 15px;
  line-height: 1;
}

/* Reason dots hang in the same column as every other mark. */
.signal-ledger .signal-reasons {
  margin: 4px 0 8px;
  max-width: 440px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ink-soft);
}
.signal-ledger .signal-reasons li {
  position: relative;
  padding-left: var(--hang);
  margin-left: calc(var(--hang) * -1);
}
.signal-ledger .signal-reasons li + li { margin-top: 7px; }
.signal-ledger .signal-reasons li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.6em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--tone-ink);
}

.signal-ledger .signal-empty-mark {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--mark);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--mark) 14%, transparent);
}

/* Signal's gesture is the tick: the dot jumps between samples, never
   between them (DESIGN.md section 5). It comes to rest after three. */
.signal-ledger .signal-tick {
  animation: signal-tick 3.6s steps(1, end) 3;
}
@keyframes signal-tick {
  0% { opacity: 1; }
  6% { opacity: 0.3; }
  12%, 100% { opacity: 1; }
}

.signal-ledger .signal-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .signal-ledger .signal-rise,
  .signal-ledger .signal-tick {
    animation: none;
  }
  .signal-ledger .signal-row,
  .signal-ledger .signal-action {
    transition: none;
  }
}
`;
