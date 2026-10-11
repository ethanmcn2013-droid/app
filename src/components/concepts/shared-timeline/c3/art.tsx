"use client";

/* Hand-drawn SVG for the Invitation Suite: the wax seal, postmarks, ink
   stamps, a paper clip and the two maps. Colour comes from the suite's
   local tokens (currentColor or var(--is-*)), so every mark reads on the
   cream card in both themes. */

import { useId } from "react";
import s from "./c3.module.css";

/* ── Wax seal ──────────────────────────────────────────────────────── */

/** An irregular wax blob: a circle pushed out by a few seeded bumps. */
function blobPath(r: number, cx = 60, cy = 60) {
  const pts: string[] = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wobble = 1 + 0.045 * Math.sin(i * 2.7) + 0.03 * Math.cos(i * 5.1);
    pts.push(`${(cx + Math.cos(a) * r * wobble).toFixed(2)},${(cy + Math.sin(a) * r * wobble).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}
const BLOB = blobPath(54);

export function WaxSeal({ monogram, half }: { monogram: string; half?: "left" | "right" }) {
  const id = useId().replace(/:/g, "");
  const [a, b] = monogram.split(" & ");
  const single = !b;
  const letters = monogram.replace(/\s/g, "").split("");
  return (
    <svg viewBox="0 0 120 120" className={s.sealSvg} aria-hidden="true">
      <defs>
        <radialGradient id={`w${id}`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="var(--is-wax-hi)" />
          <stop offset="0.55" stopColor="var(--is-wax)" />
          <stop offset="1" stopColor="var(--is-wax-lo)" />
        </radialGradient>
        <radialGradient id={`i${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0.7" stopColor="var(--is-wax-lo)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--is-wax-lo)" stopOpacity="0.55" />
        </radialGradient>
        {half ? (
          <clipPath id={`c${id}`}>
            {half === "left" ? (
              <path d="M0 0 H63 L57 22 L66 40 L55 58 L64 78 L56 98 L61 120 H0 Z" />
            ) : (
              <path d="M63 0 H120 V120 H61 L56 98 L64 78 L55 58 L66 40 L57 22 Z" />
            )}
          </clipPath>
        ) : null}
      </defs>
      <g clipPath={half ? `url(#c${id})` : undefined}>
        <path d={BLOB} fill={`url(#w${id})`} />
        <circle cx="60" cy="60" r="38" fill={`url(#i${id})`} />
        <circle cx="60" cy="60" r="37" fill="none" stroke="var(--is-wax-lo)" strokeWidth="2.2" opacity="0.8" />
        <circle cx="60" cy="60" r="34.5" fill="none" stroke="var(--is-wax-hi)" strokeWidth="0.8" opacity="0.55" />
        {/* a sprig either side, pressed into the wax */}
        <g stroke="var(--is-wax-lo)" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.85">
          <path d="M60 88 C 52 86, 46 82, 42 76" />
          <path d="M60 88 C 68 86, 74 82, 78 76" />
          <path d="M48 83 l-4 -1 M45 80 l-4 0 M72 83 l4 -1 M75 80 l4 0" />
        </g>
        {[
          { dx: 0.9, dy: 1.1, fill: "var(--is-wax-hi)", op: 0.9 },
          { dx: 0, dy: 0, fill: "var(--is-wax-lo)", op: 1 },
        ].map((l, i) => (
          <text
            key={i}
            x={60 + l.dx}
            y={(single ? 71 : 70) + l.dy}
            textAnchor="middle"
            className={s.sealText}
            fill={l.fill}
            opacity={l.op}
          >
            {single ? (
              letters.join("")
            ) : (
              <>
                <tspan>{a}</tspan>
                <tspan className={s.sealAmp} dx="1" dy="-2">
                  &amp;
                </tspan>
                <tspan dx="1" dy="2">
                  {b}
                </tspan>
              </>
            )}
          </text>
        ))}
      </g>
    </svg>
  );
}

