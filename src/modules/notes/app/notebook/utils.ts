import type { NoteRead } from "@/modules/notes/server/actions/notes";

// Mirrors MAX_NOTE_BODY_CHARS in server/actions/notes.ts, kept in
// sync by hand because a "use server" module can't export a const.
export const MAX_NOTE_BODY_CHARS = 10_000;

// Long-press timing per UX_SPEC RW-3a.
export const LONG_PRESS_CONFIRM_MS = 450; // tray appears at this threshold
export const LONG_PRESS_FEEDBACK_MS = 350; // scale-down feedback before confirm
export const LONG_PRESS_MOVE_THRESHOLD_PX = 8; // cancel if touch moves more than this

// Grace period before the promoted note slides out of the stream view.
export const PROMOTE_GRACE_MS = 1500;
// Toast auto-dismiss for success/error.
export const PROMOTE_TOAST_DISMISS_MS = 3000;

export const MISFIRE_TOAST_KEY = "notes-misfire-toast-shown";

export type PromoteToast =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string; noteId: string };

export function makeOptimisticId() {
  return `opt_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function normalizeForSearch(s: string) {
  // Mirror the FTS5 tokenizer's remove_diacritics=2 so the client-side
  // substring fallback (used while the first FTS round-trip is in
  // flight) doesn't diverge from the eventual server result. NFD
  // splits combining marks off the base character; the strip range
  // catches the entire Combining Diacritical Marks block.
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function friendlyError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  if (err.name === "UnauthorizedError" || /not authenticated/i.test(err.message)) {
    return "Your session expired, sign in again.";
  }
  return err.message || fallback;
}

export function firstLine(body: string) {
  const trimmed = body.trim();
  if (!trimmed) return "Untitled";
  const lines = trimmed.split(/\r?\n/);
  return lines[0]?.trim() || "Untitled";
}

export function preview(body: string) {
  const lines = body.trim().split(/\r?\n/).slice(1).join(" ").trim();
  if (lines) return lines.length > 120 ? lines.slice(0, 117) + "…" : lines;
  return "";
}

export function relativeTime(ts: number, now = Date.now()) {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type { NoteRead };
