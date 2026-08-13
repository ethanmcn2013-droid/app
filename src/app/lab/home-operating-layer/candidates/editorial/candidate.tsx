/**
 * EDITORIAL LINE · variant 1
 *
 * The thesis: Home is a briefing, so it should read like one. A quiet
 * horizontal shell, a narrow authored measure, hairlines instead of containers,
 * and hierarchy carried by type and rhythm rather than by chrome. One indigo
 * mark per view, spent on the content and never on the furniture.
 *
 * The signature is the colophon at the foot of every mode: the page prints how
 * it was read. Instant, scope, who is reading, what the ranking looked at, what
 * it could not reach, and which kinds of work have no source at all. Those
 * facts exist in the contracts already and most compositions scatter them as
 * badges; setting them as one imprint is what makes a quiet day and a broken
 * provider read differently at a glance, and it is why this direction can stay
 * this quiet without ever being vague.
 *
 * Everything here is a Server Component except `interaction.tsx`, which is the
 * only client module in the direction.
 */

import type { HomeCandidate, HomeCandidateProps } from "@/lib/home-layer/lab-shell";
import "./editorial.css";
import { AnalyticsMode } from "./analytics";
import { InboxMode } from "./inbox";
import { StatusRegion } from "./interaction";
import { MyWorkMode } from "./my-work";
import { BriefingMode, TodayMode } from "./today";
import { Colophon, Dateline, Masthead, type ColophonEntry } from "./shell";

function stateOf(props: HomeCandidateProps) {
  const { state, today, inbox, myWork, analytics, briefing } = props;
  if (state.mode === "inbox") return inbox.state;
  if (state.mode === "my-work") return myWork.state;
  if (state.mode === "analytics") return analytics.state;
  if (state.mode === "briefing") return briefing.state;
  return today.state;
}

function colophonFor(props: HomeCandidateProps): readonly ColophonEntry[] {
  const { state, chrome, today, inbox, myWork, analytics, briefing } = props;

  const shared: ColophonEntry[] = [
    {
      term: "This read",
      lines: [
        chrome.asOf.line,
        `Home is reading ${chrome.scope.label}.`,
        chrome.scope.coverageLine,
      ],
    },
    {
      term: "Reading it",
      lines: [chrome.actor.name, chrome.actor.roleLabel],
    },
    {
      term: "Where new work goes",
      lines: [chrome.activeProject.line],
    },
  ];

  if (state.mode === "today" || state.mode === "briefing") {
    const account = state.mode === "today" ? today : briefing;
    shared.push({
      term: "What the ranking looked at",
      lines: [account.accountingLine, account.accountingWithheldLine],
    });
    shared.push({
      term: "No source connected",
      lines: today.unsupported.map((entry) => entry.text),
    });
  }

  if (state.mode === "inbox") {
    shared.push({
      term: "The count",
      lines: [inbox.badge.rendered ? inbox.badge.accessibleName : null],
    });
  }

  if (state.mode === "my-work") {
    shared.push({
      term: "Left out of this list",
      lines: [myWork.doneExcludedLine, myWork.timeZoneLine],
    });
  }

  if (state.mode === "analytics") {
    shared.push({
      term: "The window",
      lines: [analytics.windowLine, analytics.windowMismatchLine],
    });
    shared.push({
      term: "Projects not counted",
      lines: [analytics.ledgerCoverageLine],
    });
  }

  return shared;
}

const Editorial: HomeCandidate = (props: HomeCandidateProps) => {
  const { chrome, state, copy, inbox, hrefFor } = props;

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
      />

      <main className="ed-main" id="app-main-content" tabIndex={-1}>
        <Dateline chrome={chrome} state={stateOf(props)} copy={copy} />

        <h1 className="ed-h1">
          <span className="ed-eyebrow">{chrome.modeEyebrow}</span>
          {chrome.h1Line}
        </h1>

        <StatusRegion label={chrome.statusRegionLabel} />

        {state.mode === "today" ? <TodayMode props={props} /> : null}
        {state.mode === "briefing" ? <BriefingMode props={props} /> : null}
        {state.mode === "inbox" ? <InboxMode props={props} /> : null}
        {state.mode === "my-work" ? <MyWorkMode props={props} /> : null}
        {state.mode === "analytics" ? <AnalyticsMode props={props} /> : null}

        <Colophon entries={colophonFor(props)} />
      </main>
    </div>
  );
};

export default Editorial;
