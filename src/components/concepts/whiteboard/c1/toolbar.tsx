"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TEMPLATES, type TidyTemplate } from "./data";
import type { Mode } from "./geometry";
import { Icon } from "./icons";
import type { Tool, ZoomApi } from "./wall";
import s from "./wall.module.css";

const TOOLS: { key: Tool; label: string; kbd: string; icon: ReactNode }[] = [
  { key: "select", label: "Select", kbd: "V", icon: <Icon.select size={17} /> },
  { key: "hand", label: "Move around", kbd: "H", icon: <Icon.hand size={17} /> },
  { key: "label", label: "Label", kbd: "L", icon: <Icon.label size={17} /> },
  { key: "arrow", label: "Depends on arrow", kbd: "A", icon: <Icon.arrow size={17} /> },
];

export function FloatingToolbar({
  tool,
  setTool,
  mode,
  template,
  onTidy,
  onBack,
  onTemplate,
  zoom,
  onHelp,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  mode: Mode;
  template: TidyTemplate;
  /** Tidy the wall into columns from a template. */
  onTidy: (t: TidyTemplate) => void;
  /** Return every note to where it was on the wall. */
  onBack: () => void;
  /** Switch template while tidied. */
  onTemplate: (t: TidyTemplate) => void;
  zoom: ZoomApi;
  onHelp: () => void;
}) {
  const wallOnly = mode === "tidy";
  return (
    <div className={s.toolbar} role="toolbar" aria-label="Wall tools" data-chrome="">
      <div className={s.toolGroup}>
        {TOOLS.slice(0, 2).map((t) => (
          <ToolButton key={t.key} active={tool === t.key} label={t.label} kbd={t.kbd} onClick={() => setTool(t.key)}>
            {t.icon}
          </ToolButton>
        ))}
        <button
          type="button"
          className={`${s.padTool} ${tool === "note" ? s.padToolOn : ""}`}
          aria-pressed={tool === "note"}
          aria-label="New note (N)"
          title={wallOnly ? "Back to the wall to add notes freely" : "New note  N"}
          disabled={wallOnly}
          onClick={() => setTool(tool === "note" ? "select" : "note")}
        >
          <span className={s.padToolBack} aria-hidden="true" />
          <span className={s.padToolMid} aria-hidden="true" />
          <span className={s.padToolFront} aria-hidden="true">
            <Icon.plus size={14} strokeWidth={2} />
          </span>
        </button>
        {TOOLS.slice(2).map((t) => (
          <ToolButton
            key={t.key}
            active={tool === t.key}
            label={t.label}
            kbd={t.kbd}
            disabled={wallOnly}
            onClick={() => setTool(tool === t.key ? "select" : t.key)}
          >
            {t.icon}
          </ToolButton>
        ))}
      </div>
      <span className={s.toolSep} />
      <div className={s.toolGroup}>
        <ToolButton label="Zoom out" kbd="−" onClick={zoom.zoomOut} disabled={zoom.scale <= 0.501}>
          <Icon.zoomOut size={16} />
        </ToolButton>
        <button type="button" className={s.zoomValue} onClick={zoom.zoomReset} title="Reset to 100%  0" aria-label={`Zoom ${Math.round(zoom.scale * 100)} percent. Reset to 100 percent.`}>
          {Math.round(zoom.scale * 100)}%
        </button>
        <ToolButton label="Zoom in" kbd="+" onClick={zoom.zoomIn} disabled={zoom.scale >= 1.499}>
          <Icon.zoomIn size={16} />
        </ToolButton>
        <ToolButton label="Fit everything" kbd="Shift 1" onClick={zoom.fit}>
          <Icon.fit size={16} />
        </ToolButton>
      </div>
      <span className={s.toolSep} />
      {mode === "tidy" ? (
        <>
          <div className={s.templateSwitch} role="radiogroup" aria-label="Columns">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={template === t.key}
                className={`${s.templateOpt} ${template === t.key ? s.templateOptOn : ""}`}
                onClick={() => onTemplate(t.key)}
              >
                {t.short}
              </button>
            ))}
          </div>
          <button type="button" className={`${s.tidyBtn} ${s.tidyBtnOn}`} onClick={onBack}>
            <Icon.scatter size={16} />
            <span>Back to the wall</span>
            <kbd className={s.kbd}>T</kbd>
          </button>
        </>
      ) : (
        <TidyMenu template={template} onPick={onTidy} />
      )}
      <ToolButton label="Keyboard shortcuts" kbd="?" onClick={onHelp}>
        <Icon.keyboard size={17} />
      </ToolButton>
    </div>
  );
}

/** Tidy is a choice, not a mode the wall lives in: pick which columns to arrange into. */
function TidyMenu({ template, onPick }: { template: TidyTemplate; onPick: (t: TidyTemplate) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    const first = Math.max(0, TEMPLATES.findIndex((t) => t.key === template));
    items.current[first]?.focus();
    return () => document.removeEventListener("pointerdown", away);
  }, [open, template]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className={s.tidyWrap} ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className={s.tidyBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Tidy into columns"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon.tidy size={16} />
        <span>Tidy</span>
        <Icon.chevronDown size={14} className={s.tidyChevron} />
      </button>
      {open ? (
        <div
          className={s.tidyMenu}
          role="menu"
          aria-label="Tidy into columns"
          onKeyDown={(e) => {
            const i = items.current.findIndex((el) => el === document.activeElement);
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const n = TEMPLATES.length;
              items.current[(i + (e.key === "ArrowDown" ? 1 : n - 1)) % n]?.focus();
            }
          }}
        >
          <p className={s.tidyMenuHead}>Tidy into columns</p>
          {TEMPLATES.map((t, i) => (
            <button
              key={t.key}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="menuitem"
              className={s.pickerItem}
              onClick={() => {
                setOpen(false);
                onPick(t.key);
              }}
            >
              <TemplateGlyph template={t.key} />
              <span className={s.pickerText}>
                <span className={s.pickerName}>{t.name}</span>
                <span className={s.pickerMeta}>{t.hint}</span>
              </span>
              {t.key === template ? <kbd className={s.kbd}>T</kbd> : null}
            </button>
          ))}
          <p className={s.tidyMenuFoot}>Back to the wall puts every note where it was.</p>
        </div>
      ) : null}
    </div>
  );
}

/** A tiny picture of the columns each template makes. */
function TemplateGlyph({ template }: { template: TidyTemplate }) {
  const cols = template === "groups" ? [3, 2, 3] : [3, 2, 2, 1, 2];
  const w = template === "groups" ? 9 : 5.4;
  return (
    <svg className={s.templateGlyph} width="36" height="28" viewBox="0 0 36 28" aria-hidden="true">
      {cols.map((n, c) =>
        Array.from({ length: n }).map((_, r) => (
          <rect key={`${c}-${r}`} x={2 + c * (w + 2)} y={3 + r * 7.5} width={w} height={6} rx={1.5} className={template === "groups" ? s[`glyphTone${c}`] : s.glyphPlain} />
        )),
      )}
    </svg>
  );
}

function ToolButton({
  active,
  label,
  kbd,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  kbd: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${s.toolBtn} ${active ? s.toolBtnOn : ""}`}
      aria-label={`${label} (${kbd})`}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      data-tip={`${label}  ${kbd}`}
    >
      {children}
    </button>
  );
}
