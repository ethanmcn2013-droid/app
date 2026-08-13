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
import { Imprint } from "./parts";
import "./reading-index.css";

const INDEX_ID = "ri-index";
const INDEX_LABEL_ID = "ri-index-label";

/**
 * The masthead: the wordmark and the suite, on one rule.
 *
 * Home, Notes, Tasks and Timeline stay visible and text labelled at every
 * width, including 320, which is the responsive rule this direction is most at
 * risk of failing and therefore the one it puts first.
 *
 * WHY THE SUITE AND THE INDEX NO LONGER LOOK ALIKE. A director found the two
 * bands unresolved — mono capitals two lines above mono capitals — and could
 * not tell which row was the suite and which was Home. So the suite is now a
 * single ruled line with the wordmark, set in mono capitals and marked with a
 * rule under the product you are in; the index below it is sentence case at
 * heading size with numbers and leaders. Two bands, two registers, one glance.
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
 * tokens are 0 ms, the stagger is 0 ms with them, every row is simply already
 * drawn, and an explicit reduced-motion block takes the animations off
 * entirely rather than relying on the token collapse alone.
 *
 * WHAT THE ROW DOES WHEN THE DOTS RUN OUT, which is the question two directors
 * asked and round 2 had no answer to. The row is a wrapping flex line with a
 * floor under the leader: the dots may never be shorter than 4.5 rem, and the
 * condition may never be narrower than 11 rem. When those two cannot both hold
 * on one line — at 390, at 320, and at 200 % text-only enlargement on a
 * 1440 screen alike — the condition drops to a second line and takes the full
 * row width, right aligned, inside the page's own gutter. Nothing is
 * truncated, nothing is crushed, and the device the direction is named after
 * gets MORE dots on a small screen rather than fewer. One mechanism, every
 * width, every zoom, no viewport-conditional document.
 */
function ModeIndex({ props }: { props: HomeCandidateProps }) {
  const { chrome, copy, inbox, state, hrefFor } = props;
  const atDepth = state.mode === "briefing";
  return (
    <nav className="ri-index" id={INDEX_ID} aria-labelledby={INDEX_LABEL_ID} tabIndex={-1}>
      <p className="ri-index-label" id={INDEX_LABEL_ID}>
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
                <span className="ri-index-head">
                  <span className="ri-num ri-index-num" aria-hidden="true">
                    {ordinal(position + 1)}
                  </span>
                  <span className="ri-index-name">{mode.label}</span>
                  {mode.badge ? (
                    <>
                      {/*
                        A COUNT THAT IS NOT A TOTAL IS NOT DRAWN AS ONE.
                        A director found a closed indigo pill reading 5 on the
                        same screen whose ledger said one of those five could
                        not be checked. So the pill only closes when the count
                        is complete: a partial count is drawn open, with a
                        broken outline and no fill, and the condition beside it
                        says "Partly read" in words. A count of nothing renders
                        too, and gets neither. The accessible name is the
                        shell's full sentence, unchanged.
                      */}
                      <span
                        className="ri-index-badge"
                        data-coverage={inbox.badge.coverage}
                        data-zero={inbox.badge.count === 0 ? "" : undefined}
                        aria-hidden="true"
                      >
                        {mode.badge.glyph}
                      </span>
                      <span className="ri-sr">{inbox.badge.accessibleName}</span>
                    </>
                  ) : null}
                </span>
                <span className="ri-leader" aria-hidden="true" />
                <span className="ri-index-state">
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

      {/*
        THE FRONT MATTER, IN THE SAME TWO COLUMNS AS THE READ. The masthead and
        the index sit in the reading column; the imprint sits in the standing
        column, level with the masthead, so column two is occupied from the
        first pixel of the page rather than from wherever the headline happens
        to end. It is also what reconciles the two right edges a director
        measured: the dateline and the scope control used to align to the
        measure while the rail aligned to the plate, and the dateline and the
        scope control have now moved into the column they were aligning to.
      */}
      <div className="ri-plate ri-front">
        <div className="ri-front-read">
          <Masthead props={props} />
          <ModeIndex props={props} />
        </div>
        <Imprint props={props} />
      </div>

      <main id="app-main-content" tabIndex={-1}>
        <div className="ri-plate">
          <ModeBody props={props} />
        </div>
      </main>

      {/*
        A contents page closes by offering the way back to the contents, and it
        does not do it on a page with nothing in it. A first screen has one
        move on it, and a return to the top of a screen the reader has not
        scrolled is furniture, which is what a director was objecting to when
        they found this closing a dead end.
      */}
      {props.firstRun ? null : (
        <div className="ri-plate">
          <div className="ri-foot">
            <a href={`#${INDEX_ID}`}>Back to the top</a>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingIndex;
