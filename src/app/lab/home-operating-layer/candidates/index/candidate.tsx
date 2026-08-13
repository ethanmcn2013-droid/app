/**
 * READING INDEX · direction 3
 *
 * ── The thesis ─────────────────────────────────────────────────────────────
 *
 * Home is a periodical, and the navigation is its contents page. The four
 * modes are not tabs along an edge; they are a numbered index, ruled top and
 * bottom, with a dotted leader running from each mode's name to the condition
 * that mode's read is currently in. So the navigation is also the summary: a
 * reader at 7am learns, before choosing anything, that Inbox has five waiting
 * and one of them could not be checked, that My work was only partly read, and
 * that Analytics could not be read at all. That is the whole argument for the
 * height it takes.
 *
 * The condition on the right of each row is derived from that mode's own read
 * and nothing else (`modeCondition`). It is the one thing in this direction
 * that may never be approximate, so a mode may not be reported as read, or as
 * empty, on evidence that does not support it.
 *
 * The structure then recurses. Every entry that was ranked carries an ordinal
 * down the left, and nothing that was not ranked carries one. The Project
 * ledger is the one place the reading measure breaks. Rules, ordinals, a
 * measure and a margin do the work that cards, panels and shadows do in a
 * louder system, and there is not one container in the direction that is not a
 * rule.
 *
 * ── What it costs, said plainly ────────────────────────────────────────────
 *
 * Four 44 px index rows are 176 px of front matter at 390. The trade is that
 * they scroll away and never come back: a tab bar costs 56 px of every screen
 * forever, this costs 176 px of the first screen once. A reader who wants the
 * index again scrolls up, or takes the link at the foot of the document.
 *
 * ── What it spends on the client ───────────────────────────────────────────
 *
 * Nothing. Every file in this folder is a Server Component. The scope control
 * and the evidence receipts are `<details>`, the selections are routes, the
 * entrance is CSS keyed off the motion tokens. With 0.9 KB of shared-runtime
 * headroom for the programme, a direction that hydrates is a direction that
 * cannot ship.
 */

import type { CSSProperties } from "react";
import type {
  HomeCandidate,
  HomeCandidateProps,
} from "@/lib/home-layer/lab-shell";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import {
  modeCondition,
  ordinal,
} from "@/lib/home-layer/candidates/index/labels";
import { AnalyticsMode } from "./analytics";
import { InboxMode } from "./inbox";
import { MyWorkMode } from "./my-work";
import { BriefingMode, TodayMode } from "./read";
import { ScopeControl } from "./parts";
import "./reading-index.css";

const INDEX_ID = "ri-index";
const INDEX_LABEL_ID = "ri-index-label";

/**
 * The masthead. The suite line, when the read was taken, and which issue of it
 * you are holding.
 *
 * Home, Notes, Tasks and Timeline stay visible and text labelled at every
 * width, including 320, which is the responsive rule this direction is most at
 * risk of failing and therefore the one it puts first.
 *
 * The Home entry exposes section state with `aria-current="true"` and never
 * claims `page`: the mode index below owns the exact-match claim
 * (HOME_EXPERIENCE §5 R2, R3). The three product paths are the real ones from
 * `product-urls.ts` rather than invented strings, which does mean a reviewer
 * who follows one leaves the lab for the product. That is what those links
 * mean.
 */
function Masthead({ props }: { props: HomeCandidateProps }) {
  const { chrome } = props;
  const homeHref = chrome.modes[0]?.href ?? "";
  return (
    <div className="ri-mast">
      <p className="ri-mast-word">Signal Studio</p>
      <nav className="ri-mast-nav" aria-label="Signal Studio">
        <ul className="ri-suite">
          <li>
            <a className="ri-suite-link" href={homeHref} aria-current="true">
              Home
            </a>
          </li>
          <li>
            <a className="ri-suite-link" href={PRODUCT_APP_PATHS.notes}>
              Notes
            </a>
          </li>
          <li>
            <a className="ri-suite-link" href={PRODUCT_APP_PATHS.tasks}>
              Tasks
            </a>
          </li>
          <li>
            <a className="ri-suite-link" href={PRODUCT_APP_PATHS.timeline}>
              Timeline
            </a>
          </li>
        </ul>
      </nav>
      <p className="ri-mast-read">{chrome.asOf.line}</p>
      <div className="ri-mast-scope">
        <ScopeControl props={props} />
      </div>
    </div>
  );
}

/**
 * THE INDEX. The signature of the direction, and the one place indigo appears.
 *
 * It carries its own visible name, because a leader-dot table is not yet a
 * learned convention for primary navigation and a first-time reader is owed
 * the fact that these four rows are places rather than a summary of the page
 * they are already on.
 *
 * The leader is drawn rather than slid: the dot field is stationary and a
 * paper-coloured cover travels off it to the right, staggered down the four
 * rows, so the contents page writes itself in. Under reduced motion the motion
 * tokens are 0 ms, the stagger is 0 ms with them, and every row is simply
 * already drawn.
 *
 * The leader run is capped rather than allowed to grow with the window. A
 * 1,120 px traverse from a mode's name to its condition is a real problem for
 * a reader on a screen magnifier, who never has both in view at once; at every
 * width above 1080 the name and its condition now stay inside one 400 px
 * span.
 */
