"use client";

/**
 * The one view switcher for Projects, top right: Console, Covers or List.
 * A menu button with radio items, so arrow keys, Home, End and Escape work
 * and the current view is announced as checked.
 */

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import v from "./view-switch.module.css";

export type Lens = "console" | "covers" | "ledger";

const VIEWS: { id: Lens; label: string; hint: string; icon: ReactNode }[] = [
  {
    id: "console",
    label: "Console",
    hint: "Every project's figures, in rows",
    icon: (
      <>
        <path d="M2 3.5h4M2 8h4M2 12.5h4" />
        <path d="M8.5 3.5h5.5M8.5 8h3.5M8.5 12.5h5" />
      </>
    ),
  },
  {
    id: "covers",
    label: "Covers",
    hint: "A cover for each project",
    icon: (
      <>
        <rect x="2" y="2.5" width="5.25" height="5" rx="1.2" />
        <rect x="8.75" y="2.5" width="5.25" height="5" rx="1.2" />
        <path d="M2 10.5h5.25M8.75 10.5H14M2 13h3.5M8.75 13h3.5" />
      </>
    ),
  },
  {
    id: "ledger",
    label: "List",
    hint: "A table to sort, compare and change",
    icon: (
      <>
        <path d="M2 3.5h12M2 8h12M2 12.5h12" />
        <path d="M6 3.5v9" />
      </>
    ),
  },
];


export function ViewSwitch({ lens, onPick, wide }: { lens: Lens; onPick: (lens: Lens) => void; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const current = VIEWS.find((x) => x.id === lens) ?? VIEWS[0];

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const els = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const at = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      els[(at + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      (e.key === "Home" ? els[0] : els[els.length - 1])?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <span className={v.anchor} data-wide={wide || undefined}>
      <button
        ref={btn}
        type="button"
        className={v.button}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`View: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
            e.preventDefault();
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
              aria-checked={x.id === lens}
              tabIndex={-1}
              className={v.item}
              onClick={() => {
                close();
                if (x.id !== lens) onPick(x.id);
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
