"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { PrivateNotesEmptyState } from "@/modules/notes/app/PrivateNotesEmptyState";
import {
  FirstCaptureMoment,
  FIRST_CAPTURE_ENABLED,
  hasSeenFirstCapture,
  markFirstCaptureSeen,
} from "@/modules/notes/app/FirstCaptureMoment";
import { useVoiceCapture } from "@/modules/notes/app/notebook/hooks";
import { NoteProvenanceChip } from "@/modules/notes/components/NoteProvenanceChip";
import {
  clearNoteExtract,
  createNote,
  deleteNote,
  listArchivedNotes,
  promoteNoteToTasks,
  searchNotes,
  sendExtractToTasks,
  setNoteWorkspace,
  setNoteExtract,
  unPromoteNote,
  type ExtractSendResult,
  type NoteRead,
} from "@/modules/notes/server/actions/notes";
import type { TasksWorkspaceDestination } from "@/modules/notes/server/tasks-personalization";
import { promoteSelectedExtractToTimeline } from "@/modules/notes/server/actions/timeline";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";

// The Tasks app entry, the destination of the one-way edge. Used as the
// always-available "Open in Tasks" target for promoted notes whose precise
// task URL isn't in this session's sentResults (e.g. after a reload), so the
// ecosystem hop is never a dead end.
const TASKS_APP_URL = PRODUCT_APP_PATHS.tasks;

/**
 * Warm the same-origin product hop on intent (hover/focus) so moving from the
 * notebook into Tasks feels instant, the suite-arrows pattern, applied to
 * the "Open in Tasks" edge. Idempotent; safe to call repeatedly.
 */
