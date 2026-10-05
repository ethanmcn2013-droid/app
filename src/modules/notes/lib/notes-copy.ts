/**
 * Every user-visible string in the Notes capture and hand-to-Tasks flow.
 *
 * Why this module exists (E05.04, E05.05, VEF-2026).
 *
 * The flow shipped with engineer-shaped wording: "Send approved extract to
 * Tasks", "Approved wording", "Will send: approved wording · note ID ·
 * workspace ID", "Retry safely with the same note identity". Those describe
 * the mechanism correctly and describe nothing a couple planning a wedding
 * recognises. The behaviour was right and the words were wrong, so the words
 * are the work.
 *
 * Two registers, one shape. `generic` is what every Signal Studio account
 * reads. `wedding` is what a couple reads once their workspace carries the
 * wedding domain. Both registers must define every key, which
 * `notes-copy.test.ts` enforces, so a wedding account can never fall through
 * to a missing string.
 *
 * Rules this module is held to, checked mechanically in the sibling test:
 *   - no engineer vocabulary in any value (see BANNED_IN_COPY)
 *   - no em dashes, no exclamation marks (studio/BRAND.md §3, four absolutes)
 *   - the privacy sentences name what crosses and what does not, in both
 *     registers, because that boundary is the promise the venue offer rests on
 *
 * This module is pure. No React, no server imports, no DB. It is safe to
 * import from a client component and from a test.
 */

/** Which register a surface should read in. */
export type NotesRegister = "generic" | "wedding";

/**
 * The workspace domain Notes receives from Tasks. Only `wedding` changes the
 * register today; every other value, and null, reads generic.
 */
export function registerForDomain(
  activeDomain: string | null | undefined,
): NotesRegister {
  return activeDomain === "wedding" ? "wedding" : "generic";
}

