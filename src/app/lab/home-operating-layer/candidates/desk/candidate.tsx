/**
 * SIGNAL DESK — variant 4.
 *
 * THE THESIS. Home is not a page you read, it is a surface you sit at. So the
 * chrome is a shallow warm band at the top of a sheet of warm paper, and the
 * work is ruled onto the paper beneath it by a single vertical line — the
 * spine — that stays in exactly the same place in all five modes. Moving from
 * Today to Inbox to My work to Analytics changes the marks hanging on the line;
 * it does not change the furniture around them. That is the whole of the
 * spatial continuity, and it costs one pixel of width.
 *
 * THE SIGNATURE, AND WHY IT IS EARNED. The spine carries one fact nothing else
 * on the page carries: where the read broke. An entry whose project did not
 * resolve, or whose source did not answer, paints a gap over the line and puts
 * a dashed diamond in the gap. So a quiet day is an unbroken line with two
 * marks on it, and a failed provider is the same line with holes in it, and the
 * two are told apart from across a room. That is the governing rule of this
 * whole programme — unknown stays unknown, a quiet day and a broken provider
 * must look different — drawn instead of written. It also draws itself once on
 * arrival: one element, one scaleY, 340ms, nothing else on the page moves.
 *
 * WHAT IT COSTS. Warm paper is a real departure from the estate's white, and it
 * pulls every contrast ratio with it; the mixes in desk.css are measured
 * against the warm value rather than the token's. And the spine wants a left
 * gutter on every entry, which is 36px of width this direction never gets back
 * — at 320px it drops to 28px and the measure is tight.
 *
 * WHAT IT SPENDS AT RUNTIME. Nothing. Every file in this folder is a server
 * component, depth is `<details>`, selection is the URL, motion is one CSS
 * animation. The direction adds zero bytes to `shared_runtime`.
 */

import type { HomeCandidate, HomeCandidateProps } from "@/lib/home-layer/lab-shell";
import { AnalyticsMode } from "./analytics";
import { DeskHead } from "./chrome";
import { InboxMode } from "./inbox";
import { MyWorkMode } from "./my-work";
import { BriefingMode, TodayMode } from "./today";
import "./desk.css";

const Desk: HomeCandidate = (props: HomeCandidateProps) => {
  const { chrome, copy, state } = props;

  const modeState =
    state.mode === "inbox"
      ? props.inbox.state
      : state.mode === "my-work"
        ? props.myWork.state
        : state.mode === "analytics"
          ? props.analytics.state
          : state.mode === "briefing"
            ? props.briefing.state
            : props.today.state;

  /* The sheet widens for exactly two reasons, and both are on the element so
     the desk head and the read stay the same width as each other. */
  return (
    <div
      className="dk"
      data-mode={state.mode}
      data-open={state.mode === "inbox" && props.inbox.selection ? "true" : undefined}
    >
      <a className="dk-skip" href="#app-main-content">
        {chrome.skipLinkLabel}
      </a>

      <DeskHead
        chrome={chrome}
        copy={copy}
        homeHref={props.hrefFor({ mode: "today", item: null, event: null })}
        badgeName={props.inbox.badge.accessibleName}
        depth={
          state.mode === "briefing"
            ? {
                parentHref: props.briefing.returnHref,
                selfHref: props.hrefFor({}),
                label: copy.modeNames.briefing,
              }
            : null
        }
      />

      <main className="dk-main" id="app-main-content" tabIndex={-1}>
        <div className="dk-page">
          {/* Pattern (b) of D-HX02: the mode name is a VISIBLE eyebrow inside
              the h1, so the accessible text starts with the mode and the
              expressive line still leads the page for everybody else. */}
          <h1 className="dk-h1">
            <span className="dk-eyebrow">{chrome.modeEyebrow}</span>
            <span className="dk-h1-line">{chrome.h1Line}</span>
          </h1>

          {/* The one polite status region for this route. It states the read,
              the scope and the time it was read, as three sentences the shell
              composed. */}
          <p
            className="dk-status"
            role="status"
            aria-live="polite"
            aria-label={chrome.statusRegionLabel}
          >
            {copy.states[modeState]}. {chrome.scope.label}. {chrome.asOf.line}
          </p>

          {state.mode === "inbox" ? <InboxMode {...props} /> : null}
          {state.mode === "my-work" ? <MyWorkMode {...props} /> : null}
          {state.mode === "analytics" ? <AnalyticsMode {...props} /> : null}
          {state.mode === "briefing" ? <BriefingMode {...props} /> : null}
          {state.mode === "today" ? <TodayMode {...props} /> : null}
        </div>
      </main>
    </div>
  );
};

export default Desk;
