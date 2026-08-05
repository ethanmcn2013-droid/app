"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  createNoteIdempotent,
  deleteNoteWithVersion,
  getApprovedTaskSendRecoveryForHybrid,
  restoreArchivedNoteForHybrid,
  searchNotes,
  sendApprovedExtractToTasks,
  setNoteReviewed,
  updateNoteWithVersion,
  type ExtractSendResult,
  type NoteCaptureSource,
  type NoteRead,
  type PendingApprovedTasksSendRead,
} from "@/modules/notes/server/actions/notes";
import {
  MAX_APPROVED_EXTRACT_CHARS,
  MAX_NOTE_BODY_CHARS,
} from "@/modules/notes/lib/notes-hybrid";
import {
  derivePresentation,
  matchesQuery,
  type PresentableNote,
} from "@/modules/notes/lib/notes-view-model";
import { taskFocusPath } from "@/lib/product-urls";
import type { NotesCopy } from "@/modules/notes/lib/notes-copy";

/**
 * Everything Notes knows about a person's writing, and everything that can
 * go wrong with it.
 *
 * This hook is the part of the redesign that deliberately did not change.
 * The rules below were earned by earlier work and each one exists because
 * something was nearly lost: captures carry a client-minted id so a retry
 * cannot duplicate them, edits are compare-and-swap so a second device
 * cannot silently win, a failed save keeps the exact words in session
 * storage, deletion waits six seconds in the browser before the server hears
 * about it, and a send whose answer went missing stays locked to its exact
 * request until it is reconciled.
 *
 * The views on top of it are new. These guarantees are not.
 */

const DRAFT_PREFIX = "signal-notes.draft.v3";
const CAPTURES_PREFIX = "signal-notes.pending-captures.v3";
const EDITS_PREFIX = "signal-notes.detail-edits.v3";
const DELETE_UNDO_MS = 6_000;

export type MutationState = "pending" | "failed" | "offline" | "saved";
export type CaptureStatus = "idle" | "pending" | "failed" | "offline" | "saved";
export type DetailStatus = "idle" | "saving" | "saved" | "failed";

export type ReviewMode =
  | "default"
  | "save-error"
  | "conflict"
  | "tasks-error"
  | "tasks-lost-reply"
  | "offline"
  | "read-only";

export type Toast = {
  id: number;
  tone: "info" | "error";
  message: string;
  action?: { label: string; run: () => void };
};

export type ConflictState = {
  noteId: string;
  localBody: string;
  remote: NoteRead;
};

export type SendState = {
  noteId: string;
  /** Verbatim from the note body: the server checks it is still present there. */
  sourceSelection: string;
  /** The task wording, which the person edits. */
  taskTitle: string;
  workspaceId: string;
  status: "composing" | "sending" | "failed" | "sent";
  error: string | null;
  receipt: ExtractSendResult | null;
  /** Set when an answer went missing. The request is frozen until it reconciles. */
  locked: { workspaceId: string; expectedUpdatedAt: number } | null;
};

type PendingCapture = {
  id: string;
  body: string;
  workspaceId: string | null;
  source: NoteCaptureSource | null;
  createdAt: number;
};

type RecoveredEdit = {
  body: string;
  expectedUpdatedAt: number;
  queued: boolean;
};

type DeleteUndo = { note: NoteRead; timer: number };

declare global {
  interface Window {
    /** Installed by EarlyCaptureBootstrap; claimed exactly once. */
    __signalNotesClaimEarlyCapture?: () => { value: string; pendingSave: boolean };
  }
}

export type NotebookOptions = {
  initialNotes: NoteRead[];
  initialArchivedNotes: NoteRead[];
  initialPendingApprovedTaskSends: PendingApprovedTasksSendRead[];
  initialWorkspaceId: string | null;
  recoveryScope: string;
  demoMode: boolean;
  copy: NotesCopy;
};

function stableNoteId(): string {
  return `n_${crypto.randomUUID().replace(/-/g, "")}`;
}

function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function sortNewest(notes: NoteRead[]): NoteRead[] {
  return [...notes].sort((a, b) =>
    b.createdAt - a.createdAt || a.id.localeCompare(b.id),
  );
}

function upsertNote(notes: NoteRead[], note: NoteRead): NoteRead[] {
  return sortNewest([note, ...notes.filter((candidate) => candidate.id !== note.id)]);
}

