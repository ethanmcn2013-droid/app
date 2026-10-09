/* Every Day Poster: one pure composition for every format and world.
   The screen (SVG) and the downloaded image (canvas) both draw the scene
   this returns, so the export cannot drift from what people see.
   Every length is a multiple of u, the short side over 1080. */

import {
  dateOfMonth,
  fmtDM,
  fmtDMY,
  monthInitial,
  monthOf,
  yearOf,
  type Format,
  type Model,
} from "./data";

export type Role =
  | "paper"
  | "ink"
  | "muted"
  | "hollow"
  | "accent"
  | "accentText"
  | "onAccent"
  | "tint";
export type Face = "serif" | "sans" | "round";

export type TextItem = {
  key: string;
  x: number;
  y: number;
  text: string;
  size: number;
  weight: number;
  face: Face;
  anchor: "start" | "middle" | "end";
  role: Role;
  italic?: boolean;
  track?: number;
  opacity?: number;
};

export type RectItem = { key: string; x: number; y: number; w: number; h: number; role: Role; rx?: number };
export type PathItem = { key: string; d: string; role: Role; w: number; fill?: Role; opacity?: number };

export type DotItem = {
  i: number;
  cx: number;
  cy: number;
  r: number;
  fill: Role;
  stroke?: Role;
  sw?: number;
  opacity?: number;
  /** Fill-wave delay in ms, for days already lived. */
  wave?: number;
  today?: boolean;
  /** The final day as a target (ring + dot). */
  target?: { ring: number; sw: number };
  pulse?: boolean;
  /** The final day, once it has happened. */
  star?: string;
  num?: { text: string; role: Role; size: number };
};

export type GridGeo = {
  x0: number;
  y0: number;
  p: number;
  /** Units (weeks, or months on long projects) per row. */
  G: number;
  rows: number;
  gut: number;
  /** Cells per unit: 7 for weeks, 31 for months. */
  L: number;
  /** Day index of each unit's first cell (may be negative). */
  unitStart: number[];
  unitOf: number[];
  kOf: number[];
  count: number;
};

export type Scene = {
  W: number;
  H: number;
  u: number;
  rects: RectItem[];
  paths: PathItem[];
  dots: DotItem[];
  texts: TextItem[];
  grid: GridGeo;
  todayRing: { cx: number; cy: number; r: number; sw: number } | null;
  hollowW: number;
  mark: { cx: number; cy: number; r: number; sw: number };
};

export type Measure = (text: string, size: number, weight: number, face: Face, italic?: boolean, track?: number) => number;

type Grammar = {
  display: Face;
  body: Face;
  weight: number;
  track: number;
  titleMax: number;
  dotR: number;
  caps: "both" | "left";
};

const GRAMMAR: Record<Model["world"]["grammar"], Grammar> = {
  centred: { display: "serif", body: "serif", weight: 400, track: -0.03, titleMax: 178, dotR: 0.35, caps: "both" },
  asym: { display: "sans", body: "sans", weight: 700, track: -0.055, titleMax: 250, dotR: 0.35, caps: "left" },
  playful: { display: "round", body: "round", weight: 700, track: -0.04, titleMax: 150, dotR: 0.4, caps: "both" },
};

type Box = { x: number; y: number; w: number; h: number };

