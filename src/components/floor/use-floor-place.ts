"use client";

/**
 * The three things Studio Floor measures after layout.
 *
 * All three were found by panel seats driving the design master, and all
 * three are invisible to a screenshot — which is why they are worth having a
 * file of their own rather than being scattered through the render.
 *
 *   place   A React re-render replaces the DOM under the operator. Without
 *           this, one tick on a phone threw the board back to the first
 *           column and any pointer completion dropped focus on <body>.
 *   trim    The browser's line clamp cuts at the character, so a note reads
 *           "dinner 5.30p…". This walks back to the last whole word — and it
 *           has to re-run after the webfont swaps in, or every measurement
 *           taken before the swap is wrong.
 *   edges   A fade that is always on is decoration. A rule that appears
 *           exactly when something is hidden in that direction is
 *           information.
 */

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

/* ── the word-safe trim ─────────────────────────────────────────── */

/** The binary search finds the last word that fits; this decides which of
 *  those words should be the last one read. Cleanup only ever shortens, so
 *  the fit the search proved still holds. */
function tidy(words: string[]): string {
  const kept = words.slice();
  /* A word left stranded at the head of a sentence the reader never sees. */
  if (kept.length > 1 && /[.!?]$/.test(kept[kept.length - 2])) kept.pop();
  let out = kept.join(" ").replace(/[\s,;:.!?–—-]+$/, "");
  /* A dangling function word promises a clause that does not arrive. */
  if (kept.length > 1) {
    out = out.replace(/\s+(a|an|the|and|or|but|if|to|of|with|for|in|on|at|by|from|that|which)$/i, "");
  }
  return out || words[0];
}

function trimToWord(node: HTMLElement) {
  /* The title is clipped by its row, because the row is what contains the
     floated date chip. Measuring the title itself would always report a fit. */
  const clip = node.dataset.clip === "row" ? node.parentElement : node;
  if (!clip) return;
  const fits = () => clip.scrollHeight <= clip.clientHeight + 1;

  const full = node.dataset.full ?? node.textContent ?? "";
  node.dataset.full = full;
  node.textContent = full;
  if (fits()) {
    node.removeAttribute("title");
    return;
  }
  node.title = full;

  const words = full.split(" ");
  let low = 1;
  let high = words.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    node.textContent = `${words.slice(0, mid).join(" ")}…`;
    if (fits()) low = mid;
    else high = mid - 1;
  }
  node.textContent = `${tidy(words.slice(0, low))}…`;
}

/** Whether a card is inside the board's own visible width. Vertical position
 *  is the column scroller's business and is handled separately; this is only
 *  about columns that sit past the edge of a narrow board. */
function inView(card: HTMLElement, root: HTMLElement): boolean {
  const board = root.querySelector<HTMLElement>("[data-board]");
  if (!board) return true;
  const box = board.getBoundingClientRect();
  const rect = card.getBoundingClientRect();
  return rect.left >= box.left - 1 && rect.right <= box.right + 1;
}

/* ── the hook ───────────────────────────────────────────────────── */

export type FloorPlace = {
  /** Capture scroll and focus before React replaces the DOM. */
  capture: () => void;
  /** The element the roving stop should land on after the next paint. */
  wantFocus: (id: string | null) => void;
};

