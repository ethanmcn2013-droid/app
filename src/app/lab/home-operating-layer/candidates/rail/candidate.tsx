/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONTEXT RAIL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE THESIS. Home is four modes a founder switches between many times a day,
 * and switching is the operation the interface should be best at. So the
 * navigation is a labelled column that never leaves: four text links, always
 * in the same place, always in the same order. You never have to look for
 * where you are. The content beside it is free to be a document rather than a
 * dashboard, because none of the orientation is its job.
 *
 * ── THE SIGNATURE MOMENT: THE STATE SPINE ──────────────────────────────────
 *
 * A rule runs down the left edge of the navigation, one segment per mode, and
 * each segment is drawn in that mode's own read state:
 *
 *     │  Today       Read              a continuous hairline
 *     ┆  Inbox       Partly read       a heavier dashed rule
 *     ┆  My work     Nothing in it     a dashed hairline
 *     ╷
 *     ╵  Analytics   Could not be read a heavy rule, severed above and below
 *
 * On a fully answered day the spine is one unbroken line down the column. When
 * a provider goes down the line thickens and breaks into dashes. When a read
 * fails outright the line is CUT: there is a gap in the spine beside the mode
 * that could not be read. The governing rule asks that a quiet day and a
 * broken provider differ at a glance without reading a word, and this is that
 * difference drawn rather than described. A horizontal accent tick crosses the
 * spine at the mode you are standing in, so position and health are read in
 * the same look.
 *
 * It only exists here. A direction that navigates from the top of the page, or
 * from a contents table, or from a tab row, is looking at one mode at a time;
 * only a persistent column is looking at all four at once. It costs four rules
 * and four short lines of type, no chrome, no container, and no JavaScript.
 *
 * At 1023px and below the instrument ROTATES rather than stacking: the spine
 * becomes a horizontal rule under a single row of four text-labelled modes,
 * with the same four weights and the same break, and the tick becomes
 * vertical. The transformation is the same instrument in the other axis, which
 * is why the phone keeps the direction's whole argument in about 130px.
 *
 * ── WHAT THE SHELL DELIBERATELY IS NOT ─────────────────────────────────────
 *
 * There is no tint behind the rail and no filled active row. Both were here,
 * and both are the default SaaS sidebar: a pale slab with a highlighted pill
 * says nothing about this product and competes with the work. The rail is now
 * type on the same paper as the page, held by one hairline and one instrument.
 * The shell is quieter than the content, which is the rule.
 *
 * The suite is a colophon, not a banner. Products, the reader, Account and the
 * wordmark sit at the FOOT of the column, pinned to the bottom of the window
 * on wide screens and after the content on a phone. A founder opening Today on
 * a phone reaches the headline first and the decision second; the suite is
 * still one screen away and still four plain text links.
 *
 * ── Engineering ────────────────────────────────────────────────────────────
 *
 * Zero client JavaScript. Every control is a link, a `details` element or a
 * native focus target. The programme has 0.9 KB of shared-runtime headroom and
 * this direction asks for none of it. All of the expression is in CSS, type,
 * rhythm and composition, which are free.
 */

import type { CSSProperties } from "react";
import type {
  HomeCandidate,
  HomeCandidateProps,
  HomeMode,
  HomeModeLink,
  HomeStateName,
} from "@/lib/home-layer/lab-shell";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import { AnalyticsMode } from "./analytics";
import { InboxMode } from "./inbox";
import { MyWorkMode } from "./my-work";
import { bandOf, coverageByMode } from "./state";
import { BriefingMode, TodayMode } from "./today";
import "./rail.css";

/**
 * The three products, in the order the suite states them. Paths come from the
 * repository's typed constants so this file never invents a destination; the
 * names are the products' own.
 */
const PRODUCTS: readonly (readonly [string, string])[] = [
  ["Notes", PRODUCT_APP_PATHS.notes],
  ["Tasks", PRODUCT_APP_PATHS.tasks],
  ["Timeline", PRODUCT_APP_PATHS.timeline],
];

/** Where the account lives. Identity and administration, nothing else. */
const ACCOUNT_PATH = "/app/settings";

function ModeLink({
  link,
  props,
  index,
  state,
}: {
  link: HomeModeLink;
  props: HomeCandidateProps;
  index: number;
  state: HomeStateName;
}) {
  const isBriefing = props.state.mode === "briefing";
  return (
    <li
      className="rl-mode"
      data-band={bandOf(state)}
      data-here={link.ariaCurrent ? "yes" : undefined}
      style={{ "--rl-i": index } as CSSProperties}
    >
      <a
        className="rl-nav-link"
        href={link.href}
        aria-current={link.ariaCurrent ?? undefined}
      >
        <span className="rl-nav-label">
          <span className="rl-nav-name">{link.label}</span>
          {link.badge ? (
            <span className="rl-badge" data-coverage={props.inbox.badge.coverage}>
              <span aria-hidden="true">{link.badge.glyph}</span>
              {link.badge.announce ? (
                <span className="rl-sr">{props.inbox.badge.accessibleName}</span>
              ) : null}
            </span>
          ) : null}
        </span>
        {/* Printed in every world, including the good one. Silence used to
            stand for "read", and a reader could not tell a mode that was read
            from a mode that was never evaluated. */}
        <span className="rl-mode-state">{props.copy.states[state]}</span>
      </a>
      {link.mode === "today" && isBriefing ? (
        /* The briefing is depth from Today, not a fifth mode, so it appears as
           Today's child and only while the reader is in it. It is also the
           most specific Home-local link on that page, so it is the one that
           carries `page` while Today keeps the subtree match. */
        <ul className="rl-subnav">
          <li>
            <a
              className="rl-nav-link rl-nav-sub"
              href={props.hrefFor({ mode: "briefing", item: null })}
              aria-current="page"
            >
              {props.copy.modeNames.briefing}
            </a>
          </li>
        </ul>
      ) : null}
    </li>
  );
}

