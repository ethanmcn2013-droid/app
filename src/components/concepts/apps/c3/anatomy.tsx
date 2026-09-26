"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { Story, StoryId } from "./data";
import { hueVar } from "./art";
import styles from "./c3.module.css";

/*
 * AnatomyFigure: the tool drawn as a specimen plate with three numbered
 * callouts. Hovering or focusing a number (on the plate or in the key)
 * lifts that part and quiets the rest: a guided read without a tour.
 */

type Part = 1 | 2 | 3;
type Plate = {
  /** Halo around each part, in viewBox units. */
  halo: Record<Part, [number, number, number, number]>;
  /** Where each number sits, in viewBox units. */
  pin: Record<Part, [number, number]>;
  draw: (g: (p: Part | 0, children: ReactNode) => ReactNode) => ReactNode;
};

const W = 640;
const Hh = 330;

const L = styles.artLine;
const P = styles.artPaper;
const Hu = styles.artHue;
const HS = styles.artHueSoft;
const M = styles.artMuted;
const T = styles.figText;
const TS = styles.figTextStrong;
const TA = styles.figTextAmber;

function Avatar({ x, y, k }: { x: number; y: number; k: string }) {
  return (
    <g>
      <circle className={HS} cx={x} cy={y} r="10" />
      <text className={styles.figInitial} x={x} y={y + 3.5} textAnchor="middle">{k}</text>
    </g>
  );
}

function Chip({ x, y, w, label, tone = "muted" }: { x: number; y: number; w: number; label: string; tone?: "muted" | "amber" | "hue" }) {
  return (
    <g>
      <rect className={tone === "amber" ? styles.figAmberSoft : tone === "hue" ? HS : styles.figFill} x={x} y={y} width={w} height="20" rx="10" />
      <text className={tone === "amber" ? TA : T} x={x + w / 2} y={y + 14} textAnchor="middle">{label}</text>
    </g>
  );
}

