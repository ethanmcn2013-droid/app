/**
 * /lab/timeline-w — "W, the wildcard" exploration of the Shared Timeline.
 *
 * The Shared Timeline is a wedding couple's public keepsake: a venue gifts
 * the couple a private planning workspace, the couple publishes a few
 * things for family and friends, and this is the published result. This
 * variant is deliberately off the suite's design register (no tokens, no
 * Geist, no indigo anchor) to chase one thing: a mother saving the link.
 *
 * Review-only, not for production: no auth, no server actions, no
 * mutation, robots noindex.
 *
 * Deliberately a Server Component, not a client component. Keeping the
 * whole file server-rendered lets it export `metadata`/`viewport` (a
 * "use client" file cannot) while staying a single self-contained file.
 * All interactivity — scroll progress, the scroll-reveal of each chapter —
 * is a small vanilla script at the end of the markup, not React state. It
 * only ever touches elements inside its own root node, so it cannot leak
 * into the rest of the app if a reviewer navigates away client-side.
 *
 * Content is the project's canonical Shared Timeline fixture (Glenmara
 * House / Mara and Finn / 19 September), reproduced exactly. The one
 * in-copy mention of the venue ("One reply to Glenmara House.") is part of
 * that fixture text and stays as authored; it is a task instruction, not
 * attribution. Formal venue attribution is the single footer line the
 * product brief calls for, and nowhere else.
 */

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Mara & Finn",
  description: "A wedding keepsake for Mara and Finn.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0806",
};

// ─────────────────────────────────────────────────────────────────────────
// Content — the canonical Shared Timeline fixture, reproduced exactly.
// ─────────────────────────────────────────────────────────────────────────

type When =
  | { kind: "window"; label: string }
  | { kind: "date"; day: string; month: string };

type TimelineItem = {
  id: string;
  title: string;
  description: string;
  when: When;
  climax?: boolean;
};

type Chapter = {
  id: string;
  act: 1 | 2 | 3;
  label: string;
  description: string;
  items: TimelineItem[];
};

