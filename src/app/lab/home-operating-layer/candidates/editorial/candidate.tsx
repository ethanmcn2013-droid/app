/**
 * EDITORIAL LINE · variant 1
 *
 * The thesis: Home is a briefing, so it should read like one. A quiet
 * horizontal shell, an authored measure, hairlines instead of containers, and
 * hierarchy carried by type and rhythm rather than by chrome. One indigo mark
 * per view, spent on the content and never on the furniture.
 *
 * The signature is the read itself, printed. A newspaper prints its imprint;
 * this page prints how it was read — what limited it, what the ranking looked
 * at, what has no source at all, which of the other three modes came back
 * short, and at the foot the instant, the scope and the reader.
 *
 * ── ROUND 3 ────────────────────────────────────────────────────────────────
 *
 * Round 2 gave this direction the highest mean and the highest floor in the lab
 * and then named one blocking fault, on five of ten ballots, in the same words:
 * the page answered "what is missing" before it answered "what deserves
 * attention now". At 1440 the first decision landed at y≈716 of 960; at 390 not
 * one of the three ranked decisions was on the arrival screen. Four ballots
 * offered the same way out — collapse the ledger to a summary with the detail
 * one interaction away — and a fifth asked what the other 600 pixels were for.
 *
 * Those are the same question, so they get one answer. THE PAGE HAS A SPINE, A
 * MEASURE AND A SHOULDER.
 *
 *   the spine     10rem, left. What a line is called: the numerals, the terms,
 *                 the section definitions, the dateline, the way back.
 *   the measure   40rem. The prose and the rows. It never widens.
 *   the shoulder  the rest, ~20rem at 1440. The state of the read.
 *
 * The honesty did not move down the page, it moved SIDEWAYS. At 1440 it sits
 * beside the headline instead of on top of the decisions, so it loses no rank
 * and the decisions get the top of the measure. Below 70rem there is no
 * shoulder, so it becomes one term, one sentence and a disclosure — about 90px
 * where the ledger used to spend 350. Every ranked decision is now on the
 * arrival screen at both widths.
 *
 * Five further round-2 requirements, each answered where it lives:
 *
 *   the failure must change the page      `Weather` in shell.tsx — the flag
 *                                         became the page's top rule.
 *   what stands must stop crowding        the imprint took the standing
 *   what changed                          conditions; the top shows only news.
 *   44px on every operational control     `editorial.css`, one rule for row
 *                                         titles, event links and row actions.
 *   a disabled control must say why       `interaction.tsx`, aria-describedby
 *   to a screen reader                    and aria-disabled instead of disabled.
 *   the Inbox numeral must not present    `inbox.tsx` — the count is qualified
 *   an incomplete count as a total        in its own type, or it is not shown.
 *
 * Everything here is a Server Component except `interaction.tsx`, which is the
 * only client module in the direction.
 */

import type { HomeCandidateProps, HomeCandidate } from "@/lib/home-layer/lab-shell";
import "./editorial.css";
import { AnalyticsMode } from "./analytics";
import { InboxMode } from "./inbox";
import { StatusRegion } from "./interaction";
import { MyWorkMode } from "./my-work";
import { BriefingMode, TodayMode } from "./today";
import {
  Folio,
  Imprint,
  Masthead,
  ReadState,
  Return,
  Weather,
  limitsFrom,
  otherModesEntry,
  readingOf,
  type ImprintEntry,
  type LimitEntry,
} from "./shell";
import { readAcrossModes, type ModeReading } from "./read-state";

function stateOf(props: HomeCandidateProps) {
  const { state, today, inbox, myWork, analytics, briefing } = props;
  if (state.mode === "inbox") return inbox.state;
  if (state.mode === "my-work") return myWork.state;
  if (state.mode === "analytics") return analytics.state;
  if (state.mode === "briefing") return briefing.state;
  return today.state;
}

function disclosuresOf(props: HomeCandidateProps) {
  const { state, today, inbox, myWork, analytics, briefing } = props;
  if (state.mode === "inbox") return inbox.disclosures;
  if (state.mode === "my-work") return myWork.disclosures;
  if (state.mode === "analytics") return analytics.disclosures;
  if (state.mode === "briefing") return briefing.disclosures;
  return today.disclosures;
}

