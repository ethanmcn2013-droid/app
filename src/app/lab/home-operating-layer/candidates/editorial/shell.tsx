/**
 * The shell, and the parts every mode shares.
 *
 * The whole of this file is a Server Component. The masthead, the Read Scope
 * control, the limits run and the imprint ship no JavaScript: the scope control
 * is a `<details>`, so it opens with a keyboard, works with scripting off, and
 * costs the programme's 0.9 KB of runtime headroom nothing.
 *
 * The shell is deliberately the quietest thing on the page. Two thin bands, one
 * hairline each, small type, no fill, no shadow. Everything below it is larger
 * and darker than it is. Round 1 found the bands did not agree with the column
 * they sit above, so both now run to the page grid's own edges and there are
 * exactly two rule extents in the whole document.
 */

import type {
  Disclosure,
  HomeChrome,
  HomeCopy,
  HomeStateName,
  Provenance,
  WhenLabel,
} from "@/lib/home-layer/lab-shell";
import {
  TONE_WORDS,
  leadDisclosure,
  nothingConnectedYet,
  registerFor,
  registerOfDisclosure,
  type ModeReading,
  type Register,
} from "./read-state";

/** Signed-in product routes, per docs/SUITE_URL_AND_NAMING_CONTRACT.md. */
const PRODUCTS: readonly Readonly<{ label: string; href: string }>[] = [
  { label: "Notes", href: "/app/notes" },
  { label: "Tasks", href: "/app/tasks" },
  { label: "Timeline", href: "/app/timeline" },
];

/**
 * THE FLAG — the direction's fixed reading position for the state of the read.
 *
 * It sits beside the dateline, in one place, at both viewports, and it is
 * absent on a complete read so that presence itself carries meaning. Round 1's
 * blocking defect was here: the words were painted with the status token. Now
 * the words are always `--ink` and the tone is carried by a mark that differs
 * in fill, in shape and in the number of ink strokes around it, which survives
 * low vision, colour blindness, greyscale printing and forced colours alike.
 */
export function Flag({
  register,
  kind,
  stateLabel,
}: Readonly<{ register: Register; kind: string | null; stateLabel: string }>) {
  if (register === "read") return null;
  return (
    <span className="ed-flag" data-register={register}>
      <span className="ed-flag-mark" aria-hidden="true" />
      <span className="ed-flag-words">
        {kind === null ? stateLabel : `${kind} · ${stateLabel}`}
      </span>
    </span>
  );
}

