"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import type { StoryId } from "./data";
import styles from "./c3.module.css";

/*
 * Editorial illustrations, drawn from tokens only: strokes in text-2,
 * paper in surface, colour from the story's project identity (--hue).
 * No white paper boxes in dark mode: paper is var(--v3-surface).
 */

const L = styles.artLine;
const P = styles.artPaper;
const H = styles.artHue;
const HS = styles.artHueSoft;
const M = styles.artMuted;
const A = styles.artAmber;
const T = styles.artText;
const TS = styles.artTextStrong;

export function hueVar(h: number) {
  return `var(--v3-project-${h})`;
}

export function Art({ id, hue, lead = false }: { id: StoryId; hue: number; lead?: boolean }) {
  const style = { "--hue": hueVar(hue) } as CSSProperties;
  const body =
    id === "orchard" ? <RunSheet lead={lead} /> :
    id === "replies" ? <Replies /> :
    id === "students" ? <Split /> :
    id === "launch" ? <Backwards /> :
    id === "deposits" ? <Deposits /> :
    <NotesArt />;
  return (
    <svg className={styles.artSvg} viewBox={id === "orchard" ? "0 0 520 340" : "0 0 360 200"} preserveAspectRatio="xMidYMid meet" style={style} aria-hidden>
      {body}
    </svg>
  );
}

