import type { Metadata } from "next";
import Link from "next/link";

/**
 * /lab/welcome-w — "W, the wildcard" exploration of the venue-branded
 * welcome (the screen a couple sees the moment they redeem a venue's
 * gifted code). Standing wildcard fixture: the brief for this slot is
 * to ignore the house design register entirely and ask whether "how
 * much venue branding is tasteful" is even the right question.
 *
 * Fixture: Glenmara House gifts Mara and Finn (wedding 19 September).
 * The required line "Compliments of Glenmara House" appears once, as
 * the payoff of opening the letter, not as decoration.
 *
 * Built with zero client JavaScript by default: the open/close moment
 * is a native <details>/<summary> disclosure, so it is keyboard
 * operable, has correct built-in expanded/collapsed semantics, and
 * needs no hydration. One small inline, defensively-wrapped <script>
 * remembers (via localStorage) that a couple already opened it, so a
 * second visit lands open immediately — that script is the only part
 * of the page that requires JavaScript; everything else degrades to a
 * plain, working page without it.
 *
 * Review-only: no auth, no production mutation, no server actions.
 * robots noindex to keep search engines away.
 */

export const metadata: Metadata = {
  title: "A gift has arrived · Glenmara House",
  description:
    "Lab W, the wildcard welcome exploration. Compliments of Glenmara House. Review only, not for production.",
  robots: { index: false, follow: false },
};

const STORAGE_KEY = "signal-lab.welcome-w-opened";

// Deterministic pseudo-scatter (golden-angle spacing) so the ember field
// is stable between server render and any later paint, no Math.random()
// during render.
const EMBERS = Array.from({ length: 13 }, (_, i) => {
  const left = Math.round(((i * 61.8) % 100) * 10) / 10;
  const delay = Math.round(((i * 0.87) % 5.2) * 100) / 100;
  const duration = 10 + ((i * 3) % 7);
  const size = 2 + (i % 3);
  const drift = (i % 2 === 0 ? 1 : -1) * (10 + ((i * 5) % 18));
  return { left, delay, duration, size, drift };
});

function SealFace() {
  return (
    <>
      <span className="lw-seal-drip lw-seal-drip-a" />
      <span className="lw-seal-drip lw-seal-drip-b" />
      <span className="lw-seal-drip lw-seal-drip-c" />
      <span className="lw-seal-shine" />
      <span className="lw-seal-crack lw-seal-crack-1" />
      <span className="lw-seal-crack lw-seal-crack-2" />
      <span className="lw-seal-mono">M · F</span>
    </>
  );
}