const PLATES: Record<StoryId, Plate> = {
  orchard: {
    halo: { 1: [28, 104, 392, 36], 2: [444, 50, 176, 170], 3: [28, 224, 392, 36] },
    pin: { 1: [28, 104], 2: [620, 50], 3: [28, 224] },
    draw: (g) => (
      <>
        {g(0, (
          <>
            <rect className={P} x="20" y="20" width="410" height="290" rx="12" />
            <text className={TS} x="40" y="50">Saturday 12 September</text>
            <Chip x={326} y={36} w={88} label="Now 19:40" tone="hue" />
            <path className={L} d="M20 66h410" opacity="0.5" />
            <text className={T} x="40" y="88">Time</text>
            <text className={T} x="104" y="88">What happens</text>
            <text className={T} x="360" y="88">Who</text>
          </>
        ))}
        {[
          { t: "14:00", s: "Ceremony in the walled garden", k: "N", y: 110, part: 0 as const },
          { t: "15:15", s: "Drinks on the lawn", k: "B", y: 150, part: 0 as const },
          { t: "17:30", s: "Dinner is served", k: "K", y: 190, part: 0 as const },
          { t: "19:45", s: "Speeches", k: "C", y: 230, part: 3 as const },
          { t: "21:00", s: "First dance", k: "L", y: 270, part: 0 as const },
        ].map((r, i) =>
          g(r.part, (
            <g key={r.t}>
              {r.part === 3 && <rect className={styles.figAmberSoft} x="30" y={r.y - 4} width="388" height="32" rx="7" />}
              <text className={r.part === 3 ? TA : TS} x="40" y={r.y + 16}>{r.t}</text>
              <text className={T} x="104" y={r.y + 16}>{r.s}</text>
              {r.part === 3 && <Chip x={236} y={r.y + 2} w={100} label="15 min late" tone="amber" />}
              <Avatar x={372} y={r.y + 12} k={r.k} />
              {i < 4 && <path className={L} d={`M40 ${r.y + 32}h370`} opacity="0.25" />}
            </g>
          )),
        )}
        {g(1, (
          <g>
            <rect className={styles.figRing} x="30" y="106" width="388" height="32" rx="7" />
          </g>
        ))}
        {g(2, (
          <g>
            <rect className={P} x="450" y="56" width="164" height="158" rx="10" />
            <circle className={Hu} cx="472" cy="80" r="10" />
            <text className={styles.figInitialOn} x="472" y="84" textAnchor="middle">B</text>
            <text className={TS} x="490" y="78">Bloom Room</text>
            <text className={T} x="490" y="94">sees 2 steps</text>
            <path className={L} d="M450 108h164" opacity="0.4" />
            <text className={TS} x="466" y="132">11:00</text>
            <text className={T} x="510" y="132">Dress the arch</text>
            <text className={TS} x="466" y="158">23:30</text>
            <text className={T} x="510" y="158">Collect vases</text>
            <rect className={styles.figFill} x="462" y="176" width="140" height="24" rx="12" />
            <text className={T} x="532" y="192" textAnchor="middle">No sign-in needed</text>
            <path className={L} d="M430 122c8 0 12 0 20 0" strokeDasharray="2 4" />
          </g>
        ))}
      </>
    ),
  },
  replies: {
    halo: { 1: [192, 104, 432, 40], 2: [228, 26, 396, 76], 3: [486, 150, 138, 90] },
    pin: { 1: [192, 104], 2: [624, 26], 3: [624, 150] },
    draw: (g) => (
      <>
        {g(0, (
          <>
            <rect className={P} x="16" y="40" width="156" height="210" rx="12" />
            <text className={TS} x="32" y="68">Will you come?</text>
            <rect className={HS} x="32" y="82" width="58" height="26" rx="13" />
            <text className={T} x="61" y="99" textAnchor="middle">Yes</text>
            <rect className={styles.figFill} x="98" y="82" width="58" height="26" rx="13" />
            <text className={T} x="127" y="99" textAnchor="middle">No</text>
            <text className={T} x="32" y="134">Bringing someone?</text>
            <rect className={styles.figFill} x="32" y="142" width="124" height="24" rx="6" />
            <text className={T} x="32" y="188">For the kitchen</text>
            <rect className={styles.figFill} x="32" y="196" width="124" height="36" rx="6" />
            <rect className={P} x="236" y="30" width="380" height="270" rx="12" />
          </>
        ))}
        {g(2, (
          <>
            {[42, 72].map((y, i) => (
              <g key={y}>
                <Chip x={248} y={y + 4} w={70} label="Waiting" tone="amber" />
                <text className={TS} x="330" y={y + 18}>{i === 0 ? "Aunt Bríd and Pádraig" : "Dara Keane"}</text>
                <text className={T} x="530" y={y + 18}>{i === 0 ? "Asked twice" : "Asked once"}</text>
              </g>
            ))}
          </>
        ))}
        {g(1, (
          <>
            <path className={L} d="M172 124c10 0 14 0 22 0" strokeDasharray="3 4" />
            <path className={L} d="M188 118l8 6-8 6" />
            <rect className={styles.figRing} x="242" y="108" width="370" height="32" rx="7" />
            <Chip x={248} y={114} w={70} label="Coming" tone="hue" />
            <text className={TS} x="330" y="128">Lucy and Sam Hart</text>
            <text className={T} x="530" y="128">Just now</text>
          </>
        ))}
        {g(0, (
          <>
            {[
              { n: "Ronan Duffy", note: "No gluten", y: 154 },
              { n: "Grace Adeyemi", note: "Vegetarian", y: 190 },
              { n: "The Morrisseys", note: "Not coming", y: 226 },
              { n: "Sinéad Hayes", note: "", y: 262 },
            ].map((r) => (
              <g key={r.n}>
                <path className={L} d={`M248 ${r.y - 8}h356`} opacity="0.25" />
                <Chip x={248} y={r.y} w={70} label={r.note === "Not coming" ? "No" : "Coming"} tone={r.note === "Not coming" ? "muted" : "hue"} />
                <text className={TS} x="330" y={r.y + 14}>{r.n}</text>
              </g>
            ))}
          </>
        ))}
        {g(3, (
          <>
            <Chip x={492} y={154} w={84} label="No gluten" />
            <Chip x={492} y={190} w={84} label="Vegetarian" />
            <path className={L} d="M578 164c14 0 18 20 18 50" strokeDasharray="2 4" />
            <rect className={P} x="520" y="214" width="96" height="24" rx="12" />
            <text className={T} x="568" y="230" textAnchor="middle">Chef&apos;s copy</text>
          </>
        ))}
      </>
    ),
  },
  students: {
    halo: { 1: [26, 104, 144, 58], 2: [20, 34, 600, 40], 3: [470, 262, 150, 44] },
    pin: { 1: [26, 104], 2: [620, 34], 3: [470, 262] },
    draw: (g) => {
      const cols = [
        { n: "Priya", parts: ["Sampling, east bank", "Sampling, bridge", "Sampling, weir"] },
        { n: "Tom", parts: ["Photos", "Site map", "Data tables"] },
        { n: "Sam", parts: ["Charts"] },
        { n: "Leah", parts: ["Write-up", "References"] },
      ];
      return (
        <>
          {g(2, (
            <>
              <text className={T} x="28" y="30">How the work is shared</text>
              {[0, 1, 2, 3].map((i) => {
                const widths = [178, 160, 90, 150];
                const x = 28 + widths.slice(0, i).reduce((a, b) => a + b + 4, 0);
                return <rect key={i} className={i % 2 === 0 ? Hu : HS} x={x} y={42} width={widths[i]} height="22" rx="6" />;
              })}
            </>
          ))}
          {g(0, (
            <>
              {cols.map((c, i) => {
                const x = 28 + i * 150;
                return (
                  <g key={c.n}>
                    <Avatar x={x + 12} y={92} k={c.n[0]} />
                    <text className={TS} x={x + 30} y={96}>{c.n}</text>
                    {c.parts.map((p, j) =>
                      i === 0 && j === 0 ? null : (
                        <g key={p}>
                          <rect className={P} x={x} y={110 + j * 48} width="138" height="40" rx="8" />
                          <text className={T} x={x + 12} y={134 + j * 48}>{p}</text>
                        </g>
                      ),
                    )}
                  </g>
                );
              })}
              <path className={L} d="M334 180c30 0 40-30 62-30" strokeDasharray="3 4" />
              <path className={L} d="M390 144l8 6-8 6" />
            </>
          ))}
          {g(1, (
            <g>
              <rect className={P} x="28" y="110" width="138" height="40" rx="8" />
              <text className={T} x="40" y="134">Sampling, east bank</text>
              <circle className={Hu} cx="152" cy="130" r="8" />
              <text className={styles.figInitialOn} x="152" y="133.5" textAnchor="middle">P</text>
            </g>
          ))}
          {g(3, (
            <>
              <rect className={HS} x="476" y="268" width="138" height="32" rx="16" />
              <text className={TS} x="545" y="289" textAnchor="middle">Due Fri 9 Oct</text>
            </>
          ))}
        </>
      );
    },
  },
  launch: {
    halo: { 1: [518, 60, 106, 150], 2: [226, 216, 150, 90], 3: [16, 44, 170, 130] },
    pin: { 1: [624, 60], 2: [226, 216], 3: [16, 44] },
    draw: (g) => {
      const marks = [
        { d: 21, x: 220 },
        { d: 14, x: 300 },
        { d: 7, x: 380 },
        { d: 2, x: 460 },
        { d: 0, x: 560 },
      ];
      return (
        <>
          {g(3, (
            <>
              <rect className={P} x="24" y="52" width="154" height="114" rx="12" />
              <text className={styles.figBig} x="42" y="118">21</text>
              <text className={TS} x="104" y="104">days</text>
              <text className={T} x="104" y="120">to go</text>
              <rect className={styles.figFill} x="40" y="134" width="122" height="22" rx="11" />
              <text className={T} x="101" y="149" textAnchor="middle">Shared with owners</text>
            </>
          ))}
          {g(0, (
            <>
              <path className={L} d="M210 170H600" />
              {marks.slice(0, 4).map((m) => (
                <g key={m.d}>
                  <circle className={m.d === 21 ? Hu : M} cx={m.x} cy="170" r="6" />
                  <text className={T} x={m.x} y="196" textAnchor="middle">{m.d}</text>
                  <rect className={P} x={m.x - 40} y="100" width="80" height="44" rx="8" />
                  <path className={L} d={`M${m.x - 28} 116h52M${m.x - 28} 128h34`} opacity="0.7" />
                  <path className={L} d={`M${m.x} 144v20`} opacity="0.5" />
                </g>
              ))}
            </>
          ))}
          {g(1, (
            <>
              <circle className={Hu} cx="560" cy="170" r="10" />
              <text className={T} x="560" y="200" textAnchor="middle">0</text>
              <rect className={HS} x="524" y="68" width="92" height="64" rx="10" />
              <text className={TS} x="570" y="94" textAnchor="middle">Opening</text>
              <text className={T} x="570" y="112" textAnchor="middle">3 Nov, 8am</text>
              <path className={L} d="M560 132v26" />
            </>
          ))}
          {g(2, (
            <>
              <path className={L} d="M380 176v40" strokeDasharray="2 3" />
              <rect className={P} x="234" y="222" width="180" height="76" rx="10" />
              <rect className={HS} x="246" y="234" width="52" height="52" rx="6" />
              <text className={TS} x="310" y="250">Post</text>
              <text className={T} x="310" y="268">The pastry case</text>
              <text className={T} x="310" y="286">7 days to go</text>
            </>
          ))}
        </>
      );
    },
  },
  deposits: {
    halo: { 1: [26, 60, 96, 190], 2: [434, 30, 190, 176], 3: [26, 262, 400, 50] },
    pin: { 1: [26, 60], 2: [624, 30], 3: [26, 262] },
    draw: (g) => {
      const rows = [
        { d: "2 Sep", s: "Band balance", v: "€1,800", paid: true },
        { d: "5 Sep", s: "Florist deposit", v: "€450", paid: true },
        { d: "14 Sep", s: "Marquee hire", v: "€2,200", paid: false },
        { d: "21 Sep", s: "Cake balance", v: "€320", paid: false },
        { d: "28 Sep", s: "Photographer", v: "€900", paid: false },
      ];
      return (
        <>
          {g(0, (
            <>
              <rect className={P} x="20" y="30" width="400" height="224" rx="12" />
              <text className={T} x="36" y="54">Due</text>
              <text className={T} x="132" y="54">Cost</text>
              {rows.map((r, i) => (
                <g key={r.d}>
                  <text className={T} x="132" y={88 + i * 36}>{r.s}</text>
                  <text className={TS} x="330" y={88 + i * 36} textAnchor="end">{r.v}</text>
                  <Chip x={346} y={74 + i * 36} w={58} label={r.paid ? "Paid" : "To pay"} tone={r.paid ? "hue" : "muted"} />
                </g>
              ))}
            </>
          ))}
          {g(1, (
            <>
              {rows.map((r, i) => (
                <Chip key={r.d} x={34} y={74 + i * 36} w={80} label={r.d} tone={i === 3 ? "amber" : "muted"} />
              ))}
            </>
          ))}
          {g(2, (
            <>
              <rect className={P} x="440" y="36" width="178" height="164" rx="12" />
              <text className={TS} x="456" y="60">Your calendar</text>
              {Array.from({ length: 21 }, (_, i) => {
                const cx = 462 + (i % 7) * 23;
                const cy = 84 + Math.floor(i / 7) * 24;
                const on = i === 6 || i === 13 || i === 20;
                return <circle key={i} className={on ? Hu : M} cx={cx} cy={cy} r={on ? 6 : 2} />;
              })}
              <rect className={HS} x="454" y="160" width="150" height="26" rx="8" />
              <text className={T} x="529" y="177" textAnchor="middle">Cake balance in 7 days</text>
              <path className={L} d="M420 158c10 0 18 8 30 14" strokeDasharray="2 4" />
            </>
          ))}
          {g(3, (
            <>
              <rect className={Hu} x="36" y="274" width="140" height="14" rx="7" />
              <rect className={M} x="180" y="274" width="232" height="14" rx="7" />
              <text className={TS} x="36" y="306">Paid €2,250</text>
              <text className={T} x="412" y="306" textAnchor="end">To pay €3,420</text>
            </>
          ))}
        </>
      );
    },
  },
  lectures: {
    halo: { 1: [20, 26, 330, 284], 2: [34, 118, 300, 90], 3: [398, 70, 226, 170] },
    pin: { 1: [20, 26], 2: [334, 118], 3: [624, 70] },
    draw: (g) => (
      <>
        {g(1, (
          <>
            <rect className={P} x="26" y="32" width="318" height="272" rx="12" />
            <text className={TS} x="46" y="62">Thursday, river flow</text>
            {[86, 104].map((y, i) => <path key={y} className={L} d={`M46 ${y}h${i ? 180 : 250}`} opacity="0.6" />)}
            {[230, 248, 266, 284].map((y, i) => <path key={y} className={L} d={`M46 ${y}h${[230, 160, 250, 120][i]}`} opacity="0.6" />)}
          </>
        ))}
        {g(2, (
          <>
            <rect className={HS} x="40" y="124" width="288" height="30" rx="6" />
            <text className={TS} x="52" y="144">Tom to book the minibus by Tue</text>
            <path className={L} d="M52 170h200" opacity="0.6" />
            <rect className={HS} x="40" y="176" width="288" height="30" rx="6" />
            <text className={TS} x="52" y="196">Sam emails the river trust, Fri</text>
          </>
        ))}
        {g(0, (
          <>
            <path className={L} d="M334 140c30 0 40-40 70-40M334 192c30 0 40 10 70 10" strokeDasharray="3 4" />
          </>
        ))}
        {g(3, (
          <>
            {[{ y: 76, t: "Book the minibus", w: "Tom, Tue" }, { y: 160, t: "Email the river trust", w: "Sam, Fri" }].map((c) => (
              <g key={c.y}>
                <rect className={P} x="404" y={c.y} width="214" height="72" rx="10" />
                <text className={TS} x="420" y={c.y + 26}>{c.t}</text>
                <text className={T} x="420" y={c.y + 44}>{c.w}</text>
                <rect className={Hu} x="536" y={c.y + 42} width="34" height="20" rx="10" />
                <text className={styles.figInitialOn} x="553" y={c.y + 56} textAnchor="middle">Add</text>
                <text className={T} x="594" y={c.y + 56} textAnchor="middle">Skip</text>
              </g>
            ))}
          </>
        ))}
      </>
    ),
  },
};

