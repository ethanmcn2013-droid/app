"use client";

/* The Tasks list: a planner's sheet with a command line at its foot.
   The sheet is the page (typed columns, cell selection, fill-down, live
   totals). The command line turns a plain sentence, like "orla friday
   high", into edits across everything selected, previews them in the
   grid as outlined cells, and applies them with one undo. */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EXAMPLE_PASTE, PEOPLE, ROOMS, STORE_COLUMNS, cellPatch, taskToRow, type CellValue, type RoomId, type Row } from "./data";
import type { DemoState, ProjectId, TeamPersonId } from "../../demo/store";
import { addTask, removeTask, updateTask, useDemoStore, type TaskPatch } from "../../demo/store/client";
import { parseTaskLine, type TaskLine } from "../../tasks/grammar";
import { NewTaskComposer, focusNewTask } from "../../tasks/composer";
import { NewTaskFab, TasksPageHeader, useNewTaskKey, useNewTaskParam } from "../../tasks/page-header";
import { inTaskScope, useTaskScope } from "../../tasks/scope";
import { addFromLine, type NewTaskDefaults } from "../../tasks/task-line";
import { TaskToast, useTaskToast } from "../../tasks/toast";
import { editSentence } from "../../tasks/words";
import { batch, dropViewSteps, pushViewStep, undoLast, useUndoKey } from "../../tasks/undo";
import {
  BASE_COLUMNS,
  GROUP_FIELD,
  NO_FILTER,
  START_SHEETS,
  applyFilter,
  buildGroups,
  fillValues,
  fromText,
  isNumeric,
  planPaste,
  rowsFromPlan,
  sheetColumns,
  sheetRows,
  sortRows,
  toText,
  type Agg,
  type ColType,
  type Column,
  type Filter,
  type GroupBy,
  type PastePlan,
  type Sheet,
} from "./model";
import { Grid, cellDomId, type Range } from "./Grid";
import { Toolbar } from "./Toolbar";
import { useModKeys } from "./keys";
import { Editor, type EditTarget } from "./Editors";
import { PasteConfirm } from "./Overlays";
import { RecordForm } from "./Record";
import { PhoneList } from "./Phone";
import { CommandBar, type CmdState } from "./CommandBar";
import { chipFor, hasChange, matches, parse, planChange, toChange } from "./command";
import s from "./sheet.module.css";

export type Pos = { row: string; col: string };
export type Sel = { a: Pos; f: Pos };
export type FillDrag = { toRow: string; copy: boolean; x: number; y: number };
export type PasteState = { plan: PastePlan; base: Record<string, CellValue>; table: string; x: number | null; y: number | null };

