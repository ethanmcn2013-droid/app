/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MERIDIAN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE THESIS. Home already knows what time everything is. "Due today", "2 days
 * late", "Quiet for 9 days", "Yesterday at 14:20", "Comes back at 18:00 on
 * Thursday 16 July", "Looking fourteen days ahead", "The earliest this can show
 * a trend is 24 July 2026" — every one of those is a temporal fact, and every
 * other composition renders them as text inside a list and then orders the list
 * by something else. This direction makes time the structure instead:
 *
 *     the page is ordered by when each thing next wants you,
 *     and it is bracketed by the two instants that bound the read.
 *
 * Nothing is ranked into position by an invisible score. An entry sits where
 * its own time puts it, its time is printed in a column you can run your eye
 * down without reading a single title, and an entry with no time is not placed
 * on the clock at all.
 *
 * ── THE SIGNATURE MOMENT: TWO RULES, AND THE SPACE BETWEEN THEM ────────────
 *
 * Two full-bleed horizontal rules, and they are the only full-bleed elements in
 * the direction.
 *
 *   THE MERIDIAN, at the top, is now. It carries the instant the read was
 *   taken. Everything below it is the read.
 *
 *   THE HORIZON, at the bottom, is the far edge of what this read reached —
 *   fourteen days on Today, seven on My work, four weeks of records on
 *   Analytics, the last thing that arrived on Inbox. It carries the shell's own
 *   window sentence, so the two rules can never drift from the read they
 *   bracket.
 *
 * Everything between them is inside the read. Everything below the horizon is
 * outside it: further out than the window looked, off the clock altogether, or
 * not yet answerable. A founder at 07:00 sees the shape of the next fortnight
 * before reading a word, and on a quiet day the space between the rules is
 * genuinely open. That emptiness is the direction's answer to what a wide
 * screen is for: it is the amount of time nothing is asking for, and it is
 * captioned in words so it can never be mistaken for a page that failed to
 * finish loading.
 *
 * AND WHEN THE READ BREAKS, THE PAPER CHANGES. A source that was asked and did
 * not answer means the time between the two rules is still there and Home could
 * not see into it. So the field between them is RULED — a lined ground under
 * the whole read — and the shell's own failure sentence is set at heading size
 * hard against the meridian. A partly-read day keeps open paper and gets the
 * sentence. A finished read gets neither. Three silhouettes, told apart from
 * across a room, before a word is read, and still told apart with every colour
 * removed. The previous occupant of this folder was vetoed for expressing that
 * difference as one hairline; this is the whole material of the page.
 *
 * ── WHY IT IS NOT A NEAR NEIGHBOUR OF THE OTHER THREE ──────────────────────
 *
 * The other three directions are all composed on a vertical: a measure, a
 * spine, a contents column. This one is composed on a horizontal, and its
 * ordering principle is not rank, not the document, and not the index. It is
 * the clock. It is also the only direction in which the page's structure can be
 * wrong — put an undated item at a time and the composition has lied — which is
 * why `parts.tsx` refuses to place anything it was not given a time for.
 *
 * ── WHAT IT COSTS, SAID PLAINLY ────────────────────────────────────────────
 *
 * Two rules and their labels are about 96px of vertical furniture on every
 * mode, spent before the first entry. The time gutter is 10rem of width the
 * measure never gets back at any size above 640px. And ordering by time rather
 * than by rank means the three ranked decisions are not automatically the first
 * three things on the page: they are first because Today's own section order
 * puts them first, and on a day where something is two days late that late
 * thing leads. That is the right answer, and it is a real loss of control over
 * the fold.
 *
 * ── WHAT IT SPENDS AT RUNTIME ──────────────────────────────────────────────
 *
 * Nothing. Every file in this folder is a Server Component, depth is
 * `<details>`, selection is the URL, motion is two CSS animations on transform
 * alone. The programme has 0.9 KB of shared-runtime headroom and this direction
 * asks for none of it.
 */