export function AnatomyFigure({ story }: { story: Story }) {
  const [active, setActive] = useState<Part | null>(null);
  const plate = PLATES[story.id];
  const style = { "--hue": hueVar(story.hue) } as CSSProperties;
  let n = 0;
  const g = (p: Part | 0, children: ReactNode) => (
    <g
      key={n++}
      className={active === null ? styles.part : active === p ? styles.partOn : styles.partOff}
    >
      {children}
    </g>
  );
  const on = (p: Part) => ({
    onMouseEnter: () => setActive(p),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(p),
    onBlur: () => setActive(null),
  });
  return (
    <figure className={styles.figure} style={style}>
      <div className={styles.figHead}>
        <span className={styles.figTitle}>{story.figure.title}</span>
        <span className={styles.figHint}>Point at a number to see that part</span>
      </div>
      <div className={styles.plateScroll}>
        <div className={styles.plate}>
          <svg viewBox={`0 0 ${W} ${Hh}`} className={styles.plateSvg} role="img" aria-label={`${story.figure.title}. ${story.figure.callouts.map((c, i) => `${i + 1}: ${c}`).join(". ")}`}>
            {active !== null && (
              <rect
                className={styles.halo}
                x={plate.halo[active][0] - 6}
                y={plate.halo[active][1] - 6}
                width={plate.halo[active][2] + 12}
                height={plate.halo[active][3] + 12}
                rx="12"
              />
            )}
            {plate.draw(g)}
          </svg>
          {([1, 2, 3] as Part[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`${styles.pin} ${active === p ? styles.pinOn : ""}`}
              style={{ left: `${(plate.pin[p][0] / W) * 100}%`, top: `${(plate.pin[p][1] / Hh) * 100}%` }}
              aria-label={`${p}: ${story.figure.callouts[p - 1]}`}
              {...on(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <ol className={styles.key}>
        {story.figure.callouts.map((c, i) => {
          const p = (i + 1) as Part;
          return (
            <li key={c}>
              <button type="button" className={`${styles.keyItem} ${active === p ? styles.keyItemOn : ""}`} {...on(p)}>
                <span className={styles.keyNum}>{p}</span>
                <span>{c}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <figcaption className={styles.figCaption}>{story.figure.caption}</figcaption>
    </figure>
  );
}