export default function WelcomeWildcardLabPage() {
  return (
    <main className="lw-stage">
      <style>{CSS}</style>

      <div className="lw-atmosphere" aria-hidden="true">
        <div className="lw-glow" />
        {EMBERS.map((ember, i) => (
          <span
            key={i}
            className="lw-ember"
            style={
              {
                left: `${ember.left}%`,
                width: `${ember.size}px`,
                height: `${ember.size}px`,
                animationDelay: `${ember.delay}s`,
                animationDuration: `${ember.duration}s`,
                "--lw-drift": `${ember.drift}px`,
              } as React.CSSProperties
            }
          />
        ))}
        <svg className="lw-grain" aria-hidden="true" focusable="false">
          <filter id="lwGrain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1  0 0 0 0 0.87  0 0 0 0 0.7  0 0 0 0.05 0"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#lwGrain)" />
        </svg>
      </div>

      <div className="lw-frame">
        <p className="lw-kicker">From Glenmara House</p>
        <h1 className="lw-h1">A gift has arrived for Mara and Finn.</h1>
        <p className="lw-sub">
          Glenmara House sent it ahead of the wedding on 19 September.
        </p>

        <details className="lw-details" id="lw-details" suppressHydrationWarning>
          <summary className="lw-summary">
            <span className="lw-seal" aria-hidden="true">
              <span className="lw-seal-body">
                <SealFace />
              </span>
            </span>
            <span className="lw-instruction">Break the seal to open it.</span>
          </summary>

          <div className="lw-letter">
            <p className="lw-eyebrow">Compliments of Glenmara House</p>
            <h2 className="lw-h2">Mara and Finn, this is yours to plan now.</h2>
            <p className="lw-body">
              The wedding is booked for 19 September. Signal Studio holds
              everything between now and then, the guest list, the
              suppliers, the running order, and the smaller decisions that
              need a home. From here, it’s between the two of you.
            </p>
            <Link href="/welcome/plan?context=wedding_season" className="lw-cta">
              Begin your plan
              <span className="lw-cta-arrow" aria-hidden="true">
                &#8594;
              </span>
            </Link>
          </div>
        </details>
      </div>

      <div className="lw-badge" aria-hidden="true">
        Lab W · wildcard
      </div>

      {/* Progressive enhancement only: the seal opens and the letter
          reads perfectly with this script blocked or absent. All it
          adds is memory, so a couple who already opened their letter
          sees it open immediately on a second visit. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var d=document.getElementById('lw-details');if(!d)return;if(window.localStorage.getItem('${STORAGE_KEY}')==='1'){d.open=true;}d.addEventListener('toggle',function(){if(d.open){try{window.localStorage.setItem('${STORAGE_KEY}','1');}catch(e){}}});}catch(e){}})();`,
        }}
      />
    </main>
  );
}

const CSS = `
.lw-stage, .lw-stage *, .lw-stage *::before, .lw-stage *::after {
  box-sizing: border-box;
}
.lw-stage {
  --lw-serif: Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", serif;
  --lw-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --lw-ink-deep: #0b0710;
  --lw-cream: #f6ead4;
  --lw-cream-dim: #e3d2b4;
  --lw-gold: #e2b360;
  --lw-garnet: #8a2b42;
  --lw-garnet-deep: #4a1220;
  --lw-parchment: #f7ecd8;
  --lw-parchment-ink: #2b1811;
  --lw-seal-size: clamp(84px, 20vw, 128px);

  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  width: 100%;
  overflow-x: clip;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: clamp(40px, 8vw, 88px) 20px clamp(64px, 10vw, 120px);
  background:
    radial-gradient(1200px 620px at 50% -8%, rgba(226, 179, 96, 0.16), transparent 60%),
    radial-gradient(900px 500px at 84% 6%, rgba(138, 43, 66, 0.24), transparent 65%),
    linear-gradient(180deg, #180d16 0%, #0b0710 55%, #0a060d 100%);
  color: var(--lw-cream);
  font-family: var(--lw-serif);
}

.lw-atmosphere {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.lw-glow {
  position: absolute;
  top: -10%;
  left: 50%;
  width: min(900px, 140vw);
  height: min(700px, 100vh);
  transform: translateX(-50%);
  background: radial-gradient(closest-side, rgba(226, 179, 96, 0.28), rgba(226, 179, 96, 0) 72%);
  animation: lw-breathe 7s ease-in-out infinite;
}
@keyframes lw-breathe {
  0%, 100% { opacity: 0.85; transform: translateX(-50%) scale(1); }
  50%      { opacity: 1;    transform: translateX(-50%) scale(1.04); }
}
.lw-ember {
  position: absolute;
  bottom: -20px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 214, 140, 0.95), rgba(255, 214, 140, 0) 70%);
  opacity: 0;
  animation-name: lw-ember-rise;
  animation-timing-function: ease-in;
  animation-iteration-count: infinite;
}
@keyframes lw-ember-rise {
  0%   { opacity: 0;    transform: translate(0, 0) scale(0.6); }
  12%  { opacity: 0.85; }
  85%  { opacity: 0.25; }
  100% { opacity: 0;    transform: translate(var(--lw-drift, 12px), -100vh) scale(1); }
}
.lw-grain {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.55;
  mix-blend-mode: overlay;
}

.lw-frame {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.lw-kicker {
  margin: 0 0 22px;
  font-family: var(--lw-sans);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--lw-gold);
}
.lw-h1 {
  margin: 0;
  max-width: 15ch;
  font-family: var(--lw-serif);
  font-weight: 600;
  font-size: clamp(1.9rem, 1.35rem + 2.4vw, 3.1rem);
  line-height: 1.08;
  letter-spacing: -0.01em;
  color: var(--lw-cream);
}
.lw-sub {
  margin: 16px 0 0;
  max-width: 42ch;
  font-family: var(--lw-serif);
  font-size: clamp(0.95rem, 0.88rem + 0.3vw, 1.05rem);
  line-height: 1.6;
  color: var(--lw-cream-dim);
}

.lw-details {
  margin-top: clamp(36px, 6vw, 56px);
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.lw-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  list-style: none;
  cursor: pointer;
  padding: 10px;
  border-radius: 24px;
  outline: none;
}
.lw-summary::-webkit-details-marker { display: none; }
.lw-summary::marker { content: ""; }

.lw-details:not([open]) .lw-summary:hover .lw-seal-body {
  transform: scale(1.035);
}
.lw-details:not([open]) .lw-summary:active .lw-seal-body {
  transform: scale(0.97);
}

.lw-seal {
  display: inline-grid;
  place-items: center;
  width: var(--lw-seal-size);
  height: var(--lw-seal-size);
  overflow: visible;
  transition: width 0.5s ease 0.15s, height 0.5s ease 0.15s;
}
.lw-details[open] .lw-seal {
  width: 0;
  height: 0;
}
.lw-seal-body {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 28%, #a5384f, #4a1220 72%);
  box-shadow:
    inset 0 -8px 14px rgba(0, 0, 0, 0.4),
    inset 0 5px 10px rgba(255, 255, 255, 0.1),
    0 14px 30px -10px rgba(0, 0, 0, 0.6);
  transform-origin: 50% 55%;
  transition: transform 0.6s cubic-bezier(0.3, 0.7, 0.15, 1) 0.1s, opacity 0.45s ease 0.1s;
}
.lw-seal-drip {
  position: absolute;
  bottom: -9%;
  width: 20%;
  height: 20%;
  border-radius: 50%;
  background: inherit;
}
.lw-seal-drip-a { left: 4%; }
.lw-seal-drip-b { left: 38%; width: 24%; height: 24%; bottom: -13%; }
.lw-seal-drip-c { right: 4%; }
.lw-seal-shine {
  position: absolute;
  left: 18%;
  top: 14%;
  width: 32%;
  height: 32%;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  filter: blur(1px);
}
.lw-seal-crack {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 60%;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, rgba(255, 224, 178, 0.9) 22%, rgba(255, 224, 178, 0.9) 78%, transparent);
  opacity: 0;
  transition: opacity 0.28s ease;
}
.lw-seal-crack-1 { transform: translate(-50%, -50%) rotate(16deg); }
.lw-seal-crack-2 { transform: translate(-50%, -50%) rotate(-22deg) translateX(6%); }
.lw-seal-mono {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--lw-serif);
  font-size: calc(var(--lw-seal-size) * 0.17);
  letter-spacing: 0.05em;
  color: rgba(255, 224, 178, 0.85);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5), 0 -1px 0 rgba(255, 255, 255, 0.12);
}

.lw-instruction {
  font-family: var(--lw-sans);
  font-size: 13.5px;
  color: var(--lw-cream-dim);
  transition: opacity 0.35s ease;
}

.lw-details[open] .lw-seal-crack { opacity: 0.9; }
.lw-details[open] .lw-seal-body {
  opacity: 0;
  transform: translateY(-14px) scale(0.82) rotate(-4deg);
}
.lw-details[open] .lw-instruction { opacity: 0.5; }

.lw-letter {
  margin-top: 28px;
  width: 100%;
  max-width: 560px;
  text-align: left;
  background: linear-gradient(180deg, #fbf3e4, #f2e5cb);
  color: var(--lw-parchment-ink);
  border-radius: 20px;
  padding: clamp(28px, 5vw, 44px) clamp(24px, 6vw, 40px);
  box-shadow:
    0 30px 60px -20px rgba(0, 0, 0, 0.55),
    inset 0 2px 0 rgba(255, 255, 255, 0.5),
    0 0 0 1px rgba(120, 70, 40, 0.12);
  animation: lw-unfurl 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) 0.18s both;
}
@keyframes lw-unfurl {
  from { opacity: 0; transform: translateY(18px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.lw-eyebrow {
  margin: 0 0 10px;
  font-family: var(--lw-sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--lw-garnet);
}
.lw-h2 {
  margin: 0 0 16px;
  font-family: var(--lw-serif);
  font-weight: 600;
  font-size: clamp(1.35rem, 1.1rem + 1.1vw, 1.9rem);
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--lw-parchment-ink);
}
.lw-body {
  margin: 0 0 26px;
  font-family: var(--lw-serif);
  font-size: clamp(0.98rem, 0.92rem + 0.2vw, 1.08rem);
  line-height: 1.68;
  color: var(--lw-parchment-ink);
}
.lw-cta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--lw-sans);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--lw-parchment);
  background: linear-gradient(180deg, #8a2b42, #5c1420);
  padding: 13px 24px;
  border-radius: 999px;
  text-decoration: none;
  box-shadow: 0 14px 28px -12px rgba(90, 15, 25, 0.55);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.lw-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 34px -12px rgba(90, 15, 25, 0.6);
}
.lw-cta:active { transform: translateY(0); }
.lw-cta-arrow { display: inline-block; transition: transform 0.25s ease; }
.lw-cta:hover .lw-cta-arrow { transform: translateX(3px); }

.lw-summary:focus-visible {
  outline: 3px solid var(--lw-gold);
  outline-offset: 6px;
  border-radius: 24px;
}
.lw-cta:focus-visible {
  outline: 3px solid var(--lw-garnet-deep);
  outline-offset: 4px;
}

.lw-badge {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 40;
  font-family: var(--lw-sans);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(246, 234, 212, 0.65);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(246, 234, 212, 0.16);
  padding: 6px 10px;
  border-radius: 999px;
  backdrop-filter: blur(6px);
  pointer-events: none;
}

@media (max-width: 420px) {
  .lw-kicker { margin-bottom: 16px; }
  .lw-letter { border-radius: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .lw-stage *, .lw-stage *::before, .lw-stage *::after {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
    scroll-behavior: auto !important;
  }
}
`;