import type {
  HomeCandidate,
  HomeCandidateProps,
  HomeModeLink,
} from "@/lib/home-layer/lab-shell";
import { HOME_APP_PATH, PRODUCT_APP_PATHS } from "@/lib/product-urls";
import { AnalyticsMode } from "./analytics";
import { InboxMode } from "./inbox";
import { MyWorkMode } from "./my-work";
import { Masthead } from "./parts";
import { readingsFor, type Reading } from "./reading";
import { BriefingMode, TodayMode } from "./today";
import "./rail.css";

/**
 * The suite, at the top, in the order the suite states it. Home is one of four
 * destinations rather than the parent of the other three, which is the
 * hierarchy the product actually has. Paths come from the repository's typed
 * constants so this file never invents a destination.
 */
const SUITE: readonly (readonly [string, string])[] = [
  ["Home", HOME_APP_PATH],
  ["Notes", PRODUCT_APP_PATHS.notes],
  ["Tasks", PRODUCT_APP_PATHS.tasks],
  ["Timeline", PRODUCT_APP_PATHS.timeline],
];

/** Where the account lives. Identity and administration, nothing else. */
const ACCOUNT_PATH = "/app/settings";

/**
 * The suite line. One row, quieter than everything under it, and it never
 * collapses: at 320px it wraps to two rows of full-text links rather than
 * hiding a destination behind an icon, an avatar or a More.
 */
