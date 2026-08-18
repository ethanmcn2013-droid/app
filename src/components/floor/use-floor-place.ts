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

import { useEffect, useLayoutEffect, useRef } from "react";

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
      const card = node.querySelector<HTMLElement>(`[data-id="${CSS.escape(target)}"]`);
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
    tray.style.setProperty("--body-top", `${body.offsetTop - tray.offsetTop}px`);
    tray.style.setProperty("--body-bottom", `${body.offsetTop - tray.offsetTop + body.clientHeight}px`);
  });
  const board = root.querySelector<HTMLElement>("[data-board]");
  const sheet = root.querySelector<HTMLElement>("[data-sheet]");
  if (board && sheet) {
    sheet.toggleAttribute("data-more-right", board.scrollLeft + board.clientWidth < board.scrollWidth - 1);
    sheet.toggleAttribute("data-more-left", board.scrollLeft > 1);
  }
}
