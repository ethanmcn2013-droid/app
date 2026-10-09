"use client";

import type { ReactNode } from "react";
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
  onTidy,
  zoom,
  onHelp,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  mode: Mode;
  onTidy: () => void;
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
      <button type="button" className={`${s.tidyBtn} ${mode === "tidy" ? s.tidyBtnOn : ""}`} onClick={onTidy} aria-pressed={mode === "tidy"}>
        {mode === "tidy" ? <Icon.scatter size={16} /> : <Icon.tidy size={16} />}
        <span>{mode === "tidy" ? "Back to wall" : "Tidy"}</span>
        <kbd className={s.kbd}>T</kbd>
      </button>
      <ToolButton label="Keyboard shortcuts" kbd="?" onClick={onHelp}>
        <Icon.keyboard size={17} />
      </ToolButton>
    </div>
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
