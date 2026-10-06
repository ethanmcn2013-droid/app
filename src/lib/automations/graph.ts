/**
 * Automations: the drawing as data, and everything that can be worked out
 * about it without a browser. Steps, the lines between them, where a new step
 * lands, what may connect to what, tidy layout, undo history and the view
 * arithmetic (zoom toward a point, fit to the canvas).
 *
 * Pure: every function returns a new value and leaves its input alone, so the
 * editor's undo is a list of earlier drawings and the tests need no DOM.
 */
import { stepType, templateById, type StepKind, type Template } from "./catalogue";

// ── Shapes ─────────────────────────────────────────────────────────────

export type Condition = Readonly<{ id: string; label: string }>;

export type Step = Readonly<{
  id: string;
  type: string;
  kind: StepKind;
  title: string;
  /** Empty means "describe it from the choices" (see `describeStep`). */
  description: string;
  note: string;
  x: number;
  y: number;
  values: Readonly<Record<string, string>>;
  /** A branch's paths, each with its own way out. Empty for other kinds. */
  conditions: readonly Condition[];
}>;

/** `port` is "out" for a plain step, or the id of a branch's path. */
export type Link = Readonly<{ id: string; from: string; port: string; to: string }>;

export type Automation = Readonly<{
  id: string;
  name: string;
  steps: readonly Step[];
  links: readonly Link[];
  createdAt: number;
  updatedAt: number;
}>;

export type Point = Readonly<{ x: number; y: number }>;
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type View = Readonly<{ x: number; y: number; k: number }>;
export type Size = Readonly<{ w: number; h: number }>;

// ── Measures (the stylesheet draws to the same numbers) ────────────────

export const GRID = 8;
export const STEP_W = 216;
/** Icon, kind, title and the one-line description. */
export const STEP_HEAD = 84;
/** One branch path: a 32px row and a 4px gap. */
export const PATH_PITCH = 36;
export const PATH_ROW = 32;
export const STEP_FOOT = 44;
/** Where a line arrives, measured down from the step's top edge. */
export const INPUT_Y = 64;
export const COLUMN_GAP = 88;
export const ROW_GAP = 32;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
export const MAX_PATHS = 6;
export const MIN_PATHS = 2;
export const OUT = "out";

export const snap = (value: number): number => Math.round(value / GRID) * GRID;

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function stepHeight(step: Pick<Step, "conditions">): number {
  return STEP_HEAD + step.conditions.length * PATH_PITCH + STEP_FOOT;
}

export function stepRect(step: Step): Rect {
  return { x: step.x, y: step.y, w: STEP_W, h: stepHeight(step) };
}

/** The ways out of a step, top to bottom. */
export function portsOf(step: Step): string[] {
  return step.kind === "branch" ? step.conditions.map((condition) => condition.id) : [OUT];
}

export function inputPoint(step: Step): Point {
  return { x: step.x, y: step.y + INPUT_Y };
}

export function outputPoint(step: Step, port: string): Point {
  if (step.kind !== "branch") return { x: step.x + STEP_W, y: step.y + INPUT_Y };
  const index = Math.max(0, step.conditions.findIndex((condition) => condition.id === port));
  return { x: step.x + STEP_W, y: step.y + STEP_HEAD + index * PATH_PITCH + PATH_ROW / 2 };
}

/** A smooth curve that leaves to the right and arrives from the left. */
export function linkPath(from: Point, to: Point): string {
  const span = Math.abs(to.x - from.x);
  const reach = to.x >= from.x ? Math.max(32, span / 2) : Math.max(72, Math.min(160, span / 2 + 48));
  const r = (value: number) => Math.round(value * 10) / 10;
  return `M ${r(from.x)} ${r(from.y)} C ${r(from.x + reach)} ${r(from.y)}, ${r(to.x - reach)} ${r(to.y)}, ${r(to.x)} ${r(to.y)}`;
}

