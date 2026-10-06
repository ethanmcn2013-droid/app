"use client";

import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  KIND_GROUP,
  KIND_LABEL,
  KIND_ORDER,
  searchStepTypes,
  stepType,
  type StepKind,
} from "@/lib/automations/catalogue";
import {
  STEP_W,
  boundsOf,
  describeStep,
  nextStepsLabel,
  stepHeight,
  type Point,
  type Rect,
  type Size,
  type Step,
  type View,
} from "@/lib/automations/graph";
import { AutoIcon, type IconName } from "./automation-icons";
import styles from "./automations.module.css";

/**
 * A control that is shown but cannot be used yet. It stays focusable so the
 * reason is reachable by keyboard and by touch, and it says why in a line
 * that appears on hover and on focus. It never looks like it did something.
 */
export function Soon({
  why,
  className,
  children,
  label,
  side = "bottom",
  align = "center",
}: {
  why: string;
  className?: string;
  children: ReactNode;
  label?: string;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  const id = useId();
  return (
    <span className={styles.soon} data-side={side} data-align={align}>
      <button type="button" className={className} aria-disabled="true" aria-label={label} aria-describedby={id} data-soon="">
        {children}
      </button>
      <span role="tooltip" id={id} className={styles.tip}>
        <b>Coming soon.</b> {why}
      </span>
    </span>
  );
}

// ── A step on the canvas ───────────────────────────────────────────────

export const StepCard = memo(function StepCard({
  step,
  x,
  y,
  selected,
  fresh,
  lifted,
  wire,
  nexts,
  onEdit,
  onFocusStep,
}: {
  step: Step;
  x: number;
  y: number;
  selected: boolean;
  fresh: boolean;
  lifted: boolean;
  /** While a line is being drawn: may it end here? */
  wire: "yes" | "no" | "aim" | null;
  nexts: number;
  onEdit: (id: string) => void;
  onFocusStep: (id: string, keyboard: boolean) => void;
}) {
  const icon = stepType(step.type)?.icon ?? "split";
  const line = describeStep(step);
  const next = nextStepsLabel(nexts);
  return (
    <div
      className={styles.step}
      data-step-id={step.id}
      data-kind={step.kind}
      data-selected={selected ? "" : undefined}
      data-fresh={fresh ? "" : undefined}
      data-lifted={lifted ? "" : undefined}
      data-wire={wire ?? undefined}
      style={{ left: x, top: y, height: stepHeight(step) }}
      role="group"
      tabIndex={0}
      aria-label={`${KIND_LABEL[step.kind]}: ${step.title}. ${line}. ${next}.${step.note ? " Has a note." : ""}`}
      aria-describedby="automation-step-keys"
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocusStep(step.id, event.currentTarget.matches(":focus-visible"));
      }}
    >
      {step.kind !== "trigger" ? <span className={styles.portIn} aria-hidden="true" /> : null}
      <div className={styles.stepHead}>
        <span className={styles.tile} aria-hidden="true">
          <AutoIcon name={icon} />
        </span>
        <span className={styles.stepText}>
          <span className={styles.kind}>{KIND_LABEL[step.kind]}</span>
          <span className={styles.stepTitle}>{step.title}</span>
        </span>
      </div>
      <p className={styles.stepLine}>{line}</p>
      {step.kind === "branch" ? (
        <ul className={styles.paths}>
          {step.conditions.map((condition) => (
            <li key={condition.id} className={styles.pathRow}>
              <span>{condition.label}</span>
              <span className={styles.portOut} data-port={condition.id} aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : (
        <span className={styles.portOut} data-port="out" aria-hidden="true" />
      )}
      <div className={styles.stepFoot}>
        <span className={styles.chip}>{next}</span>
        {step.note ? (
          <span className={styles.noteMark} aria-hidden="true">
            <AutoIcon name="note" size={14} />
          </span>
        ) : null}
        <button type="button" className={styles.stepButton} tabIndex={-1} aria-label={`Edit ${step.title}`} onClick={() => onEdit(step.id)}>
          <AutoIcon name="edit" size={14} />
        </button>
      </div>
    </div>
  );
});

// ── The picker: find a step by name and place it ───────────────────────

export function StepPicker({
  heading,
  kinds,
  style,
  onPick,
  onClose,
}: {
  heading: string;
  kinds: readonly StepKind[];
  style?: CSSProperties;
  onPick: (typeId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => searchStepTypes(query, kinds), [query, kinds]);
  const current = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onClose]);

  useEffect(() => {
    rootRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  return (
    <div
      ref={rootRef}
      className={styles.picker}
      style={style}
      role="dialog"
      aria-label={heading}
      data-own-keys=""
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          setActive(results.length === 0 ? 0 : (current + 1) % results.length);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setActive(results.length === 0 ? 0 : (current - 1 + results.length) % results.length);
        } else if (event.key === "Enter") {
          event.preventDefault();
          const chosen = results[current];
          if (chosen) onPick(chosen.id);
        }
      }}
    >
      <div className={styles.pickerHead}>{heading}</div>
      <label className={styles.pickerSearch}>
        <AutoIcon name="search" size={14} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Find a step"
          aria-label="Find a step"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[current] ? `${listId}-${results[current].id}` : undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
        />
      </label>
      <div className={`${styles.pickerList} thin-scroll`} id={listId} role="listbox" aria-label="Steps" data-scrolls="">
        {results.length === 0 ? (
          <p className={styles.pickerEmpty}>No step by that name. Try &ldquo;task&rdquo;, &ldquo;date&rdquo; or &ldquo;chat&rdquo;.</p>
        ) : (
          KIND_ORDER.filter((kind) => results.some((type) => type.kind === kind)).map((kind) => (
            <div key={kind} role="group" aria-label={KIND_GROUP[kind]}>
              <div className={styles.pickerGroup} aria-hidden="true">{KIND_GROUP[kind]}</div>
              {results.map((type, index) =>
                type.kind === kind ? (
                  <div
                    key={type.id}
                    id={`${listId}-${type.id}`}
                    role="option"
                    aria-selected={index === current}
                    data-index={index}
                    data-kind={type.kind}
                    className={styles.pickerItem}
                    onPointerMove={() => setActive(index)}
                    onClick={() => onPick(type.id)}
                  >
                    <span className={styles.tile} aria-hidden="true">
                      <AutoIcon name={type.icon} />
                    </span>
                    <span className={styles.pickerText}>
                      <span>{type.title}</span>
                      <span>{type.summary(type.defaults)}</span>
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── A small menu ───────────────────────────────────────────────────────

export type MenuItem = Readonly<{
  id: string;
  label: string;
  icon: IconName;
  danger?: boolean;
  /** Asked before the item acts ("Delete it for good?"). */
  confirm?: string;
  onSelect: () => void;
}>;

export function AutoMenu({ label, items, className, align = "end" }: { label: string; items: readonly MenuItem[]; className?: string; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = (refocus: boolean) => {
    setOpen(false);
    setAsking(null);
    if (refocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setAsking(null);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    rootRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const move = (delta: number | "first" | "last") => {
    const entries = [...(rootRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [])];
    if (entries.length === 0) return;
    const at = entries.indexOf(document.activeElement as HTMLElement);
    const next = delta === "first" ? 0 : delta === "last" ? entries.length - 1 : (at + delta + entries.length) % entries.length;
    entries[next]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={styles.menuRoot}
      data-own-keys=""
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        } else if (event.key === "Home") {
          event.preventDefault();
          move("first");
        } else if (event.key === "End") {
          event.preventDefault();
          move("last");
        } else if (event.key === "Tab") {
          close(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setAsking(null);
          setOpen((value) => !value);
        }}
      >
        <AutoIcon name="more" />
      </button>
      {open ? (
        <div className={styles.menu} role="menu" aria-label={label} data-align={align}>
          {items.map((item) =>
            asking === item.id ? (
              <div key={item.id} className={styles.menuAsk} role="group" aria-label={item.confirm}>
                <span>{item.confirm}</span>
                <span className={styles.menuAskRow}>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuAskYes}
                    autoFocus
                    onClick={() => {
                      close(false);
                      item.onSelect();
                    }}
                  >
                    Delete
                  </button>
                  <button type="button" role="menuitem" className={styles.menuAskNo} onClick={() => setAsking(null)}>
                    Keep it
                  </button>
                </span>
              </div>
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={styles.menuItem}
                data-danger={item.danger ? "" : undefined}
                onClick={() => {
                  if (item.confirm) {
                    setAsking(item.id);
                    return;
                  }
                  close(true);
                  item.onSelect();
                }}
              >
                <AutoIcon name={item.icon} />
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── The map in the corner ──────────────────────────────────────────────

const MAP_W = 168;
const MAP_H = 104;

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/**
 * Every step as a small block, and a frame for the part of the canvas on
 * screen. Press or drag anywhere on it to look there. Pointer only: with
 * the keyboard, Tab walks the steps and the arrow keys move the canvas.
 */
export function Minimap({
  steps,
  selection,
  view,
  size,
  onLook,
}: {
  steps: readonly Step[];
  selection: readonly string[];
  view: View;
  size: Size;
  onLook: (centre: Point) => void;
}) {
  // While dragging, the map holds still; otherwise it would rescale under
  // the pointer as the frame moves.
  const [held, setHeld] = useState<Rect | null>(null);
  const frame: Rect = { x: -view.x / view.k, y: -view.y / view.k, w: size.w / view.k, h: size.h / view.k };
  const content = boundsOf(steps);
  const natural = content ? union(content, frame) : frame;
  const region = held ?? { x: natural.x - 48, y: natural.y - 48, w: natural.w + 96, h: natural.h + 96 };
  const scale = Math.min(MAP_W / region.w, MAP_H / region.h);
  const ox = (MAP_W - region.w * scale) / 2 - region.x * scale;
  const oy = (MAP_H - region.h * scale) / 2 - region.y * scale;

  const look = (event: ReactPointerEvent<SVGSVGElement>, within: Rect) => {
    const box = event.currentTarget.getBoundingClientRect();
    const s = Math.min(MAP_W / within.w, MAP_H / within.h);
    const left = (MAP_W - within.w * s) / 2 - within.x * s;
    const top = (MAP_H - within.h * s) / 2 - within.y * s;
    onLook({ x: (event.clientX - box.left - left) / s, y: (event.clientY - box.top - top) / s });
  };

  return (
    <div className={styles.minimap} aria-hidden="true">
      <svg
        width={MAP_W}
        height={MAP_H}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setHeld(region);
          look(event, region);
        }}
        onPointerMove={(event) => {
          if (held) look(event, held);
        }}
        onPointerUp={() => setHeld(null)}
        onPointerCancel={() => setHeld(null)}
      >
        {steps.map((step) => (
          <rect
            key={step.id}
            className={styles.mapStep}
            data-kind={step.kind}
            data-selected={selection.includes(step.id) ? "" : undefined}
            x={step.x * scale + ox}
            y={step.y * scale + oy}
            width={Math.max(3, STEP_W * scale)}
            height={Math.max(2, stepHeight(step) * scale)}
            rx={1.5}
          />
        ))}
        <rect
          className={styles.mapFrame}
          x={frame.x * scale + ox}
          y={frame.y * scale + oy}
          width={Math.max(6, frame.w * scale)}
          height={Math.max(6, frame.h * scale)}
          rx={3}
        />
      </svg>
    </div>
  );
}
