"use client";

import { useId, useMemo, type CSSProperties, type ReactNode } from "react";
import type { Kind } from "./data";
import s from "./cover.module.css";

/*
 * Generated covers. Every cover is drawn in one fixed field (1400 × 600,
 * centred on the origin) and each view shows a window onto it: the card a
 * 400 × 300 window, the hub hero a much wider one. When a card grows into the
 * hero, the frame widens over the same drawing, so the cover reads as one
 * object rather than a swap.
 */

/*
 * Facts a cover can draw from, read from the project's own words. The cover is
 * a picture of the project, not only a colour: a twenty-guest winter wedding
 * and a hundred-and-twenty-guest harvest wedding should not look alike.
 */
export type CoverDetail = {
  guests?: number;
  winter: boolean;
  /** The project's own first word, set as the specimen on client covers. */
  word: string;
  /** What is being made, for the ruled list on client covers. */
  lines: string[];
};

const NUMBER_WORDS: Record<string, number> = {
  ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

export function coverDetail({ name, purpose }: { name: string; purpose: string }): CoverDetail {
  const text = `${name} ${purpose}`;
  const g = /(\d+|[a-z]+)\s+guests/i.exec(text);
  let guests: number | undefined;
  if (g) guests = /^\d+$/.test(g[1]) ? Number(g[1]) : NUMBER_WORDS[g[1].toLowerCase()];
  const winter = /winter|christmas|december|snow|by the fire/i.test(text);
  const word = (name.split(/\s+/)[0] ?? "Aa").replace(/['’]s$/i, "").replace(/[^\p{L}\p{N}&-]/gu, "") || "Aa";
  const made = purpose.split(/\s(?:for|on|at|to|before|with)\s/i)[0] ?? "";
  const lines = made
    .replace(/\.$/, "")
    .split(/,\s*|\s+and\s+/i)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((x) => x[0].toUpperCase() + x.slice(1));
  return { guests, winter, word, lines };
}

type ArtProps = {
  kind: Kind;
  hue: number;
  seed: string;
  initial: string;
  detail?: CoverDetail;
  /** Visible window in field units. */
  w: number;
  h: number;
  wrapped?: boolean;
  className?: string;
};

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FX = 700;
const FY = 300;

export function hueVar(hue: number): CSSProperties {
  return { ["--p" as string]: `var(--v3-project-${hue})` } as CSSProperties;
}

export function CoverArt({ kind, hue, seed, initial, detail, w, h, wrapped, className }: ArtProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const body = useMemo(() => draw(kind, seed, initial, uid, detail), [kind, seed, initial, uid, detail]);
  const ground = kind === "works" ? s.gBlue : kind === "school" ? s.gPaper : s.gGround;
  return (
    <svg
      className={`${s.art} ${wrapped ? s.wrapped : ""} ${className ?? ""}`}
      style={hueVar(hue)}
      viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect x={-FX} y={-FY} width={FX * 2} height={FY * 2} className={ground} />
      <g className={s.parallax}>{body}</g>
    </svg>
  );
}

function draw(kind: Kind, seed: string, initial: string, uid: string, detail?: CoverDetail): ReactNode {
  switch (kind) {
    case "wedding":
      return <Wedding seed={seed} uid={uid} guests={detail?.guests} winter={detail?.winter} />;
    case "event": {
      // Three motifs, picked by the name, so two parties side by side rarely match.
      const motif = (hash(seed) >>> 7) % 3;
      return motif === 0 ? <Event seed={seed} /> : motif === 1 ? <Lanterns seed={seed} /> : <Party seed={seed} />;
    }
    case "season":
      return <Season seed={seed} />;
    case "works":
      return <Works uid={uid} />;
    case "school":
      return <School seed={seed} uid={uid} />;
    case "agency":
      return <Agency word={detail?.word ?? initial} lines={detail?.lines ?? []} />;
  }
}

/* ── Wedding: linen weave with scattered petals ─────────────────── */

const PETAL = "M0,-1 C0.62,-0.62 0.58,0.52 0,1 C-0.58,0.52 -0.62,-0.62 0,-1Z";

const SPRIG = "M0,-1 L0,1 M0,-0.45 L0.5,-0.85 M0,-0.45 L-0.5,-0.85 M0,0.15 L0.5,-0.25 M0,0.15 L-0.5,-0.25 M0,0.7 L0.4,0.4 M0,0.7 L-0.4,0.4";

/* Petal density follows the guest count; a winter wedding scatters sprigs and snow instead. */
function Wedding({ seed, uid, guests, winter }: { seed: string; uid: string; guests?: number; winter?: boolean }) {
  const r = rng(seed);
  const density = guests ? Math.min(1.15, Math.max(0.3, guests / 110)) : 0.8;
  // Sprigs are sparser by nature; keep a small wedding readable, just quieter.
  const keep = winter ? Math.max(0.62, density) : density;
  const petals: ReactNode[] = [];
  let i = 0;
  for (let y = -FY; y < FY; y += 38) {
    for (let x = -FX; x < FX; x += 42) {
      const px = x + r() * 38;
      const py = y + r() * 34;
      // Denser towards the upper right: the scatter has a direction.
      const lean = Math.min(1, Math.max(0, (px - py + 300) / 900));
      if (r() > (0.22 + lean * 0.6) * keep) continue;
      const size = 6 + r() * 11;
      const rot = r() * 360;
      const tone = r();
      const cls = tone < 0.34 ? s.fInk : tone < 0.72 ? s.fMid : s.fHi;
      if (winter) {
        const sprig = r() > 0.45;
        petals.push(
          sprig ? (
            <path
              key={i++}
              d={SPRIG}
              className={tone < 0.5 ? s.sInk : s.sMid}
              strokeWidth={1.6}
              strokeLinecap="round"
              fill="none"
              vectorEffect="non-scaling-stroke"
              transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(rot % 70) - 35}) scale(${(size * 1.5).toFixed(1)})`}
            />
          ) : (
            <circle key={i++} cx={px} cy={py} r={1.6 + (size - 6) * 0.22} className={s.fSnow} />
          ),
        );
        continue;
      }
      petals.push(
        <path
          key={i++}
          d={PETAL}
          className={cls}
          transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${size.toFixed(1)})`}
        />,
      );
      if (r() > 0.7) {
        petals.push(<circle key={i++} cx={px + 14} cy={py - 9} r={1.8} className={s.fInk} opacity={0.45} />);
      }
    }
  }
  return (
    <>
      <defs>
        <pattern id={`linen${uid}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 1.5H6M0 4.5H6" className={s.sSoft} strokeWidth="0.7" />
          <path d="M1.5 0V6M4.5 0V6" className={s.sHi} strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect x={-FX} y={-FY} width={FX * 2} height={FY * 2} fill={`url(#linen${uid})`} opacity={0.7} />
      {petals}
    </>
  );
}

/* ── Event: bunting and confetti ─────────────────────────────────── */

function Event({ seed }: { seed: string }) {
  const r = rng(seed);
  const strings: ReactNode[] = [];
  // The name nudges where the strings start and how deep they hang.
  const shift = Math.round(r() * 200);
  const deep = 0.85 + r() * 0.35;
  const rows = [
    { y: -128, sag: 34 * deep, span: 260, offset: shift },
    { y: -64, sag: 26 * deep, span: 220, offset: 110 + shift / 2 },
  ];
  rows.forEach((row, ri) => {
    for (let x0 = -FX - row.offset; x0 < FX; x0 += row.span) {
      const x1 = x0 + row.span;
      const mid = (x0 + x1) / 2;
      strings.push(
        <path
          key={`s${ri}${x0}`}
          d={`M${x0} ${row.y} Q${mid} ${row.y + row.sag * 2} ${x1} ${row.y}`}
          className={s.sInk}
          strokeWidth="1.4"
          fill="none"
          opacity={0.55}
        />,
      );
      const flags = 7;
      for (let k = 1; k < flags; k++) {
        const t = k / flags;
        const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mid + t * t * x1;
        const y = (1 - t) * (1 - t) * row.y + 2 * (1 - t) * t * (row.y + row.sag * 2) + t * t * row.y;
        const cls = [s.fInk, s.fMid, s.fHi][(k + ri) % 3];
        const tilt = (t - 0.5) * 18;
        strings.push(
          <path
            key={`f${ri}${x0}${k}`}
            d="M-11 0 L11 0 L0 26Z"
            className={cls}
            transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(1)})`}
          />,
        );
      }
    }
  });
  const confetti: ReactNode[] = [];
  for (let n = 0; n < 150; n++) {
    const x = -FX + r() * FX * 2;
    const y = -10 + r() * (FY + 10);
    const cls = [s.fInk, s.fMid, s.fInk][n % 3];
    confetti.push(
      n % 2 === 0 ? (
        <rect
          key={n}
          x={-4}
          y={-1.6}
          width={8}
          height={3.2}
          rx={1}
          className={cls}
          opacity={0.7}
          transform={`translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${(r() * 180).toFixed(0)})`}
        />
      ) : (
        <circle key={n} cx={x} cy={y} r={2.2} className={cls} opacity={0.55} />
      ),
    );
  }
  return (
    <>
      {confetti}
      {strings}
    </>
  );
}


/* ── Event, lantern variant: paper lanterns on a sagging wire ────── */

function Lanterns({ seed }: { seed: string }) {
  const r = rng(seed);
  const span = 250 + Math.round(r() * 90);
  const start = -FX - Math.round(r() * span);
  const y0 = -92;
  const sag = 34 + r() * 14;
  const parts: ReactNode[] = [];
  const tones = [s.fInk, s.fMid, s.fSoft, s.fInk];
  let n = 0;
  for (let x0 = start; x0 < FX; x0 += span) {
    const x1 = x0 + span;
    const mid = (x0 + x1) / 2;
    parts.push(
      <path
        key={`w${x0}`}
        d={`M${x0} ${y0} Q${mid} ${y0 + sag * 2} ${x1} ${y0}`}
        className={s.sInk}
        strokeWidth="1.3"
        fill="none"
        opacity={0.5}
      />,
    );
    for (const t of [0.24, 0.5, 0.76]) {
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mid + t * t * x1;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
      const drop = 10 + r() * 26;
      const rx = 12 + r() * 9;
      const ry = rx * (1.05 + r() * 0.25);
      const cy = y + drop + ry;
      const cls = tones[n++ % tones.length];
      parts.push(
        <g key={`l${x0}${t}`}>
          <path d={`M${x.toFixed(1)} ${y.toFixed(1)} V${(cy - ry).toFixed(1)}`} className={s.sInk} strokeWidth="1.1" opacity={0.55} />
          <circle cx={x} cy={cy} r={rx * 1.9} className={s.fGlow} opacity={0.55} />
          <ellipse cx={x} cy={cy} rx={rx} ry={ry} className={cls} />
          {[0.55, 0.12].map((k) => (
            <ellipse
              key={k}
              cx={x}
              cy={cy}
              rx={rx * k}
              ry={ry}
              className={s.sHi}
              strokeWidth="1"
              fill="none"
              opacity={0.45}
            />
          ))}
          <rect x={x - rx * 0.42} y={cy - ry - 3} width={rx * 0.84} height={5} rx={1.5} className={s.fInk} />
          <rect x={x - rx * 0.42} y={cy + ry - 2} width={rx * 0.84} height={5} rx={1.5} className={s.fInk} />
          <path d={`M${x} ${(cy + ry + 3).toFixed(1)} v${(6 + r() * 8).toFixed(1)}`} className={s.sInk} strokeWidth="1.4" opacity={0.6} />
        </g>,
      );
    }
  }
  const motes: ReactNode[] = [];
  for (let k = 0; k < 70; k++) {
    const x = -FX + r() * FX * 2;
    const y = -40 + r() * (FY + 40);
    motes.push(<circle key={k} cx={x} cy={y} r={1.2 + r() * 1.6} className={k % 3 ? s.fMid : s.fInk} opacity={0.5} />);
  }
  return (
    <>
      {motes}
      {parts}
    </>
  );
}

/* ── Event, party variant: a balloon cluster and scalloped garland ─ */

const BALLOONS: [number, number, number][] = [
  // x, y, radius. The main cluster sits right of centre so it clears the
  // date badge (top left), avatars (bottom left) and ring (bottom right).
  [70, -92, 34],
  [124, -58, 30],
  [30, -38, 28],
  [96, -4, 25],
  [160, -120, 24],
  // Stragglers for the wide hero.
  [-420, -120, 30],
  [-470, -60, 24],
  [430, -150, 28],
  [480, -86, 22],
  [-620, 10, 26],
  [600, -40, 30],
];

function Party({ seed }: { seed: string }) {
  const r = rng(seed);
  const tones = [s.fInk, s.fMid, s.fInk, s.fSoft, s.fMid];
  const garland: ReactNode[] = [];
  const y0 = -142;
  for (let x = -FX, k = 0; x < FX; x += 34, k++) {
    garland.push(
      <path key={`g${k}`} d={`M${x} ${y0} a17 17 0 0 0 34 0Z`} className={k % 2 ? s.fMid : s.fSoft} />,
    );
  }
  const confetti: ReactNode[] = [];
  for (let n = 0; n < 110; n++) {
    const x = -FX + r() * FX * 2;
    const y = -FY + r() * FY * 2;
    const rot = (r() * 180).toFixed(0);
    confetti.push(
      n % 3 === 0 ? (
        <path
          key={n}
          d="M-6 0 q3 -4 6 0 t6 0"
          className={s.sInk}
          strokeWidth="1.6"
          fill="none"
          opacity={0.45}
          transform={`translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${rot})`}
        />
      ) : (
        <circle key={n} cx={x} cy={y} r={n % 2 ? 2.4 : 1.6} className={n % 2 ? s.fMid : s.fInk} opacity={0.6} />
      ),
    );
  }
  const balloons = BALLOONS.map(([x, y, rad], k) => {
    const sway = (r() - 0.5) * 30;
    const len = 120 + r() * 70;
    const rx = rad * 0.86;
    return (
      <g key={`b${k}`}>
        <path
          d={`M${x} ${y + rad + 6} q${sway} ${len * 0.35} 0 ${len * 0.6} t${-sway * 0.6} ${len * 0.4}`}
          className={s.sInk}
          strokeWidth="1.2"
          fill="none"
          opacity={0.5}
        />
        <ellipse cx={x} cy={y} rx={rx} ry={rad} className={tones[k % tones.length]} />
        <path d={`M${x - 5} ${y + rad + 6} L${x} ${y + rad - 1} L${x + 5} ${y + rad + 6}Z`} className={tones[k % tones.length]} />
        <ellipse
          cx={x - rx * 0.38}
          cy={y - rad * 0.42}
          rx={rx * 0.18}
          ry={rad * 0.26}
          className={s.fHi}
          opacity={0.75}
          transform={`rotate(-24 ${x - rx * 0.38} ${y - rad * 0.42})`}
        />
      </g>
    );
  });
  return (
    <>
      {confetti}
      <path d={`M${-FX} ${y0} H${FX}`} className={s.sInk} strokeWidth="1.2" opacity={0.4} />
      {garland}
      {balloons}
    </>
  );
}

/* ── Season: an awning with a scalloped valance and string lights ─ */

function Season({ seed }: { seed: string }) {
  const r = rng(seed);
  const edge = -40;
  const stripe = 40;
  const parts: ReactNode[] = [];
  for (let x = -FX, k = 0; x < FX; x += stripe, k++) {
    const cls = k % 2 === 0 ? s.fInk : s.fHi;
    parts.push(<rect key={`r${k}`} x={x} y={-FY} width={stripe} height={FY + edge} className={cls} />);
    parts.push(
      <path
        key={`c${k}`}
        d={`M${x} ${edge} A${stripe / 2} ${stripe / 2} 0 0 0 ${x + stripe} ${edge}Z`}
        className={cls}
      />,
    );
  }
  // Shadow under the valance.
  const shade: ReactNode[] = [];
  for (let x = -FX, k = 0; x < FX; x += stripe, k++) {
    shade.push(
      <path
        key={k}
        d={`M${x} ${edge + 4} A${stripe / 2} ${stripe / 2} 0 0 0 ${x + stripe} ${edge + 4}`}
        className={s.sInk}
        strokeWidth="3"
        fill="none"
        opacity={0.12}
      />,
    );
  }
  const lights: ReactNode[] = [];
  const span = 300;
  for (let x0 = -FX - 80; x0 < FX; x0 += span) {
    const x1 = x0 + span;
    const mid = (x0 + x1) / 2;
    const y0 = 58;
    const sag = 36;
    lights.push(
      <path
        key={`w${x0}`}
        d={`M${x0} ${y0} Q${mid} ${y0 + sag * 2} ${x1} ${y0}`}
        className={s.sInk}
        strokeWidth="1.2"
        fill="none"
        opacity={0.5}
      />,
    );
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mid + t * t * x1;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
      const lit = r() > 0.25;
      lights.push(
        <g key={`b${x0}${k}`}>
          {lit ? <circle cx={x} cy={y + 7} r={9} className={s.fGlow} /> : null}
          <circle cx={x} cy={y + 7} r={3.6} className={lit ? s.fBulb : s.fMid} />
        </g>,
      );
    }
  }
  return (
    <>
      {parts}
      {shade}
      {lights}
    </>
  );
}

/* ── Works: a blueprint with the barn in elevation ───────────────── */

function Works({ uid }: { uid: string }) {
  const ox = 40;
  const oy = 70;
  return (
    <>
      <defs>
        <pattern id={`minor${uid}`} width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" className={s.sLine} strokeWidth="0.6" fill="none" opacity={0.14} />
        </pattern>
        <pattern id={`major${uid}`} width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0H0V50" className={s.sLine} strokeWidth="1" fill="none" opacity={0.24} />
        </pattern>
      </defs>
      <rect x={-FX} y={-FY} width={FX * 2} height={FY * 2} fill={`url(#minor${uid})`} />
      <rect x={-FX} y={-FY} width={FX * 2} height={FY * 2} fill={`url(#major${uid})`} />
      <g className={s.sLine} fill="none" strokeWidth="1.6" strokeLinejoin="round" transform={`translate(${ox} ${oy})`}>
        {/* Walls and roof */}
        <path d="M-120 0 V-90 M150 -90 V0 M-140 0 H170" opacity={0.9} />
        <path d="M-136 -86 L15 -178 L166 -86" opacity={0.95} />
        <path d="M-120 -90 H150" opacity={0.5} strokeDasharray="4 4" />
        {/* Slates */}
        {Array.from({ length: 6 }, (_, k) => {
          const t = (k + 1) / 7;
          return (
            <path
              key={k}
              d={`M${-136 + 151 * t} ${-86 - 92 * t} L${166 - 151 * t} ${-86 - 92 * t}`}
              opacity={0.28}
              strokeWidth="1"
            />
          );
        })}
        {/* Door and windows */}
        <path d="M-10 0 V-54 A25 25 0 0 1 40 -54 V0" opacity={0.9} />
        <path d="M15 -79 V0" opacity={0.4} />
        <rect x={-92} y={-66} width={40} height={30} opacity={0.8} />
        <rect x={82} y={-66} width={40} height={30} opacity={0.8} />
        {/* Heating loop under the floor */}
        <path
          d="M-110 14 H140 V22 H-110 V30 H140"
          opacity={0.55}
          strokeDasharray="6 3"
          className={s.sWarm}
        />
        {/* Dimensions */}
        <path d="M-140 44 H170 M-140 38 V50 M170 38 V50" opacity={0.6} strokeWidth="1" />
        <path d="M196 0 V-178 M190 0 H202 M190 -178 H202" opacity={0.6} strokeWidth="1" />
      </g>
      <g className={s.tLine} transform={`translate(${ox} ${oy})`}>
        <text x={15} y={60} textAnchor="middle">
          14.2 m
        </text>
        <text x={212} y={-86}>7.8 m</text>
      </g>
      <g className={s.tLine}>
        <text x={432} y={170}>Elevation A, rev C</text>
        <text x={432} y={212}>Barn</text>
        <text x={532} y={212}>1:50</text>
      </g>
      {/* Title block, bottom right of the sheet */}
      <g className={s.sLine} fill="none" opacity={0.5} strokeWidth="1">
        <rect x={420} y={150} width={220} height={90} />
        <path d="M420 180 H640 M520 150 V240" />
      </g>
    </>
  );
}

/* ── School: graph paper, a margin and a plotted result ─────────── */

function School({ seed, uid }: { seed: string; uid: string }) {
  const r = rng(seed);
  const pts: [number, number][] = [];
  for (let x = -170, k = 0; x <= 660; x += 60, k++) {
    const y = 90 - k * 16 - Math.sin(k * 0.9) * 12 - r() * 8;
    pts.push([x, y]);
  }
  const line = pts.map(([x, y]) => `${x},${y.toFixed(1)}`).join(" ");
  const guess = pts.map(([x, y], k) => `${x},${(y + 34 - k * 2).toFixed(1)}`).join(" ");
  return (
    <>
      <defs>
        <pattern id={`g12${uid}`} width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0H0V12" className={s.sMid} strokeWidth="0.6" fill="none" opacity={0.45} />
        </pattern>
        <pattern id={`g60${uid}`} width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M60 0H0V60" className={s.sMid} strokeWidth="1.1" fill="none" opacity={0.7} />
        </pattern>
      </defs>
      <rect x={-FX} y={-FY} width={FX * 2} height={FY * 2} fill={`url(#g12${uid})`} />
      <rect x={-FX} y={-FY} width={FX * 2} height={FY * 2} fill={`url(#g60${uid})`} />
      <path d={`M-212 ${-FY} V${FY}`} className={s.sMargin} strokeWidth="1.6" />
      <path d="M-190 120 H680 M-190 120 V-300" className={s.sInk} strokeWidth="1.4" opacity={0.6} />
      <polyline points={guess} className={s.sMid} strokeWidth="2" fill="none" strokeDasharray="6 5" />
      <polyline points={line} className={s.sInk} strokeWidth="2.6" fill="none" strokeLinejoin="round" />
      {pts.map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={4} className={s.fDot} />
      ))}
      <text x={150} y={-44} textAnchor="end" className={s.tHand} style={{ fontSize: 15 }}>
        Which ball bounces highest?
      </text>
    </>
  );
}

/* ── Agency: the project's own first word, set as a type specimen ── */

function Agency({ word, lines }: { word: string; lines: string[] }) {
  // Sized so the word always fits the card's window with room for the badge and ring.
  const fs = Math.round(Math.min(52, 172 / (Math.max(word.length, 3) * 0.5)));
  const base = 12;
  const cap = base - fs * 0.69;
  const xh = base - fs * 0.46;
  const cx = 16;
  return (
    <>
      <path d={`M${-FX} ${base} H${FX}`} className={s.sInk} strokeWidth="1" opacity={0.5} />
      <path d={`M${-FX} ${xh.toFixed(1)} H${FX}`} className={s.sInk} strokeWidth="1" strokeDasharray="3 4" opacity={0.36} />
      <path d={`M${-FX} ${cap.toFixed(1)} H${FX}`} className={s.sInk} strokeWidth="1" strokeDasharray="3 4" opacity={0.36} />
      <text x={-540} y={base + 16} className={s.tSmall}>
        Baseline
      </text>
      <text x={-540} y={cap - 6} className={s.tSmall}>
        Cap height
      </text>
      <text x={cx} y={base} textAnchor="middle" className={s.tWord} style={{ fontSize: fs }}>
        {word}
      </text>
      <circle cx={cx} cy={cap} r={3} className={s.fInk} opacity={0.7} />
      <circle cx={cx} cy={base} r={3} className={s.fInk} opacity={0.7} />
      {lines.length > 0 ? (
        <text x={148} y={-52} textAnchor="end" className={s.tSmall}>
          {lines.join("  \u00b7  ")}
        </text>
      ) : null}
      {/* Below the card's window: a specimen line and the palette, seen when the cover opens wide. */}
      <text x={-560} y={112} className={s.tSpecimen}>
        Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk  0123456789
      </text>
      <path d={`M-560 126 H${-40}`} className={s.sInk} strokeWidth="1" opacity={0.3} />
      <g transform="translate(262 106)">
        {[s.fInk, s.fMid, s.fSoft, s.fHi].map((cls, k) => (
          <circle key={k} cx={k * 40} cy={0} r={15} className={cls} stroke="currentColor" strokeOpacity={0.12} />
        ))}
        <text x={0} y={36} className={s.tSmall}>
          Palette
        </text>
      </g>
      {/* The brief as a ruled list: visible when the cover opens wide. */}
      <g transform="translate(250 -118)">
        <text x={0} y={0} className={s.tSmall}>
          Deliverables
        </text>
        {lines.map((l, k) => (
          <g key={l} transform={`translate(0 ${24 + k * 26})`}>
            <path d="M0 8 H260" className={s.sInk} strokeWidth="1" opacity={0.3} />
            <rect x={0} y={-8} width={10} height={10} rx={2} className={s.sInk} fill="none" strokeWidth="1.2" opacity={0.7} />
            <text x={20} y={1} className={s.tList}>
              {l}
            </text>
          </g>
        ))}
      </g>
    </>
  );
}