export function useFloorPlace(root: React.RefObject<HTMLElement | null>, version: string): FloorPlace {
  const kept = useRef<{
    scrolls: Record<string, number>;
    left: number;
    id: string | null;
    part: string;
    hadFocus: boolean;
  } | null>(null);
  const wanted = useRef<string | null>(null);

  const capture = () => {
    const node = root.current;
    if (!node) return;
    const scrolls: Record<string, number> = {};
    node.querySelectorAll<HTMLElement>("[data-lane]").forEach((tray) => {
      const body = tray.querySelector<HTMLElement>("[data-tray-body]");
      if (body) scrolls[tray.dataset.lane!] = body.scrollTop;
    });
    const board = node.querySelector<HTMLElement>("[data-board]");
    const active = document.activeElement as HTMLElement | null;
    const card = active?.closest<HTMLElement>("[data-id]") ?? null;
    kept.current = {
      scrolls,
      left: board?.scrollLeft ?? 0,
      id: card?.dataset.id ?? null,
      part: active?.dataset.act === "tick" ? "tick" : active?.dataset.act === "menu" ? "menu" : "card",
      hadFocus: Boolean(active && active !== document.body && node.contains(active)),
    };
  };

  const wantFocus = (id: string | null) => {
    wanted.current = id;
  };

  /* Layout effect, not effect: the restore has to land before the browser
     paints, or the board is visibly at scroll 0 for one frame. */
  useLayoutEffect(() => {
    const node = root.current;
    const memory = kept.current;
    if (!node) return;

    if (memory) {
      node.querySelectorAll<HTMLElement>("[data-lane]").forEach((tray) => {
        const body = tray.querySelector<HTMLElement>("[data-tray-body]");
        const top = memory.scrolls[tray.dataset.lane!];
        if (body && top) body.scrollTop = top;
      });
      const board = node.querySelector<HTMLElement>("[data-board]");
      if (board && memory.left) {
        /* Mandatory snap re-runs against the fresh layout and drags the board
           back to the first column, which is why every tick on a phone threw
           the operator back to To do. Snap stands down for one frame. */
        const snap = board.style.scrollSnapType;
        board.style.scrollSnapType = "none";
        void board.scrollWidth;
        board.scrollLeft = memory.left;
        requestAnimationFrame(() => { board.style.scrollSnapType = snap; });
      }
    }

    /* Focus: whatever the interaction asked for, else back where it was, and
       never nothing — dropping the operator on <body> puts them eight tab
       stops from the board. */
    const target = wanted.current ?? memory?.id ?? null;
    if (target && (wanted.current || memory?.hadFocus)) {
      let card = node.querySelector<HTMLElement>(`[data-id="${CSS.escape(target)}"]`);
      /* On a narrow board the columns are a horizontal scroller, so a card
         that has just moved to Done can land a thousand pixels off screen.
         Focusing it there leaves the operator's focus on something they
         cannot see, and following it there costs them their place in the
         column they are actually working down. Neither is right: focus
         stays with the work, on the nearest card still in view. The card
         that left is still reachable — the strip names it and Ctrl+Z
         reverses it, neither of which depends on focus. */
      if (card && !inView(card, node)) {
        const near = [...node.querySelectorAll<HTMLElement>("[data-id]")].find((n) => inView(n, node));
        card = near ?? card;
      }
      const part = wanted.current ? "card" : memory?.part ?? "card";
      const aim = part === "card" ? card : card?.querySelector<HTMLElement>(`[data-act="${part}"]`) ?? card;
      if (aim) {
        aim.focus({ preventScroll: true });
        /* Scoped to the column deliberately: a general scrollIntoView nudges
           the horizontally snapped board on a phone and undoes the restore. */
        const scroller = card?.closest<HTMLElement>("[data-tray-body]");
        if (scroller && card) {
          const box = scroller.getBoundingClientRect();
          const rect = card.getBoundingClientRect();
          const top = rect.top - box.top + scroller.scrollTop;
          if (rect.top < box.top + 4) scroller.scrollTop = top - 20;
          else if (rect.bottom > box.bottom - 4) {
            const want = top + rect.height - scroller.clientHeight + 20;
            const stops = [...scroller.querySelectorAll<HTMLElement>("[data-id]")]
              .map((n) => n.getBoundingClientRect().top - box.top + scroller.scrollTop - 20)
              .filter((v) => v >= want - 0.5);
            scroller.scrollTop = stops.length ? stops[0] : want;
          }
        }
      } else if (memory?.hadFocus) {
        const stop = node.querySelector<HTMLElement>('[data-id][tabindex="0"]');
        stop?.focus({ preventScroll: true });
      }
    }
    wanted.current = null;
    kept.current = null;

    /* The trim and the edges are measured from the elements themselves,
       after this paint's layout. */
    retrim(node);
    measureEdges(node);
    // The board's shape is one string; a literal array is what the compiler
    // can verify, which a passed-in deps parameter never is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  /* The webfont swaps in after the first paint, which is what made every
     measurement taken before it wrong. */
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const again = () => { retrim(node); measureEdges(node); };
    if (document.fonts?.ready) void document.fonts.ready.then(again);
    window.addEventListener("resize", again);
    const scrollers = [
      node.querySelector<HTMLElement>("[data-board]"),
      ...node.querySelectorAll<HTMLElement>("[data-tray-body]"),
    ].filter(Boolean) as HTMLElement[];
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; measureEdges(node); });
    };
    scrollers.forEach((n) => n.addEventListener("scroll", onScroll, { passive: true }));
    return () => {
      window.removeEventListener("resize", again);
      scrollers.forEach((n) => n.removeEventListener("scroll", onScroll));
      cancelAnimationFrame(frame);
    };
  });

  return { capture, wantFocus };
}