export type NotesCopy = {
  capture: {
    /** Placeholder in the capture field. */
    placeholder: string;
    /** Standing line next to the capture label. */
    privacyAssurance: string;
    /** Standing line in the notebook header. */
    headerAssurance: string;
    /** Empty notebook, before the first note exists. */
    emptyTitle: string;
    emptyBody: string;
  };
  voice: {
    /** Button label when idle. */
    start: string;
    /** Button label while listening. */
    stop: string;
    /**
     * Standing disclosure shown wherever dictation is offered.
     *
     * Non-negotiable. The browser speech engine sends the audio to the
     * browser maker's own speech service, which is a third party neither
     * Signal Studio nor the couple chose. Nothing in the product said so
     * before this task. A couple dictating a private conversation about
     * money or family is entitled to know the words leave the device.
     */
    disclosure: string;
    /** Shown when the browser has no speech engine at all. */
    unavailable: string;
    /** Microphone permission refused. */
    denied: string;
    /** Engine ran but heard nothing. */
    noSpeech: string;
    /** Anything else. */
    failed: string;
  };
  handoff: {
    /** Heading over the hand-to-Tasks panel. */
    heading: string;
    /** The standing privacy boundary sentence above the panel. */
    boundary: string;
    /** Starts the hand-off from the highlighted words. */
    begin: string;
    /** Label over the words the couple highlighted. */
    sourceLabel: string;
    /** Label over the project picker. */
    destinationLabel: string;
    /** Accessible name of the editable wording field. */
    wordingLabel: string;
    /** Exact statement of what crosses and what stays. */
    payload: string;
    /** Same statement while a retry is locked. */
    payloadLocked: string;
    /** Abandons the hand-off. */
    cancel: string;
    /** Primary action, idle. */
    send: string;
    /** Primary action, in flight. */
    sending: string;
    /** Primary action after a failure. */
    retry: string;
    /** Quiet progress label. */
    inFlight: string;
    /** Quiet label once Tasks has confirmed. */
    confirmed: string;
    /** Locked-destination explanation on a retry. */
    lockedDestination: string;
    /** Fallback name when the locked project cannot be resolved. */
    lockedDestinationUnknown: string;
    /** Link into Tasks from the confirmation. */
    open: string;
    /** Sentence under the confirmation, reassuring that the note stayed. */
    stayedPut: string;
  };
  errors: {
    /** The note has not been saved yet. */
    unsavedNote: string;
    /** Nothing is highlighted in the note yet. */
    nothingSelected: string;
    /** No project chosen. */
    noDestination: string;
    /** Wording field empty. */
    emptyWording: string;
    /** Wording field over the limit. */
    tooLong: string;
    /** Highlighted words are longer than a task can hold. */
    selectionTooLong: string;
    /** Offline. */
    offline: string;
    /** Tasks unreachable. */
    tasksUnavailable: string;
    /** Tasks may have accepted it but the answer was lost. */
    replyLost: string;
    /** A retry of that exact send is already waiting. */
    retryPending: string;
    /** The note changed underneath the hand-off. */
    sourceChanged: string;
    /** The note changed and local recovery is blocked too. */
    sourceChangedNoRecovery: string;
    /** Delete refused because a hand-off is still in flight. */
    deleteBlocked: string;
    /** Leaving the note while a retry is outstanding. */
    leaveBlockedRetry: string;
    /** Leaving the note while a send is in flight. */
    leaveBlockedSending: string;
  };
  destination: {
    /** No project available yet. */
    empty: string;
    /** Tasks did not answer. */
    unavailable: string;
    /** Offline. */
    offline: string;
    /** Link label when a project must be made first. */
    createLink: string;
    /** Link label otherwise. */
    openLink: string;
  };
  receipts: {
    /** Toast after a successful hand-off. */
    sent: string;
    /** Toast when a duplicate was avoided. */
    recovered: string;
  };
  /** The v3 notebook frame: list, capture canvas, reader and review. */
  notebook: {
    /** The list pane before the first note exists. */
    empty: string;
    /** The capture bar pinned over the list. */
    captureBar: string;
    /** The canvas heading. */
    canvasTitle: string;
    /** Line under the capture canvas. */
    canvasAssurance: string;
    /** The disclosure under the canvas. */
    moreWays: string;
    /** Banner heading with one note waiting. */
    bannerOne: string;
    /** Banner heading. `{count}` is the number waiting. */
    bannerMany: string;
    /** Banner body when notes can become tasks. */
    reviewPrompt: string;
    /** Banner body when nothing can become a task here. */
    reviewPromptNoTasks: string;
    /** Heading over the last few notes that became tasks. */
    recentTitle: string;
    /** The first line of a finished review session. */
    reviewDone: string;
    /** "{count} kept" in the finished line. */
    reviewKept: string;
    /** One note turned into a task, in the finished line. */
    reviewTurnedOne: string;
    /** "{count} turned into tasks" in the finished line. */
    reviewTurned: string;
    /** "{count} deleted" in the finished line. */
    reviewDeleted: string;
    /** Nothing waiting for review at all. */
    reviewEmpty: string;
    /** The In Tasks view before anything has become a task. */
    sentEmpty: string;
  };
};