export function compose(model: Model, format: Format, W: number, H: number, measure: Measure): Scene {
  const u = Math.min(W, H) / 1080;
  const g = GRAMMAR[model.world.grammar];
  const story = format === "story";
  const wide = format === "wide";
  const square = format === "square";
  const S = story ? 1.24 : square ? 0.9 : 1;
  const m = (story ? 68 : wide ? 80 : 72) * u;

  const texts: TextItem[] = [];
  const rects: RectItem[] = [];
  const paths: PathItem[] = [];

  /* ── Regions ─────────────────────────────────────────────────── */
  const panelW = wide ? W * 0.4 : W;
  const head: Box = { x: m, y: m, w: panelW - 2 * m + (wide ? m * 0.5 : 0), h: 0 };
  const footH = (wide ? 190 : 150) * S * u;

  /* ── Header ──────────────────────────────────────────────────── */
  let y = head.y;
  const hx = head.x;
  const hw = head.w;
  const centreX = hx + hw / 2;
  const w = model.world;

  const fitTitle = (maxW: number, max: number) => {
    let size = max;
    for (const line of w.title) {
      const at100 = measure(line, 100, g.weight, g.display, false, g.track);
      size = Math.min(size, (maxW / at100) * 100);
    }
    return size;
  };

  if (w.grammar === "centred") {
    const ks = 28 * S * u;
    y += ks;
    texts.push({ key: "kicker", x: centreX, y, text: w.kicker, size: ks, weight: 400, face: g.body, anchor: "middle", role: "muted", italic: true });
    const ts = fitTitle(hw, g.titleMax * S * u);
    y += 26 * u + ts * 0.74;
    w.title.forEach((line, li) => {
      /* The ampersand is set in the accent, italic: the one flourish. */
      const parts = line.split(/(&)/);
      const widths = parts.map((part) =>
        measure(part, ts, g.weight, g.display, part === "&", g.track),
      );
      let x = centreX - widths.reduce((a, b) => a + b, 0) / 2;
      parts.forEach((part, pi) => {
        texts.push({
          key: `title-${li}-${pi}`,
          x,
          y: y + li * ts * 0.98,
          text: part,
          size: ts,
          weight: g.weight,
          face: g.display,
          anchor: "start",
          role: part === "&" ? "accentText" : "ink",
          italic: part === "&",
          track: g.track,
        });
        x += widths[pi];
      });
    });
    y += (w.title.length - 1) * ts * 0.98;
    const ds = 30 * S * u;
    y += 30 * u + ts * 0.18 + ds;
    texts.push({ key: "date", x: centreX, y, text: model.dateLine, size: ds, weight: 400, face: g.body, anchor: "middle", role: "ink" });
    const ps = 25 * S * u;
    y += ps * 1.55;
    texts.push({ key: "place", x: centreX, y, text: w.place, size: ps, weight: 400, face: g.body, anchor: "middle", role: "muted", italic: true });
  } else if (w.grammar === "asym") {
    const ks0 = 21 * S * u;
    y += ks0;
    const dateW = measure(model.dateLine, ks0, 600, g.body);
    const kickerMax = hw - dateW - 36 * u;
    const kw = measure(w.kicker, ks0, 500, g.body);
    const ks = kw > kickerMax ? ks0 * (kickerMax / kw) : ks0;
    texts.push({ key: "kicker", x: hx, y, text: w.kicker, size: ks, weight: 500, face: g.body, anchor: "start", role: "muted" });
    texts.push({ key: "date", x: hx + hw, y, text: model.dateLine, size: ks0, weight: 600, face: g.body, anchor: "end", role: "ink" });
    y += 20 * u;
    const ruleH = 14 * S * u;
    rects.push({ key: "rule", x: hx, y, w: hw, h: ruleH, role: "ink" });
    y += ruleH;
    const ts = fitTitle(hw * 0.96, g.titleMax * S * u);
    y += 22 * u + ts * 0.73;
    w.title.forEach((line, li) => {
      texts.push({ key: `title-${li}`, x: hx - ts * 0.04, y: y + li * ts * 0.9, text: line, size: ts, weight: g.weight, face: g.display, anchor: "start", role: "ink", track: g.track });
    });
    y += (w.title.length - 1) * ts * 0.9;
    const ps = 27 * S * u;
    y += 22 * u + ts * 0.08 + ps;
    texts.push({ key: "place", x: hx, y, text: w.place, size: ps, weight: 500, face: g.body, anchor: "start", role: "ink" });
  } else {
    const ks = 21 * S * u;
    const pillH = 46 * S * u;
    const pillW = measure(w.kicker, ks, 600, g.body) + 38 * u;
    rects.push({ key: "pill", x: hx, y, w: pillW, h: pillH, role: "tint", rx: pillH / 2 });
    texts.push({ key: "kicker", x: hx + 19 * u, y: y + pillH / 2 + ks * 0.36, text: w.kicker, size: ks, weight: 600, face: g.body, anchor: "start", role: "ink" });
    y += pillH;
    const ts = fitTitle(hw * 0.94, g.titleMax * S * u);
    y += 30 * u + ts * 0.75;
    w.title.forEach((line, li) => {
      texts.push({ key: `title-${li}`, x: hx - ts * 0.03, y: y + li * ts * 0.98, text: line, size: ts, weight: g.weight, face: g.display, anchor: "start", role: "ink", track: g.track });
    });
    y += (w.title.length - 1) * ts * 0.98;
    /* A river, drawn once, under the name. */
    const wy = y + 30 * u;
    const ww = Math.min(hw * 0.5, 300 * S * u);
    const seg = ww / 4;
    let d = `M ${hx} ${wy}`;
    for (let k = 0; k < 4; k += 1) {
      const x0 = hx + k * seg;
      d += ` C ${x0 + seg * 0.25} ${wy - 11 * u * S} ${x0 + seg * 0.75} ${wy + 11 * u * S} ${x0 + seg} ${wy}`;
    }
    paths.push({ key: "river", d, role: "accent", w: 5 * u * S });
    const ds = 25 * S * u;
    y = wy + 26 * u + ds;
    const span = model.end !== null ? `${fmtDM(model.start)} to ${fmtDMY(model.end)}` : `From ${fmtDMY(model.start)}`;
    texts.push({ key: "date", x: hx, y, text: `${span} · ${w.place}`, size: ds, weight: 500, face: g.body, anchor: "start", role: "muted" });
  }
  const headBottom = y;

  /* ── Footer: one number in the corner, and the mark ──────────── */
  const bigSize = (model.bigIsWord ? 76 : 132) * S * u;
  const smallSize = 24 * S * u;
  const markSize = 17 * S * u;
  const footBottom = H - m;
  const bigX = m;
  const bigY = footBottom - smallSize * 1.25 - bigSize * (model.big.includes("y") || model.bigIsWord ? 0.2 : 0.06);
  if (model.world.grammar === "asym" && !wide) {
    rects.push({ key: "foot-rule", x: m, y: footBottom - footH, w: W - 2 * m, h: 2 * u, role: "ink" });
  }
  texts.push({
    key: "big",
    x: bigX - bigSize * 0.03,
    y: bigY,
    text: model.big,
    size: bigSize,
    weight: model.world.grammar === "centred" ? 400 : 700,
    face: g.display,
    anchor: "start",
    role: model.moment === "after" ? "accentText" : "ink",
    track: model.world.grammar === "centred" ? -0.03 : -0.05,
  });
  texts.push({ key: "small", x: bigX, y: footBottom, text: model.small, size: smallSize, weight: 500, face: g.body, anchor: "start", role: "muted" });

  /* Wide has a quiet middle in its left panel: say what comes next. */
  const next = model.milestones.find((ms) => ms.state === "next");
  if (wide && next) {
    const ns = 26 * u;
    const ny = bigY - bigSize * 0.95 - 30 * u;
    const left = hx;
    const anchor = "start" as const;
    const when = next.n - model.today;
    texts.push({ key: "next-k", x: left, y: ny - ns * 1.35, text: when === 0 ? "Today" : `Next, in ${when} ${when === 1 ? "day" : "days"}`, size: ns * 0.82, weight: 500, face: g.body, anchor, role: "muted" });
    texts.push({ key: "next-l", x: left, y: ny, text: `${next.label}, ${fmtDM(next.n)}`, size: ns, weight: 500, face: g.body, anchor, role: "ink" });
  }

  const markText = "Made with Signal Studio";
  const markX = wide ? m + (panelW - 2 * m) : W - m;
  const markY = footBottom;
  const markW = measure(markText, markSize, 500, "sans");
  texts.push({ key: "mark", x: markX, y: markY, text: markText, size: markSize, weight: 500, face: "sans", anchor: "end", role: "muted" });
  const mr = markSize * 0.46;
  const mark = { cx: markX - markW - mr - 9 * u, cy: markY - markSize * 0.34, r: mr, sw: Math.max(1, 2.2 * u * S) };

  /* ── Grid region ─────────────────────────────────────────────── */
  const gridBox: Box = wide
    ? { x: panelW + 24 * u, y: m, w: W - panelW - 24 * u - m, h: H - 2 * m }
    : {
        x: m,
        y: headBottom + (story ? 70 : 48) * u,
        w: W - 2 * m,
        h: footBottom - footH - (story ? 64 : 40) * u - (headBottom + (story ? 70 : 48) * u),
      };

  const capSize = (story ? 35 : square ? 19 : 21) * u;
  const baseDate = capSize * 0.82;
  const capW = (story ? 236 : wide ? 240 : square ? 190 : 186) * u;
  const capGap = (story ? 24 : 24) * u;
  let gx = gridBox.x;
  let gw = gridBox.w;
  if (g.caps === "both") {
    gx += capW + capGap;
    gw -= 2 * (capW + capGap);
  } else {
    gx += capW + capGap;
    gw -= capW + capGap;
  }
  if (model.long) gw -= 30 * u * S;
  const gy = gridBox.y;
  const gh = gridBox.h;

  const N = model.days.length;
  /* Units read like text: left to right, then down. Weeks are Monday to
     Sunday; a long project groups by month instead. */
  const months = model.long;
  const L = months ? 31 : 7;
  const unitOf: number[] = [];
  const kOf: number[] = [];
  const unitStart: number[] = [];
  const m0 = yearOf(model.start) * 12 + monthOf(model.start);
  for (const d of model.days) {
    const unit = months ? yearOf(d.n) * 12 + monthOf(d.n) - m0 : Math.floor((model.offset + d.i) / 7);
    const k = months ? dateOfMonth(d.n) - 1 : (model.offset + d.i) % 7;
    unitOf.push(unit);
    kOf.push(k);
    if (unitStart[unit] === undefined) unitStart[unit] = d.i - k;
  }
  const units = unitStart.length;
  const gut = months ? 2.6 : 1.35;
  const maxP = (w.grammar === "asym" ? 44 : 58) * u * S;
  let best = { G: 1, rows: units, p: 0 };
  for (let G = 1; G <= 16; G += 1) {
    const rows = Math.ceil(units / G);
    const unitsW = L * G + (G - 1) * gut;
    const p = Math.min(gw / unitsW, gh / rows, maxP);
    if (p > best.p + 1e-6) best = { G, rows, p };
  }
  const { G, rows, p } = best;
  const blockW = (L * G + (G - 1) * gut) * p;
  const blockH = rows * p;
  const x0 = g.caps === "both" ? gx + (gw - blockW) / 2 : gx + gw - blockW;
  const y0 = gy + (gh - blockH) / 2;
  const grid: GridGeo = { x0, y0, p, G, rows, gut, L, unitStart, unitOf, kOf, count: N };

  const unitLeft = (unit: number) => x0 + (unit % G) * (L + gut) * p;
  const at = (i: number) => {
    const unit = unitOf[i];
    const k = kOf[i];
    return {
      cx: unitLeft(unit) + k * p + p / 2,
      cy: y0 + Math.floor(unit / G) * p + p / 2,
      slot: unit % G,
      k,
    };
  };

  /* ── Dots ────────────────────────────────────────────────────── */
  const r = p * g.dotR;
  const hollowW = Math.max(1, Math.min(r * 0.26, 2.4 * u * S));
  const dots: DotItem[] = [];
  const lived = Math.max(1, Math.min(model.todayIdx, N));
  const playful = w.grammar === "playful";
  let todayRing: Scene["todayRing"] = null;

  for (const d of model.days) {
    const { cx, cy } = at(d.i);
    const inFinal = model.moment === "final" && d.n >= model.finalWeekFrom;
    const rr = inFinal ? r * 1.3 : r;
    const wave = d.kind === "past" ? Math.round((d.i / lived) * 330) : undefined;

    if (d.isEnd) {
      if (d.kind === "past") {
        dots.push({ i: d.i, cx, cy, r: p * 0.62, fill: "accent", star: starPath(cx, cy, p * 0.66, p * 0.29), wave });
      } else {
        dots.push({
          i: d.i,
          cx,
          cy,
          r: r * 0.95,
          fill: "accent",
          target: { ring: p * 0.62, sw: Math.max(1.2, p * 0.075) },
          pulse: model.moment === "final",
          today: d.kind === "today",
        });
      }
      continue;
    }
    if (d.kind === "today") {
      const tr = r * 1.5;
      dots.push({ i: d.i, cx, cy, r: tr, fill: "accent", today: true, wave: 340 });
      todayRing = { cx, cy, r: Math.min(p * 0.82, tr + p * 0.34), sw: Math.max(1.2, p * 0.07) };
      continue;
    }
    if (d.m) {
      const mr = playful ? p * 0.5 : r * 1.55;
      const num = playful ? { text: String(d.m), size: p * 0.5, role: (d.kind === "past" ? "onAccent" : "accentText") as Role } : undefined;
      if (d.kind === "past") {
        dots.push({ i: d.i, cx, cy, r: mr, fill: playful ? "accent" : "ink", wave, num });
      } else {
        const sw = Math.max(1.2, p * (playful ? 0.08 : 0.085));
        dots.push({ i: d.i, cx, cy, r: mr - sw / 2, fill: "paper", stroke: playful ? "accent" : "ink", sw, num });
      }
      continue;
    }
    if (d.kind === "past") {
      dots.push({ i: d.i, cx, cy, r: rr, fill: "ink", wave });
    } else {
      dots.push({
        i: d.i,
        cx,
        cy,
        r: rr - hollowW / 2,
        fill: "paper",
        stroke: "hollow",
        sw: hollowW,
        opacity: d.fade,
      });
    }
  }

  /* Month initials on long projects: grouping without an axis. */
  if (months) {
    const ms = Math.min(p * 0.95, 17 * u * S);
    for (let unit = 0; unit < units; unit += 1) {
      const first = model.days[Math.max(0, unitStart[unit])];
      const cy = y0 + Math.floor(unit / G) * p + p / 2;
      texts.push({
        key: `month-${unit}`,
        x: unitLeft(unit) + L * p + p * 0.5,
        y: cy + ms * 0.36,
        text: monthInitial(first.n),
        size: ms,
        weight: monthOf(first.n) === 0 ? 700 : 500,
        face: "sans",
        anchor: "start",
        role: monthOf(first.n) === 0 ? "ink" : "muted",
      });
    }
  }

  /* ── Captions in the margin, with hairline leaders ───────────── */
  type Cap = { ms: Model["milestones"][number]; side: "l" | "r"; cy: number; cx: number; dr: number; lines: string[]; size: number; top: number; h: number };
  const midSlot = (G - 1) / 2;
  const limitTop = wide ? gridBox.y : Math.min(gridBox.y, y0) - 10 * u;
  const limitBottom = wide ? gridBox.y + gridBox.h : gridBox.y + gridBox.h + 20 * u;
  /* Captions shrink together, never one by one, if a side runs out of room. */
  let caps: Cap[] = [];
  let dateSize = baseDate;
  let gapV = 14 * u * S;
  for (const scale of [1, 0.92, 0.85, 0.78, 0.72]) {
    caps = buildCaps(capSize * scale);
    dateSize = baseDate * scale;
    gapV = 14 * u * S * scale;
    const fits = (["l", "r"] as const).every((side) => {
      const list = caps.filter((c) => c.side === side);
      return list.reduce((a, c) => a + c.h, 0) + gapV * Math.max(0, list.length - 1) <= limitBottom - limitTop;
    });
    if (fits) break;
  }
  function buildCaps(capSize: number) {
  const dateSize = capSize * 0.82;
  const out: Cap[] = [];
  model.milestones.forEach((ms, idx) => {
    if (ms.i < 0 || ms.i >= N) return;
    const pos = at(ms.i);
    const side: "l" | "r" =
      g.caps === "left"
        ? "l"
        : G === 1
          ? idx % 2 === 0 ? "l" : "r"
          : pos.slot < midSlot || (pos.slot === midSlot && pos.k < (L - 1) / 2)
            ? "l"
            : "r";
    const weight = ms.isEnd ? 600 : 500;
    let size = capSize;
    let lines = [ms.label];
    if (measure(ms.label, size, weight, g.body) > capW) {
      const words = ms.label.split(" ");
      let a = "";
      let k = 0;
      while (k < words.length && measure(`${a} ${words[k]}`.trim(), size, weight, g.body) <= capW) {
        a = `${a} ${words[k]}`.trim();
        k += 1;
      }
      lines = [a || words[0], words.slice(Math.max(1, k)).join(" ")].filter(Boolean);
      const widest = Math.max(...lines.map((l) => measure(l, size, weight, g.body)));
      if (widest > capW) size *= capW / widest;
    }
    const dot = dots.find((dd) => dd.i === ms.i);
    const dr = dot?.target ? dot.target.ring : dot?.star ? p * 0.66 : (dot?.r ?? r) + (dot?.sw ?? 0) / 2;
    const h = dateSize * 1.25 + lines.length * size * 1.2;
    out.push({ ms, side, cy: pos.cy, cx: pos.cx, dr, lines, size, top: pos.cy - dateSize * 0.95, h });
  });
  return out;
  }
  for (const side of ["l", "r"] as const) {
    const list = caps.filter((c) => c.side === side).sort((a, b) => a.top - b.top);
    for (let k = 0; k < list.length; k += 1) {
      const prev = list[k - 1];
      list[k].top = Math.max(list[k].top, prev ? prev.top + prev.h + gapV : limitTop);
    }
    for (let k = list.length - 1; k >= 0; k -= 1) {
      const next = list[k + 1];
      list[k].top = Math.min(list[k].top, next ? next.top - gapV - list[k].h : limitBottom - list[k].h);
    }
    for (let k = 0; k < list.length; k += 1) {
      const prev = list[k - 1];
      list[k].top = Math.max(list[k].top, prev ? prev.top + prev.h + gapV : limitTop);
    }
  }

  const gridL = x0;
  const gridR = x0 + blockW;
  for (const c of caps) {
    const left = c.side === "l";
    const tx = left ? gridL - capGap : gridR + capGap;
    const anchor = left ? "end" : "start";
    const dy = c.top + dateSize * 0.95;
    const past = c.ms.state === "done";
    texts.push({
      key: `cap-d-${c.ms.num}`,
      x: tx,
      y: dy,
      text: model.long ? fmtDMY(c.ms.n) : fmtDM(c.ms.n),
      size: dateSize,
      weight: 500,
      face: g.body,
      anchor,
      role: c.ms.isEnd ? "accentText" : "muted",
    });
    c.lines.forEach((line, li) => {
      texts.push({
        key: `cap-l-${c.ms.num}-${li}`,
        x: tx,
        y: dy + dateSize * 0.3 + c.size * 1.08 + li * c.size * 1.2,
        text: line,
        size: c.size,
        weight: c.ms.isEnd ? 600 : 500,
        face: g.body,
        anchor,
        role: c.ms.isEnd ? "accentText" : "ink",
        opacity: past || c.ms.isEnd ? 1 : 1,
      });
    });
    const ay = dy - dateSize * 0.33;
    const sx = left ? c.cx - c.dr - 3 * u : c.cx + c.dr + 3 * u;
    const ex = left ? gridL - 8 * u : gridR + 8 * u;
    const fx = left ? tx + 8 * u : tx - 8 * u;
    const d = Math.abs(ay - c.cy) < 0.5 ? `M ${sx} ${c.cy} L ${ex} ${c.cy} L ${fx} ${c.cy}` : `M ${sx} ${c.cy} L ${ex} ${c.cy} L ${fx} ${ay}`;
    paths.push({ key: `lead-${c.ms.num}`, d, role: "muted", w: Math.max(1, 1.3 * u * S), opacity: 0.9 });
  }

  return { W, H, u, rects, paths, dots, texts, grid, todayRing, hollowW, mark };
}

