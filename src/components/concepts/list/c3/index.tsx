"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXAMPLE_PASTE, SAMPLE_ROWS, type CellValue, type Row } from "./data";
import {
  BASE_COLUMNS,
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
import { Header, Toolbar } from "./Toolbar";
import { Editor, type EditTarget } from "./Editors";
import { PasteConfirm, Toast, type ToastState } from "./Overlays";
import { RecordForm } from "./Record";
import { PhoneList } from "./Phone";
import s from "./sheet.module.css";

export type Pos = { row: string; col: string };
export type Sel = { a: Pos; f: Pos };
export type FillDrag = { toRow: string; copy: boolean; x: number; y: number };
export type PasteState = { plan: PastePlan; base: Record<string, CellValue>; table: string; x: number | null; y: number | null };

const WIDTH_BY_TYPE: Partial<Record<ColType, number>> = { checkbox: 72, currency: 112, number: 96, date: 120, person: 132 };

export default function PlannersSheet() {
  /* ── Data and history ───────────────────────────────────────────── */
  const [rows, setRows] = useState<Row[]>(SAMPLE_ROWS);
  const [past, setPast] = useState<Row[][]>([]);
  const [columns, setColumns] = useState<Column[]>(BASE_COLUMNS);
  const [sheets, setSheets] = useState<Sheet[]>(START_SHEETS);
  const [sheetId, setSheetId] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [density, setDensity] = useState<"compact" | "comfy">("compact");
  const [aggs, setAggs] = useState<Record<string, Agg>>({ cost: "sum", guests: "max" });

  /* ── Interaction ────────────────────────────────────────────────── */
  const [sel, setSel] = useState<Sel | null>({ a: { row: "r4", col: "due" }, f: { row: "r4", col: "due" } });
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [fill, setFill] = useState<FillDrag | null>(null);
  const [flash, setFlash] = useState<{ keys: Set<string>; n: number }>({ keys: new Set(), n: 0 });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [paste, setPaste] = useState<PasteState | null>(null);
  const [record, setRecord] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const dragSel = useRef(false);
  const seq = useRef(100);

  const sheet = sheets.find((x) => x.id === sheetId) ?? sheets[0];
  const cols = useMemo(() => sheetColumns(columns, sheet), [columns, sheet]);
  const base = useMemo(() => sheetRows(rows, sheet), [rows, sheet]);
  const shown = useMemo(() => sortRows(applyFilter(base, sheet.filter), sheet.sort, columns), [base, sheet.filter, sheet.sort, columns]);
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

  /* ── Mutations (every one is undoable) ──────────────────────────── */
  const commit = useCallback(
    (next: Row[], message?: string) => {
      setPast((p) => [...p.slice(-40), rows]);
      setRows(next);
      if (message) setToast({ id: Date.now(), text: message, undo: rows });
    },
    [rows],
  );

  const undo = useCallback(() => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(past.slice(0, -1));
    setRows(prev);
    setToast({ id: Date.now(), text: "Undone" });
  }, [past]);

  const undoTo = (snapshot: Row[]) => {
    setPast((p) => [...p, rows]);
    setRows(snapshot);
    setToast({ id: Date.now(), text: "Undone" });
  };

  const setCells = useCallback(
    (changes: { row: string; col: string; value: CellValue }[], message?: string) => {
      if (!changes.length) return;
      const byRow = new Map<string, Record<string, CellValue>>();
      changes.forEach((c) => byRow.set(c.row, { ...(byRow.get(c.row) ?? {}), [c.col]: c.value }));
      commit(
        rows.map((r) => (byRow.has(r.id) ? { ...r, cells: { ...r.cells, ...byRow.get(r.id) } } : r)),
        message,
      );
      setFlash((f) => ({ keys: new Set(changes.map((c) => `${c.row}|${c.col}`)), n: f.n + 1 }));
    },
    [rows, commit],
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
      cells.length > 1 ? `Cleared ${cells.length} cells` : undefined,
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
    setToast({ id: Date.now(), text: n === 1 ? "Copied" : `Copied ${n} cells` });
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
    const field = g.kind === "event" ? "event" : g.kind === "status" ? "status" : "owner";
    return { [field]: g.value };
  };

  const offerPaste = (text: string, groupKey: string, at: { x: number; y: number } | null) => {
    const plan = planPaste(text, columns);
    if (!plan || !plan.body.length) return;
    setPaste({ plan, base: groupBase(groupKey), table: sheet.table, x: at?.x ?? null, y: at?.y ?? null });
  };

  const confirmPaste = () => {
    if (!paste) return;
    const added = rowsFromPlan(paste.plan, columns, paste.base, paste.table, seq.current++);
    setPaste(null);
    commit([...rows, ...added], `Added ${added.length} rows`);
    setFlash((f) => ({ keys: new Set(added.flatMap((r) => columns.map((c) => `${r.id}|${c.key}`))), n: f.n + 1 }));
    setSel({ a: { row: added[0].id, col: "title" }, f: { row: added[added.length - 1].id, col: "title" } });
    reveal(added[added.length - 1].id, "title");
  };

  /* ── Rows ───────────────────────────────────────────────────────── */
  const addRow = (groupKey: string, title: string) => {
    const id = `n${seq.current++}`;
    const row: Row = { id, table: sheet.table, cells: { title, status: "todo", paid: false, ...groupBase(groupKey) } };
    commit([...rows, row]);
    setSel({ a: { row: id, col: "title" }, f: { row: id, col: "title" } });
    reveal(id, "title");
    return id;
  };

  const deleteChecked = () => {
    const n = checked.size;
    commit(
      rows.filter((r) => !checked.has(r.id)),
      `Deleted ${n} ${n === 1 ? "row" : "rows"}`,
    );
    setChecked(new Set());
  };

  const duplicateChecked = () => {
    const copies = rows.filter((r) => checked.has(r.id)).map((r) => ({ ...r, id: `d${seq.current++}`, cells: { ...r.cells, paid: false } }));
    commit([...rows, ...copies], `Duplicated ${copies.length} ${copies.length === 1 ? "row" : "rows"}`);
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
    if (flat[0]) {
      setSel({ a: { row: flat[0].id, col: key }, f: { row: flat[0].id, col: key } });
      requestAnimationFrame(() => document.getElementById(cellDomId(flat[0].id, key))?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }));
    }
    setToast({ id: Date.now(), text: `Added the ${label} field` });
  };

  const newSheet = () => {
    const n = sheets.length + 1;
    const id = `s${n}`;
    setSheets((all) => [...all, { id, name: `Sheet ${n}`, table: id, hidden: ["event", "guests", "room"], groupBy: "none", filter: NO_FILTER, sort: null }]);
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

  /* ── Keyboard ───────────────────────────────────────────────────── */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing || e.target !== e.currentTarget) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key;
    if (mod && k.toLowerCase() === "z") return (e.preventDefault(), undo());
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
    if (k === "Tab") return (e.preventDefault(), move(0, e.shiftKey ? -1 : 1, false));
    if (!sel || !range) return;
    const active = { row: flat[range.ar].id, col: cols[range.ac].key };
    if (k === "Enter" || k === "F2") return (e.preventDefault(), startEdit(active.row, active.col));
    if (k === " " && cols[range.ac].type === "checkbox") return (e.preventDefault(), startEdit(active.row, active.col));
    if (k === " " && e.shiftKey) return (e.preventDefault(), setRecord(active.row));
    if (k === "Escape") return setSel({ a: sel.a, f: sel.a });
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

  const recordRow = record ? rows.find((r) => r.id === record) ?? null : null;
  const recordIndex = recordRow ? flat.findIndex((r) => r.id === recordRow.id) : -1;
  const editRow = editing ? rows.find((r) => r.id === editing.row) : undefined;
  const editCol = editing ? columns.find((c) => c.key === editing.col) : undefined;

  return (
    <div className={`${s.root} v3-focus`}>
      <Header rowsCount={base.length} sheetName={sheet.name} onNewRow={() => addRow(groups[0]?.key ?? "none", "")} />
      <Toolbar
        sheets={sheets}
        sheet={sheet}
        counts={Object.fromEntries(sheets.map((x) => [x.id, sheetRows(rows, x).length]))}
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
        onDelete={deleteChecked}
        onDuplicate={duplicateChecked}
        onMarkPaid={markPaidChecked}
        onClearChecked={() => setChecked(new Set())}
      />
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
        fillPreview={fillPreview}
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
        onOpen={setRecord}
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
      />
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
        onNewRow={() => setRecord(addRow(groups[0]?.key ?? "none", ""))}
        onExamplePaste={() => offerPaste(EXAMPLE_PASTE, groups[0]?.key ?? "all", null)}
        onToggleDone={(row) => {
          const r = rows.find((x) => x.id === row)!;
          setCells([{ row, col: "status", value: r.cells.status === "done" ? "todo" : "done" }]);
        }}
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
            focusGrid();
          }}
        />
      )}

      {paste && <PasteConfirm state={paste} columns={columns} onConfirm={confirmPaste} onCancel={() => setPaste(null)} />}
      {fill && fillPreview.size > 0 && range && (
        <div className={s.fillTip} style={{ left: fill.x + 16, top: fill.y + 14 }} aria-live="polite">
          <strong>{fillPreview.size} {fillPreview.size === 1 ? "cell" : "cells"}</strong>
          <span>{fill.copy ? "Copying the value" : cols[range.c0].type === "date" ? "A day apart" : "Following the pattern"}</span>
          <span className={s.fillTipHint}>{fill.copy ? "Let go of ⌥ to step" : "Hold ⌥ to copy instead"}</span>
        </div>
      )}
      <Toast toast={toast} onUndo={(snap) => undoTo(snap)} onClose={closeToast} />
    </div>
  );
}