export function retrim(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-trim]").forEach((node) => {
    /* An opened note is being read in full and must not be trimmed. */
    if (node.closest("[data-open]") && node.dataset.trim === "note") {
      if (node.dataset.full) node.textContent = node.dataset.full;
      return;
    }
    trimToWord(node);
  });
}

/** Both edge signals report distance-to-end, not the existence of overflow —
 *  otherwise the last card sits permanently under a signal that says there is
 *  more below it when there is not. */
export function measureEdges(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-tray-body]").forEach((body) => {
    body.toggleAttribute("data-above", body.scrollTop > 1);
    body.toggleAttribute("data-more", body.scrollTop + body.clientHeight < body.scrollHeight - 1);
    const tray = body.closest<HTMLElement>("[data-lane]");
    if (!tray) return;
    /* offsetTop is already relative to the tray, which is the offset parent.
       Subtracting the tray's own offset as well put the fold rule 112px above
       the foot of the scroller, where it read as a section divider inside Done
       rather than as a cue that there is more below. Read defensively so a
       change to the sheet's positioning context cannot re-open it. */
    const top = body.offsetParent === tray
      ? body.offsetTop
      : Math.round(body.getBoundingClientRect().top - tray.getBoundingClientRect().top);
    tray.style.setProperty("--body-top", `${top}px`);
    tray.style.setProperty("--body-bottom", `${top + body.clientHeight}px`);
  });
  const board = root.querySelector<HTMLElement>("[data-board]");
  const sheet = root.querySelector<HTMLElement>("[data-sheet]");
  /* The header stacks on the width of the SHEET, not the width of the window.
     The single-row band ran Planning and More past the sheet's right edge from
     about 1120px down, where overflow:hidden cut them off the screen; and the
     drawer-open board at 1440 is the same width of sheet as a 1100px window,
     so a media query could never have caught both. Stacking changes the
     header's height and not the sheet's width, so this cannot oscillate. */
  if (sheet) {
    if (sheet.clientWidth < 1200) sheet.setAttribute("data-head", "stack");
    else sheet.removeAttribute("data-head");
  }
  if (board && sheet) {
    sheet.toggleAttribute("data-more-right", board.scrollLeft + board.clientWidth < board.scrollWidth - 1);
    sheet.toggleAttribute("data-more-left", board.scrollLeft > 1);
  }
}

/* ── the operator's own day ─────────────────────────────────────── */

/**
 * Whether a timezone exists yet.
 *
 * Every time fact on this board — the header's date, "Today", "Tomorrow",
 * what counts as overdue — is measured against the operator's own day. The
 * server has no timezone, so anything derived from the clock during SSR bakes
 * the SERVER's calendar day into the markup, and an operator on the other
 * side of a date line hydrates against text that is a day out. React does not
 * treat that as cosmetic: it fails the hydration and regenerates the whole
 * board. It showed up as "server rendered Tue 18 Aug, client rendered
 * Wed 19 Aug", and it fires for a large share of the world every evening.
 *
 * There is no value the server and the first client render can both compute
 * and agree on, so they agree on nothing: the day is withheld until mount,
 * when a timezone exists. One frame later it is the operator's own.
 */
const NEVER_CHANGES = () => () => {};
const ON_THE_CLIENT = () => true;
const ON_THE_SERVER = () => false;

export function useDayIsKnown(): boolean {
  /* useSyncExternalStore, not an effect: it is the API built for a value
     whose server snapshot differs from its client one. React hydrates
     against the server snapshot and swaps to the client's straight after,
     with no mismatch and no cascading render to lint around. */
  return useSyncExternalStore(NEVER_CHANGES, ON_THE_CLIENT, ON_THE_SERVER);
}