function Rail({
  props,
  coverage,
}: {
  props: HomeCandidateProps;
  coverage: Readonly<Record<HomeMode, HomeStateName>>;
}) {
  const { chrome, copy } = props;
  const readScope = chrome.scope.options.filter((option) => option.group === "read-scope");
  const projects = chrome.scope.options.filter((option) => option.group === "project");
  const here = coverage[props.state.mode];

  return (
    <header className="rl-rail" aria-label="Signal Studio">
      <nav className="rl-group rl-group-home" aria-labelledby="rl-nav-home-label">
        <p className="rl-label" id="rl-nav-home-label">
          {chrome.navLabel}
        </p>
        <ul className="rl-nav-list rl-spine">
          {chrome.modes.map((link, index) => (
            <ModeLink
              key={link.mode}
              link={link}
              props={props}
              index={index}
              state={coverage[link.mode]}
            />
          ))}
        </ul>
      </nav>

      <div className="rl-group rl-group-scope">
        <details className="rl-scope">
          <summary className="rl-scope-summary">
            <span className="rl-label">{copy.actions.changeScope}</span>
            <span className="rl-scope-value">{chrome.scope.label}</span>
          </summary>
          <div className="rl-scope-body">
            <p className="rl-scope-help">{chrome.scope.helpLine}</p>
            {chrome.scope.coverageLine ? (
              <p className="rl-scope-coverage">{chrome.scope.coverageLine}</p>
            ) : null}
            <ul className="rl-scope-list">
              {readScope.map((option) => (
                <li key={option.id}>
                  <a
                    className="rl-scope-option"
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
                <p className="rl-label">One project</p>
                <ul className="rl-scope-list rl-scope-projects">
                  {projects.map((option) => (
                    <li key={option.id}>
                      <a
                        className="rl-scope-option"
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
              <a className="rl-scope-reset" href={chrome.scope.resetHref}>
                {chrome.scope.resetLabel}
              </a>
            ) : null}
          </div>
        </details>
        <p className="rl-active">{chrome.activeProject.line}</p>
      </div>

      {/* One polite status region, in one place, on every mode. It carries the
          state of the mode you are standing in and when it was read, and it
          stays on screen at every scroll position. */}
      <div
        className="rl-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={chrome.statusRegionLabel}
        data-band={bandOf(here)}
      >
        <span className="rl-status-state">{copy.states[here]}</span>
        <span className="rl-status-when">{chrome.asOf.line}</span>
      </div>
    </header>
  );
}

/**
 * The suite, as a colophon. Products, the reader and the wordmark are real
 * orientation and they are never hidden, abbreviated or put behind a control;
 * they are simply not the first thing a founder needs at 07:00. On a wide
 * screen this rides the bottom of the window in the same column as the rail.
 * On a phone it is the foot of the page.
 */
function Suite({ props }: { props: HomeCandidateProps }) {
  const { chrome } = props;
  return (
    <footer className="rl-suite">
      <nav className="rl-group" aria-labelledby="rl-nav-products-label">
        <p className="rl-label" id="rl-nav-products-label">
          Products
        </p>
        <ul className="rl-nav-list rl-product-list">
          {PRODUCTS.map(([name, path]) => (
            <li key={name}>
              <a className="rl-nav-link rl-nav-product" href={path}>
                <span className="rl-nav-name">{name}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="rl-actor">
        <p className="rl-actor-name">{chrome.actor.name}</p>
        <p className="rl-actor-role">{chrome.actor.roleLabel}</p>
        <a className="rl-account" href={ACCOUNT_PATH}>
          Account
        </a>
      </div>
      <p className="rl-wordmark">Signal Studio</p>
    </footer>
  );
}

const ContextRail: HomeCandidate = (props: HomeCandidateProps) => {
  const mode = props.state.mode;
  const coverage = coverageByMode(props);
  return (
    <div className="rl-root">
      <a className="rl-skip" href="#app-main-content">
        {props.chrome.skipLinkLabel}
      </a>
      <div className="rl-shell">
        <Rail props={props} coverage={coverage} />
        <main className="rl-main" id="app-main-content" tabIndex={-1}>
          <div className="rl-page" data-mode={mode}>
            {mode === "today" ? <TodayMode {...props} /> : null}
            {mode === "inbox" ? <InboxMode {...props} /> : null}
            {mode === "my-work" ? <MyWorkMode {...props} /> : null}
            {mode === "analytics" ? <AnalyticsMode {...props} /> : null}
            {mode === "briefing" ? <BriefingMode {...props} /> : null}
          </div>
        </main>
        <Suite props={props} />
      </div>
    </div>
  );
};

export default ContextRail;
