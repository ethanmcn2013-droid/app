/**
 * READING INDEX · direction 3
 *
 * ── The thesis ─────────────────────────────────────────────────────────────
 *
 * Home is a periodical, and the four modes are its sections. So the navigation
 * is not a row of tabs, it is the document's own contents: a numbered index
 * with a dotted leader running from each mode's name to the condition that
 * mode's read is currently in. A reader learns, in words, that Inbox has five
 * waiting and one of them could not be checked, that My work was only partly
 * read, and that Analytics could not be read at all — without going to look.
 *
 * The condition on the right of each row is derived from that mode's own read
 * and nothing else (`modeCondition`). It is the one thing in this direction
 * that may never be approximate, so a mode may not be reported as read, or as
 * empty, on evidence that does not support it.
 *
 * ── WHAT CHANGED IN ROUND 5, AND WHY THE THESIS SURVIVED IT ────────────────
 *
 * Round 4 printed the contents page as the masthead, and two directors put the
 * same charge: Today asks what deserves attention now, and this page answered
 * with a table of contents about itself first. Roughly 330 px of index before
 * the headline at 1440. On a phone, on the worst morning of the month, a reader
 * passed about 590 px before being told a source had not answered.
 *
 * That is a fair charge against the position and no charge at all against the
 * device, and the two were never the same argument. A periodical does not open
 * on its contents page — it opens on the front page, and the contents lives
 * inside the issue as a report on what each section came back with. So the
 * order is now the order a paper has always used:
 *
 *   `Masthead`  the wordmark, the suite, and Read Scope as a real control.
 *   `ModeBar`   the four sections as a folio line, each with the state of its
 *               own read in words. One line at 768 and up.
 *   the read    headline, one true sentence, then the decisions.
 *   `Contents`  the numbered leader-dot table, with the cause behind each
 *               condition and Full briefing as a child of Today. In the
 *               standing column beside the read at 1080 and up, closing the
 *               document below that.
 *
 * The thesis is unchanged and better served: the navigation is still the
 * document's structure, and the structure now runs in the order a document
 * runs. What the reader loses at the top is the ordinal series and the leader;
 * what they gain is the headline on the first screen in all thirteen worlds.
 *
 * ── What it costs, said plainly ────────────────────────────────────────────
 *
 * The folio line is 44 px at 768 and up and two lines at 390, against 176 px of
 * index rows before. It scrolls away and it is not sticky at phone widths: a
 * bar that follows the reader costs a tenth of a phone screen forever, which is
 * the cost this direction refuses. On a tall wide window the whole standing
 * column follows instead, so the contents is in view from any scroll position
 * without taking a pixel from the read.
 *
 * ── What it spends on the client ───────────────────────────────────────────
 *
 * Nothing. Every file in this folder is a Server Component. The scope control
 * and the evidence receipts are `<details>`, the selections are routes, the
 * entrance is CSS keyed off the motion tokens. With 0.9 KB of shared-runtime
 * headroom for the programme, a direction that hydrates is a direction that
 * cannot ship.
 */

import { Fragment, type CSSProperties } from "react";
import type {
  HomeCandidate,
  HomeCandidateProps,
} from "@/lib/home-layer/lab-shell";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import { modeCondition } from "@/lib/home-layer/candidates/index/labels";
import { AnalyticsMode } from "./analytics";
import { InboxMode } from "./inbox";
import { MyWorkMode } from "./my-work";
import { BriefingMode, TodayMode } from "./read";
import { ScopeControl } from "./parts";
import "./reading-index.css";