function readSession<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeSession(key: string, value: unknown): boolean {
  try {
    if (value === "" || value === null || (Array.isArray(value) && !value.length)) {
      window.sessionStorage.removeItem(key);
      return true;
    }
    window.sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function pendingNote(capture: PendingCapture): NoteRead {
  return {
    id: capture.id,
    body: capture.body,
    createdAt: capture.createdAt,
    updatedAt: capture.createdAt,
    extractBody: null,
    promotedTaskId: null,
    archivedAt: null,
    reviewedAt: null,
    source: capture.source,
    workspaceId: capture.workspaceId,
  };
}

/** The demo world answers every mutation locally; nothing reaches a database. */
function demoSaved(note: NoteRead, body: string): NoteRead {
  return { ...note, body, updatedAt: Math.max(Date.now(), note.updatedAt + 1) };
}

const subscribeNever = () => () => {};

/**
 * Which scripted failure the review build should show, from the URL.
 *
 * Read through the store rather than an effect: the server has no query
 * string and the client does, and reconciling the two with a set-state pass
 * would show the default for one frame first.
 */
function useReviewMode(demoMode: boolean): ReviewMode {
  return useSyncExternalStore<ReviewMode>(
    subscribeNever,
    () => {
      if (!demoMode) return "default";
      const value = new URLSearchParams(window.location.search).get("hybridMode");
      const allowed: ReviewMode[] = [
        "save-error",
        "conflict",
        "tasks-error",
        "tasks-lost-reply",
        "offline",
        "read-only",
      ];
      return allowed.includes(value as ReviewMode) ? (value as ReviewMode) : "default";
    },
    () => "default",
  );
}

export function useNotebook(options: NotebookOptions) {
  const { demoMode, copy } = options;
  const recoveryKeys = useMemo(
    () => ({
      draft: `${DRAFT_PREFIX}:${options.recoveryScope}`,
      captures: `${CAPTURES_PREFIX}:${options.recoveryScope}`,
      edits: `${EDITS_PREFIX}:${options.recoveryScope}`,
    }),
    [options.recoveryScope],
  );

  const [notes, setNotes] = useState<NoteRead[]>(() => sortNewest(options.initialNotes));
  const [archivedNotes, setArchivedNotes] = useState<NoteRead[]>(
    options.initialArchivedNotes,
  );
  const reviewMode = useReviewMode(demoMode);
  const [online, setOnline] = useState(true);
  const [mutationStates, setMutationStates] = useState<Record<string, MutationState>>({});
  const [recoveryAvailable, setRecoveryAvailable] = useState(true);

  const [draft, setDraft] = useState("");
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const [captureError, setCaptureError] = useState<string | null>(null);

  const [detailBody, setDetailBody] = useState("");
  const [detailBase, setDetailBase] = useState(0);
  const [detailStatus, setDetailStatus] = useState<DetailStatus>("idle");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [queuedEdit, setQueuedEdit] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  const [send, setSend] = useState<SendState | null>(null);
  const [pendingSends, setPendingSends] = useState(options.initialPendingApprovedTaskSends);
  const [deleteUndo, setDeleteUndo] = useState<DeleteUndo | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [serverResults, setServerResults] = useState<NoteRead[] | null>(null);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "ready" | "fallback">(
    "idle",
  );

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const pendingRef = useRef<PendingCapture[]>([]);
  const pendingSendsRef = useRef(options.initialPendingApprovedTaskSends);
  const searchSequence = useRef(0);
  const toastSequence = useRef(0);
  const announceTimer = useRef<number | null>(null);
  const bootstrapped = useRef(false);
  /** Set when someone pressed the save chord before the page was listening. */
  const earlySaveRef = useRef<string | null>(null);
  /** Set by the bootstrap when a recovered draft has to be saved separately. */
  const rescuedDraftRef = useRef<string | null>(null);
  const failedCaptureOnce = useRef(false);
  const simulatedConflictOnce = useRef(false);
  const lostReplyOnce = useRef(false);

  const readOnly = demoMode && reviewMode === "read-only";

  useEffect(() => {
    pendingSendsRef.current = pendingSends;
  }, [pendingSends]);

  // ── Announcements and toasts ────────────────────────────────────────

  const announce = useCallback((message: string) => {
    if (announceTimer.current !== null) window.clearTimeout(announceTimer.current);
    setAnnouncement("");
    announceTimer.current = window.setTimeout(() => {
      setAnnouncement(message);
      announceTimer.current = null;
    }, 20);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = ++toastSequence.current;
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      announce(toast.message);
      window.setTimeout(() => dismissToast(id), toast.action ? DELETE_UNDO_MS : 4_500);
      return id;
    },
    [announce, dismissToast],
  );

  useEffect(
    () => () => {
      if (announceTimer.current !== null) window.clearTimeout(announceTimer.current);
    },
    [],
  );

  // ── Connectivity and the review-mode switch ─────────────────────────

  useEffect(() => {
    const update = () => setOnline(navigator.onLine && reviewMode !== "offline");
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [reviewMode]);

  // ── Local recovery ──────────────────────────────────────────────────

  const setPending = useCallback(
    (next: PendingCapture[]): boolean => {
      const persisted = writeSession(recoveryKeys.captures, next);
      pendingRef.current = next;
      return persisted;
    },
    [recoveryKeys.captures],
  );

  const writeRecoveredEdit = useCallback(
    (noteId: string, edit: RecoveredEdit | null): boolean => {
      const edits = readSession<Record<string, RecoveredEdit>>(recoveryKeys.edits, {});
      if (edit) edits[noteId] = edit;
      else delete edits[noteId];
      return writeSession(recoveryKeys.edits, Object.keys(edits).length ? edits : null);
    },
    [recoveryKeys.edits],
  );

  const persistDraft = useCallback(
    (value: string) => {
      setDraft(value);
      setRecoveryAvailable(writeSession(recoveryKeys.draft, value));
    },
    [recoveryKeys.draft],
  );

  // ── Capture ─────────────────────────────────────────────────────────

  const submitCapture = useCallback(
    async (capture: PendingCapture, recoveryReady = true): Promise<boolean> => {
      const persistenceReady =
        recoveryReady || writeSession(recoveryKeys.captures, pendingRef.current);
      setRecoveryAvailable(persistenceReady);
      setMutationStates((current) => ({
        ...current,
        [capture.id]: online ? "pending" : persistenceReady ? "offline" : "failed",
      }));
      if (!online) {
        setCaptureStatus(persistenceReady ? "offline" : "failed");
        const message = persistenceReady
          ? "Saved on this device. Signal will try again when you reconnect."
          : "This device cannot hold a spare copy. Your words are still in the composer, so keep this tab open until you reconnect.";
        setCaptureError(message);
        announce(message);
        return false;
      }
      setCaptureStatus("pending");
      setCaptureError(null);
      try {
        if (demoMode) {
          if (reviewMode === "save-error" && !failedCaptureOnce.current) {
            failedCaptureOnce.current = true;
            throw new Error("That save did not reach Notes. Your exact words are still here.");
          }
          await Promise.resolve();
          setNotes((current) => upsertNote(current, pendingNote(capture)));
        } else {
          const saved = await createNoteIdempotent({
            id: capture.id,
            body: capture.body,
            workspaceId: capture.workspaceId,
            source: capture.source,
          });
          setNotes((current) => upsertNote(current, saved));
        }
        setPending(pendingRef.current.filter((item) => item.id !== capture.id));
        setMutationStates((current) => ({ ...current, [capture.id]: "saved" }));
        setCaptureStatus("saved");
        setCaptureError(null);
        window.setTimeout(
          () => setCaptureStatus((current) => (current === "saved" ? "idle" : current)),
          1_800,
        );
        return true;
      } catch (error) {
        setMutationStates((current) => ({ ...current, [capture.id]: "failed" }));
        setCaptureStatus("failed");
        const message = friendlyError(
          error,
          "That note could not be saved. Your exact words are kept.",
        );
        setCaptureError(
          persistenceReady
            ? message
            : `${message} This device cannot hold a spare copy, so keep this tab open.`,
        );
        announce(message);
        return false;
      }
    },
    [announce, demoMode, online, recoveryKeys.captures, reviewMode, setPending],
  );

  /**
   * Save one body as a note. Used by the composer, by voice and photo
   * capture (once per extracted note), and by "keep both" after a conflict.
   *
   * The row appears in the list before the server answers, carrying its
   * pending state, so a slow connection never looks like a lost thought.
   */
  const captureNote = useCallback(
    async (
      body: string,
      source: NoteCaptureSource = "typed",
    ): Promise<{ ok: boolean; id: string } | null> => {
      if (readOnly) return null;
      const text = body.trim();
      if (!text) return null;
      if (text.length > MAX_NOTE_BODY_CHARS) {
        setCaptureStatus("failed");
        setCaptureError("A note can hold up to 10,000 characters.");
        return { ok: false, id: "" };
      }
      const existing = pendingRef.current.find((capture) => capture.body === text);
      if (existing) {
        const ok = await submitCapture(existing, false);
        return { ok, id: existing.id };
      }
      const capture: PendingCapture = {
        id: stableNoteId(),
        body: text,
        workspaceId: options.initialWorkspaceId,
        source: source === "typed" ? null : source,
        createdAt: Date.now(),
      };
      const persisted = setPending([capture, ...pendingRef.current]);
      setRecoveryAvailable(persisted);
      setNotes((current) => upsertNote(current, pendingNote(capture)));
      const ok = await submitCapture(capture, persisted);
      return { ok, id: capture.id };
    },
    [options.initialWorkspaceId, readOnly, setPending, submitCapture],
  );

  /**
   * Finish what the pre-hydration bootstrap started: save a draft it had to
   * set aside, and honour a save chord pressed before anything was listening.
   */
  useEffect(() => {
    const rescued = rescuedDraftRef.current;
    const queued = earlySaveRef.current;
    if (!rescued && !queued) return;
    rescuedDraftRef.current = null;
    earlySaveRef.current = null;
    const handle = window.setTimeout(() => {
      if (rescued) void captureNote(rescued, "typed");
      if (queued) {
        void captureNote(queued, "typed").then((result) => {
          if (result?.ok) setDraft((current) => (current === queued ? "" : current));
        });
      }
    }, 0);
    return () => window.clearTimeout(handle);
  }, [captureNote, draft]);

  const saveDraft = useCallback(async (): Promise<string | null> => {
    if (!draft.trim() || captureStatus === "pending") return null;
    const snapshot = draft;
    const result = await captureNote(snapshot, "typed");
    if (result?.ok) {
      // Only clear once the server has it, and only if the person has not
      // started a different thought in the meantime.
      setDraft((current) => (current === snapshot ? "" : current));
      announce("Note saved.");
      return result.id;
    }
    return null;
  }, [announce, captureNote, captureStatus, draft]);

  const retryCapture = useCallback(
    async (id: string) => {
      const capture = pendingRef.current.find((item) => item.id === id);
      if (capture) await submitCapture(capture, false);
    },
    [submitCapture],
  );

  // Bootstrap: adopt anything the last session left behind.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const adopt = () => {
    // Anything typed before the page hydrated is held in one page-local
    // closure by EarlyCaptureBootstrap. Claim it first: it is the newest
    // thing the person wrote and it exists nowhere else.
    const claimed = window.__signalNotesClaimEarlyCapture?.();
    const recoveredDraft = readSession<string>(recoveryKeys.draft, "");
    const recoveredPending = readSession<PendingCapture[]>(recoveryKeys.captures, []).filter(
      (capture) =>
        typeof capture?.id === "string" &&
        typeof capture?.body === "string" &&
        typeof capture?.createdAt === "number" &&
        /^n_[0-9a-f]{32}$/.test(capture.id),
    );
    const early = claimed?.value?.trim() ? claimed.value : "";
    if (early && recoveredDraft && early !== recoveredDraft) {
      // Two different drafts, both real. Keep the recovered one as a saved
      // note rather than letting the newer keystrokes overwrite it.
      rescuedDraftRef.current = recoveredDraft;
    }
    const adopted = early || recoveredDraft;
    if (adopted) setDraft(adopted);
    if (early && claimed?.pendingSave) earlySaveRef.current = adopted;
    if (recoveredPending.length) {
      setPending(recoveredPending);
      setNotes((current) => {
        let merged = current;
        for (const capture of recoveredPending) merged = upsertNote(merged, pendingNote(capture));
        return merged;
      });
      for (const capture of recoveredPending) void submitCapture(capture, true);
    }
    };
    const handle = window.setTimeout(adopt, 0);
    return () => window.clearTimeout(handle);
  }, [recoveryKeys.captures, recoveryKeys.draft, setPending, submitCapture]);

  // Retry whatever was queued while offline, the moment the line comes back.
  useEffect(() => {
    if (!online) return;
    const handle = window.setTimeout(() => {
      for (const capture of pendingRef.current) {
        if (mutationStates[capture.id] === "offline") void submitCapture(capture, true);
      }
    }, 0);
    return () => window.clearTimeout(handle);
  }, [mutationStates, online, submitCapture]);

  // ── Search ──────────────────────────────────────────────────────────

  useEffect(() => {
    const normalized = query.trim();
    const sequence = ++searchSequence.current;
    const timer = window.setTimeout(() => {
      setServerResults(null);
      if (!normalized) {
        setSearchState("idle");
        return;
      }
      if (demoMode) {
        setSearchState("ready");
        return;
      }
      setSearchState("searching");
      void searchNotes(normalized)
        .then((results) => {
          if (searchSequence.current !== sequence) return;
          setServerResults(results);
          setSearchState("ready");
        })
        .catch(() => {
          if (searchSequence.current !== sequence) return;
          // The index is unavailable. Fall back to filtering what is already
          // loaded rather than showing nothing: partial results beat a lie.
          setServerResults(null);
          setSearchState("fallback");
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [demoMode, query]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return notes;
    const local = notes.filter((note) => matchesQuery(note as PresentableNote, query));
    if (serverResults === null) return local;
    // Anything still being written locally must survive a server answer that
    // predates it.
    const unsaved = local.filter((note) => mutationStates[note.id]);
    return unsaved.reduce((current, note) => upsertNote(current, note), serverResults);
  }, [mutationStates, notes, query, serverResults]);

  // ── Editing one note ────────────────────────────────────────────────

  const applyOpenNote = useCallback(
    (note: NoteRead | null) => {
      if (!note) {
        setDetailBody("");
        setDetailBase(0);
        setConflict(null);
        setDetailError(null);
        setDetailStatus("idle");
        return;
      }
      const recovered = readSession<Record<string, RecoveredEdit>>(recoveryKeys.edits, {})[
        note.id
      ];
      const valid =
        recovered &&
        typeof recovered.body === "string" &&
        typeof recovered.expectedUpdatedAt === "number";
      if (valid) {
        setDetailBody(recovered.body);
        setDetailBase(recovered.expectedUpdatedAt);
        setQueuedEdit(recovered.queued ? note.id : null);
        if (recovered.expectedUpdatedAt !== note.updatedAt) {
          setConflict({ noteId: note.id, localBody: recovered.body, remote: note });
          setDetailError(
            "An edit kept on this device has a newer saved version to compare. Both are here.",
          );
        } else {
          setConflict(null);
          setDetailError(null);
        }
      } else {
        setDetailBody(note.body);
        setDetailBase(note.updatedAt);
        setQueuedEdit(null);
        setConflict(null);
        setDetailError(null);
      }
      setDetailStatus("idle");
      const pending = pendingSendsRef.current.find((item) => item.noteId === note.id);
      setSend(
        pending
          ? {
              noteId: note.id,
              sourceSelection: pending.sourceSelection,
              taskTitle: pending.approvedBody,
              workspaceId: pending.workspaceId,
              status: "failed",
              error: copy.errors.retryPending,
              receipt: null,
              locked: {
                workspaceId: pending.workspaceId,
                expectedUpdatedAt: pending.baseUpdatedAt,
              },
            }
          : null,
      );
    },
    [copy.errors.retryPending, recoveryKeys.edits],
  );


  const saveDetail = useCallback(
    async (note: NoteRead, overrideExpectedAt?: number): Promise<boolean> => {
      if (readOnly || detailBody === note.body) return false;
      if (!detailBody.trim()) {
        setDetailStatus("failed");
        setDetailError("A note cannot be empty. Delete it if you no longer need it.");
        return false;
      }
      if (detailBody.length > MAX_NOTE_BODY_CHARS) {
        setDetailStatus("failed");
        setDetailError("A note can hold up to 10,000 characters.");
        return false;
      }
      if (!online) {
        setDetailStatus("failed");
        const persisted = writeRecoveredEdit(note.id, {
          body: detailBody,
          expectedUpdatedAt: overrideExpectedAt ?? detailBase,
          queued: true,
        });
        setQueuedEdit(persisted ? note.id : null);
        setDetailError(
          persisted
            ? "Kept on this device. Signal will check the saved version when you reconnect."
            : "This device cannot hold a spare copy. Your edit is still on screen, so keep this tab open.",
        );
        return false;
      }
      setDetailStatus("saving");
      setDetailError(null);
      try {
        if (demoMode) {
          if (reviewMode === "conflict" && !simulatedConflictOnce.current) {
            simulatedConflictOnce.current = true;
            const remote = demoSaved(note, `${note.body}\n\nEdited somewhere else.`);
            writeRecoveredEdit(note.id, {
              body: detailBody,
              expectedUpdatedAt: detailBase,
              queued: false,
            });
            setNotes((current) => upsertNote(current, remote));
            setConflict({ noteId: note.id, localBody: detailBody, remote });
            setDetailStatus("failed");
            setDetailError("This note changed somewhere else. Both versions are kept.");
            return false;
          }
          const saved = demoSaved(
            { ...note, updatedAt: overrideExpectedAt ?? note.updatedAt },
            detailBody,
          );
          setNotes((current) => upsertNote(current, saved));
          setDetailBase(saved.updatedAt);
        } else {
          const result = await updateNoteWithVersion({
            id: note.id,
            body: detailBody,
            expectedUpdatedAt: overrideExpectedAt ?? detailBase,
          });
          if (result.status === "conflict") {
            writeRecoveredEdit(note.id, {
              body: detailBody,
              expectedUpdatedAt: detailBase,
              queued: false,
            });
            setNotes((current) => upsertNote(current, result.remote));
            setConflict({ noteId: note.id, localBody: detailBody, remote: result.remote });
            setDetailStatus("failed");
            setDetailError("This note changed somewhere else. Both versions are kept.");
            return false;
          }
          setNotes((current) => upsertNote(current, result.note));
          setDetailBase(result.note.updatedAt);
        }
        writeRecoveredEdit(note.id, null);
        setQueuedEdit(null);
        setConflict(null);
        setDetailStatus("saved");
        announce("Note saved.");
        window.setTimeout(
          () => setDetailStatus((current) => (current === "saved" ? "idle" : current)),
          1_600,
        );
        return true;
      } catch (error) {
        const persisted = writeRecoveredEdit(note.id, {
          body: detailBody,
          expectedUpdatedAt: overrideExpectedAt ?? detailBase,
          queued: true,
        });
        setDetailStatus("failed");
        const message = friendlyError(
          error,
          "That edit could not be saved. Your version is still here.",
        );
        setDetailError(
          persisted ? `${message} It is kept for a retry.` : `${message} Keep this tab open.`,
        );
        return false;
      }
    },
    [
      announce,
      demoMode,
      detailBase,
      detailBody,
      online,
      readOnly,
      reviewMode,
      writeRecoveredEdit,
    ],
  );

  const resolveConflict = useCallback(
    async (choice: "mine" | "theirs" | "both", note: NoteRead) => {
      if (!conflict) return;
      if (choice === "theirs") {
        writeRecoveredEdit(conflict.noteId, null);
        setDetailBody(conflict.remote.body);
        setDetailBase(conflict.remote.updatedAt);
        setConflict(null);
        setDetailError(null);
        setDetailStatus("idle");
        setQueuedEdit(null);
        return;
      }
      if (choice === "mine") {
        setDetailBase(conflict.remote.updatedAt);
        await saveDetail(note, conflict.remote.updatedAt);
        return;
      }
      const kept = conflict;
      const result = await captureNote(detailBody, "typed");
      if (!result?.ok) {
        showToast({
          tone: "error",
          message: "The second copy is not saved yet, so nothing was discarded.",
        });
        return;
      }
      setDetailBody(kept.remote.body);
      setDetailBase(kept.remote.updatedAt);
      setConflict(null);
      setDetailError(null);
      writeRecoveredEdit(kept.noteId, null);
      setQueuedEdit(null);
      showToast({ tone: "info", message: "Both versions are kept as separate notes." });
    },
    [captureNote, conflict, detailBody, saveDetail, showToast, writeRecoveredEdit],
  );

  /**
   * Reconnect: push the edit that was queued while the line was down.
   *
   * `queuedEdit` holds the note it belongs to, not just a flag, because by
   * the time the connection returns the person may be reading a different
   * note and the retry must still target the right one.
   */
  useEffect(() => {
    if (!online || !queuedEdit || conflict || readOnly) return;
    const handle = window.setTimeout(() => {
      const note = notes.find((candidate) => candidate.id === queuedEdit);
      if (note) void saveDetail(note);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [conflict, notes, online, queuedEdit, readOnly, saveDetail]);

  // ── Delete, with the undo the person actually needs ─────────────────

  const finalizeDelete = useCallback(
    async (removed: NoteRead) => {
      if (demoMode) return;
      try {
        const result = await deleteNoteWithVersion({
          id: removed.id,
          expectedUpdatedAt: removed.updatedAt,
        });
        if (result.status === "conflict") {
          setNotes((current) => upsertNote(current, result.remote));
          showToast({ tone: "error", message: copy.errors.deleteBlocked });
        }
      } catch (error) {
        setNotes((current) => upsertNote(current, removed));
        showToast({
          tone: "error",
          message: friendlyError(error, "That note could not be deleted, so it is back."),
        });
      }
    },
    [copy.errors.deleteBlocked, demoMode, showToast],
  );

  /**
   * Nothing reaches the server for six seconds. Undo inside that window is
   * a cancelled timer, not a second write, so the note was never at risk.
   */
  const deleteNote = useCallback(
    (note: NoteRead) => {
      if (readOnly) return;
      setNotes((current) => current.filter((candidate) => candidate.id !== note.id));
      writeRecoveredEdit(note.id, null);
      const timer = window.setTimeout(() => {
        setDeleteUndo((current) => (current?.note.id === note.id ? null : current));
        void finalizeDelete(note);
      }, DELETE_UNDO_MS);
      setDeleteUndo((current) => {
        if (current) {
          window.clearTimeout(current.timer);
          void finalizeDelete(current.note);
        }
        return { note, timer };
      });
      showToast({
        tone: "info",
        message: "Note deleted.",
        action: {
          label: "Undo",
          run: () => {
            window.clearTimeout(timer);
            setDeleteUndo(null);
            setNotes((current) => upsertNote(current, note));
            announce("Note restored.");
          },
        },
      });
    },
    [announce, finalizeDelete, readOnly, showToast, writeRecoveredEdit],
  );

  // ── Review decisions ────────────────────────────────────────────────

  const markReviewed = useCallback(
    async (note: NoteRead, reviewed: boolean) => {
      if (readOnly) return;
      const previous = note.reviewedAt;
      const optimistic = { ...note, reviewedAt: reviewed ? Date.now() : null };
      setNotes((current) => upsertNote(current, optimistic));
      if (demoMode) return;
      try {
        const saved = await setNoteReviewed({ id: note.id, reviewed });
        setNotes((current) => upsertNote(current, saved));
      } catch (error) {
        setNotes((current) => upsertNote(current, { ...note, reviewedAt: previous }));
        showToast({
          tone: "error",
          message: friendlyError(error, "That decision was not saved. Nothing changed."),
        });
      }
    },
    [demoMode, readOnly, showToast],
  );

  const keepInNotes = useCallback(
    async (note: NoteRead) => {
      await markReviewed(note, true);
      showToast({
        tone: "info",
        message: "Kept in Notes.",
        action: { label: "Undo", run: () => void markReviewed(note, false) },
      });
    },
    [markReviewed, showToast],
  );

  // ── Turn into task ──────────────────────────────────────────────────

  const beginSend = useCallback(
    (note: NoteRead, workspaceId: string) => {
      const { title } = derivePresentation(note.body);
      // The server checks this wording is still present in the note, so it
      // has to be the line as written, not a tidied version of it.
      const firstLine =
        note.body.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? note.body.trim();
      setSend({
        noteId: note.id,
        sourceSelection: firstLine,
        taskTitle: title.slice(0, MAX_APPROVED_EXTRACT_CHARS),
        workspaceId,
        status: "composing",
        error: null,
        receipt: null,
        locked: null,
      });
    },
    [],
  );

  const updateSend = useCallback((patch: Partial<SendState>) => {
    setSend((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const cancelSend = useCallback(() => {
    setSend((current) => (current?.locked ? current : null));
  }, []);

  const submitSend = useCallback(
    async (note: NoteRead): Promise<boolean> => {
      if (!send || readOnly || conflict) return false;
      const workspaceId = send.locked?.workspaceId ?? send.workspaceId;
      const expectedUpdatedAt = send.locked?.expectedUpdatedAt ?? detailBase;
      if (!workspaceId) {
        updateSend({ status: "failed", error: copy.errors.noDestination });
        return false;
      }
      const title = send.taskTitle.trim();
      if (!title) {
        updateSend({ status: "failed", error: copy.errors.emptyWording });
        return false;
      }
      if (title.length > MAX_APPROVED_EXTRACT_CHARS) {
        updateSend({ status: "failed", error: copy.errors.tooLong });
        return false;
      }
      if (!online) {
        updateSend({ status: "failed", error: copy.errors.offline });
        return false;
      }
      updateSend({ status: "sending", error: null });
      try {
        let saved: NoteRead;
        let receipt: ExtractSendResult;
        if (demoMode) {
          if (reviewMode === "tasks-error") throw new Error(copy.errors.tasksUnavailable);
          if (reviewMode === "tasks-lost-reply" && !lostReplyOnce.current) {
            lostReplyOnce.current = true;
            throw new Error(copy.errors.replyLost);
          }
          const taskId = `review_task_${note.id.replace(/[^a-z0-9]/gi, "_")}`;
          saved = {
            ...note,
            extractBody: title,
            promotedTaskId: taskId,
            workspaceId,
            updatedAt: Math.max(Date.now(), note.updatedAt + 1),
          };
          receipt = {
            taskId,
            workspaceName: "Tasks",
            workspaceSlug: "review-workspace",
            taskUrl: taskFocusPath(taskId),
            created: reviewMode !== "tasks-lost-reply",
          };
        } else {
          const result = await sendApprovedExtractToTasks({
            noteId: note.id,
            sourceSelection: send.sourceSelection,
            approvedBody: title,
            workspaceId,
            expectedUpdatedAt,
          });
          if (result.status === "conflict") {
            writeRecoveredEdit(note.id, {
              body: detailBody,
              expectedUpdatedAt: detailBase,
              queued: false,
            });
            setNotes((current) => upsertNote(current, result.remote));
            setConflict({ noteId: note.id, localBody: detailBody, remote: result.remote });
            updateSend({ status: "failed", error: copy.errors.sourceChanged });
            return false;
          }
          saved = result.note;
          receipt = result.result;
        }
        setNotes((current) => upsertNote(current, saved));
        setDetailBase(saved.updatedAt);
        setPendingSends((current) => current.filter((item) => item.noteId !== saved.id));
        updateSend({ status: "sent", error: null, receipt, locked: null });
        showToast({ tone: "info", message: receipt.created ? "Task created." : copy.receipts.recovered });
        return true;
      } catch (error) {
        const message = friendlyError(error, copy.errors.tasksUnavailable);
        if (!demoMode) {
          // The answer went missing, so Tasks may already hold this. Ask,
          // rather than risk a second task with the same words.
          try {
            const recovery = await getApprovedTaskSendRecoveryForHybrid(note.id);
            if (recovery.status === "completed") {
              setPendingSends((current) => current.filter((item) => item.noteId !== note.id));
              setNotes((current) => upsertNote(current, recovery.note));
              setDetailBase(recovery.note.updatedAt);
              updateSend({
                status: "sent",
                error: null,
                receipt: recovery.result,
                locked: null,
              });
              showToast({ tone: "info", message: copy.receipts.recovered });
              return true;
            }
            const pending = recovery.status === "pending" ? recovery.send : null;
            setPendingSends((current) => {
              const rest = current.filter((item) => item.noteId !== note.id);
              return pending ? [pending, ...rest] : rest;
            });
            updateSend({
              status: "failed",
              error: pending ? copy.errors.retryPending : message,
              locked: pending
                ? { workspaceId: pending.workspaceId, expectedUpdatedAt: pending.baseUpdatedAt }
                : null,
            });
            return false;
          } catch {
            updateSend({
              status: "failed",
              error: copy.errors.retryPending,
              locked: send.locked ?? { workspaceId, expectedUpdatedAt },
            });
            return false;
          }
        }
        updateSend({
          status: "failed",
          error: message,
          locked:
            reviewMode === "tasks-lost-reply"
              ? { workspaceId, expectedUpdatedAt }
              : send.locked,
        });
        return false;
      }
    },
    [
      conflict,
      copy.errors.emptyWording,
      copy.errors.noDestination,
      copy.errors.offline,
      copy.errors.replyLost,
      copy.errors.retryPending,
      copy.errors.sourceChanged,
      copy.errors.tasksUnavailable,
      copy.errors.tooLong,
      copy.receipts.recovered,
      demoMode,
      detailBase,
      detailBody,
      online,
      readOnly,
      reviewMode,
      send,
      showToast,
      updateSend,
      writeRecoveredEdit,
    ],
  );

  // ── Restore an archived note ────────────────────────────────────────

  const restoreNote = useCallback(
    async (note: NoteRead) => {
      if (readOnly || restoringId) return;
      setRestoringId(note.id);
      try {
        const restored = demoMode
          ? { ...note, archivedAt: null, updatedAt: Date.now() }
          : await restoreArchivedNoteForHybrid(note.id);
        setArchivedNotes((current) => current.filter((item) => item.id !== note.id));
        setNotes((current) => upsertNote(current, restored));
        showToast({
          tone: "info",
          message: "Back in your notebook. The task it created is unchanged.",
        });
      } catch (error) {
        showToast({
          tone: "error",
          message: friendlyError(error, "That note could not be restored."),
        });
      } finally {
        setRestoringId(null);
      }
    },
    [demoMode, readOnly, restoringId, showToast],
  );

  return {
    notes,
    archivedNotes,
    online,
    readOnly,
    reviewMode,
    recoveryAvailable,
    mutationStates,
    pendingSends,

    draft,
    setDraft: persistDraft,
    saveDraft,
    captureNote,
    captureStatus,
    captureError,
    setCaptureError,
    retryCapture,

    detailBody,
    setDetailBody,
    detailStatus,
    detailError,
    setDetailError,
    queuedEdit,
    conflict,
    saveDetail,
    resolveConflict,

    applyOpenNote,
    deleteNote,
    deleteUndo,
    keepInNotes,
    markReviewed,

    send,
    beginSend,
    updateSend,
    cancelSend,
    submitSend,

    restoreNote,
    restoringId,

    query,
    setQuery,
    searchState,
    searchResults,

    toasts,
    dismissToast,
    announcement,
    announce,
    showToast,
  };
}

export type Notebook = ReturnType<typeof useNotebook>;