/** The middle of that curve, where a selected line shows its remove button. */
export function linkMidpoint(from: Point, to: Point): Point {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

// ── Reading a drawing ──────────────────────────────────────────────────

export function findStep(doc: Automation, id: string): Step | null {
  return doc.steps.find((step) => step.id === id) ?? null;
}

export function outgoing(doc: Automation, stepId: string, port?: string): Link[] {
  return doc.links.filter((link) => link.from === stepId && (port === undefined || link.port === port));
}

export function incoming(doc: Automation, stepId: string): Link[] {
  return doc.links.filter((link) => link.to === stepId);
}

/** The line under a step's title: the person's own words, or the choices. */
export function describeStep(step: Step): string {
  if (step.description.trim()) return step.description.trim();
  return stepType(step.type)?.summary(step.values) ?? "";
}

export function nextStepsLabel(count: number): string {
  if (count === 0) return "Ends here";
  return count === 1 ? "1 next step" : `${count} next steps`;
}

export function stepCountLabel(count: number): string {
  if (count === 0) return "No steps yet";
  return count === 1 ? "1 step" : `${count} steps`;
}

/** True when following the lines from `from` can arrive at `to`. */
export function reaches(doc: Automation, from: string, to: string): boolean {
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (current === to) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const link of doc.links) if (link.from === current) queue.push(link.to);
  }
  return false;
}

export type ConnectVerdict = Readonly<{ ok: true } | { ok: false; why: string }>;

/**
 * Whether a line may be drawn. A step cannot lead to itself, nothing leads
 * into a trigger, the same line is not drawn twice, and a line that would
 * send the path round in a circle is refused.
 */
export function canConnect(doc: Automation, from: string, port: string, to: string): ConnectVerdict {
  const source = findStep(doc, from);
  const target = findStep(doc, to);
  if (!source || !target) return { ok: false, why: "That step is no longer here." };
  if (from === to) return { ok: false, why: "A step cannot lead to itself." };
  if (!portsOf(source).includes(port)) return { ok: false, why: "That path is no longer here." };
  if (target.kind === "trigger") return { ok: false, why: "A trigger starts things off, so nothing can lead into it." };
  if (doc.links.some((link) => link.from === from && link.port === port && link.to === to)) {
    return { ok: false, why: "These two are already connected." };
  }
  if (reaches(doc, to, from)) return { ok: false, why: "That would send the path round in a circle." };
  return { ok: true };
}

// ── Changing a drawing ─────────────────────────────────────────────────

function touch(doc: Automation, patch: Partial<Automation>, now = Date.now()): Automation {
  return { ...doc, ...patch, updatedAt: now };
}

export function createStep(typeId: string, at: Point): Step | null {
  const type = stepType(typeId);
  if (!type) return null;
  return {
    id: newId(),
    type: type.id,
    kind: type.kind,
    title: type.title,
    description: "",
    note: "",
    x: snap(at.x),
    y: snap(at.y),
    values: { ...type.defaults },
    conditions: (type.conditions ?? []).map((label) => ({ id: newId(), label })),
  };
}

export function connect(doc: Automation, from: string, port: string, to: string, id: string = newId()): Automation {
  if (!canConnect(doc, from, port, to).ok) return doc;
  return touch(doc, { links: [...doc.links, { id, from, port, to }] });
}

export function removeLinks(doc: Automation, ids: readonly string[]): Automation {
  const gone = new Set(ids);
  const links = doc.links.filter((link) => !gone.has(link.id));
  return links.length === doc.links.length ? doc : touch(doc, { links });
}

export function removeSteps(doc: Automation, ids: readonly string[]): Automation {
  const gone = new Set(ids);
  const steps = doc.steps.filter((step) => !gone.has(step.id));
  if (steps.length === doc.steps.length) return doc;
  return touch(doc, { steps, links: doc.links.filter((link) => !gone.has(link.from) && !gone.has(link.to)) });
}

export function moveSteps(doc: Automation, ids: readonly string[], dx: number, dy: number): Automation {
  if (ids.length === 0 || (dx === 0 && dy === 0)) return doc;
  const moving = new Set(ids);
  return touch(doc, {
    steps: doc.steps.map((step) => (moving.has(step.id) ? { ...step, x: snap(step.x + dx), y: snap(step.y + dy) } : step)),
  });
}

export type StepPatch = Partial<Pick<Step, "title" | "description" | "note" | "values">>;

export function updateStep(doc: Automation, id: string, patch: StepPatch): Automation {
  if (!findStep(doc, id)) return doc;
  return touch(doc, { steps: doc.steps.map((step) => (step.id === id ? { ...step, ...patch } : step)) });
}

export function renameAutomation(doc: Automation, name: string): Automation {
  const next = name.trim().slice(0, 80) || "Untitled automation";
  return next === doc.name ? doc : touch(doc, { name: next });
}

