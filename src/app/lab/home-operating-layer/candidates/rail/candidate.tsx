/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONTEXT RAIL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE THESIS. Home is four modes a founder switches between many times a day,
 * and switching is the operation the interface should be best at. So the
 * navigation is a labelled column that never leaves: four text links, always
 * in the same place, always in the same order, with the scope Home is reading
 * and the moment it was read sitting underneath them. You never have to look
 * for where you are. The content beside it is free to be a document rather
 * than a dashboard, because none of the orientation is its job.
 *
 * THE SIGNATURE MOMENT, and why it belongs to this direction and no other.
 * The rail does not only say where the modes are. Under each mode name it
 * carries THAT MODE'S OWN STATE, in the shell's own state vocabulary, and only
 * when the state is not the ordinary one. On a good day the rail is four plain
 * words and nothing else. When a provider goes down it reads
 *
 *     Today       Partly read
 *     Inbox       Partly read
 *     My work     Partly read
 *     Analytics   Partly read
 *
 * and on a genuinely quiet day it reads Inbox · Nothing in it and stays silent
 * everywhere else. The lab brief asks that a quiet day and a broken provider
 * look different at a glance; here the difference is legible in the navigation
 * before the reader has opened anything. Only a persistent rail can do that,
 * because only a persistent rail is looking at all four modes at once. It
 * costs four short lines of type and no chrome.
 *
 * WHAT THIS COSTS, honestly. A rail spends horizontal space that a full-width
 * direction keeps, and the mode captions spend vertical space in the one place
 * the brief says must stay quieter than the content. Both are recorded in the
 * report rather than argued away here.
 *
 * ── Engineering ────────────────────────────────────────────────────────────
 *
 * Zero client JavaScript. Every control is a link, a `details` element or a
 * native focus target: the mode switch, the scope control, the event detail,
 * the row selection, the receipts and the action disclosures all work with
 * scripting off. The programme has 0.9 KB of shared-runtime headroom and this
 * direction asks for none of it. All of the expression is in CSS, type,
 * rhythm and composition, which are free.
 */

import type { CSSProperties } from "react";
import type {
  HomeCandidate,
  HomeCandidateProps,
  HomeMode,
  HomeModeLink,
} from "@/lib/home-layer/lab-shell";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import { AnalyticsMode } from "./analytics";
import { InboxMode } from "./inbox";
import { MyWorkMode } from "./my-work";
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

/**
 * The state word the rail shows under a mode, or null when there is nothing
 * out of the ordinary to say. `ready` is deliberately silent: a rail that
 * prints "Read" four times has taught the reader to stop looking at it, and
 * then it cannot tell them anything on the day it matters.
 */
function modeState(props: HomeCandidateProps, mode: HomeMode): string | null {
  const state =
    mode === "today"
      ? props.today.state
      : mode === "inbox"
        ? props.inbox.state
        : mode === "my-work"
          ? props.myWork.state
          : mode === "analytics"
            ? props.analytics.state
            : props.briefing.state;
  return state === "ready" ? null : props.copy.states[state];
}

function ModeLink({
  link,
  props,
  index,
}: {
  link: HomeModeLink;
  props: HomeCandidateProps;
  index: number;
}) {
  const state = modeState(props, link.mode);
  const isBriefing = props.state.mode === "briefing";
  return (
    <li className="rl-mode" style={{ "--rl-i": index } as CSSProperties}>
      <a
        className="rl-nav-link"
        href={link.href}
        aria-current={link.ariaCurrent ?? undefined}
      >
        <span className="rl-nav-label">
          <span className="rl-nav-name">{link.label}</span>
          {link.badge ? (
            <span className="rl-badge">
              <span aria-hidden="true">{link.badge.glyph}</span>
              {link.badge.announce ? (
                <span className="rl-sr">{props.inbox.badge.accessibleName}</span>
              ) : null}
            </span>
          ) : null}
        </span>
        {state ? <span className="rl-mode-state">{state}</span> : null}
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

function Rail({ props }: { props: HomeCandidateProps }) {
  const { chrome, copy } = props;
  const readScope = chrome.scope.options.filter((option) => option.group === "read-scope");
  const projects = chrome.scope.options.filter((option) => option.group === "project");
  const currentState = modeState(props, props.state.mode);

  return (
    <header className="rl-rail" aria-label="Signal Studio">
      <p className="rl-wordmark">Signal Studio</p>

      <nav className="rl-group rl-group-home" aria-labelledby="rl-nav-home-label">
        <p className="rl-label" id="rl-nav-home-label">
          {chrome.navLabel}
        </p>
        <ul className="rl-nav-list">
          {chrome.modes.map((link, index) => (
            <ModeLink key={link.mode} link={link} props={props} index={index} />
          ))}
        </ul>
      </nav>

      <nav className="rl-group" aria-labelledby="rl-nav-products-label">
        <p className="rl-label" id="rl-nav-products-label">
          Products
        </p>
        <ul className="rl-nav-list">
          {PRODUCTS.map(([name, path]) => (
            <li className="rl-mode" key={name}>
              <a className="rl-nav-link rl-nav-product" href={path}>
                <span className="rl-nav-label">
                  <span className="rl-nav-name">{name}</span>
                </span>
              </a>
            </li>
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

      <div className="rl-rail-foot">
        {/* One polite status region, in one place, on every mode. It carries
            when this was read, and the state of the read when it is not the
            ordinary one. */}
        <div
          className="rl-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={chrome.statusRegionLabel}
        >
          {currentState ? <span className="rl-status-state">{currentState}</span> : null}
          <span className="rl-status-when">{chrome.asOf.line}</span>
        </div>
        <div className="rl-actor">
          <p className="rl-actor-name">{chrome.actor.name}</p>
          <p className="rl-actor-role">{chrome.actor.roleLabel}</p>
          <a className="rl-account" href={ACCOUNT_PATH}>
            Account
          </a>
        </div>
      </div>
    </header>
  );
}

const ContextRail: HomeCandidate = (props: HomeCandidateProps) => {
  const mode = props.state.mode;
  return (
    <div className="rl-root">
      <a className="rl-skip" href="#app-main-content">
        {props.chrome.skipLinkLabel}
      </a>
      <div className="rl-shell">
        <Rail props={props} />
        <main className="rl-main" id="app-main-content" tabIndex={-1}>
          <div className="rl-page" data-mode={mode}>
            {mode === "today" ? <TodayMode {...props} /> : null}
            {mode === "inbox" ? <InboxMode {...props} /> : null}
            {mode === "my-work" ? <MyWorkMode {...props} /> : null}
            {mode === "analytics" ? <AnalyticsMode {...props} /> : null}
            {mode === "briefing" ? <BriefingMode {...props} /> : null}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ContextRail;
