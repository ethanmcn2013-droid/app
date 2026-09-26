/*
 * Painted previews. Each scene is an SVG drawn at a width of 300 and the
 * asset's own aspect ratio, so the wall reads like the project's photographs
 * without shipping any. Deterministic: a seeded generator, never Math.random.
 */
import { useId, type ReactNode } from "react";
import type { Scene } from "./data";

const W = 300;

// Transcendental maths can differ in the last digit between the server and
// the browser, which would break hydration of the server-rendered wall.
// Rounding here keeps every painted coordinate identical on both.
const fix = (n: number) => Math.round(n * 1e6) / 1e6;
const sin = (a: number) => fix(Math.sin(a));
const cos = (a: number) => fix(Math.cos(a));
const pow = (a: number, b: number) => fix(Math.pow(a, b));

function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type P = { id: string; h: number; v: number };

/* ── shared pieces ─────────────────────────────────────────────────── */

function Glow({ id, blur = 6 }: { id: string; blur?: number }) {
  return (
    <filter id={id} x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation={blur} />
    </filter>
  );
}

function Bokeh({ n, h, colours, seed, id, min = 6, max = 22, opacity = 0.5 }: { n: number; h: number; colours: string[]; seed: number; id: string; min?: number; max?: number; opacity?: number }) {
  const r = seeded(seed);
  return (
    <g filter={`url(#${id})`} opacity={opacity}>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={r() * W} cy={r() * h} r={min + r() * (max - min)} fill={colours[i % colours.length]} />
      ))}
    </g>
  );
}

function Leaf({ x, y, len, angle, fill }: { x: number; y: number; len: number; angle: number; fill: string }) {
  return <ellipse cx={x} cy={y} rx={len} ry={len * 0.42} fill={fill} transform={`rotate(${angle} ${x} ${y})`} />;
}

function Sprig({ x, y, scale = 1, angle = 0, tones = ["#7f9a7d", "#a3b89c", "#6b8568"] }: { x: number; y: number; scale?: number; angle?: number; tones?: string[] }) {
  const leaves = [0, 1, 2, 3, 4, 5, 6];
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <path d="M0 0 C 6 -18, 10 -36, 8 -56" stroke="#6b7d5e" strokeWidth="1.4" fill="none" />
      {leaves.map((i) => {
        const t = i / 6;
        const lx = 6 * t + (i % 2 ? 5 : -5);
        const ly = -8 - t * 46;
        return <Leaf key={i} x={lx} y={ly} len={7 - t * 2.5} angle={i % 2 ? -30 : 210} fill={tones[i % tones.length]} />;
      })}
    </g>
  );
}

function Flame({ x, y, s = 1, glowId }: { x: number; y: number; s?: number; glowId: string }) {
  return (
    <g>
      <circle cx={x} cy={y - 3 * s} r={12 * s} fill="#ffc46b" opacity="0.55" filter={`url(#${glowId})`} />
      <path d={`M${x} ${y - 9 * s} C ${x + 3 * s} ${y - 4 * s}, ${x + 2.6 * s} ${y}, ${x} ${y + 0.5 * s} C ${x - 2.6 * s} ${y}, ${x - 3 * s} ${y - 4 * s}, ${x} ${y - 9 * s} Z`} fill="#fff1c9" />
      <ellipse cx={x} cy={y - 1.5 * s} rx={1.1 * s} ry={2 * s} fill="#ffb347" />
    </g>
  );
}

function Bloom({ x, y, r, tones, seed }: { x: number; y: number; r: number; tones: [string, string, string]; seed: number }) {
  const rnd = seeded(seed);
  const petals = 9;
  return (
    <g>
      <circle cx={x + r * 0.08} cy={y + r * 0.12} r={r * 1.02} fill="#000" opacity="0.12" />
      {Array.from({ length: petals }, (_, i) => {
        const a = (i / petals) * Math.PI * 2 + rnd();
        return <ellipse key={i} cx={x + cos(a) * r * 0.5} cy={y + sin(a) * r * 0.5} rx={r * 0.58} ry={r * 0.44} fill={tones[0]} transform={`rotate(${(a * 180) / Math.PI} ${x + cos(a) * r * 0.5} ${y + sin(a) * r * 0.5})`} />;
      })}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + rnd() * 2;
        return <ellipse key={i} cx={x + cos(a) * r * 0.26} cy={y + sin(a) * r * 0.26} rx={r * 0.36} ry={r * 0.28} fill={tones[1]} transform={`rotate(${(a * 180) / Math.PI} ${x + cos(a) * r * 0.26} ${y + sin(a) * r * 0.26})`} />;
      })}
      <circle cx={x} cy={y} r={r * 0.22} fill={tones[2]} />
      <circle cx={x - r * 0.05} cy={y - r * 0.06} r={r * 0.1} fill="#fff" opacity="0.25" />
    </g>
  );
}

/* ── scenes ────────────────────────────────────────────────────────── */

function Candles({ id, h }: P) {
  const vpY = h * 0.26;
  const rows = 7;
  const g = `${id}g`;
  return (
    <>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140f0c" />
          <stop offset="1" stopColor="#2a1d14" />
        </linearGradient>
        <radialGradient id={`${id}warm`} cx="0.5" cy="0.45" r="0.7">
          <stop offset="0" stopColor="#c9782f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#c9782f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}cloth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6f5a45" />
          <stop offset="0.5" stopColor="#cdb697" />
          <stop offset="1" stopColor="#efe2cc" />
        </linearGradient>
        <Glow id={g} blur={5} />
        <Glow id={`${id}b`} blur={9} />
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      <Bokeh id={`${id}b`} n={14} h={vpY + 30} colours={["#f0a64a", "#ffcf80", "#b86a2c"]} seed={11} max={12} opacity={0.55} />
      <rect width={W} height={h} fill={`url(#${id}warm)`} />
      <polygon points={`-30,${h} ${W + 30},${h} ${W * 0.56},${vpY} ${W * 0.44},${vpY}`} fill={`url(#${id}cloth)`} />
      <polygon points={`${W * 0.36},${h} ${W * 0.64},${h} ${W * 0.505},${vpY} ${W * 0.495},${vpY}`} fill="#56704f" opacity="0.8" />
      {Array.from({ length: 26 }, (_, i) => {
        const t = pow(i / 25, 1.7);
        const y = vpY + (h - vpY) * t;
        const spread = 4 + 38 * t;
        return <Leaf key={i} x={W / 2 + (i % 2 ? spread * 0.4 : -spread * 0.4)} y={y} len={2 + 14 * t} angle={i % 2 ? -25 : 205} fill={i % 3 ? "#7f9a7d" : "#a7bca0"} />;
      })}
      {Array.from({ length: rows }, (_, i) => {
        const t = pow((i + 1) / rows, 1.6);
        const y = vpY + (h - vpY) * t;
        const off = 8 + 90 * t;
        const s = 0.35 + t * 1.1;
        return (
          <g key={i}>
            {[-1, 1].map((side) => (
              <g key={side}>
                <ellipse cx={W / 2 + side * off * 1.45} cy={y + 6 * s} rx={16 * s} ry={5 * s} fill="#f7efe2" opacity="0.9" />
                <rect x={W / 2 + side * off - 2.2 * s} y={y - 30 * s} width={4.4 * s} height={30 * s} rx={1.5 * s} fill="#f4ead8" />
                <Flame x={W / 2 + side * off} y={y - 32 * s} s={s} glowId={g} />
              </g>
            ))}
          </g>
        );
      })}
    </>
  );
}