export function Masthead({
  chrome,
  homeHref,
  inboxAccessibleName,
  readings,
}: Readonly<{
  chrome: HomeChrome;
  homeHref: string;
  inboxAccessibleName: string | null;
  readings: readonly ModeReading[];
}>) {
  const readScope = chrome.scope.options.filter((option) => option.group === "read-scope");
  const projects = chrome.scope.options.filter((option) => option.group === "project");
  const byMode = new Map(readings.map((reading) => [reading.mode, reading]));

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
            {chrome.modes.map((mode) => {
              const reading = byMode.get(mode.mode) ?? null;
              // The mode you are standing in already states itself, at full
              // size, in the flag beside the dateline. Marking it again turns
              // the row into a rash of identical marks on the morning one
              // failure reaches every mode.
              const limited =
                reading !== null && reading.register !== "read" && mode.ariaCurrent === null;
              // The Inbox link's name is composed by the shell so that one
              // affordance announces the count. When that mode was not read in
              // full the state has to reach the same name, or the mark below is
              // the only place it exists and a screen reader loses it.
              const label =
                mode.badge && inboxAccessibleName !== null
                  ? limited
                    ? `${inboxAccessibleName}. ${reading.stateLabel}.`
                    : inboxAccessibleName
                  : undefined;
              return (
                <li key={mode.mode}>
                  <a href={mode.href} aria-current={mode.ariaCurrent ?? undefined} aria-label={label}>
                    {mode.label}
                    {mode.badge ? (
                      <span className="ed-badge" aria-hidden="true">
                        {mode.badge.glyph}
                      </span>
                    ) : null}
                    {limited ? (
                      <>
                        <span
                          className="ed-mode-mark"
                          data-register={reading.register}
                          aria-hidden="true"
                        />
                        {label === undefined ? (
                          <span className="ed-vh">. {reading.stateLabel}.</span>
                        ) : null}
                      </>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <details className="ed-scope">
          <summary>
            <span>Home is reading</span>
            <span className="ed-scope-name">{chrome.scope.label}</span>
          </summary>
          <div className="ed-scope-panel">
            {/* Named for assistive technology without claiming a heading level.
                A control inside the masthead sat two h2s above the document's
                own h1, which is a worse outline than no heading at all. */}
            <p className="ed-scope-term" id="ed-scope-heading">
              {chrome.scope.helpLine}
            </p>
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
                <p className="ed-scope-term" id="ed-scope-projects">
                  Read one project
                </p>
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
  disclosures,
  copy,
}: Readonly<{
  chrome: HomeChrome;
  state: HomeStateName;
  disclosures: readonly Disclosure[];
  copy: HomeCopy;
}>) {
  const noProjects = nothingConnectedYet(chrome);
  const register = registerFor(state, disclosures, noProjects);
  const lead = leadDisclosure(disclosures, noProjects);
  // The flag names the KIND of limit as well as its state, so a source that
  // failed and a source that answered in part are different at the top of the
  // page rather than only inside the block below it.
  const kind = lead === null ? null : TONE_WORDS[lead.tone];
  const stateLabel = lead === null ? copy.states[state] : copy.states[lead.state];

  return (
    <p className="ed-dateline">
      <span className="ed-label">{chrome.asOf.line}</span>
      <Flag register={register} kind={kind} stateLabel={stateLabel} />
    </p>
  );
}

// ── The limits run ──────────────────────────────────────────────────────────

export type LimitEntry = Readonly<{
  id: string;
  /** The kind, in one word. Mono, small caps, full ink. */
  kind: string;
  /** The state word, when this entry is a limit rather than an account. */
  stateLabel: string | null;
  register: Register;
  lines: readonly string[];
}>;

const ORDER: Readonly<Record<Register, number>> = { failed: 0, limited: 1, setup: 2, read: 3 };

export function limitsFrom(
  disclosures: readonly Disclosure[],
  chrome: HomeChrome,
  copy: HomeCopy,
): readonly LimitEntry[] {
  const noProjects = nothingConnectedYet(chrome);
  return disclosures.map((entry) => {
    const register = registerOfDisclosure(entry, noProjects);
    return {
      id: entry.id,
      kind: TONE_WORDS[entry.tone],
      // "Not connected · could not be read" reads as breakage. A kind of work
      // with no producer is not a read that failed, so the kind word stands on
      // its own and no failure vocabulary is borrowed for it.
      stateLabel: register === "setup" ? null : copy.states[entry.state],
      register,
      lines: [entry.text],
    };
  });
}

/**
 * WHAT THE READ COULD NOT DO, IN THE READING PATH.
 *
 * Round 1, four ballots: the coverage limits, the account of what the ranking
 * looked at and the kinds of work with no source were all parked in the foot
 * colophon, roughly 2,000px below the fold on desktop and 3,400px below it on
 * a phone. They now sit directly under the standfirst, above the first row, at
 * every width. The imprint at the foot keeps the identity of the read; it no
 * longer keeps the honesty of it.
 */
export function Limits({ entries }: Readonly<{ entries: readonly LimitEntry[] }>) {
  const kept = entries
    .map((entry) => ({ ...entry, lines: entry.lines.filter((line) => line.length > 0) }))
    .filter((entry) => entry.lines.length > 0)
    .sort((a, b) => ORDER[a.register] - ORDER[b.register]);

  if (kept.length === 0) return null;

  return (
    <ul className="ed-limits">
      {kept.map((entry) => (
        <li key={entry.id} data-register={entry.register}>
          <p className="ed-limit-head">
            {entry.register === "read" ? null : (
              <span className="ed-limit-mark" data-register={entry.register} aria-hidden="true" />
            )}
            <span className="ed-limit-kind">
              {entry.stateLabel === null ? entry.kind : `${entry.kind} · ${entry.stateLabel}`}
            </span>
          </p>
          {entry.lines.map((line) => (
            <p key={line} className="ed-limit-text">
              {line}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

/**
 * The read of the three modes the reader is not standing in. Rendered as one
 * ledger line inside the limits run, so a founder in Today learns that the
 * Inbox was only partly read without visiting it.
 */
export function otherModesEntry(
  readings: readonly ModeReading[],
  current: string,
): LimitEntry | null {
  const limited = readings.filter(
    (reading) =>
      reading.mode !== current &&
      (reading.register === "limited" || reading.register === "failed"),
  );
  if (limited.length === 0) return null;
  const worst = limited.reduce((held, reading) =>
    ORDER[reading.register] < ORDER[held.register] ? reading : held,
  );
  return {
    id: "ed-other-modes",
    kind: "Elsewhere in Home",
    stateLabel: null,
    register: worst.register,
    lines: limited.map((reading) => `${reading.label} · ${reading.stateLabel}`),
  };
}

export function Provenance({ provenance }: Readonly<{ provenance: Provenance }>) {
  return <span className="ed-prov">{provenance.text}</span>;
}

/**
 * THE LEDGER FIELD — when a row is due, and whether it is late.
 *
 * Round 1, two ballots: lateness was set in `--status-blocked` at 13px, which
 * is 3.76:1 and fails, and it was ALSO the colour reserved for a source that
 * could not be read, so the reserved signal was diluted by the routine one. It
 * is now ink at medium weight against faint ink for the date, with a short rule
 * struck in front of it. Lateness is legible in greyscale, in forced colours
 * and to a reader who cannot separate red from grey, and red belongs to failure
 * alone.
 */
export function When({
  when,
  className,
}: Readonly<{ when: WhenLabel; className?: string }>) {
  return (
    <p
      className={className === undefined ? "ed-when" : `${className} ed-when`}
      data-overdue={when.overdue ? "true" : undefined}
    >
      <b>{when.relative}</b>
      <span>{when.absolute}</span>
    </p>
  );
}

/**
 * A FIRST SCREEN THAT GOES SOMEWHERE.
 *
 * Round 1: "a dead end that is accurately labelled is still a dead end, and
 * this is the one screen where human respect outranks epistemic precision."
 * The state is still named exactly, and now it is followed by the one real move
 * available: work lives in a Project, and Projects are made in Tasks. The link
 * is the same production route the masthead carries, not a rehearsal of one.
 */
export function FirstRun({ line }: Readonly<{ line: string }>) {
  return (
    <section className="ed-firstrun" aria-labelledby="ed-firstrun-heading">
      <h2 id="ed-firstrun-heading">Where to start</h2>
      <p>{line}</p>
      <p>Work lives in a project. Make one in Tasks, and Home reads it from the next read.</p>
      <p>
        <a className="ed-btn" data-weight="primary" href="/app/tasks">
          Open Tasks
        </a>
      </p>
    </section>
  );
}

// ── The imprint ─────────────────────────────────────────────────────────────

export type ImprintEntry = Readonly<{ term: string; lines: readonly (string | null)[] }>;

/**
 * THE IMPRINT — this direction's signature, edited.
 *
 * A newspaper prints who set it, on what press, from which plates. This page
 * prints how it was read: the instant, the scope, who is reading, and where new
 * work would land. Round 1 said the device was a genuine broadsheet move and
 * also that it had become a dumping ground that outweighed the answer on a
 * quiet day. So it kept the device and lost the dumping: everything the reader
 * needs in order to trust the numbers has moved up into the limits run, and
 * what remains is the imprint proper — three terms, the same three on every
 * mode, set small under a heavy rule with its standing head in the margin.
 */
export function Imprint({ entries }: Readonly<{ entries: readonly ImprintEntry[] }>) {
  const kept = entries
    .map((entry) => ({
      term: entry.term,
      lines: entry.lines.filter((line): line is string => line !== null && line.length > 0),
    }))
    .filter((entry) => entry.lines.length > 0);

  if (kept.length === 0) return null;

  return (
    <section className="ed-imprint" aria-labelledby="ed-imprint-heading">
      <h2 id="ed-imprint-heading">How this page was read</h2>
      <div className="ed-imprint-grid">
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