/** Rename, add or remove a branch's paths. A removed path takes its lines. */
export function setConditions(doc: Automation, id: string, conditions: readonly Condition[]): Automation {
  const step = findStep(doc, id);
  if (!step || step.kind !== "branch") return doc;
  if (conditions.length < MIN_PATHS || conditions.length > MAX_PATHS) return doc;
  const kept = new Set(conditions.map((condition) => condition.id));
  return touch(doc, {
    steps: doc.steps.map((entry) => (entry.id === id ? { ...entry, conditions } : entry)),
    links: doc.links.filter((link) => link.from !== id || kept.has(link.port)),
  });
}

function overlaps(a: Rect, b: Rect, gap = 16): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/** Slide a new step down until it sits clear of the others. */
export function clearSpot(doc: Automation, at: Point, height: number): Point {
  let spot = { x: snap(at.x), y: snap(at.y) };
  for (let tries = 0; tries < 200; tries += 1) {
    const rect = { x: spot.x, y: spot.y, w: STEP_W, h: height };
    const hit = doc.steps.find((step) => overlaps(rect, stepRect(step)));
    if (!hit) return spot;
    spot = { x: spot.x, y: snap(hit.y + stepHeight(hit) + ROW_GAP) };
  }
  return spot;
}

/** The first way out of a step that leads nowhere yet, or its first. */
export function freePort(doc: Automation, step: Step): string {
  const ports = portsOf(step);
  return ports.find((port) => outgoing(doc, step.id, port).length === 0) ?? ports[0] ?? OUT;
}

export type Placement =
  | Readonly<{ after: string; port?: string }>
  | Readonly<{ before: string }>
  | Readonly<{ at: Point }>;

/**
 * Add a step. After another step it lands one column to the right, level
 * with the path it continues, and is connected. Before a step it lands one
 * column to the left and leads into it. Otherwise it lands where asked.
 */
export function addStep(doc: Automation, typeId: string, where: Placement): { doc: Automation; stepId: string | null } {
  const type = stepType(typeId);
  if (!type) return { doc, stepId: null };
  const height = stepHeight({ conditions: (type.conditions ?? []).map((label) => ({ id: label, label })) });

  if ("after" in where) {
    const source = findStep(doc, where.after);
    if (!source || type.kind === "trigger") return addStep(doc, typeId, { at: source ? { x: source.x, y: source.y + stepHeight(source) + ROW_GAP } : { x: 0, y: 0 } });
    const port = where.port ?? freePort(doc, source);
    const out = outputPoint(source, port);
    const spot = clearSpot(doc, { x: source.x + STEP_W + COLUMN_GAP, y: out.y - INPUT_Y }, height);
    const step = createStep(typeId, spot)!;
    const placed = touch(doc, { steps: [...doc.steps, step] });
    return { doc: connect(placed, source.id, port, step.id), stepId: step.id };
  }

  if ("before" in where) {
    const target = findStep(doc, where.before);
    if (!target) return addStep(doc, typeId, { at: { x: 0, y: 0 } });
    const spot = clearSpot(doc, { x: target.x - STEP_W - COLUMN_GAP, y: target.y }, height);
    const step = createStep(typeId, spot)!;
    const placed = touch(doc, { steps: [...doc.steps, step] });
    return { doc: connect(placed, step.id, portsOf(step)[0] ?? OUT, target.id), stepId: step.id };
  }

  const step = createStep(typeId, clearSpot(doc, where.at, height))!;
  return { doc: touch(doc, { steps: [...doc.steps, step] }), stepId: step.id };
}

/** Copy steps a little down and to the right, with the lines among them. */
export function duplicateSteps(doc: Automation, ids: readonly string[]): { doc: Automation; ids: string[] } {
  const chosen = doc.steps.filter((step) => ids.includes(step.id));
  if (chosen.length === 0) return { doc, ids: [] };
  const stepIds = new Map<string, string>();
  const portIds = new Map<string, string>();
  const copies = chosen.map((step) => {
    const id = newId();
    stepIds.set(step.id, id);
    const conditions = step.conditions.map((condition) => {
      const conditionId = newId();
      portIds.set(condition.id, conditionId);
      return { id: conditionId, label: condition.label };
    });
    return { ...step, id, conditions, x: step.x + 3 * GRID, y: snap(step.y + stepHeight(step) + 3 * GRID) };
  });
  const links = doc.links
    .filter((link) => stepIds.has(link.from) && stepIds.has(link.to))
    .map((link) => ({ id: newId(), from: stepIds.get(link.from)!, port: portIds.get(link.port) ?? link.port, to: stepIds.get(link.to)! }));
  return {
    doc: touch(doc, { steps: [...doc.steps, ...copies], links: [...doc.links, ...links] }),
    ids: copies.map((copy) => copy.id),
  };
}

