/**
 * Signal Desk · the desk head.
 *
 * TWO BANDS, NOT THREE. Round 1 stacked products, then actor plus scope, then
 * the mode row, and put 190px between the top of the window and the first word
 * of the read — the heaviest shell in the lab, in a direction whose own brief
 * says the shell is quieter than the content. The three bands are now two, and
 * nothing was deleted to get there: the suite line pairs with the one control
 * that changes what Home reads, the mode row pairs with who is reading, and the
 * as-of moved out of the chrome entirely and into the readline, where it is a
 * fact about the read rather than a fact about the page. It used to be printed
 * twice within 210px. It is now printed once.
 *
 * It is still not sticky, which is a decision rather than an omission — every
 * sticky pixel is spent twice at 320 and at 400% zoom, and this direction would
 * rather spend it on the read.
 *
 * PER-MODE READ HEALTH, IN WORDS. Standing in Today you could not tell that
 * Analytics was partly read, so every mode change was taken blind.
 *
 * Round 2 answered that with a mark: a 6px upright tick beside each mode name,
 * whose meaning was recoverable only from a key at the foot of the page. Four
 * directors said the same thing about it in four different ways, and they were
 * right — a morning page must not need a decoder ring, and the one piece of
 * always-on chrome had become the least legible part of the state system. The
 * mark is deleted, and nothing replaced it in the tab row, because a tab row at
 * 320px cannot carry four state words without wrapping into a paragraph.
 *
 * What carries it instead is one line under the modes, in the direction's own
 * fielded grammar: the modes whose read did not finish, each named with its own
 * state word. "Inbox, partly read. My work, partly read. Analytics, not enough
 * history." No glyph, no key, legible at 200% text, and it wraps as a sentence
 * wraps rather than overflowing as a row does.
 *
 * The line is ABSENT when every other mode read in full, which is the same rule
 * the readline follows and the opposite of round 1's band: presence is the
 * signal. It names only the modes you are NOT standing in, because the readline
 * three inches below already carries the one you are. The state also stays in
 * each link's accessible name, so nothing here is the only channel.
 *
 * WHAT IS INVENTED HERE, said out loud. The lab shell publishes the Home layer
 * and nothing above it, so the suite line (Home · Notes · Tasks · Timeline) is
 * this direction's own. It exists because the responsive requirement is that
 * all four suite destinations stay visible at 320px, and a direction that
 * renders no suite line cannot be judged against it. Home carries
 * `aria-current="true"` and not `"page"`: the subtree match is `true`, the exact
 * match is `page`, and the exact match belongs to the mode below (D-HX04). The
 * three product paths are the canonical signed-in routes from the URL contract.
 */

import type { HomeChrome, HomeCopy } from "@/lib/home-layer/lab-shell";
import type { ReadClass } from "./parts";

const PRODUCTS: readonly Readonly<{ label: string; href: string }>[] = [
  { label: "Notes", href: "/app/notes" },
  { label: "Tasks", href: "/app/tasks" },
  { label: "Timeline", href: "/app/timeline" },
];

export type ModeRead = Readonly<{ klass: ReadClass; word: string }>;

/**
 * `notyet` is a fact about the reader, not about the read, so it never reaches
 * the strip. On a first morning all four modes are in it, and naming three of
 * them "nothing set up yet" under a headline that already says so is the
 * homework the panel marked the first screen down for.
 */
const isLimited = (read: ModeRead | undefined): read is ModeRead =>
  read !== undefined && read.klass !== "complete" && read.klass !== "notyet";

/**
 * "Inbox, My work and Analytics", never "Inbox, My work, Analytics".
 */
function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * GROUPED BY WHAT HAPPENED, NOT BY MODE.
 *
 * Printed one field per mode, a provider failure at 390 read "Inbox, did not
 * answer · My work, did not answer · Analytics, did not answer" and took three
 * lines of chrome to say one thing three times. Grouped, the same fact is one
 * field and one line: "Did not answer: Inbox, My work and Analytics". The state
 * leads, which is the same order the readline uses, so the two are one grammar.
 */
function groupByWord(
  entries: readonly Readonly<{ label: string; word: string }>[],
): readonly Readonly<{ word: string; names: string }>[] {
  const order: string[] = [];
  const byWord = new Map<string, string[]>();
  for (const entry of entries) {
    const names = byWord.get(entry.word);
    if (names) {
      names.push(entry.label);
    } else {
      order.push(entry.word);
      byWord.set(entry.word, [entry.label]);
    }
  }
  return order.map((word) => ({ word, names: nameList(byWord.get(word) ?? []) }));
}

