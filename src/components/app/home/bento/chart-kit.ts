"use client";

/**
 * Home's small client kit: one shared tooltip, keyboard reading for the
 * charts (roving focus with the arrow keys), and the number roll.
 */

import { useCallback, useEffect, useRef } from "react";
import styles from "./home-bento.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const utc = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
/** "Fri 6 Nov" */
export const shortDay = (iso: string) => {
  const d = utc(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
/** "6 Nov" */
export const dayMonth = (iso: string) => {
  const d = utc(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
export const monthOf = (iso: string) => MONTHS[utc(iso).getUTCMonth()]!;
export const yearOf = (iso: string) => utc(iso).getUTCFullYear();
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── Tooltip ───────────────────────────────────────────────────────────────

let tipEl: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let openTimer: ReturnType<typeof setTimeout> | undefined;
let coolTimer: ReturnType<typeof setTimeout> | undefined;
let warm = false;

function tip(): HTMLDivElement {
  if (!tipEl || !tipEl.isConnected) {
    tipEl = document.createElement("div");
    tipEl.className = styles.tip ?? "";
    tipEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

/** Shows the label above `el` (below when there is no room). Warm: no delay once one is showing. */
export function showTip(el: Element, text: string, now = false) {
  clearTimeout(hideTimer);
  clearTimeout(openTimer);
  clearTimeout(coolTimer);
  const go = () => {
    const t = tip();
    t.textContent = text;
    const r = el.getBoundingClientRect();
    const w = t.offsetWidth;
    const h = t.offsetHeight;
    t.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    t.style.top = `${r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8}px`;
    t.dataset.on = "";
    warm = true;
  };
  if (warm || now) go();
  else openTimer = setTimeout(go, 110);
}

export function hideTip(now = false) {
  clearTimeout(openTimer);
  clearTimeout(hideTimer);
  const off = () => {
    if (tipEl) delete tipEl.dataset.on;
    coolTimer = setTimeout(() => {
      warm = false;
    }, 300);
  };
  if (now) off();
  else hideTimer = setTimeout(off, 60);
}

/** Hover labels for any `[data-tip]` inside the returned ref; hidden on scroll and resize. */
export function useHoverTips<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const over = (e: Event) => {
      const el = (e.target as Element).closest?.("[data-tip]");
      if (el && root.contains(el)) showTip(el, (el as HTMLElement).dataset.tip ?? "");
      else hideTip();
    };
    const leave = () => hideTip();
    const now = () => hideTip(true);
    root.addEventListener("mouseover", over);
    root.addEventListener("mouseleave", leave);
    window.addEventListener("scroll", now, true);
    window.addEventListener("resize", now);
    return () => {
      root.removeEventListener("mouseover", over);
      root.removeEventListener("mouseleave", leave);
      window.removeEventListener("scroll", now, true);
      window.removeEventListener("resize", now);
      hideTip(true);
    };
  }, []);
  return ref;
}

// ── Roving keyboard reading ───────────────────────────────────────────────

/**
 * Arrow keys move through `[data-tip]` children of a focusable group; each
 * move shows the label and is spoken once through `speak`. Escape hides it.
 */
export function useRove(steps: Readonly<{ right: number; down: number }>, speak: (text: string) => void) {
  const index = useRef(-1);
  const set = useCallback(
    (box: HTMLElement, i: number, say: boolean) => {
      const items = [...box.querySelectorAll<HTMLElement>("[data-tip]")];
      if (items.length === 0) return;
      index.current = Math.max(0, Math.min(items.length - 1, i));
      items.forEach((x) => delete x.dataset.active);
      const el = items[index.current]!;
      el.dataset.active = "";
      el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      showTip(el, el.dataset.tip ?? "", true);
      if (say) speak(el.dataset.tip ?? "");
    },
    [speak],
  );
  const props = {
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const box = e.currentTarget;
      const items = [...box.querySelectorAll<HTMLElement>("[data-tip]")];
      const today = items.findIndex((x) => "today" in x.dataset);
      set(box, index.current >= 0 ? index.current : today >= 0 ? today : items.length - 1, false);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      e.currentTarget.querySelectorAll<HTMLElement>("[data-active]").forEach((x) => delete x.dataset.active);
      hideTip(true);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape") {
        hideTip(true);
        return;
      }
      const move = { ArrowRight: steps.right, ArrowLeft: -steps.right, ArrowDown: steps.down, ArrowUp: -steps.down, Home: -1e4, End: 1e4 }[e.key];
      if (move === undefined) return;
      e.preventDefault();
      set(e.currentTarget, index.current + move, true);
    },
  };
  const reset = () => {
    index.current = -1;
  };
  return { props, reset };
}

// ── Number roll ───────────────────────────────────────────────────────────

/** Counts `el` from `from` to `to`; cancellable, and instant under reduced motion. */
export function rollNumber(el: HTMLElement, to: number, from: number, delay = 0, duration = 450): () => void {
  if (prefersReducedMotion() || from === to) {
    el.textContent = String(to);
    return () => {};
  }
  let raf = 0;
  el.textContent = String(from);
  const timer = setTimeout(() => {
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }, delay);
  return () => {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    el.textContent = String(to);
  };
}