/**
 * Tidy the drawing: each step sits one column right of the furthest step
 * that leads to it, columns are stacked in the order their paths leave, and
 * the list of steps is put in reading order (which is the Tab order).
 */
export function tidy(doc: Automation): Automation {
  if (doc.steps.length === 0) return doc;
  const depth = new Map<string, number>();
  const depthOf = (id: string, trail: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (trail.has(id)) return 0;
    trail.add(id);
    const parents = incoming(doc, id).map((link) => depthOf(link.from, trail) + 1);
    const value = parents.length > 0 ? Math.max(...parents) : 0;
    trail.delete(id);
    depth.set(id, value);
    return value;
  };
  for (const step of doc.steps) depthOf(step.id, new Set());

  const columns = new Map<number, Step[]>();
  for (const step of doc.steps) {
    const column = depth.get(step.id) ?? 0;
    columns.set(column, [...(columns.get(column) ?? []), step]);
  }

  const placed = new Map<string, Step>();
  const wish = (step: Step): number => {
    const from = incoming(doc, step.id)
      .map((link) => {
        const parent = placed.get(link.from);
        return parent ? outputPoint(parent, link.port).y - INPUT_Y : null;
      })
      .filter((value): value is number => value !== null);
    return from.length > 0 ? from.reduce((sum, value) => sum + value, 0) / from.length : step.y;
  };

  const ordered: Step[] = [];
  for (const column of [...columns.keys()].sort((a, b) => a - b)) {
    const wished = columns.get(column)!.map((step) => ({ step, y: wish(step) })).sort((a, b) => a.y - b.y);
    let floor = Number.NEGATIVE_INFINITY;
    const stacked = wished.map((entry) => {
      const y = Math.max(entry.y, floor);
      floor = y + stepHeight(entry.step) + ROW_GAP;
      return y;
    });
    // Stacking pushes later steps down; slide the whole column back so it
    // sits around the paths that feed it, not below them.
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const lift = mean(wished.map((entry) => entry.y)) - mean(stacked);
    wished.forEach((entry, index) => {
      const moved = { ...entry.step, x: column * (STEP_W + COLUMN_GAP), y: snap(stacked[index]! + lift) };
      placed.set(moved.id, moved);
      ordered.push(moved);
    });
  }
  const top = Math.min(...ordered.map((step) => step.y));
  const steps = ordered.map((step) => ({ ...step, y: step.y - top }));
  const same = steps.length === doc.steps.length && steps.every((step, index) => {
    const before = doc.steps[index]!;
    return before.id === step.id && before.x === step.x && before.y === step.y;
  });
  return same ? doc : touch(doc, { steps });
}

// ── The view ───────────────────────────────────────────────────────────

export const clampZoom = (k: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

/** Change the zoom while the point under the pointer stays where it is. */
export function zoomAt(view: View, point: Point, k: number): View {
  const next = clampZoom(k);
  const ratio = next / view.k;
  return { k: next, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio };
}

const ZOOM_STOPS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];

/** The next stop up or down from where the zoom is now. */
export function zoomStep(k: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STOPS.find((stop) => stop > k + 0.005) ?? MAX_ZOOM;
  return [...ZOOM_STOPS].reverse().find((stop) => stop < k - 0.005) ?? MIN_ZOOM;
}

export function toWorld(view: View, point: Point): Point {
  return { x: (point.x - view.x) / view.k, y: (point.y - view.y) / view.k };
}

export function toScreen(view: View, point: Point): Point {
  return { x: point.x * view.k + view.x, y: point.y * view.k + view.y };
}

