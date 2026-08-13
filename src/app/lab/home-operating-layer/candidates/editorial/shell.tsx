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
  FirstRunView,
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
 * THE WEATHER BAND — the state of the read, at page scale.
 *
 * Round 1 put a flag beside the dateline. Round 2 said, on three ballots, that
 * it was not enough: "the quiet day and the broken provider must differ in
 * something a reader registers before reading, not in the fill of a 10px mark";
 * "carry the red into the rule system or the headline area so the failure has
 * page-level weight"; "glance at it from a metre away and the two pages have
 * the same shape and the same weight."
 *
 * So the flag became the top edge of the page. Same words, same vocabulary,
 * same three registers — and now a rule that runs the whole page grid, ranked
 * by weight as well as by hue:
 *
 *   read     nothing. A complete read draws no band, so presence is the signal.
 *   limited  a 2px amber rule. This finally gives amber a structural job; round
 *            2 called it "the least resolved colour decision on the page".
 *   failed   a 4px red rule, the words at reading size rather than label size.
 *
 * The words come first in the source and in the reading order, so the failure
 * is named before any mark is reached — the one thing round 2 explicitly asked
 * to protect about the old flag.
 */
export function Weather({
  register,
  kind,
  stateLabel,
}: Readonly<{ register: Register; kind: string | null; stateLabel: string }>) {
  if (register === "read") return null;
  return (
    <p className="ed-weather" data-register={register}>
      <span className="ed-weather-words">
        {kind === null ? stateLabel : `${kind} · ${stateLabel}`}
      </span>
      <span className="ed-weather-mark" aria-hidden="true" />
    </p>
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

/**
 * THE FOLIO — the instant this page was read.
 *
 * Round 2: "Two stacked eyebrows above the headline — the mono dateline, then
 * 'TODAY' — is a small hierarchy muddle at the most-looked-at point on the
 * page." The mode name cannot move: HOME_EXPERIENCE D-HX02 requires it to reach
 * the accessible text of the `h1` as the `h1` itself or as a visible eyebrow
 * inside it. So the DATELINE moved instead. Above 70rem it hangs in the spine,
 * right-aligned beside the headline in the column where every other label in
 * this direction lives. Below 70rem it drops under the headline and becomes a
 * byline, which is where a broadsheet puts a date anyway. Either way exactly
 * one eyebrow now sits above the title.
 *
 * The flag left with it. Round 2 was right that a mono chip beside a date is
 * not an at-a-glance signal; the state of the read is now carried by the rule
 * across the top of the page and by the state column, both of which are
 * page-scale. Saying it a third time in 11px type was repetition, not emphasis.
 */
export function Folio({ chrome }: Readonly<{ chrome: HomeChrome }>) {
  return (
    <p className="ed-folio">
      <span className="ed-label">{chrome.asOf.line}</span>
    </p>
  );
}

/**
 * A NAMED WAY BACK, not only a mark.
 *
 * Round 2: "The return from Full briefing is a small monospaced dateline link
 * plus a dotted underline on the Today tab. The dotted underline is a lovely,
 * exact detail, but as the only return affordance it is the least discoverable
 * of the four." The dotted underline stays — two directors called it the most
 * sophisticated single detail in the lab, and it says something the control
 * cannot, which is that Today is still your position. This adds the control
 * the reader can actually see and hit: the shell's own return label, at 44px,
 * above the fold, in the spine.
 */
export function Return({ href, label }: Readonly<{ href: string; label: string }>) {
  return (
    <p className="ed-return">
      <a href={href}>{label}</a>
    </p>
  );
}

/**
 * THE STATE OF THE READ — this direction's answer to "what is the width for".
 *
 * Round 2's blocking fault, on five ballots: "The caveat ledger is placed
 * between the standfirst and the content on every mode... the first decision
 * does not appear until 811px down a 960px viewport. Honesty has been given the
 * position that belongs to the decisions." Every one of those ballots offered
 * the same escape: collapse it to a summary line with the detail one
 * interaction away. That is what this is, and the width is what makes it more
 * than a compromise.
 *
 * LAB_BRIEF Amendment 1 asks a direction to make a deliberate decision about
 * the full width and be able to name it. The decision: **the page has a spine,
 * a measure and a shoulder, and the shoulder carries the state of the read.**
 * The spine (10rem) carries what a line is called. The measure (40rem) carries
 * the prose and never widens. The shoulder (the remaining ~20rem at 1440)
 * carries the read's own condition, beside the headline rather than under it.
 * So at 1440 the honesty is not moved down, it is moved SIDEWAYS: it loses no
 * rank and the decisions get the top of the measure. Below 70rem there is no
 * shoulder, so this becomes one line under the standfirst — about 60px, where
 * the ledger used to spend 350.
 *
 * Two things are always on the surface at every width: the mark, and the worst
 * limit written out in the shell's own words. The LIST is behind the summary.
 * A failed read opens itself: `open` is set on the server when a source did not
 * answer, so the one register that must not be a click away never is.
 */
export function ReadState({ entries }: Readonly<{ entries: readonly LimitEntry[] }>) {
  const kept = sortLimits(entries);
  if (kept.length === 0) return null;

  const first = kept[0];
  if (first === undefined) return null;
  const rest = kept.slice(1);
  // Counted from the sentences, not from the blocks. Two modes read in part is
  // two facts, and saying "1" because they share a heading would be the kind of
  // convenient arithmetic this programme exists to remove.
  const more = rest.reduce((total, entry) => total + entry.lines.length, 0);

  return (
    <aside className="ed-read" data-register={first.register} aria-labelledby="ed-read-heading">
      <p className="ed-read-term" id="ed-read-heading">
        What qualifies this read
      </p>
      {/* The worst thing about this read, whole. Not a précis of it, not the
          first line of it: the entry as the ledger holds it, marks and all. The
          disclosure below carries what is left, and says how much that is. */}
      <Limits entries={[first]} />
      {more === 0 ? null : (
        // MEASURED, NOT ASSUMED. This opened itself on a failed read, on the
        // theory that the one register that must not be a click away never
        // should be. The capture said otherwise: at 390 the expanded list put
        // the first ranked decision at y=831 of 844 on the provider-failure
        // day, which is the exact fault this round exists to fix, reintroduced
        // by a well-meant exception. It costs nothing to close, because the
        // failure's own sentence is on the surface either way and the page
        // already carries a 4px red rule across the top of it. What was behind
        // the disclosure was never the failure — it was the three modes the
        // failure reached, which are the consequence and not the news.
        <details className="ed-read-more">
          <summary>
            <span>
              {more === 1
                ? "1 more thing qualifies this read"
                : `${more} more things qualify this read`}
            </span>
          </summary>
          <Limits entries={rest} />
        </details>
      )}
    </aside>
  );
}

/**
 * The word and the mark for the read as a whole, taken from whatever produced
 * the register so the two never disagree.
 */
export function readingOf(
  state: HomeStateName,
  disclosures: readonly Disclosure[],
  chrome: HomeChrome,
  copy: HomeCopy,
): Readonly<{ register: Register; kind: string | null; stateLabel: string }> {
  const noProjects = nothingConnectedYet(chrome);
  const register = registerFor(state, disclosures, noProjects);
  const lead = leadDisclosure(disclosures, noProjects);
  return {
    register,
    kind: lead === null ? null : TONE_WORDS[lead.tone],
    stateLabel: lead === null ? copy.states[state] : copy.states[lead.state],
  };
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
  /**
   * One register per line, when the lines are themselves keyed things — the
   * modes you are not standing in. Each line then draws ITS OWN mark, which is
   * what turns this run into a legend for the marks in the navigation above it.
   * A shared mark would be a lie the moment one mode failed and another was
   * merely partly read.
   */
  lineRegisters?: readonly Register[];
}>;

const ORDER: Readonly<Record<Register, number>> = { failed: 0, limited: 1, setup: 2, read: 3 };

/** Empty lines dropped, worst first. One ordering, used by everything. */
function sortLimits(entries: readonly LimitEntry[]): readonly LimitEntry[] {
  return entries
    .map((entry) => ({ ...entry, lines: entry.lines.filter((line) => line.length > 0) }))
    .filter((entry) => entry.lines.length > 0)
    .sort((a, b) => ORDER[a.register] - ORDER[b.register]);
}

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
  const kept = sortLimits(entries);
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
          {entry.lines.map((line, index) => {
            const keyed = entry.lineRegisters?.[index];
            // THE KEY, at the point of use. Round 2, three ballots: "the
            // coloured glyphs beside Inbox, My work and Analytics in the mode
            // row are never legended", "the navigation itself is a shape", "A
            // carries an explicit legend for exactly this class of mark."
            // Printing each mode's own mark against its own name, in the same
            // words the link's accessible name uses, makes this run teach the
            // navigation above it on first contact.
            return keyed === undefined ? (
              <p key={line} className="ed-limit-text">
                {line}
              </p>
            ) : (
              <p key={line} className="ed-limit-text ed-limit-keyed">
                <span className="ed-limit-mark" data-register={keyed} aria-hidden="true" />
                {line}
              </p>
            );
          })}
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
    lineRegisters: limited.map((reading) => reading.register),
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
 * Round 2 called the result "the single best decision anyone made in this lab"
 * and told the other three to match it, so the composition is untouched.
 *
 * What changed in round 3 is where the words come from. This direction had to
 * write around a shell that resolved a new reader to `unavailable`, so the
 * sentences were hand-written here while the standfirst above still inherited
 * the failed-read line — "the most prominent sentence on the most fragile
 * screen is inherited from a different scenario." SYSTEMIC_FINDINGS made that
 * the shell's defect and it has been fixed: `props.firstRun` now carries the
 * heading, the sentence, the next step and at least one real action, and
 * `first-run` is a state with its own word. Every string below is the shell's.
 * Nothing about a person's first morning is improvised by a candidate any more.
 */
export function FirstRun({ view }: Readonly<{ view: FirstRunView }>) {
  return (
    <section className="ed-firstrun" aria-labelledby="ed-firstrun-heading">
      <h2 id="ed-firstrun-heading">{view.heading}</h2>
      <p className="ed-firstrun-lead">{view.line}</p>
      <p>{view.nextLine}</p>
      <ul className="ed-actions">
        {view.actions.map((action) => (
          <li key={action.id}>
            <a className="ed-btn" data-weight="primary" href={action.href}>
              {action.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── The imprint ─────────────────────────────────────────────────────────────

export type ImprintEntry = Readonly<{ term: string; lines: readonly (string | null)[] }>;

/**
 * THE IMPRINT — this direction's signature, and now the home of what stands.
 *
 * A newspaper prints who set it, on what press, from which plates. This page
 * prints how it was read.
 *
 * Round 2 found two faults that turn out to be one fault: "the colophon at the
 * foot largely restates what the top ledger already said — the same accounting
 * is paid for twice", and "the two NOT CONNECTED rows render identically on
 * every screen in every scenario, healthy included. A caveat block that is
 * always present is a block the eye is trained to skip, which is precisely how
 * a real failure ends up unread."
 *
 * Both are cured by one cut, and the cut is a distinction worth making anyway:
 *
 *   what qualifies THIS READ    varies by morning. Coverage, failure,
 *                               freshness, access, scope, the other modes.
 *                               Lives at the top, in the state column.
 *   what STANDS                 true every morning until somebody changes it.
 *                               A kind of work with no producer at all, the
 *                               arithmetic of the read, what this list leaves
 *                               out by definition, who is reading and where new
 *                               work lands. Lives here, once.
 *
 * So the top now only ever shows what is different today, and nothing in the
 * document is said twice. The account did not lose rank; it stopped competing
 * with the news.
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
