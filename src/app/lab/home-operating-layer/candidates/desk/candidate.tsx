/**
 * SIGNAL DESK — variant 4.
 *
 * THE THESIS. Home is not a page you read, it is a surface you sit at. So there
 * is a desk and there is a sheet on it: the canvas is warm and full-bleed, the
 * read sits on a sheet of the estate's own white paper laid on top of it, and
 * the work is ruled onto that sheet by a single vertical line — the spine —
 * that stays in exactly the same place in all five modes. Moving from Today to
 * Inbox to My work to Analytics changes the marks hanging on the line; it does
 * not change the furniture around them. That is the whole of the spatial
 * continuity, and it costs one pixel of width.
 *
 * ROUND 3 MOVED THE WARMTH OFF THE PAGE AND INTO THE ROOM, and that is the one
 * structural change this round makes. Four directors raised the warm canvas as a
 * standing cost: Home is explicitly not a fourth product, and giving it its own
 * paper is the single cue that argues it is, so a founder leaving Home for Tasks
 * crossed a visible seam in a suite that is meant to read as one system. One
 * director protected it as a real pro-attention move at 7am and was also right.
 * Both are satisfied by putting the warmth where there is no text: the words in
 * Home now sit on `--paper`, the same white as Notes, Tasks and Timeline, and
 * the warmth is the surround the sheet lies on. At 1440 two thirds of the screen
 * is still warm, so the 7am quality survives; under every sentence the reader
 * actually reads, the paper is the estate's, so the seam does not exist. The
 * token comment says it outright — "Paper — white, locked by operator decision"
 * — and a wildcard's licence covers expression, not a locked decision.
 *
 * THE SIGNATURE, AND WHY IT IS EARNED. A line that breaks where the read broke.
 * It is drawn twice on every page and it is the only device here that carries
 * meaning without a word or a colour:
 *
 *   ACROSS, under the headline, as the readline. An unbroken rule is a read
 *   that finished. A rule with a hole cut in it is a read that answered for
 *   part of what was asked. A rule that runs a third of the way and stops is a
 *   source that refused. Three silhouettes, told apart from across a room,
 *   before a word is read, and still told apart with every colour removed.
 *
 *   DOWN, beside the entries, as the spine. An entry whose project did not
 *   resolve paints a gap over the line and puts a dashed diamond in the gap.
 *
 * That is the governing rule of this whole programme — unknown stays unknown, a
 * quiet day and a broken provider must look different — drawn instead of
 * written. The line also draws itself once on arrival: one element, one scaleY,
 * 340ms, nothing else on the page moves.
 *
 * WHAT ROUND 1 GOT WRONG, and what changed. The state used to be a tinted band
 * that appeared in every world, including the healthy one, so its presence
 * signalled nothing and partial coverage and total provider failure arrived as
 * the same picture. The band is gone. A complete read now carries no strip at
 * all, only an unbroken rule; a limited read carries the shell's own sentence
 * for what happened, at the top, where the reader is standing. Limits that are
 * true every single day are no longer raised as if they were news; they are
 * named in the metadata line and printed in full at the foot.
 *
 * WHAT THE WIDTH IS FOR, which LAB_BRIEF Amendment 1 now requires an answer to.
 * The full width is the desk. The measure is the sheet. The left desk carries
 * the read's own index, with a count against every section, so the shape of the
 * read — three ranked decisions, then two, then four, then four — is legible
 * before a single row is scrolled. The index is absent when a read has fewer
 * than two sections, so a quiet day and a first morning keep a bare desk, and
 * the emptiness is the material rather than an unmade decision.
 *
 * WHAT IT COSTS. The spine wants a left gutter on every entry, which is 36px of
 * width this direction never gets back — at 320px it drops to 28px and the
 * measure is tight. And the desk tint is one declared hue, the only literal
 * colour in the direction; everything else is mixed from the theme's own tokens,
 * so dark follows without a second palette.
 *
 * WHAT IT SPENDS AT RUNTIME. Nothing. Every file in this folder is a server
 * component, depth is `<details>`, selection is the URL, motion is one CSS
 * animation. The direction adds zero bytes to `shared_runtime`.
 */

import type { HomeCandidate, HomeCandidateProps } from "@/lib/home-layer/lab-shell";
import { AnalyticsMode, analyticsRead } from "./analytics";
import { DeskHead, type ModeRead } from "./chrome";
import { InboxMode } from "./inbox";
import { MyWorkMode } from "./my-work";
import { readVerdict } from "./parts";
import { BriefingMode, TodayMode } from "./today";
import "./desk.css";

const Desk: HomeCandidate = (props: HomeCandidateProps) => {
  const { chrome, copy, state } = props;

  /**
   * How every mode's read went, not only this one.
   *
   * Read health used to be visible for the mode you were standing in and nowhere
   * else, so a founder on Today could not tell that Inbox had not been read and
   * took every mode change blind. Today's `unsupported` set is deliberately not
   * folded in: a kind of work with no source at all is a standing fact about the
   * product, not a fact about this morning, and treating the two the same is
   * what made the old band furniture.
   *
   * Analytics goes through its own derivation because every source can answer in
   * full and the page can still be unable to say something. One function serves
   * the tab row and the Analytics readline, so the two can never disagree.
   */
  const modeRead: Record<string, ModeRead> = {
    today: readVerdict(props.today.state, props.today.disclosures, copy),
    inbox: readVerdict(props.inbox.state, props.inbox.disclosures, copy),
    "my-work": readVerdict(props.myWork.state, props.myWork.disclosures, copy),
    analytics: analyticsRead(props.analytics, copy).verdict,
  };

  /* The sheet is ONE measure in every mode. Round 1 widened the whole page for
     Analytics, which moved the masthead with it and made the frame look
     unresolved between modes; the widening now belongs to the Project ledger
     alone, which is the one thing on any of these pages that has to account for
     every project rather than say something. */
  return (
    <div className="dk" data-mode={state.mode}>
      <a className="dk-skip" href="#app-main-content">
        {chrome.skipLinkLabel}
      </a>

      <DeskHead
        chrome={chrome}
        copy={copy}
        homeHref={props.hrefFor({ mode: "today", item: null, event: null })}
        badgeName={props.inbox.badge.accessibleName}
        badgeCoverage={props.inbox.badge.coverage}
        modeRead={modeRead}
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
        <div className="dk-page dk-frame">
          {/* Pattern (b) of D-HX02: the mode name is a VISIBLE eyebrow inside
              the h1, so the accessible text starts with the mode and the
              expressive line still leads the page for everybody else. */}
          <h1 className="dk-h1">
            <span className="dk-eyebrow">{chrome.modeEyebrow}</span>
            <span className="dk-h1-line">{chrome.h1Line}</span>
          </h1>

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
