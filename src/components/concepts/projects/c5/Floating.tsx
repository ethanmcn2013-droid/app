"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import s from "./shell.module.css";

export type Anchor = { left: number; right: number; top: number; bottom: number };

export function anchorOf(el: Element): Anchor {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
}

/**
 * A popover pinned to an anchor rectangle. Portalled to the body because the
 * page panes are size containers, which trap fixed children. Below 600px it
 * becomes a bottom sheet with a scrim.
 */
export function Floating({
  anchor,
  onClose,
  children,
  label,
  width = 320,
  vars,
  side = "below",
}: {
  anchor: Anchor;
  onClose: () => void;
  children: ReactNode;
  label: string;
  width?: number;
  vars?: CSSProperties;
  side?: "below" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onScroll = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      if (window.innerWidth >= 600) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus], input, button");
    first?.focus({ preventScroll: true });
  }, []);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sheet = vw < 600;
  let style: CSSProperties = { ...vars };
  if (!sheet) {
    if (side === "right") {
      style = { ...style, width, left: Math.min(anchor.right + 8, vw - width - 12), top: Math.max(12, Math.min(anchor.top - 8, vh - 360)) };
    } else {
      const left = Math.max(12, Math.min(anchor.left - 8, vw - width - 12));
      const below = vh - anchor.bottom;
      style =
        below < 300 && anchor.top > below
          ? { ...style, width, left, bottom: vh - anchor.top + 8 }
          : { ...style, width, left, top: anchor.bottom + 8 };
    }
  }

  return createPortal(
    <>
      {sheet ? <div className={s.scrim} aria-hidden="true" /> : null}
      <div ref={ref} role="dialog" aria-label={label} className={sheet ? s.sheetPop : s.pop} style={style}>
        {sheet ? <div className={s.grabber} aria-hidden="true" /> : null}
        {children}
      </div>
    </>,
    document.body,
  );
}

export function Menu<T extends string>({
  items,
  value,
  onPick,
}: {
  items: { value: T; label: string; hint?: string; dot?: string; icon?: ReactNode }[];
  value?: T;
  onPick: (value: T) => void;
}) {
  return (
    <div className={s.menu} role="listbox">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="option"
          aria-selected={item.value === value}
          className={s.menuItem}
          data-autofocus={item.value === value ? "" : undefined}
          onClick={() => onPick(item.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const sib = (e.key === "ArrowDown"
                ? e.currentTarget.nextElementSibling
                : e.currentTarget.previousElementSibling) as HTMLElement | null;
              sib?.focus();
            }
          }}
        >
          {item.dot ? <span className={s.menuDot} style={{ background: item.dot }} /> : null}
          {item.icon ? <span className={s.menuIcon}>{item.icon}</span> : null}
          <span className={s.menuLabel}>{item.label}</span>
          {item.hint ? <span className={s.menuHint}>{item.hint}</span> : null}
          {item.value === value ? <span className={s.menuCheck}>✓</span> : null}
        </button>
      ))}
    </div>
  );
}