/**
 * WHAT QUALIFIES THIS READ — the news, and only the news.
 *
 * Everything derived from the mode's own `disclosures`, plus the state of the
 * three modes the reader is not standing in. Every one of these can be true on
 * one morning and false on the next, which is the whole test for being here.
 * The conditions that hold every morning went to the imprint; see
 * `standingFor` below and the note on `Imprint` in shell.tsx.
 */
function qualifiersFor(
  props: HomeCandidateProps,
  readings: readonly ModeReading[],
): readonly LimitEntry[] {
  const { chrome, copy, state, analytics } = props;
  const out: LimitEntry[] = [...limitsFrom(disclosuresOf(props), chrome, copy)];

  if (state.mode === "analytics" && analytics.ledgerCoverageLine !== null) {
    out.push({
      id: "ed-ledger-coverage",
      kind: "Projects not counted",
      stateLabel: null,
      register: "limited",
      lines: [analytics.ledgerCoverageLine],
    });
  }

  const elsewhere = otherModesEntry(readings, state.mode);
  if (elsewhere !== null) out.push(elsewhere);

  return out;
}

/**
 * WHAT STANDS — true every morning until somebody changes it.
 *
 * The imprint proper, plus the three conditions round 2 caught being reprinted
 * at the top of every screen in every scenario: the kinds of work with no
 * producer at all, the arithmetic of the read, and what a list leaves out by
 * definition. They are facts about the system, not about this morning, and a
 * block that never changes is a block the eye stops reading.
 */
function standingFor(props: HomeCandidateProps): readonly ImprintEntry[] {
  const { chrome, state, today, myWork, briefing } = props;
  const out: ImprintEntry[] = [
    {
      term: "This read",
      lines: [chrome.asOf.line, `Home is reading ${chrome.scope.label}.`, chrome.scope.coverageLine],
    },
  ];

  if (state.mode === "today" || state.mode === "briefing") {
    const account = state.mode === "today" ? today : briefing;
    out.push({
      term: "The account",
      lines: [account.accountingLine, account.accountingWithheldLine],
    });
    out.push({
      term: "No source at all",
      lines: today.unsupported.map((entry) => entry.text),
    });
  }

  if (state.mode === "my-work") {
    out.push({
      term: "Left out of this list",
      lines: [myWork.doneExcludedLine, myWork.timeZoneLine],
    });
  }

  out.push({ term: "Reading it", lines: [chrome.actor.name, chrome.actor.roleLabel] });
  out.push({ term: "Where new work goes", lines: [chrome.activeProject.line] });
  return out;
}

/**
 * THE STANDFIRST — one sentence saying what kind of read this is.
 *
 * It moved up into the head this round, out of the mode bodies. Two reasons.
 * The head is now a masthead block that occupies the spine and the measure
 * together, and a masthead whose standfirst is somewhere else is not one. And
 * on My work it settles round 2's sharpest content note: "'Read 3 of 3
 * projects. 0 did not answer' and, two lines below, two rows both labelled
 * 'COVERAGE · PARTLY READ'. Placed adjacently they read as the page
 * contradicting itself on first pass."
 *
 * They are not contradictory — one is about projects answering, the other about
 * items being countable — and the director asked for the standfirst to say
 * which sense is meant. Editing the shell's sentence is not available to a
 * candidate and would not be the right fix anyway: the two senses are not two
 * meanings of one word, they are two different kinds of statement. So they are
 * given two different ranks and two different places. The claim about projects
 * is the standfirst, in the measure, at reading size. The limits on what could
 * be counted sit in the shoulder under a term that says exactly what they are:
 * "What qualifies this read". At 1440 they are adjacent columns rather than
 * consecutive paragraphs; at 390 the term is between them. Neither can now be
 * read as the same sentence disagreeing with itself.
 */