const generic: NotesCopy = {
  capture: {
    placeholder: "Write the thought before it disappears…",
    privacyAssurance: "Private until you send it on",
    headerAssurance: "Yours until you send something on",
    emptyTitle: "Your notebook starts with one private thought.",
    emptyBody: "The capture field is ready above.",
  },
  voice: {
    start: "Dictate",
    stop: "Stop listening",
    disclosure:
      "Your browser may send microphone audio to its speech service to turn it into text. Signal Studio does not receive or retain that audio. Your browser or speech provider controls its service retention. Typing stays on your device until you save.",
    unavailable:
      "This browser has no speech engine, so dictation is off here. Chrome and Safari have one. Typing works everywhere.",
    denied: "Dictation needs microphone access. Allow it in your browser, or type instead.",
    noSpeech: "Nothing was heard. Start dictation again, or type instead.",
    failed: "Dictation stopped. Start it again, or type instead.",
  },
  handoff: {
    heading: "Turn this into a task",
    boundary:
      "Your note stays here. Tasks only ever receives the exact words you pick and check below.",
    begin: "Use these words",
    sourceLabel: "The words you picked",
    destinationLabel: "Which project",
    wordingLabel: "The task wording",
    payload:
      "Tasks receives these words and nothing else from this note. The rest of what you wrote stays private here.",
    payloadLocked:
      "This send is already on its way. The wording and the project stay fixed until Tasks answers.",
    cancel: "Never mind",
    send: "Send to Tasks",
    sending: "Sending…",
    retry: "Try sending again",
    inFlight: "Sending",
    confirmed: "Tasks has it",
    lockedDestination: "Fixed while this send finishes",
    lockedDestinationUnknown: "The project you picked",
    open: "Open in Tasks",
    stayedPut: "Your note is still here, still private, still yours to edit.",
  },
  errors: {
    unsavedNote: "Save this note first, then you can turn it into a task.",
    nothingSelected: "Highlight the words you want in the note first.",
    noDestination: "Pick a project first.",
    emptyWording: "Write the task wording first.",
    tooLong: "That is too long for a task. Trim it to 280 characters or fewer.",
    selectionTooLong:
      "You picked more than a task can hold. Trim the wording to 280 characters or fewer.",
    offline: "You are offline. Nothing has left Notes. Reconnect and try again.",
    tasksUnavailable: "Tasks did not answer. Nothing left Notes, so nothing was lost.",
    replyLost:
      "Tasks may already have this. Try again and Notes will find it rather than making a second copy.",
    retryPending:
      "This one is still going. Try it again unchanged and Notes will pick up where it left off, without making a second copy.",
    sourceChanged:
      "This note changed while you were sending. Both versions are kept. Read it again and pick your words.",
    sourceChangedNoRecovery:
      "This note changed while you were sending. Both versions are on screen, but this device cannot hold a spare copy, so keep this tab open.",
    deleteBlocked:
      "This note was not deleted. It changed, or it is still on its way to Tasks. The latest version is back on screen.",
    leaveBlockedRetry: "Finish this send before you leave the note.",
    leaveBlockedSending: "Wait for Tasks to answer before you leave the note.",
  },
  destination: {
    empty: "You have no project yet. Your note stays private here.",
    unavailable: "Tasks is not answering right now. Your note stays private here.",
    offline: "You are offline. Your note stays private here.",
    createLink: "Open Tasks to make a project",
    openLink: "Open Tasks",
  },
  receipts: {
    sent: "Sent to Tasks. Your note stayed here.",
    recovered: "Tasks already had this one, so nothing was duplicated.",
  },
  notebook: {
    empty: "Your notes will appear here.",
    captureBar: "Write a note…",
    canvasTitle: "New note",
    canvasAssurance: "Only you can see your notes.",
    moreWays: "More ways to capture",
    bannerOne: "1 note waiting",
    bannerMany: "{count} notes waiting",
    reviewPrompt: "Keep, turn into a task, or delete.",
    reviewPromptNoTasks: "Keep or delete.",
    recentTitle: "Recently turned into tasks",
    reviewDone: "All caught up.",
    reviewKept: "{count} kept",
    reviewTurnedOne: "1 turned into a task",
    reviewTurned: "{count} turned into tasks",
    reviewDeleted: "{count} deleted",
    reviewEmpty: "Nothing waiting. New notes land here until you decide what they are.",
    sentEmpty: "Notes you turn into tasks show up here, with a link to the task.",
  },
};

