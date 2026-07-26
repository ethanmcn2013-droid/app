"use client";

import Link from "next/link";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { useState } from "react";
import { openSignalLedgerEntry } from "../../app/signal-ledger-actions";
import type {
  SignalLedgerDTO,
  SignalLedgerEntry,
  SignalLedgerSection,
} from "../../lib/analytics/ledger-contract";

const EASE_OUT = [0, 0, 0.2, 1] as const;
const EASE_STANDARD = [0.2, 0, 0, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASE_OUT },
  },
};

export function QuietBriefingLedger({
  ledger,
}: {
  ledger: SignalLedgerDTO;
}) {
  const attention = ledger.entries.filter(
    (entry) => entry.section === "attention",
  );
  const risks = ledger.entries.filter((entry) => entry.section === "risks");

  return (
    <MotionConfig reducedMotion="user">
      <motion.article
        className="mx-auto w-full max-w-[960px] px-6 py-8 sm:px-8"
        initial="hidden"
        animate="shown"
        variants={{
          shown: {
            transition: { staggerChildren: 0.06, delayChildren: 0.08 },
          },
        }}
      >
        <LedgerDateline ledger={ledger} />

        {ledger.emptyState ? (
          <LedgerEmptyState ledger={ledger} />
        ) : (
          <>
            <motion.header
              className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--hairline)] pb-5"
              variants={fadeUp}
            >
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--ink-quiet)" }}
                >
                  Today&apos;s Signal
                </p>
                <h1
                  className="mt-2 max-w-[34ch] text-[21px] font-semibold leading-[1.2] tracking-[-0.02em]"
                  style={{ color: "var(--ink)" }}
                >
                  {ledger.heading}
                </h1>
              </div>
              <p
                className="font-mono text-[11px] tracking-[0.02em]"
                style={{ color: "var(--ink-quiet)" }}
              >
                {ledger.entries.length}{" "}
                {ledger.entries.length === 1 ? "signal" : "signals"} ·{" "}
                {attention.length > 0 ? "attention first" : "quiet read"}
              </p>
            </motion.header>

            {ledger.coverageNote ? (
              <motion.aside
                role="status"
                aria-live="polite"
                className="mb-8 border-y border-[color:var(--hairline-soft)] py-4 text-[13px] leading-[1.55]"
                style={{ color: "var(--ink-soft)" }}
                variants={fadeUp}
              >
                <span
                  className="mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ background: "var(--brand)" }}
                  aria-hidden
                />
                {ledger.coverageNote}
              </motion.aside>
            ) : null}

            <LedgerSection
              title="Needs attention"
              section="attention"
              entries={attention}
            />
            <LedgerSection
              title="Quiet risks"
              section="risks"
              entries={risks}
            />

            {ledger.closingLine ? (
              <motion.p
                className="mt-12 text-[11px] tracking-[0.14em]"
                style={{ color: "var(--ink-soft)" }}
                variants={fadeUp}
              >
                {ledger.closingLine}
              </motion.p>
            ) : null}
          </>
        )}
      </motion.article>
    </MotionConfig>
  );
}

function LedgerDateline({ ledger }: { ledger: SignalLedgerDTO }) {
  return (
    <motion.div className="mb-6" variants={fadeUp}>
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--ink-soft)" }}
      >
        Daily Signal · {ledger.generatedAtLabel}
      </p>
      {ledger.scopeLabel ? (
        <p
          className="mt-2 text-[13px]"
          style={{ color: "var(--ink-soft)" }}
        >
          {scopeKindLabel(ledger.scopeKind)} · {ledger.scopeLabel}
        </p>
      ) : null}
    </motion.div>
  );
}

function LedgerSection({
  title,
  section,
  entries,
}: {
  title: string;
  section: SignalLedgerSection;
  entries: SignalLedgerEntry[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  if (entries.length === 0) return null;

  return (
    <motion.section
      className="mb-8"
      aria-labelledby={`signal-ledger-${section}`}
      variants={{
        shown: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
      }}
    >
      <motion.div className="mb-2 flex items-center gap-2.5" variants={fadeUp}>
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--brand)" }}
        />
        <h2
          id={`signal-ledger-${section}`}
          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </h2>
      </motion.div>

      <ol
        className="divide-y divide-[color:var(--hairline-soft)]"
        onMouseLeave={() => setActiveId(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setActiveId(null);
          }
        }}
      >
        {entries.map((entry) => (
          <LedgerRow
            key={entry.id}
            entry={entry}
            active={activeId === entry.id}
            setActiveId={setActiveId}
          />
        ))}
      </ol>
    </motion.section>
  );
}

