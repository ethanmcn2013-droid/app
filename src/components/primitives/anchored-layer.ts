/**
 * anchored-layer — the one entrance every menu, picker and popover uses.
 *
 * The anchored-layer primitive: *origin-aware scale from 0.98 plus opacity;
 * 140ms in, faster out; opacity-only reduced*. This module is the JavaScript
 * half of it, for layers built on motion/react. The CSS half is
 * `context-actions.module.css`, which the Radix menus use — the two are kept
 * to the same numbers on purpose, so the board's ••• menu and the panel's
 * date picker are the same gesture.
 *
 * Why the ease lives here and not in `src/lib/motion.ts`: that file's
 * `EASE_OUT` is `[0, 0, 0.2, 1]`, which is NOT the value of the `--ease-out`
 * token every stylesheet in the app resolves (`cubic-bezier(0.23, 1, 0.32, 1)`,
 * src/ds/tokens.css). Until that mismatch is reconciled repo-wide, the honest
 * mirror of the shipped token lives beside the primitive that spends it.
 */

import type { Variants } from "motion/react";

/**
 * JS mirror of the `--ease-out` token (src/ds/tokens.css:157), for
 * motion/react's `transition.ease`, which cannot read a CSS custom property.
 */
export const EASE_OUT_TOKEN = [0.23, 1, 0.32, 1] as const;

/** `--motion-fast` (140ms) in seconds — the contract's anchored-layer entrance. */
export const ANCHORED_IN = 0.14;
/** The exit. "Faster out": a layer leaving must not hold the eye. */
export const ANCHORED_OUT = 0.1;
/** Reduced motion: opacity only, and shorter still. */
export const ANCHORED_REDUCED_IN = 0.1;
export const ANCHORED_REDUCED_OUT = 0.08;

/** Scale the layer grows from, anchored on its trigger. */
export const ANCHORED_SCALE_IN = 0.98;
/** Scale the layer settles back to as it leaves — a hint, not a retreat. */
export const ANCHORED_SCALE_OUT = 0.99;

/**
 * How the layer was dismissed. A keyboard Escape is a command, and the
 * contract forbids animated keyboard commands: it cuts, it does not fade.
 * Pointer dismissal (click-away, choosing an item) gets the short exit.
 */
export type AnchoredDismiss = "pointer" | "keyboard";

const cut = { opacity: 0, transition: { duration: 0 } } as const;

/**
 * Variants rather than plain targets because the exit has to know how the
 * layer was dismissed, and a leaving component can no longer receive props —
 * `AnimatePresence custom={…}` is the only channel that reaches it.
 */
export const anchoredLayerVariants: Variants = {
  hidden: { opacity: 0, transform: `scale(${ANCHORED_SCALE_IN})` },
  visible: {
    opacity: 1,
    transform: "scale(1)",
    transition: { duration: ANCHORED_IN, ease: EASE_OUT_TOKEN },
  },
  exit: (dismiss: AnchoredDismiss) =>
    dismiss === "keyboard"
      ? cut
      : {
          opacity: 0,
          transform: `scale(${ANCHORED_SCALE_OUT})`,
          transition: { duration: ANCHORED_OUT, ease: EASE_OUT_TOKEN },
        },
  reducedHidden: { opacity: 0 },
  reducedVisible: {
    opacity: 1,
    transition: { duration: ANCHORED_REDUCED_IN, ease: "linear" },
  },
  reducedExit: (dismiss: AnchoredDismiss) =>
    dismiss === "keyboard"
      ? cut
      : { opacity: 0, transition: { duration: ANCHORED_REDUCED_OUT, ease: "linear" } },
};

/**
 * Spread onto the `motion` element inside an `AnimatePresence`. Pass the same
 * `dismiss` value to `AnimatePresence custom={…}` so the exit resolves with it.
 *
 * The caller still owns `transformOrigin` — the layer scales from wherever its
 * trigger sits, which only the caller knows.
 */
export function anchoredLayerProps(reduce: boolean | null, dismiss: AnchoredDismiss) {
  return {
    variants: anchoredLayerVariants,
    custom: dismiss,
    initial: reduce ? "reducedHidden" : "hidden",
    animate: reduce ? "reducedVisible" : "visible",
    exit: reduce ? "reducedExit" : "exit",
  } as const;
}

/**
 * The CSS half's escape hatch. Radix owns its own mount/unmount, so the cut is
 * expressed as a data attribute the stylesheet keys off
 * (`[data-dismiss="keyboard"] { animation: none }`). Written straight to the
 * DOM inside `onEscapeKeyDown`, which Radix fires before it closes the layer,
 * so the attribute is on the node before Radix reads its animation state.
 */
export function markKeyboardDismiss(node: HTMLElement | null | undefined) {
  node?.setAttribute("data-dismiss", "keyboard");
}