/* ── Postmark ──────────────────────────────────────────────────────── */

export function Postmark({ word, date, year }: { word: string; date: string; year: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 168 84" className={s.postmarkSvg} aria-hidden="true">
      <defs>
        <path id={`p${id}`} d="M 14 42 A 28 28 0 1 1 70 42 A 28 28 0 1 1 14 42" />
      </defs>
      <g fill="none" stroke="currentColor">
        <circle cx="42" cy="42" r="36" strokeWidth="2" />
        <circle cx="42" cy="42" r="22" strokeWidth="1.2" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M 84 ${22 + i * 10} q 10 -5 20 0 t 20 0 t 20 0 t 20 0`}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ))}
      </g>
      <text className={s.postmarkRing} fill="currentColor">
        <textPath href={`#p${id}`} startOffset="2%">
          {`${word} · The Orchard post · ${year} ·`}
        </textPath>
      </text>
      <text x="42" y="40" textAnchor="middle" className={s.postmarkDay} fill="currentColor">
        {date.split(" ")[0]}
      </text>
      <text x="42" y="53" textAnchor="middle" className={s.postmarkMonth} fill="currentColor">
        {date.split(" ")[1]?.slice(0, 3)}
      </text>
    </svg>
  );
}

/* ── Paper clip ────────────────────────────────────────────────────── */

export function PaperClip() {
  return (
    <svg viewBox="0 0 28 84" className={s.clipSvg} aria-hidden="true">
      <path
        d="M9 20 V64 a5 5 0 0 0 10 0 V14 a8 8 0 0 0 -16 0 V66 a11 11 0 0 0 22 0 V22"
        fill="none"
        stroke="var(--is-metal)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M9 20 V64 a5 5 0 0 0 10 0 V14 a8 8 0 0 0 -16 0 V66 a11 11 0 0 0 22 0 V22"
        fill="none"
        stroke="var(--is-metal-hi)"
        strokeWidth="0.8"
        strokeLinecap="round"
        transform="translate(-0.6 -0.6)"
      />
    </svg>
  );
}

/* ── Maps ──────────────────────────────────────────────────────────── */

/* Both maps are drawn to one scale: 100 viewBox units = 100 metres. */

function Tree({ x, y, r = 7 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="var(--is-map-tree)" stroke="var(--is-map-line)" strokeWidth="0.8" />
      <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.35} fill="var(--is-card)" opacity="0.35" />
    </g>
  );
}

function Stop({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="8.5" fill="var(--is-ink-accent)" />
      <text x={x} y={y + 3.6} textAnchor="middle" className={s.mapNum} fill="var(--is-card)">
        {n}
      </text>
    </g>
  );
}