function Suite({ props }: { props: HomeCandidateProps }) {
  const { chrome } = props;
  return (
    <header className="mr-suite">
      <p className="mr-wordmark">Signal Studio</p>
      <nav className="mr-suite-nav" aria-label="Products">
        <ul className="mr-suite-list">
          {SUITE.map(([name, path]) => (
            <li key={name}>
              <a
                className="mr-suite-link"
                href={path}
                /* A subtree match, never `page`: the one `page` in this
                   document belongs to the Home-local mode you are standing in
                   (D-HX04). */
                aria-current={name === "Home" ? "true" : undefined}
              >
                {name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <p className="mr-actor">
        <span className="mr-actor-name">{chrome.actor.name}</span>
        <span className="mr-actor-role">{chrome.actor.roleLabel}</span>
        <a className="mr-account-link" href={ACCOUNT_PATH}>
          Account
        </a>
      </p>
    </header>
  );
}

/**
 * The four modes, with the read state of each one printed underneath.
 *
 * Two blind rounds found every direction independently arriving at this, so it
 * is table stakes rather than anybody's signature: a founder about to switch
 * modes should know before the click whether the mode they are switching to
 * came back. The word is the shell's own and it is resolved to the WORST state
 * the mode can be shown to be in, so a mode publishing an incomplete disclosure
 * can never advertise itself as read.
 */
function Modes({
  props,
  readings,
}: {
  props: HomeCandidateProps;
  readings: Readonly<Record<string, Reading>>;
}) {
  const { chrome, copy } = props;
  const inBriefing = props.state.mode === "briefing";
  return (
    <nav className="mr-modes" aria-label={chrome.navLabel}>
      <ul className="mr-mode-list">
        {chrome.modes.map((link: HomeModeLink) => {
          const reading = readings[link.mode] as Reading;
          return (
            <li className="mr-mode" data-band={reading.material} key={link.mode}>
              <a
                className="mr-mode-link"
                href={link.href}
                aria-current={link.ariaCurrent ?? undefined}
              >
                <span className="mr-mode-name">
                  {link.label}
                  {link.badge ? (
                    <span className="mr-badge">
                      <span aria-hidden="true">{link.badge.glyph}</span>
                      {link.badge.announce ? (
                        <span className="mr-sr">{props.inbox.badge.accessibleName}</span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                <span className="mr-mode-state">{reading.label}</span>
              </a>
              {link.mode === "today" && inBriefing ? (
                /* The briefing is depth from Today, not a fifth mode, so it
                   appears as Today's child and only while the reader is in it.
                   It is the most specific Home-local link on that page, so it
                   carries `page` while Today keeps the subtree match. */
                <ul className="mr-submode">
                  <li>
                    <a
                      className="mr-mode-link mr-mode-sub"
                      href={props.hrefFor({ mode: "briefing", item: null })}
                      aria-current="page"
                    >
                      <span className="mr-mode-name">{copy.modeNames.briefing}</span>
                    </a>
                  </li>
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The one control that changes what Home reads, and the one polite status
 * region in the document.
 *
 * The control is a `<details>` because the lab hydrates nothing, and every
 * option inside it is a real route that survives reload and the Back button.
 */
function Controls({ props, here }: { props: HomeCandidateProps; here: Reading }) {
  const { chrome, copy } = props;
  const readScope = chrome.scope.options.filter((option) => option.group === "read-scope");
  const projects = chrome.scope.options.filter((option) => option.group === "project");
  return (
    <div className="mr-controls">
      <details className="mr-scope">
        <summary className="mr-scope-summary">
          <span className="mr-scope-verb">{copy.actions.changeScope}</span>
          <span className="mr-scope-value">{chrome.scope.label}</span>
        </summary>
        <div className="mr-scope-body">
          <p className="mr-scope-help">{chrome.scope.helpLine}</p>
          {chrome.scope.coverageLine ? (
            <p className="mr-scope-coverage">{chrome.scope.coverageLine}</p>
          ) : null}
          <ul className="mr-scope-list">
            {readScope.map((option) => (
              <li key={option.id}>
                <a
                  className="mr-scope-option"
                  href={option.href}
                  aria-current={option.current ? "true" : undefined}
                >
                  {option.label}
                </a>
              </li>
            ))}
          </ul>
          {projects.length > 0 ? (
            <>
              <p className="mr-label">One project</p>
              <ul className="mr-scope-list">
                {projects.map((option) => (
                  <li key={option.id}>
                    <a
                      className="mr-scope-option"
                      href={option.href}
                      aria-current={option.current ? "true" : undefined}
                    >
                      {option.label}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {chrome.scope.resetHref ? (
            <a className="mr-scope-reset" href={chrome.scope.resetHref}>
              {chrome.scope.resetLabel}
            </a>
          ) : null}
        </div>
      </details>
      <p
        className="mr-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={chrome.statusRegionLabel}
        data-band={here.material}
      >
        {here.label}
      </p>
    </div>
  );
}

/**
 * The heading, the navigation and the controls are composed ONCE here rather
 * than five times in the mode files. Each mode file therefore contains only its
 * chronology, which is the part that is actually a design decision, and the
 * five surfaces cannot drift apart in the frame they share.
 */
const Meridian: HomeCandidate = (props: HomeCandidateProps) => {
  const mode = props.state.mode;
  const readings = readingsFor(props);
  const here = readings[mode] as Reading;
  const headline =
    mode === "inbox"
      ? props.inbox.headline
      : mode === "my-work"
        ? props.myWork.headline
        : mode === "analytics"
          ? props.analytics.headline
          : mode === "briefing"
            ? props.briefing.headline
            : props.today.headline;

  return (
    <div className="mr-root">
      <a className="mr-skip" href="#app-main-content">
        {props.chrome.skipLinkLabel}
      </a>
      <div className="mr-page">
        <Suite props={props} />
        <main className="mr-main" id="app-main-content" tabIndex={-1}>
          <Masthead
            eyebrow={props.chrome.modeEyebrow}
            line={headline}
            lead={mode === "analytics" ? props.analytics.leadLine : null}
          />
          {/* The Home-local navigation belongs to the Home document, so it sits
              inside it, under the heading that says where you are. A reader who
              takes the skip link lands on "Today", not on four links. */}
          <Modes props={props} readings={readings} />
          <Controls props={props} here={here} />
          {mode === "today" ? <TodayMode props={props} here={here} /> : null}
          {mode === "inbox" ? <InboxMode props={props} here={here} /> : null}
          {mode === "my-work" ? <MyWorkMode props={props} here={here} /> : null}
          {mode === "analytics" ? <AnalyticsMode props={props} here={here} /> : null}
          {mode === "briefing" ? <BriefingMode props={props} here={here} /> : null}
        </main>
      </div>
    </div>
  );
};

export default Meridian;
