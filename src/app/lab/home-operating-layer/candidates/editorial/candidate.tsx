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
 * short, and at the foot the instant, the scope and the reader. Those facts
 * exist in the contracts already and most compositions scatter them as badges.
 * Setting them as one apparatus is what makes a quiet day and a broken provider
 * read differently at a glance, and it is why this direction can stay this
 * quiet without ever being vague.
 *
 * WHAT ROUND 1 CHANGED, structurally rather than cosmetically:
 *
 * 1. The state ladder is no longer a colour on a word. Four registers, each
 *    said in words at full ink and marked with a shape, and red reserved for a
 *    source that failed. See `read-state.ts`.
 * 2. The honesty came up off the foot. The limits, the account and the kinds of
 *    work with no source now sit under the standfirst, above the first row, at
 *    every width. The imprint at the foot keeps the identity of the read only.
 * 3. The page is one grid at width. A margin column holds the apparatus, the
 *    measure holds the prose, and the genuinely tabular things widen into the
 *    third column. Two rule extents in the document instead of five.
 * 4. Every mode carries the read state of the other three.
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
  Dateline,
  Imprint,
  Masthead,
  limitsFrom,
  otherModesEntry,
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
 * The limits run. Every fact that qualifies what the reader is about to read,
 * ordered worst first, sitting above the content rather than under it.
 */
function limitsFor(
  props: HomeCandidateProps,
  readings: readonly ModeReading[],
): readonly LimitEntry[] {
  const { chrome, copy, state, today, myWork, analytics, briefing } = props;
  const out: LimitEntry[] = [...limitsFrom(disclosuresOf(props), chrome, copy)];

  if (state.mode === "today" || state.mode === "briefing") {
    const account = state.mode === "today" ? today : briefing;
    out.push({
      id: "ed-account",
      kind: "The account",
      stateLabel: null,
      register: "read",
      lines: [account.accountingLine, account.accountingWithheldLine].filter(
        (line): line is string => line !== null,
      ),
    });
    // Kinds of work that are eligible and have no producer at all. Round 1:
    // a phone reader met these 3,400px below the fold, after the whole day.
    out.push(...limitsFrom(today.unsupported, chrome, copy));
  }

  if (state.mode === "my-work") {
    out.push({
      id: "ed-my-work-excluded",
      kind: "Left out of this list",
      stateLabel: null,
      register: "read",
      lines: [myWork.doneExcludedLine, myWork.timeZoneLine].filter(
        (line): line is string => line !== null,
      ),
    });
  }

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

/** The imprint proper. The same three terms on every mode, and nothing else. */
function imprintFor(props: HomeCandidateProps): readonly ImprintEntry[] {
  const { chrome } = props;
  return [
    {
      term: "This read",
      lines: [chrome.asOf.line, `Home is reading ${chrome.scope.label}.`, chrome.scope.coverageLine],
    },
    { term: "Reading it", lines: [chrome.actor.name, chrome.actor.roleLabel] },
    { term: "Where new work goes", lines: [chrome.activeProject.line] },
  ];
}

const Editorial: HomeCandidate = (props: HomeCandidateProps) => {
  const { chrome, state, copy, inbox, briefing, hrefFor } = props;
  const readings = readAcrossModes(props);
  const limits = limitsFor(props, readings);

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

      <main className="ed-main" id="app-main-content" tabIndex={-1}>
        <div className="ed-head">
          {/* THE FOLIO. When the read has depth the trail runs with the
              dateline, above the title rather than under it. Round 1: the
              trail sat below the h1, so the moment a reader went deeper the
              shell told them less about where they were. Keeping it on the
              dateline line also stops the mode name printing twice inside
              forty pixels: once here as a position, once as the title's
              kicker, which is how a section name behaves on a broadsheet
              rather than a repetition. */}
          <div className="ed-folio">
            <Dateline
              chrome={chrome}
              state={stateOf(props)}
              disclosures={disclosuresOf(props)}
              copy={copy}
            />

            {state.mode === "briefing" ? (
              <nav className="ed-crumbs" aria-label="Where you are">
                <ul>
                  <li>
                    <a href={briefing.returnHref} aria-label={briefing.returnLabel}>
                      {copy.modeNames.today}
                    </a>
                  </li>
                  <li>
                    <a href={hrefFor({})} aria-current="page">
                      {copy.modeNames.briefing}
                    </a>
                  </li>
                </ul>
              </nav>
            ) : null}
          </div>

          <h1 className="ed-h1">
            <span className="ed-eyebrow">{chrome.modeEyebrow}</span>
            {chrome.h1Line}
          </h1>

          <StatusRegion label={chrome.statusRegionLabel} />
        </div>

        {state.mode === "today" ? <TodayMode props={props} limits={limits} /> : null}
        {state.mode === "briefing" ? <BriefingMode props={props} limits={limits} /> : null}
        {state.mode === "inbox" ? <InboxMode props={props} limits={limits} /> : null}
        {state.mode === "my-work" ? <MyWorkMode props={props} limits={limits} /> : null}
        {state.mode === "analytics" ? <AnalyticsMode props={props} limits={limits} /> : null}

        <Imprint entries={imprintFor(props)} />
      </main>
    </div>
  );
};

export default Editorial;