const PHONE = "(max-width: 720px)";
const subscribePhone = (cb: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const NEW_RE = /^\s*(new|add)\s*:\s*/i;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const selectTasks = (s: DemoState) => s.tasks;

const WIDTH_BY_TYPE: Partial<Record<ColType, number>> = { checkbox: 72, currency: 112, number: 96, date: 120, person: 132 };

export default function FinalTasksList({ sub }: { sub?: string }) {
  void sub;
  const isPhone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
  /* ── Data: the store's tasks, inside the scope ───────────────────── */
  const scope = useTaskScope();
  const tasks = useDemoStore(selectTasks);
  /* This sheet's own custom fields, by task. Everything else is the store. */
  const [extras, setExtras] = useState<Record<string, Record<string, CellValue>>>({});
  const { project: scopeProject, owner: scopeOwner } = scope;
  const rows = useMemo(() => {
    const keep = inTaskScope({ project: scopeProject, owner: scopeOwner });
    return tasks.filter(keep).map((t) => taskToRow(t, extras[t.id]));
  }, [tasks, scopeProject, scopeOwner, extras]);
  const [columns, setColumns] = useState<Column[]>(BASE_COLUMNS);
  const [sheets, setSheets] = useState<Sheet[]>(START_SHEETS);
  const [sheetId, setSheetId] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [density, setDensity] = useState<"compact" | "comfy">("compact");
  const [aggs, setAggs] = useState<Record<string, Agg>>({ cost: "sum", guests: "max" });

  /* ── Interaction ────────────────────────────────────────────────── */
  const [sel, setSel] = useState<Sel | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [fill, setFill] = useState<FillDrag | null>(null);
  const [flash, setFlash] = useState<{ keys: Set<string>; n: number }>({ keys: new Set(), n: 0 });
  const { toast, say, close: closeToast } = useTaskToast();
  const [paste, setPaste] = useState<PasteState | null>(null);
  const [record, setRecord] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [cmd, setCmd] = useState("");
  const [detail, setDetail] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const cmdRef = useRef<HTMLInputElement>(null);
  const keys = useModKeys();
  const gridRef = useRef<HTMLDivElement>(null);
  const dragSel = useRef(false);
  const seq = useRef(100);

  const sheet = sheets.find((x) => x.id === sheetId) ?? sheets[0];
  const cols = useMemo(() => sheetColumns(columns, sheet), [columns, sheet]);
  const base = useMemo(() => sheetRows(rows, sheet), [rows, sheet]);
  const queryTokens = useMemo(() => (sheet.query ? parse(sheet.query).tokens : []), [sheet.query]);

  /* ── The command line, read once per keystroke ──────────────────── */
  const newMatch = NEW_RE.test(cmd);
  const parsed = useMemo(() => parse(newMatch ? cmd.replace(NEW_RE, "").split(",").slice(1).join(" ") : cmd), [cmd, newMatch]);
  const liveFilter = !newMatch && cmd.trim() !== "" && (parsed.filterVerb || (!checked.size && (isPhone || !sel))) ? parsed.tokens : null;
  const afterSheet = useMemo(() => applyFilter(base, sheet.filter).filter((r) => matches(r, queryTokens)), [base, sheet.filter, queryTokens]);
  const shown = useMemo(
    () => sortRows(liveFilter ? afterSheet.filter((r) => matches(r, liveFilter)) : afterSheet, sheet.sort, columns),
    [afterSheet, liveFilter, sheet.sort, columns],
  );
  const groups = useMemo(() => buildGroups(base, shown, sheet.groupBy), [base, shown, sheet.groupBy]);
  const isCollapsed = useCallback((key: string) => collapsed.has(`${sheet.id}:${key}`), [collapsed, sheet.id]);
  const flat = useMemo(() => groups.flatMap((g) => (isCollapsed(g.key) ? [] : g.rows)), [groups, isCollapsed]);
  const rowIdx = useMemo(() => new Map(flat.map((r, i) => [r.id, i])), [flat]);
  const colIdx = useMemo(() => new Map(cols.map((c, i) => [c.key, i])), [cols]);

  const range: Range | null = useMemo(() => {
    if (!sel) return null;
    const ar = rowIdx.get(sel.a.row);
    const fr = rowIdx.get(sel.f.row);
    const ac = colIdx.get(sel.a.col);
    const fc = colIdx.get(sel.f.col);
    if (ar == null || fr == null || ac == null || fc == null) return null;
    return { r0: Math.min(ar, fr), r1: Math.max(ar, fr), c0: Math.min(ac, fc), c1: Math.max(ac, fc), ar, ac };
  }, [sel, rowIdx, colIdx]);

  /* Rows a sentence edits: ticked rows win, else every row the selection spans. */
  const targetRows = useMemo(() => {
    if (checked.size) return rows.filter((r) => checked.has(r.id));
    if (!range || isPhone) return [];
    return flat.slice(range.r0, range.r1 + 1);
  }, [checked, rows, range, flat, isPhone]);
  const selScope = checked.size ? `${plural(checked.size, "ticked row")}` : range ? `${plural(range.r1 - range.r0 + 1, "row")} under the selection` : "nothing";

  const cmdState: CmdState = useMemo(() => {
    const unknown = parsed.tokens.filter((x) => x.kind === "word").length;
    const change = toChange(parsed.tokens);
    const known = parsed.tokens.some((x) => chipFor(x, false));
    const mode: CmdState["mode"] = !cmd.trim() ? "idle" : newMatch ? "new" : liveFilter ? "filter" : "edit";
    const planned = mode === "edit" && !unknown && !change.remove ? planChange(targetRows, change) : { cells: [], rows: 0 };
    const newTitle = newMatch ? cmd.replace(NEW_RE, "").split(",")[0].trim() : "";
    const groupOfActive = range && flat[range.ar] ? groups.find((g) => g.rows.some((r) => r.id === flat[range.ar].id)) : groups[0];
    return {
      mode,
      tokens: parsed.tokens,
      targets: newMatch ? 0 : targetRows.length,
      plan: { cells: planned.cells.length, rows: planned.rows },
      remove: !!change.remove && mode === "edit",
      filter: { shown: shown.length, total: afterSheet.length },
      newTitle,
      newWhere: groupOfActive && groupOfActive.kind !== "none" ? groupOfActive.name : sheet.name,
      canApply:
        mode === "new"
          ? !!newTitle && !unknown
          : mode === "edit" && !unknown && known && hasChange(change) && (change.remove ? targetRows.length > 0 : planned.cells.length > 0),
    };
  }, [cmd, newMatch, parsed, liveFilter, targetRows, shown.length, afterSheet.length, range, flat, groups, sheet.name]);

  /* The sentence, drawn into the grid as outlined cells before Enter. */
  const cmdPreview = useMemo(() => {
    const m = new Map<string, CellValue>();
    if (cmdState.mode !== "edit" || !cmdState.canApply || cmdState.remove) return m;
    planChange(targetRows, toChange(parsed.tokens)).cells.forEach((x) => m.set(`${x.row}|${x.col}`, x.value));
    return m;
  }, [cmdState, targetRows, parsed]);

  /* ── Mutations: every one goes through the store and is undoable ── */
  const undo = useCallback(() => {
    say(undoLast() ? "Undone" : "Nothing to undo");
  }, [say]);
  useUndoKey(useCallback((ok: boolean) => say(ok ? "Undone" : "Nothing to undo"), [say]));
  useEffect(() => () => dropViewSteps("list"), []);

  const setCells = useCallback(
    (changes: { row: string; col: string; value: CellValue }[], message?: string) => {
      if (!changes.length) return;
      const patches = new Map<string, TaskPatch>();
      const own: { row: string; col: string; value: CellValue }[] = [];
      let refused = 0;
      for (const c of changes) {
        if (!STORE_COLUMNS.has(c.col)) {
          own.push(c);
          continue;
        }
        const p = cellPatch(c.col, c.value);
        if (!p) {
          refused++;
          continue;
        }
        patches.set(c.row, { ...(patches.get(c.row) ?? {}), ...p });
      }
      const before = new Map(tasks.map((t) => [t.id, t.status]));
      const stored = batch([...patches].map(([id, p]) => () => updateTask(id, p)));
      if (own.length) {
        // Added fields live on this list, not in the store; they join the same undo.
        const before = extras;
        const next = { ...extras };
        for (const c of own) next[c.row] = { ...(next[c.row] ?? {}), [c.col]: c.value };
        setExtras(next);
        pushViewStep("list", () => setExtras(before), stored);
      }
      const note = refused
        ? `${refused} ${refused === 1 ? "cell was" : "cells were"} left as ${refused === 1 ? "it was" : "they were"}: every task keeps an owner and a project, and a supplier has to be one you work with`
        : "";
      // Every edit says what happened and offers Undo: one task in its own words, several as a count.
      const touched = new Set([...patches.keys(), ...own.map((c) => c.row)]);
      const [oneId, onePatch] = patches.size === 1 && !own.length ? [...patches][0] : [];
      const said =
        message ??
        (oneId && onePatch
          ? editSentence(onePatch, { status: before.get(oneId) })
          : touched.size === 1 && own.length
            ? `Updated ${[...new Set(own.map((c) => columns.find((x) => x.key === c.col)?.name ?? "the field"))].join(" and ")}`
            : touched.size
              ? `Updated ${plural(touched.size, "task")}`
              : "");
      if (said || note) say([said, note].filter(Boolean).join(". "), !!said);
      setFlash((f) => ({ keys: new Set(changes.map((c) => `${c.row}|${c.col}`)), n: f.n + 1 }));
    },
    [say, extras, tasks, columns],
  );

  const updateSheet = (patch: Partial<Sheet>) => setSheets((all) => all.map((x) => (x.id === sheet.id ? { ...x, ...patch } : x)));

  /* ── Navigation ─────────────────────────────────────────────────── */
  const reveal = (row: string, col: string) =>
    requestAnimationFrame(() => document.getElementById(cellDomId(row, col))?.scrollIntoView({ block: "nearest", inline: "nearest" }));

  const move = (dr: number, dc: number, extend: boolean) => {
    if (!flat.length) return;
    const from = range ? (extend ? { r: rowIdx.get(sel!.f.row)!, c: colIdx.get(sel!.f.col)! } : { r: range.ar, c: range.ac }) : { r: 0, c: 0 };
    const r = Math.max(0, Math.min(flat.length - 1, from.r + dr));
    const c = Math.max(0, Math.min(cols.length - 1, from.c + dc));
    const pos = { row: flat[r].id, col: cols[c].key };
    setSel(extend && sel ? { a: sel.a, f: pos } : { a: pos, f: pos });
    reveal(pos.row, pos.col);
  };

  const focusGrid = () => requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));

  /* ── Editing ────────────────────────────────────────────────────── */
  const startEdit = (row: string, col: string, seed?: string) => {
    const c = columns.find((x) => x.key === col);
    const r = rows.find((x) => x.id === row);
    if (!c || !r) return;
    if (c.type === "checkbox") {
      setCells([{ row, col, value: !r.cells[col] }]);
      return;
    }
    const el = document.getElementById(cellDomId(row, col));
    const rect = el?.getBoundingClientRect();
    const v = r.cells[col];
    const draft = seed ?? (isNumeric(c) ? (typeof v === "number" ? String(v) : "") : typeof v === "string" ? v : "");
    setEditing({ row, col, draft, rect: rect ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height } : { x: 200, y: 200, w: 160, h: 34 } });
  };

  const finishEdit = (value: CellValue | undefined, then?: "down" | "right" | "left") => {
    if (!editing) return;
    const { row, col } = editing;
    setEditing(null);
    if (value !== undefined) {
      const r = rows.find((x) => x.id === row);
      if (r && r.cells[col] !== value) setCells([{ row, col, value }]);
    }
    if (then === "down") move(1, 0, false);
    if (then === "right") move(0, 1, false);
    if (then === "left") move(0, -1, false);
    focusGrid();
  };

  const rangeCells = (): { row: Row; col: Column }[] => {
    if (!range) return [];
    const out: { row: Row; col: Column }[] = [];
    for (let i = range.r0; i <= range.r1; i++) for (let j = range.c0; j <= range.c1; j++) out.push({ row: flat[i], col: cols[j] });
    return out;
  };

  const clearRange = () => {
    const cells = rangeCells().filter((x) => x.col.type !== "title");
    if (!cells.length) return;
    setCells(
      cells.map((x) => ({ row: x.row.id, col: x.col.key, value: x.col.type === "checkbox" ? false : null })),
      `Cleared ${plural(cells.length, "cell")}`,
    );
  };

  /* ── Fill-down ──────────────────────────────────────────────────── */
  const fillPreview = useMemo(() => {
    const m = new Map<string, CellValue>();
    if (!fill || !range) return m;
    const to = rowIdx.get(fill.toRow);
    if (to == null || to <= range.r1) return m;
    for (let j = range.c0; j <= range.c1; j++) {
      const c = cols[j];
      if (c.type === "title") continue;
      const sources = flat.slice(range.r0, range.r1 + 1).map((r) => r.cells[c.key]);
      const vals = fillValues(sources, c, to - range.r1, fill.copy ? "copy" : "series");
      vals.forEach((v, k) => m.set(`${flat[range.r1 + 1 + k].id}|${c.key}`, v));
    }
    return m;
  }, [fill, range, rowIdx, cols, flat]);

  const applyFill = () => {
    if (!fill || !range) return setFill(null);
    const to = rowIdx.get(fill.toRow);
    setFill(null);
    if (to == null || to <= range.r1 || !fillPreview.size) return;
    const changes = [...fillPreview].map(([k, value]) => {
      const [row, col] = k.split("|");
      return { row, col, value };
    });
    setCells(changes, `Filled ${changes.length} ${changes.length === 1 ? "cell" : "cells"}`);
    setSel({ a: sel!.a, f: { row: flat[to].id, col: cols[range.c1].key } });
  };

  const fillDown = () => {
    if (!range || range.r1 === range.r0) return;
    const changes: { row: string; col: string; value: CellValue }[] = [];
    for (let j = range.c0; j <= range.c1; j++) {
      const c = cols[j];
      if (c.type === "title") continue;
      for (let i = range.r0 + 1; i <= range.r1; i++) changes.push({ row: flat[i].id, col: c.key, value: flat[range.r0].cells[c.key] });
    }
    setCells(changes, `Filled ${changes.length} cells`);
  };

  /* ── Clipboard ──────────────────────────────────────────────────── */
  const copy = () => {
    if (!range) return;
    const lines: string[] = [];
    for (let i = range.r0; i <= range.r1; i++) {
      const cells: string[] = [];
      for (let j = range.c0; j <= range.c1; j++) cells.push(toText(flat[i].cells[cols[j].key], cols[j]));
      lines.push(cells.join("\t"));
    }
    navigator.clipboard?.writeText(lines.join("\n")).catch(() => {});
    const n = (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1);
    say(n === 1 ? "Copied" : `Copied ${n} cells`);
  };

  const pasteIntoCells = (text: string) => {
    if (!range) return;
    const grid = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
    const changes: { row: string; col: string; value: CellValue }[] = [];
    let rejected = 0;
    grid.forEach((line, i) =>
      line.forEach((raw, j) => {
        const r = flat[range.r0 + i];
        const c = cols[range.c0 + j];
        if (!r || !c) return;
        const parsed = fromText(raw, c);
        if (parsed.ok) changes.push({ row: r.id, col: c.key, value: parsed.value });
        else rejected++;
      }),
    );
    setCells(changes, `Pasted ${changes.length} ${changes.length === 1 ? "cell" : "cells"}${rejected ? ` · ${rejected} didn't fit their column` : ""}`);
  };

  const groupBase = (key: string): Record<string, CellValue> => {
    const g = groups.find((x) => x.key === key);
    if (!g || g.kind === "none") return {};
    return { [GROUP_FIELD[g.kind] ?? "owner"]: g.value };
  };

  const offerPaste = (text: string, groupKey: string, at: { x: number; y: number } | null) => {
    const plan = planPaste(text, columns);
    if (!plan || !plan.body.length) return;
    setPaste({ plan, base: groupBase(groupKey), table: sheet.table, x: at?.x ?? null, y: at?.y ?? null });
  };

  /** New store tasks from sheet cells: a project and an owner always, the rest as given. */
  const addFromCells = (list: Record<string, CellValue>[]) => {
    const ids: string[] = [];
    batch(
      list.map((cells) => () => {
        const title = String(cells.title ?? "").trim();
        if (!title) return;
        const fields: TaskPatch = {};
        for (const [k, v] of Object.entries(cells)) if (STORE_COLUMNS.has(k) && k !== "title") Object.assign(fields, cellPatch(k, v) ?? {});
        ids.push(addTask({ ...fields, title, project: (fields.project ?? scope.project ?? "mara-finn") as ProjectId, owner: fields.owner ?? scope.owner ?? "orla" }));
      }),
    );
    return ids;
  };

  const confirmPaste = () => {
    if (!paste) return;
    const ids = addFromCells(rowsFromPlan(paste.plan, columns, paste.base));
    setPaste(null);
    if (!ids.length) return;
    say(`Added ${ids.length} ${ids.length === 1 ? "task" : "tasks"}`, true);
    setFlash((f) => ({ keys: new Set(ids.flatMap((id) => columns.map((c) => `${id}|${c.key}`))), n: f.n + 1 }));
    setSel({ a: { row: ids[0], col: "title" }, f: { row: ids[ids.length - 1], col: "title" } });
    reveal(ids[ids.length - 1], "title");
  };

  /* ── Rows ───────────────────────────────────────────────────────── */
  /** What a group already says about a new task: its project, its status or its owner. */
  const groupDefaults = (groupKey: string): NewTaskDefaults => {
    const base = groupBase(groupKey);
    return {
      project: (base.event as ProjectId | undefined) ?? scope.project,
      owner: (base.owner as TeamPersonId | undefined) ?? scope.owner,
      status: base.status as NewTaskDefaults["status"],
      room: typeof base.room === "string" ? ROOMS[base.room as RoomId]?.name : undefined,
    };
  };

  /** A plain-words line, like "Collect the cake stand orla fri high", becomes a task. */
  const addLine = (line: TaskLine, defaults: NewTaskDefaults) => {
    const id = addFromLine(line, defaults);
    if (!id) return null;
    setSel({ a: { row: id, col: "title" }, f: { row: id, col: "title" } });
    setFlash((f) => ({ keys: new Set(columns.map((c) => `${id}|${c.key}`)), n: f.n + 1 }));
    reveal(id, "title");
    say(`Added “${line.title}”`, true);
    return id;
  };

  const addRow = (groupKey: string, text: string) => addLine(parseTaskLine(text), groupDefaults(groupKey));

  const openCompose = useCallback(() => {
    setComposing(true);
    setEditing(null);
    // Already open: N puts the cursor back in it.
    requestAnimationFrame(focusNewTask);
  }, []);
  useNewTaskKey(openCompose);
  useNewTaskParam(openCompose);

  const deleteChecked = () => {
    const ids = [...checked];
    batch(ids.map((id) => () => removeTask(id)));
    say(`Deleted ${ids.length} ${ids.length === 1 ? "task" : "tasks"}`, true);
    setChecked(new Set());
  };

  const duplicateChecked = () => {
    const copies = rows.filter((r) => checked.has(r.id));
    batch(
      copies.map((r) => () => {
        const { id, ...rest } = r.task;
        void id;
        addTask({ ...rest, paid: false });
      }),
    );
    say(`Duplicated ${copies.length} ${copies.length === 1 ? "task" : "tasks"}`, true);
    setChecked(new Set());
  };

  const markPaidChecked = () => {
    setCells(
      [...checked].map((id) => ({ row: id, col: "paid", value: true })),
      `Marked ${checked.size} paid`,
    );
    setChecked(new Set());
  };

  /* ── Columns and sheets ─────────────────────────────────────────── */
  const addColumn = (type: ColType, name: string) => {
    const key = `f${seq.current++}`;
    const label = name.trim() || { text: "Text", currency: "Amount", number: "Number", date: "Date", checkbox: "Done", person: "Person" }[type as string] || "Field";
    setColumns((cs) => [...cs, { key, name: label, type, width: WIDTH_BY_TYPE[type] ?? 160, custom: true }]);
    pushViewStep("list", () => setColumns((cs) => cs.filter((c) => c.key !== key)));
    if (flat[0]) {
      setSel({ a: { row: flat[0].id, col: key }, f: { row: flat[0].id, col: key } });
      requestAnimationFrame(() => document.getElementById(cellDomId(flat[0].id, key))?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }));
    }
    say(`Added the ${label} column. It shows on this list only`, true);
  };

  const newSheet = () => {
    const n = sheets.length + 1;
    const id = `s${n}`;
    setSheets((all) => [...all, { id, name: `Sheet ${n}`, table: "main", hidden: ["guests", "notes", "supplier"], groupBy: "none", filter: NO_FILTER, sort: null }]);
    setSheetId(id);
    setSel(null);
    setChecked(new Set());
  };

  const switchSheet = (id: string) => {
    setSheetId(id);
    setChecked(new Set());
    setEditing(null);
    setSel(null);
  };

  /* ── Command line ───────────────────────────────────────────────── */

  const runCommand = () => {
    const st = cmdState;
    if (st.mode === "idle") return;
    if (st.mode === "filter") {
      // Keep the filter on this sheet; the toolbar shows it as a chip.
      updateSheet({ query: cmd.replace(/^\s*(show|find|only|filter|where)\s+/i, "").trim() });
      setCmd("");
      say(`Showing ${plural(shown.length, "task")} that match`);
      focusGrid();
      return;
    }
    if (!st.canApply) return;
    const change = toChange(parsed.tokens);
    if (st.mode === "new") {
      const g = st.newWhere;
      const group = groups.find((x) => x.name === g) ?? groups[0];
      addLine(parseTaskLine(cmd.replace(NEW_RE, "").replace(",", " ")), groupDefaults(group?.key ?? "none"));
      setCmd("");
      focusGrid();
      return;
    }
    if (change.remove) {
      const ids = new Set(targetRows.map((r) => r.id));
      batch([...ids].map((id) => () => removeTask(id)));
      say(`Deleted ${plural(ids.size, "task")}`, true);
      setChecked(new Set());
      setSel(null);
      setCmd("");
      focusGrid();
      return;
    }
    const planned = planChange(targetRows, change);
    const said = parsed.tokens
      .map((x) => chipFor(x, false))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => `${x.label === "Assign" || x.label === "Mark" || x.label === "Move to" ? "" : `${x.label} `}${x.value}`.trim());
    // One task says what happened in the shared words ("Moved to Aoife, due Mon 28 Sep"); several say how many.
    setCells(planned.cells, planned.rows === 1 ? undefined : `Updated ${plural(planned.rows, "task")}: ${said.join(", ")}`);
    setCmd("");
    if (isPhone) setSelecting(false);
    if (isPhone) setChecked(new Set());
    else focusGrid();
  };

  const escapeCommand = () => {
    if (cmd) return setCmd("");
    cmdRef.current?.blur();
    if (!isPhone) focusGrid();
  };

  const saveAsSheet = () => {
    const q = cmd.replace(/^\s*(show|find|only|filter|where)\s+/i, "").trim();
    if (!q) return;
    const id = `q${seq.current++}`;
    const name = q.length > 22 ? `${q.slice(0, 21)}…` : q.replace(/^./, (x) => x.toUpperCase());
    setSheets((all) => [...all, { ...sheet, id, name, query: q, filter: NO_FILTER }]);
    setSheetId(id);
    setCmd("");
    setSel(null);
    say(`Saved “${q}” as a sheet`);
  };

  /* "/" from anywhere on the page, unless typing somewhere. (Ctrl K
     stays with the app's own Jump to.) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !el?.closest("[role=dialog]")) {
        e.preventDefault();
        cmdRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openRow = (id: string) => {
    if (isPhone) return setRecord(id);
    const r = rowIdx.get(id);
    if (r != null) setSel({ a: { row: id, col: "title" }, f: { row: id, col: "title" } });
    setDetail(true);
  };

  /* ?task=<id> opens that task: the row selected, its details beside the sheet. */
  const pendingTask = useRef<string | null>(null);
  const openedTask = useRef<string | null>(null);
  const revealTried = useRef(false);
  useEffect(() => {
    if (scope.task && scope.task !== openedTask.current) {
      pendingTask.current = scope.task;
      revealTried.current = false;
    }
  }, [scope.task]);
  useEffect(() => {
    const id = pendingTask.current;
    if (!id || !rows.some((r) => r.id === id)) return;
    const visible = flat.some((r) => r.id === id);
    if (!visible && revealTried.current) return;
    const frame = requestAnimationFrame(() => {
      if (!visible) {
        // Hidden by a filter, a saved query or a closed group: show the full sheet.
        revealTried.current = true;
        setSheets((all) => all.map((x) => (x.id === "all" ? { ...x, filter: NO_FILTER, query: undefined } : x)));
        setSheetId("all");
        setCollapsed(new Set());
        setCmd("");
        return;
      }
      pendingTask.current = null;
      openedTask.current = id;
      setSel({ a: { row: id, col: "title" }, f: { row: id, col: "title" } });
      if (isPhone) setRecord(id);
      else setDetail(true);
      requestAnimationFrame(() => document.getElementById(cellDomId(id, "title"))?.scrollIntoView({ block: "center", inline: "nearest" }));
    });
    return () => cancelAnimationFrame(frame);
  }, [rows, flat, isPhone, scope.task]);

  /* Escape closes the details panel, after any editor or menu has had its turn. */
  useEffect(() => {
    if (!detail || isPhone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || editing) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[role=dialog], [role=menu], [role=listbox]") || document.querySelector("[role=dialog]")) return;
      setDetail(false);
      if (scope.task) scope.set({ task: undefined });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, isPhone, editing, scope]);

  /* ── Keyboard ───────────────────────────────────────────────────── */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing || e.target !== e.currentTarget) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key;
    if (mod && k.toLowerCase() === "d") return (e.preventDefault(), fillDown());
    if (mod && k.toLowerCase() === "c") return (e.preventDefault(), copy());
    if (mod && k.toLowerCase() === "a") {
      e.preventDefault();
      if (flat.length) setSel({ a: { row: flat[0].id, col: cols[0].key }, f: { row: flat[flat.length - 1].id, col: cols[cols.length - 1].key } });
      return;
    }
    if (mod) return;
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) return (e.preventDefault(), move(arrows[k][0], arrows[k][1], e.shiftKey));
    // Tab leaves the grid; the arrows move between cells.
    if (!sel || !range) return;
    const active = { row: flat[range.ar].id, col: cols[range.ac].key };
    if (k === "Enter" || k === "F2") return (e.preventDefault(), startEdit(active.row, active.col));
    if (k === " " && cols[range.ac].type === "checkbox") return (e.preventDefault(), startEdit(active.row, active.col));
    if (k === " " && e.shiftKey) return (e.preventDefault(), isPhone ? setRecord(active.row) : setDetail((d) => !d));
    // The page's own keys keep their meaning with a cell selected: / is the command line, N is New task.
    if (k === "/" || k === "n" || k === "N") return;
    if (k === "Escape") {
      // Each Escape undoes one thing: the range, then the ticks, then the details panel.
      if (range.r0 !== range.r1 || range.c0 !== range.c1) return (e.preventDefault(), setSel({ a: sel.a, f: sel.a }));
      if (checked.size) return (e.preventDefault(), setChecked(new Set()));
      // Then the cell itself.
      if (!detail) return (e.preventDefault(), setSel(null));
      return;
    }
    if (k === "Backspace" || k === "Delete") return (e.preventDefault(), clearRange());
    if (k.length === 1 && !e.altKey) {
      const t = cols[range.ac].type;
      if (["title", "text", "longtext", "currency", "number", "date"].includes(t)) {
        e.preventDefault();
        startEdit(active.row, active.col, t === "date" ? undefined : k);
      } else if (t !== "checkbox") startEdit(active.row, active.col);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (editing || e.target !== e.currentTarget) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    if (!range) {
      offerPaste(text, groups[0]?.key ?? "all", null);
      return;
    }
    pasteIntoCells(text);
  };

  /* Close the popover editor if the grid scrolls underneath it. */
  useEffect(() => {
    if (!editing) return;
    const c = columns.find((x) => x.key === editing.col);
    if (!c || c.type === "title" || c.type === "text" || c.type === "longtext" || isNumeric(c)) return;
    const el = gridRef.current;
    const close = () => setEditing(null);
    el?.addEventListener("scroll", close, { passive: true });
    return () => el?.removeEventListener("scroll", close);
  }, [editing, columns]);

  useEffect(() => {
    const up = () => (dragSel.current = false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  /* One line when a filter leaves nothing, the same words on the sheet and the phone list. */
  const typed = (liveFilter ? cmd.replace(/^\s*(show|find|only|filter|where)\s+/i, "").trim() : "") || sheet.query || "";
  const noMatch = shown.length
    ? undefined
    : sheet.filter.stuck
      ? "Nothing stuck here. Everything started has moved in the last 5 days."
      : sheet.filter.late
        ? "Nothing late here."
        : typed
          ? `None of ${plural(afterSheet.length || base.length, "task")} ${(afterSheet.length || base.length) === 1 ? "matches" : "match"} “${typed}”.`
          : undefined;
  const clearFilters = () => {
    updateSheet({ filter: NO_FILTER, query: undefined });
    setCmd("");
  };

  const recordRow = record ? rows.find((r) => r.id === record) ?? null : null;
  const recordIndex = recordRow ? flat.findIndex((r) => r.id === recordRow.id) : -1;
  const dockRow = !isPhone && detail && range ? flat[range.ar] ?? null : null;
  const dockIndex = dockRow && range ? range.ar : -1;
  const stepDock = (d: number) => {
    if (!range) return;
    const r = flat[range.ar + d];
    if (!r) return;
    const col = cols[range.ac].key;
    setSel({ a: { row: r.id, col }, f: { row: r.id, col } });
    reveal(r.id, col);
  };
  const editRow = editing ? rows.find((r) => r.id === editing.row) : undefined;
  const editCol = editing ? columns.find((c) => c.key === editing.col) : undefined;

  return (
    <div className={`${s.root} v3-focus`}>
      <TasksPageHeader
        lateOnly={sheet.filter.late}
        onLate={() => updateSheet({ filter: { ...sheet.filter, late: !sheet.filter.late } })}
        stuckOnly={sheet.filter.stuck}
        onStuck={(on) => updateSheet({ filter: { ...sheet.filter, stuck: on } })}
        onNewTask={openCompose}
        onSay={(text) => say(text)}
      />
      <Toolbar
        sheets={sheets}
        sheet={sheet}
        counts={Object.fromEntries(
          sheets.map((x) => {
            const q = x.query ? parse(x.query).tokens : null;
            const all = sheetRows(rows, x);
            return [x.id, q ? all.filter((r) => matches(r, q)).length : all.length];
          }),
        )}
        columns={columns}
        density={density}
        checked={checked.size}
        onSheet={switchSheet}
        onNewSheet={newSheet}
        onGroup={(g: GroupBy) => updateSheet({ groupBy: g })}
        onFilter={(f: Filter) => updateSheet({ filter: f })}
        onHidden={(h: string[]) => updateSheet({ hidden: h })}
        onDensity={setDensity}
        onClearSort={() => updateSheet({ sort: null })}
        onClearQuery={() => updateSheet({ query: undefined })}
        onDelete={deleteChecked}
        onDuplicate={duplicateChecked}
        onMarkPaid={markPaidChecked}
        onClearChecked={() => setChecked(new Set())}
      />
      {composing && (
        <NewTaskComposer
          className={s.composeBar}
          fallbackProject={scope.project ?? "mara-finn"}
          onAdd={(line) => addLine(line, { project: scope.project, owner: scope.owner })}
          onClose={() => {
            const typing = document.activeElement?.closest("[data-new-task]");
            setComposing(false);
            // Escape hands the keyboard back to the sheet; a click elsewhere keeps what it clicked.
            if (typing) focusGrid();
          }}
        />
      )}
      <div className={s.body}>
      <Grid
        gridRef={gridRef}
        sheet={sheet}
        cols={cols}
        allRows={base}
        shown={shown}
        groups={groups}
        flat={flat}
        range={range}
        density={density}
        checked={checked}
        editing={editing}
        fill={fill}
        fillPreview={fill ? fillPreview : cmdPreview}
        flash={flash}
        aggs={aggs}
        isCollapsed={isCollapsed}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onToggleGroup={(key) =>
          setCollapsed((c) => {
            const n = new Set(c);
            const k = `${sheet.id}:${key}`;
            if (n.has(k)) n.delete(k);
            else n.add(k);
            return n;
          })
        }
        onCellDown={(pos, e) => {
          if (e.button !== 0) return;
          if (e.shiftKey && sel) setSel({ a: sel.a, f: pos });
          else setSel({ a: pos, f: pos });
          dragSel.current = true;
          gridRef.current?.focus({ preventScroll: true });
        }}
        onCellEnter={(pos) => {
          if (dragSel.current && sel) setSel({ a: sel.a, f: pos });
        }}
        onCellDouble={(pos) => startEdit(pos.row, pos.col)}
        onToggleCheck={(pos) => startEdit(pos.row, pos.col)}
        onStatusCycle={(row) => {
          const r = rows.find((x) => x.id === row)!;
          setCells([{ row, col: "status", value: r.cells.status === "done" ? "todo" : "done" }]);
        }}
        onCheckRow={(id, on) =>
          setChecked((c) => {
            const n = new Set(c);
            if (on) n.add(id);
            else n.delete(id);
            return n;
          })
        }
        onCheckAll={(on) => setChecked(on ? new Set(flat.map((r) => r.id)) : new Set())}
        onOpen={openRow}
        onInlineCommit={finishEdit}
        onDraft={(draft) => setEditing((ed) => (ed ? { ...ed, draft } : ed))}
        onFillStart={(e) => {
          if (!range) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setFill({ toRow: flat[range.r1].id, copy: e.altKey, x: e.clientX, y: e.clientY });
        }}
        onFillMove={(e) => {
          if (!fill) return;
          const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-row]") as HTMLElement | null;
          const row = el?.dataset.row ?? fill.toRow;
          setFill({ toRow: rowIdx.has(row) ? row : fill.toRow, copy: e.altKey, x: e.clientX, y: e.clientY });
        }}
        onFillEnd={applyFill}
        onSort={(key) => {
          const cur = sheet.sort?.key === key ? sheet.sort.dir : null;
          updateSheet({ sort: cur === null ? { key, dir: "asc" } : cur === "asc" ? { key, dir: "desc" } : null });
        }}
        onResize={(key, width) => setColumns((cs) => cs.map((c) => (c.key === key ? { ...c, width } : c)))}
        onAddColumn={addColumn}
        onAgg={(key, a) => setAggs((x) => ({ ...x, [key]: a }))}
        onAddRow={addRow}
        onOfferPaste={offerPaste}
        onExamplePaste={() => offerPaste(EXAMPLE_PASTE, groups[0]?.key ?? "all", null)}
        emptyFor={scope.owner ? { who: PEOPLE[scope.owner].name, onClear: () => scope.set({ owner: undefined }) } : undefined}
        noMatch={noMatch}
        onClearFilters={clearFilters}
      />
      {dockRow && (
        <RecordForm
          docked
          row={dockRow}
          columns={columns}
          index={dockIndex}
          total={flat.length}
          onChange={(col, value) => setCells([{ row: dockRow.id, col, value }])}
          onPrev={dockIndex > 0 ? () => stepDock(-1) : undefined}
          onNext={dockIndex >= 0 && dockIndex < flat.length - 1 ? () => stepDock(1) : undefined}
          onClose={() => {
            setDetail(false);
            if (scope.task) scope.set({ task: undefined });
            focusGrid();
          }}
        />
      )}
      </div>
      <PhoneList
        sheets={sheets}
        sheet={sheet}
        groups={groups}
        shown={shown}
        allRows={base}
        isCollapsed={isCollapsed}
        onSheet={switchSheet}
        onGroup={(g: GroupBy) => updateSheet({ groupBy: g })}
        onFilter={(f: Filter) => updateSheet({ filter: f })}
        onOpen={setRecord}
        checked={checked}
        selecting={selecting}
        onSelecting={(on) => {
          setSelecting(on);
          if (!on) setChecked(new Set());
        }}
        onCheck={(id) =>
          setChecked((c) => {
            const n = new Set(c);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
          })
        }
        onNewRow={openCompose}
        noMatch={noMatch}
        onExamplePaste={() => offerPaste(EXAMPLE_PASTE, groups[0]?.key ?? "all", null)}
        onToggleDone={(row) => {
          const r = rows.find((x) => x.id === row)!;
          setCells([{ row, col: "status", value: r.cells.status === "done" ? "todo" : "done" }]);
        }}
      />

      <CommandBar
        cmd={cmd}
        state={cmdState}
        inputRef={cmdRef}
        onCmd={(v) => {
          setCmd(v);
          if (v.trim()) closeToast();
        }}
        onSubmit={runCommand}
        onEscape={escapeCommand}
        onSaveSheet={saveAsSheet}
        scope={selScope}
        phone={isPhone}
        cellSelected={!!sel && !editing}
      />

      {editing && editRow && editCol && !["title", "text", "longtext", "currency", "number"].includes(editCol.type) && (
        <Editor target={editing} row={editRow} col={editCol} onDone={finishEdit} />
      )}

      {recordRow && (
        <RecordForm
          row={recordRow}
          columns={columns}
          index={recordIndex}
          total={flat.length}
          onChange={(col, value) => setCells([{ row: recordRow.id, col, value }])}
          onPrev={recordIndex > 0 ? () => setRecord(flat[recordIndex - 1].id) : undefined}
          onNext={recordIndex >= 0 && recordIndex < flat.length - 1 ? () => setRecord(flat[recordIndex + 1].id) : undefined}
          onClose={() => {
            setRecord(null);
            if (scope.task) scope.set({ task: undefined });
            focusGrid();
          }}
        />
      )}

      {paste && <PasteConfirm state={paste} columns={columns} onConfirm={confirmPaste} onCancel={() => setPaste(null)} />}
      {fill && fillPreview.size > 0 && range && (
        <div className={s.fillTip} style={{ left: fill.x + 16, top: fill.y + 14 }} aria-live="polite">
          <strong>{fillPreview.size} {fillPreview.size === 1 ? "cell" : "cells"}</strong>
          <span>{fill.copy ? "Copying the value" : cols[range.c0].type === "date" ? "A day apart" : "Following the pattern"}</span>
          <span className={s.fillTipHint}>{fill.copy ? `Let go of ${keys.alt} to step` : `Hold ${keys.alt} to copy instead`}</span>
        </div>
      )}
      {/* Above the totals row and the command line. */}
      <TaskToast toast={toast} onUndo={undo} onClose={closeToast} lift={96} phoneLift={116} />
      {/* On a phone the button sits in the totals bar, above the command line: lift = the command line, plus what centres it in the bar. */}
      {!composing && !recordRow && <NewTaskFab onClick={openCompose} lift={45} />}
    </div>
  );
}
