"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";

import {
  FirstCaptureMoment,
  FIRST_CAPTURE_ENABLED,
  hasSeenFirstCapture,
  markFirstCaptureSeen,
} from "@/modules/notes/app/FirstCaptureMoment";
import {
  CaptureEmailRow,
  type CaptureState as CaptureEmailState,
} from "@/modules/notes/app/CaptureEmailRow";
import { useVoiceCapture } from "@/modules/notes/app/notebook/hooks";
import { notesCopyForDomain } from "@/modules/notes/lib/notes-copy";
import { NoteProvenanceChip } from "@/modules/notes/components/NoteProvenanceChip";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import {
  REVIEW_PRIMARY_PROJECT,
  REVIEW_SUITE_FIXTURE,
} from "@/lib/review-suite-fixture";
import {
  MAX_APPROVED_EXTRACT_CHARS,
  MAX_NOTE_BODY_CHARS,
  presentNoteBody,
} from "@/modules/notes/lib/notes-hybrid";
import {
  createNoteIdempotent,
  deleteNoteWithVersion,
  getApprovedTaskSendRecoveryForHybrid,
  restoreArchivedNoteForHybrid,
  searchNotes,
  sendApprovedExtractToTasks,
  updateNoteWithVersion,
  type ExtractSendResult,
  type NoteRead,
  type PendingApprovedTasksSendRead,
} from "@/modules/notes/server/actions/notes";
import { promoteSelectedExtractToTimeline } from "@/modules/notes/server/actions/timeline";
import type { TasksWorkspaceDestination } from "@/modules/notes/server/tasks-personalization";

import styles from "./hybrid-notebook.module.css";

const TASKS_APP_PATH = PRODUCT_APP_PATHS.tasks;
const RECOVERY_DRAFT_PREFIX = "signal-notes.hybrid-draft.v2";
const RECOVERY_CAPTURES_PREFIX = "signal-notes.hybrid-pending-captures.v2";
const RECOVERY_EDITS_PREFIX = "signal-notes.hybrid-detail-edits.v2";
const DELETE_UNDO_MS = 6_000;
const MOTION_EASE_OUT = [0.23, 1, 0.32, 1] as const;
const MOTION_EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
const MOTION_ENTER = { duration: 0.2, ease: MOTION_EASE_OUT };
const MOTION_EXIT = { duration: 0.14, ease: MOTION_EASE_OUT };
const MOTION_LAYOUT = { duration: 0.2, ease: MOTION_EASE_IN_OUT };

type MutationState = "pending" | "failed" | "offline" | "saved";
type CaptureStatus = "idle" | "pending" | "failed" | "offline" | "saved";
type ReviewMode =
  | "default"
  | "save-error"
  | "conflict"
  | "tasks-error"
  | "tasks-lost-reply"
  | "offline"
  | "read-only";

type PendingCapture = {
  id: string;
  body: string;
  workspaceId: string | null;
  createdAt: number;
};

type RecoveredEdit = {
  body: string;
  expectedUpdatedAt: number;
  queued: boolean;
};

type ConflictState = {
  noteId: string;
  localBody: string;
  remote: NoteRead;
};

type NavigationPrompt = { targetId: string | null };

type DeleteUndo = {
  note: NoteRead;
  index: number;
  timer: number;
};

type ExtractState = {
  sourceSelection: string;
  approvedBody: string;
  status: "review" | "sending" | "failed" | "sent";
  error: string | null;
  receipt: ExtractSendResult | null;
  immutableRetry: {
    workspaceId: string;
    expectedUpdatedAt: number;
  } | null;
};

type Toast = { state: "saved" | "error"; message: string };

interface HybridNotebookProps {
  initialNotes: NoteRead[];
  initialArchivedNotes: NoteRead[];
  captureEmailState: CaptureEmailState | null;
  tasksWorkspaces: TasksWorkspaceDestination[];
  tasksCatalogAvailable: boolean;
  planningPeriodsEnabled: boolean;
  initialWorkspaceId: string | null;
  initialPendingApprovedTaskSends: PendingApprovedTasksSendRead[];
  /**
   * The workspace's active domain, as Tasks reports it. Chooses which
   * register the notebook's own copy speaks in and nothing else. Null, or
   * anything other than "wedding", reads the generic register.
   */
  activeDomain?: string | null;
  reviewFirstCapture?: boolean;
  referenceTime?: number;
  recoveryScope: string;
  demoMode: boolean;
}

declare global {
  interface Window {
    __signalNotesClaimEarlyCapture?: () => {
      value: string;
      pendingSave: boolean;
    };
  }
}

function stableNoteId(): string {
  return `n_${crypto.randomUUID().replace(/-/g, "")}`;
}

function taskReceiptHref(taskId: string, demoMode: boolean): string {
  const params = new URLSearchParams({ task: taskId });
  if (demoMode) {
    params.set("workspaceId", REVIEW_SUITE_FIXTURE.workspace.id);
    params.set(
      "planningPeriodId",
      REVIEW_SUITE_FIXTURE.workspace.planningPeriodId,
    );
    params.set("projectId", REVIEW_PRIMARY_PROJECT.id);
  }
  return `${TASKS_APP_PATH}?${params.toString()}`;
}

function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKD").toLocaleLowerCase("en-IE").replace(/\s+/g, " ").trim();
}

function relativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-IE", {
    month: "short",
    day: "numeric",
    timeZone: "Europe/Dublin",
  });
}

