/**
 * The shell, and the parts every mode shares.
 *
 * The whole of this file is a Server Component. The masthead, the Read Scope
 * control, the disclosure list and the colophon ship no JavaScript: the scope
 * control is a `<details>`, so it opens with a keyboard, works with scripting
 * off, and costs the programme's 0.9 KB of runtime headroom nothing.
 *
 * The shell is deliberately the quietest thing on the page. Two thin bands,
 * one hairline each, small type, no fill, no shadow. Everything below it is
 * larger and darker than it is.
 */

import type {
  Disclosure,
  HomeChrome,
  HomeCopy,
  HomeStateName,
  Provenance,
  WhenLabel,
} from "@/lib/home-layer/lab-shell";

/** Signed-in product routes, per docs/SUITE_URL_AND_NAMING_CONTRACT.md. */
const PRODUCTS: readonly Readonly<{ label: string; href: string }>[] = [
  { label: "Notes", href: "/app/notes" },
  { label: "Tasks", href: "/app/tasks" },
  { label: "Timeline", href: "/app/timeline" },
];

const TONE_WORDS: Readonly<Record<Disclosure["tone"], string>> = {
  coverage: "Coverage",
  permission: "Access",
  freshness: "Freshness",
  scope: "Scope",
  failure: "Failure",
  setup: "Not connected",
  scale: "Size",
};

/** Warn and stop are said in words as well; the colour is never the message. */
const STATE_TONES: Readonly<Record<HomeStateName, "calm" | "warn" | "stop">> = {
  ready: "calm",
  loading: "calm",
  refreshing: "calm",
  updated: "calm",
  "all-clear": "calm",
  archived: "warn",
  empty: "warn",
  partial: "warn",
  stale: "warn",
  "insufficient-history": "warn",
  "permission-limited": "warn",
  unavailable: "stop",
  failed: "stop",
  offline: "stop",
};

export function StateTag({
  state,
  copy,
}: Readonly<{ state: HomeStateName; copy: HomeCopy }>) {
  return (
    <span className="ed-state" data-tone={STATE_TONES[state]}>
      {copy.states[state]}
    </span>
  );
}

export function Masthead({
  chrome,
  homeHref,
  inboxAccessibleName,
}: Readonly<{
  chrome: HomeChrome;
  homeHref: string;
  inboxAccessibleName: string | null;
}>) {
  const readScope = chrome.scope.options.filter((option) => option.group === "read-scope");
  const projects = chrome.scope.options.filter((option) => option.group === "project");

  return (
    <header className="ed-masthead">
      <div className="ed-band ed-suiteband">
        <p className="ed-wordmark">Signal Studio</p>
        <nav className="ed-suite" aria-label="Products">
          <ul>
            <li>
              <a href={homeHref} aria-current="true">
                Home
              </a>
            </li>
            {PRODUCTS.map((product) => (
              <li key={product.href}>
                <a href={product.href}>{product.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="ed-band ed-homeband">
        <nav className="ed-modes" aria-label={chrome.navLabel}>
          <ul>
            {chrome.modes.map((mode) => (
              <li key={mode.mode}>
                <a
                  href={mode.href}
                  aria-current={mode.ariaCurrent ?? undefined}
                  aria-label={
                    mode.badge && inboxAccessibleName !== null ? inboxAccessibleName : undefined
                  }
                >
                  {mode.label}
                  {mode.badge ? (
                    <span className="ed-badge" aria-hidden="true">
                      {mode.badge.glyph}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <details className="ed-scope">
          <summary>
            <span>Home is reading</span>
            <span className="ed-scope-name">{chrome.scope.label}</span>
          </summary>
          <div className="ed-scope-panel">
            <h2 id="ed-scope-heading">{chrome.scope.helpLine}</h2>
            {chrome.scope.coverageLine === null ? null : <p>{chrome.scope.coverageLine}</p>}
            <ul aria-labelledby="ed-scope-heading">
              {readScope.map((option) => (
                <li key={option.id}>
                  <a href={option.href} aria-current={option.current ? "true" : undefined}>
                    {option.label}
                  </a>
                </li>
              ))}
            </ul>
            {projects.length === 0 ? null : (
              <>
                <h2 id="ed-scope-projects">Read one project</h2>
                <ul aria-labelledby="ed-scope-projects">
                  {projects.map((option) => (
                    <li key={option.id}>
                      <a href={option.href} aria-current={option.current ? "true" : undefined}>
                        {option.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p>{chrome.activeProject.line}</p>
          </div>
        </details>
      </div>
    </header>
  );
}

export function Dateline({
  chrome,
  state,
  copy,
}: Readonly<{ chrome: HomeChrome; state: HomeStateName; copy: HomeCopy }>) {
  return (
    <p className="ed-dateline">
      <span className="ed-label">{chrome.asOf.line}</span>
      {/* The tag is the exception, not the furniture. An ordinary read is
          already stated by the line beside it, so the tag appears only when
          the read is something other than ordinary and the eye should catch
          it. */}
      {state === "ready" ? null : <StateTag state={state} copy={copy} />}
    </p>
  );
}

export function Disclosures({
  entries,
  copy,
}: Readonly<{ entries: readonly Disclosure[]; copy: HomeCopy }>) {
  if (entries.length === 0) return null;
  return (
    <ul className="ed-disclosures">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="ed-label">
            {TONE_WORDS[entry.tone]} · {copy.states[entry.state]}
          </span>
          <span>{entry.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function Provenance({ provenance }: Readonly<{ provenance: Provenance }>) {
  return <span className="ed-prov">{provenance.text}</span>;
}

export function When({ when }: Readonly<{ when: WhenLabel }>) {
  return (
    <span className={when.overdue ? "ed-num ed-late" : "ed-num"}>
      {when.relative} · {when.absolute}
    </span>
  );
}

export type ColophonEntry = Readonly<{ term: string; lines: readonly (string | null)[] }>;

/**
 * THE COLOPHON — this direction's signature.
 *
 * A newspaper prints who set it, on what press, from which plates. This page
 * prints how it was read: the instant, the scope, the account of what the
 * ranking looked at, what could not be reached, and which kinds of work have no
 * source connected at all. Every one of those is a fact the contracts require
 * somewhere on the surface; collecting them into one imprint at the foot is
 * what stops them being scattered as badges, and what makes a quiet day and a
 * broken provider read differently in one glance at the bottom of the page.
 */
export function Colophon({ entries }: Readonly<{ entries: readonly ColophonEntry[] }>) {
  const kept = entries
    .map((entry) => ({
      term: entry.term,
      lines: entry.lines.filter((line): line is string => line !== null && line.length > 0),
    }))
    .filter((entry) => entry.lines.length > 0);

  if (kept.length === 0) return null;

  return (
    <section className="ed-colophon" aria-labelledby="ed-colophon-heading">
      <h2 id="ed-colophon-heading">How this page was read</h2>
      <div className="ed-colophon-grid">
        {kept.map((entry) => (
          <dl key={entry.term}>
            <dt>{entry.term}</dt>
            {entry.lines.map((line) => (
              <dd key={line}>{line}</dd>
            ))}
          </dl>
        ))}
      </div>
    </section>
  );
}