export function boundsOf(steps: readonly Step[]): Rect | null {
  if (steps.length === 0) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const step of steps) {
    left = Math.min(left, step.x);
    top = Math.min(top, step.y);
    right = Math.max(right, step.x + STEP_W);
    bottom = Math.max(bottom, step.y + stepHeight(step));
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export type Insets = Readonly<{ top: number; right: number; bottom: number; left: number }>;

/** Show everything, never closer than 100 percent, clear of the toolbars. */
export function fitView(bounds: Rect | null, size: Size, insets: Insets = { top: 48, right: 48, bottom: 48, left: 48 }): View {
  if (!bounds || size.w <= 0 || size.h <= 0) return { x: Math.round(size.w / 2), y: Math.round(size.h / 2), k: 1 };
  const room = { w: Math.max(80, size.w - insets.left - insets.right), h: Math.max(80, size.h - insets.top - insets.bottom) };
  const k = clampZoom(Math.min(1, room.w / bounds.w, room.h / bounds.h));
  return {
    k,
    x: Math.round(insets.left + (room.w - bounds.w * k) / 2 - bounds.x * k),
    y: Math.round(insets.top + (room.h - bounds.h * k) / 2 - bounds.y * k),
  };
}

/** Pan just enough to bring a rectangle inside the canvas. Zoom is kept. */
export function revealRect(view: View, rect: Rect, size: Size, insets: Insets = { top: 72, right: 32, bottom: 88, left: 32 }): View {
  const a = toScreen(view, { x: rect.x, y: rect.y });
  const b = toScreen(view, { x: rect.x + rect.w, y: rect.y + rect.h });
  let dx = 0;
  let dy = 0;
  if (a.x < insets.left) dx = insets.left - a.x;
  else if (b.x > size.w - insets.right) dx = Math.max(insets.left - a.x, size.w - insets.right - b.x);
  if (a.y < insets.top) dy = insets.top - a.y;
  else if (b.y > size.h - insets.bottom) dy = Math.max(insets.top - a.y, size.h - insets.bottom - b.y);
  return dx === 0 && dy === 0 ? view : { ...view, x: Math.round(view.x + dx), y: Math.round(view.y + dy) };
}

export function stepsInRect(doc: Automation, rect: Rect): string[] {
  const box = { x: Math.min(rect.x, rect.x + rect.w), y: Math.min(rect.y, rect.y + rect.h), w: Math.abs(rect.w), h: Math.abs(rect.h) };
  return doc.steps.filter((step) => overlaps(stepRect(step), box, 0)).map((step) => step.id);
}

export function stepAt(doc: Automation, point: Point): Step | null {
  for (let index = doc.steps.length - 1; index >= 0; index -= 1) {
    const step = doc.steps[index]!;
    if (point.x >= step.x && point.x <= step.x + STEP_W && point.y >= step.y && point.y <= step.y + stepHeight(step)) return step;
  }
  return null;
}

// ── Undo history ───────────────────────────────────────────────────────

export type History = Readonly<{
  past: readonly Automation[];
  present: Automation;
  future: readonly Automation[];
  /** What the last change was, so a run of the same small change is one undo. */
  tag: string | null;
  at: number;
}>;

export const HISTORY_LIMIT = 100;
const MERGE_WINDOW_MS = 900;

export function startHistory(doc: Automation): History {
  return { past: [], present: doc, future: [], tag: null, at: 0 };
}

/**
 * Record a change. Passing the same `tag` again within a moment (typing in a
 * field, nudging with the arrow keys) replaces the latest entry instead of
 * adding one, so undo steps back a whole edit and not a keystroke.
 */
export function commit(history: History, doc: Automation, tag: string | null = null, now = Date.now()): History {
  if (doc === history.present) return history;
  const merge = tag !== null && tag === history.tag && now - history.at < MERGE_WINDOW_MS && history.past.length > 0;
  const past = merge ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT);
  return { past, present: doc, future: [], tag, at: now };
}

export function undo(history: History): History {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future], tag: null, at: 0 };
}

export function redo(history: History): History {
  const next = history.future[0];
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1), tag: null, at: 0 };
}

// ── Drafts ─────────────────────────────────────────────────────────────

export function blankAutomation(name = "Untitled automation", now = Date.now()): Automation {
  return { id: newId(), name, steps: [], links: [], createdAt: now, updatedAt: now };
}

/** Open a starter as a new draft, laid out on its grid of columns and rows. */
export function fromTemplate(template: Template | string, now = Date.now()): Automation | null {
  const source = typeof template === "string" ? templateById(template) : template;
  if (!source) return null;
  const keys = new Map<string, Step>();
  for (const entry of source.steps) {
    const step = createStep(entry.type, { x: entry.col * (STEP_W + COLUMN_GAP), y: entry.row * 160 });
    if (!step) continue;
    keys.set(entry.key, entry.values ? { ...step, values: { ...step.values, ...entry.values } } : step);
  }
  let doc: Automation = { id: newId(), name: source.name, steps: [...keys.values()], links: [], createdAt: now, updatedAt: now };
  for (const link of source.links) {
    const from = keys.get(link.from);
    const to = keys.get(link.to);
    if (!from || !to) continue;
    doc = connect(doc, from.id, portsOf(from)[link.port ?? 0] ?? OUT, to.id);
  }
  return { ...tidy(doc), createdAt: now, updatedAt: now };
}

