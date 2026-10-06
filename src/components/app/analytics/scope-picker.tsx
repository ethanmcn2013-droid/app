"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import styles from "./analytics.module.css";

/**
 * The scope beside the title: every project the reader can open, or one of
 * them. Each choice is a plain link, so the scope lives in the address. One
 * button, one menu: Down or Enter opens it, Up and Down walk it, Escape or a
 * click elsewhere closes it and focus goes back to the button.
 */

export type ScopeOption = Readonly<{ key: string; href: string; label: string; note?: string; current: boolean }>;

export function ScopePicker({ label, note, options }: { label: string; note?: string; options: readonly ScopeOption[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    const items = wrapRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]");
    const current = [...(items ?? [])].find((item) => item.getAttribute("aria-current") === "true") ?? items?.[0];
    current?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function close(restore: boolean) {
    setOpen(false);
    if (restore) buttonRef.current?.focus();
  }

  function onMenuKey(event: React.KeyboardEvent) {
    const items = [...(wrapRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(at + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(at - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items.at(-1)?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  // One project and nothing to switch to: the scope is a label, not a control.
  if (options.length < 2) {
    return (
      <span className={styles.scope}>
        <i aria-hidden="true" />
        <span className={styles.scopeName}>{label}</span>
        {note ? <span className={styles.scopeNote}>{note}</span> : null}
      </span>
    );
  }

  return (
    <div ref={wrapRef} className={styles.scopeWrap}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.scope}
        data-button=""
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Showing ${label}. Change what Analytics covers`}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <i aria-hidden="true" />
        <span className={styles.scopeName}>{label}</span>
        {note ? <span className={styles.scopeNote}>{note}</span> : null}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label="What Analytics covers" className={`${styles.scopeMenu} thin-scroll`} onKeyDown={onMenuKey}>
          {options.map((option) => (
            <Link
              key={option.key}
              href={option.href}
              role="menuitem"
              className={styles.scopeItem}
              aria-current={option.current ? "true" : undefined}
              scroll={false}
              onClick={() => setOpen(false)}
            >
              <span className={styles.scopeItemName}>{option.label}</span>
              {option.note ? <span className={styles.scopeItemNote}>{option.note}</span> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