const CHAPTERS: Chapter[] = [
  {
    id: "chapter-now",
    act: 1,
    label: "Now",
    description: "The decisions that make the next month easier.",
    items: [
      {
        id: "confirm-ceremony-outline",
        title: "Confirm the ceremony outline",
        description: "Readings, music, and the people taking part.",
        when: { kind: "window", label: "This week" },
      },
      {
        id: "send-final-menu-choices",
        title: "Send the final menu choices",
        description: "One reply to Glenmara House.",
        when: { kind: "date", day: "28", month: "July" },
      },
    ],
  },
  {
    id: "chapter-soon",
    act: 2,
    label: "Soon",
    description: "Booked work that is close enough to prepare.",
    items: [
      {
        id: "supplier-check-in",
        title: "Supplier check-in",
        description: "Photographer, flowers, music, and transport.",
        when: { kind: "date", day: "12", month: "August" },
      },
      {
        id: "final-guest-count",
        title: "Final guest count",
        description: "The number the venue needs for rooms and dinner.",
        when: { kind: "date", day: "22", month: "August" },
      },
    ],
  },
  {
    id: "chapter-later",
    act: 3,
    label: "Later",
    description: "The shape of the day, held without false urgency.",
    items: [
      {
        id: "walk-through-the-day",
        title: "Walk through the day",
        description: "One calm run-through with the venue coordinator.",
        when: { kind: "date", day: "5", month: "September" },
      },
      {
        id: "wedding-day",
        title: "Wedding day",
        description: "Ceremony at 14:00. Dinner at 17:30.",
        when: { kind: "date", day: "19", month: "September" },
        climax: true,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Style — plain CSS in a scoped <style> tag (the pattern already used by
// src/components/dev-banner.tsx in this codebase). Not Tailwind: every
// class is prefixed lw- and every custom property is --lw-* so nothing
// here can collide with the site's own global classes (globals.css already
// defines unscoped `.reveal` and `.grain` rules) or its design tokens.
// ─────────────────────────────────────────────────────────────────────────

const CSS = `
#lw-root, #lw-root * { box-sizing: border-box; }
#lw-root h1, #lw-root h2, #lw-root h3, #lw-root p, #lw-root ol, #lw-root li { margin: 0; padding: 0; }
#lw-root ol { list-style: none; }
#lw-root {
  position: relative;
  isolation: isolate;
  overflow-x: clip;
  background: #0b0806;
  color: #f6ecd9;
  --lw-font-serif: ui-serif, Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif;
  --lw-font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-family: var(--lw-font-serif);
}

#lw-root [data-lw-act="1"] {
  --lw-bg: #0b0806;
  --lw-ink: #f6ecd9;
  --lw-ink-soft: #d9c9a8;
  --lw-accent: #d6a859;
  --lw-glow-rgb: 214, 168, 89;
  --lw-hairline: rgba(246, 236, 217, 0.16);
}
#lw-root [data-lw-act="2"] {
  --lw-bg: #171331;
  --lw-ink: #f3ecf6;
  --lw-ink-soft: #cdbfe0;
  --lw-accent: #cf9bb0;
  --lw-glow-rgb: 207, 155, 176;
  --lw-hairline: rgba(243, 236, 246, 0.16);
}
#lw-root [data-lw-act="3"] {
  --lw-bg: #f3e6cc;
  --lw-ink: #2a1c10;
  --lw-ink-soft: #4a3722;
  --lw-accent: #8a5a34;
  --lw-glow-rgb: 255, 214, 140;
  --lw-hairline: rgba(42, 28, 16, 0.14);
}

/* ── Skip link ─────────────────────────────────────────────────────── */
#lw-root .lw-skip {
  position: absolute;
  left: 1rem;
  top: -3.5rem;
  z-index: 100;
  background: #0b0806;
  color: #f6ecd9;
  padding: 0.75em 1.25em;
  border-radius: 0.5em;
  font-family: var(--lw-font-mono);
  font-size: 0.85rem;
  text-decoration: none;
  transition: top 160ms ease;
}
#lw-root .lw-skip:focus {
  top: 1rem;
}

/* ── Screen-reader-only text ──────────────────────────────────────── */
#lw-root .lw-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Scroll progress spine ────────────────────────────────────────── */
#lw-root .lw-progress {
  position: fixed;
  top: 0;
  right: 0;
  right: max(0px, env(safe-area-inset-right, 0px));
  width: 3px;
  height: 100%;
  background: rgba(140, 140, 140, 0.2);
  z-index: 40;
  pointer-events: none;
}
#lw-root .lw-progress-fill {
  width: 100%;
  height: 0%;
  background: linear-gradient(to bottom, #d6a859, #cf9bb0, #8a5a34);
  transition: height 120ms linear;
}

/* ── Film grain overlay ───────────────────────────────────────────── */
#lw-root .lw-grain {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  pointer-events: none;
  opacity: 0.05;
  mix-blend-mode: overlay;
}

/* ── Hero ──────────────────────────────────────────────────────────── */
#lw-root .lw-hero,
#lw-root .lw-scene {
  position: relative;
  overflow: hidden;
  background: var(--lw-bg);
  color: var(--lw-ink);
  min-height: 100vh;
  min-height: 100svh;
  display: flex;
  align-items: center;
}
#lw-root .lw-hero-inner,
#lw-root .lw-scene-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 46rem;
  margin-inline: auto;
  padding-inline: clamp(1.25rem, 6vw, 3rem);
  padding-block: clamp(3.5rem, 10vh, 6rem);
}
#lw-root .lw-kicker {
  font-family: var(--lw-font-mono);
  font-size: clamp(0.7rem, 1.6vw, 0.85rem);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--lw-accent);
  margin-block-end: 1.25rem;
}
#lw-root .lw-title {
  font-family: var(--lw-font-serif);
  font-weight: 400;
  font-size: clamp(3.25rem, 13vw, 8.5rem);
  line-height: 0.95;
  letter-spacing: -0.01em;
  margin: 0 0 1.5rem;
}
#lw-root .lw-amp {
  display: inline-block;
  margin-inline: 0.1em;
  color: var(--lw-accent);
  font-style: italic;
}
#lw-root .lw-hero-line {
  font-size: clamp(1.05rem, 2.6vw, 1.5rem);
  line-height: 1.5;
  color: var(--lw-ink-soft);
  max-width: 30ch;
  margin: 0 0 3rem;
}
#lw-root .lw-scroll-cue {
  font-family: var(--lw-font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lw-ink-soft);
  display: inline-flex;
  align-items: center;
  gap: 0.6em;
}
#lw-root .lw-scroll-cue .lw-arrow {
  display: inline-block;
}

/* ── Chapters ──────────────────────────────────────────────────────── */
#lw-root .lw-chapter-label {
  font-weight: 400;
  font-size: clamp(2.5rem, 8.5vw, 5rem);
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  margin: 0 0 0.75rem;
}
#lw-root .lw-chapter-desc {
  font-size: clamp(1.05rem, 2.4vw, 1.35rem);
  line-height: 1.5;
  color: var(--lw-ink-soft);
  max-width: 34ch;
  margin: 0 0 3rem;
}

/* ── Items ─────────────────────────────────────────────────────────── */
#lw-root .lw-items {
  display: flex;
  flex-direction: column;
  gap: 2.25rem;
}
#lw-root .lw-item {
  display: flex;
  align-items: baseline;
  gap: clamp(1.25rem, 4vw, 2.5rem);
  padding-block-start: 1.75rem;
  border-top: 1px solid var(--lw-hairline);
}
#lw-root .lw-item-copy h3 {
  font-weight: 400;
  font-size: clamp(1.4rem, 3.6vw, 2.1rem);
  line-height: 1.15;
  margin: 0 0 0.5rem;
}
#lw-root .lw-item-copy p {
  font-size: clamp(1rem, 2vw, 1.125rem);
  line-height: 1.6;
  color: var(--lw-ink-soft);
  max-width: 42ch;
  margin: 0;
}
#lw-root .lw-when {
  flex: 0 0 auto;
  width: clamp(4.5rem, 12vw, 6rem);
  font-family: var(--lw-font-mono);
}
#lw-root .lw-when-date .lw-when-day {
  display: block;
  font-size: clamp(2.25rem, 6.5vw, 3.5rem);
  line-height: 1;
  font-weight: 500;
  color: var(--lw-accent);
}
#lw-root .lw-when-date .lw-when-month {
  display: block;
  margin-top: 0.4em;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--lw-ink-soft);
}
#lw-root .lw-when-window .lw-when-label {
  display: inline-block;
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--lw-accent);
  line-height: 1.3;
}

/* ── Climax item (wedding day) ────────────────────────────────────── */
#lw-root .lw-climax {
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.25rem;
  padding-block: 2.5rem 0.5rem;
  margin-block-start: 0.5rem;
}
#lw-root .lw-climax-arc {
  width: min(100%, 22rem);
  margin-inline: auto;
}
#lw-root .lw-arc-svg {
  width: 100%;
  height: auto;
  display: block;
}
#lw-root .lw-arc-path {
  fill: none;
  stroke: var(--lw-accent);
  stroke-width: 1.5;
  opacity: 0.55;
}
#lw-root .lw-arc-sun {
  fill: #e0a04a;
  filter: drop-shadow(0 0 10px rgba(224, 160, 74, 0.7));
}
#lw-root .lw-climax .lw-when {
  width: auto;
  margin-block: 0.25rem 1rem;
}
#lw-root .lw-climax .lw-when-day {
  font-size: clamp(3rem, 9vw, 5rem);
}
#lw-root .lw-climax .lw-item-copy {
  max-width: 32ch;
}
#lw-root .lw-climax .lw-item-copy p {
  max-width: none;
}

/* ── Ambient glow ──────────────────────────────────────────────────── */
#lw-root .lw-glow {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 60% 45% at 50% 18%, rgba(var(--lw-glow-rgb), 0.4), transparent 70%);
}
#lw-root .lw-glow-hero {
  background: radial-gradient(ellipse 70% 55% at 50% 22%, rgba(var(--lw-glow-rgb), 0.45), transparent 72%);
}
@media (prefers-reduced-motion: no-preference) {
  #lw-root .lw-glow {
    animation: lw-drift 42s ease-in-out infinite alternate;
  }
}
@keyframes lw-drift {
  from { transform: translate(-3%, -2%) scale(1); }
  to   { transform: translate(3%, 2%) scale(1.06); }
}
@media (prefers-reduced-motion: no-preference) {
  #lw-root .lw-scroll-cue .lw-arrow {
    animation: lw-bob 1.8s ease-in-out infinite;
  }
}
@keyframes lw-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(4px); }
}

/* ── Act handoffs — a short gradient bleed into the next chapter's tone ── */
#lw-root .lw-handoff-2 { background: linear-gradient(to bottom, var(--lw-bg) 0%, var(--lw-bg) 88%, #171331 100%); }
#lw-root .lw-handoff-3 { background: linear-gradient(to bottom, var(--lw-bg) 0%, var(--lw-bg) 88%, #f3e6cc 100%); }

/* ── Footer ────────────────────────────────────────────────────────── */
#lw-root .lw-footer {
  background: var(--lw-bg);
  color: var(--lw-ink-soft);
  padding: clamp(2rem, 6vw, 3rem) clamp(1.25rem, 6vw, 3rem);
  text-align: center;
}
#lw-root .lw-footer p {
  font-family: var(--lw-font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  margin: 0;
}

/* ── Lab identification tag ───────────────────────────────────────── */
#lw-root .lw-tag {
  position: fixed;
  left: 14px;
  bottom: 14px;
  left: max(14px, env(safe-area-inset-left, 0px));
  bottom: max(14px, env(safe-area-inset-bottom, 0px));
  z-index: 45;
  font-family: var(--lw-font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  color: #f3ecd9;
  background: rgba(10, 8, 6, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  padding: 0.4em 0.85em;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* ── Scroll reveal — hidden default state lives ONLY behind the
   no-preference media query, so reduced-motion (and any environment
   where the wiring script never runs) always shows full content. ── */
#lw-root .lw-reveal { opacity: 1; transform: none; }
#lw-root[data-lw-motion="armed"] .lw-reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 900ms cubic-bezier(.2,.7,.2,1), transform 900ms cubic-bezier(.2,.7,.2,1);
}
#lw-root[data-lw-motion="armed"] .lw-reveal.lw-visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  #lw-root .lw-skip { transition: none; }
  #lw-root .lw-progress-fill { transition: none; }
}

@media (max-width: 30rem) {
  #lw-root .lw-item:not(.lw-climax) {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  #lw-root .lw-item:not(.lw-climax) .lw-when {
    width: auto;
  }
}
`;

// ─────────────────────────────────────────────────────────────────────────
// Behaviour — plain vanilla JS, not React state. Runs once, only ever
// queries/mutates inside #lw-root, so nothing here can outlive this page
// or bleed onto whatever a reviewer navigates to next. Progressive
// enhancement only: every element it can hide is already visible by
// default in the CSS above, so a JS failure degrades to a static page,
// never a blank one.
// ─────────────────────────────────────────────────────────────────────────

const SCRIPT = `
(function () {
  var root = document.getElementById('lw-root');
  if (!root) return;

  var fill = root.querySelector('[data-lw-progress-fill]');
  function updateProgress() {
    var doc = document.documentElement;
    var scrollTop = window.pageYOffset || doc.scrollTop || 0;
    var max = doc.scrollHeight - window.innerHeight;
    var pct = max > 0 ? Math.min(100, Math.max(0, (scrollTop / max) * 100)) : 0;
    if (fill) fill.style.height = pct + '%';
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      updateProgress();
      ticking = false;
    });
  }
  updateProgress();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateProgress);

  var mql = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function wireReveal() {
    if (mql && mql.matches) {
      root.removeAttribute('data-lw-motion');
      return;
    }
    root.setAttribute('data-lw-motion', 'armed');
    var targets = root.querySelectorAll('.lw-reveal');
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < targets.length; i++) targets[i].classList.add('lw-visible');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('lw-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    for (var j = 0; j < targets.length; j++) io.observe(targets[j]);
  }

  wireReveal();

  if (mql && typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', function (event) {
      if (event.matches) {
        root.removeAttribute('data-lw-motion');
      } else {
        wireReveal();
      }
    });
  }
})();
`;

// ─────────────────────────────────────────────────────────────────────────
// Markup
// ─────────────────────────────────────────────────────────────────────────

function WhenBadge({ when }: { when: When }) {
  if (when.kind === "window") {
    return (
      <div className="lw-when lw-when-window">
        <span className="lw-when-label">{when.label}</span>
      </div>
    );
  }
  return (
    <div className="lw-when lw-when-date">
      <span className="lw-when-day">{when.day}</span>
      <span className="lw-when-month">{when.month}</span>
    </div>
  );
}

function ClimaxArc() {
  return (
    <div className="lw-climax-arc" aria-hidden="true">
      <svg className="lw-arc-svg" viewBox="0 0 320 140" focusable="false">
        <path className="lw-arc-path" d="M8 132 Q160 4 312 132" />
        <circle className="lw-arc-sun" cx="160" cy="68" r="7" />
      </svg>
    </div>
  );
}

function TimelineItemRow({ item }: { item: TimelineItem }) {
  const isClimax = Boolean(item.climax);
  const className = "lw-item lw-reveal" + (isClimax ? " lw-climax" : "");
  return (
    <li className={className} id={item.id}>
      {isClimax ? <ClimaxArc /> : null}
      <WhenBadge when={item.when} />
      <div className="lw-item-copy">
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
    </li>
  );
}

function ChapterSection({
  chapter,
  handoffTo,
}: {
  chapter: Chapter;
  handoffTo?: 2 | 3;
}) {
  const headingId = chapter.id + "-heading";
  const className = "lw-scene" + (handoffTo ? " lw-handoff-" + handoffTo : "");
  return (
    <section
      id={chapter.id}
      className={className}
      data-lw-act={chapter.act}
      aria-labelledby={headingId}
    >
      <div className="lw-glow" aria-hidden="true" />
      <div className="lw-scene-inner">
        <h2 id={headingId} className="lw-chapter-label lw-reveal">
          {chapter.label}
        </h2>
        <p className="lw-chapter-desc lw-reveal">{chapter.description}</p>
        <ol className="lw-items">
          {chapter.items.map((item) => (
            <TimelineItemRow key={item.id} item={item} />
          ))}
        </ol>
      </div>
    </section>
  );
}

// The inline script at the end of this markup arms motion and sets the progress
// height before React hydrates, so both elements legitimately carry attributes
// the server never rendered. suppressHydrationWarning is the sanctioned way to
// say so; without it React logs a mismatch it explicitly will not patch up.
export default function TimelineWildcardLabPage() {
  return (
    <div id="lw-root" className="lw-root" suppressHydrationWarning>
      <style>{CSS}</style>

      <a className="lw-skip" href="#chapter-now">
        Skip to the timeline
      </a>

      <div className="lw-progress" aria-hidden="true">
        <div className="lw-progress-fill" data-lw-progress-fill suppressHydrationWarning />
      </div>

      <svg className="lw-grain" aria-hidden="true" focusable="false">
        <filter id="lw-grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#lw-grain-filter)" />
      </svg>

      <header className="lw-hero" data-lw-act="1">
        <div className="lw-glow lw-glow-hero" aria-hidden="true" />
        <div className="lw-hero-inner">
          <p className="lw-kicker lw-reveal">between now and the day itself</p>
          <h1 className="lw-title lw-reveal">
            <span>Mara</span>
            <span className="lw-amp" aria-hidden="true">
              {" & "}
            </span>
            <span className="lw-sr-only"> and </span>
            <span>Finn</span>
          </h1>
          <p className="lw-hero-line lw-reveal">
            Mara and Finn are getting married on 19 September.
          </p>
          <p className="lw-scroll-cue lw-reveal">
            <span className="lw-arrow" aria-hidden="true">
              ↓
            </span>
            keep scrolling
          </p>
        </div>
      </header>

      <main>
        <ChapterSection chapter={CHAPTERS[0]} handoffTo={2} />
        <ChapterSection chapter={CHAPTERS[1]} handoffTo={3} />
        <ChapterSection chapter={CHAPTERS[2]} />
      </main>

      <footer className="lw-footer" data-lw-act="3">
        <p>A keepsake from Glenmara House.</p>
      </footer>

      <div className="lw-tag">Lab W · wildcard</div>

      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}
