"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { CaptureEmailRow, type CaptureState } from "@/modules/notes/app/CaptureEmailRow";
import {
  NOTES_LEGEND,
  NOTES_VIEW_LABELS,
  notesCopyForDomain,
  waitingLabel,
} from "@/modules/notes/lib/notes-copy";
import {
  countViews,
  derivePresentation,
  FILTER_LABELS,
  friendlyDate,
  groupByDay,
  isArchived,
  isSent,
  matchesFilter,
  matchesQuery,
  needsReview,
  noteSource,
  notesHref,
  SOURCE_LABELS,
  sortNotes,
  sourceCounts,
  viewFromParam,
  type NotebookFilter,
  type NotebookSort,
  type NotesView,
  type PresentableNote,
} from "@/modules/notes/lib/notes-view-model";
import type {
  NoteCaptureSource,
  NoteRead,
  PendingApprovedTasksSendRead,
} from "@/modules/notes/server/actions/notes";
import { taskFocusPath } from "@/lib/product-urls";
import { useUnsavedWork } from "@/components/app/unsaved-work-context";
import { parseProjectId } from "@/lib/projects/project-ref";
import { notebookRecoveryKey } from "@/modules/notes/lib/notes-recovery";
import type { TasksWorkspaceDestination } from "@/modules/notes/server/tasks-personalization";
import { Composer, type ComposerActions } from "@/modules/notes/app/workspace/Composer";
import { useNotebook } from "@/modules/notes/app/workspace/use-notebook";
import { useNoteMotion } from "@/modules/notes/app/workspace/use-note-motion";
import {
  BackIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  HelpIcon,
  KeyboardIcon,
  LockIcon,
  PencilIcon,
  RestoreIcon,
  SearchIcon,
  SortIcon,
  SourceIcon,
  TaskIcon,
} from "@/modules/notes/app/workspace/icons";
import { CaptureBar } from "./CaptureBar";
import {
  ActionMenu,
  notesOverlayOpen,
  ShortcutsSheet,
  TurnIntoTaskDialog,
  type MenuItem,
} from "./NotesDialogs";
import { NotesFilterMenu } from "./NotesFilterMenu";
import { NotesList, type ListSection } from "./NotesList";
import { NoteReader } from "./NoteReader";
import { NoteRow, type RowVariant } from "./NoteRow";
import { ReviewSession, type ReviewTally } from "./ReviewSession";

import styles from "./notes-workspace.module.css";

/**
 * Notes, rebuilt as a tool (v3, docs/design/v3/launcher.md §3.6–3.8, §4.4).
 *
 * Two panes, one question each. The list on the left is the notebook: a
 * capture bar, search, three views (All, To review, In Tasks), one Filter
 * menu, and the notes grouped by day. The right pane is whatever you are
 * doing: writing (the canvas, the resting state), reading and deciding (the
 * reader), or reviewing the queue one card at a time. Below 900px it is one
 * pane at a time, and capture is the bar at the foot of the screen that
 * opens into a sheet.
 *
 * The view and the open note live in the URL, written with the browser's own
 * History API so Back means what a person expects on a phone without paying
 * for a server render every time a row is clicked. Everything the notebook
 * guarantees (idempotent capture, compare-and-swap edits, the delete grace
 * period, locked sends) lives in use-notebook.ts and is unchanged.
 */

const NARROW_QUERY = "(max-width: 899px)";

/**
 * The one project a review build can send to.
 *
 * Demo mode never reads the Tasks catalogue, so without this the composer
 * would offer a project picker with nothing in it and Turn into task would
 * dead-end on "Pick a project first". Production always has the real
 * catalogue and never reaches this.
 */
const REVIEW_WORKSPACE: TasksWorkspaceDestination = {
  id: "review_workspace",
  name: "Review project",
  role: "owner",
  planningPeriodId: null,
  planningPeriodName: null,
  contextType: null,
  primaryDate: null,
  primaryDateLabel: null,
};
const subscribeNever = () => () => {};
const NO_TALLY: ReviewTally = { kept: 0, turned: 0, deleted: 0 };