/** Which day sits under a point, or null. */
export function cellAt(grid: GridGeo, x: number, y: number): number | null {
  const { x0, y0, p, G, rows, gut, L, unitStart, count } = grid;
  const span = (L + gut) * p;
  const slot = Math.floor((x - x0) / span);
  if (slot < 0 || slot >= G) return null;
  const k = Math.floor((x - x0 - slot * span) / p);
  if (k < 0 || k >= L) return null;
  const row = Math.floor((y - y0) / p);
  if (row < 0 || row >= rows) return null;
  const unit = row * G + slot;
  if (unit >= unitStart.length) return null;
  const i = unitStart[unit] + k;
  return i >= 0 && i < count && grid.unitOf[i] === unit ? i : null;
}

/** The day above or below, keeping the place within the week or month. */
export function stepRow(grid: GridGeo, i: number, dir: 1 | -1): number {
  const unit = grid.unitOf[i] + dir * grid.G;
  if (unit < 0 || unit >= grid.unitStart.length) return i;
  let j = grid.unitStart[unit] + grid.kOf[i];
  while (j >= grid.count || (j >= 0 && grid.unitOf[j] !== unit)) j -= 1;
  return Math.max(0, Math.min(grid.count - 1, j));
}

function starPath(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = [];
  for (let k = 0; k < 10; k += 1) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rad = k % 2 === 0 ? R : r;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}