export function OrchardMap({ highlight }: { highlight?: string }) {
  const trees: [number, number][] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) trees.push([118 + c * 24 + (r % 2) * 12, 58 + r * 22]);
  return (
    <svg viewBox="0 0 480 300" className={s.mapSvg} role="img" aria-label="Map of The Orchard: the gate, the lane, the orchard lawn, the terrace and the barn">
      {/* fields */}
      <rect x="0" y="0" width="480" height="300" fill="var(--is-map-ground)" />
      <path d="M0 240 C 80 226, 150 250, 230 236 S 380 214, 480 232 V300 H0 Z" fill="var(--is-map-field)" />
      {/* stream */}
      <path d="M470 0 C 440 60, 452 110, 418 160 S 400 250, 430 300" fill="none" stroke="var(--is-map-water)" strokeWidth="7" strokeLinecap="round" />
      <path d="M470 0 C 440 60, 452 110, 418 160 S 400 250, 430 300" fill="none" stroke="var(--is-map-ground)" strokeWidth="1.2" strokeDasharray="2 7" />
      {/* the lane */}
      <path d="M30 290 C 60 250, 60 220, 96 196 S 170 170, 230 176 S 300 196, 318 206" fill="none" stroke="var(--is-map-lane)" strokeWidth="11" strokeLinecap="round" />
      <path d="M30 290 C 60 250, 60 220, 96 196 S 170 170, 230 176 S 300 196, 318 206" fill="none" stroke="var(--is-map-line)" strokeWidth="0.8" strokeDasharray="1 5" />
      {/* orchard lawn */}
      <rect x="100" y="40" width="160" height="104" rx="6" fill="var(--is-map-lawn)" stroke="var(--is-map-line)" strokeWidth="0.8" />
      {trees.map(([x, y], i) => (
        <Tree key={i} x={x} y={y} r={6.5} />
      ))}
      {/* ceremony aisle */}
      <path d="M180 138 V 64" stroke="var(--is-card)" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
      {/* terrace */}
      <rect x="290" y="96" width="92" height="58" fill="var(--is-map-stone)" stroke="var(--is-map-line)" strokeWidth="0.8" />
      <path d="M290 110 H382 M290 124 H382 M290 138 H382 M313 96 V154 M336 96 V154 M359 96 V154" stroke="var(--is-map-line)" strokeWidth="0.5" opacity="0.6" />
      {/* barn */}
      <g className={highlight === "barn" ? s.mapHot : undefined}>
        <rect x="300" y="178" width="96" height="54" fill="var(--is-map-barn)" stroke="var(--is-map-line)" strokeWidth="1" />
        <path d="M300 205 H396" stroke="var(--is-map-line)" strokeWidth="1" />
        <path d="M300 178 L348 205 L396 178 M300 232 L348 205 L396 232" stroke="var(--is-map-line)" strokeWidth="0.5" opacity="0.6" fill="none" />
      </g>
      {/* paddock parking */}
      <rect x="40" y="150" width="54" height="36" fill="none" stroke="var(--is-map-line)" strokeWidth="0.8" strokeDasharray="3 3" />
      {/* gate */}
      <path d="M18 284 L42 296" stroke="var(--is-map-line)" strokeWidth="3" strokeLinecap="round" />
      {/* walking route */}
      <path d="M36 280 C 64 236, 80 214, 120 190 S 176 150, 180 142" fill="none" stroke="var(--is-ink-accent)" strokeWidth="1.6" strokeDasharray="4 4" />
      <path d="M186 132 C 230 120, 262 118, 290 124" fill="none" stroke="var(--is-ink-accent)" strokeWidth="1.6" strokeDasharray="4 4" />
      <path d="M336 156 V 176" fill="none" stroke="var(--is-ink-accent)" strokeWidth="1.6" strokeDasharray="4 4" />
      <Stop x={36} y={270} n={1} />
      <Stop x={180} y={150} n={2} />
      <Stop x={336} y={125} n={3} />
      <Stop x={348} y={205} n={4} />
      {/* labels */}
      <g className={s.mapLabel} fill="var(--is-ink)">
        <text x="52" y="274">The gate</text>
        <text x="67" y="145" textAnchor="middle">Parking</text>
        <text x="180" y="30" textAnchor="middle">Orchard lawn</text>
        <text x="336" y="88" textAnchor="middle">Terrace</text>
        <text x="348" y="250" textAnchor="middle">The barn</text>
      </g>
      {/* north + scale */}
      <g transform="translate(446 34)" stroke="var(--is-ink)" fill="none" strokeWidth="1">
        <path d="M0 12 L0 -12 M-5 -5 L0 -12 L5 -5" />
        <text x="0" y="26" textAnchor="middle" className={s.mapSmall} fill="var(--is-ink)" stroke="none">N</text>
      </g>
      <g transform="translate(150 276)" className={s.mapSmall}>
        <path d="M0 6 H100 M0 2 V10 M50 4 V8 M100 2 V10" stroke="var(--is-ink)" strokeWidth="1" fill="none" />
        <text x="106" y="10" fill="var(--is-ink)">100 m</text>
      </g>
    </svg>
  );
}

