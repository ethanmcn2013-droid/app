"use client";

/**
 * The completion flight.
 *
 * Finishing a task is the one thing on this board a person does for pleasure,
 * and before the design panel reached it the card simply teleported a
 * thousand pixels to the right. Two things make it read as one movement:
 *
 *   the card travels — as a fixed-position copy over the whole sheet,
 *     because the real node lives inside a column scroller that would clip
 *     both it and its shadow; and
 *   the board it left closes the gap on the same curve and the same
 *     duration, or the moment reads as two unrelated events.
 *
 * The duration scales with the distance covered: a fixed 260ms reads as a
 * teleport at 1000px and as a lag at 120px.
 */

import { useLayoutEffect, useRef } from "react";

export type FloorFlight = {
  /** Call before the state change, naming the card that is about to move. */
  arm: (id: string) => void;
};

const REDUCED = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useFloorFlight(
  root: React.RefObject<HTMLElement | null>,
  ghostClass: string,
  version: string,
): FloorFlight {
  /** Where every card was before the change, keyed by id — the DOM they
   *  belonged to is gone by the time we measure again. */
  const before = useRef<Map<string, DOMRect> | null>(null);
  const flying = useRef<string | null>(null);

  const arm = (id: string) => {
    const node = root.current;
    if (!node) return;
    const map = new Map<string, DOMRect>();
    node.querySelectorAll<HTMLElement>("[data-id]").forEach((card) => {
      map.set(card.dataset.id!, card.getBoundingClientRect());
    });
    before.current = map;
    flying.current = id;
  };

  useLayoutEffect(() => {
    const node = root.current;
    const was = before.current;
    const id = flying.current;
    before.current = null;
    flying.current = null;
    if (!node || !was || !id) return;

    const card = node.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
    const from = was.get(id);
    const land = () => card?.setAttribute("data-just-done", "");
    if (!card || !from) return;
    if (REDUCED()) { land(); return; }

    let now = card.getBoundingClientRect();
    const board = node.querySelector<HTMLElement>("[data-board]");
    if (board) {
      /* Never past the sheet's own edge: on a phone the destination column is
         off screen, and a ghost that exits the viewport reads as a bug. */
      const box = board.getBoundingClientRect();
      const left = Math.min(Math.max(now.left, box.left + 8), box.right - now.width - 8);
      if (left !== now.left) now = new DOMRect(left, now.top, now.width, now.height);
    }

    const dx = from.left - now.left;
    const dy = from.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { land(); return; }

    /* --motion-fast governs a state change; this is a journey across the
       sheet, so its duration is the distance it covers. */
    const travel = Math.round(Math.min(460, Math.max(220, 170 + Math.hypot(dx, dy) * 0.22)));

    const ghost = card.cloneNode(true) as HTMLElement;
    ghost.classList.add(ghostClass);
    ghost.removeAttribute("id");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.left = `${from.left}px`;
    ghost.style.top = `${from.top}px`;
    ghost.style.width = `${from.width}px`;
    ghost.style.height = `${from.height}px`;
    ghost.style.transitionDuration = `${travel}ms`;
    document.body.appendChild(ghost);
    /* opacity, not visibility: a hidden node leaves the tab order, which
       dropped focus on <body> for the length of the flight. */
    card.style.opacity = "0";
    void ghost.getBoundingClientRect();
    ghost.style.transform = `translate(${-dx}px, ${-dy}px)`;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      ghost.remove();
      card.style.opacity = "";
      land();
    };
    ghost.addEventListener("transitionend", (event) => {
      if ((event as TransitionEvent).propertyName === "transform" && event.target === ghost) finish();
    });
    /* A transition that never fires must not leave the card invisible. */
    setTimeout(finish, travel + 140);

    /* The board it left, and the column it landed in, close and open on the
       same curve. Keyed by id, because the repaint destroyed the DOM. */
    node.querySelectorAll<HTMLElement>("[data-id]").forEach((other) => {
      if (other === card) return;
      const old = was.get(other.dataset.id!);
      if (!old) return;
      const next = other.getBoundingClientRect();
      const ox = old.left - next.left;
      const oy = old.top - next.top;
      if (Math.abs(ox) < 1 && Math.abs(oy) < 1) return;
      other.style.transition = "none";
      other.style.transform = `translate(${ox}px, ${oy}px)`;
      void other.getBoundingClientRect();
      other.style.transition = `transform ${travel}ms var(--curve)`;
      other.style.transform = "";
      setTimeout(() => {
        other.style.transition = "";
        other.style.transform = "";
      }, travel + 40);
    });
    // The board's shape is one string; a literal array is what the compiler
    // can verify, which a passed-in deps parameter never is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return { arm };
}