function Tapers({ id, h, v }: P) {
  const dusk = v === 1;
  const g = `${id}g`;
  const heights = [0.62, 0.48, 0.7, 0.55, 0.42];
  return (
    <>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          {dusk ? (
            <>
              <stop offset="0" stopColor="#f2a56b" />
              <stop offset="0.55" stopColor="#e7a3a0" />
              <stop offset="1" stopColor="#6d4b53" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#2c353c" />
              <stop offset="1" stopColor="#161b1f" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`${id}brass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a6424" />
          <stop offset="0.45" stopColor="#e8c47a" />
          <stop offset="1" stopColor="#7a5520" />
        </linearGradient>
        <linearGradient id={`${id}wax`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9cdb6" />
          <stop offset="0.5" stopColor="#fbf5ea" />
          <stop offset="1" stopColor="#cfc2aa" />
        </linearGradient>
        <Glow id={g} blur={6} />
        <Glow id={`${id}b`} blur={10} />
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      <Bokeh id={`${id}b`} n={16} h={h * 0.7} colours={dusk ? ["#ffd9a0", "#ffe6c7"] : ["#e8a54b", "#ffd08a", "#c27a36"]} seed={dusk ? 5 : 7} opacity={dusk ? 0.6 : 0.5} />
      <rect y={h * 0.84} width={W} height={h * 0.16} fill={dusk ? "#4e3438" : "#0f1316"} opacity="0.85" />
      {heights.map((hh, i) => {
        const x = 40 + i * 55;
        const top = h * (0.84 - hh);
        return (
          <g key={i}>
            <rect x={x - 5} y={top} width={10} height={h * 0.84 - top - 18} rx={3} fill={`url(#${id}wax)`} />
            <path d={`M${x - 12} ${h * 0.84} h24 l-4 -8 h-5 l-2 -10 h-2 l-2 10 h-5 z`} fill={`url(#${id}brass)`} />
            <ellipse cx={x} cy={h * 0.84 - 18} rx={9} ry={3} fill={`url(#${id}brass)`} />
            <line x1={x} y1={top} x2={x} y2={top - 4} stroke="#2a2018" strokeWidth="1" />
            <Flame x={x} y={top - 4} s={1.5} glowId={g} />
          </g>
        );
      })}
    </>
  );
}