export function SchoolMap() {
  return (
    <svg viewBox="0 0 480 300" className={s.mapSvg} role="img" aria-label="Map of St Brigid's: the back gate, the car park, reception, the main hall and the art rooms">
      <rect x="0" y="0" width="480" height="300" fill="var(--is-map-ground)" />
      {/* road */}
      <rect x="0" y="258" width="480" height="30" fill="var(--is-map-lane)" />
      <path d="M0 273 H480" stroke="var(--is-card)" strokeWidth="1.4" strokeDasharray="12 10" />
      <text x="470" y="252" textAnchor="end" className={s.mapLabel} fill="var(--is-ink)">Vevay Road</text>
      {/* pitch */}
      <rect x="310" y="24" width="150" height="96" fill="var(--is-map-lawn)" stroke="var(--is-map-line)" strokeWidth="0.8" />
      <path d="M385 24 V120 M310 72 H460" stroke="var(--is-card)" strokeWidth="1" opacity="0.8" />
      <circle cx="385" cy="72" r="14" fill="none" stroke="var(--is-card)" strokeWidth="1" opacity="0.8" />
      {/* car park */}
      <rect x="40" y="170" width="150" height="70" fill="none" stroke="var(--is-map-line)" strokeWidth="0.8" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${48 + i * 16} 170 V 194 M${48 + i * 16} 216 V 240`} stroke="var(--is-map-line)" strokeWidth="0.6" />
      ))}
      {/* buildings */}
      <rect x="60" y="40" width="210" height="46" fill="var(--is-map-stone)" stroke="var(--is-map-line)" strokeWidth="1" />
      <rect x="210" y="86" width="60" height="64" fill="var(--is-map-barn)" stroke="var(--is-map-line)" strokeWidth="1" />
      <rect x="60" y="86" width="44" height="40" fill="var(--is-map-stone)" stroke="var(--is-map-line)" strokeWidth="1" />
      <path d="M130 40 V86 M170 40 V86" stroke="var(--is-map-line)" strokeWidth="0.6" />
      {/* footprints route */}
      <path d="M232 258 C 232 230, 150 230, 110 206 S 90 150, 90 130" fill="none" stroke="var(--is-ink-accent)" strokeWidth="1.6" strokeDasharray="4 4" />
      <path d="M100 110 C 150 110, 190 120, 210 118" fill="none" stroke="var(--is-ink-accent)" strokeWidth="1.6" strokeDasharray="4 4" />
      <path d="M240 86 V 72" fill="none" stroke="var(--is-ink-accent)" strokeWidth="1.6" strokeDasharray="4 4" />
      <Stop x={232} y={250} n={1} />
      <Stop x={82} y={112} n={2} />
      <Stop x={240} y={126} n={3} />
      <Stop x={150} y={63} n={4} />
      <g className={s.mapLabel} fill="var(--is-ink)">
        <text x="246" y="238">Back gate</text>
        <text x="115" y="164" textAnchor="middle">Car park</text>
        <text x="82" y="146" textAnchor="middle">Reception</text>
        <text x="282" y="140">Main hall</text>
        <text x="165" y="30" textAnchor="middle">Art rooms 1 to 3</text>
        <text x="385" y="138" textAnchor="middle">Pitch</text>
      </g>
      <g transform="translate(24 214)" className={s.mapSmall}>
        <path d="M0 6 H100 M0 2 V10 M50 4 V8 M100 2 V10" stroke="var(--is-ink)" strokeWidth="1" fill="none" transform="scale(0.5 1)" />
        <text x="56" y="10" fill="var(--is-ink)">50 m</text>
      </g>
    </svg>
  );
}

/* ── Deckle filter (used by the reply card's paper) ────────────────── */

export function DeckleDefs({ id }: { id: string }) {
  return (
    <svg width="0" height="0" className={s.defs} aria-hidden="true" focusable="false">
      <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