function ModeIndex({ props }: { props: HomeCandidateProps }) {
  const { chrome, copy, inbox, state, hrefFor } = props;
  const atDepth = state.mode === "briefing";
  return (
    <nav className="ri-index" id={INDEX_ID} aria-labelledby={INDEX_LABEL_ID} tabIndex={-1}>
      <p className="ri-label ri-index-label" id={INDEX_LABEL_ID}>
        {chrome.navLabel}
      </p>
      <ol className="ri-index-list">
        {chrome.modes.map((mode, position) => {
          const condition = modeCondition(props, mode.mode);
          const showsDepth = atDepth && mode.mode === "today";
          return (
            <li
              className="ri-index-item"
              key={mode.mode}
              data-current={
                mode.ariaCurrent === "page"
                  ? ""
                  : mode.ariaCurrent === "true"
                    ? "ancestor"
                    : undefined
              }
              style={{ "--ri-n": position } as CSSProperties}
            >
              <a
                className="ri-index-link"
                href={mode.href}
                aria-current={mode.ariaCurrent ?? undefined}
              >
                <span className="ri-num" aria-hidden="true">
                  {ordinal(position + 1)}
                </span>
                <span className="ri-index-name">{mode.label}</span>
                <span className="ri-leader" aria-hidden="true" />
                <span className="ri-index-state">
                  {mode.badge ? (
                    <>
                      {/*
                        A count of nothing is still a count and still renders,
                        but it does not get the weight of something waiting. The
                        accessible name beside it is the shell's, unchanged.
                      */}
                      <span
                        className="ri-index-badge"
                        data-zero={inbox.badge.count === 0 ? "" : undefined}
                        aria-hidden="true"
                      >
                        {mode.badge.glyph}
                      </span>
                      <span className="ri-sr">{inbox.badge.accessibleName}</span>
                    </>
                  ) : null}
                  <span className="ri-cond" data-mark={condition.mark}>
                    <span className="ri-cond-mark" aria-hidden="true" />
                    <span className="ri-cond-word">{condition.word}</span>
                    {condition.cause ? (
                      <span className="ri-cond-cause">{condition.cause}</span>
                    ) : null}
                  </span>
                </span>
              </a>

              {/*
                DEPTH, STATED IN THE INDEX. Full briefing is not a fifth mode,
                it is the uncapped read behind Today, so it is a sub-entry of
                Today's row and it appears when the reader is inside it. Without
                this the one screen that exists to express depth is the one
                screen where the index cannot say where you are.
              */}
              {showsDepth ? (
                <ol className="ri-index-depth">
                  <li>
                    <a
                      className="ri-index-depth-link"
                      href={hrefFor({ mode: "briefing", item: null })}
                      aria-current="page"
                    >
                      {copy.modeNames.briefing}
                    </a>
                  </li>
                </ol>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ModeBody({ props }: { props: HomeCandidateProps }) {
  switch (props.state.mode) {
    case "inbox":
      return <InboxMode props={props} />;
    case "my-work":
      return <MyWorkMode props={props} />;
    case "analytics":
      return <AnalyticsMode props={props} />;
    case "briefing":
      return <BriefingMode props={props} />;
    default:
      return <TodayMode props={props} />;
  }
}

const ReadingIndex: HomeCandidate = (props: HomeCandidateProps) => {
  const { chrome, state } = props;

  /**
   * The announcement is the same derivation the index publishes, so a reader
   * using a screen reader and a reader looking at the contents page are told
   * the same thing about the same read.
   */
  const current = modeCondition(
    props,
    state.mode === "briefing" ? "today" : state.mode,
  );

  return (
    <div className="ri-root">
      <a className="ri-skip" href="#app-main-content">
        {chrome.skipLinkLabel}
      </a>

      {/*
        One polite region, in one place, on every mode. It carries the mode and
        the condition of its read, so a change announced here is always the
        same sentence with different words in it rather than a new element
        appearing.
      */}
      <p className="ri-sr" role="status" aria-label={chrome.statusRegionLabel}>
        {`${chrome.modeEyebrow}. ${current.word}${current.cause ? `. ${current.cause}` : ""}.`}
      </p>

      <div className="ri-plate">
        <Masthead props={props} />
        <ModeIndex props={props} />
      </div>

      <main id="app-main-content" tabIndex={-1}>
        <div className="ri-plate">
          <ModeBody props={props} />
        </div>
      </main>

      <div className="ri-plate">
        <div className="ri-foot">
          <a href={`#${INDEX_ID}`}>Back to the index</a>
        </div>
      </div>
    </div>
  );
};

export default ReadingIndex;
