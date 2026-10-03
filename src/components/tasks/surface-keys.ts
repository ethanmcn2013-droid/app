/**
 * The shared key guard for Tasks.
 *
 * Single letters (S, A, D, P, L, E, X, F, 1, 2, 3, /, ?, j, k) are fast for
 * people who live here and dangerous for everyone else: a stray "d" typed
 * into a comment must never open a date picker. One pure function decides,
 * so the rule is testable and every surface uses the same answer.
 *
 * A key reaches the surface only when:
 * - no modifier other than Shift is held, unless the combo is on the
 *   allow-list (Cmd/Ctrl+Z, Cmd/Ctrl+A, Cmd/Ctrl+Enter, Cmd/Ctrl+D);
 * - the event did not start in an input, textarea, select or editable text;
 * - no menu, popover or modal dialog is open (the docked sheet is not a
 *   modal, so it does not block);
 * - the command palette is closed;
 * - the key is not part of an IME composition.
 */

export type SurfaceKeyEvent = Readonly<{
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  /** Tag name of the event target, e.g. "INPUT". */
  targetTag?: string | null;
  /** True when the target (or an ancestor) is contenteditable. */
  targetEditable?: boolean;
  /** Role of the target, e.g. "textbox", "combobox". */
  targetRole?: string | null;
}>;

export type SurfaceKeyState = Readonly<{
  /** A Radix menu, a popover or a modal dialog is open. */
  layerOpen: boolean;
  /** The command palette is open. */
  paletteOpen: boolean;
}>;

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const EDITABLE_ROLES = new Set(["textbox", "combobox", "searchbox", "spinbutton"]);
const MOD_ALLOWED = new Set(["z", "a", "enter", "d"]);

export function shouldHandleSurfaceKey(event: SurfaceKeyEvent, state: SurfaceKeyState): boolean {
  if (event.isComposing) return false;
  if (event.altKey) return false;
  const mod = event.metaKey || event.ctrlKey;
  if (mod && !MOD_ALLOWED.has(event.key.toLowerCase())) return false;
  if (event.targetTag && EDITABLE_TAGS.has(event.targetTag.toUpperCase())) return false;
  if (event.targetEditable) return false;
  if (event.targetRole && EDITABLE_ROLES.has(event.targetRole)) return false;
  if (state.paletteOpen) return false;
  if (state.layerOpen) return false;
  return true;
}

/** Read the guard's inputs off a real DOM event. */
export function surfaceKeyEventFrom(event: KeyboardEvent): SurfaceKeyEvent {
  const target = event.target instanceof HTMLElement ? event.target : null;
  return {
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    isComposing: event.isComposing,
    targetTag: target?.tagName ?? null,
    targetEditable: Boolean(target?.closest('[contenteditable="true"], [contenteditable=""]')),
    targetRole: target?.getAttribute("role") ?? null,
  };
}

/** Is any layered surface open that owns the keyboard right now? */
export function readSurfaceLayerState(): SurfaceKeyState {
  if (typeof document === "undefined") return { layerOpen: false, paletteOpen: false };
  const radix = Boolean(document.querySelector("[data-radix-popper-content-wrapper], [data-tasks-layer]"));
  const modal = Boolean(document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]'));
  const palette = Boolean(document.querySelector("[data-tasks-command-palette-layer]"));
  return { layerOpen: radix || modal, paletteOpen: palette };
}