function useSaveChord(): string {
  return useSyncExternalStore(
    subscribeNever,
    () => (/Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "⌘",
  );
}

function subscribeNarrow(onChange: () => void) {
  const media = window.matchMedia(NARROW_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Null on the server and the first paint; the layout itself is pure CSS. */
function useNarrow(): boolean | null {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => null,
  );
}

export interface NotesWorkspaceProps {
  initialNotes: NoteRead[];
  initialArchivedNotes: NoteRead[];
  initialPendingApprovedTaskSends: PendingApprovedTasksSendRead[];
  initialWorkspaceId: string | null;
  captureAllowed?: boolean;
  captureEmailState: CaptureState | null;
  tasksWorkspaces: TasksWorkspaceDestination[];
  activeDomain?: string | null;
  referenceTime: number;
  recoveryScope: string;
  demoMode: boolean;
  photoAvailable: boolean;
  speechSeparates: boolean;
  initialView?: NotesView;
  initialNoteId?: string | null;
}

export function NotesWorkspace(props: NotesWorkspaceProps) {
  return <NotesWorkspaceFrame key={notebookRecoveryKey(props.recoveryScope, props.initialWorkspaceId)} {...props} />;
}

const FILTER_EMPTY: Record<Exclude<NotebookFilter, "all" | "review">, string> = {
  typed: "No written notes yet.",
  voice: "No spoken notes yet.",
  photo: "No notes from a photo yet.",
  email: "No notes by email yet.",
};

function NotesWorkspaceFrame(props: NotesWorkspaceProps) {
  const copy = notesCopyForDomain(props.activeDomain);
  const saveChord = useSaveChord();
  const narrow = useNarrow();
  const now = props.referenceTime;

  const workspaces = useMemo(
    () =>
      props.tasksWorkspaces.length || !props.demoMode
        ? props.tasksWorkspaces
        : [REVIEW_WORKSPACE],
    [props.demoMode, props.tasksWorkspaces],
  );
  const canSendToTasks = props.captureAllowed !== false && workspaces.length > 0;
  const sendBlockedReason =
    props.captureAllowed === false
      ? "This project is unavailable for new work, so notes cannot become tasks here."
      : workspaces.length === 0
        ? "Make a project in Tasks first, then any note can become a task in it."
        : null;

  const [view, setView] = useState<NotesView>(props.initialView ?? "notebook");
  const [selectedId, setSelectedId] = useState<string | null>(props.initialNoteId ?? null);
  const [sort, setSort] = useState<NotebookSort>("newest");
  const [filter, setFilter] = useState<NotebookFilter>("all");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [taskDialogNote, setTaskDialogNote] = useState<NoteRead | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);

  const notebook = useNotebook({
    initialNotes: props.initialNotes,
    initialArchivedNotes: props.initialArchivedNotes,
    initialPendingApprovedTaskSends: props.initialPendingApprovedTaskSends,
    initialWorkspaceId: props.initialWorkspaceId,
    captureAllowed: props.captureAllowed,
    recoveryScope: props.recoveryScope,
    demoMode: props.demoMode,
    copy,
  });

  const captureRef = useRef<HTMLTextAreaElement>(null);
  const composerActions = useRef<ComposerActions | null>(null);
  const openFilterRef = useRef<(() => void) | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const liveRegionId = useId();

  // The list is allowed to lag the field by a frame. Typing must never wait
  // on 500 rows re-deriving themselves.
  const deferredQuery = useDeferredValue(notebook.query);
  const searching = Boolean(deferredQuery.trim());
  const allNotes = notebook.notes as PresentableNote[];
  // Which notes are mid-beat: arriving in their slot, leaving it, or resolving
  // into "In Tasks". Reads the whole notebook, not the filtered list, so a
  // change of filter is never mistaken for a note arriving.
  const motion = useNoteMotion(notebook.notes);
  // A note still on its way to the server is not yet a note the account has.
  // Counting it made the badge disagree with the database.
  const counts = useMemo(
    () =>
      countViews([
        ...allNotes.filter((note) => {
          const state = notebook.mutationStates[note.id];
          return state !== "pending" && state !== "offline" && state !== "failed";
        }),
        ...(notebook.archivedNotes as PresentableNote[]),
      ]),
    [allNotes, notebook.archivedNotes, notebook.mutationStates],
  );
  const bySource = useMemo(() => sourceCounts(allNotes), [allNotes]);

  // ── URL state ───────────────────────────────────────────────────────

  const writeUrl = useCallback((nextView: NotesView, noteId: string | null, replace = false) => {
    const href = notesHref(nextView, noteId, parseProjectId(props.initialWorkspaceId));
    if (typeof window === "undefined") return;
    if (window.location.pathname + window.location.search === href) return;
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }, [props.initialWorkspaceId]);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setView(viewFromParam(params.get("view")));
      setSelectedId(params.get("note"));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // ── Review session ──────────────────────────────────────────────────

  // The queue shrinks as decisions are made, so the index only moves when
  // someone skips. Deciding always leaves the next note at the same position.
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewedThisSession, setReviewedThisSession] = useState(0);
  const [tally, setTally] = useState<ReviewTally>(NO_TALLY);

  const goToView = useCallback(
    (nextView: NotesView) => {
      if (nextView === "review" && view !== "review") {
        // A new session counts from zero.
        setReviewIndex(0);
        setReviewedThisSession(0);
        setTally(NO_TALLY);
      }
      setView(nextView);
      // Each view starts with nothing open, so the canvas is in front.
      setSelectedId(null);
      writeUrl(nextView, null);
    },
    [view, writeUrl],
  );

  const selectNote = useCallback(
    (noteId: string | null, options?: { replace?: boolean }) => {
      setSelectedId(noteId);
      writeUrl(view, noteId, options?.replace ?? false);
    },
    [view, writeUrl],
  );

  // ── Lists ───────────────────────────────────────────────────────────

  /**
   * What the list draws, and what the notebook actually holds.
   *
   * They differ for one beat. A note that has just been deleted keeps its row
   * for --motion-base so the row can close the gap behind itself, so it is
   * filtered and sorted with everything else and lands back in its own slot.
   * Counts, the selection and the keyboard walk read the second list, which
   * never carries a row that is on its way out.
   */
  const notebookRows = useMemo(() => {
    const source = deferredQuery.trim()
      ? (notebook.searchResults as PresentableNote[])
      : allNotes;
    const withDepartures = motion.departing.length
      ? [...source, ...(motion.departing as PresentableNote[])]
      : source;
    return sortNotes(
      withDepartures.filter(
        (note) =>
          !isArchived(note) &&
          matchesFilter(note, filter) &&
          (!deferredQuery.trim() || matchesQuery(note, deferredQuery)),
      ),
      sort,
    );
  }, [allNotes, deferredQuery, filter, motion.departing, notebook.searchResults, sort]);

  const notebookNotes = useMemo(
    () =>
      motion.departing.length
        ? notebookRows.filter((note) => !motion.isDeparting(note.id))
        : notebookRows,
    [motion, notebookRows],
  );

  const sentNotes = useMemo(
    () =>
      sortNotes(
        [...allNotes, ...(notebook.archivedNotes as PresentableNote[])].filter((note) => isSent(note)),
        "newest",
      ),
    [allNotes, notebook.archivedNotes],
  );

  const groups = useMemo(
    () => (searching ? null : groupByDay(notebookRows, now)),
    [notebookRows, now, searching],
  );

  /**
   * Which note is open, derived rather than stored.
   *
   * Only an explicit choice opens a note: a wide screen does not fall back to
   * the newest one, so the capture canvas stays in front until someone picks
   * a row. A choice that has left the notebook simply closes.
   */
  const effectiveSelectedId = useMemo(() => {
    if (!selectedId || view === "review") return null;
    const pool: readonly PresentableNote[] =
      view === "sent" ? sentNotes : allNotes.filter((note) => !isArchived(note));
    return pool.some((note) => note.id === selectedId) ? selectedId : null;
  }, [allNotes, selectedId, sentNotes, view]);

  const selectedNote = useMemo(
    () =>
      view === "notebook"
        ? (notebook.notes.find((note) => note.id === effectiveSelectedId) ?? null)
        : null,
    [notebook.notes, effectiveSelectedId, view],
  );
  const selectedSent = useMemo(
    () => (view === "sent" ? (sentNotes.find((note) => note.id === effectiveSelectedId) ?? null) : null),
    [effectiveSelectedId, sentNotes, view],
  );

  /**
   * Load the open note into the editor the moment it changes.
   *
   * During render, not in an effect: an effect would leave the previous
   * note's words in the field for one paint, and a keystroke landing in that
   * frame would be saved against the wrong note.
   */
  const [loadedNoteId, setLoadedNoteId] = useState<string | null>(null);
  // Counts swaps, not opens. The reader settles into a note it has been handed
  // in place of another one; it does not animate the note the page arrived
  // with, because that would be a page-load animation.
  const [paneSwaps, setPaneSwaps] = useState(0);
  if (loadedNoteId !== (selectedNote?.id ?? null)) {
    if (loadedNoteId !== null && selectedNote) setPaneSwaps((count) => count + 1);
    setLoadedNoteId(selectedNote?.id ?? null);
    notebook.applyOpenNote(selectedNote);
  }

  const reviewQueue = useMemo(
    () => sortNotes(allNotes.filter((note) => needsReview(note)), "oldest"),
    [allNotes],
  );
  const reviewPosition = Math.min(reviewIndex, Math.max(0, reviewQueue.length - 1));
  const reviewNote = reviewQueue[reviewPosition] ?? null;
  const nextReviewNote =
    reviewQueue.length > 1 ? (reviewQueue[(reviewPosition + 1) % reviewQueue.length] ?? null) : null;

  const main: "capture" | "reader" | "review" | "sent" =
    view === "review" ? "review" : selectedNote ? "reader" : selectedSent ? "sent" : "capture";

  // ── Actions ─────────────────────────────────────────────────────────

  /**
   * Back to the canvas: nothing open, the composer in front with its draft
   * kept. `mode` opens voice (its consent step first) or the photo picker,
   * inside the same click, so the browser still counts it as the person's.
   */
  const newNote = useCallback(
    (mode?: "voice" | "photo") => {
      if (view === "review") {
        setView("notebook");
        writeUrl("notebook", null);
      } else {
        writeUrl(view, null);
      }
      setSelectedId(null);
      if (mode === "voice") composerActions.current?.openVoice();
      else if (mode === "photo") composerActions.current?.openPhoto();
      else window.setTimeout(() => captureRef.current?.focus({ preventScroll: true }), 0);
    },
    [view, writeUrl],
  );

  const saveExtractedNotes = useCallback(
    async (
      bodies: string[],
      source: NoteCaptureSource,
    ): Promise<{ ok: boolean; remaining: string[] }> => {
      const failed: string[] = [];
      let firstId: string | null = null;
      for (const body of bodies) {
        const result = await notebook.captureNote(body, source);
        if (!result?.ok) failed.push(body);
        else if (!firstId) firstId = result.id;
      }
      const saved = bodies.length - failed.length;
      if (!failed.length) {
        notebook.showToast({
          tone: "info",
          message: bodies.length === 1 ? "Note saved." : `${bodies.length} notes saved.`,
        });
        if (firstId) setFreshId(firstId);
        return { ok: true, remaining: [] };
      }
      // Hand back only what did not land. Retrying the whole set used to
      // create a second copy of everything that had already succeeded.
      notebook.showToast({
        tone: "error",
        message:
          saved > 0
            ? `${saved} saved, ${failed.length} still here. Try those again.`
            : "None of those saved. Your words are still here.",
      });
      return { ok: false, remaining: failed };
    },
    [notebook],
  );

  /**
   * Save from the canvas. The canvas stays in front and clears; the note
   * arrives at the top of Today and is marked, so the next thought can go
   * straight down. On a phone the sheet closes behind it.
   */
  const saveDraft = useCallback(async () => {
    const id = await notebook.saveDraft();
    if (id) {
      setFreshId(id);
      if (narrow) (document.activeElement as HTMLElement | null)?.blur();
    }
    return id;
  }, [narrow, notebook]);

  // Depends on beginSend, not on the whole notebook object. The notebook is a
  // fresh object on every render, so taking it as a dependency made this
  // callback new on every keystroke, and every memoised row re-rendered with
  // it, the exact cost NoteRow's memo exists to avoid.
  const beginSend = notebook.beginSend;
  const openTaskDialog = useCallback(
    (note: NoteRead) => {
      const known = workspaces.some((item) => item.id === props.initialWorkspaceId);
      const workspaceId =
        (known ? props.initialWorkspaceId : null) ?? workspaces[0]?.id ?? "";
      beginSend(note, workspaceId);
      setTaskDialogNote(note);
    },
    [beginSend, props.initialWorkspaceId, workspaces],
  );

  /**
   * Delete from a row, and hand focus on first. The departing row goes
   * inert, which would drop focus to the top of the document; the next row
   * (or the one before) takes it instead, so the list stays under the hands.
   */
  const deleteNote = notebook.deleteNote;
  // Read through a ref so the rows' delete handler keeps one identity and the
  // memoised rows do not all re-render every time the selection moves.
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  const deleteFromRow = useCallback(
    (note: NoteRead, rowId: string) => {
      const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-note-row]") ?? []);
      const index = rows.findIndex((row) => row.getAttribute("data-note-id") === rowId);
      const neighbour = rows[index + 1] ?? rows[index - 1] ?? null;
      deleteNote(note);
      if (selectedIdRef.current === note.id) selectNote(null, { replace: true });
      window.setTimeout(() => {
        if (neighbour?.isConnected) neighbour.focus({ preventScroll: true });
        else searchRef.current?.focus({ preventScroll: true });
      }, 0);
    },
    [deleteNote, selectNote],
  );

  const advanceReview = useCallback((decision: keyof ReviewTally) => {
    setReviewedThisSession((current) => current + 1);
    setTally((current) => ({ ...current, [decision]: current[decision] + 1 }));
    setReviewIndex(0);
  }, []);

  /**
   * Move past a note without deciding. It stays in the queue, and the queue
   * wraps: pressed at the end it returned to a clamped index and did nothing
   * at all while still looking pressable.
   */
  const skipReview = useCallback(() => {
    setReviewIndex((current) => (current + 1) % Math.max(1, reviewQueue.length));
  }, [reviewQueue.length]);

  const reviewKeep = useCallback(
    async (note: NoteRead) => {
      await notebook.keepInNotes(note);
      advanceReview("kept");
    },
    [advanceReview, notebook],
  );

  const reviewDelete = useCallback(
    (note: NoteRead) => {
      notebook.deleteNote(note);
      advanceReview("deleted");
    },
    [advanceReview, notebook],
  );

  const totalToReview = reviewQueue.length + reviewedThisSession;
  const reviewDone = Math.min(reviewedThisSession, totalToReview);

  const selectRow = useCallback(
    (id: string) => {
      if (view === "review") {
        const index = reviewQueue.findIndex((note) => note.id === id);
        if (index >= 0) setReviewIndex(index);
        return;
      }
      selectNote(id);
    },
    [reviewQueue, selectNote, view],
  );

  const cancelSend = notebook.cancelSend;
  const closeTaskDialog = useCallback(() => {
    cancelSend();
    setTaskDialogNote(null);
  }, [cancelSend]);

  /** From In Tasks back to the same note in the notebook. */
  const openInNotebook = useCallback(
    (noteId: string) => {
      setView("notebook");
      setSelectedId(noteId);
      writeUrl("notebook", noteId);
    },
    [writeUrl],
  );

  // ── Keyboard ────────────────────────────────────────────────────────

  useEffect(() => {
    const focusReader = () =>
      window.setTimeout(
        () => document.querySelector<HTMLElement>("[data-note-display], #note-body")?.focus({ preventScroll: true }),
        0,
      );
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.isComposing || event.keyCode === 229) return;
      // Dialogs, sheets and menus own the keyboard while they are open.
      if (notesOverlayOpen()) return;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        if (privacyOpen) {
          event.preventDefault();
          setPrivacyOpen(false);
          return;
        }
        if (notebook.query && target === searchRef.current) {
          event.preventDefault();
          notebook.setQuery("");
          return;
        }
        // On a phone the capture sheet closes; the words stay.
        if (narrow && target === captureRef.current) {
          event.preventDefault();
          captureRef.current?.blur();
          return;
        }
        if (effectiveSelectedId && !typing) {
          event.preventDefault();
          if (narrow) {
            selectNote(null);
            return;
          }
          (target as HTMLElement | null)?.blur?.();
          listRef.current
            ?.querySelector<HTMLElement>(`[data-note-id="${effectiveSelectedId}"]`)
            ?.focus({ preventScroll: false });
        }
        return;
      }

      // Down from search walks into the results.
      if (event.key === "ArrowDown" && target === searchRef.current) {
        const first = listRef.current?.querySelector<HTMLElement>("[data-note-row]");
        if (first) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === "n") {
        event.preventDefault();
        newNote();
        return;
      }
      // Review owns T, E, L and Delete while it is on screen.
      if (view === "review") return;

      if (key === "r" && counts.review > 0) {
        event.preventDefault();
        goToView("review");
        return;
      }
      if (key === "f" && view === "notebook") {
        event.preventDefault();
        openFilterRef.current?.();
        return;
      }

      // The row under focus, for the single-key decisions.
      const rowElement = target?.closest<HTMLElement>("[data-note-row]") ?? null;
      const rowId = rowElement?.getAttribute("data-note-id") ?? null;
      const rowNote = rowId ? (notebook.notes.find((note) => note.id === rowId) ?? null) : null;
      const settled = rowNote ? !notebook.mutationStates[rowNote.id] : false;

      if ((key === "Enter" || key === "o") && rowElement && rowId) {
        event.preventDefault();
        selectRow(rowId);
        if (view === "notebook" || view === "sent") focusReader();
        return;
      }
      // The open note answers the same keys as a focused row (T, E, Delete),
      // so the decision bar's key hints are true wherever focus sits.
      const readerNote =
        !rowElement && main === "reader" && selectedNote && !notebook.mutationStates[selectedNote.id]
          ? selectedNote
          : null;
      if (key === "e" && view === "notebook" && ((rowNote && settled) || readerNote)) {
        const candidate = rowNote && settled ? rowNote : readerNote!;
        event.preventDefault();
        if (!notebook.readOnly && needsReview(candidate as PresentableNote)) void notebook.keepInNotes(candidate);
        return;
      }
      if (key === "t" && canSendToTasks && !notebook.readOnly) {
        // T only ever opens the sheet; nothing is sent without it.
        const candidate = rowNote && settled ? rowNote : !rowElement && main === "reader" ? selectedNote : null;
        if (candidate && !isSent(candidate as PresentableNote) && view === "notebook") {
          event.preventDefault();
          openTaskDialog(candidate);
        }
        return;
      }
      if ((key === "Delete" || key === "Backspace") && rowNote && settled && view === "notebook") {
        event.preventDefault();
        deleteFromRow(rowNote, rowNote.id);
        return;
      }
      if ((key === "Delete" || key === "Backspace") && readerNote && view === "notebook" && !notebook.readOnly) {
        event.preventDefault();
        notebook.deleteNote(readerNote);
        selectNote(null);
        return;
      }

      if (!["j", "k", "ArrowDown", "ArrowUp"].includes(key)) return;
      const rows = Array.from(
        listRef.current?.querySelectorAll<HTMLButtonElement>("[data-note-row]") ?? [],
      );
      if (!rows.length) return;
      if ((key === "ArrowDown" || key === "ArrowUp") && !rowElement) return;
      event.preventDefault();
      const current = rows.indexOf(document.activeElement as HTMLButtonElement);
      const forward = key === "j" || key === "ArrowDown";
      const next =
        current < 0
          ? forward
            ? 0
            : rows.length - 1
          : Math.max(0, Math.min(rows.length - 1, current + (forward ? 1 : -1)));
      const row = rows[next];
      row?.focus();
      // Open what is focused on a wide screen. Walking the list while the
      // reader stayed on another note made the shortcut look broken.
      const id = row?.getAttribute("data-note-id");
      if (id && !narrow) selectNote(id, { replace: true });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    canSendToTasks,
    counts.review,
    deleteFromRow,
    effectiveSelectedId,
    goToView,
    main,
    narrow,
    newNote,
    notebook,
    openTaskDialog,
    privacyOpen,
    selectNote,
    selectRow,
    selectedNote,
    view,
  ]);

  /**
   * Keep focus somewhere on a phone.
   *
   * Below 900px the list and the reader swap by `display: none`, which
   * removes whichever one held focus and drops the caret to <body>. A
   * screen reader loses its place on every open and every close.
   */
  const lastNarrowNote = useRef<string | null>(null);
  useEffect(() => {
    if (!narrow) return;
    const previous = lastNarrowNote.current;
    lastNarrowNote.current = effectiveSelectedId;
    if (previous === effectiveSelectedId) return;
    const frame = window.setTimeout(() => {
      if (effectiveSelectedId) {
        document
          .querySelector<HTMLElement>("[data-notes-back]")
          ?.focus({ preventScroll: true });
        return;
      }
      const row = previous
        ? document.querySelector<HTMLElement>(`[data-note-id="${previous}"]`)
        : null;
      (row ?? listRef.current?.querySelector<HTMLElement>("[data-note-row]"))?.focus({
        preventScroll: true,
      });
    }, 0);
    return () => window.clearTimeout(frame);
  }, [effectiveSelectedId, narrow]);

  // Warn before leaving with unsaved words, and only then.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // Captures still on their way to the server live only in this tab, so
      // closing it loses them. They belong in this test as much as a draft.
      const dirty =
        Boolean(notebook.draft.trim()) ||
        notebook.hasUnsavedWork ||
        (selectedNote && notebook.detailBody !== selectedNote.body);
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [notebook.detailBody, notebook.draft, notebook.hasUnsavedWork, selectedNote]);

  // The suite's unsaved-work signal (WP6): the same three dirty truths the
  // beforeunload guard above reads, published so a guarded Project switch is
  // held while any of them stands. beforeunload cannot cover that case: it
  // fires on tab close, never on a client-side navigation. The predicates
  // here and in that guard must stay in agreement. The claims carry copy
  // only; saving, retrying and discarding stay in this workspace, and a
  // refusal rendered elsewhere sends the founder back here to resolve it.
  // Flag off there is no provider, `unsavedWork` is null, and both effects
  // do nothing.
  const unsavedWork = useUnsavedWork();
  const draftDirty = Boolean(notebook.draft.trim());
  const captureDirty = notebook.hasUnsavedWork;
  const editDirty = Boolean(
    selectedNote && notebook.detailBody !== selectedNote.body,
  );
  useEffect(() => {
    if (!unsavedWork) return;
    if (draftDirty) {
      unsavedWork.publish({
        source: "notes-draft",
        description: "A note you started in Notes hasn’t been saved.",
      });
    } else {
      unsavedWork.clear("notes-draft");
    }
    if (editDirty) {
      unsavedWork.publish({
        source: "notes-edit",
        description: "An edit to a note hasn’t been saved.",
      });
    } else {
      unsavedWork.clear("notes-edit");
    }
    if (captureDirty) {
      unsavedWork.publish({
        source: "notes-capture",
        description: "Notes are still saving.",
      });
    } else {
      unsavedWork.clear("notes-capture");
    }
  }, [captureDirty, draftDirty, editDirty, unsavedWork]);

  // Leaving Notes withdraws its claims. Recovery stays bound to this actor
  // and note; a claim no mounted surface can resolve would hold every future
  // switch with no way out.
  useEffect(() => {
    if (!unsavedWork) return;
    return () => {
      unsavedWork.clear("notes-draft");
      unsavedWork.clear("notes-edit");
      unsavedWork.clear("notes-capture");
    };
  }, [unsavedWork]);

  useEffect(() => {
    if (!privacyOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!footerRef.current?.contains(event.target as Node)) setPrivacyOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [privacyOpen]);

  // ── Rendering ───────────────────────────────────────────────────────

  const viewHref = (candidate: NotesView) =>
    notesHref(candidate, null, parseProjectId(props.initialWorkspaceId));

  const renderRow = (variant: RowVariant) => {
    const row = (note: PresentableNote) => (
      <NoteRow
        key={note.id}
        note={note}
        variant={variant}
        selected={variant === "review" ? note.id === reviewNote?.id : note.id === effectiveSelectedId}
        state={notebook.mutationStates[note.id]}
        arriving={motion.isArriving(note.id)}
        departing={motion.isDeparting(note.id)}
        promoted={motion.isPromoted(note.id)}
        fresh={note.id === freshId}
        now={now}
        query={deferredQuery}
        canSendToTasks={canSendToTasks}
        readOnly={notebook.readOnly}
        demoMode={props.demoMode}
        onSelect={selectRow}
        onRetry={notebook.retryCapture}
        onKeep={notebook.keepInNotes}
        onTurnIntoTask={openTaskDialog}
        onDelete={deleteFromRow}
        onRestore={notebook.restoreNote}
      />
    );
    return row;
  };

  const activeSourceFilter = filter !== "all" && filter !== "review" ? filter : null;
  const hasNotes = counts.notebook > 0 || allNotes.length > 0;
  const firstUse = !hasNotes && view === "notebook";

  let listBody: React.ReactNode;
  if (view === "review") {
    listBody = reviewQueue.length ? (
      <NotesList
        sections={[{ key: "review", label: NOTES_LEGEND.waiting, notes: reviewQueue }]}
        renderRow={renderRow("review")}
      />
    ) : (
      <div className={styles.listEmpty}>
        <p>{copy.notebook.reviewEmpty}</p>
        <button type="button" className={styles.linkButton} onClick={() => newNote()}>
          Write a note
        </button>
      </div>
    );
  } else if (view === "sent") {
    listBody = sentNotes.length ? (
      <NotesList sections={[{ key: "sent", label: null, notes: sentNotes }]} renderRow={renderRow("sent")} />
    ) : (
      <p className={styles.listEmpty}>{copy.notebook.sentEmpty}</p>
    );
  } else if (notebookRows.length) {
    const sections: ListSection[] = groups
      ? groups.map((group) => ({ key: group.key, label: group.label, notes: group.notes }))
      : [{ key: "results", label: null, notes: notebookRows }];
    listBody = <NotesList sections={sections} renderRow={renderRow("notebook")} />;
  } else if (searching) {
    listBody = (
      <div className={styles.listEmpty}>
        <p>No notes match “{deferredQuery.trim()}”.</p>
        <button type="button" className={styles.linkButton} onClick={() => notebook.setQuery("")}>
          Clear search
        </button>
      </div>
    );
  } else if (activeSourceFilter) {
    listBody = (
      <div className={styles.listEmpty}>
        <p>{FILTER_EMPTY[activeSourceFilter]}</p>
        <button type="button" className={styles.linkButton} onClick={() => setFilter("all")}>
          Show all
        </button>
      </div>
    );
  } else {
    listBody = (
      <div className={styles.listEmpty} data-first-use="">
        <span className={styles.listEmptyMark} aria-hidden="true">
          <PencilIcon />
        </span>
        <p>{copy.notebook.empty}</p>
      </div>
    );
  }

  const reviewPromptVisible = view === "notebook" && counts.review > 0 && !searching;

  const headerMenu: MenuItem[] = [
    {
      label: "Newest first",
      icon: sort === "newest" ? <CheckIcon /> : <SortIcon />,
      onSelect: () => setSort("newest"),
    },
    {
      label: "Oldest first",
      icon: sort === "oldest" ? <CheckIcon /> : <SortIcon />,
      onSelect: () => setSort("oldest"),
    },
    {
      label: "Keyboard shortcuts",
      icon: <KeyboardIcon />,
      onSelect: () => setShortcutsOpen(true),
    },
  ];

  const recent = sentNotes.filter((note) => !isArchived(note)).slice(0, 3);
  const captureDisabled = notebook.readOnly || props.captureAllowed === false;

  return (
    <div
      className={styles.root}
      data-notes-workspace=""
      data-view={view}
      data-main={main}
      data-first-use={firstUse ? "" : undefined}
      data-recovery-scope={props.recoveryScope}
      data-recovery-project={props.initialWorkspaceId ?? ""}
    >
      <div className={styles.frame}>
        {/* ── The notebook list ─────────────────────────────────── */}
        <section className={styles.listPane} aria-labelledby="notes-heading">
          <header className={styles.listHead}>
            <div className={styles.titleRow}>
              <h1 className={styles.title} id="notes-heading">
                Notes
              </h1>
              <div className={styles.titleActions}>
                <button
                  type="button"
                  className={styles.newButton}
                  onClick={() => newNote()}
                  aria-keyshortcuts="N"
                  aria-label="New note"
                >
                  <PencilIcon />
                </button>
                <ActionMenu label="Notes options" items={headerMenu} className={styles.headMore} />
              </div>
            </div>

            <CaptureBar
              placeholder={copy.notebook.captureBar}
              draft={notebook.draft}
              disabled={captureDisabled}
              disabledReason={captureDisabled ? "New notes are off here." : null}
              voiceAvailable={!captureDisabled}
              photoAvailable={props.photoAvailable}
              onWrite={() => newNote()}
              onVoice={() => newNote("voice")}
              onPhoto={() => newNote("photo")}
            />

            {firstUse ? null : (
              <>
                <div className={styles.search}>
                  <SearchIcon />
                  <label className={styles.srOnly} htmlFor="notes-search">
                    Search notes
                  </label>
                  <input
                    id="notes-search"
                    ref={searchRef}
                    className={styles.searchInput}
                    type="search"
                    value={notebook.query}
                    placeholder="Search notes"
                    aria-keyshortcuts="/"
                    aria-controls="notes-list"
                    autoComplete="off"
                    onChange={(event) => notebook.setQuery(event.target.value)}
                  />
                  {!notebook.query ? (
                    <span className={styles.searchKey} aria-hidden="true">
                      /
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.searchClear}
                      aria-label="Clear search"
                      onClick={() => {
                        notebook.setQuery("");
                        searchRef.current?.focus();
                      }}
                    >
                      <CloseIcon />
                    </button>
                  )}
                </div>

                <div className={styles.viewRow}>
                  <nav className={styles.views} aria-label="Notes views">
                    {(["notebook", "review", "sent"] as const).map((candidate) => {
                      const count = candidate === "notebook" ? counts.notebook : counts[candidate];
                      return (
                        <a
                          key={candidate}
                          className={styles.viewTab}
                          data-view={candidate}
                          href={viewHref(candidate)}
                          aria-current={view === candidate ? "page" : undefined}
                          onClick={(event) => {
                            if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                            event.preventDefault();
                            goToView(candidate);
                          }}
                        >
                          {/* The view key and the ?view=sent URL are unchanged. */}
                          <span className={styles.viewName}>{NOTES_VIEW_LABELS[candidate]}</span>
                          <span className={styles.viewCount}>{count}</span>
                        </a>
                      );
                    })}
                  </nav>
                  {view === "notebook" ? (
                    <NotesFilterMenu
                      filter={filter}
                      counts={bySource}
                      onChange={setFilter}
                      openRef={openFilterRef}
                    />
                  ) : null}
                </div>
                {activeSourceFilter && view === "notebook" ? (
                  <div className={styles.filterChips}>
                    <button
                      type="button"
                      className={styles.filterChip}
                      onClick={() => setFilter("all")}
                      aria-label={`Remove filter: ${FILTER_LABELS[activeSourceFilter]}`}
                    >
                      <SourceIcon source={activeSourceFilter} />
                      {FILTER_LABELS[activeSourceFilter]}
                      <CloseIcon />
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </header>

          <div
            className={styles.listScroll}
            id="notes-list"
            ref={listRef}
            aria-label={view === "review" ? "Notes to review" : view === "sent" ? "Notes in Tasks" : "Your notes"}
            role="region"
          >
            {reviewPromptVisible ? (
              <div className={styles.reviewPrompt}>
                <div className={styles.reviewPromptText}>
                  <p className={styles.reviewPromptTitle}>
                    <span className={styles.waitingDot} aria-hidden="true" />
                    {waitingLabel(copy, counts.review)}
                  </p>
                  <p className={styles.reviewPromptBody}>
                    {canSendToTasks ? copy.notebook.reviewPrompt : copy.notebook.reviewPromptNoTasks}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.reviewPromptButton}
                  onClick={() => goToView("review")}
                  aria-keyshortcuts="R"
                >
                  Start review
                </button>
              </div>
            ) : null}
            {searching && view === "notebook" ? (
              <p className={styles.matchCount} role="status">
                {notebookNotes.length === 1 ? "1 match" : `${notebookNotes.length} matches`}
                {notebook.searchState === "fallback" ? " · Showing what is loaded" : ""}
              </p>
            ) : null}
            {listBody}
          </div>

          {hasNotes ? (
            <footer className={styles.listFoot} ref={footerRef}>
              <span className={styles.legendItem} title={NOTES_LEGEND.waiting}>
                <span className={styles.waitingDot} aria-hidden="true" />
                <span aria-hidden="true">{NOTES_LEGEND.waitingShort}</span>
                <span className={styles.srOnly}>{NOTES_LEGEND.waiting}</span>
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendCheck} aria-hidden="true">
                  <CheckIcon />
                </span>
                {NOTES_LEGEND.inTasks}
              </span>
              <button
                type="button"
                className={styles.legendButton}
                aria-expanded={privacyOpen}
                aria-controls="notes-privacy"
                onClick={() => setPrivacyOpen((current) => !current)}
              >
                <LockIcon />
                {NOTES_LEGEND.private}
              </button>
              <button
                type="button"
                className={styles.legendHelp}
                aria-keyshortcuts="?"
                aria-label="Keyboard shortcuts"
                onClick={() => setShortcutsOpen(true)}
              >
                <HelpIcon />
              </button>
              {privacyOpen ? (
                <div className={styles.popover} id="notes-privacy" role="dialog" aria-labelledby="notes-privacy-title">
                  <h2 className={styles.popoverTitle} id="notes-privacy-title">
                    Only you can read your notes. Speaking and photographing send words out to be read.
                  </h2>
                  <dl className={styles.popoverList}>
                    <div>
                      <dt>Who can read them</dt>
                      <dd>
                        Only you. Notes belong to your account, not to a shared project, so nobody you
                        work with can open them.
                      </dd>
                    </div>
                    <div>
                      <dt>What you type</dt>
                      <dd>
                        Stays on your device until you save it, then is stored on your account. Nothing
                        you type is sent anywhere else.
                      </dd>
                    </div>
                    <div>
                      <dt>What you speak, and photos you take</dt>
                      <dd>
                        These two do leave your device. Your browser turns speech into text with its own
                        speech service, and the text, or the photo, is sent to Anthropic, which Signal
                        Studio uses to turn it into notes. No recording is kept, because none is made, and
                        the photo is read and then discarded. If you would rather nothing left the device,
                        type the note instead.
                      </dd>
                    </div>
                    <div>
                      <dt>When a note becomes a task</dt>
                      <dd>
                        Only the task wording you approve crosses over. Everyone in that project can see
                        the task. The note stays here, private, unchanged.
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </footer>
          ) : null}
        </section>

        {/* ── Capture: the resting state of the right pane ──────── */}
        <section className={styles.canvas} aria-labelledby="notes-canvas-title" data-notes-canvas="">
          <div className={styles.canvasInner}>
            <div className={styles.canvasHead}>
              <h2 className={styles.canvasTitle} id="notes-canvas-title">
                {copy.notebook.canvasTitle}
              </h2>
              <button
                type="button"
                className={styles.sheetClose}
                onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
              >
                Done
              </button>
            </div>
            {props.captureAllowed === false ? (
              <p className={styles.restricted} role="note">
                This project is unavailable for new work. Your private notes are still here.
              </p>
            ) : null}
            <Composer
              earlierDeviceCopy={notebook.earlierDeviceCopy}
              copy={copy}
              draft={notebook.draft}
              setDraft={notebook.setDraft}
              onSaveDraft={saveDraft}
              onSaveNotes={saveExtractedNotes}
              captureStatus={notebook.captureStatus}
              captureError={notebook.captureError}
              clearCaptureError={() => notebook.setCaptureError(null)}
              readOnly={captureDisabled}
              saveChord={saveChord}
              photoAvailable={props.photoAvailable}
              speechSeparates={props.speechSeparates}
              demoMode={props.demoMode}
              fieldRef={captureRef}
              actionsRef={composerActions}
            />
            <p className={styles.canvasAssurance}>
              <LockIcon />
              {copy.notebook.canvasAssurance}
            </p>

            {!hasNotes ? (
              <ul className={styles.canvasTips} aria-label="Ways to capture">
                <li>
                  <span className={styles.tipMark} aria-hidden="true">
                    <SourceIcon source="typed" />
                  </span>
                  <span>
                    <strong>Type it</strong> and press {saveChord} Enter
                  </span>
                </li>
                <li>
                  <span className={styles.tipMark} aria-hidden="true">
                    <SourceIcon source="voice" />
                  </span>
                  <span>
                    <strong>Say it out loud</strong> and Notes writes it down
                  </span>
                </li>
                <li>
                  <span className={styles.tipMark} aria-hidden="true">
                    <SourceIcon source="photo" />
                  </span>
                  <span>
                    <strong>Photograph a page</strong> and keep the words
                  </span>
                </li>
              </ul>
            ) : counts.notebook < 5 ? (
              <p className={styles.canvasTip}>You can also say a note out loud, or photograph a page.</p>
            ) : null}

            {props.captureEmailState ? (
              <details className={styles.moreWays}>
                <summary className={styles.moreWaysSummary}>
                  <ChevronRightIcon />
                  {copy.notebook.moreWays}
                </summary>
                <CaptureEmailRow
                  state={props.captureEmailState}
                  onFeedback={(feedback) =>
                    notebook.showToast({
                      tone: feedback.state === "saved" ? "info" : "error",
                      message: feedback.message,
                    })
                  }
                />
              </details>
            ) : null}

            {recent.length ? (
              <section className={styles.recent} aria-labelledby="notes-recent-title">
                <h3 className={styles.recentTitle} id="notes-recent-title">
                  {copy.notebook.recentTitle}
                </h3>
                <ul className={styles.recentList}>
                  {recent.map((note) => (
                    <li key={note.id} className={styles.recentItem}>
                      <span className={styles.legendCheck} aria-hidden="true">
                        <CheckIcon />
                      </span>
                      <span className={styles.recentText}>
                        {note.extractBody || derivePresentation(note.body).title}
                      </span>
                      <a className={styles.recentLink} href={taskFocusPath(note.promotedTaskId ?? "")}>
                        Open task
                        <ChevronRightIcon />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </section>

        {/* ── Reading, reviewing, or what became a task ─────────── */}
        <section className={styles.stage} aria-label={main === "review" ? "Review" : "Open note"}>
          {main === "reader" && selectedNote ? (
            <NoteReader
              note={selectedNote}
              notebook={notebook}
              now={now}
              detailRef={detailRef}
              onBack={() => selectNote(null)}
              onTurnIntoTask={() => openTaskDialog(selectedNote)}
              onDelete={() => {
                notebook.deleteNote(selectedNote);
                selectNote(null);
              }}
              canSendToTasks={canSendToTasks}
              sendBlockedReason={sendBlockedReason}
              settle={paneSwaps > 0}
            />
          ) : null}

          {main === "review" ? (
            <ReviewSession
              note={reviewNote}
              nextNote={nextReviewNote}
              done={reviewDone}
              total={totalToReview}
              tally={tally}
              now={now}
              copy={copy}
              canSendToTasks={canSendToTasks}
              canSkip={reviewQueue.length > 1}
              settle={reviewedThisSession > 0 || reviewIndex > 0}
              onKeep={reviewKeep}
              onDelete={reviewDelete}
              onTurnIntoTask={openTaskDialog}
              onSkip={skipReview}
              onDone={() => goToView("notebook")}
            />
          ) : null}

          {main === "sent" && selectedSent ? (
            <SentDetail
              note={selectedSent}
              now={now}
              restoring={notebook.restoringId === selectedSent.id}
              demoMode={props.demoMode}
              onBack={() => selectNote(null)}
              onRestore={() => void notebook.restoreNote(selectedSent as NoteRead)}
              onOpenInNotebook={() => openInNotebook(selectedSent.id)}
            />
          ) : null}
        </section>
      </div>

      {taskDialogNote ? (
        <TurnIntoTaskDialog
          note={taskDialogNote}
          notebook={notebook}
          workspaces={workspaces}
          copy={copy}
          onClose={closeTaskDialog}
          onCreated={() => {
            if (view === "review") advanceReview("turned");
          }}
        />
      ) : null}

      {shortcutsOpen ? (
        <ShortcutsSheet
          onClose={() => setShortcutsOpen(false)}
          saveChord={saveChord}
          canSendToTasks={canSendToTasks}
        />
      ) : null}

      <div className={styles.toastDock}>
        {notebook.toasts.map((toast) => (
          <div key={toast.id} className={styles.toast} data-tone={toast.tone} role="status">
            <span>{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                className={styles.toastAction}
                onClick={() => {
                  toast.action?.run();
                  notebook.dismissToast(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <p className={styles.srOnly} id={liveRegionId} role="status" aria-live="polite">
        {notebook.announcement}
      </p>
    </div>
  );
}

/* ── In Tasks: the note and the task it became ────────────────────────── */

/**
 * The same notes, seen through what became of them. The task wording leads,
 * because that is what a person is looking for here; the note that produced
 * it follows, unchanged.
 */
function SentDetail({
  note,
  now,
  restoring,
  demoMode,
  onBack,
  onRestore,
  onOpenInNotebook,
}: {
  note: PresentableNote;
  now: number;
  restoring: boolean;
  demoMode: boolean;
  onBack: () => void;
  onRestore: () => void;
  onOpenInNotebook: () => void;
}) {
  const source = noteSource(note.source);
  return (
    <article className={styles.reader} aria-label="Note and its task">
      <div className={styles.readerBar}>
        <button type="button" data-notes-back="" className={styles.backButton} onClick={onBack}>
          <BackIcon />
          {NOTES_VIEW_LABELS.sent}
        </button>
        <p className={styles.readerMeta}>
          <SourceIcon source={source} />
          <span>{SOURCE_LABELS[source]}</span>
          <span aria-hidden="true">·</span>
          {/* updated_at is the last edit, not the send. Until the send time
              is read from the outbox, say what the number is. */}
          <span>
            {note.archivedAt
              ? `Turned into a task ${friendlyDate(note.archivedAt, now).toLowerCase()}`
              : `Last edited ${friendlyDate(note.updatedAt, now).toLowerCase()}`}
          </span>
        </p>
        <span className={styles.savePillSlot} />
        <a className={styles.primaryButton} href={taskFocusPath(note.promotedTaskId ?? "")}>
          <TaskIcon />
          Open task
        </a>
      </div>
      <div className={styles.readerScroll}>
        <div className={styles.readerColumn}>
          <div className={styles.receipt}>
            <span className={styles.receiptMark} aria-hidden="true">
              <CheckIcon />
            </span>
            <p className={styles.receiptText}>
              <span className={styles.receiptLabel}>What the task says</span>
              <span className={styles.sentWording}>{note.extractBody || derivePresentation(note.body).title}</span>
            </p>
          </div>
          <p className={styles.eyebrow}>The note it came from</p>
          <p className={styles.sentBody}>{note.body}</p>
          {isArchived(note) ? (
            <div className={styles.panel}>
              <p className={styles.panelTitle}>This note is not in your notebook</p>
              <p className={styles.panelBody}>
                Restoring brings this exact note back to the notebook. The task it created stays in
                Tasks either way.
              </p>
              <div className={styles.panelActions}>
                <button type="button" className={styles.quietButton} onClick={onRestore} disabled={restoring || demoMode}>
                  <RestoreIcon />
                  {restoring ? "Restoring…" : "Restore to notebook"}
                </button>
              </div>
              {demoMode ? (
                <p className={styles.fieldHint}>
                  Review mode keeps every change on this device, so restoring is off here.
                </p>
              ) : null}
            </div>
          ) : (
            <div className={styles.panelActions}>
              <button type="button" className={styles.quietButton} onClick={onOpenInNotebook}>
                Open in notebook
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