function prefetchHop(url: string) {
  if (typeof document === "undefined") return;
  if (document.head.querySelector(`link[data-notes-hop="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  link.setAttribute("data-notes-hop", url);
  document.head.appendChild(link);
}

// Mirrors MAX_NOTE_BODY_CHARS in server/actions/notes.ts, kept in
// sync by hand because a "use server" module can't export a const.
const MAX_NOTE_BODY_CHARS = 10_000;

// Long-press timing per UX_SPEC RW-3a.
const LONG_PRESS_CONFIRM_MS = 450; // tray appears at this threshold
const LONG_PRESS_FEEDBACK_MS = 350; // scale-down feedback before confirm
const LONG_PRESS_MOVE_THRESHOLD_PX = 8; // cancel if touch moves more than this

// Grace period before the promoted note slides out of the stream view.
const PROMOTE_GRACE_MS = 1500;
// Toast auto-dismiss for success/error.
const PROMOTE_TOAST_DISMISS_MS = 3000;

function makeOptimisticId() {
  return `opt_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function normalizeForSearch(s: string) {
  // Mirror the FTS5 tokenizer's remove_diacritics=2 so the client-side
  // substring fallback (used while the first FTS round-trip is in
  // flight) doesn't diverge from the eventual server result. NFD
  // splits combining marks off the base character; the strip range
  // catches the entire Combining Diacritical Marks block.
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function friendlyError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  if (err.name === "UnauthorizedError" || /not authenticated/i.test(err.message)) {
    return "Your session expired, sign in again.";
  }
  return err.message || fallback;
}

function RelativeTime({
  ts,
  referenceTime,
}: {
  ts: number;
  referenceTime?: number;
}) {
  // Self-contained tick so the whole notebook doesn't re-render once
  // a minute just to refresh a timestamp. Only the timestamp updates.
  const [now, setNow] = useState(() => referenceTime ?? Date.now());
  useEffect(() => {
    if (referenceTime !== undefined) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [referenceTime]);
  return <>{relativeTime(ts, now)}</>;
}

function firstLine(body: string) {
  const trimmed = body.trim();
  if (!trimmed) return "Untitled";
  const lines = trimmed.split(/\r?\n/);
  return lines[0]?.trim() || "Untitled";
}

function preview(body: string) {
  const lines = body.trim().split(/\r?\n/).slice(1).join(" ").trim();
  if (lines) return lines.length > 120 ? lines.slice(0, 117) + "…" : lines;
  return "";
}

function relativeTime(ts: number, now = Date.now()) {
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

// ── Toast state ─────────────────────────────────────────────────────

type PromoteToast =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string; noteId: string };

interface NotebookProps {
  initialNotes: NoteRead[];
  initialArchivedNotes: NoteRead[];
  tasksWorkspaces: TasksWorkspaceDestination[];
  tasksCatalogAvailable: boolean;
  planningPeriodsEnabled: boolean;
  initialWorkspaceId: string | null;
  reviewFirstCapture?: boolean;
  referenceTime?: number;
}

export function Notebook({
  initialNotes,
  initialArchivedNotes,
  tasksWorkspaces,
  tasksCatalogAvailable,
  planningPeriodsEnabled,
  initialWorkspaceId,
  reviewFirstCapture = false,
  referenceTime,
}: NotebookProps) {
  const [notes, setNotes] = useState<NoteRead[]>(initialNotes);
  const [archivedNotes, setArchivedNotes] = useState<NoteRead[]>(initialArchivedNotes);
  const [openId, setOpenId] = useState<string | null>(null);
  // Ref-mirror of openId for stable access inside long-lived keydown handlers
  // (Caravaggio walkover row 2, Cmd/Ctrl+Backspace delete).
  const openIdRef = useRef<string | null>(null);
  useEffect(() => {
    openIdRef.current = openId;
  }, [openId]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [selectedTasksWorkspaceId, setSelectedTasksWorkspaceId] = useState(
    initialWorkspaceId ?? tasksWorkspaces[0]?.id ?? "",
  );
  const [selectedNotebookWorkspaceId, setSelectedNotebookWorkspaceId] =
    useState(initialWorkspaceId ?? "");
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [timelineDraft, setTimelineDraft] = useState({
    title: "",
    date: "",
    completion: 0,
    audienceLabel: "",
  });
  const [timelineReceipt, setTimelineReceipt] = useState<string | null>(null);
  const [timelineSending, setTimelineSending] = useState(false);
  useEffect(() => {
    setTimelineDraft({ title: "", date: "", completion: 0, audienceLabel: "" });
    setTimelineReceipt(null);
  }, [openId]);
  const [error, setError] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  // The one signature moment, fires once, ever, on the first note a
  // brand-new notebook receives (see FirstCaptureMoment).
  const [firstCapture, setFirstCapture] = useState(reviewFirstCapture);
  const [editingExtractFor, setEditingExtractFor] = useState<string | null>(null);
  const [draftAction, setDraftAction] = useState("");
  const [extractError, setExtractError] = useState<string | null>(null);
  const [sendingExtractFor, setSendingExtractFor] = useState<string | null>(null);
  const [sentResults, setSentResults] = useState<Map<string, ExtractSendResult>>(
    new Map()
  );
  const [undoTarget, setUndoTarget] = useState<NoteRead | null>(null);

  // Promote gesture state
  // activeTrayId: which note row shows the inline action tray (touch path)
  const [activeTrayId, setActiveTrayId] = useState<string | null>(null);
  // pendingFeedbackIds: note rows showing scale-down pre-confirm feedback
  const [pendingFeedbackIds, setPendingFeedbackIds] = useState<Set<string>>(new Set());
  // promotingIds: note rows with optimistic "is-promoted" state (fading out)
  const [promotingIds, setPromotingIds] = useState<Set<string>>(new Set());
  // promoteToast: the "Added to Tasks" / error whisper at the bottom
  const [promoteToast, setPromoteToast] = useState<PromoteToast | null>(null);
  // archivedOpen: whether the "In Tasks" collapsible section is open
  const [archivedOpen, setArchivedOpen] = useState(false);
  // unpromotingIds: tracks which archived notes are being un-promoted
  const [unpromotingIds, setUnpromotingIds] = useState<Set<string>>(new Set());
  // E2, in-panel success state: shows confirmation text inside the open-note
  // panel for ~800ms before setOpenId(null) closes it. Keyed by note id so
  // rapid-fire opens don't stale. null = no confirmation showing.
  const [openNoteConfirmId, setOpenNoteConfirmId] = useState<string | null>(null);
  const openNoteConfirmTimerRef = useRef<number | null>(null);
  // E2 (UX a11y), always-mounted polite SR announcer. Empty until a send
  // succeeds; NVDA/TalkBack only announce a live region whose text changes
  // while it is already mounted, so this string (not the conditional visible
  // receipt) carries the screen-reader confirmation. Shared by both the
  // direct-promote and extract-send success paths.
  const [srConfirm, setSrConfirm] = useState("");
  // Live mirror of `notes` so async callbacks can snapshot the current note
  // object synchronously without taking a stale-closure dependency.
  const notesRef = useRef<NoteRead[]>(initialNotes);

  // Caravaggio walkover row 3: the persistent "Long-press any note…" nudge
  // was removed, the product that refuses tutorials ships no tutorial. The
  // ghost `→ Tasks` button on hover (fine pointers) plus long-press tray
  // (coarse pointers) are the affordance. The session-scoped misfire toast
  // that briefly piggy-backed on this surface was also retired, it named
  // a keystroke (⌘↵) the product did not bind, and a tutorial-as-toast is
  // still a tutorial.

  const [, startTransition] = useTransition();
  const captureRef = useRef<HTMLTextAreaElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const extractInputRef = useRef<HTMLInputElement | null>(null);
  const undoBtnRef = useRef<HTMLButtonElement | null>(null);
  const undoReturnFocusRef = useRef<HTMLElement | null>(null);
  const freshTimersRef = useRef<Map<string, number>>(new Map());
  const pendingDeletesRef = useRef<Map<string, { note: NoteRead; timer: number }>>(
    new Map(),
  );
  const promoteToastTimerRef = useRef<number | null>(null);
  // E5, SR-only mirror for the stream count string.
  // aria-live on the visible count causes redundant announcements on
  // unrelated re-renders; a dedicated hidden span fires only on count change.
  const srCountRef = useRef<HTMLSpanElement | null>(null);
  // Long-press timers per note id
  const longPressFeedbackTimerRef = useRef<Map<string, number>>(new Map());
  const longPressConfirmTimerRef = useRef<Map<string, number>>(new Map());
  // Touch start coords for move-threshold check
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!planningPeriodsEnabled || typeof window === "undefined") return;
    const workspace = tasksWorkspaces.find(
      (candidate) => candidate.id === selectedNotebookWorkspaceId,
    );
    const url = new URL(window.location.href);
    url.searchParams.set("contextVersion", "2");
    if (workspace) {
      url.searchParams.set("workspaceId", workspace.id);
      if (workspace.planningPeriodId) {
        url.searchParams.set("planningPeriodId", workspace.planningPeriodId);
      } else {
        url.searchParams.delete("planningPeriodId");
      }
    } else {
      url.searchParams.delete("workspaceId");
      url.searchParams.delete("planningPeriodId");
    }
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(
      new CustomEvent("signal-suite-context-change", {
        detail: {
          version: 2,
          workspaceId: workspace?.id ?? null,
          planningPeriodId: workspace?.planningPeriodId ?? null,
        },
      }),
    );
  }, [planningPeriodsEnabled, selectedNotebookWorkspaceId, tasksWorkspaces]);

  // P3-1: Deterministic first-paint focus, cursor ready, nothing highlighted.
  useEffect(() => {
    const el = captureRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const len = el.value.length;
    el.setSelectionRange(len, len);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const refocus = () => {
      if (document.visibilityState === "visible" && document.activeElement !== searchRef.current) {
        captureRef.current?.focus();
      }
    };
    document.addEventListener("visibilitychange", refocus);
    return () => document.removeEventListener("visibilitychange", refocus);
  }, []);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    return () => {
      freshTimersRef.current.forEach((id) => window.clearTimeout(id));
      pendingDeletesRef.current.forEach(({ timer }) => window.clearTimeout(timer));
      if (extractFocusTimerRef.current !== null) window.clearTimeout(extractFocusTimerRef.current);
      if (promoteToastTimerRef.current !== null) window.clearTimeout(promoteToastTimerRef.current);
      if (openNoteConfirmTimerRef.current !== null) window.clearTimeout(openNoteConfirmTimerRef.current);
      longPressFeedbackTimerRef.current.forEach((id) => window.clearTimeout(id));
      longPressConfirmTimerRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // Defect 4: clear stale promote toast when the stream empties (last-note
  // delete). A toast referencing a note that no longer exists in the list
  // can never be retried and confuses the empty state render.
  useEffect(() => {
    if (notes.length === 0 && promoteToast !== null) {
      if (promoteToastTimerRef.current !== null) {
        window.clearTimeout(promoteToastTimerRef.current);
        promoteToastTimerRef.current = null;
      }
      setPromoteToast(null);
    }
  }, [notes.length, promoteToast]);

  useEffect(() => {
    if (undoTarget) {
      undoReturnFocusRef.current = document.activeElement as HTMLElement | null;
      window.setTimeout(() => undoBtnRef.current?.focus(), 0);
    } else {
      if (undoReturnFocusRef.current?.isConnected) {
        undoReturnFocusRef.current.focus();
      } else {
        captureRef.current?.focus();
      }
      undoReturnFocusRef.current = null;
    }
  }, [undoTarget]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Keyboard note navigation, utility pass 2026-05-18.
  // j / ArrowDown → next note, k / ArrowUp → previous, Enter/Space open
  // (native <button>), Esc closes the open note (or exits the search box
  // back to the list). Mirrors the existing Cmd/K idiom. Reads live DOM so
  // it always tracks the rendered (filtered) list with no stale closures.
  // No new styling, reuses the app's existing focus-visible ring.
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n) return false;
      return (
        n.tagName === "INPUT" ||
        n.tagName === "TEXTAREA" ||
        n.tagName === "SELECT" ||
        n.isContentEditable
      );
    };
    const onNav = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(document.activeElement)) {
        if (event.key === "Escape") {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }
      if (event.key === "Escape") {
        setOpenId((cur) => (cur ? null : cur));
        return;
      }
      const isNext = event.key === "j" || event.key === "ArrowDown";
      const isPrev = event.key === "k" || event.key === "ArrowUp";
      if (!isNext && !isPrev) return;
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>("[data-note-row]"),
      );
      if (rows.length === 0) return;
      event.preventDefault();
      const idx = rows.findIndex((r) => r === document.activeElement);
      const nextIdx =
        idx === -1
          ? isNext
            ? 0
            : rows.length - 1
          : isNext
            ? Math.min(idx + 1, rows.length - 1)
            : Math.max(idx - 1, 0);
      const target = rows[nextIdx];
      target.focus();
      target.scrollIntoView({ block: "nearest" });
    };
    document.addEventListener("keydown", onNav);
    return () => document.removeEventListener("keydown", onNav);
  }, []);

  // Cmd/Ctrl+Backspace, delete the open note from the keyboard.
  // Caravaggio walkover row 2: Delete moved out of the always-visible
  // open-note panel chrome. Long-press on the row tray and this keyboard
  // shortcut are the two surviving paths so the open-note panel stays
  // body-only with one corner action.
  // Uses removeRef to avoid TDZ on the const declared further below.
  const removeRef = useRef<((id: string) => void) | null>(null);
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n) return false;
      return (
        n.tagName === "INPUT" ||
        n.tagName === "TEXTAREA" ||
        n.tagName === "SELECT" ||
        n.isContentEditable
      );
    };
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (isTypingTarget(document.activeElement)) return;
      const id = openIdRef.current;
      if (!id) return;
      event.preventDefault();
      removeRef.current?.(id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Dismiss tray on outside click / scroll
  useEffect(() => {
    if (!activeTrayId) return;
    const dismiss = () => setActiveTrayId(null);
    document.addEventListener("click", dismiss, { capture: true, once: true });
    document.addEventListener("scroll", dismiss, { capture: true, once: true });
    return () => {
      document.removeEventListener("click", dismiss, { capture: true });
      document.removeEventListener("scroll", dismiss, { capture: true });
    };
  }, [activeTrayId]);

  const [searchResults, setSearchResults] = useState<NoteRead[] | null>(null);
  const searchSeq = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const mySeq = ++searchSeq.current;
    const handle = setTimeout(() => {
      void searchNotes(q).then((rows) => {
        if (mySeq === searchSeq.current) setSearchResults(rows);
      });
    }, 180);
    return () => clearTimeout(handle);
  }, [query]);

  const workspaceNotes = useMemo(
    () => notes.filter(
      (note) => (note.workspaceId ?? "") === selectedNotebookWorkspaceId,
    ),
    [notes, selectedNotebookWorkspaceId],
  );

  const filteredNotes = useMemo(() => {
    if (!query.trim()) return workspaceNotes;
    if (searchResults === null) {
      const q = normalizeForSearch(query.trim());
      return workspaceNotes.filter((n) => normalizeForSearch(n.body).includes(q));
    }
    return searchResults.filter(
      (note) => (note.workspaceId ?? "") === selectedNotebookWorkspaceId,
    );
  }, [workspaceNotes, query, searchResults, selectedNotebookWorkspaceId]);

  const lastSavedTs = notes[0]?.createdAt ?? null;
  const draftIsEmpty = draft.trim().length === 0;

  // Platform-aware chord label for the capture hint. Set post-hydration
  // so SSR ("Ctrl") never mismatches a Mac client ("⌘").
  const [modKey, setModKey] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iP/.test(navigator.platform)) setModKey("⌘");
  }, []);

  // ── Promote toast helpers ────────────────────────────────────────

  // The bottom promote toast is now error-only, success cases use the
  // row's own fade-to-"In Tasks" gesture (row-level paths) or the in-panel
  // receipt (open-note paths), with the SR announcer below carrying the
  // screen-reader confirmation. Silence-by-default per PRODUCT.md §9.
  function showPromoteToast(toast: PromoteToast) {
    if (promoteToastTimerRef.current !== null) {
      window.clearTimeout(promoteToastTimerRef.current);
    }
    setPromoteToast(toast);
    promoteToastTimerRef.current = window.setTimeout(() => {
      promoteToastTimerRef.current = null;
      setPromoteToast(null);
    }, PROMOTE_TOAST_DISMISS_MS);
  }

  // Drive the polite SR-only announcer for non-open-note promote success.
  // The visible row gesture is the receipt for sighted users; this string
  // carries the change to NVDA/TalkBack/VoiceOver. Cleared after the
  // announcement window so a later promote re-announces cleanly.
  function announceSrSuccess(message: string) {
    setSrConfirm(message);
    window.setTimeout(() => setSrConfirm(""), 800);
  }

  // ── Core promote action (shared by touch + pointer paths) ────────

  const executePromote = useCallback(
    (noteId: string) => {
      // Snapshot the note BEFORE any optimistic mutation so a server
      // failure can restore it even if the grace removal already ran.
      const snapshot = notesRef.current.find((n) => n.id === noteId) ?? null;

      // Optimistic: mark as promoting (fades to 0.5, "In Tasks" label).
      setPromotingIds((prev) => new Set(prev).add(noteId));

      // After grace period: remove from active stream. Tracked so a
      // failure can cancel it before the note disappears.
      const graceTimer = window.setTimeout(() => {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        setPromotingIds((prev) => {
          const next = new Set(prev);
          next.delete(noteId);
          return next;
        });
        // Close open-note panel if this note was open.
        setOpenId((current) => (current === noteId ? null : current));
      }, PROMOTE_GRACE_MS);

      startTransition(async () => {
        try {
          const { note: updated, result } = await promoteNoteToTasks(noteId, selectedTasksWorkspaceId);
          // Merge the server result into archivedNotes for the "In Tasks" section.
          setArchivedNotes((prev) => {
            const without = prev.filter((n) => n.id !== noteId);
            return [updated, ...without];
          });
          setSentResults((prev) => {
            const next = new Map(prev);
            next.set(noteId, result);
            return next;
          });
          // Silence-by-default for success: the row's own fade-to-"In
          // Tasks" gesture is the visible receipt; the in-panel receipt
          // (openNoteConfirmId) carries the open-note path. The bottom
          // success toast was duplicate signal and is retired. The SR-only
          // announcer still fires so screen-reader users hear the change.
          announceSrSuccess("Added to Tasks.");
        } catch (err) {
          // Cancel the pending removal so the note never disappears, then
          // restore it from the pre-mutation snapshot if the grace timer
          // already fired (slow server → error after PROMOTE_GRACE_MS).
          window.clearTimeout(graceTimer);
          setNotes((prev) => {
            if (prev.some((n) => n.id === noteId)) return prev;
            if (!snapshot) return prev;
            const restored = { ...snapshot, archivedAt: null, promotedTaskId: null };
            return [...prev, restored].sort((a, b) => b.createdAt - a.createdAt);
          });
          setPromotingIds((prev) => {
            const next = new Set(prev);
            next.delete(noteId);
            return next;
          });
          showPromoteToast({
            kind: "error",
            message: "Couldn't add to Tasks, tap to try again",
            noteId,
          });
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTasksWorkspaceId]
  );

  // ── Long-press gesture (touch) ───────────────────────────────────

  const clearLongPressTimers = useCallback((noteId: string) => {
    const fTimer = longPressFeedbackTimerRef.current.get(noteId);
    if (fTimer !== undefined) {
      window.clearTimeout(fTimer);
      longPressFeedbackTimerRef.current.delete(noteId);
    }
    const cTimer = longPressConfirmTimerRef.current.get(noteId);
    if (cTimer !== undefined) {
      window.clearTimeout(cTimer);
      longPressConfirmTimerRef.current.delete(noteId);
    }
    setPendingFeedbackIds((prev) => {
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
  }, []);

  const onNoteTouchStart = useCallback(
    (event: React.TouchEvent, noteId: string) => {
      const touch = event.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };

      // Feedback at 350ms
      const fTimer = window.setTimeout(() => {
        longPressFeedbackTimerRef.current.delete(noteId);
        setPendingFeedbackIds((prev) => new Set(prev).add(noteId));
      }, LONG_PRESS_FEEDBACK_MS);
      longPressFeedbackTimerRef.current.set(noteId, fTimer);

      // Tray at 450ms
      const cTimer = window.setTimeout(() => {
        longPressConfirmTimerRef.current.delete(noteId);
        setPendingFeedbackIds((prev) => {
          const next = new Set(prev);
          next.delete(noteId);
          return next;
        });
        setActiveTrayId(noteId);
      }, LONG_PRESS_CONFIRM_MS);
      longPressConfirmTimerRef.current.set(noteId, cTimer);
    },
    []
  );

  const onNoteTouchMove = useCallback(
    (event: React.TouchEvent, noteId: string) => {
      const touch = event.touches[0];
      const start = touchStartRef.current;
      if (!touch || !start) return;
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);
      if (dx > LONG_PRESS_MOVE_THRESHOLD_PX || dy > LONG_PRESS_MOVE_THRESHOLD_PX) {
        clearLongPressTimers(noteId);
      }
    },
    [clearLongPressTimers]
  );

  const onNoteTouchEnd = useCallback(
    (noteId: string) => {
      clearLongPressTimers(noteId);
      touchStartRef.current = null;
    },
    [clearLongPressTimers]
  );

  // ── Un-promote ───────────────────────────────────────────────────

  const handleUnpromote = useCallback(
    (noteId: string) => {
      setUnpromotingIds((prev) => new Set(prev).add(noteId));
      startTransition(async () => {
        try {
          const restored = await unPromoteNote(noteId);
          setArchivedNotes((prev) => prev.filter((n) => n.id !== noteId));
          // Re-insert into active stream with fresh marker.
          setNotes((prev) => {
            const next = [restored, ...prev].sort(
              (a, b) => b.createdAt - a.createdAt
            );
            return next;
          });
          setFreshIds((prev) => new Set(prev).add(noteId));
          window.clearTimeout(freshTimersRef.current.get(noteId));
          freshTimersRef.current.set(
            noteId,
            window.setTimeout(() => {
              freshTimersRef.current.delete(noteId);
              setFreshIds((p) => {
                const n2 = new Set(p);
                n2.delete(noteId);
                return n2;
              });
            }, 600)
          );
        } catch (err) {
          setError(friendlyError(err, "Could not remove from Tasks"));
        } finally {
          setUnpromotingIds((prev) => {
            const next = new Set(prev);
            next.delete(noteId);
            return next;
          });
        }
      });
    },
    []
  );

  // Preview hook so the once-ever first-capture moment is reviewable on a
  // seeded demo (it otherwise only fires on a genuinely empty notebook):
  // visit /app?firstcapture=preview.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("firstcapture") === "preview") setFirstCapture(true);
  }, []);

  // ── Existing note actions ────────────────────────────────────────

  // `andPromote`, the one-keystroke line→task handoff (⌘/Ctrl+Enter in
  // the capture box): the draft saves through the normal path, then the
  // saved note promotes to Tasks in the same stroke. Promotion waits for
  // the real server id, the optimistic temp id never crosses the
  // cross-repo boundary.
  const commit = useCallback((opts?: { andPromote?: boolean }) => {
    const body = draft.trim();
    if (!body) return;

    // First-capture signature moment: an empty notebook receiving its very
    // first note, once ever (localStorage-guarded). Detected before the
    // optimistic prepend so the count reflects the pre-save state.
    if (
      FIRST_CAPTURE_ENABLED &&
      notesRef.current.length === 0 &&
      !hasSeenFirstCapture()
    ) {
      markFirstCaptureSeen();
      setFirstCapture(true);
    }

    const tempId = makeOptimisticId();
    const now = Date.now();
    const optimistic: NoteRead = {
      id: tempId,
      body,
      createdAt: now,
      updatedAt: now,
      extractBody: null,
      promotedTaskId: null,
      archivedAt: null,
      source: null,
      workspaceId: planningPeriodsEnabled
        ? selectedNotebookWorkspaceId || null
        : null,
    };
    setNotes((prev) => [optimistic, ...prev]);
    setFreshIds((prev) => new Set(prev).add(tempId));
    setDraft("");
    setError(null);

    window.clearTimeout(freshTimersRef.current.get(tempId));
    freshTimersRef.current.set(
      tempId,
      window.setTimeout(() => {
        freshTimersRef.current.delete(tempId);
        setFreshIds((prev) => {
          const next = new Set(prev);
          next.delete(tempId);
          return next;
        });
      }, 500)
    );

    startTransition(async () => {
      try {
        const saved = await createNote(
          body,
          planningPeriodsEnabled ? selectedNotebookWorkspaceId || null : null,
        );
        setNotes((prev) => prev.map((n) => (n.id === tempId ? saved : n)));
        setFreshIds((prev) => {
          const next = new Set(prev);
          next.add(saved.id);
          window.clearTimeout(freshTimersRef.current.get(saved.id));
          freshTimersRef.current.set(
            saved.id,
            window.setTimeout(() => {
              freshTimersRef.current.delete(saved.id);
              setFreshIds((p) => {
                const n2 = new Set(p);
                n2.delete(saved.id);
                return n2;
              });
            }, 500)
          );
          return next;
        });
        if (opts?.andPromote) {
          // Same stroke, second half: the saved line becomes a task.
          // executePromote owns its own optimistic state + error path
          // (the note stays in the notebook if Tasks is unreachable).
          executePromote(saved.id);
        }
      } catch (err) {
        setNotes((prev) => prev.filter((n) => n.id !== tempId));
        setError(friendlyError(err, "Could not save"));
      }
    });
  }, [draft, executePromote, planningPeriodsEnabled, selectedNotebookWorkspaceId]);

  const commitDelete = useCallback((noteToDelete: NoteRead) => {
    startTransition(async () => {
      try {
        await deleteNote(noteToDelete.id);
      } catch (err) {
        setNotes((prev) => {
          const next = [...prev, noteToDelete].sort((a, b) => b.createdAt - a.createdAt);
          return next;
        });
        setError(friendlyError(err, "Could not delete"));
      }
    });
  }, []);

  const moveNoteToWorkspace = useCallback(
    (noteId: string, workspaceId: string) => {
      setWorkspaceMessage(null);
      startTransition(async () => {
        try {
          const updated = await setNoteWorkspace(noteId, workspaceId || null);
          setNotes((current) =>
            current.map((note) => (note.id === noteId ? updated : note)),
          );
          setWorkspaceMessage(
            workspaceId ? "Note moved to this workspace." : "Note returned to Unfiled.",
          );
        } catch (err) {
          setWorkspaceMessage(friendlyError(err, "Could not move note"));
        }
      });
    },
    [],
  );

  const sendTimelinePreview = useCallback(
    (noteId: string) => {
      setTimelineReceipt(null);
      setTimelineSending(true);
      startTransition(async () => {
        try {
          const receipt = await promoteSelectedExtractToTimeline({
            noteId,
            ...timelineDraft,
          });
          setTimelineReceipt(
            receipt.status === "sent"
              ? `Shared exactly as previewed. ${receipt.url}`
              : receipt.message,
          );
        } catch (err) {
          setTimelineReceipt(friendlyError(err, "Timeline is unavailable right now"));
        } finally {
          setTimelineSending(false);
        }
      });
    },
    [timelineDraft],
  );

  const undoDelete = useCallback(() => {
    setUndoTarget((current) => {
      if (!current) return null;
      const entry = pendingDeletesRef.current.get(current.id);
      if (entry) {
        window.clearTimeout(entry.timer);
        pendingDeletesRef.current.delete(current.id);
      }
      const restored = current;
      startTransition(() => {
        setNotes((prev) => {
          const next = [...prev, restored].sort(
            (a, b) => b.createdAt - a.createdAt,
          );
          return next;
        });
      });
      return null;
    });
  }, []);

  const remove = useCallback(
    (id: string) => {
      const noteToDelete = notes.find((n) => n.id === id);
      if (!noteToDelete) return;

      startTransition(() => {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        setOpenId((current) => (current === id ? null : current));
        setUndoTarget(noteToDelete);
      });

      const timer = window.setTimeout(() => {
        pendingDeletesRef.current.delete(noteToDelete.id);
        setUndoTarget((current) =>
          current && current.id === noteToDelete.id ? null : current,
        );
        commitDelete(noteToDelete);
      }, 6_000);

      pendingDeletesRef.current.set(noteToDelete.id, {
        note: noteToDelete,
        timer,
      });
    },
    [notes, commitDelete]
  );

  const extractFocusTimerRef = useRef<number | null>(null);

  const startEditingExtract = useCallback((note: NoteRead) => {
    setEditingExtractFor(note.id);
    setDraftAction(note.extractBody ?? "");
    setExtractError(null);
    if (extractFocusTimerRef.current !== null) {
      window.clearTimeout(extractFocusTimerRef.current);
    }
    extractFocusTimerRef.current = window.setTimeout(() => {
      extractFocusTimerRef.current = null;
      extractInputRef.current?.focus();
      extractInputRef.current?.select();
    }, 0);
  }, []);

  const cancelEditingExtract = useCallback(() => {
    setEditingExtractFor(null);
    setDraftAction("");
    setExtractError(null);
  }, []);

  const commitExtract = useCallback(
    (noteId: string) => {
      const trimmed = draftAction.trim();
      if (!trimmed) {
        cancelEditingExtract();
        return;
      }
      const previousNotes = notes;
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, extractBody: trimmed, updatedAt: Date.now() }
            : n
        )
      );
      setEditingExtractFor(null);
      setDraftAction("");
      setExtractError(null);
      startTransition(async () => {
        try {
          const saved = await setNoteExtract(noteId, trimmed);
          setNotes((prev) => prev.map((n) => (n.id === noteId ? saved : n)));
        } catch (err) {
          setNotes(previousNotes);
          setExtractError(friendlyError(err, "Could not draft action"));
        }
      });
    },
    [draftAction, notes, cancelEditingExtract]
  );

  const removeExtract = useCallback(
    (noteId: string) => {
      const previousNotes = notes;
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, extractBody: null, updatedAt: Date.now() } : n
        )
      );
      setExtractError(null);
      startTransition(async () => {
        try {
          const saved = await clearNoteExtract(noteId);
          setNotes((prev) => prev.map((n) => (n.id === noteId ? saved : n)));
        } catch (err) {
          setNotes(previousNotes);
          setExtractError(friendlyError(err, "Could not clear action"));
        }
      });
    },
    [notes]
  );

  const onExtractKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, noteId: string) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEditingExtract();
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        commitExtract(noteId);
      }
    },
    [cancelEditingExtract, commitExtract]
  );

  // Two-step send (escape hatch for notes needing extract shaping).
  // E2, single confirm mechanism shared by both Send-to-Tasks paths.
  // Shows the in-panel receipt + drives the SR announcer, then closes the
  // open-note panel after 800ms. The later PROMOTE_GRACE_MS close is a
  // no-op once this has already nulled openId (guarded at its callsite).
  const beginOpenNoteConfirm = useCallback(
    (noteId: string, onSettle?: () => void) => {
      setOpenNoteConfirmId(noteId);
      setSrConfirm("Added to your Tasks workspace.");
      if (openNoteConfirmTimerRef.current !== null) {
        window.clearTimeout(openNoteConfirmTimerRef.current);
      }
      openNoteConfirmTimerRef.current = window.setTimeout(() => {
        openNoteConfirmTimerRef.current = null;
        setOpenNoteConfirmId(null);
        setSrConfirm("");
        // Deferred stream mutation (extract path keeps the note visible so
        // the in-panel receipt actually renders during the 800ms window).
        onSettle?.();
        setOpenId(null);
      }, 800);
    },
    []
  );

  const sendToTasks = useCallback(
    (noteId: string) => {
      setSendingExtractFor(noteId);
      setExtractError(null);
      startTransition(async () => {
        try {
          const { note: updated, result } = await sendExtractToTasks(noteId, selectedTasksWorkspaceId);
          // sendExtractToTasks now also archives the note (D1 semantics).
          // Remove from active stream, add to archived. Panel close is
          // deferred to beginOpenNoteConfirm so the extract path has the
          // same in-panel receipt as the direct-promote path.
          setSentResults((prev) => {
            const next = new Map(prev);
            next.set(noteId, result);
            return next;
          });
          // Move the note to archivedNotes immediately so the sidebar
          // "IN TASKS n notes" count ticks right away (D3-A fix).
          setArchivedNotes((prev) => {
            const without = prev.filter((n) => n.id !== noteId);
            return [updated, ...without];
          });
          // No bottom toast, the in-panel receipt (beginOpenNoteConfirm)
          // is the single visible confirmation, and it carries the SR
          // announce too. Silence-by-default per PRODUCT.md §9.
          // Keep the note in the active stream so the open-note panel (and
          // its in-panel receipt) stays mounted for the 800ms confirm
          // window; remove it from the active stream as the panel closes.
          // Keep sendingExtractFor set through the 800ms confirm window so
          // the send button stays disabled (no double-tap → false error
          // toast on an already-succeeded promote); clear it as the note
          // settles to archived and the panel closes.
          beginOpenNoteConfirm(noteId, () => {
            setNotes((prev) => prev.filter((n) => n.id !== noteId));
            setSendingExtractFor(null);
          });
        } catch (err) {
          setExtractError(friendlyError(err, "Could not send to Tasks"));
          // Clear on failure so the user can retry immediately.
          setSendingExtractFor(null);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTasksWorkspaceId]
  );

  const onCaptureKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDraft("");
        return;
      }
      // ⌘/Ctrl+Enter, the line you just wrote becomes a task, one
      // stroke, no dialog. Deliberate by definition: the user pressed
      // the promote chord (PRODUCT.md §8, never automatic).
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        commit({ andPromote: true });
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        commit();
      }
    },
    [commit]
  );

  const onSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setQuery("");
        captureRef.current?.focus();
      }
    },
    []
  );

  // ── Voice capture ──────────────────────────────────────────────────
  // Spoken words append to the live draft and save through the same
  // path as typing. The mic resolves after first paint and never grabs
  // focus, so the 3-second capture budget is untouched.
  const appendSpoken = useCallback((chunk: string) => {
    setDraft((prev) => {
      const sep =
        prev.length === 0 || /\s$/.test(prev) ? "" : prev.endsWith("\n") ? "" : " ";
      const next = `${prev}${sep}${chunk}`;
      return next.length > MAX_NOTE_BODY_CHARS
        ? next.slice(0, MAX_NOTE_BODY_CHARS)
        : next;
    });
  }, []);

  const voice = useVoiceCapture({
    appendTranscript: appendSpoken,
    onStop: () => captureRef.current?.focus({ preventScroll: true }),
  });

  // Open-note promote (button in the open-note panel controls).
  // E2: show in-panel confirmation for ~800ms at the point of attention
  // before closing the panel, the bottom toast was missed because the
  // panel vanished under the user's eyes on the same click.
  const promoteFromOpenNote = useCallback(
    (noteId: string) => {
      setActiveTrayId(null);
      beginOpenNoteConfirm(noteId);
      executePromote(noteId);
    },
    [executePromote, beginOpenNoteConfirm]
  );

  // ⌘/Ctrl+Enter outside the capture box, the same one-keystroke
  // handoff on a focused note row (j/k navigation) or the open note.
  // Mirrors the ⌘⌫ delete handler's shape: live DOM read, typing
  // targets excluded (the capture textarea binds its own chord, the
  // extract input keeps plain Enter). Optimistic temp ids and rows
  // already promoting are skipped, the chord never double-fires and
  // never sends an id the server doesn't know.
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n) return false;
      return (
        n.tagName === "INPUT" ||
        n.tagName === "TEXTAREA" ||
        n.tagName === "SELECT" ||
        n.isContentEditable
      );
    };
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key !== "Enter") return;
      if (isTypingTarget(document.activeElement)) return;

      const active = document.activeElement as HTMLElement | null;
      const rowId = active?.getAttribute?.("data-note-row") ?? null;
      const targetId = rowId ?? openIdRef.current;
      if (!targetId || targetId.startsWith("opt_")) return;
      if (active?.classList.contains("is-promoted")) return;

      event.preventDefault();
      if (rowId) {
        executePromote(rowId);
      } else {
        promoteFromOpenNote(targetId);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [executePromote, promoteFromOpenNote]);

  const openNote = notes.find((n) => n.id === openId) ?? null;

  // Demoted from <main> to <div>: the /app layout already owns the sole
  // <main> landmark (layout.tsx). A nested <main> caused
  // landmark-main-is-top-level + landmark-no-duplicate-main axe violations
  // (Phase 7 findings). The sr-only h1 below provides the page title for
  // screen readers; the section aria-label carries the section identity.
  return (
    <div className="shell">
      <h1 className="sr-only">Signal Notes notebook</h1>
      {/* ── The notebook ────────────────────────────────────────── */}
      <section className="notebook" aria-label="Signal Notes notebook">
        <div className="notebook-top">
          <a href="/" className="wordmark" aria-label="Signal Notes home">
            <span className="word">notes</span>
            <span className="dot" aria-hidden />
          </a>
          <label className="search">
            <span>Search</span>
            <input
              ref={searchRef}
              id="search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="anything"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          {planningPeriodsEnabled ? (
            <label className="workspace-selector">
              <span>Project</span>
              <select
                value={selectedNotebookWorkspaceId}
                onChange={(event) => {
                  const next = event.target.value;
                  setSelectedNotebookWorkspaceId(next);
                  if (next) setSelectedTasksWorkspaceId(next);
                  setWorkspaceMessage(null);
                }}
                aria-describedby="workspace-selector-status"
              >
                <option value="">Unfiled</option>
                {tasksWorkspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.planningPeriodName
                      ? `${workspace.planningPeriodName} · ${workspace.name}`
                      : workspace.name}
                  </option>
                ))}
              </select>
              <span id="workspace-selector-status" className="workspace-selector-status">
                {tasksCatalogAvailable
                  ? "Private notes in this workspace"
                  : "Tasks unavailable, capture stays Unfiled"}
              </span>
            </label>
          ) : null}
        </div>

        <label className="capture">
          <span className="sr-only">Capture a private note</span>
          <textarea
            id="capture"
            ref={captureRef}
            rows={6}
            placeholder="Capture a thought…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onCaptureKeyDown}
            maxLength={MAX_NOTE_BODY_CHARS}
            spellCheck
          />
          <PrivateNotesEmptyState visible={draftIsEmpty} noteCount={notes.length + archivedNotes.length} />
          {voice.supported && (
            <button
              type="button"
              className={`capture-mic${voice.listening ? " is-listening" : ""}`}
              onClick={voice.toggle}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? "Stop voice" : "Speak a note"}
              title={voice.listening ? "Stop voice" : "Speak a note"}
            >
              <span className="capture-mic__glyph" aria-hidden>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <line x1="12" y1="18" x2="12" y2="21" />
                </svg>
              </span>
              {voice.listening && <span className="capture-mic__pulse" aria-hidden />}
            </button>
          )}
          {voice.listening && (
            <p className="capture-voice-status" role="status">
              Listening… speak your note
            </p>
          )}
          {voice.message && (
            <p className="capture-hint capture-voice-msg" role="status">
              {voice.message.kind === "denied"
                ? "Voice needs microphone access. Allow it in your browser, or just type."
                : voice.message.kind === "no-speech"
                  ? "Didn’t catch that, tap the mic and try again, or type."
                  : "Voice isn’t available right now, type your note instead."}
            </p>
          )}
          <p className="capture-hint">
            <kbd>Enter</kbd> saves · <kbd>{modKey}</kbd>+<kbd>Enter</kbd> saves and sends to Tasks · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line · <kbd>Esc</kbd> clears
          </p>
          {error && (
            <p role="alert" className="capture-hint capture-hint-error">
              {error}
            </p>
          )}
        </label>

        <div className="stream-head">
          <span>Stream</span>
          {/* E5, canonical count string.
              Unfiltered: "N notes" (or "1 note").
              Filtered:   "N of M", only shown when filter is active AND
              the result count differs from total (kill the identity case
              "X of X" which adds noise without information). */}
          {workspaceNotes.length > 0 && (
            <span aria-hidden>
              {query.trim() && filteredNotes.length !== workspaceNotes.length
                ? `${filteredNotes.length} of ${workspaceNotes.length}`
                : `${workspaceNotes.length} ${workspaceNotes.length === 1 ? "note" : "notes"}`}
            </span>
          )}
        </div>
        {/* E5, SR-only mirror for the stream count. Dedicated span with
            aria-live so announcements fire on count change without
            polluting every unrelated re-render that touches the visible span. */}
        <span
          ref={srCountRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {query.trim() && filteredNotes.length !== workspaceNotes.length
            ? `${filteredNotes.length} of ${workspaceNotes.length} notes`
            : workspaceNotes.length === 0
              ? "No notes yet"
              : `${workspaceNotes.length} ${workspaceNotes.length === 1 ? "note" : "notes"}`}
        </span>

        {workspaceNotes.length === 0 && (
          <p className="empty-state">
            <em>Nothing here yet.</em> Start typing.
          </p>
        )}

        {workspaceNotes.length > 0 && filteredNotes.length === 0 && query.trim() && (
          <p className="empty-state">
            No notes match <em>"{query.trim()}"</em>.
          </p>
        )}

        <ol className="stream" aria-label="Recent notes">
          {filteredNotes.map((note) => {
            const isOpen = openId === note.id;
            const isPromoting = promotingIds.has(note.id);
            const hasFeedback = pendingFeedbackIds.has(note.id);
            // Tray hides the moment a promote is in flight, prevents a
            // second tap on an already-succeeding note (false error toast).
            const hasTray = activeTrayId === note.id && !isPromoting;
            return (
              <li key={note.id} className="note-list-item">
                {/* Note row, the main clickable target */}
                <div className="note-row-wrapper">
                  <button
                    type="button"
                    className={[
                      "note-row",
                      freshIds.has(note.id) ? "is-fresh" : "",
                      isPromoting ? "is-promoted" : "",
                      hasFeedback ? "is-longpress-feedback" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={(e) => {
                      // Don't open/close if tray is showing, the tray
                      // handles the confirm.
                      if (hasTray) {
                        e.stopPropagation();
                        return;
                      }
                      setOpenId(isOpen ? null : note.id);
                      setActiveTrayId(null);
                    }}
                    onTouchStart={(e) => onNoteTouchStart(e, note.id)}
                    onTouchMove={(e) => onNoteTouchMove(e, note.id)}
                    onTouchEnd={() => onNoteTouchEnd(note.id)}
                    onTouchCancel={() => onNoteTouchEnd(note.id)}
                    data-note-row={note.id}
                    aria-expanded={isOpen}
                    aria-controls={`note-panel-${note.id}`}
                  >
                    <span>
                      <span className="note-title">{firstLine(note.body)}</span>
                      {preview(note.body) && !isOpen && (
                        <span className="note-preview">{preview(note.body)}</span>
                      )}
                    </span>
                    <span className="note-meta">
                      {isPromoting && (
                        <span className="note-tasks-label" aria-label="In Tasks">
                          In Tasks
                        </span>
                      )}
                      {!isPromoting && note.promotedTaskId && (
                        /* role="img" required: aria-label is prohibited on plain <span>
                           (generic role). Marking as img makes the label valid. */
                        <span role="img" aria-label="In Tasks" className="note-dot--sent" />
                      )}
                      {!isPromoting && note.extractBody && !note.promotedTaskId && (
                        <span role="img" aria-label="Extract drafted, not yet in Tasks" className="note-dot" />
                      )}
                      {/* N·24 (Pattern 4), calendar provenance pill.
                          Renders only while the spawned note is untouched
                          (updatedAt === createdAt). The moment the user
                          types into the note, updatedAt drifts and the
                          pill disappears, the disappear-on-interaction
                          rule from handoff §2 Pattern 4. */}
                      {!isPromoting &&
                        note.source === "calendar" &&
                        note.updatedAt === note.createdAt && (
                          <NoteProvenanceChip kind="calendar" />
                        )}
                      {!isPromoting && (
                        <span>
                          <RelativeTime ts={note.createdAt} referenceTime={referenceTime} />
                        </span>
                      )}
                    </span>
                  </button>

                  {/* Pointer hover ghost button, "→ Tasks" */}
                  {/* Only shown on non-touch pointer devices via CSS.
                      Does not appear when the note is already promoting. */}
                  {!isPromoting && (
                    <button
                      type="button"
                      className="note-ghost-promote"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTrayId(null);
                        if (tasksWorkspaces.length > 1) setOpenId(note.id);
                        else executePromote(note.id);
                      }}
                      title={`Will add: ${firstLine(note.body).slice(0, 40)}${firstLine(note.body).length > 40 ? "…" : ""}`}
                      aria-label={`Send to Tasks: ${firstLine(note.body)}`}
                    >
                      Tasks
                      <svg
                        className="note-ghost-arrow"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Inline tray (touch long-press confirm) */}
                {hasTray && (
                  <div
                    className="note-promote-tray"
                    role="group"
                    aria-label="Promote note"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="note-tray-promote"
                      disabled={isPromoting}
                      onClick={() => {
                        if (isPromoting) return;
                        setActiveTrayId(null);
                        if (tasksWorkspaces.length > 1) setOpenId(note.id);
                        else executePromote(note.id);
                      }}
                    >
                      Send to Tasks
                    </button>
                    <button
                      type="button"
                      className="note-tray-cancel"
                      onClick={() => setActiveTrayId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {/* Always-mounted polite announcer, empty until success so the
            screen reader reliably announces the change (NVDA/TalkBack
            ignore live regions that mount already-populated). Lives at
            the section root so row-level promotes (no open note) still
            announce, the bottom success toast was retired as the visible
            confirmation, this carries the SR signal in its place. */}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {srConfirm}
        </span>
        {openNote && (
          <article className="open-note" aria-label="Open note" id={`note-panel-${openNote.id}`}>
            {/* Caravaggio walkover row 2 + row 13:
                Open-note panel reduces to body + a single corner indicator.
                Delete is no longer always-visible chrome, it lives on
                long-press (touch) and ⌘⌫ / Ctrl⌫ (keyboard). The corner
                now shows the "In Tasks" label when relevant and nothing
                otherwise, the icon-only "Send to Tasks" arrow was cut so
                "Send as-is" / "Shape & send" below the body are the single
                canonical shape (not the third sibling on the open note).
                Equal-weight siblings live inline below the body so they
                earn the same gravity. */}
            <div className="open-note-head">
              <span>
                Captured <RelativeTime ts={openNote.createdAt} referenceTime={referenceTime} />
              </span>
              <div className="open-note-head-controls">
                {planningPeriodsEnabled ? (
                  <label className="open-note-workspace">
                    <span className="sr-only">Project for this note</span>
                    <select
                      value={openNote.workspaceId ?? ""}
                      onChange={(event) =>
                        moveNoteToWorkspace(openNote.id, event.target.value)
                      }
                      aria-label="Project for this note"
                    >
                      <option value="">Unfiled</option>
                      {tasksWorkspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {openNote.promotedTaskId ? (
                  <span className="open-note-promoted-label">In Tasks</span>
                ) : null}
              </div>
            </div>
            {workspaceMessage ? (
              <p className="workspace-message" role="status">
                {workspaceMessage}
              </p>
            ) : null}
            <p className="open-note-body">{openNote.body}</p>

            {planningPeriodsEnabled ? (
              <details className="timeline-promotion">
                <summary>Prepare a Timeline share</summary>
                <p className="timeline-promotion-copy">
                  Choose the exact safe extract. The private note body is never included.
                </p>
                <div className="timeline-promotion-fields">
                  <label>
                    <span>Selected extract</span>
                    <input
                      value={timelineDraft.title}
                      onChange={(event) =>
                        setTimelineDraft((current) => ({ ...current, title: event.target.value }))
                      }
                      maxLength={180}
                    />
                  </label>
                  <label>
                    <span>Date</span>
                    <input
                      type="date"
                      value={timelineDraft.date}
                      onChange={(event) =>
                        setTimelineDraft((current) => ({ ...current, date: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    <span>Completion</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={timelineDraft.completion}
                      onChange={(event) =>
                        setTimelineDraft((current) => ({
                          ...current,
                          completion: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Named audience</span>
                    <input
                      value={timelineDraft.audienceLabel}
                      onChange={(event) =>
                        setTimelineDraft((current) => ({
                          ...current,
                          audienceLabel: event.target.value,
                        }))
                      }
                      placeholder="Maeve and Dara"
                      maxLength={80}
                    />
                  </label>
                </div>
                <div className="timeline-promotion-preview" aria-label="Exact Timeline preview">
                  <strong>Exact preview</strong>
                  <span>
                    {timelineDraft.title.trim() || "Selected extract"} ·{" "}
                    {timelineDraft.date || "Choose a date"} · {timelineDraft.completion}% · for{" "}
                    {timelineDraft.audienceLabel.trim() || "named audience"}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-draft-action"
                  onClick={() => sendTimelinePreview(openNote.id)}
                  disabled={
                    timelineSending ||
                    !openNote.workspaceId ||
                    !timelineDraft.title.trim() ||
                    !timelineDraft.date ||
                    !timelineDraft.audienceLabel.trim()
                  }
                >
                  {timelineSending ? "Checking Timeline…" : "Send this preview to Timeline"}
                </button>
                {!openNote.workspaceId ? (
                  <p className="timeline-promotion-receipt">Choose a project for this note first.</p>
                ) : null}
                {timelineReceipt ? (
                  <p className="timeline-promotion-receipt" role="status">{timelineReceipt}</p>
                ) : null}
              </details>
            ) : null}

            {/* Row 13, equal-weight siblings for the not-yet-extracted path.
                "Send as-is" is the canonical promote action; "Shape & send"
                opens the rename input inline. They sit below the body so
                neither outweighs the other. Hidden once the user has either
                drafted an extract or promoted the note (the extract-drafted
                block handles those states below). */}
            {!openNote.promotedTaskId &&
              !openNote.extractBody &&
              editingExtractFor !== openNote.id && (
                <div
                  className="open-note-action-pair"
                  role="group"
                  aria-label="Send or shape this note"
                >
                  {tasksWorkspaces.length > 1 && (
                    <label className="extract-drafted-destination">
                      <span>Send to</span>
                      <select
                        value={selectedTasksWorkspaceId}
                        onChange={(event) => setSelectedTasksWorkspaceId(event.target.value)}
                        aria-label="Tasks destination project"
                      >
                        {tasksWorkspaces.map((workspace) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    className="btn-draft-action btn-draft-action--primary"
                    onClick={() => promoteFromOpenNote(openNote.id)}
                    aria-label="Send note to Tasks as written"
                  >
                    Send as-is
                  </button>
                  <button
                    type="button"
                    className="btn-draft-action btn-draft-action--equal"
                    onClick={() => startEditingExtract(openNote)}
                    aria-label="Shape the wording before sending to Tasks"
                  >
                    Shape &amp; send
                  </button>
                </div>
              )}

            {/* E2, in-panel success confirmation shown at the point of
                attention for ~800ms before the panel closes. Ink-faint
                so it reads as a receipt, not a celebration. */}
            {openNoteConfirmId === openNote.id && (
              <p className="open-note-promote-confirm" aria-hidden="true">
                Added to your Tasks workspace.
              </p>
            )}

            {editingExtractFor === openNote.id && (
              <div className="extract-input" role="group" aria-label="Draft action">
                <label className="sr-only" htmlFor="extract-input-field">
                  Action wording
                </label>
                <input
                  ref={extractInputRef}
                  id="extract-input-field"
                  type="text"
                  value={draftAction}
                  onChange={(event) => setDraftAction(event.target.value)}
                  onKeyDown={(event) => onExtractKeyDown(event, openNote.id)}
                  placeholder="Type the action wording, be deliberate."
                  maxLength={280}
                  spellCheck
                  autoComplete="off"
                />
                <div className="extract-input-controls">
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={cancelEditingExtract}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-draft-action"
                    onClick={() => commitExtract(openNote.id)}
                    disabled={draftAction.trim().length === 0}
                  >
                    Save
                  </button>
                </div>
                <p className="extract-hint">
                  <kbd>Enter</kbd> saves · <kbd>Esc</kbd> cancels
                </p>
              </div>
            )}

            {openNote.extractBody && editingExtractFor !== openNote.id && (
              <div className="extract-drafted" aria-label="Action drafted">
                {openNote.promotedTaskId ? (
                  <p className="extract-drafted-meta">
                    Sent to{" "}
                    {sentResults.get(openNote.id)?.workspaceName ?? "Tasks"}
                  </p>
                ) : (
                  <p className="extract-drafted-meta">
                    Saved. Ready to send to Signal Tasks.
                  </p>
                )}
                <p className="extract-drafted-body">{openNote.extractBody}</p>
                <div className="extract-drafted-controls">
                  {tasksWorkspaces.length > 1 && !openNote.promotedTaskId && (
                    <label className="extract-drafted-destination">
                      <span>Send to</span>
                      <select
                        value={selectedTasksWorkspaceId}
                        onChange={(event) => setSelectedTasksWorkspaceId(event.target.value)}
                        aria-label="Tasks destination project"
                        disabled={sendingExtractFor === openNote.id}
                      >
                        {tasksWorkspaces.map((workspace) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {openNote.promotedTaskId ? (
                    (() => {
                      const sent = sentResults.get(openNote.id);
                      return sent?.taskUrl ? (
                        <a
                          className="btn-delete"
                          href={sent.taskUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open in Tasks
                        </a>
                      ) : null;
                    })()
                  ) : (
                    <button
                      type="button"
                      className="btn-draft-action"
                      onClick={() => sendToTasks(openNote.id)}
                      disabled={sendingExtractFor === openNote.id}
                    >
                      {sendingExtractFor === openNote.id
                        ? "Sending…"
                        : "Send to Tasks"}
                    </button>
                  )}
                  {!openNote.promotedTaskId && (
                    /* Caravaggio walkover row 2: Edit + Remove collapse
                       behind an overflow control that reveals on hover
                       (pointer) or focus-within (keyboard). The summary
                       is a 16x16 ellipsis button, keyboard-reachable,
                       screen-reader labelled, and never raises rest
                       weight. Touch users open it via tap-toggle. */
                    <div
                      className="extract-overflow"
                      data-state={
                        sendingExtractFor === openNote.id ? "disabled" : "ready"
                      }
                    >
                      <button
                        type="button"
                        className="extract-overflow-trigger"
                        aria-label="More actions for drafted extract"
                        aria-haspopup="menu"
                        disabled={sendingExtractFor === openNote.id}
                      >
                        <span aria-hidden>···</span>
                      </button>
                      <div className="extract-overflow-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className="btn-delete"
                          onClick={() => startEditingExtract(openNote)}
                          disabled={sendingExtractFor === openNote.id}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="btn-delete"
                          onClick={() => removeExtract(openNote.id)}
                          disabled={sendingExtractFor === openNote.id}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {extractError && (
              <div role="alert" className="extract-error">
                <span>{extractError}</span>
                {/* E2, retry affordance mirrors promoteToast Retry pattern.
                    Re-invokes sendExtractToTasks so the error is not a dead end. */}
                <button
                  type="button"
                  className="undo-toast-btn"
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    setExtractError(null);
                    sendToTasks(openNote.id);
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </article>
        )}

        {/* ── "In Tasks" collapsible section (D1 archived notes) ── */}
        {archivedNotes.length > 0 && (
          <div className="in-tasks-section">
            <button
              type="button"
              className="in-tasks-toggle"
              aria-expanded={archivedOpen}
              onClick={() => setArchivedOpen((v) => !v)}
            >
              <span className="in-tasks-toggle-label">
                In Tasks
                <span className="in-tasks-count" aria-hidden>
                  {archivedNotes.length}
                </span>
              </span>
              <svg
                className={`in-tasks-chevron${archivedOpen ? " is-open" : ""}`}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>

            {archivedOpen && (
              <ol className="in-tasks-list" aria-label="Notes that crossed into Tasks">
                {archivedNotes.map((note) => {
                  const sent = sentResults.get(note.id);
                  // Persistent hop: the precise task URL when this session sent
                  // it, otherwise the Tasks app entry, so the edge is never a
                  // dead end after a reload.
                  const hopUrl = sent?.taskUrl ?? TASKS_APP_URL;
                  const isUnpromoting = unpromotingIds.has(note.id);
                  const title = firstLine(note.body);
                  return (
                    <li key={note.id} className="in-tasks-row">
                      <div className="in-tasks-main">
                        <span className="in-tasks-title">{title}</span>
                        {note.extractBody && (
                          <span className="in-tasks-extract">{note.extractBody}</span>
                        )}
                      </div>
                      <a
                        href={hopUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="in-tasks-link"
                        aria-label={`Open in Tasks: ${title}`}
                        onMouseEnter={() => prefetchHop(hopUrl)}
                        onFocus={() => prefetchHop(hopUrl)}
                      >
                        Open in Tasks
                        <svg
                          className="in-tasks-link-arrow"
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </a>
                      <button
                        type="button"
                        className="in-tasks-remove"
                        onClick={() => handleUnpromote(note.id)}
                        disabled={isUnpromoting}
                        aria-label={`Remove from Tasks: ${title}`}
                      >
                        {isUnpromoting ? "Removing…" : "Remove"}
                      </button>
                    </li>
                  );
                })}
                <li className="in-tasks-footer">
                  Sent one way into Tasks. Remove brings the note back here.
                  The task stays.
                </li>
              </ol>
            )}
          </div>
        )}
      </section>

      {/* ── First-capture signature moment (once, ever) ─────────── */}
      {firstCapture && (
        <FirstCaptureMoment onDone={() => setFirstCapture(false)} />
      )}

      {/* ── Undo toast ──────────────────────────────────────────── */}
      {undoTarget && (
        <div className="undo-toast" role="status" aria-live="polite">
          <span>Note deleted.</span>
          <button
            ref={undoBtnRef}
            type="button"
            className="undo-toast-btn"
            onClick={undoDelete}
          >
            Undo
          </button>
        </div>
      )}

      {/* ── Promote toast (error path only) ──────────────────────────
          Success cases are silent at this surface, the row gesture and
          the in-panel receipt are the visible confirmations, srConfirm
          carries the SR announce. This toast remains for error-with-Retry,
          where the in-panel receipt does not fire and a dead-end would
          otherwise occur. */}
      {promoteToast && (
        <div
          className={`promote-toast promote-toast--${promoteToast.kind}`}
          role="status"
          aria-live="polite"
        >
          <span>{promoteToast.message}</span>
          {promoteToast.kind === "error" && (
            <button
              type="button"
              className="undo-toast-btn"
              onClick={() => {
                const id = promoteToast.noteId;
                setPromoteToast(null);
                executePromote(id);
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* ── Right rail (authed state) ────────────────────────────
          Marketing copy (headline + promise) is removed in authed
          view, user already bought in. The four metadata rows give
          the rail its weight; a quiet reassurance line (Geist Mono,
          11px, ink-faint) anchors the bottom without competing. */}
      <aside className="product product--authed">
        <dl className="product-stats product-stats--first">
          <div>
            <dt>Privacy</dt>
            <dd>Private by default</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>
              {notes.length === 0 ? (
                "None yet"
              ) : (
                <>
                  <em>{notes.length}</em> {notes.length === 1 ? "note" : "notes"}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Last saved</dt>
            <dd>
              {lastSavedTs ? (
                <em>
                  <RelativeTime ts={lastSavedTs} referenceTime={referenceTime} />
                </em>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>In Tasks</dt>
            <dd>
              {archivedNotes.length === 0 ? (
                "—"
              ) : (
                <>
                  <em>{archivedNotes.length}</em>{" "}
                  {archivedNotes.length === 1 ? "note" : "notes"}
                </>
              )}
            </dd>
          </div>
        </dl>
        <p className="product-reassurance">
          Only you can see this.
        </p>
      </aside>
    </div>
  );
}