const wedding: NotesCopy = {
  capture: {
    placeholder: "Write it down before you forget it…",
    privacyAssurance: "Only the two of you can see this",
    headerAssurance: "Yours until you send something on",
    emptyTitle: "Everything you two say to each other about the day starts here.",
    emptyBody: "Write the first one above. Nobody else can read it.",
  },
  voice: {
    start: "Speak it",
    stop: "Stop",
    disclosure:
      "Your browser may send microphone audio to its speech service to turn it into text. Signal Studio does not receive or retain that audio. Your browser or speech provider controls its service retention. Typing stays on your device until you save.",
    unavailable:
      "This browser cannot turn speech into text, so speaking is off here. Chrome and Safari can. Typing works everywhere.",
    denied: "Speaking needs microphone access. Allow it in your browser, or type it instead.",
    noSpeech: "Nothing was heard. Try again, or type it instead.",
    failed: "That stopped early. Try again, or type it instead.",
  },
  handoff: {
    heading: "Make this something to do",
    boundary:
      "Your note stays here. Your task list only ever gets the exact words you pick and check below. Your venue never sees any of it.",
    begin: "Use these words",
    sourceLabel: "The words you picked",
    destinationLabel: "Which plan",
    wordingLabel: "What the task will say",
    payload:
      "Your task list gets these words and nothing else from this note. The rest of what you wrote stays private here.",
    payloadLocked:
      "This one is already on its way. The wording and the plan stay fixed until it lands.",
    cancel: "Never mind",
    send: "Add to our list",
    sending: "Adding…",
    retry: "Try again",
    inFlight: "Adding",
    confirmed: "It is on your list",
    lockedDestination: "Fixed while this one finishes",
    lockedDestinationUnknown: "The plan you picked",
    open: "Open your list",
    stayedPut: "Your note is still here, still private, still yours to edit.",
  },
  errors: {
    unsavedNote: "Save this note first, then you can make it something to do.",
    nothingSelected: "Highlight the words you want in the note first.",
    noDestination: "Pick a plan first.",
    emptyWording: "Write what the task should say first.",
    tooLong: "That is too long for a task. Trim it to 280 characters or fewer.",
    selectionTooLong:
      "You picked more than a task can hold. Trim it to 280 characters or fewer.",
    offline: "You are offline. Nothing has left your notebook. Reconnect and try again.",
    tasksUnavailable: "Your task list did not answer. Nothing left your notebook, so nothing was lost.",
    replyLost:
      "This may already be on your list. Try again and Notes will find it rather than adding it twice.",
    retryPending:
      "This one is still going. Try it again unchanged and Notes will pick up where it left off, without adding it twice.",
    sourceChanged:
      "This note changed while you were adding it. Both versions are kept. Read it again and pick your words.",
    sourceChangedNoRecovery:
      "This note changed while you were adding it. Both versions are on screen, but this device cannot hold a spare copy, so keep this tab open.",
    deleteBlocked:
      "This note was not deleted. It changed, or it is still on its way to your list. The latest version is back on screen.",
    leaveBlockedRetry: "Finish adding this before you leave the note.",
    leaveBlockedSending: "Wait for this to land before you leave the note.",
  },
  destination: {
    empty: "You have no plan yet. Your note stays private here.",
    unavailable: "Your task list is not answering right now. Your note stays private here.",
    offline: "You are offline. Your note stays private here.",
    createLink: "Open your list to start a plan",
    openLink: "Open your list",
  },
  receipts: {
    sent: "Added to your list. Your note stayed here.",
    recovered: "This was already on your list, so nothing was added twice.",
  },
  notebook: {
    empty: "Your notes will appear here.",
    captureBar: "Write it down…",
    canvasTitle: "New note",
    canvasAssurance: "Nobody else can read your notes.",
    moreWays: "More ways to capture",
    bannerOne: "1 note waiting",
    bannerMany: "{count} notes waiting",
    reviewPrompt: "Keep, add to your list, or delete.",
    reviewPromptNoTasks: "Keep or delete.",
    recentTitle: "Recently added to your list",
    reviewDone: "All caught up.",
    reviewKept: "{count} kept",
    reviewTurnedOne: "1 added to your list",
    reviewTurned: "{count} added to your list",
    reviewDeleted: "{count} deleted",
    reviewEmpty: "Nothing waiting. New notes land here until you decide what each one is for.",
    sentEmpty: "Notes you add to your list show up here, with a link to the task.",
  },
};

const REGISTERS: Record<NotesRegister, NotesCopy> = { generic, wedding };

export function notesCopy(register: NotesRegister): NotesCopy {
  return REGISTERS[register];
}

export function notesCopyForDomain(
  activeDomain: string | null | undefined,
): NotesCopy {
  return notesCopy(registerForDomain(activeDomain));
}

/**
 * Vocabulary that must never reach a user-visible string in this flow.
 *
 * Each entry is here because it shipped. "extract", "approved wording",
 * "workspace ID" and "note ID" were all on screen before this task. They are
 * mechanism words: correct to an engineer, meaningless to the couple whose
 * wedding this is. `receipt` is banned as a noun for a created task for the
 * same reason. `promote` is banned because a couple does not promote a note.
 *
 * The test asserts these against every value in both registers, so a
 * regression reintroduces a failure rather than a quiet drift.
 */
