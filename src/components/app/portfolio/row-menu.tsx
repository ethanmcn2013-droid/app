"use client";

/**
 * The ⋯ action menu (Timeline v3, round 2).
 *
 * The discoverable home of each page's keyboard grammar: every row action is
 * listed with its shortcut. It opens from a visible ⋯ button, from "." or
 * Shift+F10 on the focused row, or from a right-click at the pointer.
 *
 * `role="menu"` with roving focus (↑ ↓ Home End), typeahead on letters,
 * Enter or Space to choose, and Escape or Tab to close. Focus returns to
 * whatever opened it before the chosen action runs, so an action that moves
 * focus on purpose (rename) still wins.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Kbd } from "./timeline-ui";
import styles from "./timeline-ui.module.css";

export type RowMenuAction = Readonly<{
  id: string;
  label: string;
  onSelect: () => void;
  /** Shortcut keys shown on the right, e.g. ["E"] or ["Alt", "↑"]. */
  hint?: readonly string[];
  icon?: ReactNode;
  disabled?: boolean;
  tone?: "danger";
  /** The option that is open now: ticked, and focused first. */
  current?: boolean;
}>;

export type RowMenuEntry =
  | RowMenuAction
  | Readonly<{ id: string; separator: true }>
  | Readonly<{ id: string; heading: string }>;

/** A point (right-click) or the rect of the button that opened it. */
export type RowMenuAnchor = Readonly<{ x: number; y: number }> | DOMRect;

export type RowMenuState = Readonly<{
  anchor: RowMenuAnchor;
  items: readonly RowMenuEntry[];
  label: string;
  /** Where focus goes when the menu closes. */
  returnTo: HTMLElement | null;
}>;

function isAction(entry: RowMenuEntry): entry is RowMenuAction {
  return !("separator" in entry) && !("heading" in entry);
}

export function RowMenu({ state, onClose }: { state: RowMenuState | null; onClose: () => void }) {
  if (!state || typeof document === "undefined") return null;
  return createPortal(<OpenRowMenu state={state} onClose={onClose} />, document.body);
}

function OpenRowMenu({ state, onClose }: { state: RowMenuState; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const actions = state.items.filter(isAction);
  const enabled = actions.map((action, index) => (action.disabled ? -1 : index)).filter((index) => index >= 0);
  const currentIndex = actions.findIndex((action) => action.current && !action.disabled);
  const [active, setActive] = useState(currentIndex >= 0 ? currentIndex : (enabled[0] ?? 0));
  const typed = useRef({ text: "", at: 0 });
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Place it before paint: below-right of a button, at a point for a
  // right-click, flipped to stay inside the viewport.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const anchor = state.anchor;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top: number;
    if ("width" in anchor) {
      left = anchor.right - width;
      if (left < 8) left = anchor.left;
      top = anchor.bottom + 4;
      if (top + height > vh - 8) top = anchor.top - height - 4;
    } else {
      left = anchor.x;
      top = anchor.y;
      if (left + width > vw - 8) left = anchor.x - width;
      if (top + height > vh - 8) top = anchor.y - height;
    }
    menu.style.left = `${Math.round(Math.max(8, Math.min(vw - width - 8, left)))}px`;
    menu.style.top = `${Math.round(Math.max(8, Math.min(vh - height - 8, top)))}px`;
    menu.style.visibility = "visible";
  }, [state.anchor]);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.focus({ preventScroll: true });
  }, [active]);

  useEffect(() => {
    function onDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) close(false);
    }
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
    // `close` only reads refs and the state captured at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close(restore = true) {
    if (restore && state.returnTo?.isConnected) state.returnTo.focus({ preventScroll: true });
    onCloseRef.current();
  }

  function choose(action: RowMenuAction) {
    if (action.disabled) return;
    close(true);
    action.onSelect();
  }

  function step(delta: number) {
    if (enabled.length === 0) return;
    const at = enabled.indexOf(active);
    setActive(enabled[(at + delta + enabled.length) % enabled.length]);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    event.stopPropagation();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        step(1);
        return;
      case "ArrowUp":
        event.preventDefault();
        step(-1);
        return;
      case "Home":
        event.preventDefault();
        setActive(enabled[0] ?? 0);
        return;
      case "End":
        event.preventDefault();
        setActive(enabled[enabled.length - 1] ?? 0);
        return;
      case "Escape":
        event.preventDefault();
        close(true);
        return;
      case "Tab":
        event.preventDefault();
        close(true);
        return;
      case "Enter":
      case " ": {
        event.preventDefault();
        const action = actions[active];
        if (action) choose(action);
        return;
      }
    }
    if (event.key.length === 1 && /\S/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      const text = (now - typed.current.at < 600 ? typed.current.text : "") + event.key.toLowerCase();
      typed.current = { text, at: now };
      const order = [...enabled.slice(enabled.indexOf(active) + (text.length === 1 ? 1 : 0)), ...enabled];
      const match = order.find((index) => actions[index].label.toLowerCase().startsWith(text));
      if (match !== undefined) setActive(match);
    }
  }

  let actionIndex = -1;
  return (
    <div
      ref={menuRef}
      id={id}
      role="menu"
      aria-label={state.label}
      className={styles.menu}
      style={{ visibility: "hidden", left: 0, top: 0 }}
      onKeyDown={onKeyDown}
      data-row-menu=""
    >
      {state.items.map((entry) => {
        if ("heading" in entry) {
          return (
            <p key={entry.id} role="presentation" className={styles.menuHeading}>
              {entry.heading}
            </p>
          );
        }
        if (!isAction(entry)) return <div key={entry.id} role="separator" className={styles.menuSeparator} />;
        actionIndex += 1;
        const index = actionIndex;
        return (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            tabIndex={index === active ? 0 : -1}
            aria-disabled={entry.disabled || undefined}
            data-index={index}
            data-active={index === active ? "" : undefined}
            data-tone={entry.tone}
            aria-current={entry.current ? "page" : undefined}
            className={styles.menuItem}
            onPointerMove={() => {
              if (!entry.disabled && index !== active) setActive(index);
            }}
            onClick={() => choose(entry)}
          >
            {entry.icon ? <span className={styles.menuItemIcon}>{entry.icon}</span> : null}
            <span className={styles.menuItemLabel}>{entry.label}</span>
            {entry.current ? (
              <svg className={styles.menuCheck} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-label="Open now">
                <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
            {entry.hint?.length ? (
              <span className={styles.menuHint} aria-hidden="true">
                {entry.hint.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The visible ⋯ button that opens a row's menu. Kept separate so each page
 * decides what the menu holds; this only reports where it was pressed.
 */
export function RowMenuButton({
  label,
  onOpen,
  className,
  tabIndex,
  expanded,
}: {
  label: string;
  onOpen: (anchor: DOMRect, button: HTMLButtonElement) => void;
  className?: string;
  tabIndex?: number;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={expanded ?? false}
      tabIndex={tabIndex}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(event.currentTarget.getBoundingClientRect(), event.currentTarget);
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <circle cx="3.5" cy="8" r="1.3" />
        <circle cx="8" cy="8" r="1.3" />
        <circle cx="12.5" cy="8" r="1.3" />
      </svg>
    </button>
  );
}
