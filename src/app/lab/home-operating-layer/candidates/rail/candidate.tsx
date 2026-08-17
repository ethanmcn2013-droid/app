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
 * An entry sits where its own time puts it, its time is printed in a column you
 * can run your eye down without reading a single title, and an entry with no
 * time is not placed on the clock at all. The one exception is Today's three
 * decisions, which are ranked, and where a rank exists it is printed as a rank
 * so it can never be read as a position on the clock.
 *
 * ── THE SIGNATURE MOMENT: TWO RULES, AND THE SPACE BETWEEN THEM ────────────
 *
 * Two full-bleed horizontal rules, and they are the only full-bleed elements in
 * the direction.
 *
 *   THE MERIDIAN, at the top, is now. Everything above it describes the read:
 *   where you are standing, what the read was taken over, and how much of it
 *   came back. Everything below it is the read.
 *
 *   THE HORIZON, at the bottom, is the far edge of what this read reached —
 *   fourteen days on Today, seven on My work, four weeks of records on
 *   Analytics. Where the shell publishes a window sentence the horizon carries
 *   it, so the two rules can never drift from the read they bracket. Inbox is
 *   the one mode where the edge is a state rather than a date: everything above
 *   the line is waiting on you, everything below it has been snoozed past it or
 *   settled, and the caption under the rule says exactly that. On a first
 *   screen the horizon carries no window at all, because no read ran and a
 *   claimed window would be the page's first lie.
 *
 * THE DISTANCE BETWEEN THEM IS THE WORK. That is the whole composition, and it
 * is what changed most in round 5. The previous version reserved 21rem of empty
 * canvas between the rules whether or not anything stood there, on the theory
 * that the emptiness was the shape of the time nothing was asking for. Ten
 * directors read it as an unmade decision, and the brief's own amendment says
 * emptiness is only allowed where you can name the work it is doing. So the
 * reservation is gone and the rules close up. A quiet day is now a genuinely
 * short page, a busy day is a long one, and the gap between the two rules is a
 * measure of the read rather than a caption about it.
 *
 * AND WHEN THE READ BREAKS, THE PAGE REVERSES. A source that was asked and did
 * not answer is set knocked out of solid ink, hard against the meridian, at
 * heading size. Nothing else on any of the five surfaces is reversed. It reads
 * as a black slab from across a room before a word is read, it survives forced
 * colours as a real fill and a real border, and it cannot be mistaken for a page
 * that has not finished loading — which is precisely what the round-4 device, a
 * ruled ground of grey hairlines, was mistaken for by two directors at once.
 *
 * ── WHAT THE WIDTH IS FOR ──────────────────────────────────────────────────
 *
 * Two columns and two right edges. The left column is the measure and ends where
 * the measure ends; the right column is the account of the read and ends at the
 * page. Above the meridian the right column carries what this read IS — how much
 * came back, what it was taken over, where work started from here would land.
 * Below the meridian it carries what the read COULD NOT SEE, and it is exactly
 * as long as that mode's limits are, so on a clean day it is short or absent.
 * Nothing on this page is wide because there was room.
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
 * Two rules and their labels are about 80px of vertical furniture on every mode,
 * spent before the first entry. The time gutter is 10rem of width the measure
 * never gets back at any size above 640px. And ordering by time rather than by
 * rank means the three ranked decisions are not automatically the first three
 * things on the page: they are first because Today's own section order puts them
 * first, and on a day where something is two days late that late thing leads.
 *
 * ── WHAT IT SPENDS AT RUNTIME: THE CLIENT-JS POSITION, CLAIMED ─────────────
 *
 * Zero bytes of client JavaScript. Not "small" — zero: there is no
 * `"use client"` directive anywhere in this folder, so no file in it enters
 * any client bundle, and there is no island to measure a gzip figure for.
 * Every file is a Server Component; depth and dispositions are `<details>`,
 * selection and navigation are the URL, motion is two CSS animations on
 * transform alone, and the two entrances replay on the picker's R re-mount
 * because they live in the markup, not in a store.
 *
 * The standard import ban — no useTaskPanel, useTasks, useDomain,
 * useColumnConfig, usePersonalization or useCalendarFrame, directly or
 * transitively — is satisfied by construction rather than by discipline: this
 * folder imports from exactly two modules, `@/lib/home-layer/lab-shell` and
 * `@/lib/product-urls`, and neither reaches the Tasks runtime. The programme
 * has 0.9 KB of shared-runtime headroom and this direction asks for none of
 * it: shared_runtime +0, largest_chunk +0, total_client_js +0.
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
import { Ledger } from "./parts";
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
 * THE FOUR MODES, ABOVE THE HEADING, IN ONE FIXED POSITION.
 *
 * Three things changed here after round 4 and all three were named by more than
 * one director.
 *
 * IT SITS ABOVE THE `h1`. Learned convention puts route-level navigation above
 * the page title; under the headline the four modes read as filters on Today
 * rather than as four peer routes, which is the two-level model this layer
 * exists to protect.
 *
 * IT DOES NOT MOVE. It is the first thing inside `main` in every one of the five
 * surfaces, so its offset is identical in all of them. The Analytics standfirst
 * used to push it down 43px and every Today to Analytics switch was a visible
 * jump; the standfirst now sits below the heading, where a standfirst belongs,
 * and the row is anchored.
 *
 * IT IS NAMED. A visible "Home" binds the four into a group and names the
 * accessible label of the navigation, so nothing has to be inferred about which
 * four these are or what they belong to.
 *
 * THE STATE OF EACH MODE IS PRINTED UNDER IT. Two blind rounds found every
 * direction independently arriving at this, so it is table stakes rather than
 * anybody's signature: a founder about to switch modes should know before the
 * click whether the mode they are switching to came back. The word is the
 * shell's own, resolved to the WORST state the mode can be shown to be in, and a
 * mode that refused a source while still producing a read says both facts rather
 * than claiming a total outage it did not have.
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
    <nav className="mr-modes" aria-labelledby="mr-home-label">
      <p className="mr-home" id="mr-home-label">
        {chrome.navLabel}
      </p>
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
                      {/* A COUNT MAY NOT SIT UNQUALIFIED BESIDE A BROKEN READ —
                          and a qualifier may not point the wrong way. "At least"
                          claims under-counting, which is only true when whole
                          projects were missing from the read; the shell's scope
                          coverage line exists exactly then. The other partial
                          cause, an item counted but unverifiable at the source,
                          leaves the count exact, and "at least" there would
                          manufacture doubt in the direction the data does not
                          have. That caveat is carried by the accessible name and
                          the mode's own state caption instead. */}
                      {props.inbox.badge.coverage !== "complete" &&
                      props.chrome.scope.coverageLine !== null ? (
                        <span className="mr-badge-floor" aria-hidden="true">
                          at least
                        </span>
                      ) : null}
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
 * The one control that changes what Home reads.
 *
 * It is a `<details>` because the lab hydrates nothing, and every option inside
 * it is a real route that survives reload and the Back button. It carries a
 * disclosure marker so it reads as opening in place rather than as navigating,
 * which is the same mark every other disclosure in this direction uses.
 *
 * WHAT IS NO LONGER HERE. Round 4 found a second, unlabelled copy of the current
 * mode's state word floating at the right end of this row, anchored to nothing,
 * with two identical words in one header block and nothing saying which
 * described the mode and which the scope. Four directors named it. The state of
 * every mode is printed once, under that mode's own name, and the document's
 * polite status region moved to the meridian, which is the one line that already
 * changes when a reader moves scope.
 */
