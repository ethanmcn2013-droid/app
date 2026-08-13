import type { Metadata } from "next";
import Link from "next/link";
import {
  PROJECT_TRUTH_PROJECTS,
  PROJECT_TRUTH_SCENARIOS,
} from "@/lib/project-truth-fixture";
import { buildCatalog, catalogAgreementReport } from "@/components/lab/active-project/model";
import { LAB_STATES } from "@/components/lab/active-project/states";

/**
 * /lab/active-project — the WP5 index.
 *
 * Four explorations of the shared Active Project control, all arguing from the
 * same fixture and the same locked semantics. Review only: noindex, no auth,
 * no database, no server action, nothing wired to production.
 */
export const metadata: Metadata = {
  title: "Active Project · WP5 design lab",
  description:
    "Four explorations of the shared Active Project control. Review only, not for production.",
  robots: { index: false, follow: false },
};

const VARIANTS = [
  {
    key: "a",
    name: "Studio Bar anchor",
    line: "One control in the permanent bar, in the same place on every product.",
    note: "The recommended production direction.",
  },
  {
    key: "b",
    name: "Product canvas band",
    line: "The project belongs to the content, not the frame. Choosing one opens a room.",
    note: "Taken further than felt safe, on purpose.",
  },
  {
    key: "c",
    name: "Command-led hybrid",
    line: "A quiet receipt you never click, and Cmd or Ctrl plus K for everything else.",
    note: "The one the plan argues against, built anyway to price the refusal.",
  },
  {
    key: "w",
    name: "The deck",
    line: "Every project owns a colour and a monogram, so you recognise where you are before you read it.",
    note: "The wildcard. The register goes out the window.",
  },
] as const;

export default function ActiveProjectLabIndexPage() {
  const agreement = catalogAgreementReport();
  const full = buildCatalog("full-catalog");

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-[860px] px-6 py-16 md:py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
          WP5 · design lab
        </p>
        <h1 className="mt-5 text-[clamp(2rem,1.5rem+2.4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
          Choosing the Active Project control
        </h1>
        <p className="mt-6 max-w-[58ch] text-[17px] leading-[1.6] text-ink-soft">
          Four explorations of the one control that says which project you are
          in and lets you change it. They share a catalog, a guarded switch and
          a set of keyboard rules, so what differs is composition and feel.
        </p>

        {/* ── The four ─────────────────────────────────────────────── */}
        <ul className="mt-12 divide-y divide-[color:var(--hairline-soft)] border-y border-hairline">
          {VARIANTS.map((variant) => (
            <li key={variant.key}>
              <Link
                href={`/lab/active-project-${variant.key}`}
                className="group flex flex-col gap-2 py-6 transition-colors sm:flex-row sm:items-baseline sm:gap-6"
              >
                <span className="flex shrink-0 items-baseline gap-3 sm:w-[104px]">
                  <span className="font-mono text-[13px] uppercase tracking-[0.14em] text-accent">
                    {variant.key}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[19px] font-semibold tracking-[-0.02em] group-hover:text-accent">
                    {variant.name}
                  </span>
                  <span className="mt-1.5 block max-w-[52ch] text-[15px] leading-[1.55] text-ink-soft">
                    {variant.line}
                  </span>
                  <span className="mt-1.5 block text-[13px] leading-[1.5] text-ink-faint">
                    {variant.note}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* ── How to review ────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ink">
            How to review
          </h2>
          <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.6] text-ink-soft">
            Each variant carries a rail of controls on the left. It sets the
            world (no projects, one, or all fourteen), the screen (desktop or a
            390 by 844 phone frame), whether motion is full or reduced, and
            which state the surface is in.
          </p>
          <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.6] text-ink-soft">
            States marked <em className="not-italic font-medium text-ink">held</em>{" "}
            park the surface so you can study it. States marked{" "}
            <em className="not-italic font-medium text-ink">do it</em> keep the
            surface live and change how the next switch behaves, so you perform
            the switch and watch what happens. A caption saying &ldquo;the old
            project stays put&rdquo; proves nothing; doing it does.
          </p>

          <ul className="mt-6 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {LAB_STATES.map((state) => (
              <li key={state.id} className="flex items-baseline gap-2.5 text-[14px]">
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                  {state.kind === "armed" ? "do it" : "held"}
                </span>
                <span className="text-ink-soft">{state.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── What the lab is arguing from ─────────────────────────── */}
        <section className="mt-16">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ink">
            The data
          </h2>
          <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.6] text-ink-soft">
            One fixture, shared with the contract tests and the browser
            journeys. No variant invents a project, a name or a number.
          </p>
          <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-3">
            <Fact term="Projects" value={`${PROJECT_TRUTH_PROJECTS.length}`} />
            <Fact term="Worlds" value={`${PROJECT_TRUTH_SCENARIOS.length}`} />
            <Fact
              term="Groups at full size"
              value={`${full.groups.length}`}
            />
            <Fact term="Active" value={`${full.activeCount}`} />
            <Fact term="Archived" value={`${full.archivedCount}`} />
            <Fact
              term="Chooser at full size"
              value={full.mode === "combobox" ? "Search field" : "Plain list"}
            />
          </dl>
        </section>

        {/* ── The receipt ──────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ink">
            Grouping receipt
          </h2>
          <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.6] text-ink-soft">
            The fixture records which group each project belongs in. The lab
            works it out from role, period and archive date instead of reading
            that field, so the two can be compared. If they ever disagree, the
            lab is arguing from a catalog the rest of the programme does not
            recognise, and this line says so.
          </p>
          <p
            className={[
              "mt-5 inline-flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[14px] font-medium",
              agreement.disagreements.length === 0
                ? "border-[color:var(--status-done)]/30 bg-[color:var(--status-done-bg)]/50 text-ink"
                : "border-[color:var(--status-blocked)]/30 bg-[color:var(--status-blocked-bg)]/50 text-ink",
            ].join(" ")}
          >
            {agreement.disagreements.length === 0
              ? `All ${agreement.total} projects land in the group the fixture expects.`
              : `${agreement.disagreements.length} of ${agreement.total} projects land in the wrong group.`}
          </p>
          {agreement.disagreements.length > 0 ? (
            <ul className="mt-4 space-y-1 text-[13px] text-ink-soft">
              {agreement.disagreements.map((entry) => (
                <li key={entry.name}>
                  {entry.name} — expected {entry.expected}, got {entry.derived}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <footer className="mt-20 border-t border-hairline pt-8 text-[13px] leading-[1.6] text-ink-faint">
          <p>
            Review only. Nothing here is wired to real projects, and no page in
            this lab can change one. Production keeps its current controls until
            a direction is chosen.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
        {term}
      </dt>
      <dd className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-ink">
        {value}
      </dd>
    </div>
  );
}