function contextualSnippet(body: string, query: string): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) {
    return presentNoteBody(body).preview.slice(0, 210);
  }
  const presentation = presentNoteBody(body);
  if (
    !presentation.preview &&
    normalizeSearch(presentation.title).includes(normalizedQuery)
  ) return "";
  const lower = normalizeSearch(compact);
  const index = lower.indexOf(normalizedQuery);
  if (index < 0) return compact.slice(0, 210);
  const start = Math.max(0, index - 72);
  const end = Math.min(compact.length, index + normalizedQuery.length + 120);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${end < compact.length ? "…" : ""}`;
}

function foldForHighlight(value: string): { text: string; sourceIndex: number[] } {
  let text = "";
  const sourceIndex: number[] = [];
  let offset = 0;
  for (const character of value) {
    const folded = character
      .normalize("NFKD")
      .replace(/\p{Mark}/gu, "")
      .toLocaleLowerCase();
    for (const unit of folded) {
      text += unit;
      sourceIndex.push(offset);
    }
    offset += character.length;
  }
  return { text, sourceIndex };
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const needle = foldForHighlight(query.trim()).text;
  if (!needle) return <>{text}</>;
  const folded = foldForHighlight(text);
  const parts: React.ReactNode[] = [];
  let normalizedCursor = 0;
  let sourceCursor = 0;
  let match = folded.text.indexOf(needle, normalizedCursor);
  while (match >= 0) {
    const sourceStart = folded.sourceIndex[match] ?? sourceCursor;
    const normalizedEnd = match + needle.length;
    const sourceEnd = folded.sourceIndex[normalizedEnd] ?? text.length;
    if (sourceStart > sourceCursor) parts.push(text.slice(sourceCursor, sourceStart));
    parts.push(<mark className={styles.searchHighlight} key={`${match}-${sourceStart}`}>{text.slice(sourceStart, sourceEnd)}</mark>);
    sourceCursor = sourceEnd;
    normalizedCursor = normalizedEnd;
    match = folded.text.indexOf(needle, normalizedCursor);
  }
  if (!parts.length) return <>{text}</>;
  if (sourceCursor < text.length) parts.push(text.slice(sourceCursor));
  return <>{parts}</>;
}

function sortNewest(notes: NoteRead[]): NoteRead[] {
  return [...notes].sort((a, b) => b.createdAt - a.createdAt);
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
    if (
      value === "" ||
      (Array.isArray(value) && value.length === 0) ||
      value === null
    ) {
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
    source: null,
    workspaceId: capture.workspaceId,
  };
}

function demoWorkspace(): TasksWorkspaceDestination {
  return {
    id: "review_workspace",
    name: "Review workspace",
    role: "owner",
    planningPeriodId: null,
    planningPeriodName: null,
    contextType: null,
    primaryDate: null,
    primaryDateLabel: null,
  };
}

function demoSavedNote(note: NoteRead, body: string): NoteRead {
  return {
    ...note,
    body,
    updatedAt: Math.max(Date.now(), note.updatedAt + 1),
  };
}

export function HybridNotebook({
  initialNotes,
  initialArchivedNotes,
  captureEmailState,
  tasksWorkspaces,
  tasksCatalogAvailable,
  planningPeriodsEnabled,
  initialWorkspaceId,
  initialPendingApprovedTaskSends,
  activeDomain = null,
  reviewFirstCapture = false,
  referenceTime,
  recoveryScope,
  demoMode,
}: HybridNotebookProps) {
  // Every user-visible string in capture and hand-off comes from here, so a
  // couple's notebook and a generic notebook cannot drift apart by accident.
  const copy = notesCopyForDomain(activeDomain);
  const recoveryKeys = useMemo(
    () => ({
      draft: `${RECOVERY_DRAFT_PREFIX}:${recoveryScope}`,
      captures: `${RECOVERY_CAPTURES_PREFIX}:${recoveryScope}`,
      edits: `${RECOVERY_EDITS_PREFIX}:${recoveryScope}`,
    }),
    [recoveryScope],
  );
  const availableWorkspaces = useMemo(
    () => (demoMode && tasksWorkspaces.length === 0 ? [demoWorkspace()] : tasksWorkspaces),
    [demoMode, tasksWorkspaces],
  );
  const [reviewMode, setReviewMode] = useState<ReviewMode>("default");
  const [notes, setNotes] = useState<NoteRead[]>(() => sortNewest(initialNotes));
  const [archivedNotes, setArchivedNotes] = useState<NoteRead[]>(initialArchivedNotes);
  const [draft, setDraft] = useState("");
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureDiscardOpen, setCaptureDiscardOpen] = useState(false);
  const [recoveryStorageAvailable, setRecoveryStorageAvailable] = useState(true);
  const [, setPendingCaptures] = useState<PendingCapture[]>([]);
  const [recoveredEditIds, setRecoveredEditIds] = useState<string[]>([]);
  const [orphanedRecoveries, setOrphanedRecoveries] = useState<Record<string, RecoveredEdit>>({});
  const [mutationStates, setMutationStates] = useState<Record<string, MutationState>>({});
  const [online, setOnline] = useState(true);
  const [isNarrow, setIsNarrow] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [serverResults, setServerResults] = useState<NoteRead[] | null>(null);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "ready" | "fallback">("idle");
  const [searchCursor, setSearchCursor] = useState(-1);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    initialWorkspaceId ?? availableWorkspaces[0]?.id ?? "",
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailBody, setDetailBody] = useState("");
  const [detailBaseUpdatedAt, setDetailBaseUpdatedAt] = useState(0);
  const [detailStatus, setDetailStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [queuedEdit, setQueuedEdit] = useState(false);
  const [selection, setSelection] = useState("");
  const [extract, setExtract] = useState<ExtractState | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [conflictResolving, setConflictResolving] = useState(false);
  const [navigationPrompt, setNavigationPrompt] = useState<NavigationPrompt | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteUndo, setDeleteUndo] = useState<DeleteUndo | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [firstCapture, setFirstCapture] = useState(reviewFirstCapture);
  const [timelineDraft, setTimelineDraft] = useState({
    title: "",
    date: "",
    completion: 0,
    audienceLabel: "",
  });
  const [timelineSending, setTimelineSending] = useState(false);
  const [timelineReceipt, setTimelineReceipt] = useState<string | null>(null);
  const [pendingApprovedTaskSends, setPendingApprovedTaskSends] = useState(
    initialPendingApprovedTaskSends,
  );

  const captureRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLTextAreaElement>(null);
  const captureKeepRef = useRef<HTMLButtonElement>(null);
  const navigationPrimaryRef = useRef<HTMLButtonElement>(null);
  const deletePrimaryRef = useRef<HTMLButtonElement>(null);
  const approvalTriggerRef = useRef<HTMLButtonElement>(null);
  const approvalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const receiptLinkRef = useRef<HTMLAnchorElement>(null);
  const conflictPrimaryRef = useRef<HTMLButtonElement>(null);
  const undoButtonRef = useRef<HTMLButtonElement>(null);
  const announcementTimerRef = useRef<number | null>(null);
  const searchSequence = useRef(0);
  const captureGenerationRef = useRef(0);
  const failedCaptureOnce = useRef(false);
  const simulatedConflictOnce = useRef(false);
  const lostTasksReplyOnce = useRef(false);
  const earlySaveQueued = useRef(false);
  const bootstrapped = useRef(false);
  const pendingRef = useRef<PendingCapture[]>([]);
  const pendingApprovedTaskSendsRef = useRef(initialPendingApprovedTaskSends);
  const openVersionRef = useRef<{ id: string; body: string; updatedAt: number } | null>(null);

  const openNote = useMemo(
    () => notes.find((note) => note.id === openId) ?? null,
    [notes, openId],
  );
  const detailDirty = Boolean(openNote && detailBody !== openNote.body);
  const readOnly = demoMode && reviewMode === "read-only";
  const mobileDetailOpen = Boolean(isNarrow && openNote);
  const openPendingApprovedTaskSend = useMemo(
    () => pendingApprovedTaskSends.find((send) => send.noteId === openId) ?? null,
    [openId, pendingApprovedTaskSends],
  );
  const noteMutationLocked = Boolean(openPendingApprovedTaskSend);
  const tasksSendInFlight = extract?.status === "sending";
  const detailSaveInFlight = detailStatus === "saving";
  const navigationInFlight = tasksSendInFlight || detailSaveInFlight || timelineSending || conflictResolving;
  const uncertainTasksReceipt = Boolean(extract?.immutableRetry) && !noteMutationLocked;
  const navigationBlocked = navigationInFlight || uncertainTasksReceipt;
  const noteInteractionLocked =
    noteMutationLocked ||
    tasksSendInFlight ||
    detailSaveInFlight ||
    timelineSending ||
    conflictResolving ||
    Boolean(extract?.immutableRetry);

  useEffect(() => {
    pendingApprovedTaskSendsRef.current = pendingApprovedTaskSends;
  }, [pendingApprovedTaskSends]);

  const localResults = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return notes;
    return notes.filter((note) => normalizeSearch(note.body).includes(normalized));
  }, [notes, query]);
  const displayedNotes = useMemo(() => {
    if (!query.trim() || serverResults === null) return localResults;
    const pendingMatches = localResults.filter((note) => mutationStates[note.id]);
    return pendingMatches.reduce((current, note) => upsertNote(current, note), serverResults);
  }, [localResults, mutationStates, query, serverResults]);
  const filteringNotes = Boolean(query.trim());

  const setPending = useCallback((next: PendingCapture[]): boolean => {
    const persisted = writeSession(recoveryKeys.captures, next);
    pendingRef.current = next;
    setPendingCaptures(next);
    return persisted;
  }, [recoveryKeys.captures]);

  const writeRecoveredEdit = useCallback((noteId: string, edit: RecoveredEdit | null): boolean => {
    const edits = readSession<Record<string, RecoveredEdit>>(recoveryKeys.edits, {});
    if (edit) edits[noteId] = edit;
    else delete edits[noteId];
    const persisted = writeSession(recoveryKeys.edits, Object.keys(edits).length ? edits : null);
    if (persisted) {
      setRecoveredEditIds(Object.keys(edits));
    }
    return persisted;
  }, [recoveryKeys.edits]);

  const announce = useCallback((message: string) => {
    if (announcementTimerRef.current !== null) {
      window.clearTimeout(announcementTimerRef.current);
    }
    setAnnouncement("");
    announcementTimerRef.current = window.setTimeout(() => {
      setAnnouncement(message);
      announcementTimerRef.current = null;
    }, 20);
  }, []);

  const showToast = useCallback((next: Toast) => {
    setToast(next);
    announce(next.message);
    window.setTimeout(() => setToast((current) => (current === next ? null : current)), 4_500);
  }, [announce]);

  useEffect(() => () => {
    if (announcementTimerRef.current !== null) {
      window.clearTimeout(announcementTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (captureDiscardOpen) captureKeepRef.current?.focus({ preventScroll: true });
  }, [captureDiscardOpen]);

  useEffect(() => {
    if (navigationPrompt) navigationPrimaryRef.current?.focus({ preventScroll: true });
  }, [navigationPrompt]);

  useEffect(() => {
    if (deleteConfirm) deletePrimaryRef.current?.focus({ preventScroll: true });
  }, [deleteConfirm]);

  const previousExtractRef = useRef<ExtractState | null>(null);
  useEffect(() => {
    if (extract && !extract.immutableRetry && !previousExtractRef.current) {
      approvalTextareaRef.current?.focus({ preventScroll: true });
      approvalTextareaRef.current?.select();
    }
    previousExtractRef.current = extract;
  }, [extract]);

  useEffect(() => {
    if (conflict) conflictPrimaryRef.current?.focus({ preventScroll: true });
  }, [conflict]);

  useEffect(() => {
    if (!demoMode) return;
    const value = new URLSearchParams(window.location.search).get("hybridMode");
    const allowed: ReviewMode[] = [
      "save-error",
      "conflict",
      "tasks-error",
      "tasks-lost-reply",
      "offline",
      "read-only",
    ];
    setReviewMode(allowed.includes(value as ReviewMode) ? (value as ReviewMode) : "default");
  }, [demoMode]);

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

  useEffect(() => {
    const media = window.matchMedia("(max-width: 67.99rem)");
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileDetailOpen) return;
    const root = document.querySelector<HTMLElement>("[data-hybrid-notebook]");
    const outsideContent = root?.parentElement
      ? Array.from(root.parentElement.children).filter(
          (element): element is HTMLElement => element instanceof HTMLElement && element !== root,
        )
      : [];
    const previous = outsideContent.map((element) => ({
      element,
      inert: element.hasAttribute("inert"),
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    for (const { element } of previous) {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    }
    return () => {
      for (const { element, inert, ariaHidden } of previous) {
        if (!inert) element.removeAttribute("inert");
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
    };
  }, [mobileDetailOpen]);

  useEffect(() => {
    if (!mobileDetailOpen) return;
    const detailPane = document.getElementById("hybrid-note-detail");
    if (detailPane?.contains(document.activeElement)) return;
    window.setTimeout(() => detailRef.current?.focus({ preventScroll: true }), 0);
  }, [mobileDetailOpen]);

  useEffect(() => {
    const persisted = writeSession(recoveryKeys.draft, draft);
    setRecoveryStorageAvailable(persisted);
  }, [draft, recoveryKeys.draft]);

  const submitCapture = useCallback(
    async (
      capture: PendingCapture,
      recoveryReady = true,
      clearComposerGeneration: number | null = null,
    ): Promise<boolean> => {
      const persistenceReady = recoveryReady || writeSession(recoveryKeys.captures, pendingRef.current);
      setRecoveryStorageAvailable(persistenceReady);
      setMutationStates((current) => ({
        ...current,
        [capture.id]: online ? "pending" : persistenceReady ? "offline" : "failed",
      }));
      if (!online) {
        setCaptureStatus(persistenceReady ? "offline" : "failed");
        const message = persistenceReady
          ? "Saved on this device. Signal Notes will retry when you reconnect."
          : "Local recovery is blocked. Your exact words remain in the editor; keep this tab open and reconnect before leaving.";
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
            throw new Error("The first save did not reach Notes. Your exact draft is still here.");
          }
          await Promise.resolve();
          const saved = pendingNote(capture);
          setNotes((current) => upsertNote(current, saved));
        } else {
          const saved = await createNoteIdempotent({
            id: capture.id,
            body: capture.body,
            workspaceId: capture.workspaceId,
          });
          setNotes((current) => upsertNote(current, saved));
        }
        const next = pendingRef.current.filter((item) => item.id !== capture.id);
        setPending(next);
        setMutationStates((current) => ({ ...current, [capture.id]: "saved" }));
        setCaptureStatus("saved");
        setCaptureError(null);
        if (
          clearComposerGeneration !== null &&
          captureGenerationRef.current === clearComposerGeneration
        ) {
          setDraft((current) => (current === capture.body ? "" : current));
        }
        announce("Note saved. Your cursor is ready for the next thought.");
        if (
          FIRST_CAPTURE_ENABLED &&
          initialNotes.length === 0 &&
          initialArchivedNotes.length === 0 &&
          !hasSeenFirstCapture()
        ) {
          markFirstCaptureSeen();
          setFirstCapture(true);
        }
        window.setTimeout(() => {
          setCaptureStatus((current) => (current === "saved" ? "idle" : current));
        }, 1_800);
        return true;
      } catch (error) {
        setMutationStates((current) => ({ ...current, [capture.id]: "failed" }));
        setCaptureStatus("failed");
        const message = friendlyError(error, "Your note could not be saved. Your exact words are retained.");
        setCaptureError(
          persistenceReady
            ? message
            : `${message} Local recovery is blocked, so keep this tab open.`,
        );
        announce(message);
        return false;
      }
    },
    [announce, demoMode, initialArchivedNotes.length, initialNotes.length, online, recoveryKeys.captures, reviewMode, setPending],
  );

  const commitDraft = useCallback(async () => {
    if (readOnly || !draft.trim() || captureStatus === "pending") return;
    if (draft.length > MAX_NOTE_BODY_CHARS) {
      setCaptureStatus("failed");
      setCaptureError("Notes can be up to 10,000 characters.");
      return;
    }
    const composerGeneration = captureGenerationRef.current;
    const retainedCapture = pendingRef.current.find(
      (capture) => capture.body === draft && capture.workspaceId === (selectedWorkspaceId || null),
    );
    if (retainedCapture) {
      await submitCapture(retainedCapture, false, composerGeneration);
      captureRef.current?.focus({ preventScroll: true });
      return;
    }
    const capture: PendingCapture = {
      id: stableNoteId(),
      body: draft,
      workspaceId: selectedWorkspaceId || null,
      createdAt: Date.now(),
    };
    const next = [capture, ...pendingRef.current.filter((item) => item.id !== capture.id)];
    const persisted = setPending(next);
    setRecoveryStorageAvailable(persisted);
    setNotes((current) => upsertNote(current, pendingNote(capture)));
    if (persisted) setDraft("");
    else setCaptureError("Local recovery is blocked. Saving now; keep this tab open until Notes confirms.");
    setCaptureDiscardOpen(false);
    await submitCapture(capture, persisted, composerGeneration);
    captureRef.current?.focus({ preventScroll: true });
  }, [captureStatus, draft, readOnly, selectedWorkspaceId, setPending, submitCapture]);

  useLayoutEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const claimed = window.__signalNotesClaimEarlyCapture?.();
    const recoveredDraft = readSession<string>(recoveryKeys.draft, "");
    const recoveredPending = readSession<PendingCapture[]>(recoveryKeys.captures, []).filter(
      (capture) =>
        typeof capture.id === "string" &&
        typeof capture.body === "string" &&
        typeof capture.createdAt === "number" &&
        /^n_[0-9a-f]{32}$/.test(capture.id),
    );
    const recoveredEdits = readSession<Record<string, RecoveredEdit>>(recoveryKeys.edits, {});
    const claimedValue = claimed?.value ?? "";
    if (claimedValue && recoveredDraft && claimedValue !== recoveredDraft) {
      const collisionId = stableNoteId();
      recoveredEdits[collisionId] = {
        body: recoveredDraft,
        expectedUpdatedAt: Date.now(),
        queued: false,
      };
      const collisionPersisted = writeSession(recoveryKeys.edits, recoveredEdits);
      if (!collisionPersisted) setRecoveryStorageAvailable(false);
      setCaptureError(
        collisionPersisted
          ? "Your earlier recovered draft is kept below as a separate local version."
          : "Storage is full. Both drafts are visible in this tab, but the earlier version below is not durable; keep this tab open.",
      );
    }
    const validRecoveredEntries = Object.entries(recoveredEdits)
      .filter(([, edit]) =>
          typeof edit?.body === "string" &&
          typeof edit?.expectedUpdatedAt === "number" &&
          typeof edit?.queued === "boolean"
      );
    setRecoveredEditIds(validRecoveredEntries.map(([noteId]) => noteId));
    const activeIds = new Set(initialNotes.map((note) => note.id));
    setOrphanedRecoveries(
      Object.fromEntries(validRecoveredEntries.filter(([noteId]) => !activeIds.has(noteId))),
    );
    const adopted = claimedValue || recoveredDraft;
    if (adopted) setDraft(adopted);
    if (recoveredPending.length) {
      setPending(recoveredPending);
      setNotes((current) => {
        let merged = current;
        for (const capture of recoveredPending) merged = upsertNote(merged, pendingNote(capture));
        return merged;
      });
      for (const capture of recoveredPending) void submitCapture(capture, true);
    }
    earlySaveQueued.current = Boolean(claimed?.pendingSave);
    captureRef.current?.focus({ preventScroll: true });
  }, [recoveryKeys.captures, recoveryKeys.draft, recoveryKeys.edits, setPending, submitCapture]);

  useEffect(() => {
    if (!earlySaveQueued.current || !draft.trim()) return;
    earlySaveQueued.current = false;
    void commitDraft();
  }, [commitDraft, draft]);

  useEffect(() => {
    if (!online) return;
    for (const capture of pendingRef.current) {
      if (mutationStates[capture.id] === "offline") void submitCapture(capture, true);
    }
  }, [mutationStates, online, submitCapture]);

  useEffect(() => {
    const normalized = query.trim();
    const sequence = ++searchSequence.current;
    setSearchCursor(-1);
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
    const timer = window.setTimeout(() => {
      void searchNotes(normalized)
        .then((results) => {
          if (searchSequence.current !== sequence) return;
          setServerResults(results);
          setSearchState("ready");
        })
        .catch(() => {
          if (searchSequence.current !== sequence) return;
          setServerResults(null);
          setSearchState("fallback");
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [demoMode, query]);

  useEffect(() => {
    if (!query.trim() || (searchState !== "ready" && searchState !== "fallback")) return;
    const count = displayedNotes.length;
    announce(
      searchState === "fallback"
        ? `Search index is unavailable. Showing ${count} local match${count === 1 ? "" : "es"}.`
        : `${count} search match${count === 1 ? "" : "es"}.`,
    );
  }, [announce, displayedNotes.length, query, searchState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.isComposing || event.keyCode === 229) return;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !isTyping &&
        !mobileDetailOpen
      ) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (event.key === "Escape") {
        if (captureDiscardOpen) {
          event.preventDefault();
          setCaptureDiscardOpen(false);
          captureRef.current?.focus({ preventScroll: true });
          return;
        }
        if (navigationPrompt) {
          event.preventDefault();
          setNavigationPrompt(null);
          detailRef.current?.focus({ preventScroll: true });
          return;
        }
        if (deleteConfirm) {
          event.preventDefault();
          setDeleteConfirm(false);
          detailRef.current?.focus({ preventScroll: true });
          return;
        }
        if (extract && target === approvalTextareaRef.current && extract.status !== "sending" && !extract.immutableRetry) {
          event.preventDefault();
          setExtract(null);
          window.setTimeout(() => approvalTriggerRef.current?.focus({ preventScroll: true }), 0);
          return;
        }
        if (target === captureRef.current && draft) {
          event.preventDefault();
          setCaptureDiscardOpen(true);
          return;
        }
        if (openId && (!isTyping || target === detailRef.current)) {
          event.preventDefault();
          requestOpen(null);
        }
        return;
      }
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey || mobileDetailOpen) return;
      if (!["j", "k", "ArrowDown", "ArrowUp"].includes(event.key)) return;
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !target?.closest("[data-note-row]")) return;
      const rows = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-note-row]"));
      if (!rows.length) return;
      event.preventDefault();
      const index = rows.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "j" || event.key === "ArrowDown";
      const nextIndex = index < 0 ? (next ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, index + (next ? 1 : -1)));
      rows[nextIndex]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!draft && !detailDirty && pendingRef.current.length === 0 && recoveredEditIds.length === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [detailDirty, draft, recoveredEditIds.length]);

  useEffect(() => {
    if (!openNote) return;
    const recovered = readSession<Record<string, RecoveredEdit>>(recoveryKeys.edits, {})[openNote.id];
    const validRecovery =
      recovered &&
      typeof recovered.body === "string" &&
      typeof recovered.expectedUpdatedAt === "number" &&
      typeof recovered.queued === "boolean";
    if (validRecovery) {
      setDetailBody(recovered.body);
      setDetailBaseUpdatedAt(recovered.expectedUpdatedAt);
      setQueuedEdit(recovered.queued);
      if (recovered.expectedUpdatedAt !== openNote.updatedAt) {
        setConflict({ noteId: openNote.id, localBody: recovered.body, remote: openNote });
        setDetailError("A recovered local edit has a newer saved version to compare. Both are preserved below.");
      } else {
        setConflict(null);
      }
    } else {
      setDetailBody(openNote.body);
      setDetailBaseUpdatedAt(openNote.updatedAt);
      setQueuedEdit(false);
      setConflict(null);
    }
    setDetailStatus("idle");
    if (!validRecovery || recovered.expectedUpdatedAt === openNote.updatedAt) setDetailError(null);
    setSelection("");
    setDeleteConfirm(false);
    setNavigationPrompt(null);
    setTimelineDraft({ title: "", date: "", completion: 0, audienceLabel: "" });
    setTimelineReceipt(null);
    const pendingApprovedSend = pendingApprovedTaskSendsRef.current.find(
      (send) => send.noteId === openNote.id,
    );
    if (pendingApprovedSend) setSelectedWorkspaceId(pendingApprovedSend.workspaceId);
    setExtract(
      pendingApprovedSend
        ? {
            sourceSelection: pendingApprovedSend.sourceSelection,
            approvedBody: pendingApprovedSend.approvedBody,
            status: "failed",
            error: copy.errors.retryPending,
            receipt: null,
            immutableRetry: {
              workspaceId: pendingApprovedSend.workspaceId,
              expectedUpdatedAt: pendingApprovedSend.baseUpdatedAt,
            },
          }
        : openNote.promotedTaskId
        ? {
            sourceSelection: "",
            approvedBody: openNote.extractBody ?? "",
            status: "sent",
            error: null,
            receipt: null,
            immutableRetry: null,
          }
        : null,
    );
    window.setTimeout(() => detailRef.current?.focus({ preventScroll: true }), 0);
  }, [openId]); // Intentionally resets only when navigating, not on every optimistic row merge.

  useEffect(() => {
    if (!openNote) {
      openVersionRef.current = null;
      return;
    }
    const previous = openVersionRef.current;
    openVersionRef.current = {
      id: openNote.id,
      body: openNote.body,
      updatedAt: openNote.updatedAt,
    };
    if (!previous || previous.id !== openNote.id) return;
    if (previous.updatedAt === openNote.updatedAt && previous.body === openNote.body) return;
    const recovered = readSession<Record<string, RecoveredEdit>>(recoveryKeys.edits, {})[openNote.id];
    if (conflict) return;
    if (openNote.body === previous.body) {
      setDetailBaseUpdatedAt(openNote.updatedAt);
      if (recovered?.expectedUpdatedAt === previous.updatedAt) {
        writeRecoveredEdit(openNote.id, {
          ...recovered,
          expectedUpdatedAt: openNote.updatedAt,
        });
      }
      return;
    }
    if (recovered) return;
    if (detailBody !== previous.body) return;
    setDetailBody(openNote.body);
    setDetailBaseUpdatedAt(openNote.updatedAt);
  }, [conflict, detailBody, openNote, recoveryKeys.edits, writeRecoveredEdit]);

  const saveDetail = useCallback(
    async (overrideExpectedAt?: number): Promise<boolean> => {
      if (!openNote || readOnly || noteInteractionLocked || !detailDirty) return false;
      if (!detailBody.trim()) {
        setDetailStatus("failed");
        setDetailError("A note cannot be empty. Delete it explicitly if you no longer need it.");
        return false;
      }
      if (detailBody.length > MAX_NOTE_BODY_CHARS) {
        setDetailStatus("failed");
        setDetailError("Notes can be up to 10,000 characters.");
        return false;
      }
      if (!online) {
        setDetailStatus("failed");
        const persisted = writeRecoveredEdit(openNote.id, {
          body: detailBody,
          expectedUpdatedAt: overrideExpectedAt ?? detailBaseUpdatedAt,
          queued: true,
        });
        setQueuedEdit(persisted);
        setDetailError(
          persisted
            ? "Saved for retry in this tab. Signal Notes will version-check the edit when you reconnect."
            : "Local recovery is blocked. Your edit remains visible; keep this tab open until you reconnect and save.",
        );
        return false;
      }
      setDetailStatus("saving");
      setDetailError(null);
      try {
        if (demoMode) {
          if (reviewMode === "conflict" && !simulatedConflictOnce.current) {
            simulatedConflictOnce.current = true;
            const remote = demoSavedNote(openNote, `${openNote.body}\n\nRemote review edit.`);
            const recovered = writeRecoveredEdit(openNote.id, {
              body: detailBody,
              expectedUpdatedAt: detailBaseUpdatedAt,
              queued: false,
            });
            setNotes((current) => upsertNote(current, remote));
            setConflict({ noteId: openNote.id, localBody: detailBody, remote });
            setDetailStatus("failed");
            setDetailError(
              recovered
                ? "This note changed elsewhere. Both exact versions are preserved below."
                : "This note changed elsewhere. Both versions are visible, but local recovery is blocked; keep this tab open.",
            );
            return false;
          }
          const saved = demoSavedNote(
            { ...openNote, updatedAt: overrideExpectedAt ?? openNote.updatedAt },
            detailBody,
          );
          setNotes((current) => upsertNote(current, saved));
          setDetailBaseUpdatedAt(saved.updatedAt);
        } else {
          const result = await updateNoteWithVersion({
            id: openNote.id,
            body: detailBody,
            expectedUpdatedAt: overrideExpectedAt ?? detailBaseUpdatedAt,
          });
          if (result.status === "conflict") {
            const recovered = writeRecoveredEdit(openNote.id, {
              body: detailBody,
              expectedUpdatedAt: detailBaseUpdatedAt,
              queued: false,
            });
            setNotes((current) => upsertNote(current, result.remote));
            setConflict({ noteId: openNote.id, localBody: detailBody, remote: result.remote });
            setDetailStatus("failed");
            setDetailError(
              recovered
                ? "This note changed elsewhere. Both exact versions are preserved below."
                : "This note changed elsewhere. Both versions are visible, but local recovery is blocked; keep this tab open.",
            );
            return false;
          }
          setNotes((current) => upsertNote(current, result.note));
          setDetailBaseUpdatedAt(result.note.updatedAt);
        }
        writeRecoveredEdit(openNote.id, null);
        setQueuedEdit(false);
        setConflict(null);
        setDetailStatus("saved");
        announce("Note edit saved.");
        window.setTimeout(() => setDetailStatus((current) => (current === "saved" ? "idle" : current)), 1_800);
        return true;
      } catch (error) {
        const persisted = writeRecoveredEdit(openNote.id, {
          body: detailBody,
          expectedUpdatedAt: overrideExpectedAt ?? detailBaseUpdatedAt,
          queued: true,
        });
        setQueuedEdit(!navigator.onLine && persisted);
        setDetailStatus("failed");
        const message = friendlyError(error, "This edit could not be saved. Your local version remains in the editor.");
        setDetailError(
          persisted
            ? `${message} It is retained for a deliberate retry.`
            : `${message} Local recovery is blocked, so keep this tab open.`,
        );
        return false;
      }
    },
    [announce, demoMode, detailBaseUpdatedAt, detailBody, detailDirty, noteInteractionLocked, online, openNote, readOnly, reviewMode, writeRecoveredEdit],
  );

  useEffect(() => {
    if (!online || !queuedEdit || !openNote || conflict || readOnly) return;
    void saveDetail();
  }, [conflict, online, openNote, queuedEdit, readOnly, saveDetail]);

  function performOpen(targetId: string | null): void {
    const closingId = targetId === null ? openId : null;
    setOpenId(targetId);
    if (closingId) {
      window.setTimeout(() => {
        const opener = document.querySelector<HTMLElement>(`[data-note-id="${closingId}"]`);
        (opener ?? captureRef.current)?.focus({ preventScroll: true });
      }, 0);
    }
  }

  function requestOpen(targetId: string | null): void {
    if (targetId === openId) return;
    if (navigationBlocked) {
      setDetailError(
        uncertainTasksReceipt
          ? copy.errors.leaveBlockedRetry
          : tasksSendInFlight
          ? copy.errors.leaveBlockedSending
          : timelineSending
            ? "Wait for Timeline to confirm this exact preview before leaving the note."
            : "Wait for this edit to finish saving before leaving the note.",
      );
      return;
    }
    if (detailDirty) {
      setNavigationPrompt({ targetId });
      return;
    }
    performOpen(targetId);
  }

  async function saveAndNavigate(): Promise<void> {
    if (!navigationPrompt) return;
    const target = navigationPrompt.targetId;
    if (await saveDetail()) {
      setNavigationPrompt(null);
      performOpen(target);
    }
  }

  function discardAndNavigate(): void {
    if (!navigationPrompt) return;
    const target = navigationPrompt.targetId;
    if (openNote && !writeRecoveredEdit(openNote.id, null)) {
      setDetailError("Local recovery is blocked, so Notes did not discard this edit. Keep this tab open.");
      return;
    }
    setQueuedEdit(false);
    setNavigationPrompt(null);
    performOpen(target);
  }

  function updateSelection(): void {
    const textarea = detailRef.current;
    if (!textarea) return;
    const next = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
    setSelection(next);
  }

  function beginExtraction(): void {
    if (!openNote || conflict || noteInteractionLocked) return;
    if (detailDirty) {
      setDetailError(copy.errors.unsavedNote);
      return;
    }
    if (!selection.trim()) {
      setDetailError(copy.errors.nothingSelected);
      detailRef.current?.focus();
      return;
    }
    setDetailError(null);
    setExtract({
      sourceSelection: selection,
      approvedBody: selection.slice(0, MAX_APPROVED_EXTRACT_CHARS),
      status: "review",
      error: selection.length > MAX_APPROVED_EXTRACT_CHARS
        ? copy.errors.selectionTooLong
        : null,
      receipt: null,
      immutableRetry: null,
    });
  }

  async function sendApprovedExtract(): Promise<void> {
    if (!openNote || !extract || readOnly || conflict || detailSaveInFlight || timelineSending || conflictResolving) return;
    const targetWorkspaceId = extract.immutableRetry?.workspaceId ?? selectedWorkspaceId;
    const targetExpectedUpdatedAt = extract.immutableRetry?.expectedUpdatedAt ?? detailBaseUpdatedAt;
    if (!targetWorkspaceId) {
      setExtract({ ...extract, status: "failed", error: copy.errors.noDestination });
      return;
    }
    if (!extract.approvedBody.trim()) {
      setExtract({ ...extract, status: "failed", error: copy.errors.emptyWording });
      return;
    }
    if (extract.approvedBody.length > MAX_APPROVED_EXTRACT_CHARS) {
      setExtract({ ...extract, status: "failed", error: copy.errors.tooLong });
      return;
    }
    if (!online) {
      setExtract({ ...extract, status: "failed", error: copy.errors.offline });
      return;
    }
    setExtract({ ...extract, status: "sending", error: null });
    try {
      let note: NoteRead;
      let receipt: ExtractSendResult;
      if (demoMode) {
        if (reviewMode === "tasks-error") {
          throw new Error(copy.errors.tasksUnavailable);
        }
        if (reviewMode === "tasks-lost-reply" && !lostTasksReplyOnce.current) {
          lostTasksReplyOnce.current = true;
          throw new Error(copy.errors.replyLost);
        }
        const taskId = `review_task_${openNote.id.replace(/[^a-z0-9]/gi, "_")}`;
        note = {
          ...openNote,
          extractBody: extract.approvedBody,
          promotedTaskId: taskId,
          workspaceId: targetWorkspaceId,
          archivedAt: null,
          updatedAt: Math.max(Date.now(), openNote.updatedAt + 1),
        };
        receipt = {
          taskId,
          workspaceName: availableWorkspaces.find((workspace) => workspace.id === targetWorkspaceId)?.name ?? "Tasks",
          workspaceSlug: "review-workspace",
          taskUrl: taskReceiptHref(taskId, demoMode),
          created: reviewMode !== "tasks-lost-reply",
        };
      } else {
        const result = await sendApprovedExtractToTasks({
          noteId: openNote.id,
          sourceSelection: extract.sourceSelection,
          approvedBody: extract.approvedBody,
          workspaceId: targetWorkspaceId,
          expectedUpdatedAt: targetExpectedUpdatedAt,
        });
        if (result.status === "conflict") {
          const recovered = writeRecoveredEdit(openNote.id, {
            body: detailBody,
            expectedUpdatedAt: detailBaseUpdatedAt,
            queued: false,
          });
          setNotes((current) => upsertNote(current, result.remote));
          setConflict({ noteId: openNote.id, localBody: detailBody, remote: result.remote });
          setExtract({
            ...extract,
            status: "failed",
            error: recovered
              ? copy.errors.sourceChanged
              : copy.errors.sourceChangedNoRecovery,
          });
          return;
        }
        note = result.note;
        receipt = result.result;
      }
      setNotes((current) => upsertNote(current, note));
      setDetailBaseUpdatedAt(note.updatedAt);
      setExtract({ ...extract, status: "sent", error: null, receipt, immutableRetry: null });
      setPendingApprovedTaskSends((current) => current.filter((send) => send.noteId !== note.id));
      showToast({ state: "saved", message: receipt.created ? copy.receipts.sent : copy.receipts.recovered });
      window.setTimeout(() => receiptLinkRef.current?.focus({ preventScroll: true }), 0);
    } catch (error) {
      const message = friendlyError(error, copy.errors.tasksUnavailable);
      if (!demoMode && openNote) {
        try {
          const recovery = await getApprovedTaskSendRecoveryForHybrid(openNote.id);
          if (recovery.status === "completed") {
            setPendingApprovedTaskSends((current) => current.filter((send) => send.noteId !== openNote.id));
            setNotes((current) => upsertNote(current, recovery.note));
            setDetailBaseUpdatedAt(recovery.note.updatedAt);
            setExtract((current) => current ? {
              ...current,
              approvedBody: recovery.note.extractBody ?? current.approvedBody,
              status: "sent",
              error: null,
              receipt: recovery.result,
              immutableRetry: null,
            } : current);
            showToast({ state: "saved", message: copy.receipts.recovered });
            window.setTimeout(() => receiptLinkRef.current?.focus({ preventScroll: true }), 0);
            return;
          }
          const pending = recovery.status === "pending" ? recovery.send : null;
          setPendingApprovedTaskSends((current) => {
            const withoutNote = current.filter((send) => send.noteId !== openNote.id);
            return pending ? [pending, ...withoutNote] : withoutNote;
          });
          setExtract((current) => current ? {
            ...current,
            sourceSelection: pending?.sourceSelection ?? current.sourceSelection,
            approvedBody: pending?.approvedBody ?? current.approvedBody,
            status: "failed",
            error: pending
              ? `${message} The exact pending request is locked for a safe retry.`
              : `${message} Tasks declined this request before creating anything, so you may revise it.`,
            immutableRetry: pending
              ? {
                  workspaceId: pending.workspaceId,
                  expectedUpdatedAt: pending.baseUpdatedAt,
                }
              : null,
          } : current);
        } catch {
          setExtract((current) => current ? {
            ...current,
            status: "failed",
            error: `${message} Receipt status could not be confirmed, so this exact request stays locked until retry.`,
            immutableRetry: current.immutableRetry ?? {
              workspaceId: targetWorkspaceId,
              expectedUpdatedAt: targetExpectedUpdatedAt,
            },
          } : current);
        }
      } else {
        setExtract((current) => current ? {
          ...current,
          status: "failed",
          error: message,
          immutableRetry:
            reviewMode === "tasks-lost-reply"
              ? {
                  workspaceId: targetWorkspaceId,
                  expectedUpdatedAt: targetExpectedUpdatedAt,
                }
              : current.immutableRetry,
        } : current);
      }
    }
  }

  async function keepLocalVersion(): Promise<void> {
    if (!conflict) return;
    setDetailBaseUpdatedAt(conflict.remote.updatedAt);
    if (await saveDetail(conflict.remote.updatedAt)) {
      window.setTimeout(() => detailRef.current?.focus({ preventScroll: true }), 0);
    }
  }

  function useRemoteVersion(): void {
    if (!conflict) return;
    if (!writeRecoveredEdit(conflict.noteId, null)) {
      setDetailError("Local recovery is blocked, so Notes kept both versions. Keep this tab open.");
      return;
    }
    setDetailBody(conflict.remote.body);
    setDetailBaseUpdatedAt(conflict.remote.updatedAt);
    setConflict(null);
    setDetailError(null);
    setDetailStatus("idle");
    setQueuedEdit(false);
    setSelection("");
    setExtract(null);
    window.setTimeout(() => detailRef.current?.focus({ preventScroll: true }), 0);
  }

  async function keepBothVersions(): Promise<void> {
    if (!conflict || readOnly || conflictResolving) return;
    const preservedConflict = conflict;
    const capture: PendingCapture = {
      id: stableNoteId(),
      body: detailBody,
      workspaceId: preservedConflict.remote.workspaceId,
      createdAt: Date.now(),
    };
    setConflictResolving(true);
    try {
      const next = [capture, ...pendingRef.current];
      const persisted = setPending(next);
      setNotes((current) => upsertNote(upsertNote(current, preservedConflict.remote), pendingNote(capture)));
      const saved = await submitCapture(capture, persisted);
      if (!saved && !persisted) {
        setConflict(preservedConflict);
        setDetailError("The separate copy is only in this tab. Keep both versions open and retry before leaving.");
        showToast({ state: "error", message: "The second version is not durable yet. Nothing was discarded." });
        return;
      }
      setDetailBody(preservedConflict.remote.body);
      setDetailBaseUpdatedAt(preservedConflict.remote.updatedAt);
      setConflict(null);
      setDetailError(null);
      setSelection("");
      setExtract(null);
      writeRecoveredEdit(preservedConflict.noteId, null);
      setQueuedEdit(false);
      showToast({ state: "saved", message: "Both exact versions are retained as separate notes." });
      window.setTimeout(() => detailRef.current?.focus({ preventScroll: true }), 0);
    } finally {
      setConflictResolving(false);
    }
  }

  async function retryCapture(id: string): Promise<void> {
    const capture = pendingRef.current.find((item) => item.id === id);
    if (capture && await submitCapture(capture, false)) {
      window.setTimeout(() => {
        document.querySelector<HTMLElement>(`[data-note-id="${id}"]`)?.focus({ preventScroll: true });
      }, 0);
    }
  }

  async function dismissFailedCapture(id: string): Promise<void> {
    const capture = pendingRef.current.find((item) => item.id === id);
    if (!capture) return;
    if (!online) {
      showToast({ state: "error", message: "Reconnect before discarding. The exact local recovery is still retained." });
      return;
    }
    const index = displayedNotes.findIndex((note) => note.id === id);
    const focusId = displayedNotes[index + 1]?.id ?? displayedNotes[index - 1]?.id ?? null;
    setMutationStates((current) => ({ ...current, [id]: "pending" }));
    setCaptureStatus("pending");
    try {
      if (!demoMode) {
        const reconciled = await createNoteIdempotent({
          id: capture.id,
          body: capture.body,
          workspaceId: capture.workspaceId,
        });
        const deleted = await deleteNoteWithVersion({
          id: reconciled.id,
          expectedUpdatedAt: reconciled.updatedAt,
        });
        if (deleted.status === "conflict") {
          setMutationStates((current) => ({ ...current, [id]: "failed" }));
          setCaptureStatus("failed");
          showToast({
            state: "error",
            message: "This capture changed or has a pending send, so it was not discarded. Your exact local recovery is retained.",
          });
          return;
        }
      }
    } catch (error) {
      setMutationStates((current) => ({ ...current, [id]: "failed" }));
      setCaptureStatus("failed");
      showToast({
        state: "error",
        message: friendlyError(error, "Notes could not confirm whether this capture reached the server. Its exact local recovery was retained."),
      });
      return;
    }
    const next = pendingRef.current.filter((capture) => capture.id !== id);
    if (!writeSession(recoveryKeys.captures, next)) {
      setMutationStates((current) => ({ ...current, [id]: "failed" }));
      setCaptureStatus("failed");
      setRecoveryStorageAvailable(false);
      showToast({
        state: "error",
        message: "The server copy was removed, but Notes could not clear the local recovery. Retry explicit discard before leaving this tab.",
      });
      return;
    }
    pendingRef.current = next;
    setPendingCaptures(next);
    setRecoveryStorageAvailable(true);
    setCaptureStatus("idle");
    setCaptureError(null);
    setNotes((current) => current.filter((note) => note.id !== id));
    setMutationStates((current) => {
      const copy = { ...current };
      delete copy[id];
      return copy;
    });
    window.setTimeout(() => {
      const target = focusId
        ? document.querySelector<HTMLElement>(`[data-note-id="${focusId}"]`)
        : captureRef.current;
      target?.focus({ preventScroll: true });
    }, 0);
  }

  async function restoreOrphanedRecovery(sourceNoteId: string): Promise<void> {
    const recovered = orphanedRecoveries[sourceNoteId];
    if (!recovered || readOnly) return;
    const capture: PendingCapture = {
      id: stableNoteId(),
      body: recovered.body,
      workspaceId: null,
      createdAt: Date.now(),
    };
    const next = [capture, ...pendingRef.current];
    const persisted = setPending(next);
    setNotes((current) => upsertNote(current, pendingNote(capture)));
    if (persisted && writeRecoveredEdit(sourceNoteId, null)) {
      setOrphanedRecoveries((current) => {
        const copy = { ...current };
        delete copy[sourceNoteId];
        return copy;
      });
    }
    await submitCapture(capture, persisted);
    showToast({
      state: "saved",
      message: online
        ? "Recovered local wording was restored as a separate private note."
        : "Recovered local wording is queued as a separate private note.",
    });
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-note-id="${capture.id}"]`)?.focus({ preventScroll: true });
    }, 0);
  }

  function discardOrphanedRecovery(sourceNoteId: string): void {
    if (!writeRecoveredEdit(sourceNoteId, null)) {
      showToast({ state: "error", message: "Local recovery storage is blocked. This retained edit was not discarded." });
      return;
    }
    setOrphanedRecoveries((current) => {
      const copy = { ...current };
      delete copy[sourceNoteId];
      return copy;
    });
    showToast({ state: "saved", message: "Recovered local edit discarded explicitly." });
    window.setTimeout(() => captureRef.current?.focus({ preventScroll: true }), 0);
  }

  function requestDelete(): void {
    if (!readOnly && !conflict && !noteInteractionLocked) setDeleteConfirm(true);
  }

  const finalizeDelete = useCallback(async (removed: NoteRead): Promise<void> => {
    if (demoMode) return;
    try {
      const result = await deleteNoteWithVersion({
        id: removed.id,
        expectedUpdatedAt: removed.updatedAt,
      });
      if (result.status === "conflict") {
        setNotes((current) => upsertNote(current, result.remote));
        showToast({
          state: "error",
          message: copy.errors.deleteBlocked,
        });
      }
    } catch (error) {
      setNotes((current) => upsertNote(current, removed));
      showToast({ state: "error", message: friendlyError(error, "Delete failed. The note was restored.") });
    }
  }, [demoMode, showToast]);

  function confirmDelete(): void {
    if (!openNote || readOnly || conflict || noteInteractionLocked) return;
    const index = notes.findIndex((note) => note.id === openNote.id);
    const removed = openNote;
    setNotes((current) => current.filter((note) => note.id !== removed.id));
    if (!writeRecoveredEdit(removed.id, null)) {
      setDeleteConfirm(false);
      setDetailError("Local recovery is blocked, so Notes did not delete this note. Keep this tab open.");
      detailRef.current?.focus({ preventScroll: true });
      return;
    }
    setQueuedEdit(false);
    setOpenId(null);
    setDeleteConfirm(false);
    const timer = window.setTimeout(() => {
      const restoreFocus = document.activeElement === undoButtonRef.current;
      setDeleteUndo((current) => (current?.note.id === removed.id ? null : current));
      void finalizeDelete(removed);
      if (restoreFocus) window.setTimeout(() => captureRef.current?.focus({ preventScroll: true }), 0);
    }, DELETE_UNDO_MS);
    setDeleteUndo((current) => {
      if (current) {
        window.clearTimeout(current.timer);
        void finalizeDelete(current.note);
      }
      return { note: removed, index, timer };
    });
    window.setTimeout(() => undoButtonRef.current?.focus({ preventScroll: true }), 0);
  }

  function undoDeleteNote(): void {
    if (!deleteUndo) return;
    const keepFocusInMobileDetail = mobileDetailOpen;
    window.clearTimeout(deleteUndo.timer);
    setNotes((current) => {
      const copy = current.filter((note) => note.id !== deleteUndo.note.id);
      copy.splice(Math.max(0, Math.min(deleteUndo.index, copy.length)), 0, deleteUndo.note);
      return copy;
    });
    setDeleteUndo(null);
    showToast({ state: "saved", message: "Note restored." });
    window.setTimeout(() => {
      if (keepFocusInMobileDetail) detailRef.current?.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>(`[data-note-id="${deleteUndo.note.id}"]`)?.focus({ preventScroll: true });
    }, 0);
  }

  async function restoreArchived(note: NoteRead): Promise<void> {
    if (readOnly) return;
    setRestoringId(note.id);
    try {
      const restored = demoMode
        ? { ...note, archivedAt: null, updatedAt: Math.max(Date.now(), note.updatedAt + 1) }
        : await restoreArchivedNoteForHybrid(note.id);
      setArchivedNotes((current) => current.filter((candidate) => candidate.id !== note.id));
      setNotes((current) => upsertNote(current, restored));
      showToast({ state: "saved", message: "Private source restored to the active notebook." });
      window.setTimeout(() => {
        document.querySelector<HTMLElement>(`[data-note-id="${note.id}"]`)?.focus({ preventScroll: true });
      }, 0);
    } catch (error) {
      showToast({ state: "error", message: friendlyError(error, "This note could not be restored.") });
    } finally {
      setRestoringId(null);
    }
  }

  async function sendTimelinePreview(): Promise<void> {
    if (!openNote || readOnly || noteInteractionLocked || conflict) return;
    setTimelineSending(true);
    setTimelineReceipt(null);
    try {
      if (demoMode) {
        const message = "Review receipt: shared exactly as previewed. The private note stayed in Notes.";
        setTimelineReceipt(message);
        announce(message);
      } else {
        const receipt = await promoteSelectedExtractToTimeline({ noteId: openNote.id, ...timelineDraft });
        const message = receipt.status === "sent" ? `Shared exactly as previewed. ${receipt.url}` : receipt.message;
        setTimelineReceipt(message);
        announce(message);
      }
    } catch (error) {
      const message = friendlyError(error, "Timeline is unavailable. Your note stays private.");
      setTimelineReceipt(message);
      announce(message);
    } finally {
      setTimelineSending(false);
    }
  }

  function navigateSearch(direction: 1 | -1): void {
    if (!displayedNotes.length) return;
    const next = searchCursor < 0
      ? direction === 1 ? 0 : displayedNotes.length - 1
      : (searchCursor + direction + displayedNotes.length) % displayedNotes.length;
    setSearchCursor(next);
    const note = displayedNotes[next];
    requestOpen(note.id);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-note-id="${note.id}"]`)?.scrollIntoView({ block: "nearest" });
    }, 0);
  }

  function insertCaptureNewline(): void {
    const textarea = captureRef.current;
    if (!textarea || readOnly) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    captureGenerationRef.current += 1;
    setDraft((current) => `${current.slice(0, start)}\n${current.slice(end)}`);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1);
    }, 0);
  }

  function trapMobileDetailFocus(event: ReactKeyboardEvent<HTMLElement>): void {
    if (!mobileDetailOpen || event.key !== "Tab") return;
    const focusables = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => {
      if (
        element.hasAttribute("hidden") ||
        element.hasAttribute("inert") ||
        element.closest("[inert]") ||
        element.getAttribute("aria-hidden") === "true" ||
        element.getClientRects().length === 0
      ) return false;
      const closedDetails = element.closest("details:not([open])");
      return !closedDetails || element.tagName === "SUMMARY";
    });
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function copyCurrentNote(): Promise<void> {
    try {
      await navigator.clipboard.writeText(detailBody);
      showToast({ state: "saved", message: "Note copied to your clipboard." });
    } catch {
      showToast({ state: "error", message: "Clipboard access was unavailable. Your note was not changed." });
    }
  }

  const voice = useVoiceCapture({
    appendTranscript: (chunk) => {
      captureGenerationRef.current += 1;
      setDraft((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${chunk}`);
    },
    onStop: () => captureRef.current?.focus(),
  });

  useEffect(() => {
    if (!voice.message) return;
    announce(
      voice.message.kind === "denied"
        ? copy.voice.denied
        : voice.message.kind === "no-speech"
          ? copy.voice.noSpeech
          : copy.voice.failed,
    );
  }, [announce, copy, voice.message]);

  function onCaptureKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void commitDraft();
      return;
    }
    if (event.key === "Escape" && draft) {
      event.preventDefault();
      setCaptureDiscardOpen(true);
    }
  }

  const captureState = !online ? "offline" : captureStatus;
  const captureFeedbackVisible = Boolean(
    captureStatus !== "idle" ||
      !online ||
      (!recoveryStorageAvailable && draft) ||
      captureError ||
      voice.message,
  );
  const referenceNow = referenceTime ?? Date.now();
  const taskReceipt = openNote?.promotedTaskId
    ? extract?.receipt ?? {
        taskId: openNote.promotedTaskId,
        workspaceName: "Tasks",
        workspaceSlug: "",
        taskUrl: taskReceiptHref(openNote.promotedTaskId, demoMode),
        created: false,
      }
    : null;
  const handoffTravel = taskReceipt
    ? taskReceipt.created
    : extract?.status === "sending" && !extract.immutableRetry;

  // Demoted from <main> to <div>: the /app layout already owns the sole
  // <main> landmark. A nested <main> causes landmark-main-is-top-level +
  // landmark-no-duplicate-main axe violations (Phase 7 / Phase 9 fixes).
  return (
    <div id="main-content" className={styles.root} data-hybrid-notebook="true" data-review-mode={reviewMode} data-sentry-mask="true" data-clarity-mask="true" data-dd-privacy="mask" data-1p-ignore="true">
      <div className={styles.notebookFrame}>
      <header className={styles.notebookHeader}>
        <div className={styles.identity}>
          <h1 className={styles.wordmark}>Notes<span className={styles.wordmarkDot} aria-hidden="true">.</span></h1>
          <span className={styles.privateLabel}>Private notebook</span>
        </div>
        <span className={styles.headerAssurance}>{copy.capture.headerAssurance}</span>
      </header>
      <section className={styles.capture} data-state={captureState} aria-labelledby="hybrid-capture-label" inert={mobileDetailOpen ? true : undefined} aria-hidden={mobileDetailOpen ? true : undefined}>
        <div className={styles.captureHeader}>
          <div className={styles.captureIdentity}>
            <label id="hybrid-capture-label" className={styles.captureLabel} htmlFor="hybrid-capture">Capture</label>
            <span className={styles.privacyAssurance}>{copy.capture.privacyAssurance}</span>
          </div>
          <span className={styles.searchMeta}>{draft.length.toLocaleString()} / {MAX_NOTE_BODY_CHARS.toLocaleString()}</span>
        </div>
        <textarea
          id="hybrid-capture"
          ref={captureRef}
          className={styles.captureTextarea}
          data-notes-hybrid-capture="true"
          data-private-note-body="true"
          data-sentry-mask="true"
          data-clarity-mask="true"
          data-dd-privacy="mask"
          autoFocus
          value={draft}
          maxLength={MAX_NOTE_BODY_CHARS}
          readOnly={readOnly}
          placeholder={readOnly ? "Review fixture is read-only." : copy.capture.placeholder}
          aria-describedby={`hybrid-capture-hint${captureFeedbackVisible ? " hybrid-capture-state" : ""}`}
          onChange={(event) => {
            captureGenerationRef.current += 1;
            setDraft(event.target.value);
            setCaptureDiscardOpen(false);
            setCaptureError(null);
            voice.clearMessage();
          }}
          onKeyDown={onCaptureKeyDown}
        />
        <div className={styles.captureFooter}>
          <div className={styles.captureGuidance}>
            <p id="hybrid-capture-hint" className={styles.captureHint}>Enter saves · Shift + Enter adds a line · Escape asks before discarding</p>
            {/*
              E05.04. Dictation runs on the browser's own speech engine,
              which sends the audio to the browser maker's speech service.
              That is a third party the couple did not choose, and nothing in
              the product said so before this task. The line is standing, not
              a one-time dialog, and it is rendered before the first word is
              spoken rather than after. `aria-describedby` on the dictate
              button points here, so a screen reader reaches it too.

              Visual treatment is deliberately the existing quiet hint style.
              E05.11 owns the motion and polish pass; this task owns the fact
              being stated at all.
            */}
            {voice.engine === "ready" && !readOnly ? (
              <p id="hybrid-voice-disclosure" className={styles.captureHint}>
                {copy.voice.disclosure}
              </p>
            ) : null}
            {voice.engine === "unavailable" && !readOnly ? (
              <p className={styles.captureHint}>{copy.voice.unavailable}</p>
            ) : null}
            {captureEmailState ? (
              <CaptureEmailRow
                state={captureEmailState}
                onFeedback={showToast}
              />
            ) : null}
          </div>
          <div className={styles.captureActions}>
            {!readOnly ? <button type="button" className={`${styles.quietButton} ${styles.mobileOnly}`} onClick={insertCaptureNewline}>New line</button> : null}
            {voice.supported && !readOnly ? (
              <button
                type="button"
                className={styles.quietButton}
                aria-pressed={voice.listening}
                aria-describedby="hybrid-voice-disclosure"
                onClick={voice.toggle}
              >
                {voice.listening ? copy.voice.stop : copy.voice.start}
              </button>
            ) : null}
            <button type="button" className={styles.primaryButton} disabled={readOnly || !draft.trim() || captureStatus === "pending"} onClick={() => void commitDraft()}>
              {captureStatus === "pending" ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>
        {captureFeedbackVisible ? (
          <div id="hybrid-capture-state" className={styles.stateLine} data-state={captureState} role="status">
            {captureStatus === "saved" ? "Saved privately. Ready for another thought." : null}
            {captureStatus === "pending" ? "Saving this exact text…" : null}
            {!online ? "Offline. Held in this tab and queued for reconnect." : null}
            {!recoveryStorageAvailable && draft ? <span className={styles.errorText}>Device recovery is unavailable. Keep this tab open until Notes confirms the save.</span> : null}
            {captureError ? <span className={styles.errorText}>{captureError}</span> : null}
            {voice.message ? <span>{voice.message.kind === "denied" ? copy.voice.denied : voice.message.kind === "no-speech" ? copy.voice.noSpeech : copy.voice.failed}</span> : null}
          </div>
        ) : null}
        <AnimatePresence initial={false}>
        {captureDiscardOpen ? (
          <motion.div
            className={styles.discardPanel}
            data-delight-moment="decision-region"
            role="region"
            aria-labelledby="capture-discard-heading"
            initial={{ opacity: 0, transform: "translateY(-6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{
              opacity: 0,
              transform: "translateY(-4px)",
              transition: MOTION_EXIT,
            }}
            transition={MOTION_ENTER}
          >
            <strong id="capture-discard-heading">Discard this unsaved capture?</strong>
            <p>Your words stay in the field until you explicitly discard them.</p>
            <div className={styles.actionRow}>
              <button ref={captureKeepRef} type="button" className={styles.quietButton} onClick={() => { setCaptureDiscardOpen(false); captureRef.current?.focus({ preventScroll: true }); }}>Keep writing</button>
              <button type="button" className={styles.dangerButton} onClick={() => { captureGenerationRef.current += 1; setDraft(""); setCaptureDiscardOpen(false); captureRef.current?.focus(); }}>Discard capture</button>
            </div>
          </motion.div>
        ) : null}
        </AnimatePresence>
      </section>

      <section className={styles.searchBand} aria-label="Find in Notes" inert={mobileDetailOpen ? true : undefined} aria-hidden={mobileDetailOpen ? true : undefined}>
        <label className={styles.searchLabel} htmlFor="hybrid-search">Find in Notes</label>
        <input
          id="hybrid-search"
          ref={searchRef}
          className={styles.searchInput}
          type="search"
          aria-keyshortcuts="/"
          value={query}
          placeholder="Search your private notes"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape" && query) {
              event.preventDefault();
              setQuery("");
            } else if ((event.key === "Enter" || event.key === "ArrowDown" || event.key === "ArrowUp") && query.trim()) {
              event.preventDefault();
              navigateSearch(event.shiftKey || event.key === "ArrowUp" ? -1 : 1);
            }
          }}
        />
        <div className={styles.searchControls}>
          <span className={styles.searchMeta}>
            {searchState === "searching" ? "Checking full index…" : searchState === "fallback" ? "Showing local matches · index unavailable" : query.trim() ? `${displayedNotes.length} match${displayedNotes.length === 1 ? "" : "es"}` : "Press / to find"}
          </span>
          {query.trim() ? (
            <>
              <button type="button" className={styles.quietButton} disabled={!displayedNotes.length} aria-label="Previous search result" onClick={() => navigateSearch(-1)}>Previous</button>
              <button type="button" className={styles.quietButton} disabled={!displayedNotes.length} aria-label="Next search result" onClick={() => navigateSearch(1)}>Next</button>
              <button type="button" className={styles.quietButton} onClick={() => { setQuery(""); searchRef.current?.focus(); }}>Clear</button>
            </>
          ) : null}
        </div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.streamPane} aria-labelledby="hybrid-stream-heading" inert={mobileDetailOpen ? true : undefined} aria-hidden={mobileDetailOpen ? true : undefined}>
          <div className={styles.streamHeader}>
            <h2 id="hybrid-stream-heading">Notebook</h2>
            <span className={styles.searchMeta}>{notes.length} active</span>
          </div>
          {displayedNotes.length ? (
            <motion.ol
              layout={!filteringNotes}
              className={styles.streamList}
              data-delight-moment="artifact-presence"
              data-motion-policy={filteringNotes ? "immediate-filter" : "artifact-presence"}
            >
              <AnimatePresence initial={false} mode="popLayout">
              {displayedNotes.map((note) => {
                const presentation = presentNoteBody(note.body);
                const snippet = contextualSnippet(note.body, query);
                const mutation = mutationStates[note.id];
                const failed = mutation === "failed" || mutation === "offline";
                return (
                  <motion.li
                    key={note.id}
                    layout={filteringNotes ? false : "position"}
                    className={styles.noteItem}
                    data-density={snippet ? "standard" : "terse"}
                    data-selected={note.id === openId ? "true" : undefined}
                    data-state={mutation}
                    initial={
                      filteringNotes
                        ? false
                        : { opacity: 0, transform: "translateY(-4px)" }
                    }
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    exit={
                      filteringNotes
                        ? {
                            opacity: 1,
                            transform: "translateY(0px)",
                            transition: { duration: 0 },
                          }
                        : {
                            opacity: 0,
                            transform: "translateY(-4px)",
                          }
                    }
                    transition={{
                      layout: filteringNotes ? { duration: 0 } : MOTION_LAYOUT,
                      opacity: filteringNotes ? { duration: 0 } : MOTION_EXIT,
                      transform: filteringNotes ? { duration: 0 } : MOTION_ENTER,
                    }}
                  >
                    <button
                      type="button"
                      className={`${styles.noteButton} ${note.id === openId ? styles.noteSelected : ""}`}
                      data-note-row="true"
                      data-note-id={note.id}
                      data-selected={note.id === openId ? "true" : undefined}
                      aria-current={note.id === openId ? "true" : undefined}
                      aria-controls="hybrid-note-detail"
                      aria-expanded={note.id === openId}
                      disabled={navigationBlocked && note.id !== openId}
                      onClick={() => requestOpen(note.id)}
                    >
                      <span className={styles.noteCopy}>
                        <span className={styles.noteTitle}><HighlightedText text={presentation.title} query={query} /></span>
                        {snippet ? <span className={styles.noteSnippet}><HighlightedText text={snippet} query={query} /></span> : null}
                        <span className={styles.noteMeta}>
                          <span>{relativeTime(note.updatedAt, referenceNow)}</span>
                          {note.updatedAt > note.createdAt ? <span>edited</span> : null}
                          {note.source === "calendar" && note.updatedAt === note.createdAt ? <NoteProvenanceChip kind="calendar" /> : null}
                          {mutation === "pending" ? <span className={styles.pending}>saving</span> : null}
                          {mutation === "offline" ? <span className={styles.pending}>waiting for connection</span> : null}
                          {mutation === "failed" ? <span className={styles.failed}>save needs attention</span> : null}
                          {recoveredEditIds.includes(note.id) ? <span className={styles.pending}>local edit retained</span> : null}
                          {pendingApprovedTaskSends.some((send) => send.noteId === note.id) ? <span className={styles.pending}>approved send pending</span> : null}
                          {note.promotedTaskId ? <span className={styles.noteReceipt}>In Tasks</span> : null}
                        </span>
                      </span>
                    </button>
                    {failed ? (
                      <div className={styles.recoveryRow}>
                        <span>Your exact text is retained under the same capture identity.</span>
                        <span>
                          <button type="button" disabled={!online} onClick={() => void retryCapture(note.id)}>Retry save</button>{" "}
                          <button type="button" disabled={!online} onClick={() => void dismissFailedCapture(note.id)}>Discard explicitly</button>
                        </span>
                      </div>
                    ) : null}
                  </motion.li>
                );
              })}
              </AnimatePresence>
            </motion.ol>
          ) : (
            <div className={styles.emptyState}>
              <strong>{query.trim() ? "No matching notes" : copy.capture.emptyTitle}</strong>
              <p>{query.trim() ? "Try a different word. Search never changes your notes." : copy.capture.emptyBody}</p>
            </div>
          )}
          {Object.keys(orphanedRecoveries).length ? (
            <section className={styles.previousSection} aria-labelledby="hybrid-recovered-heading">
              <h3 id="hybrid-recovered-heading">Recovered local edits</h3>
              <p className={styles.detailHelp}>The original note is no longer active, so Notes kept your local wording separate. Nothing is discarded automatically.</p>
              <ul className={styles.previousList}>
                {Object.entries(orphanedRecoveries).map(([sourceNoteId, recovered]) => (
                  <li key={sourceNoteId} className={styles.previousRow}>
                    <span>{presentNoteBody(recovered.body).title}</span>
                    <span className={styles.actionRow}>
                      <button type="button" className={styles.quietButton} disabled={readOnly} onClick={() => void restoreOrphanedRecovery(sourceNoteId)}>Restore as new note</button>
                      <button type="button" className={styles.dangerButton} disabled={readOnly} onClick={() => discardOrphanedRecovery(sourceNoteId)}>Discard explicitly</button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>

        <motion.section
          id="hybrid-note-detail"
          className={styles.detailPane}
          data-delight-moment="stream-to-detail"
          data-open={openNote ? "true" : "false"}
          role={mobileDetailOpen ? "dialog" : undefined}
          aria-modal={mobileDetailOpen ? true : undefined}
          aria-label={openNote ? undefined : "Selected note"}
          aria-labelledby={openNote ? "hybrid-detail-title" : undefined}
          onKeyDown={trapMobileDetailFocus}
          initial={false}
          animate={{
            opacity: isNarrow ? (openNote ? 1 : 0) : 1,
            transform: isNarrow
              ? openNote
                ? "translateX(0%)"
                : "translateX(100%)"
              : "translateX(0%)",
          }}
          transition={isNarrow ? MOTION_ENTER : { duration: 0 }}
        >
          {openNote ? (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <button type="button" className={`${styles.quietButton} ${styles.mobileOnly}`} disabled={navigationBlocked} onClick={() => requestOpen(null)}>Back</button>
                  <h2 id="hybrid-detail-title" className={styles.detailTitle}>{presentNoteBody(openNote.body).title}</h2>
                </div>
                <span className={styles.detailMeta}>{relativeTime(openNote.updatedAt, referenceNow)} · private</span>
              </div>
              <textarea
                ref={detailRef}
                className={styles.detailTextarea}
                rows={5}
                data-private-note-body="true"
                data-sentry-mask="true"
                data-clarity-mask="true"
                data-dd-privacy="mask"
                value={detailBody}
                maxLength={MAX_NOTE_BODY_CHARS}
                readOnly={readOnly || noteInteractionLocked || Boolean(conflict)}
                aria-label="Private note body"
                onChange={(event) => {
                  const body = event.target.value;
                  setDetailBody(body);
                  const persisted = writeRecoveredEdit(
                    openNote.id,
                    body === openNote.body
                      ? null
                      : {
                          body,
                          expectedUpdatedAt: detailBaseUpdatedAt,
                          queued: false,
                        },
                  );
                  setQueuedEdit(false);
                  setDetailStatus("idle");
                  setDetailError(
                    persisted
                      ? null
                      : "Local recovery is blocked. Keep this tab open until this edit is saved.",
                  );
                  setSelection("");
                  setExtract(null);
                }}
                onSelect={updateSelection}
                onKeyUp={updateSelection}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                    event.preventDefault();
                    void saveDetail();
                  }
                }}
              />
              <p className={styles.detailHelp}>Edit freely. To make an action, select exact source wording here, then approve only what Tasks may receive.</p>
              <div className={styles.detailToolbar}>
                <span className={styles.stateLine} data-state={detailStatus}>
                  {detailDirty ? "Unsaved local edit" : detailStatus === "saving" ? "Saving…" : detailStatus === "saved" ? "Saved" : detailStatus === "failed" ? "Save needs attention" : "Up to date"}
                </span>
                <span className={styles.actionRow}>
                  <button type="button" className={styles.quietButton} onClick={() => void copyCurrentNote()}>Copy note</button>
                  <button type="button" className={styles.quietButton} disabled={readOnly || noteInteractionLocked || Boolean(conflict) || !detailDirty} onClick={() => void saveDetail()}>{detailStatus === "saving" ? "Saving…" : "Save edit"}</button>
                  <button type="button" className={styles.dangerButton} disabled={readOnly || noteInteractionLocked || Boolean(conflict)} onClick={requestDelete}>Delete…</button>
                </span>
              </div>
              <LayoutGroup id={`notes-approval-${openNote.id}`}>
              <p className={styles.selectionStatus}>{selection ? `${selection.length} selected character${selection.length === 1 ? "" : "s"}.` : "No source wording selected."}</p>
              {selection && !extract ? (
                <motion.div
                  layoutId="approved-source-wording"
                  className={styles.selectionChip}
                  data-delight-moment="private-to-approved"
                  data-motion-policy="immediate-selection"
                  initial={false}
                >
                  <span>Selected privately</span>
                  <q>{selection}</q>
                </motion.div>
              ) : null}
              {detailError ? <p className={styles.errorReceipt} role="alert">{detailError}</p> : null}

              <AnimatePresence initial={false}>
              {navigationPrompt ? (
                <motion.div
                  className={styles.discardPanel}
                  data-delight-moment="decision-region"
                  role="region"
                  aria-labelledby="navigation-prompt-heading"
                  initial={{ opacity: 0, transform: "translateY(-6px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{
                    opacity: 0,
                    transform: "translateY(-4px)",
                    transition: MOTION_EXIT,
                  }}
                  transition={MOTION_ENTER}
                >
                  <strong id="navigation-prompt-heading">Save this edit before leaving?</strong>
                  <p>Your local version stays visible until you choose.</p>
                  <div className={styles.actionRow}>
                    <button ref={navigationPrimaryRef} type="button" className={styles.primaryButton} disabled={detailSaveInFlight} onClick={() => void saveAndNavigate()}>Save and continue</button>
                    <button type="button" className={styles.dangerButton} disabled={detailSaveInFlight} onClick={discardAndNavigate}>Discard edit</button>
                    <button type="button" className={styles.quietButton} disabled={detailSaveInFlight} onClick={() => { setNavigationPrompt(null); detailRef.current?.focus({ preventScroll: true }); }}>Stay here</button>
                  </div>
                </motion.div>
              ) : null}
              </AnimatePresence>

              <AnimatePresence initial={false}>
              {deleteConfirm ? (
                <motion.div
                  className={styles.discardPanel}
                  data-delight-moment="decision-region"
                  role="region"
                  aria-labelledby="delete-confirm-heading"
                  initial={{ opacity: 0, transform: "translateY(-6px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{
                    opacity: 0,
                    transform: "translateY(-4px)",
                    transition: MOTION_EXIT,
                  }}
                  transition={MOTION_ENTER}
                >
                  <strong id="delete-confirm-heading">Delete this private note?</strong>
                  <p>You will have six seconds to undo. Tasks receipts, if any, are not deleted from Tasks.</p>
                  <div className={styles.actionRow}>
                    <button ref={deletePrimaryRef} type="button" className={styles.dangerButton} onClick={confirmDelete}>Delete note</button>
                    <button type="button" className={styles.quietButton} onClick={() => { setDeleteConfirm(false); detailRef.current?.focus({ preventScroll: true }); }}>Cancel</button>
                  </div>
                </motion.div>
              ) : null}
              </AnimatePresence>

              <AnimatePresence initial={false}>
              {conflict ? (
                <motion.div
                  className={styles.conflictPanel}
                  data-delight-moment="decision-region"
                  data-state="conflict"
                  initial={{ opacity: 0, transform: "translateY(-6px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{
                    opacity: 0,
                    transform: "translateY(-4px)",
                    transition: MOTION_EXIT,
                  }}
                  transition={MOTION_ENTER}
                >
                  <p role="alert"><strong>This note changed somewhere else.</strong> Nothing was overwritten. Compare both exact versions, then choose.</p>
                  <div className={styles.conflictVersions}>
                    <section className={styles.conflictVersion}><h3>Your local version</h3><pre>{detailBody}</pre></section>
                    <section className={styles.conflictVersion}><h3>Latest saved version</h3><pre>{conflict.remote.body}</pre></section>
                  </div>
                  <div className={styles.conflictActions}>
                    <button ref={conflictPrimaryRef} type="button" disabled={detailSaveInFlight || conflictResolving} onClick={() => void keepLocalVersion()}>Keep mine</button>
                    <button type="button" disabled={detailSaveInFlight || conflictResolving} onClick={useRemoteVersion}>Use latest</button>
                    <button type="button" disabled={detailSaveInFlight || conflictResolving} onClick={() => void keepBothVersions()}>Keep both as notes</button>
                  </div>
                </motion.div>
              ) : null}
              </AnimatePresence>

              <section className={styles.extractionPanel} aria-labelledby="hybrid-extract-heading">
                <div className={styles.privacyBoundary}>{copy.handoff.boundary}</div>
                <div className={styles.extractionHeader}>
                  <h3 id="hybrid-extract-heading">{copy.handoff.heading}</h3>
                  <span className={styles.searchMeta}>{extract?.approvedBody.length ?? 0} / {MAX_APPROVED_EXTRACT_CHARS}</span>
                </div>
                <AnimatePresence initial={false}>
                  {extract?.status === "sending" || taskReceipt ? (
                    <motion.div
                      key={taskReceipt ? "receipt-confirmed" : "handoff-sending"}
                      className={styles.handoffState}
                      data-delight-moment="approved-to-tasks"
                      data-state={taskReceipt ? "complete" : "sending"}
                      data-handoff-travel={handoffTravel ? "true" : "false"}
                      initial={{
                        opacity: 0.84,
                        transform: "translateY(2px)",
                      }}
                      animate={{ opacity: 1, transform: "translateY(0px)" }}
                      exit={{ opacity: 0, transition: MOTION_EXIT }}
                      transition={MOTION_ENTER}
                      aria-hidden="true"
                    >
                      <span>{taskReceipt ? copy.handoff.confirmed : copy.handoff.inFlight}</span>
                      <span className={styles.handoffTrack}>
                        <motion.span
                          initial={{
                            transform: handoffTravel
                              ? "scaleX(0.04)"
                              : "scaleX(1)",
                          }}
                          animate={{ transform: "scaleX(1)" }}
                          transition={
                            !handoffTravel
                              ? { duration: 0 }
                              : taskReceipt
                              ? MOTION_EXIT
                              : {
                                  duration: 0.24,
                                  ease: MOTION_EASE_IN_OUT,
                                }
                          }
                        />
                      </span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <AnimatePresence initial={false} mode="wait">
                {taskReceipt ? (
                  <motion.div
                    key="tasks-receipt"
                    className={styles.receipt}
                    initial={{ opacity: 0, transform: "translateY(5px)" }}
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    exit={{
                      opacity: 0,
                      transform: "translateY(2px)",
                      transition: MOTION_EXIT,
                    }}
                    transition={MOTION_ENTER}
                  >
                    {/*
                      The task id used to be printed in this sentence as
                      "Receipt review_task_abc123." It is an internal
                      identifier and it meant nothing to the person reading
                      it, so it moves to a data attribute where support and
                      tests can still reach it without putting it on screen.
                    */}
                    <strong>Sent to {taskReceipt.workspaceName}.</strong>
                    <p>{openNote.extractBody}</p>
                    <p data-task-id={taskReceipt.taskId}>{copy.handoff.stayedPut}</p>
                    <a ref={receiptLinkRef} href={taskReceipt.taskUrl || TASKS_APP_PATH}>{copy.handoff.open}</a>
                  </motion.div>
                ) : (
                  <motion.div
                    key="approval-composer"
                    className={styles.approvalComposer}
                    initial={{ opacity: 0, transform: "translateY(3px)" }}
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    exit={{
                      opacity: 0,
                      transform: "translateY(2px)",
                      transition: MOTION_EXIT,
                    }}
                    transition={MOTION_ENTER}
                  >
                    {!extract ? (
                      <div className={styles.actionRow}>
                        <button ref={approvalTriggerRef} type="button" className={styles.primaryButton} disabled={readOnly || noteInteractionLocked || Boolean(conflict) || !selection.trim()} onClick={beginExtraction}>{copy.handoff.begin}</button>
                      </div>
                    ) : (
                      <>
                        <motion.div
                          layoutId="approved-source-wording"
                          className={styles.approvalSelection}
                          data-delight-moment="private-to-approved"
                          data-motion-policy="shared-approval-continuity"
                          transition={MOTION_ENTER}
                        >
                          <span>{copy.handoff.sourceLabel}</span>
                          <q>{extract.sourceSelection}</q>
                        </motion.div>
                        <div className={styles.destinationField}>
                          <span className={styles.destinationLabel}>{copy.handoff.destinationLabel}</span>
                          {extract.immutableRetry ? (
                            <div className={styles.destinationLocked}>
                              <strong>
                                {availableWorkspaces.find(
                                  (workspace) =>
                                    workspace.id ===
                                    extract.immutableRetry?.workspaceId,
                                )?.name ?? copy.handoff.lockedDestinationUnknown}
                              </strong>
                              <span>{copy.handoff.lockedDestination}</span>
                            </div>
                          ) : availableWorkspaces.length ? (
                            <select
                              id="hybrid-workspace"
                              className={styles.workspaceSelect}
                              aria-label={copy.handoff.destinationLabel}
                              value={selectedWorkspaceId}
                              disabled={readOnly || noteInteractionLocked}
                              onChange={(event) =>
                                setSelectedWorkspaceId(event.target.value)
                              }
                            >
                              {availableWorkspaces.map((workspace) => (
                                <option key={workspace.id} value={workspace.id}>
                                  {workspace.name}
                                  {workspace.planningPeriodName
                                    ? ` · ${workspace.planningPeriodName}`
                                    : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div
                              className={styles.destinationUnavailable}
                              role="status"
                              data-state={
                                !online
                                  ? "offline"
                                  : tasksCatalogAvailable
                                    ? "empty"
                                    : "unavailable"
                              }
                            >
                              <span>
                                {!online
                                  ? copy.destination.offline
                                  : tasksCatalogAvailable
                                    ? copy.destination.empty
                                    : copy.destination.unavailable}
                              </span>
                              <a href={TASKS_APP_PATH}>
                                {tasksCatalogAvailable
                                  ? copy.destination.createLink
                                  : copy.destination.openLink}
                              </a>
                            </div>
                          )}
                        </div>
                        <textarea
                          ref={approvalTextareaRef}
                          className={styles.extractionTextarea}
                          value={extract.approvedBody}
                          maxLength={MAX_APPROVED_EXTRACT_CHARS}
                          aria-label={copy.handoff.wordingLabel}
                          readOnly={readOnly || noteInteractionLocked || Boolean(conflict)}
                          onChange={(event) => setExtract({ ...extract, approvedBody: event.target.value, status: "review", error: null })}
                        />
                        <p className={styles.payloadReceipt}>{extract.immutableRetry ? copy.handoff.payloadLocked : copy.handoff.payload}</p>
                        {extract.error ? <p className={styles.errorReceipt} role="alert">{extract.error}</p> : null}
                        <div className={styles.actionRow}>
                          {!extract.immutableRetry ? <button type="button" className={styles.quietButton} disabled={navigationInFlight || Boolean(conflict)} onClick={() => { setExtract(null); window.setTimeout(() => approvalTriggerRef.current?.focus({ preventScroll: true }), 0); }}>{copy.handoff.cancel}</button> : null}
                          <button type="button" className={styles.primaryButton} disabled={readOnly || !online || navigationInFlight || Boolean(conflict) || !(extract.immutableRetry?.workspaceId ?? selectedWorkspaceId) || !extract.approvedBody.trim()} onClick={() => void sendApprovedExtract()}>
                            {extract.status === "sending" ? copy.handoff.sending : extract.status === "failed" ? copy.handoff.retry : copy.handoff.send}
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
                </AnimatePresence>
              </section>
              </LayoutGroup>

              {planningPeriodsEnabled ? (
                <details className={styles.timelinePanel}>
                  <summary>Share a separate, exact preview to Timeline</summary>
                  <p className={styles.detailHelp}>This sends only the fields you preview below. It never sends the private note body.</p>
                  <div className={styles.timelineFields}>
                    <label>Title<input value={timelineDraft.title} maxLength={180} disabled={readOnly || noteInteractionLocked} onChange={(event) => setTimelineDraft((current) => ({ ...current, title: event.target.value }))} /></label>
                    <label>Date<input type="date" value={timelineDraft.date} disabled={readOnly || noteInteractionLocked} onChange={(event) => setTimelineDraft((current) => ({ ...current, date: event.target.value }))} /></label>
                    <label>Completion<input type="number" min={0} max={100} value={timelineDraft.completion} disabled={readOnly || noteInteractionLocked} onChange={(event) => setTimelineDraft((current) => ({ ...current, completion: Number(event.target.value) }))} /></label>
                    <label>Named audience<input value={timelineDraft.audienceLabel} maxLength={80} disabled={readOnly || noteInteractionLocked} onChange={(event) => setTimelineDraft((current) => ({ ...current, audienceLabel: event.target.value }))} /></label>
                  </div>
                  <p className={styles.payloadReceipt}>Exact preview: {timelineDraft.title || "Selected extract"} · {timelineDraft.date || "choose a date"} · {timelineDraft.completion}% · for {timelineDraft.audienceLabel || "named audience"}</p>
                  <div className={styles.actionRow}><button type="button" className={styles.quietButton} disabled={readOnly || noteInteractionLocked || Boolean(conflict) || !openNote.workspaceId || !timelineDraft.title.trim() || !timelineDraft.date || !timelineDraft.audienceLabel.trim()} onClick={() => void sendTimelinePreview()}>{timelineSending ? "Checking Timeline…" : "Send this preview to Timeline"}</button></div>
                  {!openNote.workspaceId ? <p className={styles.errorText}>Choose a project when capturing or sending this note first.</p> : null}
                  {timelineReceipt ? <p className={styles.receipt}>{timelineReceipt}</p> : null}
                </details>
              ) : null}

            </>
          ) : (
            <aside className={`${styles.artifactPanel} ${styles.desktopOnly}`} aria-labelledby="hybrid-previous-heading">
              <div className={styles.artifactHeader}>
                <span className={styles.emptyEyebrow}>Artifact history</span>
                <span className={styles.searchMeta}>{archivedNotes.length} archived</span>
              </div>
              <h2 id="hybrid-previous-heading">Previously sent</h2>
              <p className={styles.artifactIntroduction}>
                Earlier handoffs live here as an explicit history. Restore one at a time; nothing private moves automatically.
              </p>
              {archivedNotes.length ? (
                <motion.ul layout className={styles.artifactList}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {archivedNotes.map((note) => (
                      <motion.li
                        layout="position"
                        key={note.id}
                        initial={{ opacity: 0, transform: "translateY(-4px)" }}
                        animate={{ opacity: 1, transform: "translateY(0px)" }}
                        exit={{ opacity: 0, transform: "translateY(-4px)" }}
                        transition={{ layout: MOTION_LAYOUT, opacity: MOTION_EXIT, transform: MOTION_ENTER }}
                      >
                        <blockquote>{presentNoteBody(note.body).title}</blockquote>
                        {note.extractBody ? <p>Sent wording: {note.extractBody}</p> : null}
                        <button type="button" className={styles.quietButton} disabled={readOnly || restoringId === note.id} onClick={() => void restoreArchived(note)}>
                          {restoringId === note.id ? "Restoringâ€¦" : "Restore private note"}
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              ) : (
                <div className={styles.artifactEmpty}>
                  <strong>Nothing is archived.</strong>
                  <p>Choose a note when you want to edit it, or select exact wording to make it work in Tasks.</p>
                </div>
              )}
              <p className={styles.artifactFootnote}>A Tasks receipt never removes its private source from this notebook.</p>
            </aside>
          )}
        </motion.section>
      </div>
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {deleteUndo ? (
          <motion.div
            key="delete-undo"
            className={styles.toast}
            data-state="saved"
            data-hybrid-toast="true"
            data-delight-moment="toast-lifecycle"
            role="status"
            initial={{ opacity: 0, transform: "translateY(6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{
              opacity: 0,
              transform: "translateY(4px)",
              transition: MOTION_EXIT,
            }}
            transition={MOTION_ENTER}
          >
            Note deleted. <button ref={undoButtonRef} type="button" className={styles.quietButton} onClick={undoDeleteNote}>Undo</button>
          </motion.div>
        ) : toast ? (
          <motion.div
            key={toast.message}
            className={styles.toast}
            data-state={toast.state}
            data-hybrid-toast="true"
            data-delight-moment="toast-lifecycle"
            role="status"
            initial={{ opacity: 0, transform: "translateY(6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{
              opacity: 0,
              transform: "translateY(4px)",
              transition: MOTION_EXIT,
            }}
            transition={MOTION_ENTER}
          >
            {toast.message}
          </motion.div>
        ) : null
        }
      </AnimatePresence>
      <span className={styles.srOnly} aria-live="polite" aria-atomic="true">{announcement}</span>
      {firstCapture ? <FirstCaptureMoment onDone={() => setFirstCapture(false)} /> : null}
    </div>
  );
}
