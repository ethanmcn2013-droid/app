"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Row } from "./data";
import { toText, rowsFromPlan, type Column } from "./model";
import { Icon } from "./icons";
import type { PasteState } from "./index";
import s from "./sheet.module.css";

/* A light popover anchored to its positioned parent. Closes on an
   outside press or Escape. */
export function Popover({ children, className, onClose, align = "left", up }: { children: ReactNode; className?: string; onClose: () => void; align?: "left" | "right"; up?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const parent = ref.current?.parentElement;
      if (parent && !parent.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return (
    <div ref={ref} className={`${s.pop} ${className ?? ""}`} data-align={align} data-up={up || undefined} onKeyDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

const COL_W: Partial<Record<Column["type"], string>> = { title: "32%", text: "28%", currency: "13%", number: "12%", date: "16%", checkbox: "11%" };

export type ToastState = { id: number; text: string; undo?: Row[] };

export function Toast({ toast, onUndo, onClose }: { toast: ToastState | null; onUndo: (rows: Row[]) => void; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onClose, toast.undo ? 6000 : 2600);
    return () => window.clearTimeout(t);
  }, [toast, onClose]);
  return (
    <div className={s.toastDock} aria-live="polite">
      {toast && (
        <div key={toast.id} className={s.toast} role="status">
          <Icon name="check" size={14} className={s.toastTick} />
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              className={s.toastUndo}
              onClick={() => {
                onUndo(toast.undo!);
                onClose();
              }}
            >
              <Icon name="undo" size={14} />
              Undo
            </button>
          )}
          <button type="button" className={s.toastClose} onClick={onClose} aria-label="Dismiss">
            <Icon name="close" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

export function PasteConfirm({ state, columns, onConfirm, onCancel }: { state: PasteState; columns: Column[]; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { plan } = state;
  const preview = rowsFromPlan({ ...plan, body: plan.body.slice(0, 3) }, columns, state.base, state.table, 0);
  const mapped = plan.map.map((k) => columns.find((c) => c.key === k) ?? null);
  const used = mapped.filter((c): c is Column => !!c);
  const skipped = mapped.filter((c) => !c).length;
  const n = plan.body.length;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onCancel]);
  const width = 520;
  const anchored = state.x != null && state.y != null && typeof window !== "undefined";
  const style = anchored
    ? { left: Math.max(12, Math.min(state.x!, window.innerWidth - width - 12)), top: Math.max(12, Math.min(state.y!, window.innerHeight - 400)), width }
    : { left: "50%", top: "50%", width, transform: "translate(-50%, -50%)" };
  return (
    <>
      <div className={s.pasteScrim} onPointerDown={onCancel} aria-hidden />
      <div ref={ref} className={s.pasteCard} style={style} role="dialog" aria-modal aria-labelledby="c3-paste-title">
        <div className={s.pasteHead}>
          <span className={s.pasteIcon}>
            <Icon name="paste" size={16} />
          </span>
          <div>
            <h2 id="c3-paste-title" className={s.pasteTitle}>
              Add {n} {n === 1 ? "row" : "rows"}?
            </h2>
            <p className={s.pasteSub}>
              {plan.header ? "Matched your columns by name." : "No header row, so columns are filled in order."}
              {skipped > 0 && ` ${skipped} ${skipped === 1 ? "column has" : "columns have"} no match and will be left out.`}
            </p>
          </div>
        </div>
        <div className={s.mapRow}>
          {plan.map.map((k, i) => {
            const c = columns.find((x) => x.key === k);
            return (
              <span key={i} className={s.mapChip} data-skip={!c || undefined}>
                {plan.header && <span className={s.mapFrom}>{plan.header[i]}</span>}
                {plan.header && <Icon name="chevronRight" size={12} />}
                <span>{c ? c.name : "Left out"}</span>
              </span>
            );
          })}
        </div>
        <div className={s.pastePreview}>
          <table className={s.previewTable}>
            <thead>
              <tr>
                {used.map((c) => (
                  <th key={c.key} className={c.type === "currency" || c.type === "number" ? s.right : undefined} style={{ width: COL_W[c.type] ?? "18%" }}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.id}>
                  {used.map((c) => (
                    <td key={c.key} className={c.type === "currency" || c.type === "number" ? s.right : undefined}>
                      {toText(r.cells[c.key] ?? null, c) || "–"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {n > 3 && <p className={s.previewMore}>and {n - 3} more</p>}
        </div>
        <div className={s.pasteActions}>
          <button type="button" className={s.btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={s.btnAccent} onClick={onConfirm} autoFocus>
            Add {n} {n === 1 ? "row" : "rows"}
          </button>
        </div>
      </div>
    </>
  );
}