function Scope({ props }: { props: HomeCandidateProps }) {
  const { chrome, copy } = props;
  const readScope = chrome.scope.options.filter((option) => option.group === "read-scope");
  const projects = chrome.scope.options.filter((option) => option.group === "project");
  return (
    <details className="mr-scope">
      <summary className="mr-scope-summary">
        <span className="mr-scope-verb">{copy.actions.changeScope}</span>
        <span className="mr-scope-value">{chrome.scope.label}</span>
      </summary>
      <div className="mr-scope-body">
        <p className="mr-scope-help">{chrome.scope.helpLine}</p>
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
  );
}

/**
 * How much of what was asked for came back, in one sentence, per mode.
 *
 * Composed here rather than in the five mode files so the top of the page has
 * one shape in all of them and cannot drift. Every sentence is the shell's own.
 *
 * TWO REFUSALS AND ONE ABSTENTION, all three learned from the failure worlds.
 * The Inbox and My work account sentences count PROJECTS THAT RESOLVED, so on
 * the one world where a resolved project's source refused they read "0 did not
 * answer" and "0 projects could not be read" directly under a notice saying one
 * did. A true sentence from the wrong ledger is still a contradiction on the
 * page, so when this mode's read carries a refusal those two lines stand down
 * and the notice is the single account of the failure. Analytics abstains
 * always: its window sentence is the horizon's own line, and printing it here
 * as well was the same sentence at both edges of one page.
 */
function coveredLine(props: HomeCandidateProps, here: Reading): string | null {
  const mode = props.state.mode;
  if (mode === "today") return props.today.accountingLine ?? props.today.accountingWithheldLine;
  if (mode === "briefing") {
    return props.briefing.accountingLine ?? props.briefing.accountingWithheldLine;
  }
  if (mode === "inbox") {
    if (!props.inbox.badge.rendered || here.refused) return null;
    return props.inbox.badge.glyph === null
      ? props.copy.unreadableCount
      : props.inbox.badge.accessibleName;
  }
  if (mode === "my-work") return here.refused ? null : props.myWork.coverageLine;
  return null;
}

/**
 * The heading, the navigation, the scope control and the account of the read are
 * composed ONCE here rather than five times in the mode files. Each mode file
 * therefore contains only its chronology, which is the part that is actually a
 * design decision, and the five surfaces cannot drift apart in the frame they
 * share.
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
          <div className="mr-identity">
            <Modes props={props} readings={readings} />
            <h1 className="mr-h1">
              <span className="mr-h1-eyebrow">{props.chrome.modeEyebrow}</span>
              <span className="mr-h1-line">{headline}</span>
            </h1>
            {/* The standfirst belongs to the heading, so it sits under it. Above
                it, it moved the mode row and made every switch into Analytics a
                visible jump. It also stands down on a first screen: a sentence
                promising that every number names its records, on a page whose
                whole point is that there are no records yet, is a promise made
                to nobody. */}
            {mode === "analytics" && !props.firstRun ? (
              <p className="mr-lead">{props.analytics.leadLine}</p>
            ) : null}
            <Scope props={props} />
          </div>
          <Ledger
            covered={coveredLine(props, here)}
            rows={[
              ["What was read", props.chrome.scope.label],
              ...(props.chrome.scope.coverageLine
                ? ([["How much", props.chrome.scope.coverageLine]] as const)
                : []),
              [
                "Work starts in",
                /* The name where the shell resolved one — a term wants a value,
                   not a second sentence saying "work starts in". The line still
                   speaks whenever there is no name to give, because both of its
                   remaining cases are sentences a bare term cannot carry. */
                props.chrome.activeProject.name ?? props.chrome.activeProject.line,
              ],
            ]}
          />
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
