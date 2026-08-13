/**
 * Signal Desk · the desk head.
 *
 * The shell is deliberately the quietest thing on the page: three short bands
 * of 11px mono and one row of mode names, all on a warm tint, none of it taller
 * than the first paragraph of the read beneath it. It is not sticky, which is a
 * decision rather than an omission — every sticky pixel is spent twice at 320
 * and at 400% zoom, and this direction would rather spend it on the read.
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

const PRODUCTS: readonly Readonly<{ label: string; href: string }>[] = [
  { label: "Notes", href: "/app/notes" },
  { label: "Tasks", href: "/app/tasks" },
  { label: "Timeline", href: "/app/timeline" },
];

export function DeskHead({
  chrome,
  copy,
  homeHref,
  badgeName,
  depth,
}: {
  chrome: HomeChrome;
  copy: HomeCopy;
  homeHref: string;
  badgeName: string;
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

  return (
    <header className="dk-head">
      <div className="dk-head-inner">
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

        <div className="dk-deskline">
          <p className="dk-actor">
            <strong>{chrome.actor.name}</strong>. {chrome.actor.roleLabel}.
          </p>

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

          <p className="dk-asof">{chrome.asOf.line}</p>
        </div>

        <nav className="dk-modes" aria-label={chrome.navLabel}>
          <ul>
            {chrome.modes.map((mode) => (
              <li key={mode.mode}>
                <a
                  href={mode.href}
                  aria-current={mode.ariaCurrent ?? undefined}
                  /* One affordance announces the count, and this is it. The
                     numeral lives in its own element and is hidden from the
                     accessibility tree, so `Inbox8` cannot happen here. */
                  aria-label={mode.badge?.announce ? badgeName : undefined}
                >
                  {mode.label}
                  {mode.badge ? (
                    <>
                      {" "}
                      <span className="dk-badge" aria-hidden="true">
                        {mode.badge.glyph}
                      </span>
                    </>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </nav>

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
