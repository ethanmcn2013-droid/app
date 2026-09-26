/* Small drawn plates for chapters. No photos: shapes and strokes coloured
   from tokens, so every plate reads in light and dark. Decorative only. */

import type { Art as ArtKind } from "./data";
import s from "./c1.module.css";

const A = "var(--rt-accent)";
const INK = "var(--v3-text)";
const T3 = "var(--v3-text-3)";
const LINE = "var(--v3-border-strong)";
const SURF = "var(--v3-surface)";

function Ring() {
  return (
    <svg viewBox="0 0 560 220" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 34 }, (_, i) => (
        <line
          key={i}
          x1={i * 19 - 40}
          y1={-10}
          x2={i * 19 - 80}
          y2={230}
          stroke={LINE}
          strokeWidth="1"
        />
      ))}
      <rect x="0" y="150" width="560" height="70" fill="var(--rt-wash)" />
      <path d="M0 150 H560" stroke={T3} strokeWidth="1" />
      {[60, 120, 180, 240, 300, 360, 420, 480].map((x) => (
        <path key={x} d={`M${x} 150 V220`} stroke={LINE} strokeWidth="6" />
      ))}
      <circle cx="280" cy="98" r="40" fill="none" stroke={A} strokeWidth="9" />
      <path
        d="M268 50 l12 -16 l12 16 l-12 10 z"
        fill={SURF}
        stroke={A}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Orchard() {
  const trees = [
    [52, 124, 34],
    [128, 110, 44],
    [214, 128, 30],
    [290, 104, 50],
    [382, 122, 36],
    [458, 112, 42],
    [528, 130, 28],
  ];
  return (
    <svg viewBox="0 0 560 220" preserveAspectRatio="xMidYMid slice">
      <path
        d="M0 176 C120 164 220 184 330 172 S500 166 560 174 V220 H0 Z"
        fill="var(--rt-wash)"
      />
      {trees.map(([x, y, r], i) => (
        <g key={i}>
          <path
            d={`M${x} ${y + r * 0.5} V176`}
            stroke={T3}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle
            cx={x}
            cy={y}
            r={r}
            fill={i % 2 ? "var(--rt-wash-strong)" : "var(--rt-wash)"}
            stroke={A}
            strokeWidth="1.5"
          />
          {[0, 1, 2].map((k) => (
            <circle
              key={k}
              cx={x - r * 0.4 + k * r * 0.4}
              cy={y - r * 0.2 + (k % 2) * r * 0.35}
              r="3.5"
              fill={A}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function Envelope() {
  return (
    <svg viewBox="0 0 560 220" preserveAspectRatio="xMidYMid slice">
      <g transform="translate(160 36) rotate(-4 120 74)">
        <rect
          x="0"
          y="0"
          width="240"
          height="148"
          rx="6"
          fill={SURF}
          stroke={LINE}
          strokeWidth="1.5"
        />
        <path
          d="M0 6 L120 88 L240 6"
          fill="none"
          stroke={T3}
          strokeWidth="1.5"
        />
        <rect
          x="192"
          y="16"
          width="30"
          height="36"
          rx="2"
          fill="var(--rt-wash-strong)"
          stroke={A}
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <circle cx="120" cy="88" r="15" fill={A} />
        <path
          d="M113 88 h14 M120 81 v14"
          stroke="var(--rt-on-accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <g transform="translate(330 70) rotate(7)" opacity="0.9">
        <rect
          x="0"
          y="0"
          width="150"
          height="96"
          rx="4"
          fill="var(--rt-wash)"
          stroke={LINE}
          strokeWidth="1.2"
        />
        <path
          d="M18 30 h80 M18 48 h110 M18 66 h60"
          stroke={T3}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function Music() {
  const bars = [
    30, 58, 42, 90, 70, 110, 84, 126, 96, 72, 104, 60, 88, 46, 66, 34, 52, 24,
  ];
  return (
    <svg viewBox="0 0 560 220" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="560" height="220" fill="var(--rt-wash)" />
      {bars.map((h, i) => (
        <rect
          key={i}
          x={62 + i * 25}
          y={176 - h}
          width="13"
          height={h}
          rx="6.5"
          fill={i % 3 === 0 ? A : "var(--rt-wash-strong)"}
        />
      ))}
      <path d="M40 176 H520" stroke={T3} strokeWidth="1" />
      <circle
        cx="486"
        cy="54"
        r="22"
        fill="none"
        stroke={INK}
        strokeWidth="2"
      />
      <circle cx="486" cy="54" r="6" fill={INK} />
    </svg>
  );
}

function Sketch() {
  return (
    <svg viewBox="0 0 560 220" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 29 }, (_, i) => (
        <path
          key={`v${i}`}
          d={`M${i * 20} 0 V220`}
          stroke={LINE}
          strokeWidth="0.75"
          opacity="0.7"
        />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <path
          key={`h${i}`}
          d={`M0 ${i * 20} H560`}
          stroke={LINE}
          strokeWidth="0.75"
          opacity="0.7"
        />
      ))}
      <rect
        x="226"
        y="22"
        width="108"
        height="190"
        rx="18"
        fill={SURF}
        stroke={INK}
        strokeWidth="2"
      />
      <path
        d="M244 56 h52"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x="244"
          y={74 + i * 38}
          width="72"
          height="28"
          rx="6"
          fill={i === 1 ? A : "none"}
          stroke={i === 1 ? "none" : T3}
          strokeWidth="1.5"
        />
      ))}
      <path
        d="M350 60 C390 40 420 70 460 58"
        stroke={A}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M452 50 l10 8 l-12 5"
        stroke={A}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Phone() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <svg viewBox="0 0 560 220" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="560" height="220" fill="var(--rt-wash)" />
      <rect
        x="196"
        y="18"
        width="168"
        height="230"
        rx="24"
        fill={SURF}
        stroke={LINE}
        strokeWidth="1.5"
      />
      <path
        d="M220 50 h70"
        stroke={INK}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {days.map((d, i) => (
        <text
          key={i}
          x={222 + i * 19}
          y="78"
          fontSize="10"
          fill={T3}
          textAnchor="middle"
          fontFamily="var(--rt-body)"
        >
          {d}
        </text>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <circle
          key={i}
          cx={222 + (i % 7) * 19}
          cy={96 + Math.floor(i / 7) * 20}
          r="6"
          fill={i === 9 ? A : "none"}
          stroke={i === 9 ? "none" : LINE}
          strokeWidth="1.2"
        />
      ))}
      <rect x="214" y="146" width="132" height="34" rx="8" fill={A} />
      <path
        d="M228 163 h60"
        stroke="var(--rt-on-accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x="214"
        y="188"
        width="132"
        height="34"
        rx="8"
        fill="none"
        stroke={LINE}
        strokeWidth="1.2"
      />
    </svg>
  );
}

function River() {
  const wave = (y: number, a: number) =>
    `M-10 ${y} ` +
    Array.from({ length: 8 }, (_, i) => `q 40 ${i % 2 ? a : -a} 80 0`).join(
      " ",
    );
  return (
    <svg viewBox="0 0 560 220" preserveAspectRatio="xMidYMid slice">
      <path
        d="M0 110 C140 70 260 150 380 110 S520 80 560 96 V220 H0 Z"
        fill="var(--rt-wash)"
      />
      {[132, 156, 180, 204].map((y, i) => (
        <path
          key={y}
          d={wave(y, 7 - i)}
          stroke={i === 0 ? A : "var(--rt-wash-strong)"}
          strokeWidth={i === 0 ? 2.5 : 2}
          fill="none"
        />
      ))}
      {[90, 200, 330, 460].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 70 V130`} stroke={INK} strokeWidth="2" />
          <circle
            cx={x}
            cy="64"
            r="9"
            fill={SURF}
            stroke={INK}
            strokeWidth="2"
          />
          <text
            x={x}
            y="68"
            fontSize="10"
            textAnchor="middle"
            fill={INK}
            fontFamily="var(--rt-body)"
            fontWeight="600"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Poster() {
  const bars = [38, 64, 92, 120, 88];
  return (
    <svg viewBox="0 0 560 220" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="560" height="220" fill="var(--rt-wash)" />
      {[0, 1, 2].map((k) => (
        <g
          key={k}
          transform={`translate(${96 + k * 132} ${26 + (k % 2) * 10}) rotate(${(k - 1) * 3})`}
        >
          <rect
            width="110"
            height="160"
            rx="4"
            fill={SURF}
            stroke={LINE}
            strokeWidth="1.2"
          />
          <path
            d="M14 22 h60"
            stroke={INK}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M14 36 h82 M14 46 h70"
            stroke={T3}
            strokeWidth="2"
            strokeLinecap="round"
          />
          {bars.map((h, i) => (
            <rect
              key={i}
              x={16 + i * 17}
              y={146 - h * 0.7}
              width="11"
              height={h * 0.7}
              rx="2"
              fill={i === k + 1 ? A : "var(--rt-wash-strong)"}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

const PLATES: Record<ArtKind, () => React.ReactElement> = {
  ring: Ring,
  orchard: Orchard,
  envelope: Envelope,
  music: Music,
  sketch: Sketch,
  phone: Phone,
  river: River,
  poster: Poster,
};

export function Plate({ kind }: { kind: ArtKind }) {
  const Drawn = PLATES[kind];
  return (
    <div className={s.plate} aria-hidden="true">
      <Drawn />
    </div>
  );
}
