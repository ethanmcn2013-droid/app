"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  memo,
  useDeferredValue,
} from "react";

import {
  CAPTURE_EMAIL_PLAN,
  type CaptureState,
} from "@/modules/notes/app/CaptureEmailRow";
import { notesCopyForDomain } from "@/modules/notes/lib/notes-copy";
import {
  MAX_APPROVED_EXTRACT_CHARS,
} from "@/modules/notes/lib/notes-hybrid";
import {
  countLabel,
  countViews,
  defaultSelection,
  derivePresentation,
  friendlyDate,
  isArchived,
  isSent,
  matchesFilter,
  matchesQuery,
  needsReview,
  noteSource,
  notesHref,
  searchSnippet,
  SOURCE_LABELS,
  sortNotes,
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
import {
  CONTEXT_TERMINOLOGY,
  PLANNING_PERIOD_CONTEXTS,
  type PlanningPeriodContext,
} from "@/lib/planning/context";
import type { TasksWorkspaceDestination } from "@/modules/notes/server/tasks-personalization";
import { Composer } from "@/modules/notes/app/workspace/Composer";
import { useNotebook } from "@/modules/notes/app/workspace/use-notebook";
import {
  AlertIcon,
  BackIcon,
  CheckIcon,
  CloseIcon,
  LockIcon,
  MoreIcon,
  RestoreIcon,
  SearchIcon,
  SourceIcon,
  TaskIcon,
} from "@/modules/notes/app/workspace/icons";

import styles from "./notes-workspace.module.css";

/**
 * Notes.
 *
 * Three views, one job each. Notebook is where writing happens and where a
 * note is read. Review is the short daily decision: keep it, act on it, or
 * let it go. Sent is the record of what became work.
 *
 * The view and the open note live in the URL, written with the browser's own
 * History API so Back means what a person expects on a phone without paying
 * for a server render every time a row is clicked.
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
  name: "Review workspace",
  role: "owner",
  planningPeriodId: null,
  planningPeriodName: null,
  contextType: null,
  primaryDate: null,
  primaryDateLabel: null,
};
const subscribeNever = () => () => {};

function useSaveChord(): string {
  return useSyncExternalStore(
    subscribeNever,
    () => (/Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "⌘",
  );
}

function useNarrow(): boolean | null {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return narrow;
}

/**
 * What this account calls the thing a task belongs to.
 *
 * A teacher's is a Class, a couple's is a Wedding, everyone else's is a
 * Project. D-011 makes that map the only place the noun is written, so Notes
 * reads it rather than hard-coding a word that would be wrong for two of the
 * three audiences this product is for.
 */
function workspaceNoun(contextType: string | null | undefined): string {
  const context = PLANNING_PERIOD_CONTEXTS.includes(
    contextType as PlanningPeriodContext,
  )
    ? (contextType as PlanningPeriodContext)
    : "general";
  return CONTEXT_TERMINOLOGY[context].workspace;
}

/** Highlights the matched run without splitting a word mid-character. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLocaleLowerCase("en-IE");
  if (!needle) return <>{text}</>;
  const haystack = text.toLocaleLowerCase("en-IE");
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let index = haystack.indexOf(needle);
  while (index >= 0) {
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(
      <mark className={styles.highlight} key={`${index}-${cursor}`}>
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    cursor = index + needle.length;
    index = haystack.indexOf(needle, cursor);
  }
  if (!parts.length) return <>{text}</>;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * One row in the notebook list.
 *
 * Memoised, and that is the whole point. The list lived inside the workspace
 * component, so every keystroke in the composer re-derived the title, the
 * preview, the date and two highlight passes for every note on screen — 8.8
 * seconds of blocked main thread to type one sentence into a 500-note
 * notebook. Nothing here depends on the composer, so nothing here needs to
 * re-render with it.
 */
const NoteRow = memo(function NoteRow({
  note,
  index,
  now,
  query,
  selected,
  state,
  onSelect,
  onRetry,
}: {
  note: PresentableNote;
  index: number;
  now: number;
  query: string;
  selected: boolean;
  state: string | undefined;
  onSelect: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const presentation = derivePresentation(note.body);
  const source = noteSource(note.source);
  const snippet = query.trim()
    ? searchSnippet(note.body, query)
    : presentation.preview;
  return (
    <li>
      {index > 0 ? <div className={styles.rowSeparator} aria-hidden="true" /> : null}
      <button
        type="button"
        className={styles.row}
        data-note-row=""
        data-note-id={note.id}
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(note.id)}
      >
        <span className={styles.rowIcon}>
          <SourceIcon source={source} />
          <span className={styles.srOnly}>{SOURCE_LABELS[source]}</span>
        </span>
        <span className={styles.rowBody}>
          <span className={styles.rowTitle}>
            <Highlighted text={presentation.title} query={query} />
          </span>
          {snippet ? (
            <span className={styles.rowPreview}>
              <Highlighted text={snippet} query={query} />
            </span>
          ) : null}
          <span className={styles.rowMeta}>
            <span>{friendlyDate(note.createdAt, now)}</span>
            {isSent(note) ? (
              <span className={styles.rowFlag} data-tone="sent">
                <TaskIcon />
                In Tasks
              </span>
            ) : null}
            {needsReview(note) ? (
              <span className={styles.rowFlag} data-tone="review">
                To review
              </span>
            ) : null}
            {state === "pending" ? <span className={styles.rowFlag}>Saving</span> : null}
            {state === "offline" ? (
              <span className={styles.rowFlag}>Waiting to save</span>
            ) : null}
            {state === "failed" ? (
              <span className={styles.rowFlag} data-tone="attention">
                <AlertIcon />
                Not saved
              </span>
            ) : null}
          </span>
        </span>
      </button>
      {state === "failed" ? (
        <div className={styles.rowRetry}>
          <button
            type="button"
            className={styles.quietButton}
            onClick={() => void onRetry(note.id)}
          >
            Try saving again
          </button>
        </div>
      ) : null}
    </li>
  );
});

export interface NotesWorkspaceProps {
  initialNotes: NoteRead[];
  initialArchivedNotes: NoteRead[];
  initialPendingApprovedTaskSends: PendingApprovedTasksSendRead[];
  initialWorkspaceId: string | null;
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

  const [view, setView] = useState<NotesView>(props.initialView ?? "notebook");
  const [selectedId, setSelectedId] = useState<string | null>(props.initialNoteId ?? null);
  const [sort, setSort] = useState<NotebookSort>("newest");
  const [filter, setFilter] = useState<NotebookFilter>("all");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskDialogNote, setTaskDialogNote] = useState<NoteRead | null>(null);

  const notebook = useNotebook({
    initialNotes: props.initialNotes,
    initialArchivedNotes: props.initialArchivedNotes,
    initialPendingApprovedTaskSends: props.initialPendingApprovedTaskSends,
    initialWorkspaceId: props.initialWorkspaceId,
    recoveryScope: props.recoveryScope,
    demoMode: props.demoMode,
    copy,
  });

  const captureRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const liveRegionId = useId();

  // The list is allowed to lag the field by a frame. Typing must never wait
  // on 500 rows re-deriving themselves.
  const deferredQuery = useDeferredValue(notebook.query);
  const allNotes = notebook.notes as PresentableNote[];
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

  // ── URL state ───────────────────────────────────────────────────────

  const writeUrl = useCallback((nextView: NotesView, noteId: string | null, replace = false) => {
    const href = notesHref(nextView, noteId);
    if (typeof window === "undefined") return;
    if (window.location.pathname + window.location.search === href) return;
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setView(viewFromParam(params.get("view")));
      setSelectedId(params.get("note"));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goToView = useCallback(
    (nextView: NotesView) => {
      setView(nextView);
      // Each view starts with nothing open. Notebook and Sent then choose a
      // sensible first row for themselves, but only on a screen wide enough
      // to show a list and a note at the same time.
      setSelectedId(null);
      writeUrl(nextView, null);
    },
    [writeUrl],
  );

  const selectNote = useCallback(
    (noteId: string | null, options?: { replace?: boolean }) => {
      setSelectedId(noteId);
      writeUrl(view, noteId, options?.replace ?? false);
    },
    [view, writeUrl],
  );

  // ── Notebook list ───────────────────────────────────────────────────

  const notebookNotes = useMemo(() => {
    const source = deferredQuery.trim()
      ? (notebook.searchResults as PresentableNote[])
      : allNotes;
    return sortNotes(
      source.filter(
        (note) =>
          !isArchived(note) &&
          matchesFilter(note, filter) &&
          (!deferredQuery.trim() || matchesQuery(note, deferredQuery)),
      ),
      sort,
    );
  }, [allNotes, deferredQuery, filter, notebook.searchResults, sort]);

  const sentNotes = useMemo(
    () =>
      sortNotes(
        [...allNotes, ...(notebook.archivedNotes as PresentableNote[])].filter((note) =>
          isSent(note),
        ),
        "newest",
      ),
    [allNotes, notebook.archivedNotes],
  );

  /**
   * Which note is open, derived rather than stored.
   *
   * An explicit choice lives in the URL. Absent one, a wide screen falls back
   * to the newest note so the workspace is never a blank half-page, and a
   * narrow screen falls back to nothing so the list stays a list until
   * someone picks a row. Deriving it means no history entry is spent on a
   * default, and Back never lands on a selection nobody made.
   */
  const effectiveSelectedId =
    narrow === null
      ? selectedId
      : defaultSelection(
          view === "sent" ? sentNotes : notebookNotes,
          selectedId,
          narrow,
        );

  const selectedNote = useMemo(
    () => notebook.notes.find((note) => note.id === effectiveSelectedId) ?? null,
    [notebook.notes, effectiveSelectedId],
  );

  /**
   * Load the open note into the editor the moment it changes.
   *
   * During render, not in an effect: an effect would leave the previous
   * note's words in the field for one paint, and a keystroke landing in that
   * frame would be saved against the wrong note.
   */
  const [loadedNoteId, setLoadedNoteId] = useState<string | null>(
    props.initialNoteId ?? null,
  );
  if (loadedNoteId !== (selectedNote?.id ?? null)) {
    setLoadedNoteId(selectedNote?.id ?? null);
    notebook.applyOpenNote(selectedNote);
  }

  // Grow the reading field to its content so a note is one continuous page
  // rather than a box with its own scrollbar inside a scrolling pane.
  useLayoutEffect(() => {
    const field = detailRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.max(96, field.scrollHeight)}px`;
  }, [notebook.detailBody, selectedId]);

  // ── Review queue ────────────────────────────────────────────────────

  const reviewQueue = useMemo(
    () => sortNotes(allNotes.filter((note) => needsReview(note)), "oldest"),
    [allNotes],
  );
  // The queue shrinks as decisions are made, so the index only moves when
  // someone skips. Deciding always leaves the next note at the same position.
  const [reviewIndex, setReviewIndex] = useState(0);
  const reviewNote = reviewQueue[Math.min(reviewIndex, Math.max(0, reviewQueue.length - 1))] ?? null;
  const [reviewedThisSession, setReviewedThisSession] = useState(0);

  // ── Keyboard ────────────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.isComposing || event.keyCode === 229) return;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        if (privacyOpen || menuOpen) {
          event.preventDefault();
          setPrivacyOpen(false);
          setMenuOpen(false);
          return;
        }
        if (notebook.query && target === searchRef.current) {
          event.preventDefault();
          notebook.setQuery("");
          return;
        }
        if (narrow && effectiveSelectedId && !typing) {
          event.preventDefault();
          selectNote(null);
        }
        return;
      }

      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "/" && view === "notebook") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (!["j", "k", "ArrowDown", "ArrowUp"].includes(event.key)) return;
      const rows = Array.from(
        listRef.current?.querySelectorAll<HTMLButtonElement>("[data-note-row]") ?? [],
      );
      if (!rows.length) return;
      if (
        (event.key === "ArrowDown" || event.key === "ArrowUp") &&
        !target?.closest("[data-note-row]")
      ) {
        return;
      }
      event.preventDefault();
      const current = rows.indexOf(document.activeElement as HTMLButtonElement);
      const forward = event.key === "j" || event.key === "ArrowDown";
      const next =
        current < 0
          ? forward
            ? 0
            : rows.length - 1
          : Math.max(0, Math.min(rows.length - 1, current + (forward ? 1 : -1)));
      const row = rows[next];
      row?.focus();
      // Open what is focused. Walking the list while the reading pane stayed
      // on the first note made the shortcut look broken.
      const id = row?.getAttribute("data-note-id");
      if (id && !narrow) selectNote(id, { replace: true });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    effectiveSelectedId,
    menuOpen,
    narrow,
    notebook,
    privacyOpen,
    selectNote,
    view,
  ]);

  /**
   * Keep focus somewhere on a phone.
   *
   * Below 900px the list and the detail swap by `display: none`, which
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

  useEffect(() => {
    if (!privacyOpen && !menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setPrivacyOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen, privacyOpen]);

  // ── Actions ─────────────────────────────────────────────────────────

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
        if (firstId && !narrow) selectNote(firstId);
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
    [narrow, notebook, selectNote],
  );

  const saveDraftAndSelect = useCallback(async () => {
    const id = await notebook.saveDraft();
    if (id && !narrow) selectNote(id);
    return id;
  }, [narrow, notebook, selectNote]);

  const openTaskDialog = useCallback(
    (note: NoteRead) => {
      const known = workspaces.some((item) => item.id === props.initialWorkspaceId);
      const workspaceId =
        (known ? props.initialWorkspaceId : null) ?? workspaces[0]?.id ?? "";
      notebook.beginSend(note, workspaceId);
      setTaskDialogNote(note);
    },
    [notebook, props.initialWorkspaceId, workspaces],
  );

  const advanceReview = useCallback(() => {
    setReviewedThisSession((current) => current + 1);
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
      advanceReview();
    },
    [advanceReview, notebook],
  );

  const reviewDelete = useCallback(
    (note: NoteRead) => {
      notebook.deleteNote(note);
      advanceReview();
    },
    [advanceReview, notebook],
  );

  const totalToReview = reviewQueue.length + reviewedThisSession;
  const reviewDone = Math.min(reviewedThisSession, totalToReview);

  return (
    <div className={styles.root} data-notes-workspace="" data-view={view}>
      <header className={styles.header} ref={headerRef}>
        <nav className={styles.views} aria-label="Notes views">
          {(["notebook", "review", "sent"] as const).map((candidate) => {
            const count = counts[candidate];
            return (
              <a
                key={candidate}
                className={styles.viewTab}
                href={notesHref(candidate, null)}
                aria-current={view === candidate ? "page" : undefined}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                  event.preventDefault();
                  goToView(candidate);
                }}
              >
                {candidate === "notebook" ? "Notebook" : candidate === "review" ? "Review" : "Sent"}
                {count > 0 ? <span className={styles.viewCount}>{count}</span> : null}
              </a>
            );
          })}
        </nav>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.privacy}
            aria-expanded={privacyOpen}
            onClick={() => {
              setPrivacyOpen((current) => !current);
              setMenuOpen(false);
            }}
          >
            <LockIcon />
            <span className={styles.privacyText}>Private to you</span>
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Notes options"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((current) => !current);
              setPrivacyOpen(false);
            }}
          >
            <MoreIcon />
          </button>
        </div>

        {privacyOpen ? (
          <div className={styles.popover} role="dialog" aria-labelledby="notes-privacy-title">
            <h2 className={styles.popoverTitle} id="notes-privacy-title">
              Only you can read your notes. Speaking and photographing send
              words out to be read.
            </h2>
            <dl className={styles.popoverList}>
              <div>
                <dt>Who can read them</dt>
                <dd>
                  Only you. Notes belong to your account, not to a shared project, so
                  nobody you work with can open them.
                </dd>
              </div>
              <div>
                <dt>What you type</dt>
                <dd>
                  Stays on your device until you save it, then is stored on your account.
                  Nothing you type is sent anywhere else.
                </dd>
              </div>
              <div>
                <dt>What you speak, and photos you take</dt>
                <dd>
                  These two do leave your device. Your browser turns speech into text
                  with its own speech service, and the text, or the photo, is sent to
                  Anthropic, which Signal Studio uses to turn it into notes. No recording
                  is kept, because none is made, and the photo is read and then discarded.
                  If you would rather nothing left the device, type the note instead.
                </dd>
              </div>
              <div>
                <dt>When a note becomes a task</dt>
                <dd>
                  Only the task wording you approve crosses over. Everyone in that project
                  can see the task. The note stays here, private, unchanged.
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {menuOpen ? (
          <div className={styles.menu} role="menu" aria-label="Notes options">
            {props.captureEmailState?.tier === "entitled" ? (
              <>
                <p className={styles.menuNote}>Send anything to this address and it lands here.</p>
                <code className={styles.menuAddress}>{props.captureEmailState.address}</code>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(props.captureEmailState?.tier === "entitled" ? props.captureEmailState.address : "")
                      .then(() =>
                        notebook.showToast({ tone: "info", message: "Capture address copied." }),
                      )
                      .catch(() =>
                        notebook.showToast({
                          tone: "error",
                          message: "Copying is blocked here. Select the address instead.",
                        }),
                      );
                    setMenuOpen(false);
                  }}
                >
                  Copy capture address
                </button>
              </>
            ) : (
              <a role="menuitem" className={styles.menuItem} href="/pricing">
                Capture by email
                <span className={styles.menuHint}>{CAPTURE_EMAIL_PLAN}</span>
              </a>
            )}
            <div className={styles.menuItem} role="presentation">
              Search this notebook
              <span className={styles.menuHint}>/</span>
            </div>
            <div className={styles.menuItem} role="presentation">
              Save the note you are writing
              <span className={styles.menuHint}>{saveChord} + Enter</span>
            </div>
            <div className={styles.menuItem} role="presentation">
              Move through the list
              <span className={styles.menuHint}>J · K</span>
            </div>
          </div>
        ) : null}
      </header>

      <div className={styles.body}>
        {view === "notebook" ? (
          <div className={styles.notebook}>
            <Composer
              copy={copy}
              draft={notebook.draft}
              setDraft={notebook.setDraft}
              onSaveDraft={saveDraftAndSelect}
              onSaveNotes={saveExtractedNotes}
              captureStatus={notebook.captureStatus}
              captureError={notebook.captureError}
              clearCaptureError={() => notebook.setCaptureError(null)}
              readOnly={notebook.readOnly}
              saveChord={saveChord}
              photoAvailable={props.photoAvailable}
              speechSeparates={props.speechSeparates}
              demoMode={props.demoMode}
              fieldRef={captureRef}
            />

            <div className={styles.toolbar}>
              <div className={styles.search}>
                <SearchIcon />
                <label className={styles.srOnly} htmlFor="notes-search">
                  Search notebook
                </label>
                <input
                  id="notes-search"
                  ref={searchRef}
                  className={styles.searchInput}
                  type="search"
                  value={notebook.query}
                  placeholder="Search notebook"
                  aria-keyshortcuts="/"
                  aria-controls="notes-list"
                  onChange={(event) => notebook.setQuery(event.target.value)}
                />
                {!notebook.query ? (
                  <span className={styles.searchKey} aria-hidden="true">
                    /
                  </span>
                ) : null}
              </div>
              <div className={styles.toolbarRight}>
                <label className={styles.srOnly} htmlFor="notes-filter">
                  Show
                </label>
                <select
                  id="notes-filter"
                  className={styles.select}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as NotebookFilter)}
                >
                  <option value="all">All notes</option>
                  <option value="review">To review</option>
                  <option value="typed">Written</option>
                  <option value="voice">Spoken</option>
                  <option value="photo">From a photo</option>
                </select>
                <label className={styles.srOnly} htmlFor="notes-sort">
                  Order
                </label>
                <select
                  id="notes-sort"
                  className={styles.sortSelect}
                  value={sort}
                  onChange={(event) => setSort(event.target.value as NotebookSort)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            </div>

            <div className={styles.split} data-detail-open={Boolean(selectedNote) || undefined}>
              <section
                className={styles.listPane}
                id="notes-list"
                aria-labelledby="notes-list-heading"
              >
                <div className={styles.listMeta}>
                  <h2 className={styles.srOnly} id="notes-list-heading">
                    Notebook
                  </h2>
                  <span>
                    {notebook.query.trim()
                      ? `${notebookNotes.length} ${notebookNotes.length === 1 ? "match" : "matches"}`
                      : countLabel("notebook", notebookNotes.length)}
                  </span>
                  {notebook.searchState === "fallback" ? (
                    <span>Showing what is loaded</span>
                  ) : null}
                </div>
                {notebookNotes.length ? (
                  <ul className={styles.list} ref={listRef}>
                    {notebookNotes.map((note, index) => (
                      <NoteRow
                        key={note.id}
                        note={note}
                        index={index}
                        now={now}
                        query={deferredQuery}
                        selected={note.id === effectiveSelectedId}
                        state={notebook.mutationStates[note.id]}
                        onSelect={selectNote}
                        onRetry={notebook.retryCapture}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className={styles.empty}>
                    <p className={styles.emptyTitle}>
                      {notebook.query.trim()
                        ? "Nothing matches that"
                        : filter !== "all"
                          ? "Nothing here yet"
                          : copy.capture.emptyTitle}
                    </p>
                    <p className={styles.emptyBody}>
                      {notebook.query.trim()
                        ? "Try a different word. Searching never changes your notes."
                        : filter !== "all"
                          ? "Change what you are showing to see the rest of your notebook."
                          : copy.capture.emptyBody}
                    </p>
                  </div>
                )}
              </section>

              <section className={styles.detailPane} aria-label="Selected note">
                {selectedNote ? (
                  <NoteDetail
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
                    canSendToTasks={workspaces.length > 0}
                  />
                ) : (
                  <div className={styles.emptyCentred}>
                    <p className={styles.emptyTitle}>
                      {notebookNotes.length ? "Nothing open" : "Nothing here yet"}
                    </p>
                    <p className={styles.emptyBody}>
                      {notebookNotes.length
                        ? "Choose a note to read it, or write a new one above."
                        : "Write your first note in the field above."}
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : null}

        {view === "review" ? (
          <ReviewView
            note={reviewNote}
            queueLength={reviewQueue.length}
            done={reviewDone}
            total={Math.max(totalToReview, 1)}
            now={now}
            onKeep={reviewKeep}
            onDelete={reviewDelete}
            onTurnIntoTask={openTaskDialog}
            onSkip={skipReview}
            canSkip={reviewQueue.length > 1}
            onOpenNotebook={() => goToView("notebook")}
            canSendToTasks={workspaces.length > 0}
          />
        ) : null}

        {view === "sent" ? (
          <SentView
            notes={sentNotes}
            now={now}
            selectedId={effectiveSelectedId}
            onSelect={(id) => selectNote(id)}
            restoringId={notebook.restoringId}
            onRestore={notebook.restoreNote}
            onOpenInNotebook={(note) => {
              setView("notebook");
              setSelectedId(note.id);
              writeUrl("notebook", note.id);
            }}
            demoMode={props.demoMode}
          />
        ) : null}
      </div>

      {taskDialogNote ? (
        <TurnIntoTaskDialog
          note={taskDialogNote}
          notebook={notebook}
          workspaces={workspaces}
          copy={copy}
          onClose={() => {
            notebook.cancelSend();
            setTaskDialogNote(null);
          }}
          onCreated={() => {
            if (view === "review") advanceReview();
          }}
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

/* ── Selected note ─────────────────────────────────────────────────────── */

function NoteDetail({
  note,
  notebook,
  now,
  detailRef,
  onBack,
  onTurnIntoTask,
  onDelete,
  canSendToTasks,
}: {
  note: NoteRead;
  notebook: ReturnType<typeof useNotebook>;
  now: number;
  detailRef: React.RefObject<HTMLTextAreaElement | null>;
  onBack: () => void;
  onTurnIntoTask: () => void;
  onDelete: () => void;
  canSendToTasks: boolean;
}) {
  // Keyed by note id so opening a different note closes the confirmation
  // without an effect that fires a frame late.
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const confirmDelete = confirmFor === note.id;
  const source = noteSource(note.source);
  const dirty = notebook.detailBody !== note.body;
  const edited = note.updatedAt > note.createdAt;

  const statusText = notebook.detailError
    ? notebook.detailError
    : notebook.detailStatus === "saving"
      ? "Saving…"
      : notebook.detailStatus === "saved"
        ? "Saved"
        : dirty
          ? "Not saved yet"
          : null;

  return (
    <>
      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderInner}>
        <div className={styles.detailMeta}>
          <button
            type="button"
            data-notes-back=""
            className={`${styles.quietButton} ${styles.backButton}`}
            onClick={onBack}
          >
            <BackIcon />
            Notebook
          </button>
          <SourceIcon source={source} />
          <span>{SOURCE_LABELS[source]}</span>
          <span aria-hidden="true">·</span>
          <span>{friendlyDate(note.createdAt, now)}</span>
        </div>
        <div className={styles.detailActions}>
          {statusText ? (
            <span className={styles.detailMeta} role="status">
              {statusText}
            </span>
          ) : null}
          {dirty ? (
            <button
              type="button"
              className={styles.quietButton}
              onClick={() => void notebook.saveDetail(note)}
              disabled={notebook.detailStatus === "saving"}
            >
              Save changes
            </button>
          ) : null}
          {isSent(note as PresentableNote) ? (
            <a className={styles.quietButton} href={taskFocusPath(note.promotedTaskId ?? "")}>
              <TaskIcon />
              Open task
            </a>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={onTurnIntoTask}
              disabled={!canSendToTasks || notebook.readOnly}
              title={
                canSendToTasks
                  ? undefined
                  : `You have no ${workspaceNoun(null).toLowerCase()} yet. Your note stays private here.`
              }
            >
              Turn into task
            </button>
          )}
          <button
            type="button"
            className={styles.iconButton}
            aria-label="More actions for this note"
            aria-expanded={confirmDelete}
            onClick={() => setConfirmFor(confirmDelete ? null : note.id)}
          >
            <MoreIcon />
          </button>
        </div>
        </div>
      </div>

      <div className={styles.detailScroll}>
        <div className={styles.detailInner}>
          {confirmDelete ? (
            <div className={styles.panel} role="group" aria-label="Delete this note">
              <p className={styles.panelTitle}>Delete this note?</p>
              <p className={styles.panelBody}>
                You will have six seconds to undo.
                {note.promotedTaskId
                  ? " The task it created stays in Tasks."
                  : ""}
              </p>
              <div className={styles.panelActions}>
                <button type="button" className={styles.dangerButton} onClick={onDelete}>
                  Delete note
                </button>
                <button
                  type="button"
                  className={styles.quietButton}
                  onClick={() => setConfirmFor(null)}
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : null}

          {notebook.conflict?.noteId === note.id ? (
            <div className={styles.panel} role="group" aria-label="This note changed somewhere else">
              <p className={styles.panelTitle}>This note changed somewhere else</p>
              <p className={styles.panelBody}>
                Nothing was overwritten. Read both, then choose.
              </p>
              <div className={styles.conflictVersions}>
                <div className={styles.conflictVersion}>
                  <span className={styles.conflictLabel}>Yours</span>
                  {notebook.conflict.localBody}
                </div>
                <div className={styles.conflictVersion}>
                  <span className={styles.conflictLabel}>Saved version</span>
                  {notebook.conflict.remote.body}
                </div>
              </div>
              <div className={styles.panelActions}>
                <button
                  type="button"
                  className={styles.quietButton}
                  onClick={() => void notebook.resolveConflict("mine", note)}
                >
                  Keep mine
                </button>
                <button
                  type="button"
                  className={styles.quietButton}
                  onClick={() => void notebook.resolveConflict("theirs", note)}
                >
                  Use the saved one
                </button>
                <button
                  type="button"
                  className={styles.quietButton}
                  onClick={() => void notebook.resolveConflict("both", note)}
                >
                  Keep both
                </button>
              </div>
            </div>
          ) : null}

          <label className={styles.srOnly} htmlFor="note-body">
            Note
          </label>
          <textarea
            id="note-body"
            ref={detailRef}
            className={styles.detailField}
            value={notebook.detailBody}
            readOnly={notebook.readOnly}
            onChange={(event) => notebook.setDetailBody(event.target.value)}
            onBlur={() => {
              if (dirty && !notebook.conflict) void notebook.saveDetail(note);
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "s") {
                event.preventDefault();
                void notebook.saveDetail(note);
              }
            }}
          />

          <dl className={styles.detailFooter}>
            <div className={styles.detailPair}>
              <dt>Captured</dt>
              <dd>{friendlyDate(note.createdAt, now)}</dd>
            </div>
            {edited ? (
              <div className={styles.detailPair}>
                <dt>Edited</dt>
                <dd>{friendlyDate(note.updatedAt, now)}</dd>
              </div>
            ) : null}
            {note.promotedTaskId ? (
              <div className={styles.detailPair}>
                <dt>Task</dt>
                <dd>
                  <a className={styles.linkedTask} href={taskFocusPath(note.promotedTaskId ?? "")}>
                    {note.extractBody || "Open the task"}
                  </a>
                </dd>
              </div>
            ) : null}
            {note.reviewedAt ? (
              <div className={styles.detailPair}>
                <dt>Reviewed</dt>
                <dd>{friendlyDate(note.reviewedAt, now)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </>
  );
}

/* ── Review ────────────────────────────────────────────────────────────── */

function ReviewView({
  note,
  queueLength,
  done,
  total,
  now,
  onKeep,
  onDelete,
  onTurnIntoTask,
  onSkip,
  canSkip,
  onOpenNotebook,
  canSendToTasks,
}: {
  note: NoteRead | null;
  queueLength: number;
  done: number;
  total: number;
  now: number;
  onKeep: (note: NoteRead) => void | Promise<void>;
  onDelete: (note: NoteRead) => void;
  onTurnIntoTask: (note: NoteRead) => void;
  onSkip: () => void;
  canSkip: boolean;
  onOpenNotebook: () => void;
  canSendToTasks: boolean;
}) {
  const [drag, setDrag] = useState<{ x: number; active: boolean }>({ x: 0, active: false });
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"none" | "x" | "y">("none");

  const swipeIntent =
    drag.x > 72 ? "task" : drag.x < -72 ? "delete" : null;

  const reset = () => {
    setDrag({ x: 0, active: false });
    axis.current = "none";
  };

  if (!note) {
    return (
      <div className={styles.review}>
        <div className={styles.reviewProgress}>
          <span>{queueLength === 0 && done > 0 ? "All reviewed" : "Nothing to review"}</span>
        </div>
        <div className={styles.reviewStage}>
          <div className={styles.emptyCentred}>
            <p className={styles.emptyTitle}>
              {done > 0 ? "That is everything" : "No notes to review"}
            </p>
            <p className={styles.emptyBody}>
              {done > 0
                ? "Your notebook is clear. New notes will appear here as you capture them."
                : "Notes you capture arrive here so you can decide what to do with them."}
            </p>
            <button type="button" className={styles.quietButton} onClick={onOpenNotebook}>
              Open the notebook
            </button>
          </div>
        </div>
      </div>
    );
  }

  const source = noteSource(note.source);
  const percent = Math.round((done / total) * 100);

  return (
    <div className={styles.review}>
      <div className={styles.reviewProgress}>
        <span>{queueLength === 1 ? "One note left" : `${queueLength} notes to review`}</span>
        {/* The rail appears once there is progress to show. Empty, a
            full-width track reads as a horizontal rule, and a short one
            reads as a stub. */}
        {done > 0 ? (
          <>
            <span className={styles.progressTrack} aria-hidden="true">
              <span className={styles.progressFill} style={{ inlineSize: `${percent}%` }} />
            </span>
            <span>{done} decided just now</span>
          </>
        ) : null}
      </div>
      <div className={styles.reviewStage}>
        <article
          className={styles.reviewCard}
          data-review-card=""
          data-swipe={swipeIntent ?? undefined}
          style={
            drag.active
              ? { transform: `translateX(${drag.x}px)`, transition: "none" }
              : undefined
          }
          onPointerDown={(event) => {
            if (event.pointerType === "mouse") return;
            startX.current = event.clientX;
            startY.current = event.clientY;
            axis.current = "none";
            setDrag({ x: 0, active: true });
          }}
          onPointerMove={(event) => {
            if (!drag.active) return;
            const dx = event.clientX - startX.current;
            const dy = event.clientY - startY.current;
            if (axis.current === "none") {
              // Let a vertical scroll stay a scroll. Only claim the gesture
              // once the movement is clearly sideways.
              if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
                axis.current = "y";
                reset();
                return;
              }
              if (Math.abs(dx) > 12) axis.current = "x";
              else return;
            }
            if (axis.current !== "x") return;
            setDrag({ x: dx, active: true });
          }}
          onPointerUp={() => {
            if (axis.current === "x" && swipeIntent === "task" && canSendToTasks) {
              onTurnIntoTask(note);
            } else if (axis.current === "x" && swipeIntent === "delete") {
              onDelete(note);
            }
            reset();
          }}
          onPointerCancel={reset}
        >
          <div className={styles.reviewMeta}>
            <SourceIcon source={source} />
            <span>{SOURCE_LABELS[source]}</span>
            <span aria-hidden="true">·</span>
            <span>{friendlyDate(note.createdAt, now)}</span>
            {swipeIntent ? (
              <span className={styles.rowFlag} data-tone={swipeIntent === "task" ? "sent" : "attention"}>
                {swipeIntent === "task" ? "Release to turn into a task" : "Release to delete"}
              </span>
            ) : null}
          </div>
          <p className={styles.reviewBody}>{note.body}</p>
          <div className={styles.reviewActions}>
            <button type="button" className={styles.quietButton} onClick={() => void onKeep(note)}>
              <CheckIcon />
              Keep in Notes
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => onTurnIntoTask(note)}
              disabled={!canSendToTasks}
            >
              Turn into task
            </button>
            <span className={styles.reviewSpacer} />
            {canSkip ? (
              <button type="button" className={styles.quietButton} onClick={onSkip}>
                Decide later
              </button>
            ) : null}
            <button type="button" className={styles.dangerButton} onClick={() => onDelete(note)}>
              Delete
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}

/* ── Sent ──────────────────────────────────────────────────────────────── */

/**
 * Sent is the same list-and-detail shape as the notebook, on purpose: it is
 * the same notes, seen through what became of them. The list carries the
 * task wording, because that is what a person is looking for here; the
 * detail carries the note that produced it, unchanged.
 */
function SentView({
  notes,
  now,
  selectedId,
  onSelect,
  restoringId,
  onRestore,
  onOpenInNotebook,
  demoMode,
}: {
  notes: PresentableNote[];
  now: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  restoringId: string | null;
  onRestore: (note: NoteRead) => void | Promise<void>;
  onOpenInNotebook: (note: PresentableNote) => void;
  demoMode: boolean;
}) {
  const selected = notes.find((note) => note.id === selectedId) ?? null;

  if (!notes.length) {
    return (
      <div className={styles.emptyCentred}>
        <p className={styles.emptyTitle}>Nothing sent yet</p>
        <p className={styles.emptyBody}>
          Notes you turn into tasks will stay available here, with the task they created.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.split} data-detail-open={Boolean(selected) || undefined}>
      <section className={styles.listPane} aria-labelledby="sent-list-heading">
        <div className={styles.listMeta}>
          <h2 className={styles.srOnly} id="sent-list-heading">
            Notes you turned into tasks
          </h2>
          <span>{countLabel("sent", notes.length)}</span>
        </div>
        <ul className={styles.list}>
          {notes.map((note, index) => {
            const archived = isArchived(note);
            return (
              <li key={note.id}>
                {index > 0 ? <div className={styles.rowSeparator} aria-hidden="true" /> : null}
                <button
                  type="button"
                  className={styles.row}
                  data-sent-row=""
                  data-note-id={note.id}
                  aria-current={note.id === selectedId ? "true" : undefined}
                  onClick={() => onSelect(note.id)}
                >
                  <span className={styles.rowIcon}>
                    <SourceIcon source={noteSource(note.source)} />
                    <span className={styles.srOnly}>
                      {SOURCE_LABELS[noteSource(note.source)]}, turned into a task
                    </span>
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowTitle}>
                      {note.extractBody || derivePresentation(note.body).title}
                    </span>
                    <span className={styles.rowPreview}>
                      {derivePresentation(note.body).title}
                    </span>
                    <span className={styles.rowMeta}>
                      <span>{friendlyDate(note.archivedAt ?? note.updatedAt, now)}</span>
                      {archived ? (
                        <span className={styles.rowFlag}>Not in your notebook</span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.detailPane} aria-label="Sent note">
        {selected ? (
          <>
            <div className={styles.detailHeader}>
              <div className={styles.detailMeta}>
                <button
                  type="button"
                  data-notes-back=""
                  className={`${styles.quietButton} ${styles.backButton}`}
                  onClick={() => onSelect(null)}
                >
                  <BackIcon />
                  Sent
                </button>
                <SourceIcon source={noteSource(selected.source)} />
                <span>{SOURCE_LABELS[noteSource(selected.source)]}</span>
                <span aria-hidden="true">·</span>
                {/* updated_at is the last edit, not the send. Until the send
                    time is read from the outbox, say what the number is. */}
                <span>
                  {selected.archivedAt
                    ? `Sent ${friendlyDate(selected.archivedAt, now)}`
                    : `Last edited ${friendlyDate(selected.updatedAt, now)}`}
                </span>
              </div>
              <div className={styles.detailActions}>
                <a className={styles.primaryButton} href={taskFocusPath(selected.promotedTaskId ?? "")}>
                  <TaskIcon />
                  Open task
                </a>
              </div>
            </div>
            <div className={styles.detailScroll}>
              <div className={styles.detailInner}>
                <div>
                  <p className={styles.conflictLabel}>What the task says</p>
                  <p className={styles.sentWording}>
                    {selected.extractBody || derivePresentation(selected.body).title}
                  </p>
                </div>
                <div>
                  <p className={styles.conflictLabel}>The note it came from</p>
                  <p className={styles.reviewBody}>{selected.body}</p>
                </div>
                {isArchived(selected) ? (
                  <div className={styles.panel}>
                    <p className={styles.panelTitle}>This note is not in your notebook</p>
                    <p className={styles.panelBody}>
                      Restoring brings this exact note back to the notebook. The task it
                      created stays in Tasks either way.
                    </p>
                    <div className={styles.panelActions}>
                      <button
                        type="button"
                        className={styles.quietButton}
                        onClick={() => void onRestore(selected as NoteRead)}
                        disabled={restoringId === selected.id || demoMode}
                      >
                        <RestoreIcon />
                        {restoringId === selected.id ? "Restoring…" : "Restore to Notebook"}
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
                    <button
                      type="button"
                      className={styles.quietButton}
                      onClick={() => onOpenInNotebook(selected)}
                    >
                      Open in Notebook
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyCentred}>
            <p className={styles.emptyTitle}>Nothing open</p>
            <p className={styles.emptyBody}>
              Choose one to see the note it came from.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/* ── Turn into task ────────────────────────────────────────────────────── */

function TurnIntoTaskDialog({
  note,
  notebook,
  workspaces,
  copy,
  onClose,
  onCreated,
}: {
  note: NoteRead;
  notebook: ReturnType<typeof useNotebook>;
  workspaces: TasksWorkspaceDestination[];
  copy: ReturnType<typeof notesCopyForDomain>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const send = notebook.send;
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    window.setTimeout(() => firstFieldRef.current?.focus({ preventScroll: true }), 0);
    return () => {
      (openerRef.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && send?.status !== "sending") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, send?.locked, send?.status]);

  if (!send) return null;

  const sent = send.status === "sent";
  const sending = send.status === "sending";
  const noun = workspaceNoun(
    workspaces.find((item) => item.id === send.workspaceId)?.contextType ??
      workspaces[0]?.contextType,
  );
  const overLimit = send.taskTitle.length > MAX_APPROVED_EXTRACT_CHARS;

  return (
    <div className={styles.scrim} onPointerDown={(event) => {
      if (event.target === event.currentTarget && !sending) onClose();
    }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
        {sent ? (
          <>
            <h2 className={styles.dialogTitle} id={titleId}>
              Task created
            </h2>
            <p className={styles.dialogLede}>{copy.handoff.stayedPut}</p>
            <p className={styles.sentWording}>{send.taskTitle}</p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.quietButton} onClick={onClose}>
                Close
              </button>
              <a className={styles.primaryButton} href={taskFocusPath(send.receipt?.taskId ?? "")}>
                <TaskIcon />
                Open task
              </a>
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.dialogTitle} id={titleId}>
              Turn this into a task
            </h2>
            <p className={styles.dialogLede}>{copy.handoff.boundary}</p>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${titleId}-title`}>
                What the task says
              </label>
              <input
                id={`${titleId}-title`}
                ref={firstFieldRef}
                className={styles.fieldControl}
                value={send.taskTitle}
                maxLength={MAX_APPROVED_EXTRACT_CHARS + 40}
                disabled={sending}
                onChange={(event) => notebook.updateSend({ taskTitle: event.target.value })}
              />
              <span className={styles.fieldHint}>
                {overLimit
                  ? copy.errors.tooLong
                  : "This is the only wording that leaves Notes."}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${titleId}-project`}>
                {noun}
              </label>
              <select
                id={`${titleId}-project`}
                className={styles.fieldControl}
                value={send.workspaceId}
                disabled={sending || Boolean(send.locked)}
                onChange={(event) => notebook.updateSend({ workspaceId: event.target.value })}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              {send.locked ? (
                <span className={styles.fieldHint}>{copy.handoff.lockedDestination}</span>
              ) : null}
            </div>

            {send.error ? (
              <p className={styles.errorText} role="alert">
                {send.error}
              </p>
            ) : null}

            <div className={styles.dialogActions}>
              {/* Always enabled. Locking the request must never lock the
                  window: with Tasks down there was no way out of this dialog
                  except reloading the page. */}
              <button
                type="button"
                className={styles.quietButton}
                onClick={onClose}
                disabled={sending}
              >
                {send.locked ? "Close" : "Never mind"}
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={sending || overLimit || !send.taskTitle.trim()}
                onClick={() => {
                  void notebook.submitSend(note).then((ok) => {
                    if (ok) onCreated();
                  });
                }}
              >
                {sending
                  ? "Creating…"
                  : send.status === "failed"
                    ? "Try again"
                    : "Create task"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { CloseIcon };