function LedgerRow({
  entry,
  active,
  setActiveId,
}: {
  entry: SignalLedgerEntry;
  active: boolean;
  setActiveId: (id: string | null) => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <motion.li
      variants={fadeUp}
      className="relative py-4 pl-3 first:pt-2"
      onMouseEnter={() => setActiveId(entry.id)}
      onFocus={() => setActiveId(entry.id)}
      style={{
        borderLeft: `2px solid ${active ? "var(--brand)" : "transparent"}`,
        transition: "border-color 220ms ease",
      }}
    >
      <p
        className="max-w-[72ch] text-[15px] font-medium leading-[1.45]"
        style={{ color: "var(--ink)" }}
      >
        {entry.text}
      </p>
      {entry.detail ? (
        <p
          className="mt-1.5 max-w-[72ch] text-[13.5px] leading-[1.55]"
          style={{ color: "var(--ink-soft)" }}
        >
          {entry.detail}
        </p>
      ) : null}
      <p
        className="mt-1.5 text-[11px] leading-[1.5]"
        style={{ color: "var(--ink-quiet)" }}
      >
        from {entry.receipt.sourceLabel}
        {entry.receipt.evidenceCount > 1
          ? ` · ${entry.receipt.evidenceCount} receipts`
          : ""}
        {entry.receipt.updatedAtLabel
          ? ` · updated ${entry.receipt.updatedAtLabel}`
          : ""}
        {entry.receipt.ageLabel ? ` · ${entry.receipt.ageLabel}` : ""}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        {entry.primaryAction?.href === "/app/tasks" ? (
          <form action={openSignalLedgerEntry}>
            <input type="hidden" name="entryId" value={entry.id} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center text-[12px] font-medium outline-none transition-colors hover:text-[color:var(--brand)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]"
              style={{ color: "var(--ink)" }}
            >
              {entry.primaryAction.label} <span aria-hidden>&nbsp;→</span>
            </button>
          </form>
        ) : entry.primaryAction ? (
          <Link
            href={entry.primaryAction.href}
            className="inline-flex min-h-11 items-center text-[12px] font-medium outline-none transition-colors hover:text-[color:var(--brand)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]"
            style={{ color: "var(--ink)" }}
          >
            {entry.primaryAction.label} <span aria-hidden>→</span>
          </Link>
        ) : null}
        {entry.evidenceHref ? (
          <Link
            href={entry.evidenceHref}
            scroll={false}
            className="inline-flex min-h-11 items-center text-[12px] outline-none transition-colors hover:text-[color:var(--brand)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]"
            style={{ color: "var(--ink-soft)" }}
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
    </motion.li>
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
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex min-h-11 items-center text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]"
        style={{ color: open ? "var(--ink)" : "var(--ink-soft)" }}
        aria-controls={panelId}
        aria-expanded={open}
      >
        <motion.span
          className="inline-block"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.14, ease: EASE_OUT }}
          aria-hidden
        >
          →
        </motion.span>{" "}
        Why this
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            className="basis-full overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
          >
            <ul
              className="mt-1 space-y-1.5 pl-3 text-[12.5px] leading-[1.5]"
              style={{ color: "var(--ink-soft)" }}
            >
              {reasons.map((reason) => (
                <li key={reason}>→ {reason}</li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function LedgerEmptyState({ ledger }: { ledger: SignalLedgerDTO }) {
  const reducedMotion = useReducedMotion();
  const coverageLimited = ledger.emptyState?.kind === "coverage";

  return (
    <section
      aria-label={coverageLimited ? "Signal coverage status" : "All clear"}
      className="flex min-h-[62dvh] flex-col items-center justify-center text-center"
    >
      <motion.span
        aria-hidden
        className="mb-8 inline-block h-2 w-2 rounded-full"
        style={{ background: "var(--brand)" }}
        variants={fadeUp}
        {...(reducedMotion || coverageLimited
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
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--ink-quiet)" }}
        variants={fadeUp}
      >
        {coverageLimited ? "Coverage update" : "Briefing complete"}
      </motion.p>
      <motion.h1
        className="mt-3 max-w-[18ch] text-[clamp(30px,7vw,42px)] font-semibold leading-[0.98] tracking-[-0.045em] text-balance"
        style={{ color: "var(--ink)" }}
        variants={fadeUp}
      >
        {ledger.emptyState?.headline}
      </motion.h1>
      <motion.p
        className="mt-5 max-w-[48ch] text-[15.5px] leading-[1.55]"
        style={{ color: "var(--ink-soft)" }}
        variants={fadeUp}
      >
        {ledger.emptyState?.body}
      </motion.p>
      {!coverageLimited ? (
        <motion.p
          className="mt-14 font-mono text-[11px] tracking-[0.02em]"
          style={{ color: "var(--ink-soft)" }}
          variants={fadeUp}
        >
          Signal reads this scope each time you open it.{" "}
          <Link
            href="/app/tasks"
            className="underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]"
          >
            Open Tasks
          </Link>
        </motion.p>
      ) : null}
    </section>
  );
}

function scopeKindLabel(kind: SignalLedgerDTO["scopeKind"]): string {
  if (kind === "planningPeriod") return "Planning period";
  if (kind === "project") return "Project";
  return "Workspace";
}
