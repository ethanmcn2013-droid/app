/**
 * READING INDEX · direction 3
 *
 * ── The thesis ─────────────────────────────────────────────────────────────
 *
 * Home is a periodical, and the navigation is its contents page. The four
 * modes are not tabs along an edge; they are a numbered index, ruled top and
 * bottom, with a dotted leader running from each mode's name to the condition
 * that mode's read is currently in. So the navigation is also the summary: a
 * reader at 7am learns, before choosing anything, that Inbox has eight waiting,
 * that My work was only partly read, and that Analytics could not be read at
 * all. That is the whole argument for the height it takes.
 *
 * The structure then recurses. Every mode opens with its own small contents
 * strip over its sections; every entry carries an ordinal down the left; the
 * Project ledger is the one place the reading measure breaks. Rules, ordinals,
 * a measure and a margin do the work that cards, panels and shadows do in a
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
  modeStateLine,
  ordinal,
} from "@/lib/home-layer/candidates/index/labels";
import { AnalyticsMode } from "./analytics";
import { InboxMode } from "./inbox";
import { MyWorkMode } from "./my-work";
import { BriefingMode, TodayMode } from "./read";
import "./reading-index.css";

const INDEX_ID = "ri-index";

/**
 * The suite line. Home, Notes, Tasks and Timeline stay visible and text
 * labelled at every width, including 320, which is the responsive rule this
 * direction is most at risk of failing and therefore the one it puts first.
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
      <p className="ri-mast-actor">
        {chrome.actor.name}
        {". "}
        {chrome.actor.roleLabel}
      </p>
    </div>
  );
}

/**
 * THE INDEX. The signature of the direction, and the one place indigo appears.
 *
 * The leader is drawn rather than slid: the dot field is stationary and a
 * paper-coloured cover travels off it to the right, staggered down the four
 * rows, so the contents page writes itself in. Under reduced motion the
 * motion tokens are 0 ms, the stagger is 0 ms with them, and every row is
 * simply already drawn.
 *
 * The state on the right is `copy.states[…]` for that mode's own view model,
 * so it is the shell's vocabulary, never a count this direction invented, and
 * a mode that could not be read says "Could not be read" where a quiet one
 * says "Read".
 */
function ModeIndex({ props }: { props: HomeCandidateProps }) {
  const { chrome, inbox } = props;
  return (
    <nav
      className="ri-index"
      id={INDEX_ID}
      aria-label={chrome.navLabel}
      tabIndex={-1}
    >
      <ol className="ri-index-list">
        {chrome.modes.map((mode, position) => (
          <li
            className="ri-index-item"
            key={mode.mode}
            data-current={mode.ariaCurrent === "page" ? "" : undefined}
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
                <span>{modeStateLine(props, mode.mode)}</span>
              </span>
            </a>
          </li>
        ))}
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
  const { chrome, copy, today, inbox, myWork, analytics, briefing, state } =
    props;

  const currentState =
    state.mode === "inbox"
      ? inbox.state
      : state.mode === "my-work"
        ? myWork.state
        : state.mode === "analytics"
          ? analytics.state
          : state.mode === "briefing"
            ? briefing.state
            : today.state;

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
        {`${chrome.modeEyebrow}. ${copy.states[currentState]}.`}
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