/* A run-sheet unrolling from its roll like a raffle ticket. */
function RunSheet({ lead }: { lead: boolean }) {
  const reduce = useReducedMotion();
  const rows = [
    { t: "11:00", w: 132, d: 1 },
    { t: "12:30", w: 104, d: 0 },
    { t: "14:00", w: 150, d: 1 },
    { t: "15:15", w: 96, d: 0 },
    { t: "17:30", w: 120, d: 0 },
    { t: "19:45", w: 84, d: 2 },
    { t: "21:00", w: 112, d: 1 },
  ];
  const animate = lead && !reduce;
  return (
    <g>
      {/* sun and a sprig: The Orchard */}
      <circle className={HS} cx="92" cy="92" r="54" />
      <path className={L} d="M52 268c30-10 46-34 52-66" />
      <path className={L} d="M70 250c-14-2-22-10-24-22 12 0 22 8 24 22zM86 226c-12-6-16-16-14-28 10 4 16 14 14 28zM98 204c-8-8-8-20-2-28 6 8 8 18 2 28z" />
      <circle className={H} cx="108" cy="190" r="7" />
      <circle className={H} cx="92" cy="222" r="5.5" />

      {/* the roll */}
      <g transform="rotate(-4 330 60)">
        <rect className={P} x="206" y="36" width="248" height="40" rx="20" />
        <ellipse className={P} cx="454" cy="56" rx="10" ry="20" />
        <ellipse className={M} cx="454" cy="56" rx="4" ry="8" />
        <path className={L} d="M226 48h200" strokeDasharray="2 6" />

        {/* the strip */}
        <motion.g
          initial={animate ? { clipPath: "inset(0 0 100% 0)" } : false}
          animate={{ clipPath: "inset(0 0 0% 0)" }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
        >
          <path
            className={P}
            d="M222 64h216v236l-9 8-9-8-9 8-9-8-9 8-9-8-9 8-9-8-9 8-9-8-9 8-9-8-9 8-9-8-9 8-9-8-9 8-9-8-9 8-9-8-9 8-9-8-9 8-9-8z"
          />
          <path className={L} d="M222 268h216" strokeDasharray="3 5" />
          <text className={TS} x="240" y="94">Saturday</text>
          <rect className={H} x="382" y="84" width="38" height="14" rx="7" />
          {rows.map((r, i) => {
            const y = 118 + i * 20;
            return (
              <g key={r.t}>
                {r.d === 2 && <rect className={A} x="230" y={y - 12} width="200" height="18" rx="5" opacity="0.28" />}
                <text className={T} x="240" y={y + 1}>{r.t}</text>
                <rect className={M} x="284" y={y - 5} width={r.w} height="6" rx="3" />
                <circle className={r.d === 2 ? A : r.d === 1 ? H : M} cx="420" cy={y - 2} r="4.5" />
              </g>
            );
          })}
          <text className={T} x="240" y="290">Admit one day</text>
          <circle className={L} cx="412" cy="286" r="8" />
          <path className={L} d="M408 286l3 3 5-6" />
        </motion.g>
      </g>
    </g>
  );
}

/* Replies arriving from five places, gathered into one count. */
function Replies() {
  return (
    <g>
      <circle className={HS} cx="266" cy="96" r="62" />
      {/* postcard */}
      <g transform="rotate(-10 86 70)">
        <rect className={P} x="36" y="40" width="104" height="66" rx="6" />
        <path className={L} d="M92 48v50M100 60h30M100 70h24M100 80h28" />
        <rect className={H} x="46" y="50" width="36" height="26" rx="3" opacity="0.55" />
      </g>
      {/* text message */}
      <g>
        <rect className={P} x="44" y="122" width="96" height="40" rx="14" />
        <path className={L} d="M58 136h64M58 147h40" />
        <path className={P} d="M60 160l-8 12 18-10" />
      </g>
      {/* envelope */}
      <g transform="rotate(6 196 150)">
        <rect className={P} x="150" y="124" width="92" height="58" rx="5" />
        <path className={L} d="M152 128l44 30 44-30" />
      </g>
      {/* arrows gathering */}
      <path className={L} d="M146 78c40 0 60 6 80 16M146 140c30-6 56-16 76-32M226 150c6-12 12-22 20-30" strokeDasharray="3 5" />
      {/* the count */}
      <circle className={P} cx="266" cy="96" r="38" />
      <text className={styles.artNumber} x="266" y="108" textAnchor="middle">27</text>
      <circle className={H} cx="296" cy="66" r="11" />
      <path className={styles.artOnHue} d="M290.5 66l4 4 7-8" />
    </g>
  );
}

/* Four people, one split, one flag. */
function Split() {
  const people = [
    { x: 96, y: 58 },
    { x: 264, y: 58 },
    { x: 96, y: 150 },
    { x: 264, y: 150 },
  ];
  return (
    <g>
      <circle className={HS} cx="180" cy="104" r="70" />
      <circle className={P} cx="180" cy="104" r="46" />
      <path className={H} d="M180 104V58a46 46 0 0144 34z" />
      <path className={M} d="M180 104l44-12a46 46 0 01-26 54z" opacity="0.9" />
      <path className={HS} d="M180 104l18 42a46 46 0 01-50-8z" />
      <path className={L} d="M180 58v46l44-12M180 104l18 42M180 104l-32 34M180 104l-46-4" />
      {people.map((p, i) => (
        <g key={i}>
          <circle className={P} cx={p.x} cy={p.y} r="15" />
          <circle className={L} cx={p.x} cy={p.y - 4} r="5" />
          <path className={L} d={`M${p.x - 8} ${p.y + 9}c2-6 14-6 16 0`} />
        </g>
      ))}
      {/* the deadline flag */}
      <path className={L} d="M318 176V106" />
      <path className={H} d="M318 106h28l-8 10 8 10h-28z" />
      <text className={T} x="300" y="192">Fri</text>
    </g>
  );
}

/* Tear-off pages counting back to day zero. */
function Backwards() {
  const pages = ["21", "14", "7", "0"];
  return (
    <g>
      <circle className={HS} cx="258" cy="92" r="60" />
      {pages.map((n, i) => {
        const x = 40 + i * 62;
        const y = 44 + (i % 2) * 10;
        const last = i === pages.length - 1;
        return (
          <g key={n} transform={`rotate(${(i - 1.5) * 4} ${x + 36} ${y + 50})`}>
            <rect className={P} x={x} y={y} width="72" height="92" rx="7" />
            <rect className={last ? H : M} x={x} y={y} width="72" height="20" rx="7" />
            <rect className={last ? H : M} x={x} y={y + 12} width="72" height="8" />
            <text className={last ? styles.artNumberHue : styles.artNumberSmall} x={x + 36} y={y + 70} textAnchor="middle">
              {n}
            </text>
          </g>
        );
      })}
      <path className={L} d="M300 168H60" strokeDasharray="3 5" />
      <path className={L} d="M72 162l-12 6 12 6" />
      {/* cup */}
      <path className={P} d="M300 150h34v18a14 14 0 01-14 14h-6a14 14 0 01-14-14z" />
      <path className={L} d="M334 156h5a6 6 0 010 12h-5M312 140c-2-4 2-6 0-10M322 140c-2-4 2-6 0-10" />
    </g>
  );
}

/* A month with deposits sitting on their dates. */
function Deposits() {
  const cells = Array.from({ length: 28 }, (_, i) => i);
  const paid = new Set([1, 4]);
  const due = new Set([13, 20, 27]);
  return (
    <g>
      <circle className={HS} cx="270" cy="70" r="52" />
      <rect className={P} x="44" y="30" width="196" height="150" rx="10" />
      <path className={L} d="M44 58h196" />
      <text className={TS} x="58" y="50">September</text>
      {cells.map((i) => {
        const cx = 64 + (i % 7) * 26;
        const cy = 76 + Math.floor(i / 7) * 26;
        if (paid.has(i)) return <circle key={i} className={H} cx={cx} cy={cy} r="8" />;
        if (due.has(i)) return <circle key={i} className={L} cx={cx} cy={cy} r="8" />;
        return <circle key={i} className={M} cx={cx} cy={cy} r="2" />;
      })}
      {/* coins */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <ellipse className={P} cx="290" cy={164 - i * 10} rx="30" ry="9" />
        </g>
      ))}
      <ellipse className={H} cx="290" cy="124" rx="30" ry="9" />
      <text className={styles.artOnHueText} x="290" y="128" textAnchor="middle">€</text>
      <path className={L} d="M240 118c14-6 20-6 24-2" strokeDasharray="3 4" />
    </g>
  );
}

/* A page of fast notes, two lines lifting off as tasks. */
function NotesArt() {
  return (
    <g>
      <circle className={HS} cx="96" cy="70" r="52" />
      <rect className={P} x="48" y="26" width="160" height="156" rx="8" />
      <path className={L} d="M64 50h96M64 66h120M64 82h70" opacity="0.7" />
      <rect className={HS} x="58" y="94" width="140" height="16" rx="4" />
      <path className={L} d="M64 102h110" />
      <path className={L} d="M64 124h84M64 140h112" opacity="0.7" />
      <rect className={HS} x="58" y="150" width="140" height="16" rx="4" />
      <path className={L} d="M64 158h92" />
      <path className={L} d="M204 102c30 0 40-20 62-20M204 158c30 0 40-6 62-6" strokeDasharray="3 5" />
      {[82, 152].map((y) => (
        <g key={y}>
          <rect className={P} x="266" y={y - 16} width="72" height="32" rx="8" />
          <rect className={H} x="276" y={y - 7} width="14" height="14" rx="4" />
          <path className={styles.artOnHue} d={`M279.5 ${y}l3 3 5-6`} />
          <path className={L} d={`M298 ${y}h30`} />
        </g>
      ))}
    </g>
  );
}