/**
 * The masthead: the wordmark, the suite, and the dateline, on one rule.
 *
 * Home, Notes, Tasks and Timeline stay visible and text labelled at every
 * width, including 320, which is the responsive rule this direction is most at
 * risk of failing and therefore the one it puts first.
 *
 * READ SCOPE IS HERE NOW. A director could find no scope form control anywhere
 * on the full page and named the 11 px link in the right column as the smallest
 * quietest thing on the screen, which is the wrong size for the most frequently
 * used global control in the product. It sits on the masthead line at every
 * width, at reading size, with its own label and a 44 px target.
 *
 * The Home entry exposes section state with `aria-current="true"` and never
 * claims `page`: the folio below owns the exact-match claim (HOME_EXPERIENCE §5
 * R2, R3). The three product paths are the real ones from `product-urls.ts`
 * rather than invented strings, which does mean a reviewer who follows one
 * leaves the lab for the product. That is what those links mean.
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
      <ScopeControl props={props} />
    </div>
  );
}

/**
 * THE FOLIO LINE. The navigation, and the glance.
 *
 * Four sections, each with the state of its own read beside it in words. This
 * is the half of the contents table that has to be above the headline, and it
 * is only that half: the name, the count where there is one, the mark, and the
 * condition. The ordinal series, the leader, the cause behind the condition and
 * Full briefing all belong to the contents proper and wait there.
 *
 * WHY THE WORDS STAYED. Three directors scored the per-mode coverage report at
 * 9 and above and all three named the same property: the health of a mode you
 * are not looking at is legible, in words, from the mode you are in. A bar of
 * four names and four marks would have kept the navigation and thrown that
 * away, and it would have handed a screen reader the states while withholding
 * them from everybody else — the exact asymmetry this programme exists to
 * remove. So the words are here, at every width, for every reader.
 *
 * WHAT IT DOES AT 320. It wraps, one section per line, and stops being a line
 * at all. That is a transformation rather than a compression: the states go
 * under their own names instead of being squeezed beside them, nothing is
 * truncated, and no mode is put behind More, an icon or a horizontal scroll.
 */
function ModeBar({ props }: { props: HomeCandidateProps }) {
  const { chrome, copy, inbox, state, hrefFor } = props;
  const atDepth = state.mode === "briefing";
  return (
    <nav className="ri-bar" aria-label={chrome.navLabel}>
      <ul className="ri-bar-list">
        {chrome.modes.map((mode, position) => {
          const condition = modeCondition(props, mode.mode);
          return (
            <Fragment key={mode.mode}>
              <li
                className="ri-bar-item"
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
                  className="ri-bar-link"
                  href={mode.href}
                  aria-current={mode.ariaCurrent ?? undefined}
                >
                  <span className="ri-bar-name">{mode.label}</span>
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
                  <span className="ri-cond" data-mark={condition.mark}>
                    <span className="ri-cond-mark" aria-hidden="true" />
                    <span className="ri-cond-word">{condition.word}</span>
                    {condition.cause ? (
                      <span className="ri-cond-cause">{condition.cause}</span>
                    ) : null}
                  </span>
                </a>
              </li>

              {/*
                DEPTH, IN THE LINE THE READER IS LOOKING AT. Full briefing is
                not a fifth mode, it is the uncapped read behind Today, so it
                appears as a child of Today's entry while the reader is inside
                it and carries the one exact-match claim in the document. The
                contents below lists it from every mode; this states where you
                are.
              */}
              {atDepth && mode.mode === "today" ? (
                <li
                  className="ri-bar-item"
                  data-depth=""
                  data-current=""
                  style={{ "--ri-n": position } as CSSProperties}
                >
                  <a
                    className="ri-bar-link"
                    href={hrefFor({ mode: "briefing", item: null })}
                    aria-current="page"
                  >
                    <span className="ri-bar-name">{copy.modeNames.briefing}</span>
                  </a>
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ul>
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
   * The announcement is the same derivation the folio publishes, so a reader
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
        appearing. `aria-live` is stated beside the role rather than left to be
        implied by it: a director scanning for the region did not find one, and
        a contract that is only satisfied by a default is one browser change
        away from not being satisfied at all.
      */}
      <p
        className="ri-sr"
        role="status"
        aria-live="polite"
        aria-label={chrome.statusRegionLabel}
      >
        {`${chrome.modeEyebrow}. ${current.word}${current.cause ? `. ${current.cause}` : ""}.`}
      </p>

      {/*
        THE FRONT MATTER, AND ALL OF IT. Two ruled lines: who this is and what
        it is reading, then the four sections and the state each one's read
        came back in. Everything else that used to live up here — the ordinal
        index, the leader, the accounting, what Home cannot see — is material
        about the read rather than the read, and it now sits beside or after it.
      */}
      <header className="ri-plate ri-front">
        <Masthead props={props} />
        <ModeBar props={props} />
      </header>

      <main id="app-main-content" tabIndex={-1}>
        <div className="ri-plate">
          <ModeBody props={props} />
        </div>
      </main>
    </div>
  );
};

export default ReadingIndex;