export function copyAutomation(doc: Automation, now = Date.now()): Automation {
  return { ...doc, id: newId(), name: `${doc.name} (copy)`.slice(0, 80), createdAt: now, updatedAt: now };
}

const isText = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function readStep(value: unknown): Step | null {
  if (!isObject(value) || !isText(value.id) || !isText(value.type) || !isNumber(value.x) || !isNumber(value.y)) return null;
  const type = stepType(value.type);
  if (!type) return null;
  const values: Record<string, string> = { ...type.defaults };
  if (isObject(value.values)) for (const [key, entry] of Object.entries(value.values)) if (isText(entry)) values[key] = entry.slice(0, 200);
  const conditions = type.kind === "branch" && Array.isArray(value.conditions)
    ? value.conditions.flatMap((entry) => (isObject(entry) && isText(entry.id) && isText(entry.label) ? [{ id: entry.id, label: entry.label.slice(0, 60) }] : [])).slice(0, MAX_PATHS)
    : [];
  if (type.kind === "branch" && conditions.length < MIN_PATHS) return null;
  return {
    id: value.id,
    type: type.id,
    kind: type.kind,
    title: isText(value.title) && value.title.trim() ? value.title.slice(0, 80) : type.title,
    description: isText(value.description) ? value.description.slice(0, 140) : "",
    note: isText(value.note) ? value.note.slice(0, 400) : "",
    x: snap(value.x),
    y: snap(value.y),
    values,
    conditions,
  };
}

function readAutomation(value: unknown): Automation | null {
  if (!isObject(value) || !isText(value.id) || !value.id) return null;
  const steps = Array.isArray(value.steps) ? value.steps.flatMap((entry) => readStep(entry) ?? []) : [];
  let doc: Automation = {
    id: value.id,
    name: isText(value.name) && value.name.trim() ? value.name.slice(0, 80) : "Untitled automation",
    steps,
    links: [],
    createdAt: isNumber(value.createdAt) ? value.createdAt : 0,
    updatedAt: isNumber(value.updatedAt) ? value.updatedAt : 0,
  };
  const stamp = doc.updatedAt;
  // Lines are replayed through `connect`, so a stored drawing can never hold
  // a circle, a line into a trigger or a line to a step that is gone.
  if (Array.isArray(value.links)) {
    for (const entry of value.links) {
      if (isObject(entry) && isText(entry.from) && isText(entry.port) && isText(entry.to)) {
        doc = connect(doc, entry.from, entry.port, entry.to, isText(entry.id) && entry.id ? entry.id : newId());
      }
    }
  }
  return { ...doc, updatedAt: stamp };
}

export const DRAFTS_VERSION = 1;

/** Read what the browser kept. Anything unreadable is left out, not guessed. */
export function parseDrafts(raw: string | null | undefined): Automation[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || parsed.version !== DRAFTS_VERSION || !Array.isArray(parsed.drafts)) return [];
    const seen = new Set<string>();
    return parsed.drafts.flatMap((entry) => {
      const doc = readAutomation(entry);
      if (!doc || seen.has(doc.id)) return [];
      seen.add(doc.id);
      return [doc];
    });
  } catch {
    return [];
  }
}

export function serializeDrafts(drafts: readonly Automation[]): string {
  return JSON.stringify({ version: DRAFTS_VERSION, drafts });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Edited just now", "Edited 5 minutes ago", "Edited yesterday", "Edited 3 Oct". */
export function describeEdited(updatedAt: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - updatedAt) / 60_000);
  if (minutes < 1) return "Edited just now";
  if (minutes < 60) return minutes === 1 ? "Edited 1 minute ago" : `Edited ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "Edited 1 hour ago" : `Edited ${hours} hours ago`;
  if (hours < 48) return "Edited yesterday";
  const date = new Date(updatedAt);
  return `Edited ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** The drawing in plain words, for the list and for assistive technology. */
export function summarise(doc: Automation): string {
  const triggers = doc.steps.filter((step) => step.kind === "trigger");
  if (doc.steps.length === 0) return "Nothing on it yet";
  if (triggers.length === 0) return "No trigger yet";
  const first = triggers[0]!.title;
  return triggers.length === 1 ? `Starts when ${first.charAt(0).toLowerCase()}${first.slice(1)}` : `Starts from ${triggers.length} triggers`;
}