export function DeskHead({
  chrome,
  copy,
  homeHref,
  badgeName,
  badgeCoverage,
  modeRead,
  depth,
}: {
  chrome: HomeChrome;
  copy: HomeCopy;
  homeHref: string;
  badgeName: string;
  /** A count that could not be closed is drawn open, not rounded down. */
  badgeCoverage: "complete" | "partial" | "unavailable";
  /** How each mode's own read went, for the mode you are not standing in. */
  modeRead: Readonly<Record<string, ModeRead>>;
  /**
   * The full briefing is depth from Today, not a fifth mode, so it takes no
   * entry in the mode nav. It still has to satisfy R1: exactly one element in
   * the document carries `aria-current="page"` and its href is the current URL.
   * On the briefing that element is this crumb's second link, and Today's mode
   * link drops to `aria-current="true"` — the subtree match — which is D-HX04
   * read exactly as written.
   */
  depth: Readonly<{ parentHref: string; selfHref: string; label: string }> | null;
}) {
  const readScope = chrome.scope.options.filter((option) => option.group === "read-scope");
  const projects = chrome.scope.options.filter((option) => option.group === "project");

  /*
   * NOT ON THE FULL BRIEFING, which is the one page that already carries a third
   * band. The briefing is depth reached from Today, where the reader has just
   * read this exact line, and stacking a fourth band on the page a director
   * already called over-chromed would be the shell competing with what it
   * frames. It returns the moment they go back up.
   */
  const elsewhere = groupByWord(
    depth !== null
      ? []
      : chrome.modes.flatMap((mode) => {
          if (mode.ariaCurrent !== null) return [];
          const read = modeRead[mode.mode];
          if (!isLimited(read)) return [];
          return [{ label: mode.label, word: read.word }];
        }),
  );

  return (
    <header className="dk-head">
      <div className="dk-head-inner dk-frame">
        <div className="dk-row">
          <nav className="dk-suite" aria-label="Signal Studio products">
            <ul>
              <li>
                <a href={homeHref} aria-current="true">
                  Home
                </a>
              </li>
              {PRODUCTS.map((product) => (
                <li key={product.label}>
                  <a href={product.href}>{product.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <details className="dk-scope">
            <summary>
              <span className="dk-key">Home is reading</span>
              <span className="dk-scope-label">{chrome.scope.label}</span>
            </summary>
            <div className="dk-scope-panel">
              <p className="dk-scope-help">{chrome.scope.helpLine}</p>

              <div className="dk-scope-group">
                <p className="dk-key">What Home reads</p>
                <ul>
                  {readScope.map((option) => (
                    <li key={option.id}>
                      <a href={option.href} aria-current={option.current ? "true" : undefined}>
                        {option.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="dk-scope-group">
                <p className="dk-key">Read one project on its own</p>
                <ul>
                  {projects.map((option) => (
                    <li key={option.id}>
                      <a href={option.href} aria-current={option.current ? "true" : undefined}>
                        {option.label}
                      </a>
                    </li>
                  ))}
                </ul>
                {chrome.scope.resetHref ? (
                  <p className="dk-scope-help dk-scope-tail">
                    <a href={chrome.scope.resetHref}>{chrome.scope.resetLabel}</a>
                  </p>
                ) : null}
              </div>

              <div className="dk-scope-group">
                <p className="dk-key">Where new work goes</p>
                <p className="dk-scope-help dk-scope-value">{chrome.activeProject.line}</p>
              </div>

              {chrome.scope.coverageLine ? (
                <div className="dk-scope-group">
                  <p className="dk-key">{copy.states.partial}</p>
                  <p className="dk-scope-help dk-scope-value">{chrome.scope.coverageLine}</p>
                </div>
              ) : null}
            </div>
          </details>
        </div>

        <div className="dk-row dk-row-modes">
          <nav className="dk-modes" aria-label={chrome.navLabel}>
            <ul>
              {chrome.modes.map((mode) => {
                const read = modeRead[mode.mode];
                const limited = isLimited(read);
                const base = mode.badge?.announce ? badgeName : mode.label;
                return (
                  <li key={mode.mode}>
                    <a
                      href={mode.href}
                      aria-current={mode.ariaCurrent ?? undefined}
                      /* One affordance announces the count, and this is it. The
                         numeral lives in its own element and is hidden from the
                         accessibility tree, so `Inbox8` cannot happen here. The
                         read state joins the same name rather than opening a
                         second one. */
                      aria-label={
                        limited
                          ? `${base}. ${read.word}.`
                          : mode.badge?.announce
                            ? badgeName
                            : undefined
                      }
                    >
                      {mode.label}
                      {mode.badge ? (
                        <>
                          {" "}
                          <span
                            className="dk-badge"
                            data-coverage={mode.badge.announce ? badgeCoverage : undefined}
                            aria-hidden="true"
                          >
                            {mode.badge.glyph}
                          </span>
                        </>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <p className="dk-actor">
            <strong>{chrome.actor.name}</strong>. {chrome.actor.roleLabel}.
          </p>

          {elsewhere.length > 0 ? (
            <p className="dk-elsewhere">
              <span className="dk-key">The other modes</span>
              {elsewhere.map((entry) => (
                <span className="dk-elsewhere-part" key={entry.word}>
                  <b>{entry.word}:</b> {entry.names}
                </span>
              ))}
            </p>
          ) : null}
        </div>

        {depth ? (
          <nav className="dk-depth" aria-label="Where you are">
            <ul>
              <li>
                <a href={depth.parentHref}>{copy.modeNames.today}</a>
              </li>
              <li>
                <a href={depth.selfHref} aria-current="page">
                  {depth.label}
                </a>
              </li>
            </ul>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