function Garland({ id, h, v }: P) {
  const beam = v === 1;
  const rnd = seeded(beam ? 41 : 17);
  const mid = h * 0.5;
  const pts = Array.from({ length: 34 }, (_, i) => {
    const x = -10 + (i / 33) * (W + 20);
    const y = mid + sin(i / 4.2) * h * 0.12;
    return { x, y, slope: cos(i / 4.2) * 20 };
  });
  return (
    <>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          {beam ? (
            <>
              <stop offset="0" stopColor="#2b2019" />
              <stop offset="1" stopColor="#433126" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#f3ece0" />
              <stop offset="1" stopColor="#e4d8c4" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`${id}wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a5436" />
          <stop offset="1" stopColor="#4a3121" />
        </linearGradient>
        <Glow id={`${id}b`} blur={8} />
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      {beam ? (
        <>
          <Bokeh id={`${id}b`} n={18} h={h} colours={["#f2b35e", "#ffd699"]} seed={3} max={14} opacity={0.55} />
          <rect y={mid - h * 0.16} width={W} height={h * 0.2} fill={`url(#${id}wood)`} />
          <rect y={mid - h * 0.16} width={W} height={2} fill="#9c714b" opacity="0.6" />
        </>
      ) : (
        <g opacity="0.07" stroke="#6b5a45">
          {Array.from({ length: 40 }, (_, i) => (
            <line key={i} x1={0} y1={i * (h / 40)} x2={W} y2={i * (h / 40) + 3} />
          ))}
        </g>
      )}
      <path d={`M ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")}`} stroke={beam ? "#5d6b4c" : "#71805f"} strokeWidth="1.6" fill="none" />
      {pts.flatMap((p, i) =>
        [0, 1, 2].map((k) => {
          const side = (i + k) % 2 ? 1 : -1;
          const len = 7 + rnd() * 8;
          const fill = ["#8fa68a", "#a9bca4", "#6f8a6c", "#b8c7b0", "#5e7247"][Math.floor(rnd() * 5)];
          return <Leaf key={`${i}-${k}`} x={p.x + rnd() * 8 - 4} y={p.y + side * (5 + rnd() * 7)} len={len} angle={p.slope + side * (40 + rnd() * 30)} fill={fill} />;
        }),
      )}
      {beam
        ? null
        : [0.25, 0.62].map((t, i) => <circle key={i} cx={W * t} cy={mid + sin((t * 33) / 4.2) * h * 0.12} r={4} fill="#f2e8d6" stroke="#d8c6a8" />)}
    </>
  );
}

function Tabletop({ id, h, v }: P) {
  const stone = v === 1;
  const cx = W / 2;
  const cy = h / 2;
  const rnd = seeded(stone ? 9 : 2);
  return (
    <>
      <defs>
        <radialGradient id={`${id}plate`} cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor={stone ? "#5d6368" : "#ffffff"} />
          <stop offset="1" stopColor={stone ? "#3b4146" : "#ebe5da"} />
        </radialGradient>
        <linearGradient id={`${id}brass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2bf77" />
          <stop offset="1" stopColor="#8f6a2c" />
        </linearGradient>
      </defs>
      <rect width={W} height={h} fill={stone ? "#b9b2a6" : "#ece3d2"} />
      <g opacity="0.12" stroke={stone ? "#6f675b" : "#a8977b"}>
        {Array.from({ length: 30 }, (_, i) => (
          <line key={i} x1={i * 10} y1={0} x2={i * 10 + 6} y2={h} />
        ))}
      </g>
      <rect x={cx - 120} y={cy - 70} width={48} height={140} rx={3} fill={stone ? "#e7e1d6" : "#9bb096"} opacity="0.95" transform={`rotate(-4 ${cx - 96} ${cy})`} />
      <circle cx={cx + 3} cy={cy + 4} r={78} fill="#000" opacity="0.12" />
      <circle cx={cx} cy={cy} r={78} fill={`url(#${id}plate)`} />
      <circle cx={cx} cy={cy} r={58} fill="none" stroke={stone ? "#2f3438" : "#ddd3c3"} strokeWidth="1.5" />
      {stone
        ? Array.from({ length: 50 }, (_, i) => <circle key={i} cx={cx + (rnd() - 0.5) * 140} cy={cy + (rnd() - 0.5) * 140} r={0.8} fill="#1c2023" opacity={(rnd() * 0.6) as number} />)
        : null}
      <circle cx={cx} cy={cy} r={46} fill={stone ? "#f4efe6" : "#faf7f1"} />
      <Sprig x={cx - 6} y={cy + 20} scale={0.7} angle={-30} />
      <rect x={cx + 92} y={cy - 64} width={7} height={128} rx={3.5} fill={`url(#${id}brass)`} />
      <rect x={cx + 106} y={cy - 64} width={6} height={128} rx={3} fill={`url(#${id}brass)`} />
      <rect x={cx - 108} y={cy - 60} width={6} height={120} rx={3} fill={`url(#${id}brass)`} />
      <circle cx={cx + 96} cy={cy - 96} r={18} fill="#ffffff" opacity="0.35" stroke="#fff" strokeOpacity="0.7" />
      <circle cx={cx + 90} cy={cy - 101} r={5} fill="#fff" opacity="0.6" />
    </>
  );
}

function Placecard({ id, h }: P) {
  const cx = W / 2;
  const cy = h * 0.54;
  return (
    <>
      <defs>
        <radialGradient id={`${id}plate`} cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#efe7da" />
        </radialGradient>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efd7d0" />
          <stop offset="1" stopColor="#e3c2bb" />
        </linearGradient>
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      <circle cx={cx + 4} cy={cy + 6} r={108} fill="#7a4a44" opacity="0.14" />
      <circle cx={cx} cy={cy} r={108} fill={`url(#${id}plate)`} />
      <circle cx={cx} cy={cy} r={80} fill="none" stroke="#e6dccb" strokeWidth="2" />
      <g transform={`rotate(-8 ${cx} ${cy})`}>
        <rect x={cx - 58} y={cy - 26} width={116} height={52} rx={2} fill="#000" opacity="0.1" transform="translate(3 4)" />
        <rect x={cx - 58} y={cy - 26} width={116} height={52} rx={2} fill="#fbf8f2" />
        <text x={cx} y={cy + 9} textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontSize="28" fill="#3f4a52">
          Aoife
        </text>
      </g>
      <Sprig x={cx + 70} y={cy + 70} scale={1} angle={-40} />
      <Sprig x={cx - 80} y={cy - 90} scale={0.7} angle={150} tones={["#e3a6a4", "#8fa68a", "#caa19c"]} />
    </>
  );
}

function Glassware({ id, h }: P) {
  const g = `${id}g`;
  const cups = [
    { x: 70, w: 64, hh: 92, y: h * 0.72 },
    { x: 160, w: 70, hh: 110, y: h * 0.76 },
    { x: 238, w: 58, hh: 80, y: h * 0.7 },
  ];
  return (
    <>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2718" />
          <stop offset="0.62" stopColor="#6b4527" />
          <stop offset="0.62" stopColor="#d9c6a5" />
          <stop offset="1" stopColor="#b8a07a" />
        </linearGradient>
        <linearGradient id={`${id}amber`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a4b12" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#e39a3c" stopOpacity="0.85" />
          <stop offset="0.7" stopColor="#c47420" stopOpacity="0.9" />
          <stop offset="1" stopColor="#7a3f0e" stopOpacity="0.95" />
        </linearGradient>
        <Glow id={g} blur={12} />
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      <circle cx={W * 0.8} cy={h * 0.3} r={50} fill="#ffb95a" opacity="0.45" filter={`url(#${g})`} />
      <circle cx={W * 0.2} cy={h * 0.22} r={36} fill="#ffcf85" opacity="0.35" filter={`url(#${g})`} />
      {cups.map((c, i) => (
        <g key={i}>
          <ellipse cx={c.x + 16} cy={c.y + 4} rx={c.w * 0.75} ry={10} fill="#e0922f" opacity="0.35" filter={`url(#${g})`} />
          <path d={`M${c.x - c.w / 2} ${c.y - c.hh} L${c.x - c.w / 2 + 5} ${c.y} Q ${c.x} ${c.y + 6} ${c.x + c.w / 2 - 5} ${c.y} L${c.x + c.w / 2} ${c.y - c.hh} Z`} fill={`url(#${id}amber)`} />
          <ellipse cx={c.x} cy={c.y - c.hh} rx={c.w / 2} ry={6} fill="#f7c47c" opacity="0.5" stroke="#ffd9a0" strokeOpacity="0.8" />
          <rect x={c.x - c.w / 2 + 9} y={c.y - c.hh + 10} width={5} height={c.hh - 24} rx={2.5} fill="#fff" opacity="0.4" />
          <g opacity="0.25" stroke="#fff">
            {[0.3, 0.5, 0.7].map((t) => (
              <line key={t} x1={c.x - c.w / 2 + 4} y1={c.y - c.hh * t} x2={c.x + c.w / 2 - 4} y2={c.y - c.hh * t} />
            ))}
          </g>
        </g>
      ))}
    </>
  );
}

function Linen({ id, h }: P) {
  const cx = W / 2;
  const cy = h / 2;
  return (
    <>
      <defs>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbf6ec" />
          <stop offset="0.5" stopColor="#e9dfcd" />
          <stop offset="1" stopColor="#fbf6ec" />
        </linearGradient>
      </defs>
      <rect width={W} height={h} fill="#8fa68a" />
      <rect width={W} height={h} fill="#000" opacity="0.06" />
      <path d={`M${cx - 110} ${cy - 50} Q ${cx - 40} ${cy - 20} ${cx - 16} ${cy} Q ${cx - 40} ${cy + 26} ${cx - 104} ${cy + 64} L ${cx - 120} ${cy + 20} Z`} fill={`url(#${id}l)`} />
      <path d={`M${cx + 110} ${cy - 56} Q ${cx + 40} ${cy - 24} ${cx + 16} ${cy} Q ${cx + 44} ${cy + 26} ${cx + 106} ${cy + 60} L ${cx + 124} ${cy + 8} Z`} fill={`url(#${id}l)`} />
      <ellipse cx={cx} cy={cy} rx={26} ry={30} fill="#f4ecdd" />
      <path d={`M${cx - 20} ${cy - 16} Q ${cx} ${cy - 4} ${cx + 18} ${cy - 18}`} stroke="#d6c8b0" strokeWidth="2" fill="none" />
      <path d={`M${cx - 18} ${cy + 14} Q ${cx} ${cy + 4} ${cx + 20} ${cy + 16}`} stroke="#d6c8b0" strokeWidth="2" fill="none" />
      <Sprig x={cx + 8} y={cy + 6} scale={1.2} angle={20} tones={["#5e7247", "#6f8a6c", "#4d5f3c"]} />
    </>
  );
}

function Budvases({ id, h }: P) {
  const base = h * 0.78;
  const vases = [
    { x: 58, hh: 46, w: 26, bloom: "#e3a6a4" },
    { x: 104, hh: 64, w: 22, bloom: "#f4ece0" },
    { x: 152, hh: 40, w: 30, bloom: "#d98c8c" },
    { x: 198, hh: 56, w: 20, bloom: "#f2d2cb" },
    { x: 244, hh: 44, w: 26, bloom: "#e8b4a8" },
  ];
  return (
    <>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3e3dc" />
          <stop offset="0.78" stopColor="#ead3ca" />
          <stop offset="0.78" stopColor="#d8c4b0" />
          <stop offset="1" stopColor="#c7b199" />
        </linearGradient>
        <linearGradient id={`${id}glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9fb3a4" stopOpacity="0.7" />
          <stop offset="0.4" stopColor="#e8f0e6" stopOpacity="0.6" />
          <stop offset="1" stopColor="#7f9788" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      {vases.map((vv, i) => {
        const stemTop = base - vv.hh - 50 - (i % 2) * 24;
        return (
          <g key={i}>
            <path d={`M${vv.x} ${base - vv.hh + 4} Q ${vv.x + (i % 2 ? 8 : -8)} ${(base + stemTop) / 2} ${vv.x + (i - 2) * 3} ${stemTop}`} stroke="#6b8568" strokeWidth="1.8" fill="none" />
            <Leaf x={vv.x + 6} y={base - vv.hh - 18} len={9} angle={-30} fill="#8fa68a" />
            <Bloom x={vv.x + (i - 2) * 3} y={stemTop} r={12 + (i % 3) * 3} tones={[vv.bloom, "#fff4ef", "#c97f7a"]} seed={i + 3} />
            <ellipse cx={vv.x + 6} cy={base + 2} rx={vv.w * 0.7} ry={4} fill="#7a5c48" opacity="0.2" />
            <path d={`M${vv.x - vv.w / 2} ${base} Q ${vv.x - vv.w / 2 - 4} ${base - vv.hh * 0.5} ${vv.x - 4} ${base - vv.hh} h8 Q ${vv.x + vv.w / 2 + 4} ${base - vv.hh * 0.5} ${vv.x + vv.w / 2} ${base} Z`} fill={`url(#${id}glass)`} />
          </g>
        );
      })}
    </>
  );
}

function Slate({ id, h, v }: P) {
  const bar = v === 3;
  const cx = W / 2;
  const bw = bar ? 200 : 210;
  const bh = bar ? h * 0.66 : h * 0.62;
  const bx = cx - bw / 2;
  const by = h * 0.12;
  return (
    <>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bar ? "#2a1f18" : "#a9bba0"} />
          <stop offset="1" stopColor={bar ? "#4a3222" : "#6f8a6c"} />
        </linearGradient>
        <linearGradient id={`${id}slate`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#46525b" />
          <stop offset="1" stopColor="#2c353c" />
        </linearGradient>
        <Glow id={`${id}b`} blur={9} />
        <Glow id={`${id}g`} blur={6} />
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      <Bokeh id={`${id}b`} n={18} h={h} colours={bar ? ["#f0a64a", "#ffd08a"] : ["#dbe6d3", "#f6f1e4", "#b9ccb1"]} seed={v + 21} opacity={bar ? 0.5 : 0.7} />
      <line x1={cx - 70} y1={by + bh - 4} x2={cx - 96} y2={h} stroke="#6a4a30" strokeWidth="7" />
      <line x1={cx + 70} y1={by + bh - 4} x2={cx + 96} y2={h} stroke="#6a4a30" strokeWidth="7" />
      <line x1={cx} y1={by + 20} x2={cx} y2={h} stroke="#553a25" strokeWidth="6" />
      <rect x={bx - 7} y={by - 7} width={bw + 14} height={bh + 14} rx={4} fill="#8a6440" />
      <rect x={bx} y={by} width={bw} height={bh} rx={2} fill={`url(#${id}slate)`} />
      <rect x={bx} y={by} width={bw} height={bh} fill="#fff" opacity="0.03" />
      {v === 0 ? (
        <g fill="#f3efe7" textAnchor="middle" fontFamily="var(--font-sans), system-ui, sans-serif">
          <text x={cx} y={by + bh * 0.3} fontSize="12" opacity="0.8">Welcome to the wedding of</text>
          <text x={cx} y={by + bh * 0.55} fontSize="30" fontWeight="600">Mara &amp; Finn</text>
          <text x={cx} y={by + bh * 0.78} fontSize="11" opacity="0.75">12 June, The Orchard</text>
        </g>
      ) : null}
      {v === 1 ? (
        <g fill="#f3efe7" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif">
          <text x={cx} y={by + bh * 0.28} fontSize="12" fontStyle="italic" opacity="0.85">welcome to the wedding of</text>
          <text x={cx} y={by + bh * 0.56} fontSize="34" fontStyle="italic">Mara &amp; Finn</text>
          <line x1={cx - 40} y1={by + bh * 0.67} x2={cx + 40} y2={by + bh * 0.67} stroke="#f3efe7" strokeOpacity="0.5" />
          <text x={cx} y={by + bh * 0.82} fontSize="11" opacity="0.8">twelfth of June</text>
        </g>
      ) : null}
      {v === 2 ? (
        <>
          <g fill="#f3efe7" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif">
            <text x={cx} y={by + bh * 0.34} fontSize="11" fontStyle="italic" opacity="0.85">welcome to the wedding of</text>
            <text x={cx} y={by + bh * 0.6} fontSize="36" fontStyle="italic">Mara &amp; Finn</text>
            <text x={cx} y={by + bh * 0.8} fontSize="11" opacity="0.8">twelfth of June, The Orchard</text>
          </g>
          <Sprig x={bx + 8} y={by + 60} scale={1.1} angle={100} />
          <Sprig x={bx + 14} y={by + 18} scale={0.9} angle={60} tones={["#a9bca4", "#8fa68a", "#e3a6a4"]} />
          <Sprig x={bx + bw - 10} y={by + bh - 16} scale={1} angle={-80} />
        </>
      ) : null}
      {bar ? (
        <>
          <g fill="#f3efe7" fontFamily="Georgia, 'Times New Roman', serif">
            <text x={cx} y={by + 42} textAnchor="middle" fontSize="28" fontStyle="italic">The bar</text>
            {["Orchard spritz", "Elderflower fizz", "Pale ale, on tap", "Wine, red and white"].map((l, i) => (
              <text key={l} x={bx + 26} y={by + 78 + i * 22} fontSize="12" opacity="0.88">
                {l}
              </text>
            ))}
          </g>
          <Flame x={bx + bw - 30} y={by + bh + 30} s={1.6} glowId={`${id}g`} />
        </>
      ) : null}
    </>
  );
}

function Numbers({ id, h }: P) {
  const cards = [
    { x: 80, y: h * 0.36, n: "7", r: -8 },
    { x: 206, y: h * 0.3, n: "12", r: 6 },
    { x: 140, y: h * 0.7, n: "3", r: -2 },
  ];
  return (
    <>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9db199" />
          <stop offset="1" stopColor="#7f9a7d" />
        </linearGradient>
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      {cards.map((c) => (
        <g key={c.n} transform={`rotate(${c.r} ${c.x} ${c.y})`}>
          <rect x={c.x - 46} y={c.y - 58} width={92} height={116} rx={3} fill="#3a4a37" opacity="0.2" transform="translate(4 6)" />
          <rect x={c.x - 46} y={c.y - 58} width={92} height={116} rx={3} fill="#fbf7ef" />
          <line x1={c.x - 46} y1={c.y} x2={c.x + 46} y2={c.y} stroke="#e6ddcc" />
          <text x={c.x} y={c.y + 16} textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="48" fill="#3f4a52">
            {c.n}
          </text>
          <text x={c.x} y={c.y - 34} textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="10" fill="#6b7d5e">
            table
          </text>
        </g>
      ))}
    </>
  );
}

function Peonies({ id, h, v }: P) {
  const bouquet = v === 1;
  const rnd = seeded(bouquet ? 71 : 33);
  const blooms = Array.from({ length: bouquet ? 9 : 11 }, (_, i) => ({
    x: bouquet ? W / 2 + (rnd() - 0.5) * 170 : rnd() * W,
    y: bouquet ? h * 0.36 + (rnd() - 0.5) * h * 0.34 : rnd() * h,
    r: 26 + rnd() * 26,
    k: i,
  }));
  const palettes: [string, string, string][] = bouquet
    ? [
        ["#f6f0e6", "#fffaf2", "#e8d9c0"],
        ["#f0dcd6", "#fbeee9", "#d9a79f"],
        ["#faf5ec", "#ffffff", "#e3cfa8"],
      ]
    : [
        ["#e8a3a6", "#f5c8c6", "#c46a74"],
        ["#f3c9c1", "#fbe3dc", "#d98d88"],
        ["#f6e7dd", "#fff5ee", "#e2b7a0"],
        ["#d9828c", "#eeb0b4", "#a94c5c"],
      ];
  return (
    <>
      <defs>
        <radialGradient id={`${id}bg`} cx="0.5" cy="0.4" r="0.8">
          <stop offset="0" stopColor={bouquet ? "#6f8a6c" : "#f2d6cf"} />
          <stop offset="1" stopColor={bouquet ? "#3f5240" : "#d9aaa3"} />
        </radialGradient>
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      {bouquet ? (
        <>
          {[-14, -6, 2, 10, 18].map((dx, i) => (
            <line key={i} x1={W / 2 + dx * 2} y1={h * 0.55} x2={W / 2 + dx * 0.6} y2={h} stroke="#7d9467" strokeWidth="4" />
          ))}
          <path d={`M${W / 2 - 22} ${h * 0.72} q 22 12 44 0 l -6 18 q -16 8 -32 0 z`} fill="#efe4d2" />
          <path d={`M${W / 2 + 10} ${h * 0.78} q 30 30 10 70`} stroke="#efe4d2" strokeWidth="5" fill="none" />
        </>
      ) : null}
      {blooms.map((b) => (
        <g key={b.k}>
          <Leaf x={b.x - b.r} y={b.y + b.r * 0.4} len={b.r * 0.6} angle={200} fill={b.k % 2 ? "#7f9a7d" : "#95ad8f"} />
          <Leaf x={b.x + b.r * 0.9} y={b.y + b.r * 0.5} len={b.r * 0.5} angle={-20} fill="#6f8a6c" />
        </g>
      ))}
      {blooms.map((b) => (
        <Bloom key={b.k} x={b.x} y={b.y} r={b.r} tones={palettes[b.k % palettes.length]} seed={b.k * 7 + v} />
      ))}
    </>
  );
}

function Arch({ id, h }: P) {
  const rnd = seeded(58);
  const cx = W / 2;
  const base = h * 0.8;
  const R = 92;
  const clusters = Array.from({ length: 38 }, (_, i) => {
    const t = i / 37;
    const a = Math.PI + t * Math.PI;
    const onLeg = t < 0.12 || t > 0.88;
    const x = cx + cos(a) * R + (rnd() - 0.5) * 16;
    const y = (onLeg ? base - 90 + rnd() * 70 : base - 110 + sin(a) * R) + (rnd() - 0.5) * 16;
    return { x, y, r: 8 + rnd() * 9, tone: ["#e3a6a4", "#f6efe3", "#efa46a", "#f2c9c1", "#d98c8c"][Math.floor(rnd() * 5)], k: i };
  });
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bcd3d6" />
          <stop offset="0.6" stopColor="#f3d7b6" />
          <stop offset="1" stopColor="#efc59a" />
        </linearGradient>
        <linearGradient id={`${id}grass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fa66f" />
          <stop offset="1" stopColor="#5e7247" />
        </linearGradient>
      </defs>
      <rect width={W} height={h} fill={`url(#${id}sky)`} />
      <path d={`M0 ${h * 0.62} Q ${W * 0.3} ${h * 0.56} ${W * 0.55} ${h * 0.6} T ${W} ${h * 0.58} V ${h} H 0 Z`} fill="#9bb07f" opacity="0.6" />
      <rect y={h * 0.66} width={W} height={h * 0.34} fill={`url(#${id}grass)`} />
      <polygon points={`${cx - 16},${h * 0.8} ${cx + 16},${h * 0.8} ${cx + 60},${h} ${cx - 60},${h}`} fill="#d9c7a3" opacity="0.85" />
      {Array.from({ length: 60 }, (_, i) => (
        <circle key={i} cx={rnd() * W} cy={h * 0.7 + rnd() * h * 0.3} r={1.5 + rnd() * 1.5} fill={["#f6efe3", "#e3a6a4", "#efc36a"][i % 3]} />
      ))}
      <path d={`M ${cx - R} ${base} V ${base - 110} A ${R} ${R} 0 0 1 ${cx + R} ${base - 110} V ${base}`} stroke="#6b5a45" strokeWidth="3" fill="none" />
      {clusters.map((c) => (
        <g key={c.k}>
          <Leaf x={c.x + 6} y={c.y + 4} len={c.r * 0.9} angle={c.k * 37} fill={c.k % 2 ? "#7f9a7d" : "#a3b89c"} />
          <circle cx={c.x} cy={c.y} r={c.r} fill={c.tone} />
          <circle cx={c.x - c.r * 0.25} cy={c.y - c.r * 0.3} r={c.r * 0.35} fill="#fff" opacity="0.3" />
        </g>
      ))}
    </>
  );
}

function Palette({ id, h }: P) {
  const chips = ["#E3A6A4", "#F3E7D6", "#8FA68A", "#E3A857", "#5E7247"];
  return (
    <>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efe6d8" />
          <stop offset="1" stopColor="#e2d4c0" />
        </linearGradient>
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      <g transform={`rotate(-3 ${W / 2} ${h / 2})`}>
        <rect x={34} y={h * 0.14 + 6} width={232} height={h * 0.72} rx={4} fill="#6b5a45" opacity="0.14" />
        <rect x={30} y={h * 0.14} width={232} height={h * 0.72} rx={4} fill="#fcfaf6" />
        {chips.map((c, i) => (
          <g key={c}>
            <rect x={48 + i * 42} y={h * 0.14 + 20} width={36} height={h * 0.72 - 64} rx={2} fill={c} />
            <rect x={48 + i * 42} y={h * 0.14 + h * 0.72 - 36} width={24} height={3} rx={1.5} fill="#bfb3a1" />
          </g>
        ))}
      </g>
      <Sprig x={W - 30} y={h - 10} scale={1.3} angle={-30} />
    </>
  );
}

function Fabric({ id, h }: P) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}silk`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efe5d6" />
          <stop offset="0.35" stopColor="#fffaf2" />
          <stop offset="0.5" stopColor="#e5d8c3" />
          <stop offset="0.7" stopColor="#fbf4e8" />
          <stop offset="1" stopColor="#e0d2bb" />
        </linearGradient>
        <pattern id={`${id}lace`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="8" cy="8" r="3.2" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1" />
          <circle cx="0" cy="0" r="1.4" fill="#fff" fillOpacity="0.8" />
        </pattern>
      </defs>
      <rect width={W} height={h} fill="#e8c2bd" />
      <g transform={`rotate(-6 ${W / 2} ${h / 2})`}>
        <path
          d={`M40 ${h * 0.12} ${Array.from({ length: 22 }, (_, i) => `L${40 + (i + 0.5) * 10} ${h * 0.12 + (i % 2 ? 0 : -6)}`).join(" ")} L260 ${h * 0.88} ${Array.from({ length: 22 }, (_, i) => `L${260 - (i + 0.5) * 10} ${h * 0.88 + (i % 2 ? 0 : 6)}`).join(" ")} Z`}
          fill={`url(#${id}silk)`}
        />
        <rect x={40} y={h * 0.5} width={220} height={h * 0.38} fill={`url(#${id}lace)`} />
        <path d={`M40 ${h * 0.5} Q 150 ${h * 0.47} 260 ${h * 0.5}`} stroke="#fff" strokeWidth="2" strokeOpacity="0.8" fill="none" />
      </g>
    </>
  );
}

function Terrace({ id, h, v }: P) {
  const morning = v === 1;
  const rnd = seeded(morning ? 4 : 8);
  const horizon = h * 0.52;
  const g = `${id}g`;
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          {morning ? (
            <>
              <stop offset="0" stopColor="#bcd6dd" />
              <stop offset="1" stopColor="#f2eee0" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#e98d5a" />
              <stop offset="0.6" stopColor="#f6c083" />
              <stop offset="1" stopColor="#fbe0b5" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`${id}stone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={morning ? "#c9bfae" : "#b98e68"} />
          <stop offset="1" stopColor={morning ? "#e4dccd" : "#e7c69e"} />
        </linearGradient>
        <Glow id={g} blur={4} />
        <Glow id={`${id}sun`} blur={14} />
      </defs>
      <rect width={W} height={h} fill={`url(#${id}sky)`} />
      {morning ? null : (
        <>
          <circle cx={W * 0.68} cy={horizon - 10} r={40} fill="#ffe0a6" opacity="0.8" filter={`url(#${id}sun)`} />
          <circle cx={W * 0.68} cy={horizon - 10} r={18} fill="#fff2d2" />
        </>
      )}
      {Array.from({ length: 9 }, (_, i) => {
        const x = i * 38 + rnd() * 16;
        const s = 26 + rnd() * 20;
        const col = morning ? ["#6f8a6c", "#5e7247", "#86a07f"][i % 3] : ["#5a4a3a", "#6d5a41", "#4a3d31"][i % 3];
        return (
          <g key={i}>
            <rect x={x - 2} y={horizon - s * 0.6} width={4} height={s * 0.7} fill={morning ? "#5b4a39" : "#3d3026"} />
            <circle cx={x} cy={horizon - s} r={s * 0.62} fill={col} />
            <circle cx={x + s * 0.4} cy={horizon - s * 0.8} r={s * 0.45} fill={col} />
            <circle cx={x - s * 0.4} cy={horizon - s * 0.75} r={s * 0.42} fill={col} opacity="0.9" />
          </g>
        );
      })}
      <polygon points={`0,${horizon} ${W},${horizon} ${W},${h} 0,${h}`} fill={`url(#${id}stone)`} />
      <g stroke={morning ? "#b2a794" : "#a57c56"} strokeOpacity="0.5">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1={W / 2 + (i - 4) * 14} y1={horizon} x2={W / 2 + (i - 4) * 70} y2={h} />
        ))}
        {[0.12, 0.3, 0.55, 0.85].map((t) => (
          <line key={t} x1={0} y1={horizon + (h - horizon) * t} x2={W} y2={horizon + (h - horizon) * t} />
        ))}
      </g>
      {[0.28, 0.72].map((t, i) => (
        <g key={i}>
          <ellipse cx={W * t} cy={horizon + (h - horizon) * 0.45} rx={42} ry={11} fill="#f7f1e6" />
          <rect x={W * t - 2} y={horizon + (h - horizon) * 0.45} width={4} height={30} fill="#7a6a58" />
          <circle cx={W * t - 10} cy={horizon + (h - horizon) * 0.42} r={3} fill="#8fa68a" />
          <circle cx={W * t + 8} cy={horizon + (h - horizon) * 0.43} r={2.5} fill="#e3a6a4" />
        </g>
      ))}
      {[0, 1].map((k) => {
        const y0 = h * (0.1 + k * 0.1);
        const sag = 30;
        return (
          <g key={k}>
            <path d={`M -10 ${y0} Q ${W / 2} ${y0 + sag * 2} ${W + 10} ${y0}`} stroke="#3b2f25" strokeWidth="1" fill="none" opacity="0.7" />
            {Array.from({ length: 11 }, (_, i) => {
              const t = (i + 0.5) / 11;
              const x = -10 + t * (W + 20);
              const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0 + 4;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={morning ? 2.2 : 5} fill={morning ? "#f5ecd8" : "#ffd98f"} opacity={morning ? 0.8 : 0.8} filter={morning ? undefined : `url(#${g})`} />
                  <circle cx={x} cy={y} r={2} fill={morning ? "#e9e1cf" : "#fff4d6"} />
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
}

function Barn({ id, h }: P) {
  const rnd = seeded(91);
  const g = `${id}g`;
  const ground = h * 0.8;
  const bx = 70;
  const bw = 170;
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1629" />
          <stop offset="0.7" stopColor="#1f2c4a" />
          <stop offset="1" stopColor="#2e3656" />
        </linearGradient>
        <linearGradient id={`${id}door`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffcb7a" />
          <stop offset="1" stopColor="#e58a2e" />
        </linearGradient>
        <Glow id={g} blur={4} />
        <Glow id={`${id}big`} blur={18} />
      </defs>
      <rect width={W} height={h} fill={`url(#${id}sky)`} />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={rnd() * W} cy={rnd() * h * 0.45} r={0.4 + rnd() * 0.9} fill="#fff" opacity={0.3 + rnd() * 0.6} />
      ))}
      <circle cx={W * 0.82} cy={h * 0.12} r={12} fill="#f3ecd9" opacity="0.9" />
      <circle cx={W * 0.82 + 5} cy={h * 0.12 - 3} r={11} fill="#152039" />
      <rect y={ground} width={W} height={h - ground} fill="#141b2b" />
      <ellipse cx={bx + bw / 2} cy={ground + 10} rx={130} ry={24} fill="#ffb052" opacity="0.35" filter={`url(#${id}big)`} />
      <path d={`M${bx} ${ground} V ${ground - 110} L ${bx + 30} ${ground - 160} L ${bx + bw / 2} ${ground - 185} L ${bx + bw - 30} ${ground - 160} L ${bx + bw} ${ground - 110} V ${ground} Z`} fill="#0b0f1a" />
      <rect x={bx + bw / 2 - 34} y={ground - 92} width={68} height={92} fill={`url(#${id}door)`} />
      <rect x={bx + bw / 2 - 34} y={ground - 92} width={68} height={92} fill="#ffd28a" opacity="0.5" filter={`url(#${id}big)`} />
      {[0.2, 0.3, 0.45, 0.6, 0.72].map((t, i) => (
        <circle key={i} cx={bx + bw / 2 - 28 + t * 56} cy={ground - 20 - (i % 2) * 6} r={2} fill="#fff4d6" />
      ))}
      <rect x={bx + 18} y={ground - 90} width={20} height={26} fill="#f2a64d" opacity="0.9" />
      <rect x={bx + bw - 38} y={ground - 90} width={20} height={26} fill="#f2a64d" opacity="0.9" />
      {[0, 1, 2].map((k) => {
        const x0 = bx + bw / 2;
        const y0 = ground - 150 + k * 12;
        const x1 = k === 1 ? -10 : k === 0 ? W + 10 : W * 0.95;
        const y1 = ground - 70 + k * 20;
        const cxp = (x0 + x1) / 2;
        const cyp = Math.max(y0, y1) + 50;
        return (
          <g key={k}>
            <path d={`M${x0} ${y0} Q ${cxp} ${cyp} ${x1} ${y1}`} stroke="#000" strokeWidth="0.8" fill="none" />
            {Array.from({ length: 9 }, (_, i) => {
              const t = (i + 0.6) / 9.5;
              const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cxp + t * t * x1;
              const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cyp + t * t * y1 + 3;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={6} fill="#ffc567" opacity="0.8" filter={`url(#${g})`} />
                  <circle cx={x} cy={y} r={2.2} fill="#fff3cf" />
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
}

function Barninside({ id, h }: P) {
  const g = `${id}g`;
  const vp = { x: W / 2, y: h * 0.42 };
  return (
    <>
      <defs>
        <radialGradient id={`${id}bg`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#9a5a26" />
          <stop offset="0.6" stopColor="#4a2a16" />
          <stop offset="1" stopColor="#1d130c" />
        </radialGradient>
        <Glow id={g} blur={5} />
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      {[-1.4, -0.7, 0, 0.7, 1.4].map((k, i) => (
        <line key={i} x1={vp.x + k * 12} y1={vp.y - 40} x2={vp.x + k * 240} y2={-10} stroke="#2a1a10" strokeWidth={8 + Math.abs(k) * 6} />
      ))}
      {[0.1, 0.3, 0.6].map((t, i) => (
        <line key={i} x1={0} y1={vp.y - 40 - (vp.y - 30) * (1 - t) * 1.2} x2={W} y2={vp.y - 40 - (vp.y - 30) * (1 - t) * 1.2} stroke="#2a1a10" strokeWidth={4 + t * 10} opacity="0.9" />
      ))}
      {Array.from({ length: 7 }, (_, i) => {
        const t = (i + 1) / 8;
        return (
          <g key={i}>
            <line x1={vp.x + (i - 3) * 40 * t} y1={0} x2={vp.x + (i - 3) * 40 * t} y2={vp.y - 60 + t * 60} stroke="#000" strokeWidth="0.6" opacity="0.6" />
            <circle cx={vp.x + (i - 3) * 40 * t} cy={vp.y - 60 + t * 60} r={7 * t + 3} fill="#ffc567" opacity="0.8" filter={`url(#${g})`} />
            <circle cx={vp.x + (i - 3) * 40 * t} cy={vp.y - 60 + t * 60} r={2 * t + 1} fill="#fff3cf" />
          </g>
        );
      })}
      {[-1, 1].map((side) => (
        <polygon key={side} points={`${vp.x + side * 20},${vp.y + 10} ${vp.x + side * 44},${vp.y + 10} ${vp.x + side * 200},${h} ${vp.x + side * 60},${h}`} fill="#e8d7bb" opacity="0.9" />
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const t = pow((Math.floor(i / 2) + 1) / 6, 1.5);
        const x = vp.x + side * (32 + 98 * t);
        const y = vp.y + 10 + (h - vp.y) * t * 0.9;
        return (
          <g key={i}>
            <circle cx={x} cy={y - 4} r={4 + t * 8} fill="#ffb347" opacity="0.7" filter={`url(#${g})`} />
            <circle cx={x} cy={y - 4} r={1 + t * 2} fill="#fff1c9" />
          </g>
        );
      })}
    </>
  );
}

function Parquet({ id, h }: P) {
  return (
    <>
      <defs>
        <pattern id={`${id}p`} width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="28" height="14" fill="#b27a3e" />
          <rect y="14" width="14" height="14" fill="#8e5c2a" />
          <rect x="14" y="14" width="14" height="14" fill="#c48f52" />
          <path d="M0 14 H28 M14 14 V28" stroke="#5a3718" strokeWidth="0.8" />
        </pattern>
        <radialGradient id={`${id}v`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#ffce85" stopOpacity="0.35" />
          <stop offset="1" stopColor="#140b05" stopOpacity="0.75" />
        </radialGradient>
        <Glow id={`${id}b`} blur={8} />
      </defs>
      <rect width={W} height={h} fill={`url(#${id}p)`} />
      <rect width={W} height={h} fill={`url(#${id}v)`} />
      <Bokeh id={`${id}b`} n={10} h={h * 0.5} colours={["#ffd08a", "#ffe2b0"]} seed={61} opacity={0.4} />
    </>
  );
}

function Firepit({ id, h }: P) {
  const rnd = seeded(13);
  const cx = W / 2;
  const cy = h * 0.66;
  const g = `${id}g`;
  return (
    <>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1222" />
          <stop offset="1" stopColor="#2a1c18" />
        </linearGradient>
        <linearGradient id={`${id}fire`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff7a1a" />
          <stop offset="0.6" stopColor="#ffb84d" />
          <stop offset="1" stopColor="#fff0b8" />
        </linearGradient>
        <Glow id={g} blur={16} />
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      <circle cx={cx} cy={cy - 20} r={90} fill="#ff8a2a" opacity="0.45" filter={`url(#${g})`} />
      <ellipse cx={cx} cy={cy + 10} rx={120} ry={34} fill="#3a2419" />
      <ellipse cx={cx} cy={cy} rx={70} ry={20} fill="#5a4a42" />
      <ellipse cx={cx} cy={cy - 2} rx={58} ry={14} fill="#1a0f0a" />
      {[-30, -10, 8, 26].map((dx, i) => (
        <path key={i} d={`M${cx + dx - 14} ${cy} C ${cx + dx - 16} ${cy - 40 - i * 6}, ${cx + dx + 4} ${cy - 50}, ${cx + dx} ${cy - 76 - (i % 2) * 18} C ${cx + dx + 14} ${cy - 44}, ${cx + dx + 16} ${cy - 20}, ${cx + dx + 14} ${cy} Z`} fill={`url(#${id}fire)`} opacity="0.92" />
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={cx + (rnd() - 0.5) * 100} cy={cy - 80 - rnd() * 90} r={0.8 + rnd()} fill="#ffcf85" />
      ))}
      {[-1, 1].map((s) => (
        <g key={s}>
          <rect x={cx + s * 104 - 30} y={cy + 20} width={60} height={14} rx={3} fill="#4a3226" />
          <rect x={cx + s * 104 - 26} y={cy + 8} width={40} height={14} rx={4} fill="#b85a3a" />
        </g>
      ))}
    </>
  );
}

function Logo({ id, h, v }: P) {
  const grounds = ["#c2623e", "#efe6d6", "#2a2826", "#5e7247"];
  const inks = ["#f6ecdc", "#2a2826", "#efe6d6", "#efe6d6"];
  const ground = grounds[v % 4];
  const ink = inks[v % 4];
  const cx = W / 2;
  const cy = h / 2;
  return (
    <>
      <defs>
        <path id={`${id}c`} d={`M ${cx - 70} ${cy} a 70 70 0 1 1 140 0 a 70 70 0 1 1 -140 0`} />
      </defs>
      <rect width={W} height={h} fill={ground} />
      {v === 0 || v === 1 ? (
        <g>
          <path d={`M${cx - 44} ${cy + 40} V ${cy - 8} A 44 44 0 0 1 ${cx + 44} ${cy - 8} V ${cy + 40} Z`} fill={v === 0 ? ink : "none"} stroke={ink} strokeWidth={v === 1 ? 6 : 0} />
          <path d={`M${cx - 16} ${cy + 40} V ${cy + 10} A 16 16 0 0 1 ${cx + 16} ${cy + 10} V ${cy + 40} Z`} fill={v === 0 ? ground : ink} />
          <text x={cx} y={cy + 76} textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="18" fill={ink} letterSpacing="1">
            Kiln &amp; Co
          </text>
        </g>
      ) : null}
      {v === 2 ? (
        <g textAnchor="middle" fill={ink} fontFamily="Georgia, 'Times New Roman', serif">
          <text x={cx} y={cy + 12} fontSize="40">
            kiln &amp; co
          </text>
          <text x={cx} y={cy + 36} fontSize="10" opacity="0.7" fontFamily="var(--font-sans), system-ui, sans-serif">
            ceramics, made slowly
          </text>
        </g>
      ) : null}
      {v === 3 ? (
        <g fill={ink}>
          <circle cx={cx} cy={cy} r={82} fill="none" stroke={ink} strokeWidth="2" />
          <circle cx={cx} cy={cy} r={56} fill="none" stroke={ink} strokeWidth="1" />
          <text fontFamily="Georgia, serif" fontSize="13" letterSpacing="2">
            <textPath href={`#${id}c`}>kiln &amp; co · hand thrown · dublin ·</textPath>
          </text>
          <path d={`M${cx - 22} ${cy + 22} V ${cy - 4} A 22 22 0 0 1 ${cx + 22} ${cy - 4} V ${cy + 22} Z`} />
        </g>
      ) : null}
    </>
  );
}

function Specimen({ h, v }: P) {
  const serif = v === 0;
  const ground = serif ? "#f1eadc" : "#c2623e";
  const ink = serif ? "#2a2826" : "#fbf2e6";
  const family = serif ? "Georgia, 'Times New Roman', serif" : "var(--font-sans), system-ui, sans-serif";
  return (
    <>
      <rect width={W} height={h} fill={ground} />
      <g fill={ink} fontFamily={family}>
        <text x={22} y={h * 0.46} fontSize={serif ? 120 : 110} fontWeight={serif ? 400 : 700} letterSpacing="-4">
          {serif ? "Aa" : "Rg"}
        </text>
        <text x={24} y={h * 0.62} fontSize="15">
          Made slowly, by hand.
        </text>
        <text x={24} y={h * 0.72} fontSize="10" opacity="0.75">
          abcdefghijklmnopqrstuvwxyz
        </text>
        <text x={24} y={h * 0.79} fontSize="10" opacity="0.75">
          0123456789 &amp; ! ? ( ) €
        </text>
        <line x1={24} x2={W - 24} y1={h * 0.86} y2={h * 0.86} stroke={ink} strokeOpacity="0.3" />
        <text x={24} y={h * 0.92} fontSize="9" opacity="0.7">
          {serif ? "Regular, Italic, Semibold" : "Book, Medium, Bold"}
        </text>
      </g>
    </>
  );
}

function Loaf({ id, h, v }: P) {
  const window = v === 1;
  const rnd = seeded(v + 100);
  const cx = W / 2;
  const cy = h * (window ? 0.62 : 0.52);
  return (
    <>
      <defs>
        <radialGradient id={`${id}crust`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#d9a15e" />
          <stop offset="0.6" stopColor="#a8682c" />
          <stop offset="1" stopColor="#6b3d17" />
        </radialGradient>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          {window ? (
            <>
              <stop offset="0" stopColor="#8fb3bf" />
              <stop offset="1" stopColor="#3f6878" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#ece2d1" />
              <stop offset="1" stopColor="#d7c7ad" />
            </>
          )}
        </linearGradient>
      </defs>
      <rect width={W} height={h} fill={`url(#${id}bg)`} />
      {window ? (
        <>
          <rect x={W * 0.55} y={0} width={W * 0.5} height={h * 0.5} fill="#fff" opacity="0.18" />
          <rect x={W * 0.1} y={cy + 40} width={W * 0.8} height={18} rx={3} fill="#8a6440" />
        </>
      ) : (
        <g opacity="0.15" stroke="#8a765a">
          {Array.from({ length: 30 }, (_, i) => (
            <line key={i} x1={i * 11} y1={0} x2={i * 11 - 20} y2={h} />
          ))}
        </g>
      )}
      <ellipse cx={cx + 6} cy={cy + 10} rx={112} ry={70} fill="#3b2a1a" opacity="0.22" />
      <ellipse cx={cx} cy={cy} rx={110} ry={68} fill={`url(#${id}crust)`} />
      {[-40, -12, 16, 44].map((dx, i) => (
        <path key={i} d={`M${cx + dx - 18} ${cy - 40 + i * 4} Q ${cx + dx} ${cy - 10} ${cx + dx + 12} ${cy + 36 - i * 3}`} stroke="#f2d6a4" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.9" />
      ))}
      {Array.from({ length: 70 }, (_, i) => (
        <circle key={i} cx={cx + (rnd() - 0.5) * 200} cy={cy + (rnd() - 0.5) * 120} r={0.6 + rnd() * 0.9} fill="#fff" opacity={0.5} />
      ))}
    </>
  );
}

function Croissant({ x, y, s, id }: { x: number; y: number; s: number; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={2} cy={8} rx={46} ry={12} fill="#2a1a0c" opacity="0.25" />
      {[-34, -20, -6, 8, 22, 34].map((dx, i) => {
        const w = 18 - Math.abs(dx) * 0.2;
        const hh = 30 - Math.abs(dx) * 0.45;
        return <ellipse key={i} cx={dx} cy={-Math.abs(dx) * 0.12} rx={w / 2 + 3} ry={hh / 2} fill={`url(#${id}c)`} stroke="#8a4d18" strokeWidth="0.8" transform={`rotate(${dx * 0.9} ${dx} 0)`} />;
      })}
    </g>
  );
}

function Croissants({ id, h, v }: P) {
  const close = v === 1;
  return (
    <>
      <defs>
        <radialGradient id={`${id}c`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#f2bf6e" />
          <stop offset="0.6" stopColor="#c97d2c" />
          <stop offset="1" stopColor="#8a4d18" />
        </radialGradient>
      </defs>
      <rect width={W} height={h} fill={close ? "#4f7f91" : "#2d2620"} />
      {close ? (
        <>
          <rect width={W} height={h * 0.45} fill="#6f9aab" />
          <ellipse cx={W / 2} cy={h * 0.62} rx={120} ry={34} fill="#f3eee6" />
          <Croissant x={W / 2} y={h * 0.58} s={2.3} id={id} />
        </>
      ) : (
        <>
          <g stroke="#4c4238" strokeWidth="2">
            {Array.from({ length: 16 }, (_, i) => (
              <line key={i} x1={i * 20} y1={0} x2={i * 20} y2={h} />
            ))}
            {Array.from({ length: 16 }, (_, i) => (
              <line key={i} x1={0} y1={i * 20} x2={W} y2={i * 20} />
            ))}
          </g>
          {[
            [80, 0.2],
            [210, 0.28],
            [110, 0.5],
            [230, 0.6],
            [70, 0.8],
            [190, 0.86],
          ].map(([x, t], i) => (
            <Croissant key={i} x={x} y={h * t} s={1.05} id={id} />
          ))}
        </>
      )}
    </>
  );
}

function Buns({ id, h }: P) {
  const spots = [
    [70, 0.26],
    [150, 0.24],
    [230, 0.27],
    [72, 0.62],
    [152, 0.6],
    [232, 0.63],
  ];
  return (
    <>
      <defs>
        <radialGradient id={`${id}b`} cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#e8b56e" />
          <stop offset="1" stopColor="#9a5a22" />
        </radialGradient>
      </defs>
      <rect width={W} height={h} fill="#e9e0d0" />
      <rect x={16} y={h * 0.06} width={W - 32} height={h * 0.88} rx={10} fill="#5c5750" />
      <rect x={24} y={h * 0.06 + 8} width={W - 48} height={h * 0.88 - 16} rx={6} fill="#f1e7d6" />
      {spots.map(([x, t], i) => {
        const y = h * t + h * 0.1;
        return (
          <g key={i}>
            <circle cx={x + 3} cy={y + 4} r={36} fill="#6b4520" opacity="0.2" />
            <circle cx={x} cy={y} r={36} fill={`url(#${id}b)`} />
            <path d={`M${x} ${y} m -4 0 a 4 4 0 1 1 8 0 a 9 9 0 1 1 -18 0 a 14 14 0 1 1 28 0 a 19 19 0 1 1 -38 0 a 24 24 0 1 1 48 0`} stroke="#6b3a14" strokeWidth="2.2" fill="none" opacity="0.7" />
            <path d={`M${x - 20} ${y - 14} q 10 -8 22 -4 q 12 4 16 12`} stroke="#fff8ec" strokeWidth="3" fill="none" opacity="0.85" strokeLinecap="round" />
          </g>
        );
      })}
    </>
  );
}

function Coffee({ id, h }: P) {
  const cx = W * 0.38;
  const cy = h * 0.45;
  return (
    <>
      <defs>
        <radialGradient id={`${id}cf`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c89060" />
          <stop offset="1" stopColor="#6a3b1c" />
        </radialGradient>
        <radialGradient id={`${id}c`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#f2bf6e" />
          <stop offset="0.6" stopColor="#c97d2c" />
          <stop offset="1" stopColor="#8a4d18" />
        </radialGradient>
      </defs>
      <rect width={W} height={h} fill="#4f7f91" />
      <rect width={W} height={h} fill="#fff" opacity="0.06" />
      <circle cx={cx + 5} cy={cy + 7} r={66} fill="#1f3a44" opacity="0.35" />
      <circle cx={cx} cy={cy} r={66} fill="#f5f1ea" />
      <circle cx={cx} cy={cy} r={44} fill="#ffffff" />
      <circle cx={cx} cy={cy} r={36} fill={`url(#${id}cf)`} />
      <path d={`M${cx} ${cy + 16} C ${cx - 26} ${cy - 2}, ${cx - 14} ${cy - 22}, ${cx} ${cy - 8} C ${cx + 14} ${cy - 22}, ${cx + 26} ${cy - 2}, ${cx} ${cy + 16} Z`} fill="#f4e6d2" />
      <rect x={cx + 60} y={cy - 8} width={40} height={14} rx={7} fill="#f5f1ea" />
      <circle cx={W * 0.74} cy={h * 0.74} r={58} fill="#e9e3d8" />
      <Croissant x={W * 0.74} y={h * 0.74} s={1.1} id={id} />
    </>
  );
}

const SCENES: Record<Scene, (p: P) => ReactNode> = {
  candles: Candles,
  tapers: Tapers,
  garland: Garland,
  tabletop: Tabletop,
  placecard: Placecard,
  glassware: Glassware,
  linen: Linen,
  budvases: Budvases,
  slate: Slate,
  numbers: Numbers,
  peonies: Peonies,
  arch: Arch,
  palette: Palette,
  fabric: Fabric,
  terrace: Terrace,
  barn: Barn,
  barninside: Barninside,
  parquet: Parquet,
  firepit: Firepit,
  logo: Logo,
  specimen: Specimen,
  loaf: Loaf,
  croissant: Croissants,
  buns: Buns,
  coffee: Coffee,
};

export function Art({ scene, variant = 0, ratio, className }: { scene: Scene; variant?: number; ratio: number; className?: string }) {
  const raw = useId();
  const id = `mw${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const h = Math.round(W * ratio);
  const Draw = SCENES[scene];
  return (
    <svg className={className} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <Draw id={id} h={h} v={variant} />
    </svg>
  );
}