function Standfirst({ props }: Readonly<{ props: HomeCandidateProps }>) {
  const { state, today, briefing, myWork, analytics, chrome } = props;

  if (state.mode === "today") {
    const rows = today.sections.reduce((total, section) => total + section.rows.length, 0);
    // One sentence, one place. On a day with nothing to show, the state of the
    // read IS the news, so it is set at reading size rather than as a note.
    return <p className={rows === 0 ? "ed-lede" : "ed-standing"}>{today.quiet.line}</p>;
  }

  if (state.mode === "briefing") {
    const rows = briefing.sections.reduce((total, section) => total + section.rows.length, 0);
    return rows === 0 ? (
      <p className="ed-lede">{today.quiet.line}</p>
    ) : (
      <p className="ed-standing">Every row the ranking kept, in the order it ranked them.</p>
    );
  }

  if (state.mode === "my-work") {
    return (
      <>
        {myWork.kind === "no-projects" ? (
          <p className="ed-lede">{chrome.activeProject.line}</p>
        ) : null}
        {myWork.kind === "identity-unresolved" ? (
          <p className="ed-lede">
            Home could not work out which of these people you are, so it is not showing a list of
            work rather than showing you an empty one.
          </p>
        ) : null}
        {myWork.kind === "unavailable" ? (
          <p className="ed-lede">
            Your work could not be read. Nothing here counts that as nothing to do.
          </p>
        ) : null}
        {myWork.coverageLine === null ? null : (
          <p className="ed-standing">{myWork.coverageLine}</p>
        )}
      </>
    );
  }

  if (state.mode === "analytics") {
    return (
      <>
        <p className="ed-lede">{analytics.leadLine}</p>
        <p className="ed-standing">
          {analytics.windowLine}
          {analytics.windowMismatchLine === null ? null : ` ${analytics.windowMismatchLine}`}
        </p>
      </>
    );
  }

  return null;
}

const Editorial: HomeCandidate = (props: HomeCandidateProps) => {
  const { chrome, state, copy, inbox, briefing, firstRun, hrefFor } = props;
  const readings = readAcrossModes(props);
  const qualifiers = qualifiersFor(props, readings);
  const reading = readingOf(stateOf(props), disclosuresOf(props), chrome, copy);
  const shoulder = qualifiers.some((entry) => entry.lines.some((line) => line.length > 0));

  return (
    <div className="ed">
      <title>{chrome.documentTitle}</title>

      <a className="ed-skip" href="#app-main-content">
        {chrome.skipLinkLabel}
      </a>

      <Masthead
        chrome={chrome}
        homeHref={hrefFor({ mode: "today", item: null, event: null })}
        inboxAccessibleName={inbox.badge.rendered ? inbox.badge.accessibleName : null}
        readings={readings}
      />

      <main
        className="ed-main"
        id="app-main-content"
        tabIndex={-1}
        data-register={reading.register}
        data-shoulder={shoulder ? "true" : undefined}
      >
        {/* The state of the read, at page scale, before anything else in the
            document. On a complete read it draws nothing at all. */}
        <Weather
          register={reading.register}
          kind={reading.kind}
          stateLabel={reading.stateLabel}
        />

        {/*
          THE MASTHEAD BLOCK — spine, measure and shoulder, in one element.

          It owns its own three columns rather than relying on the page grid,
          which is deliberate and was learned the hard way: the weather band is
          absent on a mode that WAS read in full, and any placement that assumed
          a fixed number of rows above the head put the head underneath the
          first section the moment the band was not drawn. A masthead should not
          depend on the weather.

          The children are a fixed set for the same reason. The standfirst is
          one to two paragraphs depending on the mode, so it is wrapped rather
          than left to auto-flow into a column somebody else is standing in.
        */}
        <div className="ed-head">
          {state.mode === "briefing" ? (
            <Return href={briefing.returnHref} label={briefing.returnLabel} />
          ) : null}

          <h1 className="ed-h1">
            {/* Depth said inside the one eyebrow: the mode you are inside, then
                the depth you are at. The shell's own `modeEyebrow` is already
                the deepest name, so the ANCESTOR is what has to be added, not
                the other way round. */}
            <span className="ed-eyebrow">
              {state.mode === "briefing" ? (
                <span className="ed-eyebrow-up">{copy.modeNames.today} / </span>
              ) : null}
              {chrome.modeEyebrow}
            </span>
            {chrome.h1Line}
          </h1>

          <Folio chrome={chrome} />

          <div className="ed-lead">
            <Standfirst props={props} />
          </div>

          <StatusRegion label={chrome.statusRegionLabel} />

          {/* The shoulder. Level with the headline above 70rem, and one term
              and one sentence under the standfirst below it. */}
          <ReadState entries={qualifiers} />
        </div>

        {state.mode === "today" ? (
          <TodayMode props={props} firstRun={firstRun} />
        ) : null}
        {state.mode === "briefing" ? <BriefingMode props={props} /> : null}
        {state.mode === "inbox" ? <InboxMode props={props} /> : null}
        {state.mode === "my-work" ? <MyWorkMode props={props} /> : null}
        {state.mode === "analytics" ? <AnalyticsMode props={props} /> : null}

        <Imprint entries={standingFor(props)} />
      </main>
    </div>
  );
};

export default Editorial;