export const BANNED_IN_COPY: readonly string[] = [
  "extract",
  "promote",
  "promotion",
  "approved wording",
  "approved action",
  "approved send",
  "approved source",
  "workspace id",
  "note id",
  "note identity",
  "immutable",
  "payload",
  "receipt",
  "destination",
  "idempot",
  "sha256",
  "dto",
  "endpoint",
  "schema",
] as const;
// "api" is deliberately absent. As a bare substring it fires on ordinary
// words a couple would read ("capital", "rapid"), so it would train the next
// author to waive the rule rather than obey it. The tech-jargon ban in
// studio/BRAND.md still applies to the whole term; this list is only the
// mechanical half.

/** Fills `{count}` in a copy string. */
export function withCount(template: string, count: number): string {
  return template.replace("{count}", count.toLocaleString("en-IE"));
}

/**
 * What a list row's second line says when a note has no more text than its
 * title, by where the note came from. Same wording in both registers.
 */
export const EMPTY_ROW_PREVIEW: Readonly<Record<"typed" | "voice" | "photo" | "email" | "calendar", string>> = {
  typed: "No more text",
  voice: "Voice note",
  photo: "Photo note",
  email: "No more text",
  calendar: "No more text",
};

/** Exported for the test and for any surface that needs the whole set. */
export const ALL_REGISTERS: readonly NotesRegister[] = ["generic", "wedding"] as const;

/**
 * The three views, by their internal id. The `sent` id and the ?view=sent
 * URL are unchanged; what a person reads is "In Tasks", the same words as
 * countLabel. "Sent" is never shown.
 */
export const NOTES_VIEW_LABELS: Readonly<Record<"notebook" | "review" | "sent", string>> = {
  notebook: "All",
  review: "To review",
  sent: "In Tasks",
};

/** The legend that explains the list's two state marks, everywhere it appears. */
export const NOTES_LEGEND = {
  waiting: "Waiting for a decision",
  /** The same mark, where the legend has one line to itself. */
  waitingShort: "Waiting",
  inTasks: "In Tasks",
  private: "Private to you",
} as const;

/** What the reader's decision bar and the row actions say. */
export const NOTES_ACTIONS = {
  keep: "Keep",
  turnIntoTask: "Turn into task",
  delete: "Delete",
  openTask: "Open task",
  editNote: "Edit note",
  moreForNote: "More actions for this note",
  saving: "Saving…",
  saved: "Saved",
  notSaved: "Not saved. Retry",
} as const;

/**
 * One keyboard map for the three decisions, wherever they are offered: the
 * list, the open note and review. Same keys, same order (Turn into task,
 * Keep, Delete), so muscle memory built in one place works in the others.
 * `shortcut` is the aria-keyshortcuts value; `keycap` is what the key
 * hint shows.
 */
export const NOTES_DECISION_KEYS = {
  turnIntoTask: { shortcut: "T", keycap: "T" },
  keep: { shortcut: "E", keycap: "E" },
  delete: { shortcut: "Delete Backspace", keycap: "⌫" },
  later: { shortcut: "L", keycap: "L" },
} as const;

/** The order the decision buttons appear in, everywhere. */
export const NOTES_DECISION_ORDER = ["turnIntoTask", "keep", "delete"] as const;

/**
 * The finished line of a review session: "All caught up. 5 kept, 2 turned
 * into tasks, 1 deleted." Parts with nothing in them are left out.
 */
export function reviewSummary(
  copy: NotesCopy,
  counts: { kept: number; turned: number; deleted: number },
): string {
  const parts: string[] = [];
  if (counts.kept > 0) parts.push(withCount(copy.notebook.reviewKept, counts.kept));
  if (counts.turned === 1) parts.push(copy.notebook.reviewTurnedOne);
  else if (counts.turned > 1) parts.push(withCount(copy.notebook.reviewTurned, counts.turned));
  if (counts.deleted > 0) parts.push(withCount(copy.notebook.reviewDeleted, counts.deleted));
  return parts.length ? `${copy.notebook.reviewDone} ${parts.join(", ")}.` : copy.notebook.reviewDone;
}

/** "8 notes waiting", "1 note waiting". */
export function waitingLabel(copy: NotesCopy, count: number): string {
  return count === 1 ? copy.notebook.bannerOne : withCount(copy.notebook.bannerMany, count);
}
