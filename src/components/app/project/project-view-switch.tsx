"use client";

/**
 * The view switcher for Projects, top right: Console or Cards. A menu button
 * with radio items, so arrow keys, Home, End and Escape work and the current
 * view is announced as checked.
 */

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { ConsoleView } from "@/lib/projects/project-console";
import v from "./project-view-switch.module.css";

const VIEWS: ReadonlyArray<{ id: ConsoleView; label: string; hint: string; icon: ReactNode }> = [
  {
    id: "console",
    label: "Console",
    hint: "Every project’s figures, in rows",
    icon: (
      <>
        <path d="M2 3.5h4M2 8h4M2 12.5h4" />
        <path d="M8.5 3.5h5.5M8.5 8h3.5M8.5 12.5h5" />
      </>
    ),
  },
  {
    id: "cards",
    label: "Cards",
    hint: "A card for each project",
    icon: (
      <>
        <rect x="2" y="2.5" width="5.25" height="5" rx="1.2" />
        <rect x="8.75" y="2.5" width="5.25" height="5" rx="1.2" />
        <path d="M2 10.5h5.25M8.75 10.5H14M2 13h3.5M8.75 13h3.5" />
      </>
    ),
  },
];

export function ProjectViewSwitch({ view, onPick }: { view: ConsoleView; onPick: (view: ConsoleView) => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const current = VIEWS.find((x) => x.id === view) ?? VIEWS[0]!;

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onDown = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !btn.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const els = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const at = els.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      els[(at + (event.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? els[0] : els[els.length - 1])?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  return (
    <span className={v.anchor}>
      <button
        ref={btn}
        type="button"
        className={v.button}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`View: ${current.label}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          {current.icon}
        </svg>
        <span className={v.label}>{current.label}</span>
        <svg className={v.chevron} width={12} height={12} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <div ref={menu} className={v.menu} role="menu" aria-label="View" onKeyDown={onMenuKey}>
          {VIEWS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="menuitemradio"
              aria-checked={x.id === view}
              tabIndex={-1}
              className={v.item}
              onClick={() => {
                close();
                if (x.id !== view) onPick(x.id);
              }}
            >
              <svg className={v.itemIcon} width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                {x.icon}
              </svg>
              <span className={v.itemText}>
                <span className={v.itemLabel}>{x.label}</span>
                <span className={v.itemHint}>{x.hint}</span>
              </span>
              <svg className={v.check} width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="m3.5 8.25 3 3 6-6.5" />
              </svg>
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
