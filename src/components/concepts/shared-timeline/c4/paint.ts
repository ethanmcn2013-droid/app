/* Every Day Poster: draws a composed scene onto a canvas, for the
   downloaded image. It reads the same colour tokens and font stacks the
   page uses, so the file is the poster on screen, pixel for pixel in
   layout. */

import type { Face, Measure, Role, Scene } from "./compose";

export type Palette = Record<Role, string>;
export type Faces = Record<Face, string>;

const ROLES: Role[] = ["paper", "ink", "muted", "hollow", "accent", "accentText", "onAccent", "tint"];

/** Turn any computed colour into something a canvas understands. */
function toCanvasColour(value: string): string {
  const v = value.trim();
  const m = v.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e%-]+))?\)$/);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map((n) => Math.round(Math.max(0, Math.min(1, Number(n))) * 255));
    const a = m[4] ? (m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4])) : 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return v;
}

/** Resolve the poster roles from the live CSS custom properties. */
export function readPalette(root: HTMLElement): Palette {
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  root.appendChild(probe);
  const out = {} as Palette;
  for (const role of ROLES) {
    probe.style.color = `var(--pz-${role})`;
    out[role] = toCanvasColour(getComputedStyle(probe).color);
  }
  root.removeChild(probe);
  return out;
}

export function readFaces(root: HTMLElement): Faces {
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  root.appendChild(probe);
  const out = {} as Faces;
  for (const face of ["serif", "sans", "round"] as Face[]) {
    probe.style.fontFamily = `var(--pz-${face})`;
    out[face] = getComputedStyle(probe).fontFamily;
  }
  root.removeChild(probe);
  return out;
}

const fontString = (faces: Faces, face: Face, size: number, weight: number, italic?: boolean) =>
  `${italic ? "italic " : ""}${weight} ${size}px ${faces[face]}`;

let measureCtx: CanvasRenderingContext2D | null = null;

export function makeMeasure(faces: Faces): Measure {
  return (text, size, weight, face, italic, track = 0) => {
    if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
    if (!measureCtx) return text.length * size * 0.55;
    measureCtx.font = fontString(faces, face, size, weight, italic);
    return measureCtx.measureText(text).width + track * size * Math.max(0, text.length - 1);
  };
}

type Ctx2D = CanvasRenderingContext2D & { letterSpacing?: string };

export function paint(canvas: HTMLCanvasElement, scene: Scene, colours: Palette, faces: Faces) {
  const ctx = canvas.getContext("2d") as Ctx2D | null;
  if (!ctx) return;
  canvas.width = Math.round(scene.W);
  canvas.height = Math.round(scene.H);
  const c = (role: Role) => colours[role];

  ctx.fillStyle = c("paper");
  ctx.fillRect(0, 0, scene.W, scene.H);

  for (const r of scene.rects) {
    ctx.fillStyle = c(r.role);
    ctx.beginPath();
    if (r.rx) ctx.roundRect(r.x, r.y, r.w, r.h, r.rx);
    else ctx.rect(r.x, r.y, r.w, r.h);
    ctx.fill();
  }

  for (const p of scene.paths) {
    ctx.save();
    ctx.globalAlpha = p.opacity ?? 1;
    ctx.strokeStyle = c(p.role);
    ctx.lineWidth = p.w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(new Path2D(p.d));
    ctx.restore();
  }

  for (const d of scene.dots) {
    ctx.save();
    ctx.globalAlpha = d.opacity ?? 1;
    if (d.star) {
      ctx.fillStyle = c(d.fill);
      ctx.fill(new Path2D(d.star));
      ctx.restore();
      continue;
    }
    if (d.target) {
      ctx.beginPath();
      ctx.arc(d.cx, d.cy, d.target.ring - d.target.sw / 2, 0, Math.PI * 2);
      ctx.fillStyle = c("paper");
      ctx.fill();
      ctx.strokeStyle = c("accent");
      ctx.lineWidth = d.target.sw;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, Math.max(0.1, d.r), 0, Math.PI * 2);
    ctx.fillStyle = c(d.fill);
    ctx.fill();
    if (d.stroke && d.sw) {
      ctx.strokeStyle = c(d.stroke);
      ctx.lineWidth = d.sw;
      ctx.stroke();
    }
    if (d.num) {
      ctx.fillStyle = c(d.num.role);
      ctx.font = fontString(faces, "round", d.num.size, 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(d.num.text, d.cx, d.cy + d.num.size * 0.36);
    }
    ctx.restore();
  }

  if (scene.todayRing) {
    const t = scene.todayRing;
    ctx.beginPath();
    ctx.arc(t.cx, t.cy, t.r, 0, Math.PI * 2);
    ctx.strokeStyle = c("accent");
    ctx.lineWidth = t.sw;
    ctx.stroke();
  }

  const mk = scene.mark;
  ctx.beginPath();
  ctx.arc(mk.cx, mk.cy, mk.r - mk.sw / 2, 0, Math.PI * 2);
  ctx.strokeStyle = c("muted");
  ctx.lineWidth = mk.sw;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mk.cx, mk.cy, mk.r * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = c("muted");
  ctx.fill();

  ctx.textBaseline = "alphabetic";
  for (const t of scene.texts) {
    ctx.save();
    ctx.globalAlpha = t.opacity ?? 1;
    ctx.fillStyle = c(t.role);
    ctx.font = fontString(faces, t.face, t.size, t.weight, t.italic);
    ctx.letterSpacing = `${(t.track ?? 0) * t.size}px`;
    ctx.textAlign = t.anchor === "middle" ? "center" : t.anchor === "end" ? "right" : "left";
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }
}
