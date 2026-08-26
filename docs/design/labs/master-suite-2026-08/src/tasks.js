
const params = window.__SUITE.params("tasks");
let state = params.get("state") || "board";
const variant = params.get("v") || "locked";

/* The three finished variants are three preset combinations of the six
   decisions. Nothing else distinguishes them, which is what guarantees
   every mix stays on-brand. */
/* `locked` is the founder's own combination, chosen in the Design Console on
   2026-08-24 and locked as the default: A · Air taken as the starting point,
   then the card raised off the sheet, the corner softened and the type set
   calm. It is Air's air with a card that is an object rather than an outline.
   The other three stay exactly as they were, because the console's whole
   argument is that any mix of the six decisions is on-brand, and a preset
   that quietly followed the default would stop proving it. */
const PRESETS = {
  locked: { cards: "elevated", radius: "soft", density: "comfortable", indigo: "subtle", type: "calm" },
  a: { cards: "flat", radius: "round", density: "comfortable", indigo: "subtle", type: "expressive" },
  b: { cards: "bordered", radius: "sharp", density: "compact", indigo: "subtle", type: "calm" },
  c: { cards: "elevated", radius: "soft", density: "comfortable", indigo: "forward", type: "expressive" },
};
const DECISIONS = ["cards", "radius", "density", "indigo", "type"];

/* Standalone, the decisions live on the document. Inside the customizer
   they live on the deck element, and the code does not know the
   difference, which is what keeps one implementation of the board. */
const root = window.__SUITE.root("tasks");
const preset = PRESETS[variant] || PRESETS.locked;
root.setAttribute("data-variant", variant);
for (const key of DECISIONS) {
  root.setAttribute("data-" + key, params.get(key) || preset[key]);
}

/* ── The interaction layer ────────────────────────────────────────────
   Everything below is state the operator can change and the renderer reads.
   There is one source for the board and one render path; a handler mutates
   a fact and asks for a repaint, never touches the DOM it did not create. */
let WORK = null;        /* the mutable task set, seeded from the fixture   */
let focusId = null;     /* the board's single tab stop                     */
let carriedId = null;   /* the card currently in the operator's hand       */
let carriedFrom = null; /* where it was picked up, so Escape can undo      */
/* `?state=filtered` is the overdue chip pressed before the first paint. The
   filtered board is a real screen the panel has judged, and it was only ever
   reachable by clicking, so the shot harness could not photograph it. This
   opens the same door the chip opens and then hands the render back to the
   board, which is the branch a filtered board already takes. */
let lateOnly = state === "filtered";
if (state === "filtered") state = "board";
let clientOnly = null;  /* one couple, the venue's own way of looking       */
let todayOnly = false;  /* the question a venue actually opens this to ask  */
let undone = null;      /* the last reversible act: a completion or a move  */
let openNoteId = null;  /* the card showing its full note                   */
let flyId = null;       /* the card that should travel on the next repaint  */
let pressedControl = null; /* the control a pointer press began on, if any   */
let pressAt = null;     /* where a press on a card body began, for the 8px test */
let flyWas = null;      /* the card as it looked BEFORE it was finished        */
let flyHome = null;     /* the slot it left, captured before the repaint       */
let flyCounts = null;   /* the tallies as they read before it was finished     */
let refocusPart = null; /* which part of the card to land focus on          */
let drawerTab = "nodate";
let drawerFrom = null;  /* the control Planning was opened from              */
const picked = new Set();
let dayFor = null;      /* the row whose day menu is open, or "picked"  */
let draftLane = null;   /* the column currently composing a new task        */
let draftText = "";     /* held in state, so a repaint cannot eat it        */
let draftFrom = null;   /* the control the composer was opened from         */
let seq = 0;
let undoTimer = null;
let menuFor = null;     /* the card whose move menu is open                 */
let menuAt = "";
let flyFrom = null;     /* where a completed card was, so it can travel     */
let refocus = false;    /* the last change came from the keyboard          */

/* The keycap says what this keyboard actually has on it. */
const MOD = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "\u2318" : "Ctrl ";
/* A hint that names two keys is no use to a thumb. */
const TOUCH = matchMedia("(hover: none)").matches;

const B = window.BOARD;
const I = window.ICON;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/* Every task in the review fixture belongs to Orla, so the assignee disc
   says nothing and is not drawn. The shipped board's own rule. */
const UNIFORM_ASSIGNEES = true;

/* The three couples the review fixture names. Everything else in the tag
   field is an area of the house. */
const CLIENTS = new Set(["Mara & Finn", "Nora & Cian", "Aisling & Tom"]);

/* One accessor for the rendered set, and every header fact derived from it.
   Before this the header's total was recomputed for the dense board and its
   done count was not, so the board said "5 of 32 done" above a Done column
   labelled 9. A board that contradicts itself on screen is a blocker, not a
   polish item. */
/* Newest first in Done: a column of records reads backwards from now. */
function byCompleted(rows) {
  return rows.slice().sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));
}

function seed() {
  if (state === "empty") return [];
  const base = B.tasks.slice();
  return (state === "dense"
    ? base.concat(window.DENSE_EXTRA.map((t, i) => ({ ...t, id: "x" + i })))
    : base
  ).map((t) => ({ ...t }));
}

/* The working set is per state, so switching to the empty board and back
   does not resurrect a card the operator moved. */
function allTasks() {
  if (!WORK || WORK.key !== state) WORK = { key: state, rows: seed() };
  return WORK.rows;
}

function taskById(id) {
  return allTasks().find((t) => t.id === id) || null;
}

/* The header counts the whole project. The board shows what is being looked
   at. Filtering must never change what "5 of 13 done" means. */
function tasksFor(lane) {
  let rows = allTasks().filter((t) => t.lane === lane);
  if (lane === "done") rows = byCompleted(rows);
  if (lateOnly) rows = rows.filter((t) => timeOf(t).kind === "overdue");
  if (todayOnly) rows = rows.filter((t) => timeOf(t).kind === "today");
  if (clientOnly) rows = rows.filter((t) => t.tag === clientOnly);
  return rows;
}

function filtering() { return lateOnly || clientOnly || todayOnly; }

/* The board can be asked more than one question at once, and the sentence is
   composed from whichever are live rather than branched per filter. */
/* The sentence was assembled rather than written, and it came apart the
   moment two filters were on: "Nothing for Mara & Finn, overdue, due today.
   13 others are hidden." — a comma list with no conjunction, and an "others"
   count when nothing was shown for them to be other than.
   Conditions are joined with "and" and stay in front of the noun; the couple
   is a trailing prepositional phrase, because "overdue and for Mara & Finn"
   reads worse than what it replaces. When nothing matches there are no
   others, so the remainder is stated as its own fact. */
function filterSentence() {
  if (!filtering()) return "Showing all work.";
  const shown = B.columns.reduce((n, c) => n + tasksFor(c.id).length, 0);
  const all = allTasks().length;
  const rest = all - shown;
  /* "overdue" is an adjective and sits in front of the noun; "due today" is a
     predicate and sits behind it. One modifier used to take three positions
     across the sentence, the tooltip and the chip. */
  const adj = lateOnly ? "overdue " : "";
  const cond = todayOnly ? "due today" : "";
  const scope = clientOnly ? " for " + clientOnly : "";
  if (!shown) {
    return (adj || cond
      ? "No " + adj + "task is " + (cond || "on the board") + scope + "."
      : "Nothing on the board is" + scope + ".") +
      " All " + all + " " + (all === 1 ? "is" : "are") + " hidden.";
  }
  return "Showing " + shown + " " + adj + (shown === 1 ? "task" : "tasks") +
    (cond ? " " + cond : "") + scope + ". " +
    rest + " " + (rest === 1 ? "other is" : "others are") + " hidden.";
}

/* The board in reading order, which is also the order the arrows walk. */
function laneIds() {
  return B.columns.map((c) => c.id);
}
function place(id) {
  const lanes = laneIds();
  for (let x = 0; x < lanes.length; x += 1) {
    const rows = tasksFor(lanes[x]);
    const y = rows.findIndex((t) => t.id === id);
    if (y !== -1) return { x, y, rows };
  }
  return null;
}

/* One time fact per card, resolved once, in ONE grammar: every chip states
   the day the work is due. Lateness is carried entirely by the fill, which
   is the direction's own claim. Before this a single board scan carried an
   elapsed duration ("2 days late"), a deictic ("Today"), a weekday
   ("Friday") and a date ("1 Aug") for the same kind of fact, and the header
   called the same state something else again. */
const TODAY = "2026-07-16";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* Every chip on every card was floating without an anchor: nothing anywhere
   said what today is, so "14 Jul" could be two days late or two months. */
function todayLabel() {
  const today = new Date(Date.UTC(2026, 6, 16));
  return DAYS[today.getUTCDay()] + " " + today.getUTCDate() + " " + MONTHS[today.getUTCMonth()];
}

/* The review clock is pinned, so "today" is a fact rather than a guess. */
/* The absolute day, with no deictic. */
function dateLabel(iso) {
  const parts = String(iso).split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCDate() + " " + MONTHS[date.getUTCMonth()];
}

function dayLabel(iso) {
  const parts = String(iso).split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const today = new Date(Date.UTC(2026, 6, 16));
  const days = Math.round((date - today) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) return DAYS[date.getUTCDay()];
  return date.getUTCDate() + " " + MONTHS[date.getUTCMonth()];
}

function daysLate(iso) {
  const parts = String(iso).split("-").map(Number);
  const date = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const days = Math.round((Date.UTC(2026, 6, 16) - date) / 86400000);
  return days + (days === 1 ? " day" : " days");
}

/* A count of days, which the chip now puts a verb in front of: "Held 21
   days". The rationale this comment used to give — matching a "2 days
   overdue" chip label — described a label the product stopped printing when
   the chip started carrying the value and the fill carrying the condition. */
function heldFor(iso) {
  /* Day zero is "today", not "0 days" — a card held since this morning has not
     been held for no time. */
  const parts = String(iso).split("-").map(Number);
  const days = Math.round((Date.UTC(2026, 6, 16) - Date.UTC(parts[0], parts[1] - 1, parts[2])) / 86400000);
  if (days <= 0) return "today";
  return days + (days === 1 ? " day" : " days");
}

function bindName(text) {
  return String(text).replace(/ & /g, "\u00a0&\u00a0");
}

function timeOf(task) {
  if (task.lane === "done") {
    /* A finished card said "Today" directly above four cards reading 15 Jul,
       14 Jul, 9 Jul — one word carrying a debt in one column and a receipt in
       another. The Done column speaks calendar dates only, which reserves
       "Today" and "Tomorrow" board-wide for what is still owed. */
    return { kind: "done", label: task.completedAt ? dateLabel(task.completedAt) : "" };
  }
  if (task.milestone) return { kind: "milestone", label: task.milestone.replace("Milestone due ", "") };
  /* Only when nothing is owed: a deadline outranks how long it has been out. */
  if (task.lane === "waiting" && task.heldSince && !task.dueAt) {
    return { kind: "waiting", label: heldFor(task.heldSince) };
  }
  if (!task.dueAt) return { kind: "none", label: "" };
  const label = dayLabel(task.dueAt);
    /* The state comes from the date, not from a field an author typed. The
       Planning room writes dueAt and nothing else, so a task the operator
       scheduled for today wore a "Today" chip in the wash that means nothing
       is wrong yet, was missing from the header's "1 today" count, and was
       hidden by the today filter that then called it one of the others. One
       derivation makes the chip, the count, the filter and the silhouette
       agree, because every one of them already reads through here. */
    if (task.dueAt < TODAY) return { kind: "overdue", label: label };
    if (task.dueAt === TODAY) return { kind: "today", label: label };
    return { kind: "soon", label: label };
  return { kind: "soon", label };
}

/* One tab stop per column, not one per card. Crossing the dense board was
   ninety-odd tab presses; the arrows walk the column and the roving stop
   means Tab still crosses the whole board in five. */
function card(task, force, stop) {
  const done = task.lane === "done";
  const next = Boolean(task.milestone);
  const time = timeOf(task);
  const show = time.kind !== "none" && time.label !== "";
  /* The sentence the chip used to print is not lost: it is the chip's
     accessible name and its tooltip, and the header's own "1 overdue" chip
     teaches the filled-ink mapping in situ. */
  const SAID = {
    overdue: [daysLate(task.dueAt) + " overdue, due " + time.label, "Overdue, due "],
    today: ["Due today", "Due "],
    soon: ["Due " + time.label, "Due "],
    milestone: ["Milestone, due " + time.label, "Milestone "],
    /* The chip reads "16 Jul" and its own tooltip read "Completed Today" — the
       Done column speaking two calendars at once, in two layers of the same
       object. Both layers take the absolute day. */
    done: [task.completedAt ? "Completed " + dateLabel(task.completedAt) : "", "Completed "],
    waiting: ["Held " + time.label + ", since " + dateLabel(task.heldSince), "Held "],
  };
  const said = SAID[time.kind] || ["", ""];
  /* Waiting carries its verb on screen. A bare "21 days" parses just as
     easily as "due in 21 days", which is the opposite of what it means.
     Done does not: measured at 1280 and 1440, "Completed 15 Jul" overruns the
     chip's 38% of the card measure, and a clipped date is worse than a quiet
     one. Its hairline ring, its filled tick and its column already say the
     work is finished, and the spoken name still says "Completed". */
  const SHOWN = { waiting: "Held " };
  const label = SHOWN[time.kind]
    ? SHOWN[time.kind] + esc(time.label)
    : '<span class="sr">' + said[1] + "</span>" + esc(time.label);

  /* Which couple a task belongs to is the question a venue asks on a
     Saturday. Which area of the house it touches is background. They were
     sharing one mono slot and one ink level. */
  const bits = [];
  if (task.tag) {
    bits.push(CLIENTS.has(task.tag)
      ? '<button type="button" class="who" data-act="client" data-client="' + esc(task.tag) +
        '" tabindex="' + (stop ? "0" : "-1") + '"' +
        ' aria-pressed="' + (clientOnly === task.tag ? "true" : "false") +
        '" title="' + (clientOnly === task.tag ? "Show every couple again" : "Show only " + esc(task.tag)) +
        '">' + bindName(esc(task.tag)) + "</button>"
      : '<span class="tag">' + esc(task.tag) + "</span>");
  }
  /* One word. The row has to carry whose wedding it is, which room of the
     house it touches and how urgent it is, in a 254px measure; "priority"
     is the word in that sentence that no operator needs to read twice. It
     stays in the accessible name. */
  if (task.priority && !done) {
    bits.push('<span class="hi">' + esc(task.priority) + '<span class="sr"> priority</span></span>');
  }
  if (task.comments) bits.push('<span class="cm">' + I.comment + task.comments + "</span>");

  return (
    '<article class="card" data-id="' + esc(task.id) +
    '" draggable="' + (openNoteId === task.id ? "false" : "true") + '"' +
    ' aria-label="' + esc(task.title) + '" aria-describedby="cd-' + esc(task.id) + '"' +
    (task.note ? ' aria-expanded="' + (openNoteId === task.id ? "true" : "false") + '"' : "") +
    ' tabindex="' + (stop ? "0" : "-1") + '"' + (done ? "" : ' aria-roledescription="Movable task"') +
    ' aria-keyshortcuts="Space ArrowUp ArrowDown ArrowLeft ArrowRight"' +
    (task.id === carriedId ? ' aria-grabbed="true"' : "") +
    (task.id === openNoteId ? " data-open" : "") +
    (done ? " data-done" : "") + (next ? " data-next" : "") +
    (force ? ' data-force="' + force + '"' :
      task.id === carriedId ? ' data-force="moving"' : "") + ">" +
    '<button type="button" class="tick" data-act="tick" tabindex="' + (stop ? "0" : "-1") +
      '" role="checkbox" aria-checked="' + (done ? "true" : "false") +
      '" aria-label="' + (done ? "Mark not done" : "Mark done") + '">' + I.check + "</button>" +
    '<div class="cardTitleRow">' +
      (show ? '<span class="when" data-t="' + time.kind + '" title="' + esc(said[0]) + '">' +
        label + "</span>" : "") +
      '<p class="cardTitle" id="ct-' + esc(task.id) + '">' + bindName(esc(task.title)) + "</p>" +
      '<span class="sr" id="cd-' + esc(task.id) + '">' + esc([
        said[0], task.note, task.tag, task.priority ? task.priority + " priority" : "",
        task.comments ? task.comments + (task.comments === 1 ? " comment" : " comments") : "",
      ].filter(Boolean).map((p) => String(p).replace(/\.$/, "")).join(". ")) + ".</span>" +
    "</div>" +
    (task.note ? '<p class="cardNote">' + esc(task.note) + "</p>" : "") +
    '<div class="cardFoot">' + bits.join("") +
      (task.fromNote ? '<span class="grow" title="Came from a note">' + I.note + "</span>" : "") +
      '<button class="cardDots" data-act="menu" tabindex="' + (stop ? "0" : "-1") +
        '" aria-haspopup="menu" aria-expanded="' + (menuFor === task.id ? "true" : "false") +
        '" aria-label="Move this task">' + I.dots + "</button>" +
    "</div>" +
    "</article>"
  );
}

/* A group of controls is one tab stop and the arrows walk it. Applied to the
   rail, the view switcher and the tools, the way in costs three presses
   instead of fifteen, and nothing loses its stated reason. */
function groupKeys(event) {
  const group = event.target.closest && event.target.closest("[data-group]");
  if (!group) return false;
  /* THE SPINE IS NOT THIS BOARD'S. `[data-group="rail"]` used to be the
     board's own capsule; it is now the SUITE's nav, and this rover was
     still answering its keys alongside the suite's own. Two handlers, one
     group: every arrow press moved two tiles, half the spine was
     unreachable, and the one object that makes three products into one
     application was the one object whose keyboard model did not work.
     Five seats found it independently in round 1.
     The suite owns its spine's keys. This board owns the board's. */
  if (group.dataset.group === "rail") return false;
  const key = event.key;
  const horizontal = group.dataset.group !== "rail";
  const next = horizontal ? "ArrowRight" : "ArrowDown";
  const prev = horizontal ? "ArrowLeft" : "ArrowUp";
  if (key !== next && key !== prev && key !== "Home" && key !== "End") return false;
  event.preventDefault();
  const items = [...group.querySelectorAll("button")].filter((n) => n.offsetParent !== null);
  const at = items.indexOf(document.activeElement);
  const to = key === "Home" ? 0
    : key === "End" ? items.length - 1
    : (at + (key === next ? 1 : items.length - 1) + items.length) % items.length;
  items.forEach((n, i) => n.setAttribute("tabindex", i === to ? "0" : "-1"));
  items[to].focus();
  return true;
}

/* ── what the suite may ask of this board ────────────────────────
   A narrow, named surface, and the only way in. Everything below is the
   board's own vocabulary — allTasks(), applyLaneFacts(), tasksFor(),
   focusId, mount() — so a task that crossed from Notes arrives exactly
   the way one typed into a column does, and every rule the board already
   enforces about a new card enforces itself here too. */
const TASKS_API = {
  rows: () => allTasks(),
  byId: (id) => taskById(id),
  /* The seam names a lane in the words a person reads ("To do"); the board
     knows it by id. One translation, here. */
  laneIdFor(name) {
    const column = B.columns.find((c) => c.id === name || c.name === name);
    return column ? column.id : null;
  },
  add(spec) {
    const rows = allTasks();
    const task = { tag: "", priority: "", comments: 0, ...spec };
    /* A task arriving in a lane takes that lane's facts, the same as one
       created in it: a card that lands in Done with no completion date is
       a receipt-less card in the column that exists to be the memory. */
    applyLaneFacts(task, null, task.lane);
    const inLane = tasksFor(task.lane);
    const before = inLane.length ? inLane[inLane.length - 1] : null;
    const at = before ? rows.findIndex((t) => t.id === before.id) + 1 : rows.length;
    rows.splice(at, 0, task);
    mount();
    return task;
  },
  remove(id) {
    const rows = allTasks();
    const at = rows.findIndex((t) => t.id === id);
    if (at === -1) return false;
    rows.splice(at, 1);
    if (focusId === id) focusId = null;
    if (openNoteId === id) openNoteId = null;
    if (carriedId === id) carriedId = null;
    mount();
    return true;
  },
  reveal(id) {
    if (!taskById(id)) return false;
    /* A filter can hide the card the seam just made, and being sent to a
       card you cannot see is worse than not being sent at all. */
    lateOnly = false;
    todayOnly = false;
    clientOnly = null;
    openNoteId = null;
    focusId = id;
    refocus = true;
    refocusPart = "card";
    mount();
    return true;
  },
  /* The add verb on the phone capsule. The capsule is the suite's, the
     verb is the board's. */
  add0() {
    draftLane = B.columns[0].id;
    draftText = "";
    mount();
    const field = window.__SUITE.host("tasks").querySelector(".card[data-draft] .cardTitle");
    if (field) field.focus();
  },
};

/* The rail is one stop the arrows walk, and for eleven rounds it was four.
   The mark and the avatar carried no tabindex at all, so they were natural
   stops; and the tile expression short-circuited before it incremented, so
   Home took the "first tile" zero and Tasks took the "active" zero — two
   zeros in one roving group. The keyboard handler repaired it on the first
   arrow press and every repaint threw the repair away.
   One piece of state now says where the group's index is, every button in the
   rail is addressed by the same key, and the position survives a repaint. */
let railCurrent = null;

function rail() {
  const active = (B.rail.products.find((p) => p.active) || {}).key || "tasks";
  if (!railCurrent) railCurrent = active;
  const stop = (key) => ' tabindex="' + (key === railCurrent ? "0" : "-1") + '"';
  const tile = (key, label, isActive) =>
    '<button type="button" class="railTile" data-key="' + key + '" aria-label="' + label + '"' +
    stop(key) +
    (isActive ? ' data-active aria-current="page" title="' + label + '"'
      : notYet(RAIL[key] || label)) + ">" + I[key] + "</button>";
  return (
    '<nav class="rail" data-group="rail" aria-label="Signal Studio">' +
    '<button type="button" class="railMark" data-key="mark" aria-label="Signal Studio"' + stop("mark") +
      notYet("Every Signal Studio app in one place. Not here yet.") + ">" + I.more + "<i></i></button>" +
    '<span class="railDivider"></span>' +
    '<div class="railGroup">' + tile("home", "Home", false) +
      B.rail.products.map((p) => tile(p.key, p.label, p.active)).join("") + "</div>" +
    '<span class="railSpacer"></span>' +
    '<div class="railUtil">' + tile("inbox", "Inbox", false) +
      tile("help", "Help and settings", false) + "</div>" +
    '<button class="railAdd" data-key="add" data-act="add" data-lane="' + B.columns[0].id +
      '"' + stop("add") + ' aria-label="Add task">' + I.plus + "</button>" +
    '<button type="button" class="railAvatar" data-key="me" aria-label="' + esc(B.operator.role) + '"' +
      stop("me") +
      notYet("Your account, in Signal Studio. Not here yet.") + ">" + B.operator.initials + "</button>" +
    "</nav>"
  );
}

/* One helper, so an unavailable control cannot be marked one way here and
   another way there. It stays in the tab order deliberately: a control that
   cannot be reached never gets to say why it is missing. */
function notYet(what) {
  return ' aria-disabled="true" title="' + esc(what) + '"';
}
const SOON = "Board is the only view for now.";
const TOOLS = "Filter, Sort and Display come with the other views.";
const SEARCH = "Search comes with the other views.";
/* Named, not templated: a door says what is behind it, then says it is not
   here yet. "Release" was a software vendor's word in a product whose bar is
   that a venue manager with no project-management background understands it
   unaided; nothing else on this board speaks that language. */
const RAIL = {
  home: "Every project in one list. Not here yet.",
  notes: "What you wrote down. Not here yet.",
  timeline: "The dates the season turns on. Not here yet.",
  inbox: "What came in while you were working. Not here yet.",
  help: "Guides and support. Not here yet.",
  tasks: "Tasks",
};

function head() {
  const p = B.progress;
  const rows = allTasks();
  const total = rows.length;
  const done = rows.filter((t) => t.lane === "done").length;
  const overdue = rows.filter((t) => timeOf(t).kind === "overdue").length;
  const dueToday = rows.filter((t) => timeOf(t).kind === "today").length;
  const undated = rows.filter((t) => timeOf(t).kind === "none").length;
  return (
    '<div class="head">' +
    '<span class="word">tasks</span><span class="headRule"></span>' +
    '<h1 class="headName">' + esc(B.workspace) + "</h1>" +
    '<div class="headFacts">' +
      '<span class="today">' + todayLabel() + "</span>" +
      (total && done === total ? '<span class="ratio" data-all>Everything is done.</span>' :
       total ? '<span class="ratio"><b>' + done + "</b> of <b>" + total + "</b> done</span>" : "") +
      /* The control survives at zero while the filter is on, or clearing the
         last overdue task leaves the operator with an empty board and no way
         back. */
      /* The overdue chip already survives at zero while its filter is on; its
         twin did not, so clearing the last due-today task removed the chip and
         slid its neighbour into the exact box the pointer was resting on.
         THE RULE: a chrome control that can be filtered on survives at zero. */
      (dueToday || todayOnly ? '<button type="button" class="late" data-act="today" data-soft aria-pressed="' +
        (todayOnly ? "true" : "false") + '" title="' + (todayOnly ? "Show all " + total + " tasks"
          : "Show only the " + dueToday + " " + (dueToday === 1 ? "task" : "tasks") + " due today") + '">' + dueToday + " today" +
        (todayOnly ? I.close : "") + "</button>" : "") +
      (overdue || lateOnly
        ? '<button type="button" class="late" data-act="late" aria-pressed="' + (lateOnly ? "true" : "false") +
          '" title="' + (lateOnly ? "Show all " + total + " tasks"
            : "Show only the " + overdue + " overdue " + (overdue === 1 ? "task" : "tasks")) + '">' +
          overdue + " overdue" + (lateOnly ? I.close : "") + "</button>"
        : "") +
      (undated ? '<button type="button" class="undated" data-act="planning" title="Open Planning to see the ' +
        undated + ' tasks with no day">' + undated + " with no day</button>" : "") +
      "<span>" + esc(B.season) + ", day " + p.day + " of " + p.of + "</span>" +
    "</div>" +
    '<div class="headActions">' +
      '<button class="ghost headSearch" aria-label="Search"' + notYet(SEARCH) + ">" +
        I.search + "</button>" +
      '<button class="ghost"' + notYet("Sharing arrives when you can invite the couple and your suppliers in.") + ">" +
        I.share + "<span>Share</span></button>" +
      /* The count is printed once, in the facts row, where it names what it
         counts. It used to be printed twice on one 40px band under two names
         — "5 with no date" and "Planning 5" — both the same control opening
         the same room. The button carries its state instead of a tally. */
      '<button class="ghost" data-act="planning" aria-expanded="' + (state === "planning" ? "true" : "false") +
        '">' + I.planning + "<span>Planning</span></button>" +
      '<button class="ghost" aria-label="More"' + notYet("Project settings come with your account.") + ">" +
        I.dots + "</button>" +
    "</div></div>"
  );
}

function views() {
  const icons = { Board: I.board, List: I.list, Schedule: I.schedule, Calendar: I.calendar };
  return (
    '<div class="views"><nav class="seg" data-group="views" role="tablist" aria-label="View">' +
    /* Painted at the same weight as a control that works, these promised a
       Schedule and a Calendar nobody has built. Drawn as unavailable they
       stop lying, and they say why when asked rather than doing nothing. */
    B.views.map((v) => '<button type="button" role="tab" class="segItem"' +
      /* A tablist whose active tab computes selected=false announces the
         product's primary view switcher as four unselected tabs. */
      (v === "Board"
        ? ' data-active aria-current="true" aria-selected="true"'
        : ' aria-selected="false"' + notYet(SOON)) +
      ' tabindex="' + (v === "Board" ? "0" : "-1") + '">' + icons[v] + "<span>" + v + "</span></button>").join("") +
    '</nav><div class="viewTools" data-group="tools">' +
      ["Filter", "Sort", "Display"].map((t, i) =>
        '<button class="ghost" tabindex="' + (i ? "-1" : "0") + '"' + notYet(TOOLS) + ">" +
        I[t.toLowerCase()] + "<span>" + t + "</span></button>").join("") +
    "</div></div>"
  );
}

function board() {
  /* One tab stop for the whole board. Without this the dense board cost
     ninety-odd presses to cross; with it, Tab reaches the board, the arrows
     walk it, and Tab leaves. */
  const all = laneIds().flatMap((id) => tasksFor(id).map((t) => t.id));
  if (!all.includes(focusId)) focusId = all[0] || null;
  return (
    '<div class="board"' + (filtering() ? " data-filtered" : "") +
      (allTasks().length ? "" : " data-blank") +
      ' role="application" aria-label="Task board, arrow keys to move between tasks, space to pick one up">' +
    B.columns.map((c) => {
      const rows = tasksFor(c.id);
      const all = allTasks().filter((t) => t.lane === c.id);
      /* Under a filter, five columns saying the same sentence read as a
         rendering fault. The board says it once, in the first column. */
      /* Under a filter the board states itself once, at the foot. A
         board-scoped sentence sitting in a column slot reads as a claim
         about that column. */
      /* One instruction on the sheet, in the column the work starts in. The
         other four columns keep their note, so each still teaches what it
         holds without four of them issuing an order. */
      const empty = filtering() || !allTasks().length ? "" : c.empty;
      return (
        '<section class="tray" data-lane="' + c.id + '" data-tone="' + c.tone + '"' +
          /* A column holding the open composer is not an empty column — it is
             where the operator is working. Collapsing it under a filter took
             the ground away mid-sentence and dropped focus off the Add row it
             came from. */
          (rows.length || draftLane === c.id ? "" : " data-empty") +
          ' aria-describedby="tn-' + c.id + '"' +
          ' role="region" aria-label="' +
          /* A lane that was already empty has no proportion to state, filtered
             or not: "0 of 0 shown" is a ratio of nothing to nothing. Both
             channels take the same branch, because closing only the visible
             one leaves a screen reader hearing what the screen stopped saying. */
          esc(c.name) + (filtering() && all.length
            ? ", " + rows.length + " of " + all.length + " shown"
            : rows.length
            ? ", " + rows.length + (rows.length === 1 ? " task" : " tasks")
            : ", nothing here yet") + '">' +
        '<div class="trayHead"><div class="trayTop">' +
          '<span class="pip" aria-hidden="true"></span>' +
          '<h2 class="trayName">' + esc(c.name) + "</h2>" +
          '<span class="trayCount" aria-hidden="true">' + rows.length +
            (filtering() && all.length ? '<span class="ofAll">/' + all.length + "</span>" : "") + "</span></div>" +
          /* Under a filter a column describes what it is showing, not what it
             normally holds — four notes were false in context. */
          /* Under a filter the column already carries its name, its count of
             total, and the foot strip's whole sentence. A note here is the
             same fact a fourth time. */
          '<p class="trayNote" id="tn-' + c.id + '">' + esc(filtering() ? "" : c.note) + "</p></div>" +
        '<div class="trayBody" tabindex="-1">' +
          (rows.length ? rows.map((t) => card(t, null, t.id === focusId)).join("")
            : empty ? '<p class="trayEmpty">' + esc(empty) + "</p>" : "") +
          (draftLane === c.id ? draft() : "") +
        "</div>" +
        /* "Add task" also sits on the dock, ten pixels below, meaning the
           whole project. This one means this column. */
        /* One Add row in the tab order — the column the roving stop is in —
           reached from any card by Tab, like the card's own controls. */
        '<button class="trayAdd" data-act="add" data-lane="' + c.id +
          '" tabindex="' + (rows.some((t) => t.id === focusId) || (!focusId && c.id === B.columns[0].id) ? "0" : "-1") +
          '" aria-label="Add a task to ' + esc(c.name) + '">' +
          I.plus + "<span>Add here</span></button>" +
        "</section>"
      );
    }).join("") + "</div>" +
    /* Emptiness is the state this board spends most of its life in, and for
       ten rounds it had no design — four identical Add rows over a white
       void. One centred sentence and one action, inside the sheet. */
    /* The block leaves the moment it is obeyed. It used to go on asserting
       "Nothing on the board yet." in full ink while a live composer with a
       caret in it sat two columns away — the one instruction the rebuild
       leads with, made false by following it. */
    (!allTasks().length && !draftLane
      ? '<div class="emptyBoard"><p><b>Nothing on the board yet.</b>' +
        "Put the first thing you have to do somewhere you will see it again." +
        '</p><button type="button" data-act="add" data-lane="' + B.columns[0].id + '">' +
        I.plus + "Add the first task</button>" +
        /* The one line on this screen that says wedding venue rather than
           software team. A blank board teaches nothing about what belongs
           on it; an example does. */
        '<p class="emptyEg">Something like: Confirm marquee sides with the hire company.</p>' +
        "</div>"
      : filtering() && !laneIds().flatMap((id) => tasksFor(id)).length
      /* The block used to say "Every task on the board is hidden by the
         filter you have on" without ever naming the filter. It names it now,
         in the same sentence the strip used to carry, so nothing was lost
         when the strip stood down. */
      ? '<div class="emptyBoard"><p><b>Nothing matches.</b>' +
        esc(filterSentence()) +
        '</p><button type="button" data-act="clear">Show all work</button></div>'
      : "")
  );
}

function dock() {
  return (
    '<div class="dock">' +
      '<button class="dockField"' + notYet(SEARCH) + ">" + I.search +
        "<span>Search " + esc(B.workspace) + "</span></button>" +
      '<button class="dockPrimary" data-act="add" data-lane="' + B.columns[0].id + '">' +
        I.plus + "<span>Add task</span></button>" +
      '<span class="dockRule"></span>' +
      '<button type="button" class="dockAvatar" aria-label="' + esc(B.operator.role) + '"' +
        notYet("Your account, in Signal Studio. Not here yet.") + ">" + B.operator.initials + "</button>" +
    "</div>"
  );
}

/* The composer. It is a card in the tray it belongs to, with the title as
   the only field, because a task is a sentence and everything else about it
   can be decided afterwards on the card itself. */
function draft() {
  return (
    '<article class="card" data-draft>' +
    '<button type="button" class="tick" tabindex="-1" aria-hidden="true">' + I.check + "</button>" +
    '<div class="cardTitleRow">' +
      '<p class="cardTitle" contenteditable="plaintext-only" role="textbox"' +
      ' aria-label="What has to happen?" data-placeholder="What has to happen?">' +
      esc(draftText) + "</p>" +
    "</div>" +
    '<p class="draftHint">' + (TOUCH
      ? '<button type="button" class="carryDo draftDo" data-act="commit">Add</button>' +
        '<button type="button" class="draftDrop" data-act="discard">Discard</button>'
      : "Enter adds it. Esc discards it.") + "</p>" +
    "</article>"
  );
}

/* Titles are short; the pill is wide. Cutting at four words severed
   sentences after a preposition with hundreds of pixels going spare. */
/* The strip used to cut the operator's own title at a constant 48 characters
   and then keep talking, so the most-printed sentence in the product read
   "Reprint the faded welcome sign before the open... done" while the live
   region said the whole thing. The pill can measure itself, so it elides in
   CSS at the measure it actually has.
   THE RULE: no string is truncated at a character count when the box that
   holds it can measure itself. */
function shortTitle(title) { return title || ""; }

/* One strip at the foot of the sheet, and the board's only statement of
   what it is currently doing. In hand beats just-finished beats filtered. */
function footPill() {
  const task = carriedId && taskById(carriedId);
  if (task) {
    return (
      '<div class="carry">' +
      /* The live region already said "Picked up", so the strip leads with
         the subject rather than repeating the verb. */
      '<span class="carryName"><b>' + esc(shortTitle(task.title)) + "</b></span>" +
      '<em><kbd data-keys="arrows">\u2191\u2193\u2190\u2192</kbd> move</em>' +
      "<em><kbd>Space</kbd> drop</em>" +
      "<em><kbd>Esc</kbd> cancel</em>" +
      "</div>"
    );
  }
  /* The strip used to fade in at 200ms while the card was still in the air, so
     the black bar answered a quarter of a second before the gesture finished
     and the numbers then answered again. It waits for the landing. */
  if (undone) {
    if (undone.kind === "day") {
      return (
        '<div class="carry">' +
        '<span class="carryName">' +
        (undone.count === 1
          ? "<b>" + esc(shortTitle(undone.title || "")) + "</b> is due " + esc(undone.when)
          : "<b>" + undone.count + " tasks</b> are due " + esc(undone.when)) + "</span>" +
        '<button type="button" class="carryDo" data-act="undo">Undo</button>' +
        "<em><kbd>" + MOD + "Z</kbd></em>" +
        "</div>"
      );
    }
    const what = undone.kind === "done"
      ? "<b>" + esc(shortTitle(undone.title)) + "</b> done" +
        (undone.cleared ? '. <em class="clearNote">Nothing is overdue.</em>' : "")
      : undone.kind === "undone"
      /* The strip printed "reopened" while the live region said "is no longer
         done" — one act in two vocabularies, in the same breath. The strip
         takes the verb the spoken branch already chose. */
      ? "<b>" + esc(shortTitle(undone.title)) + "</b> is not done"
      : undone.kind === "add"
      ? "<b>" + esc(shortTitle(undone.title)) + "</b> added to " + esc(laneName(undone.toLane))
      : "<b>" + esc(shortTitle(undone.title)) + "</b> moved to " + esc(laneName(undone.toLane));
    return (
      '<div class="carry">' +
      '<span class="carryName">' + what + "</span>" +
      '<button type="button" class="carryDo" data-act="undo">Undo</button>' +
      (history.length > 1 ? "<em>" + (history.length - 1) + " more</em>" : "") +
      "<em><kbd>" + MOD + "Z</kbd></em>" +
      "</div>"
    );
  }
  /* When nothing matches, the centred block on the sheet says it — and it now
     names which filters are on, which is the only thing the strip carried
     that the block did not. Two statements of one fact 60px apart, under two
     different labels for one action, was the whole defect. The strip stands
     down and the block is the single answer. */
  if (filtering() && laneIds().flatMap((id) => tasksFor(id)).length) {
    return (
      '<div class="carry">' +
      '<span class="carryName">' + esc(filterSentence()) + "</span>" +
      '<button type="button" class="carryDo" data-act="showall">Show all work</button>' +
      "</div>"
    );
  }
  return "";
}

/* The menu is the one route to moving a card that a mouse, a finger and a
   keyboard can all take. Drag is a pointer gesture; Space is a keyboard one;
   a touch screen had neither. */
function cardMenu() {
  if (!menuFor) return "";
  const task = taskById(menuFor);
  if (!task) return "";
  return (
    '<div class="menuVeil" data-act="closemenu"></div>' +
    '<div class="cardMenu" role="menu" aria-label="Move ' + esc(task.title) + '" style="' + menuAt + '">' +
    "<p>Move to</p>" +
    B.columns.map((c) =>
      '<button type="button" role="menuitem" data-act="moveto" data-lane="' + c.id + '"' +
      ' tabindex="' + (c.id === task.lane ? "0" : "-1") + '"' +
      (c.id === task.lane ? ' aria-current="true"' : "") + ">" + esc(c.name) + "</button>").join("") +
    "</div>"
  );
}

/* Planning is a room, not a picture of one. Its list is derived from the
   live set, so the header's count and the drawer's count can never disagree,
   and every control in it either works or says why it does not. */
function undatedTasks() {
  return allTasks().filter((t) => timeOf(t).kind === "none");
}
function milestoneTasks() {
  return allTasks().filter((t) => t.milestone);
}

function drawer() {
  const p = B.planning;
  const rows = drawerTab === "milestones" ? milestoneTasks() : undatedTasks();
  const all = rows.length && rows.every((t) => picked.has(t.id));
  const tab = (key, label, count) =>
    '<button type="button" class="drawerTab" role="tab" data-act="drawerTab" data-tab="' + key + '"' +
    ' tabindex="' + (drawerTab === key ? "0" : "-1") + '"' +
    ' aria-selected="' + (drawerTab === key ? "true" : "false") + '"' +
    (drawerTab === key ? " data-active" : "") + ">" + label + "<em>" + count + "</em></button>";
  return (
    '<aside class="drawer" role="dialog" aria-modal="false" aria-labelledby="drawerTitle" tabindex="-1">' +
    '<div class="drawerHead"><div class="drawerTop"><span class="drawerKicker">' + esc(p.title) + "</span>" +
      '<button class="ghost" data-act="planning" style="margin-left:auto" aria-label="Close Planning">' +
        I.close + "</button></div>" +
            /* The board's own h1 is 928px away on the same screen, at the same
         weight and colour. The panel is named by what it does, and the
         accessible name it lends the dialog says so too. */
      '<h2 id="drawerTitle">' + (drawerTab === "milestones" ? "Milestones" : "Tasks with no day") + "</h2>" +
      '<p class="drawerLine">' + esc(p.line) + "</p>" +
      '<div class="axis"><i></i><b></b></div>' +
      '<div class="axisEnds"><span>6 Jul</span><span>10 Oct</span></div>' +
      '<p class="drawerSummary">' + esc(p.summary) + "</p></div>" +
    '<div class="drawerTabs" role="tablist" aria-label="Planning">' +
      tab("nodate", "No day", undatedTasks().length) +
      tab("milestones", "Milestones", milestoneTasks().length) + "</div>" +
    /* When the list empties, the room used to print "Every task here still
       needs a day." directly above "Every task has a day." — two sentences
       60px apart contradicting each other, in the moment the operator had
       just done what the room asked. At zero rows the empty state is the only
       sentence in the body. The milestones tab had the same shape. */
    (rows.length ? '<p class="drawerHelp">' +
      (rows.length > 1
        ? '<button type="button" class="selectAll" data-act="selectAll">' +
          (all ? "Clear all" : "Select all") + "</button>"
        : "") +
      esc(picked.size
        ? picked.size + (picked.size === 1 ? " task picked." : " tasks picked.")
        : drawerTab === "milestones" ? "The dates the season turns on."
        : "Every task here still needs a day.") +
    "</p>" : "") +
    '<div class="drawerRows" role="group" aria-label="' +
      (drawerTab === "milestones" ? "Milestones" : "Tasks with no day") + '">' +
    (rows.length
      ? rows.map((t) =>
        '<div class="drawerRow"' + (picked.has(t.id) ? " data-picked" : "") + ">" +
        '<button type="button" class="box" data-act="pick" data-id="' + esc(t.id) + '" role="checkbox"' +
        ' aria-checked="' + (picked.has(t.id) ? "true" : "false") + '" aria-label="Pick ' + esc(t.title) + '">' +
          /* The same check the card's tick draws, as a real element rather than
             a pseudo-glyph, so it survives forced-colors mode like everything
             else on this board. */
          I.check + "</button>" +
        "<span>" + bindName(esc(t.title)) + "</span>" +
        (drawerTab === "milestones"
          /* A milestone row states the date the season turns on. It never
             offered to set one — the button said "Pick a day" under a caption
             promising the dates, and printed no date at all. */
          ? '<span class="schedDate">' + esc(t.date || "No date yet") + "</span>"
          : '<button type="button" class="sched" data-act="day" data-id="' + esc(t.id) +
            '" aria-haspopup="menu" aria-expanded="' + (dayFor === t.id ? "true" : "false") +
            '" aria-label="Pick a day for ' + esc(t.title) + '">Pick a day ' + I.chevron + "</button>" +
            (dayFor === t.id ? dayMenu(t.id) : "")) +
        "</div>").join("")
      : '<p class="drawerEmpty">' +
        (drawerTab === "milestones" ? "No milestones on this project yet." : "Every task has a day.") + "</p>") +
    "</div>" +
    /* A picked set that flipped a label and announced a count while nothing
       could consume it was a control that did work and returned nothing. The
       verb appears when there is something to apply it to, and nowhere else. */
    (drawerTab !== "milestones" && picked.size
      ? '<div class="drawerBulk"><button type="button" class="drawerDo" data-act="day" data-id="picked"' +
        ' aria-haspopup="menu" aria-expanded="' + (dayFor === "picked" ? "true" : "false") + '">' +
        "Give " + picked.size + (picked.size === 1 ? " task" : " tasks") + " a day " + I.chevron + "</button>" +
        (dayFor === "picked" ? dayMenu("picked") : "") + "</div>"
      : "") +
    '<button class="drawerAdd" data-act="add" data-lane="' + B.columns[0].id + '"' +
      (drawerTab === "milestones" ? notYet("Setting a milestone comes with the Schedule view.") : "") + ">" +
      I.plus + "<span>" + (drawerTab === "milestones" ? "Add a milestone" : "Add a task with no day") +
      "</span></button></aside>"
  );
}

/* Four days an operator actually names, and one that opens the calendar the
   product does not have yet. The same anchored-menu idiom the card already
   uses, so there is one menu pattern in the product rather than two. */
const DAYS_OFFER = [
  ["today", "Today", 0],
  ["tomorrow", "Tomorrow", 1],
  /* Resolved, not a fixed offset: +3 from the pinned Thursday landed on
     Sunday, and a venue's weekend work is due before the Saturday it is for.
     A Saturday operator's "this weekend" means today, not a week out. */
  ["weekend", "This weekend", null],
  ["week", "Next week", 7],
];

function dayMenu(forId) {
  return (
    /* role="menu" is a contract, not a label: one tab stop, the arrows walk
       it, and it is named. The card menu already honours it; this declared it
       and honoured none of it. */
    '<div class="dayMenu" role="menu" data-group="day" aria-label="Give a day">' +
    DAYS_OFFER.map((d, i) =>
      '<button type="button" role="menuitem" tabindex="' + (i ? "-1" : "0") + '" data-act="setday" data-when="' + d[0] +
      '" data-id="' + esc(forId) + '">' + d[1] + "</button>").join("") +
    '<button type="button" role="menuitem" tabindex="-1"' + notYet("Choosing a specific day comes with the Schedule view.") +
    ">A specific day " + I.chevron + "</button>" +
    "</div>"
  );
}

/* TODAY is the pinned review clock, so a day given here lands on the same
   calendar every other fact on this board is measured against. */
function dayFrom(when) {
  const base = Date.UTC(2026, 6, 16);
  const offset = (DAYS_OFFER.find((d) => d[0] === when) || ["", "", 0])[2];
  const add = offset === null ? (6 - new Date(base).getUTCDay() + 7) % 7 : offset;
  const d = new Date(base + add * 86400000);
  return d.toISOString().slice(0, 10);
}

function loading() {
  return (
    '<main class="sheet">' +
    /* The product's own furniture is a constant, not payload. Greying out
       the workspace chrome, the five column names and the view switcher
       made the wait look like a bigger outage than it is; what is actually
       unknown is the work, and only that is drawn as a skeleton. */
    /* The skeleton used to grey out the workspace name while the same frame
       printed it twice in full ink. What is known at first paint is shown:
       the name, and today's date, which comes from the clock and not the
       payload. What is genuinely in flight stays a bar. */
    '<div class="head"><span class="word">tasks</span><span class="headRule"></span>' +
      '<h1 class="headName">' + esc(B.workspace) + "</h1>" +
      '<div class="headFacts"><span class="today">' + todayLabel() + "</span>" +
      '<span class="sk" style="width:96px;height:11px"></span>' +
      '<span class="sk" style="width:74px;height:11px"></span></div>' +
      '<div class="headActions"><span class="sk" style="width:92px;height:14px"></span></div></div>' +
    views() +
    '<div class="board">' +
    B.columns.map((c, i) => (
      '<section class="tray" data-tone="' + c.tone + '"><div class="trayHead">' +
        '<div class="trayTop"><span class="pip" aria-hidden="true"></span>' +
        '<h2 class="trayName">' + esc(c.name) + "</h2></div>" +
        '<p class="trayNote">' + esc(c.note) + "</p></div>" +
      '<div class="trayBody" tabindex="-1">' +
      /* Two per column: honest about not knowing, rather than a specific
         promise per column that the payload then contradicts.
         The heights were the part that lied. Ten identical 67px blocks with
         no tick became ragged cards of 98 to 136px each leading with a
         circle, so the arrival was a jump rather than a resolve. The block is
         built from the real card's own line boxes now — the tick in its
         reserved gutter, a two-line title, the note, the meta row — and the
         bar widths vary from a fixed seed so a tray reads as ten different
         unknown cards rather than one tile repeated. */
      [0, 1].map((n) => {
        const seed = (i * 2 + n) % 3;
        const title = [92, 78, 86][seed];
        const note = [64, 48, 58][seed];
        const meta = [30, 38, 34][seed];
        /* The real board runs 98 to 136. The first block in a tray takes the
           tall form and the second the short one, so the ladder the payload
           brings is foreshadowed rather than contradicted. */
        return '<div class="loadCard"' + (n === 0 ? ' data-tall' : "") + '><span class="sk skTick"></span>' +
          '<span class="sk" style="width:' + title + '%;height:12px"></span>' +
          '<span class="sk" style="width:' + Math.round(title * 0.6) + '%;height:12px"></span>' +
          '<span class="sk" style="width:' + note + '%;height:10px"></span>' +
          '<span class="sk" style="width:' + meta + '%;height:9px"></span></div>';
      }).join("") + "</div></section>"
    )).join("") + "</div>" +
    '<p class="loadSay">Opening the board</p>' +
    /* The foot furniture is a constant of the product, so it is present from
       the first paint. It simply cannot be used yet. */
    '<div class="dock" aria-hidden="true" data-idle>' +
      '<span class="dockField">' + I.search + "<span>Search " + esc(B.workspace) + "</span></span>" +
      '<span class="dockPrimary">' + I.plus + "<span>Add task</span></span>" +
      '<span class="dockRule"></span>' +
      '<span class="dockAvatar">' + B.operator.initials + "</span>" +
    "</div></main>"
  );
}

function specimens() {
  const find = (id) => B.tasks.find((t) => t.id === id);
  /* The two quiet kinds live in the peak-season set, not the base thirteen.
     The sheet promises every state a card can be in, so it reaches for them
     rather than teaching a rule it then does not demonstrate. */
  const like = (re) => (window.DENSE_EXTRA || []).find((t) => re.test(t.title || ""));
  const cells = [
    ["At rest", find("demo-t-03"), null, "Nothing but the work, and no date on it. No empty slots and no placeholder chips."],
    ["Hover", find("demo-t-04"), "hover", "The edge darkens and the menu appears. Height never changes."],
    ["Keyboard focus", find("demo-t-08"), "focus", "A real focus ring in the accent, not a colour change."],
    ["Overdue", find("demo-t-06"), null, "Filled ink, white type. The chip carries the date; the fill says you are behind it."],
    ["Due today", find("demo-t-05"), null, "Outlined, ink at full strength. Serious, and nothing has gone wrong yet."],
    ["Due soon", like(/florist/), null, "A wash, not a fill. The date is ahead of you and nothing is wrong."],
    ["Next milestone", find("demo-t-02"), null, "The one earned indigo in the whole view. The chip carries the date; the colour carries the fact."],
    ["Held", like(/band/), null, "No ring at all, and it says what it is. Nothing is owed by you; something is owed to you."],
    ["Done", find("demo-t-09"), null, "A hairline outline is a record, not a debt. Never struck through: the work happened, it was not a mistake."],
    ["Long title", { ...find("demo-t-01"), title: "Confirm the marquee sides and the wet-weather plan with the hire company before Thursday" }, null, "Two lines of title, then the note clamps. A card cannot run away."],
    ["In flight", find("demo-t-03"), "drag", "The card at rest, top left, picked up. The only shadow in the product."],
    ["Moving by keyboard", find("demo-t-04"), "moving", "Space picks a card up, the arrows walk it between columns. Lifted, but not tilted: nothing is carrying it."],
    ["Drop target", null, "drop", "The column being moved into warms half a step and draws the line the card will land on. Ink only, like everything else."],
  ];
  return (
    '<main class="sheet">' + head() +
    '<div class="specProbe" aria-hidden="true"><div class="board">' +
    '<section class="tray"><div class="trayBody" tabindex="-1"></div></section>'.repeat(5) + "</div></div>" +
    '<div class="spec"><p class="specIntro">Every state a card can be in, at the exact width a tray gives it. ' +
    /* The old sentence taught three rules and the board shipped six kinds, so
       two of them broke the law on every board that had a Done column in it.
       It states all six now, or it is not a teaching surface. */
    "The gutter, the title’s left edge and every line beneath it share one optical baseline, and the time fact sits at the head of the title so a tray reads as a column of dates rather than a pile, with the title flowing around it. Each chip carries a value, and its fill carries the condition. Filled ink means behind. A firm outline means due today. Indigo means the next milestone. A soft wash is a date still ahead. A hairline outline is a record rather than a debt: the day the work was finished. No outline at all, and a verb in front of the value, is time you are waiting on somebody else. Severity is expressed by ink density and fill, never by hue.</p>" +
    '<div class="specGrid">' +
    cells.map((c) => (
      '<div class="specCell"><span class="specLabel">' + c[0] + "</span>" +
      '<div class="specStage">' +
        (c[2] === "drop"
          ? '<div class="tray specTray" data-over><div class="trayBody" tabindex="-1">' +
            card(find("demo-t-08"), null, true) + '<span class="dropLine"></span>' +
            card(find("demo-t-07"), null, true) +
            "</div></div>"
          : card(c[1], c[2], true)) +
      "</div>" +
      '<p class="specNote">' + c[3] + "</p></div>"
    )).join("") + "</div></div></main>"
  );
}

function renderApp() {
  const sheet =
    state === "loading" ? loading()
    : state === "cards" ? specimens()
    : '<main class="sheet">' + head() + views() + board() + footPill() + dock() + "</main>";
  return sheet + (state === "planning" ? drawer() : "") + cardMenu();
}

/* The live region is created once and never re-rendered. A region that is
   replaced on every repaint is a new region every time, and a new region
   announces nothing. */
function say(words) {
  const node = document.getElementById("say");
  if (!node) return;
  /* Writing the same string twice produces no mutation and therefore no
     announcement, which is how "Note closed." went silent on a second card. */
  node.textContent = node.textContent === words ? words + " " : words;
}

function laneName(id) {
  const column = B.columns.find((c) => c.id === id);
  return column ? column.name : id;
}

/* Lane names are sentence case, so concatenating a preposition in front of one
   produced "in In progress" — the doubled word landing in the busiest column
   on the board by the most ordinary route there is. Mid-sentence, the name is
   lowercased unless it is a proper noun, which none of them are. */
function laneMid(id) {
  const name = laneName(id);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/* One convention for every spoken lane mention, not two. Lane names are
   sentence case, so a preposition in front of one produced "in In progress" —
   the doubled word landing in the busiest column by the most ordinary route
   there is. The column noun makes the sentence read as English at every site
   rather than only at the six that happened to double. */
function inLane(id) {
  return "in the " + laneMid(id) + " column";
}

/* A verb of motion needs "to", not "in": "moved in the in progress column" is
   not a sentence anyone writes. The preposition travels with the verb. */
function toLane(id) {
  return "to the " + laneMid(id) + " column";
}

/* A lane whose render path imposes its own ordering cannot honour a position
   the operator aimed at. Done re-sorts by completion date on every render, so
   the drop line named an index the card never landed on — and the live region
   announced that index too, telling a screen-reader operator a move had
   succeeded that never happened.
   THE RULE: any lane that sorts itself may not name a position in ANY channel.
   Read from the sort branch rather than declared twice, so the two cannot
   drift apart. */
function laneSorts(lane) { return lane === "done"; }

/* The facts a lane's own cards state, maintained in ONE place. moveTo kept
   them and the create path did not, so a task typed straight into Done or
   Waiting arrived with no completion date and no clock — a Done card with no
   receipt, in the column whose whole job is to be the venue's memory.
   THE RULE: every path that puts a task in a lane runs the same invariants;
   no caller may maintain a lane's defining facts on its own. */
function applyLaneFacts(task, from, to) {
  if (to === "done" && from !== "done") task.completedAt = TODAY;
  if (from === "done" && to !== "done") { task.completedAt = null; task.prevLane = null; }
  if (to === "waiting" && from !== "waiting") task.heldSince = TODAY;
  if (from === "waiting" && to !== "waiting") task.heldSince = null;
}

/* `preview` is a card being walked through columns by the arrow keys, which is
   not a commitment to anything. Arming the beat on the lane change alone fired
   a full false completion mid-gesture for a card the operator had not put down
   yet. A drop and a menu move are commits and pass nothing. */
function moveTo(id, lane, index, preview) {
  const rows = allTasks();
  const from = rows.findIndex((t) => t.id === id);
  if (from === -1) return;
  const task = rows[from];
  const was = task.lane;
  /* Moving into Done is a completion, wherever it came from. moveTo reports
     the fact and does not act on it: runUndo and a keyboard carry both call
     this, and a card walked through Done with the arrow keys must not fire a
     completion. The callers that mean it opt in by calling completed(). */
  let report = { completed: false, cleared: false };
  /* A card carried by the arrow keys passes THROUGH columns. Arming the beat
     on the lane change fired a full false completion mid-gesture — flight,
     receipt and all — for a card the operator had not put down yet. */
  if (lane === "done" && was !== "done" && !preview) {
    const wasLate = timeOf(task).kind === "overdue";
    task.prevLane = was;
    const node = document.querySelector('.card[data-id="' + id + '"]');
    flyFrom = node ? node.getBoundingClientRect() : null;
    flyId = id;
    flyWas = node ? node.cloneNode(true) : null;
    flyHome = (() => {
      if (!node || !node.parentElement) return null;
      const tray = node.closest(".tray[data-lane]");
      const kin = [...node.parentElement.children].filter((n) => n.classList.contains("card"));
      return tray ? { lane: tray.dataset.lane, index: kin.indexOf(node), height: flyFrom ? flyFrom.height : 0 } : null;
    })();
    flyCounts = readTallies(window.__SUITE.host("tasks"));
    report = { completed: true, wasLate: wasLate };
  }
  applyLaneFacts(task, was, lane);
  rows.splice(from, 1);
  task.lane = lane;
  /* Splice it in beside the card it was placed against, so the order the
     operator sees is the order that is kept. */
  const target = tasksFor(lane)[index];
  const at = target ? rows.findIndex((t) => t.id === target.id) : -1;
  if (at === -1) rows.push(task);
  else rows.splice(at, 0, task);
  if (report.completed) {
    report.cleared = report.wasLate && !allTasks().some((t) => timeOf(t).kind === "overdue");
  }
  return report;
}

/* The tail every completion shares, whichever door it came through. There
   were three doors and only one of them spoke: a tick said "Nothing is
   overdue", while the same task moved by the menu or dropped by hand said
   nothing and let the chip vanish silently — which is the exact behaviour
   the beat was written to replace. One receipt, one sentence, one release of
   the filter, called from every route that finishes work. */
function completed(task, cleared) {
  arm({ kind: "done", id: task.id, title: task.title, cleared: cleared });
  if (lateOnly && !allTasks().some((t) => timeOf(t).kind === "overdue")) {
    lateOnly = false;
    say(task.title + " done. Nothing is overdue, so the filter is off.");
    return;
  }
  say(cleared
    ? task.title + " done. Nothing is overdue."
    : task.title + " done. Press " + MOD + "Z to undo.");
}

/* Finishing a task was a silent teleport to a column a thousand pixels away,
   and on a phone to a column that is off screen entirely. The card now
   travels the distance it actually moved, measured after the repaint. */
/* The numbers as they read at this instant, so the board can go on saying them
   while the card is still in the air. */
/* The whole answer, not two selectors' worth. Holding only .trayCount and the
   ratio left the chips, the undated count and the filter state answering at
   take-off while the counts waited for the landing — three staggered answers
   to one act, and a filter that cleared mid-flight replayed a board that no
   longer existed.
   THE RULE: everything the board says about a gesture is held together, or
   none of it is. */
function readTallies(scope) {
  if (!scope) return null;
  const facts = scope.querySelector(".headFacts");
  return {
    facts: facts ? facts.innerHTML : null,
    counts: [...scope.querySelectorAll(".trayCount")].map((n) => n.innerHTML),
    /* The shape of the board this answer belongs to. Holding an answer over a
       board that has changed shape underneath replays a filter that is no
       longer on, so the header insists work is hidden while the work is
       visibly back. */
    filtered: filtering(),
  };
}

function writeTallies(scope, t) {
  if (!scope || !t) return;
  const facts = scope.querySelector(".headFacts");
  if (facts && t.facts !== null && facts.innerHTML !== t.facts) facts.innerHTML = t.facts;
  const counts = [...scope.querySelectorAll(".trayCount")];
  if (counts.length === t.counts.length) {
    counts.forEach((n, i) => { if (n.innerHTML !== t.counts[i]) n.innerHTML = t.counts[i]; });
  }
}

function flyCompleted(target) {
  const was = flyFrom;
  const id = flyId;
  flyFrom = null;
  flyId = null;
  if (!was || !id) return 0;
  const node = target.querySelector('.card[data-id="' + id + '"]');
  if (!node) return 0;
  /* The travel is right either way — the card should fly back — but the
     check only draws on a card that is actually finished. */
  /* The second half of the gesture, on the real card: it arrives still carrying
     the lift it travelled with, and sets down onto its own flat hairline. */
  const land = () => {
    if (!node.hasAttribute("data-done")) return;
    node.setAttribute("data-just-done", "");
    /* Animated rather than transitioned. A transition needs a committed
       before-change frame, and inside the landing frame there is not one to be
       had — the card snapped flat every time. The same mechanism the journey
       uses, so the whole gesture is driven one way. */
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cs = getComputedStyle(node);
    const lift = cs.getPropertyValue("--lift").trim();
    const rest = cs.getPropertyValue("--card-rest").trim();
    if (lift && rest) {
      node.animate(
        [{ boxShadow: lift }, { boxShadow: rest }],
        { duration: 320, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      );
    }
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { land(); return 0; }
  let now = node.getBoundingClientRect();
  const board = target.querySelector(".board");
  /* The board never scrolled to the destination, so below 1360 the card flew
     into the fade and evaporated: at 1280 only 114px of Done was inside the
     scroller. Where the origin column and Done can both be on screen at once,
     the board scrolls first and the card flies to a place that exists. Where
     they cannot — 768 and 390, measured — it does not, because sweeping the
     operator a thousand pixels away from the column they are working in, for
     one tick, is a worse answer than a short flight. */
  if (board && board.scrollWidth > board.clientWidth) {
    const gap = board.scrollWidth - board.clientWidth;
    const box = board.getBoundingClientRect();
    const needed = now.right - (box.right - 8);
    /* The origin must still be on screen after the scroll — partly is enough,
       the operator needs to see where the card came from, not all of it. */
    if (needed > 0 && was.left - needed + was.width > box.left + 24) {
      board.scrollLeft = Math.min(board.scrollLeft + needed, gap);
      now = node.getBoundingClientRect();
    }
  }
  if (board) {
    /* Never past the sheet's own edge: on a phone the destination column is
       off screen, and a ghost that exits the viewport reads as a bug. */
    const box = board.getBoundingClientRect();
    const left = Math.min(Math.max(now.left, box.left + 8), box.right - now.width - 8);
    if (left !== now.left) now = { left: left, top: now.top, width: now.width, height: now.height };
  }
  /* The strip is rendered with everything else and held back visually, so the
     black bar stops answering a quarter of a second before the gesture that
     caused it has finished. */
  const strip = target.querySelector(".carry");
  if (strip) strip.setAttribute("data-waiting", "");
  /* The column the card left holds its hole open until the card is somewhere
     else — whether it travels there or sets down where it is. Resolved in the
     FRESH dom by lane and index, because the element captured before the
     repaint no longer exists: innerHTML replaced it. */
  const home = flyHome;
  flyHome = null;
  const hole = document.createElement("div");
  hole.setAttribute("data-hole", "");
  hole.style.height = was.height + "px";
  if (home) {
    const body = target.querySelector('.tray[data-lane="' + home.lane + '"] .trayBody');
    if (body) {
      const kin = [...body.children].filter((n) => n.classList.contains("card"));
      body.insertBefore(hole, kin[home.index] || null);
    }
  }
  const releaseHole = () => { hole.remove(); if (strip) strip.removeAttribute("data-waiting"); };

  const dx = was.left - now.left;
  const dy = was.top - now.top;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { releaseHole(); land(); return 0; }
  /* When the destination column cannot be brought on screen — a phone, or any
     board narrow enough that Done is off the sheet — the card used to be
     clamped to the edge and evaporate into the fade, so the one designed
     moment in the product simply did not exist below 1290px. It sets down
     where the hand is instead. The eye is on the tick; the beat belongs there,
     and it needs no transport to exist. */
  const seen = board && now.left >= board.getBoundingClientRect().left - 1 &&
    now.right <= board.getBoundingClientRect().right + 1;
  if (board && !seen) {
    const inPlace = document.createElement("div");
    inPlace.className = "cardFly";
    inPlace.style.left = was.left + "px";
    inPlace.style.top = was.top + "px";
    inPlace.style.width = was.width + "px";
    inPlace.style.height = was.height + "px";
    const still = (flyWas || node).cloneNode(true);
    flyWas = null;
    still.className = node.className.replace(/ ?data-[a-z-]+/g, "") + " cardGhost";
    still.removeAttribute("data-done");
    still.removeAttribute("id");
    inPlace.appendChild(still);
    document.body.appendChild(inPlace);
    node.style.opacity = "0";
    still.animate(
      [
        { transform: "scale(1) rotate(0deg)", boxShadow: "var(--card-rest)", offset: 0 },
        { transform: "scale(1.03) rotate(-1.4deg)", boxShadow: "var(--lift)", offset: 0.28 },
        { transform: "scale(1) rotate(0deg)", boxShadow: "0 0 0 1px var(--line-soft)", offset: 1 },
      ],
      { duration: 380, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" },
    ).addEventListener("finish", () => {
      inPlace.remove();
      node.style.opacity = "";
      releaseHole();
      land();
    });
    setTimeout(() => {
      if (!inPlace.isConnected) return;
      inPlace.remove();
      node.style.opacity = "";
      releaseHole();
      land();
    }, 520);
    return 380;
  }

  /* --motion-fast governs a state change; this is a journey across the
     sheet, and a fixed 260ms reads as a teleport at 1000px and as a lag at
     120px. Stated here rather than added to the token ladder. */
  const travel = Math.round(Math.min(460, Math.max(220, 170 + Math.hypot(dx, dy) * 0.22)));

  /* The journey and the weight are two animations on two elements, because
     they want different easings and both want `transform`. The shell carries
     the distance on the product's own curve; the card inside it carries the
     lift. Sampled at 16ms the old flight was a rigid rectangle sliding
     dead-level with a constant shadow — nothing lifted, nothing arrived.
     The shell also grows from the size the card was to the size it will be:
     a 234x136 ghost handing off to a 233x155 node put a 19px snap on the one
     frame that matters. */
  const shell = document.createElement("div");
  shell.className = "cardFly";
  shell.setAttribute("aria-hidden", "true");
  shell.style.left = was.left + "px";
  shell.style.top = was.top + "px";
  shell.style.width = was.width + "px";
  shell.style.height = was.height + "px";
  /* The card it was, not the card it has become. */
  const ghost = (flyWas || node).cloneNode(true);
  flyWas = null;
  ghost.className = node.className.replace(/ ?data-[a-z-]+/g, "") + " cardGhost";
  ghost.removeAttribute("data-done");
  ghost.removeAttribute("data-just-done");
  ghost.removeAttribute("id");
  shell.appendChild(ghost);
  document.body.appendChild(shell);
  /* opacity, never visibility: visibility:hidden blurs whatever is inside it,
     and a completion must never cost the operator their place. An opacity-0
     ancestor does take the focus ring with it, so when focus is inside the
     card the RING travels on the ghost instead — the operator sees where they
     are, on the object that is moving. */
  if (node.contains(document.activeElement)) ghost.setAttribute("data-carries-focus", "");
  node.style.opacity = "0";
  /* The board used to publish the whole result on frame zero and then spend
     400ms transporting an object that was already finished — a lap of honour
     delivering news it had already announced. Every tally goes back to what it
     said before the tick and stays there until the card arrives.
     THE RULE: no consequence of a gesture is shown before the gesture that
     causes it has finished. */
  const held = flyCounts;
  flyCounts = null;
  /* The true values are read before the old ones are written over them —
     re-reading afterwards would only find what was just put there. */
  const truth = held ? readTallies(target) : null;
  /* Only replayed when the board's shape has not changed underneath: a filter
     that cleared on this very tick would otherwise be re-drawn over a board
     that no longer has it. */
  const sameShape = held && truth &&
    held.counts.length === truth.counts.length &&
    held.filtered === truth.filtered;
  if (sameShape) writeTallies(target, held);

  const journey = shell.animate(
    [
      { transform: "translate(0px, 0px)", width: was.width + "px", height: was.height + "px" },
      { transform: "translate(" + -dx + "px," + -dy + "px)", width: now.width + "px", height: now.height + "px" },
    ],
    { duration: travel, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" },
  );
  /* THE SET-DOWN.
     The product's one memorable moment, and the only place the founder's own
     configuration is spoken out loud: an open card floats, a finished card has
     settled. Work in motion is carried and slightly askew — the -1.4deg a
     pointer-dragged card already uses — and finished work squares up and comes
     to rest flat.
     So the card leaves lifted and tilted, straightens through the last fifth of
     the journey, and lands square. It does NOT land flat: the shadow it still
     carries at the moment of arrival is what the real card then sets down from,
     in place, so the settle happens on the object the operator is looking at
     rather than on a ghost that is removed. No colour, no bounce, no
     celebration, one duration and one curve — the motion contract is intact and
     this spends nothing it did not already own. */
  ghost.animate(
    [
      /* Offsets are chosen against the DISTANCE the journey covers, not the
         clock. Its ease-out puts 70% of the travel in the first fifth of the
         time, so a tilt held to 20-78% of the clock only reached full angle
         once the card had effectively arrived, and read as a wobble at the
         destination rather than as something being carried. */
      { transform: "scale(1) rotate(0deg)", boxShadow: "var(--card-rest)", offset: 0 },
      { transform: "scale(1.03) rotate(-1.4deg)", boxShadow: "var(--lift)", offset: 0.05 },
      { transform: "scale(1.03) rotate(-1.4deg)", boxShadow: "var(--lift)", offset: 0.25 },
      { transform: "scale(1) rotate(0deg)", boxShadow: "var(--lift)", offset: 0.62 },
      { transform: "scale(1) rotate(0deg)", boxShadow: "var(--lift)", offset: 1 },
    ],
    { duration: travel, easing: "linear", fill: "forwards" },
  );

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    shell.remove();
    releaseHole();
    node.style.opacity = "";
    /* The result arrives with the card. */
    if (sameShape) writeTallies(target, truth);
    land();
    /* The board's answer arrives with the card, not 400ms before it. The
       count used to flip at take-off while the check drew on landing, which
       is what made the two read as unrelated events. */
    const scope = window.__SUITE.host("tasks");
    if (scope) {
      const beat = scope.querySelector('.tray[data-lane="done"] .trayCount');
      if (beat) { beat.removeAttribute("data-changed"); beat.getBoundingClientRect(); beat.setAttribute("data-changed", ""); }
      scope.querySelectorAll(".headFacts .ratio b").forEach((b) => {
        b.removeAttribute("data-changed"); b.getBoundingClientRect(); b.setAttribute("data-changed", "");
      });
    }
  };
  journey.addEventListener("finish", finish);
  /* An animation that never fires must not leave the card invisible. */
  setTimeout(finish, travel + 140);
  return travel;
}

const history = [];
let undoing = false;

function clearUndo() {
  clearTimeout(undoTimer);
  undone = null;
}

/* One reversible act at a time, with the strip as its face. Arming it here
   rather than at each call site means every route to a change — the tick,
   the menu, a drop — inherits the same model. */
function arm(act) {
  if (undoing) return;
  clearTimeout(undoTimer);
  history.push(act);
  if (history.length > 10) history.shift();
  undone = act;
  /* The strip retires; the record does not. Nothing that used to be true
     stops being true because six seconds passed. */
  undoTimer = setTimeout(() => { undone = null; mount(); }, 6000);
}

/* Suspended while the operator is reading or reaching for it — the strip
   used to vanish mid-decision and drop focus to the top of the document. */
function holdUndo() { clearTimeout(undoTimer); }
function releaseUndo() {
  /* Re-time the strip; do not re-record the act. arm() pushes, so this used
     to add a phantom entry on every pointer pass over the strip. */
  if (!undone) return;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { undone = null; mount(); }, 6000);
}

function toggleDone(id) {
  const task = taskById(id);
  if (!task) return;
  const target = window.__SUITE.host("tasks");
  const node = target && target.querySelector('.card[data-id="' + id + '"]');
  flyFrom = node ? node.getBoundingClientRect() : null;
  flyId = id;
  /* The clone is taken here, BEFORE the state changes. Taken after, it carried
     the arrival state: it inherited `background: transparent` from a finished
     card and flew as a see-through rectangle under the product's heaviest
     shadow, with its check already drawn — which the landing then un-drew and
     redrew, so the climax frame was a blank black disc.
     THE RULE: a node cloned into an overlay renders the state it is LEAVING. */
  flyWas = node ? node.cloneNode(true) : null;
  /* Where it left FROM. Resolved after the repaint, node.parentElement is the
     column it has already arrived in, so the placeholder meant to hold the
     origin open was being inserted at the top of the destination — the origin
     collapsed on frame one exactly as before, and the destination was held
     18px low for the whole flight and snapped back on the landing frame.
     THE RULE: a placeholder standing in for a moved element is inserted into
     the container it LEFT, from a parent and sibling captured before the
     state change and before the re-render. */
  flyHome = (() => {
    if (!node || !node.parentElement) return null;
    const tray = node.closest(".tray[data-lane]");
    const kin = [...node.parentElement.children].filter((n) => n.classList.contains("card"));
    return tray ? { lane: tray.dataset.lane, index: kin.indexOf(node), height: flyFrom ? flyFrom.height : 0 } : null;
  })();
  flyCounts = readTallies(target);

  if (task.lane === "done") {
    /* Back to where it actually came from, never to the first column. */
    const known = Boolean(task.prevLane);
    const back = task.prevLane || B.columns[0].id;
    const wasCompletedAt = task.completedAt;
    task.lane = back;
    task.prevLane = null;
    task.completedAt = null;
    for (let i = history.length - 1; i >= 0; i -= 1) {
      /* The stack must not go on offering to redo something already undone. */
      if (history[i].id === id && history[i].kind === "done") history.splice(i, 1);
    }
    /* Every card that was already Done when the board opened has no prevLane,
       so the fallback put it in column one and the product announced "is back
       in To do" about a card that had never been there. It only claims a
       return when there is a return to claim. */
    arm({ kind: "undone", id: id, title: task.title, lane: back, wasCompletedAt: wasCompletedAt });
    say(known
      ? task.title + " is back " + inLane(back) + "."
      : task.title + " is no longer done. It is " + inLane(back) + ".");
  } else {
    const wasLate = timeOf(task).kind === "overdue";
    task.prevLane = task.lane;
    task.lane = "done";
    task.completedAt = TODAY;
    /* The one fact on this board with any weight behind it is what is late.
       Clearing the last of it is the moment a venue operator is actually
       working toward on a Saturday, and the board used to mark it by silently
       removing a chip. It says it, once, in furniture already on screen. */
    completed(task, wasLate && !allTasks().some((t) => timeOf(t).kind === "overdue"));
  }
  /* A checkbox must not move focus off itself on toggle. */
  refocusPart = document.activeElement && document.activeElement.classList.contains("tick") ? "tick" : null;
  /* Clearing the last overdue task while filtered used to leave an empty
     board behind a control that had just disappeared. */
  if (lateOnly && !allTasks().some((t) => timeOf(t).kind === "overdue")) {
    lateOnly = false;
    say(task.title + " done. Nothing is overdue, so the filter is off.");
  }
  focusId = id;
  refocus = true;
  mount();
}

function undoLast() {
  const act = history.pop();
  if (!act) { say("Nothing left to undo."); return; }
  clearUndo();
  undoing = true;
  try { runUndo(act); } finally { undoing = false; }
  /* The strip now shows whatever is left beneath, so the operator can see
     the way back is still open. */
  if (history.length) { undone = history[history.length - 1]; clearTimeout(undoTimer);
    undoTimer = setTimeout(() => { undone = null; mount(); }, 6000); }
  mount();
}

function runUndo(act) {
  if (act.kind === "add") {
    const rows = allTasks();
    const at = rows.findIndex((t) => t.id === act.id);
    if (at !== -1) rows.splice(at, 1);
    say(act.title + " removed again.");
    mount();
    return;
  }
  if (act.kind === "day") {
    act.ids.forEach((row) => { const t = taskById(row.id); if (t) t.dueAt = row.dueAt; });
    clearUndo();
    say(act.count === 1
      ? (act.title || "The task") + " has no day again."
      : act.count + " tasks have no day again.");
    mount();
    return;
  }
  if (act.kind === "done") { toggleDone(act.id); return; }
  /* Reopening was the one act with no way back, so the only route was the
     tick — which stamped today's date over the day the work was actually
     finished. The original date rides in the receipt and is put back. */
  if (act.kind === "undone") {
    const row = taskById(act.id);
    if (row) {
      const node = document.querySelector('.card[data-id="' + act.id + '"]');
      flyFrom = node ? node.getBoundingClientRect() : null;
      flyId = act.id;
      row.lane = "done";
      row.prevLane = act.lane;
      row.completedAt = act.wasCompletedAt;
    }
    clearUndo();
    focusId = act.id;
    refocus = true;
    say((row ? row.title : "The task") + " is done again.");
    mount();
    return;
  }
  const task = taskById(act.id);
  flyFrom = document.querySelector('.card[data-id="' + act.id + '"]');
  flyFrom = flyFrom ? flyFrom.getBoundingClientRect() : null;
  flyId = act.id;
  moveTo(act.id, act.lane, act.index);
  /* Restored after the move, because moveTo re-stamps both on entry. */
  const back = taskById(act.id);
  if (back && act.wasHeldSince !== undefined) back.heldSince = act.wasHeldSince;
  if (back && act.wasCompletedAt !== undefined) back.completedAt = act.wasCompletedAt;
  focusId = act.id;
  refocus = true;
  say((task ? task.title : "The task") + " is back " + inLane(act.lane) + ".");
}

function walk(dx, dy) {
  const at = place(focusId);
  if (!at) return;
  if (dy) {
    const next = at.rows[at.y + dy];
    if (next) focusId = next.id;
    return;
  }
  const lanes = laneIds();
  for (let x = at.x + dx; x >= 0 && x < lanes.length; x += dx) {
    const rows = tasksFor(lanes[x]);
    if (rows.length) { focusId = rows[Math.min(at.y, rows.length - 1)].id; return; }
  }
}

/* One card in hand is the product's most stateful moment and nothing ended it:
   Tab away, complete another card with the pointer, open the composer or the
   Planning drawer, and the carry ran on — two identical indigo rings on two
   cards at once, a foot pill printing instructions that no longer worked, and
   a completion refused its Undo strip because the pill still owned the slot.
   The hand ends where the operator's attention goes. */
function endCarry() {
  if (!carriedId) return false;
  const task = taskById(carriedId);
  const at = place(carriedId);
  const lane = at ? laneIds()[at.x] : null;
  carriedId = null; carriedFrom = null; overLane = null;
  if (task && lane) say(task.title + " put down " + inLane(lane) + ".");
  return true;
}

function carryMove(dx, dy) {
  const at = place(carriedId);
  if (!at) return;
  focusId = carriedId;
  const lanes = laneIds();
  if (dy) {
    const to = Math.max(0, Math.min(at.rows.length - 1, at.y + dy));
    if (to === at.y) return;
    moveTo(carriedId, lanes[at.x], to, true);
    say("Position " + (to + 1) + " of " + at.rows.length + " " + inLane(lanes[at.x]) + ".");
    return;
  }
  const x = at.x + dx;
  if (x < 0 || x >= lanes.length) return;
  const rows = tasksFor(lanes[x]);
  moveTo(carriedId, lanes[x], Math.min(at.y, rows.length), true);
  say(laneName(lanes[x]) + ", position " + (Math.min(at.y, rows.length) + 1) + " of " + (rows.length + 1) + ".");
}

/* Every surface that opens gives focus back to what opened it. */
function returnFromDrawer() {
  const target = window.__SUITE.host("tasks");
  const back = drawerFrom && target.querySelector(drawerFrom);
  drawerFrom = null;
  picked.clear();
  if (back) back.focus({ preventScroll: true });
}

function closeMenu() {
  if (!menuFor) return false;
  const id = menuFor;
  menuFor = null;
  focusId = id;
  refocus = true;
  mount();
  return true;
}

/* Every exit puts the operator back on the control they opened it from, or
   on the board's own tab stop. Nothing may drop them on <body>. */
function leaveDraft() {
  const target = window.__SUITE.host("tasks");
  let back = draftFrom && target.querySelector(draftFrom);
  draftFrom = null;
  /* Closing the composer is what empties the column, and under a filter an
     empty column collapses — so the very control focus is returning to can
     vanish in the same repaint, dropping the operator on <body>. Focus goes
     to the nearest control still on screen instead. */
  if (back && !back.offsetParent) {
    back = [...target.querySelectorAll(".trayAdd")].find((n) => n.offsetParent) || null;
  }
  if (back) back.focus({ preventScroll: true });
  else {
    const stop = target.querySelector('.card[tabindex="0"]');
    if (stop) stop.focus({ preventScroll: true });
  }
}

function discardDraft() {
  draftLane = null;
  draftText = "";
  say("Discarded.");
  mount();
  leaveDraft();
}

function commitDraft(field, repeat) {
  const title = (field ? field.textContent : draftText).trim().replace(/\s+/g, " ");
  const lane = draftLane;
  draftLane = null;
  draftText = "";
  if (!title) { say("Nothing added."); mount(); leaveDraft(); return; }
  seq += 1;
  const id = "new-" + seq;
  const rows = allTasks();
  const before = tasksFor(lane).length ? tasksFor(lane)[tasksFor(lane).length - 1] : null;
  const task = { id: id, title: title, lane: lane, tag: "", priority: "", comments: 0 };
  /* The create path used to skip the lane's own facts, so a task typed
     straight into Done arrived with no completion date — a receipt-less card
     in the column that exists to be the venue's memory. */
  applyLaneFacts(task, null, lane);
  const at = before ? rows.findIndex((t) => t.id === before.id) + 1 : rows.length;
  rows.splice(at, 0, task);
  arm({ kind: "add", id: id, title: title, toLane: lane });
  focusId = id;
  refocus = true;
  if (lateOnly && timeOf(task).kind !== "overdue") {
    lateOnly = false;
    say(title + " added " + toLane(lane) + ". The overdue filter is off so you can see it.");
  } else {
    say(title + " added " + toLane(lane) + ". Press " + MOD + "Z to undo.");
  }
  /* The run continues: a fresh line opens under the one just added, caret
     already in it, so six tasks cost six sentences and one Escape. A commit
     that came from focus leaving does NOT continue the run — the operator has
     looked away, and opening a fresh composer behind them is how a board ends
     up holding a draft nobody asked for. */
  if (repeat === false) { mount(); return; }
  draftLane = lane;
  mount();
  const next = document.querySelector(".card[data-draft] .cardTitle");
  if (next) next.focus();
}

function onKey(event) {
  const key = event.key;
  if (groupKeys(event)) return;

  /* A menu is one tab stop and the arrows walk it, which is what role="menu"
     promises and what this one was not doing. */
  const menu = event.target.closest && event.target.closest(".cardMenu");
  if (menu && (key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End")) {
    event.preventDefault();
    const items = [...menu.querySelectorAll("button")];
    const at = items.indexOf(document.activeElement);
    const next = key === "Home" ? 0
      : key === "End" ? items.length - 1
      : (at + (key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
    items.forEach((n, i) => n.setAttribute("tabindex", i === next ? "0" : "-1"));
    items[next].focus();
    return;
  }

  /* The draft owns Enter and Escape while it is open; nothing else does. */
  const field = event.target.closest && event.target.closest(".card[data-draft] .cardTitle");
  if (field) {
    if (key === "Enter") { event.preventDefault(); commitDraft(field); return; }
    if (key === "Escape") { event.preventDefault(); discardDraft(); return; }
    return;
  }

  /* Board-wide keys, live wherever focus is inside the sheet. */
  if ((event.metaKey || event.ctrlKey) && (key === "k" || key === "K")) {
    /* The pill prints this key, so the key has to answer — with the same
       sentence the pill's own tooltip carries. */
    event.preventDefault();
    say("Search arrives with the other views.");
    return;
  }
  if ((event.metaKey || event.ctrlKey) && (key === "z" || key === "Z")) {
    event.preventDefault();
    undoLast();
    return;
  }
  if (key === "Escape") {
    /* Innermost first: menu, carried card, open note, then the filters in
       the order they were most likely just set, then the drawer. */
    if (dayFor) { event.preventDefault(); dayFor = null; mount(); return; }
    if (closeMenu()) { event.preventDefault(); return; }
    if (carriedId) {
      event.preventDefault();
      const title = taskById(carriedId).title;
      moveTo(carriedId, carriedFrom.lane, carriedFrom.index);
      say("Move cancelled. " + title + " is back " + inLane(carriedFrom.lane) + ".");
      carriedId = null; carriedFrom = null;
      refocus = true; mount(); return;
    }
    if (openNoteId) {
      event.preventDefault();
      focusId = openNoteId;
      openNoteId = null;
      say("Note closed.");
      refocus = true; mount(); return;
    }
    if (clientOnly || lateOnly || todayOnly) {
      event.preventDefault();
      if (clientOnly) clientOnly = null;
      else if (lateOnly) lateOnly = false;
      else todayOnly = false;
      say(filterSentence());
      mount(); return;
    }
    if (state === "planning") {
      event.preventDefault();
      state = "board";
      say("Planning closed.");
      mount();
      returnFromDrawer();
      return;
    }

  }

  const card = event.target.closest && event.target.closest(".card[data-id]");
  if (!card) return;

  /* The card's own controls answer for themselves. Before this, Space on a
     checkbox picked the card up and Enter on the actions menu completed the
     task — a labelled control doing an unrelated, unannounced thing. */
  if (event.target.closest(".tick, .cardDots, .who") && (key === " " || key === "Spacebar" || key === "Enter")) return;

  const id = card.dataset.id;
  const DIR = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  /* The tab stop is always the card the operator is on. */
  focusId = id;

  if (key === " " || key === "Spacebar") {
    event.preventDefault();
    if (carriedId === id) {
      const at = place(id);
      const task = taskById(id);
      const lane = laneIds()[at.x];
      /* The fourth door into a completion. Walking a card into Done with the
         arrows and dropping it there finishes the work exactly as the tick
         does, so it earns the same receipt and the same sentence — it used
         to say only "dropped in Done." */
      if (lane === "done" && carriedFrom.lane !== "done") {
        completed(task, !allTasks().some((t) => timeOf(t).kind === "overdue"));
      } else {
        say(task.title + " dropped " + inLane(lane) + ".");
      }
      carriedId = null; carriedFrom = null;
    } else {
      const at = place(id);
      carriedId = id;
      carriedFrom = { lane: laneIds()[at.x], index: at.y };
      say("Picked up " + taskById(id).title + ".");
    }
    refocus = true; mount(); return;
  }

  if (key === "Enter") {
    event.preventDefault();
    if (!card.hasAttribute("aria-expanded")) { say("There is no note on this task yet."); return; }
    openNoteId = openNoteId === id ? null : id;
    say(openNoteId ? "Showing the whole note." : "Note closed.");
    refocus = true; mount(); return;
  }
  if (DIR[key]) {
    event.preventDefault();
    if (carriedId === id) carryMove(DIR[key][0], DIR[key][1]);
    else walk(DIR[key][0], DIR[key][1]);
    refocus = true; mount();
  }
}

function onClick(event) {
  const off = event.target.closest && event.target.closest('[aria-disabled="true"]');
  if (off) {
    /* Hover is not available to a thumb, so the reason is spoken and shown. */
    event.preventDefault();
    say(off.getAttribute("title") || "Not here yet.");
    return;
  }
  const act = event.target.closest && event.target.closest("[data-act]");
  const what = act && act.dataset.act;

  if (what === "tick") {
    event.preventDefault();
    toggleDone(act.closest(".card").dataset.id);
    return;
  }
  if (what === "client") {
    const name = act.dataset.client;
    clientOnly = clientOnly === name ? null : name;
    say(filterSentence());
    mount();
    return;
  }
  if (what === "late") {
    lateOnly = !lateOnly;
    if (lateOnly) todayOnly = false;
    say(filterSentence());
    mount();
    return;
  }
  if (what === "today") {
    /* The two time chips interrogate one single-valued field, so composing
       them could only ever return the empty set — the board emptied itself
       and stated a logical impossibility as if it were a result. They are one
       two-position question. The couple stays the dimension that composes. */
    todayOnly = !todayOnly;
    if (todayOnly) lateOnly = false;
    say(filterSentence());
    mount();
    return;
  }
  if (what === "showall") {
    lateOnly = false;
    clientOnly = null;
    todayOnly = false;
    say("Showing all work.");
    mount();
    return;
  }
  if (what === "undo") { undoLast(); return; }
  if (what === "planning") {
    endCarry();
    /* The drawer is the only surface where a task can be given a day, and it
       was reachable only by editing the URL. */
    const opening = state !== "planning";
    state = opening ? "planning" : "board";
    if (opening) {
      drawerFrom = act.closest(".headActions") ? ".headActions [data-act='planning']"
        : act.classList.contains("undated") ? ".undated" : null;
    }
    say(opening ? "Planning open." : "Planning closed.");
    mount();
    if (opening) {
      const aside = document.querySelector(".drawer");
      if (aside) aside.focus({ preventScroll: true });
    } else { returnFromDrawer(); }
    return;
  }
  if (what === "drawerTab") {
    drawerTab = act.dataset.tab;
    picked.clear();
    say(drawerTab === "milestones" ? "Milestones." : "Tasks with no date.");
    mount();
    const back = document.querySelector('.drawerTab[data-tab="' + drawerTab + '"]');
    if (back) back.focus({ preventScroll: true });
    return;
  }
  if (what === "pick") {
    const id = act.dataset.id;
    if (picked.has(id)) picked.delete(id); else picked.add(id);
    mount();
    const back = document.querySelector('.box[data-id="' + id + '"]');
    if (back) back.focus({ preventScroll: true });
    return;
  }
  if (what === "selectAll") {
    const rows = drawerTab === "milestones" ? milestoneTasks() : undatedTasks();
    const all = rows.length && rows.every((t) => picked.has(t.id));
    picked.clear();
    if (!all) rows.forEach((t) => picked.add(t.id));
    say(picked.size ? picked.size + " picked." : "Nothing picked.");
    mount();
    const back = document.querySelector(".selectAll");
    if (back) back.focus({ preventScroll: true });
    return;
  }
  if (what === "commit") {
    const field = document.querySelector(".card[data-draft] .cardTitle");
    if (field) commitDraft(field);
    return;
  }
  if (what === "discard") { discardDraft(); return; }
  if (what === "add") {
    draftLane = act.dataset.lane;
    draftText = "";
    draftFrom = act.dataset.act === "add" && act.classList.contains("dockPrimary")
      ? ".dockPrimary" : '.tray[data-lane="' + act.dataset.lane + '"] .trayAdd';
    openNoteId = null;
    say("New task " + inLane(draftLane) + ". Type it, then press Enter.");
    mount();
    const field = document.querySelector(".card[data-draft] .cardTitle");
    if (field) field.focus();
    return;
  }
  if (what === "menu") {
    const card = act.closest(".card");
    const box = act.getBoundingClientRect();
    const host = window.__SUITE.host("tasks");
    const frame = host.getBoundingClientRect();
    /* Anchored to the control, kept inside the sheet. */
    const left = Math.min(box.left - frame.left, frame.width - 200);
    const top = Math.min(box.bottom - frame.top + 6, frame.height - 250);
    menuAt = "left:" + Math.max(8, Math.round(left)) + "px;top:" + Math.round(top) + "px";
    menuFor = menuFor === card.dataset.id ? null : card.dataset.id;
    focusId = card.dataset.id;
    mount();
    /* The declared roving stop and the actual focus must agree, or Enter
       straight after opening means "move to the first column". */
    const first = document.querySelector(".cardMenu button[aria-current]") ||
      document.querySelector(".cardMenu button");
    if (first) first.focus();
    return;
  }
  /* Opening and closing the day menu. */
  if (what === "day") {
    dayFor = dayFor === act.dataset.id ? null : act.dataset.id;
    mount();
    return;
  }
  /* Giving a task a day is the one thing this room exists to do, and for
     fourteen rounds it could not: every row's control was disabled and the
     header sent the operator here twice to be told so. It writes the same
     dueAt every chip, count and filter on the board already derives from, and
     it is reversible like every other act. */
  if (what === "setday") {
    const when = act.dataset.when;
    const iso = dayFrom(when);
    const ids = act.dataset.id === "picked" ? [...picked] : [act.dataset.id];
    const before = ids.map((id) => {
      const t = taskById(id);
      return { id: id, dueAt: t ? t.dueAt : null };
    });
    ids.forEach((id) => { const t = taskById(id); if (t) t.dueAt = iso; });
    const label = (DAYS_OFFER.find((d) => d[0] === when) || ["", when])[1].toLowerCase();
    arm({ kind: "day", ids: before, title: ids.length === 1 ? (taskById(ids[0]) || {}).title : null, count: ids.length, when: label });
    if (act.dataset.id === "picked") picked.clear();
    dayFor = null;
    say(ids.length === 1
      ? (before[0].id && taskById(before[0].id) ? taskById(before[0].id).title : "The task") + " is due " + label + ". Press " + MOD + "Z to undo."
      : ids.length + " tasks are due " + label + ". Press " + MOD + "Z to undo.");
    mount();
    return;
  }
  if (what === "moveto") {
    const id = menuFor;
    const lane = act.dataset.lane;
    /* The item marked "here" is the one that says the card is already where
       it is. Clicking it used to splice the card to the top of its own
       column, announce a move nobody asked for and arm an undo for it — so
       opening the menu to check a card's place, then dismissing it the
       obvious way, silently lost that place. It dismisses. */
    const standing = taskById(id);
    if (standing && standing.lane === lane) { closeMenu(); return; }
    const at = place(id);
    const task = taskById(id);
    const from = at ? { lane: laneIds()[at.x], index: at.y } : null;
    const did = moveTo(id, lane, 0);
    if (lane === "done") {
      completed(task, did && did.cleared);
    } else {
      if (from) arm({ kind: "move", id: id, title: task.title, lane: from.lane, index: from.index, toLane: lane });
      say(task.title + " moved " + toLane(lane) + ".");
    }
    menuFor = null;
    focusId = id;
    refocus = true;
    mount();
    return;
  }

  if (what === "closemenu") { closeMenu(); return; }

  /* Clicking the card was the obvious thing it looked like and did nothing,
     while the half of the note that carries the deadline was unreachable by
     keyboard and on touch. */
  const card = event.target.closest && event.target.closest(".card[data-id]");
  if (!card || !card.closest(".board")) return;
  /* Finishing a selection is not a click on the card. */
  if (String(getSelection())) return;
  focusId = card.dataset.id;
  if (!card.hasAttribute("aria-expanded")) { say("There is no note on this task yet."); return; }
  openNoteId = openNoteId === card.dataset.id ? null : card.dataset.id;
  refocus = true;
  say(openNoteId ? "Showing the whole note." : "Note closed.");
  mount();
}

/* The pointer gets the same model as the keyboard: the tray it is over
   warms half a step and draws the line the card will land on. */
let overLane = null;
let edgeFrame = 0;
let snapWas = null;

/* Holding a card at the edge of the board walks it across. Without this, at
   768 the reachable targets were the first three columns only, and the
   board's defining gesture could not finish a task's journey. */
function edgeScroll(board, x) {
  const box = board.getBoundingClientRect();
  const near = 64;
  const step = x < box.left + near ? -14 : x > box.right - near ? 14 : 0;
  cancelAnimationFrame(edgeFrame);
  edgeFrame = 0;
  if (!step) return;
  const run = () => {
    board.scrollLeft += step;
    edgeFrame = requestAnimationFrame(run);
  };
  edgeFrame = requestAnimationFrame(run);
}
function stopEdge(board) {
  cancelAnimationFrame(edgeFrame);
  edgeFrame = 0;
  if (board && snapWas !== null) { board.style.scrollSnapType = snapWas; snapWas = null; }
}

function onDragStart(event) {
  const card = event.target.closest && event.target.closest(".card[data-id]");
  if (!card || !card.closest(".board")) return;
  /* The whole card is draggable, so the browser's 4px drag threshold was
     eating the product's two defining gestures. Measured: a press and release
     with 4px of travel on the completion circle produced nothing at all — no
     tick, no flight, no undo strip, no announcement — and an ordinary
     trackpad tap routinely travels 2 to 6px. A control inside a card is a
     control, not a drag handle.
     The test is the control the PRESS began on, recorded at pointerdown:
     dragstart's target is the draggable card itself, never the button inside
     it, so asking the drag event was always going to answer null. */
  if (pressedControl) {
    event.preventDefault();
    return;
  }
  carriedId = card.dataset.id;
  holdUndo();
  const at = place(carriedId);
  carriedFrom = { lane: laneIds()[at.x], index: at.y };
  card.setAttribute("data-force", "drag");
  /* The product's lift was being painted on the card that STAYS, while the
     object actually moving under the hand was the browser's default drag
     bitmap, composited by the OS outside the palette. The engine snapshots the
     node as it is at this instant, so the lift is pinned into that bitmap here,
     and the node left behind becomes the vacancy it actually is next frame.
     THE RULE: the lift is drawn on exactly one node at a time, and only on the
     node that is moving. */
  if (event.dataTransfer && event.dataTransfer.setDragImage) {
    const box = card.getBoundingClientRect();
    try {
      event.dataTransfer.setDragImage(card, event.clientX - box.left, event.clientY - box.top);
    } catch (e) { /* an engine that draws its own is no worse than before */ }
  }
  requestAnimationFrame(() => {
    const still = document.querySelector('.card[data-force="drag"]');
    if (still) still.setAttribute("data-vacated", "");
  });
  /* Mandatory snap re-snaps every per-frame nudge back to zero, so it stands
     down for the length of the gesture. */
  const board = card.closest(".board");
  if (board) { snapWas = board.style.scrollSnapType; board.style.scrollSnapType = "none"; }
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", carriedId); }
}

/* The dragged card is about to be spliced out, so it must not be counted
   when resolving where the line sits. Counting it landed every downward
   reorder one slot past the line the operator was shown. */
function dropIndex(body, y) {
  const cards = [...body.querySelectorAll(".card[data-id]")].filter((c) => c.dataset.id !== carriedId);
  for (let i = 0; i < cards.length; i += 1) {
    const box = cards[i].getBoundingClientRect();
    if (y < box.top + box.height / 2) return i;
  }
  return cards.length;
}

function onDragOver(event) {
  if (!carriedId) return;
  /* The edge check runs before the tray guard: the gap between two trays and
     the sheet's own margin are exactly where the operator holds the card. */
  const board = event.target.closest && event.target.closest(".board");
  if (board) { event.preventDefault(); edgeScroll(board, event.clientX); }
  const tray = event.target.closest && event.target.closest(".tray[data-lane]");
  if (!tray) return;
  event.preventDefault();
  document.querySelectorAll(".tray[data-over]").forEach((t) => t.removeAttribute("data-over"));
  document.querySelectorAll(".dropLine").forEach((n) => n.remove());
  tray.setAttribute("data-over", "");
  const body = tray.querySelector(".trayBody");
  overLane = { lane: tray.dataset.lane, index: dropIndex(body, event.clientY) };
  /* A sorted lane gets the lane-level wash it already has and no line, because
     a line here would name a position the lane is about to overrule. */
  if (laneSorts(overLane.lane)) return;
  const line = document.createElement("span");
  line.className = "dropLine";
  const cards = [...body.querySelectorAll(".card[data-id]")].filter((c) => c.dataset.id !== carriedId);
  /* An empty lane renders a paragraph before its cards, so appending put the
     line under the copy rather than where the card lands. */
  const first = body.querySelector(".card[data-id]") || body.querySelector(".trayEmpty");
  if (!cards.length && first) body.insertBefore(line, first);
  else if (overLane.index >= cards.length) body.appendChild(line);
  else body.insertBefore(line, cards[overLane.index]);
}

function onDrop(event) {
  stopEdge(event.target.closest && event.target.closest(".board"));
  /* Between 4px and 8px of travel the browser starts a drag and never sends a
     pointerup, so the press-is-a-click guard on pointerup cannot see it:
     measured, 0-3px opened the note and 4-10px opened nothing at all, said
     nothing and armed no undo. The drop is where that press actually arrives,
     and it has to be tested BEFORE the no-move early returns, because a press
     that barely travelled is exactly the case those returns discard. */
  const back = event.target.closest && event.target.closest(".card[data-id]");
  if (pressAt && back && back.dataset.id === pressAt.id &&
      Math.hypot(event.clientX - pressAt.x, event.clientY - pressAt.y) < 8) {
    event.preventDefault();
    const id2 = pressAt.id;
    pressAt = null;
    carriedId = null; carriedFrom = null; overLane = null;
    const node = document.querySelector('.card[data-id="' + id2 + '"]');
    if (node && !node.hasAttribute("aria-expanded")) say("There is no note on this task yet.");
    if (node && node.hasAttribute("aria-expanded") && !String(getSelection())) {
      focusId = id2;
      openNoteId = openNoteId === id2 ? null : id2;
      refocus = true;
      say(openNoteId ? "Showing the whole note." : "Note closed.");
    }
    mount();
    return;
  }
  if (!carriedId || !overLane) return;
  event.preventDefault();
  const id = carriedId;
  /* Picking a card up and putting it back is a non-event. It was arming an
     undo and announcing a move. */
  if (overLane.lane === carriedFrom.lane && overLane.index === carriedFrom.index) {
    carriedId = null; carriedFrom = null; overLane = null;
    mount();
    return;
  }
  const sameLane = overLane.lane === carriedFrom.lane;
  const from = carriedFrom;
  const task = taskById(id);
  const heldWas = task ? task.heldSince : null;
  const doneWas = task ? task.completedAt : null;
  const did = moveTo(id, overLane.lane, overLane.index);
  /* A drop is the most mis-fireable gesture on a pointer board and had no
     way back; only a keyboard-carried card had Escape. */
  const finishing = overLane.lane === "done" && from.lane !== "done";
  if (finishing) {
    /* A drop into Done is a completion, exactly as the tick is — including
       the sentence and the release of a filter that now matches nothing.
       Dropping the last overdue card used to leave the operator staring at
       "All 13 are hidden." behind a chip reading "0 overdue". */
    completed(task, did && did.cleared);
  } else if (overLane.lane !== "done") {
    /* moveTo re-stamps heldSince and completedAt on entry, so a receipt that
       does not carry the old values cannot restore them — undoing a card
       dragged out of Done used to rewrite "Completed 15 Jul" to today. */
    arm({ kind: "move", id: id, title: task.title, lane: from.lane, index: from.index, toLane: overLane.lane,
          wasHeldSince: heldWas, wasCompletedAt: doneWas });
  }
  const place = tasksFor(overLane.lane);
  /* The same law in the spoken channel: a sorted lane never announces an index.
     Dragging within Done used to say "moved to position 1 of 5" for a move the
     sort discarded. */
  if (!finishing && laneSorts(overLane ? overLane.lane : from.lane)) {
    say(taskById(id).title + " is in the done column, newest first.");
  } else if (!finishing) say(sameLane
    ? taskById(id).title + " moved to position " + (overLane.index + 1) + " of " + place.length + " " + inLane(overLane.lane) + "."
    : taskById(id).title + " moved " + toLane(overLane.lane) + ".");
  focusId = id;
  carriedId = null; carriedFrom = null; overLane = null;
  mount();
}

function onDragEnd() {
  releaseUndo();
  stopEdge(document.querySelector(".board"));
  document.querySelectorAll(".tray[data-over]").forEach((t) => t.removeAttribute("data-over"));
  document.querySelectorAll(".dropLine").forEach((n) => n.remove());
  if (carriedId) { carriedId = null; carriedFrom = null; overLane = null; mount(); }
}

/* A word-safe trim. The browser's own line clamp cuts at the character,
   which is how a card ends up reading "dinner 5.30p...". This walks back to
   the last whole word, keeps the full string on the element for the tooltip
   and for assistive technology, and costs one binary search per clipped
   line box.

   It must also be idempotent and re-runnable: it used to run once, before
   the webfont had swapped in, and never again — so a card silently lost its
   last line, with no ellipsis, at every width but the one it was measured
   at. Restoring the full string first is what lets a node grow back when
   its column widens. */
function trimToWord(node) {
  /* The title is clipped by its row, because the row is what contains the
     floated date. Measuring the title itself would always report a fit. */
  const clip = node.classList.contains("cardTitle") ? node.parentElement : node;
  const fits = () => clip.scrollHeight <= clip.clientHeight + 1;
  if (node.dataset.full) node.textContent = node.dataset.full;
  if (fits()) return;
  const full = node.dataset.full || node.textContent;
  node.dataset.full = full;
  /* The trimmed sentence used to be handed to the operating system, which
     re-served 13px Geist as Segoe UI at OS size in an OS box - the one place
     the product's own prose left its own type system. The full string stays on
     the dataset for the regrow path, and assistive technology already has it
     through the card's aria-describedby.
     THE RULE: no visible product prose may be re-served through a native
     title attribute. */
  const words = full.split(" ");
  let low = 1;
  let high = words.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    node.textContent = words.slice(0, mid).join(" ") + "…";
    if (fits()) low = mid;
    else high = mid - 1;
  }
  node.textContent = tidy(words.slice(0, low)) + "…";
}

/* The binary search finds the last word that fits; this decides which of
   those words should be the last one read. Cleanup only ever shortens, so
   the fit the search proved still holds. */
function tidy(words) {
  const kept = words.slice();
  /* A word left stranded at the start of a sentence the reader never sees. */
  if (kept.length > 1 && /[.!?]$/.test(kept[kept.length - 2])) kept.pop();
  let out = kept.join(" ").replace(/[\s,;:.!?\u2013\u2014-]+$/, "");
  /* A dangling function word promises a clause that does not arrive. */
  if (kept.length > 1) out = out.replace(/\s+(a|an|the|and|or|but|if|to|of|with|for|in|on|at|by|from|that|which)$/i, "");
  return out || words[0];
}

/* A fade that is always on is decoration; a fade that appears exactly when
   something is hidden in that direction is information. Both masks are
   measured from distance-to-end, after layout and on every scroll — before
   this they reported "this scrolls" rather than "there is more", so the last
   card sat permanently under a white gradient with nothing below it. */
function measureEdges(target) {
  target.querySelectorAll(".trayBody").forEach((body) => {
    /* Read the content's own extent from offset geometry, which ignores
       transforms. scrollHeight includes the FLIP settle still running after a
       completion, so a column that had just shed a card measured as overflowing
       and latched a fold over nothing. */
    const last = body.lastElementChild;
    const extent = last ? last.offsetTop - body.offsetTop + last.offsetHeight : 0;
    body.toggleAttribute("data-above", body.scrollTop > 1);
    body.toggleAttribute("data-more", body.scrollTop + body.clientHeight < extent - 1);
    /* The rules sit on the tray, so the tray is told where its own scroller
       starts and ends rather than the two being kept in step by hand. */
    const tray = body.closest(".tray");
    if (!tray) return;
    /* offsetTop is already relative to the tray, which is the offset parent.
       Subtracting the tray's own offset as well put the fold rule 112px above
       the foot of the scroller, where it read as a section divider inside
       Done rather than as a cue that there is more below. Read defensively so
       a future change to the sheet's positioning context cannot re-open it. */
    const top = body.offsetParent === tray
      ? body.offsetTop
      : Math.round(body.getBoundingClientRect().top - tray.getBoundingClientRect().top);
    tray.style.setProperty("--body-top", top + "px");
    tray.style.setProperty("--body-bottom", top + body.clientHeight + "px");
  });
  const board = target.querySelector(".board");
  const sheet = target.querySelector(".sheet");
  /* The header stacks on the width of the SHEET, not the width of the window.
     Driven at every 20px from 1440 to 780, the single-row header ran the
     Planning and More buttons past the sheet's right edge from about 1120
     down, where overflow:hidden cut them off the screen entirely — and the
     drawer-open board at 1440 is the same width of sheet as a 1100px window,
     so a viewport media query could never have caught both. Measuring the
     sheet catches them with one threshold. Stacking changes the header's
     height and not the sheet's width, so this cannot oscillate. */
  if (sheet) {
    if (sheet.clientWidth < 1200) sheet.setAttribute("data-head", "stack");
    else sheet.removeAttribute("data-head");
    /* The band was taught to stack and the row beneath it was not, so with
       the drawer open "Display" rendered past the sheet's own edge and was
       cut through by it. Measured rather than guessed at a number: when the
       row wants more width than it has, the three tools keep their glyphs
       and drop their words, which is the same trade the header already makes
       and costs no vertical band. */
    /* Measured against the sheet's own edge, because the row does not
       overflow its own box — it overflows the surface, and the sheet clips. */
    /* Two steps, each measured after the one before it rather than guessed:
       the tools drop their words, and if the row still runs past the sheet
       they leave it altogether. Nothing is lost — every one of them is
       unavailable in this build and says so, and the switcher is the row's
       actual job. */
    const views = target.querySelector(".views");
    const tools = target.querySelector(".viewTools");
    if (views && tools) {
      const edge = () => sheet.getBoundingClientRect().right - 8;
      views.removeAttribute("data-fold");
      if (tools.getBoundingClientRect().right > edge()) {
        views.setAttribute("data-fold", "words");
        if (tools.getBoundingClientRect().right > edge()) views.setAttribute("data-fold", "gone");
      }
    }
  }
  if (board && sheet) {
    /* The fades start where the board starts, whatever the header did. */
    sheet.style.setProperty("--fade-top",
      Math.round(board.getBoundingClientRect().top - sheet.getBoundingClientRect().top + 6) + "px");
    sheet.toggleAttribute("data-more-right", board.scrollLeft + board.clientWidth < board.scrollWidth - 1);
  }
  if (board && sheet) sheet.toggleAttribute("data-more-left", board.scrollLeft > 1);
  const strip = target.querySelector(".carry");
  const bar = strip ? strip.getBoundingClientRect() : null;
  target.querySelectorAll(".trayAdd").forEach((row) => {
    if (!bar) { row.removeAttribute("data-under"); return; }
    const box = row.getBoundingClientRect();
    const hit = box.left < bar.right && box.right > bar.left &&
      box.top < bar.bottom && box.bottom > bar.top;
    row.toggleAttribute("data-under", hit);
  });
  const probe = target.querySelector(".specProbe .trayBody");
  if (probe && sheet) sheet.style.setProperty("--tray-card", Math.round(probe.getBoundingClientRect().width) + "px");
  /* The rail's remembered index can point at a button this width does not
     draw — the add tile only exists on a phone, the mark and the utilities
     only above one. Visibility is not knowable while the markup is a string,
     so it is settled here, after layout: exactly one visible stop, and if the
     remembered one is not on screen the active product takes it back. */
  /* The menu is fixed to the viewport, so it is placed from its trigger's
     measured rect after layout — below when there is room, above when there
     is not. Anchoring it inside the row put it inside the drawer's own
     scroller, which clipped it to a sliver on the lower rows. */
  const dayMenu = target.querySelector(".dayMenu");
  if (dayMenu) {
    const trigger = target.querySelector('[data-act="day"][aria-expanded="true"]');
    if (trigger) {
      const t = trigger.getBoundingClientRect();
      const m = dayMenu.getBoundingClientRect();
      const below = t.bottom + 4;
      const fits = below + m.height <= innerHeight - 12;
      dayMenu.style.top = (fits ? below : Math.max(12, t.top - 4 - m.height)) + "px";
      dayMenu.style.left = Math.max(12, Math.min(t.right - m.width, innerWidth - m.width - 12)) + "px";
    }
  }
  const rail = target.querySelector(".rail");
  if (rail) {
    const seen = [...rail.querySelectorAll("button")].filter((n) => n.offsetParent !== null);
    if (seen.length && !seen.some((n) => n.getAttribute("tabindex") === "0")) {
      const home = seen.find((n) => n.hasAttribute("data-active")) || seen[0];
      railCurrent = home.dataset.key || railCurrent;
      seen.forEach((n) => n.setAttribute("tabindex", n === home ? "0" : "-1"));
    }
  }
}

function retrim(target) {
  target.querySelectorAll(".cardTitle, .cardNote").forEach((node) => {
    if (node.closest(".card[data-open]") && node.classList.contains("cardNote")) {
      if (node.dataset.full) node.textContent = node.dataset.full;
      return;
    }
    trimToWord(node);
  });
  measureEdges(target);
}

/* Repainting the whole sheet used to annihilate every scroll position and
   the focus point with it: one tick on a phone threw the board back to To
   Do, and any pointer completion dropped focus to <body>, eight tab stops
   from where the operator was. Place is captured, restored in the same
   frame, and restored on every path rather than only the keyboard one. */
/* Where every card was, before the change, so what survives can move rather
   than jump. Keyed by id because the repaint destroys the DOM. */
function snapshot(target) {
  const map = new Map();
  target.querySelectorAll(".card[data-id]").forEach((n) => {
    map.set(n.dataset.id, n.getBoundingClientRect());
  });
  return map;
}

function settleRest(target, before, ms) {
  if (!before || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  target.querySelectorAll(".card[data-id]").forEach((node) => {
    const was = before.get(node.dataset.id);
    if (!was) return;
    const now = node.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    node.style.transition = "none";
    node.style.transform = "translate(" + dx + "px," + dy + "px)";
    node.getBoundingClientRect();
    node.style.transition = "transform " + ms + "ms var(--curve)";
    node.style.transform = "";
    setTimeout(() => { node.style.transition = ""; }, ms + 40);
  });
}

function keepPlace(target) {
  const scrolls = {};
  target.querySelectorAll(".tray[data-lane]").forEach((tray) => {
    const body = tray.querySelector(".trayBody");
    if (body) scrolls[tray.dataset.lane] = body.scrollTop;
  });
  const board = target.querySelector(".board");
  const active = document.activeElement;
  const card = active && active.closest && active.closest(".card[data-id]");
  const chrome = !card && active && active.closest && active.closest("[data-act]");
  return {
    scrolls: scrolls,
    left: board ? board.scrollLeft : 0,
    id: card ? card.dataset.id : null,
    act: chrome ? chrome.dataset.act : null,
    hadFocus: !!(active && active !== document.body && target.contains(active)),
    part: active && active.classList.contains("tick") ? "tick"
      : active && active.classList.contains("cardDots") ? "cardDots" : "card",
  };
}

function restorePlace(target, kept) {
  target.querySelectorAll(".tray[data-lane]").forEach((tray) => {
    const body = tray.querySelector(".trayBody");
    const top = kept.scrolls[tray.dataset.lane];
    if (body && top) body.scrollTop = top;
  });
  const board = target.querySelector(".board");
  if (board && kept.left) {
    /* Mandatory snap re-runs against the fresh layout and drags the board
       back to the first column, which is why every tick on a phone threw the
       operator back to To Do. Snap is suspended for the one frame the
       restore takes. */
    const snap = board.style.scrollSnapType;
    board.style.scrollSnapType = "none";
    void board.scrollWidth;
    board.scrollLeft = kept.left;
    requestAnimationFrame(() => { board.style.scrollSnapType = snap; });
  }
  /* An open composer owns focus: whatever else the repaint was for, the
     operator is mid-sentence and that is the worse place to lose. */
  const field = target.querySelector(".card[data-draft] .cardTitle");
  if (field) {
    field.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  /* Nothing may drop the operator on <body>, eight stops from the board. */
  const fallback = () => {
    const stop = target.querySelector('.card[tabindex="0"]') || target.querySelector(".dockPrimary");
    if (stop) stop.focus({ preventScroll: true });
  };
  const wanted = refocus ? focusId : kept.id;
  if (!wanted) {
    if (!kept.act) return;
    const back = target.querySelector('[data-act="' + kept.act + '"]');
    if (back) back.focus({ preventScroll: true });
    else if (kept.hadFocus) fallback();
    return;
  }
  const node = target.querySelector('.card[data-id="' + wanted + '"]');
  if (!node) { if (kept.hadFocus) fallback(); return; }
  const part = refocusPart || (refocus ? "card" : kept.part);
  const aim = part === "card" ? node : node.querySelector("." + part) || node;
  if (!kept.id && !refocus) return;
  aim.focus({ preventScroll: true });
  /* Scoped to the column, deliberately: a general scrollIntoView nudges the
     horizontally snapped board on a phone and undoes the restore above. */
  const scroller = node.closest(".trayBody");
  if (!scroller) return;
  const card = node.getBoundingClientRect();
  const box = scroller.getBoundingClientRect();
  /* The column snaps, so an arbitrary offset is pulled back on the next
     frame. Move to a real snap position instead: the largest one that still
     brings the whole card into view, which is also the smallest movement. */
  const top = card.top - box.top + scroller.scrollTop;
  if (card.top >= box.top + 4 && card.bottom <= box.bottom - 4) return;
  const stops = [...scroller.querySelectorAll(".card")]
    .map((n) => n.getBoundingClientRect().top - box.top + scroller.scrollTop - 20);
  if (card.top < box.top + 4) { scroller.scrollTop = top - 20; return; }
  const want = top + card.height - scroller.clientHeight + 20;
  /* The first snap position that scrolls far ENOUGH — under-scrolling by a
     hair is what leaves the card clipped and snap-locked there. */
  const fits = stops.filter((v) => v >= want - 0.5);
  scroller.scrollTop = fits.length ? fits[0] : want;
}

let bound = null;
function bindScroll(target) {
  const scrollers = [target.querySelector(".board"), ...target.querySelectorAll(".trayBody")].filter(Boolean);
  if (bound) bound.forEach((n) => n.removeEventListener("scroll", onScroll));
  bound = scrollers;
  scrollers.forEach((n) => n.addEventListener("scroll", onScroll, { passive: true }));
}
let scrollFrame = 0;
function onScroll() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    const target = window.__SUITE.host("tasks");
    if (target) measureEdges(target);
  });
}

function mount() {
  const target = window.__SUITE.host("tasks");
  if (!target) return;
  /* The state this board is in, where a harness can read it. Notes and
     Timeline both write theirs onto their own root; the board was the one
     surface whose state a gate could only infer from the pixels. */
  root.setAttribute("data-state", lateOnly ? "filtered" : state);
  const before = flyId ? snapshot(target) : null;
  const kept = keepPlace(target);
  target.innerHTML = renderApp();
  restorePlace(target, kept);
  retrim(target);
  bindScroll(target);
  const travelled = flyCompleted(target);
  if (travelled) settleRest(target, before, travelled);
  refocus = false;
  refocusPart = null;
}

/* The customizer drives this same renderer from a control panel rather than
   from the URL, so the board is never implemented twice. */
window.__signal = {
  mount,
  presets: PRESETS,
  decisions: DECISIONS,
  setState(next) {
    state = next;
    carriedId = null; focusId = null; lateOnly = false; clientOnly = null;
    todayOnly = false; menuFor = null;
    openNoteId = null; flyId = null; flyFrom = null; draftLane = null; draftText = "";
    drawerTab = "nodate"; picked.clear();
    history.length = 0;
    clearUndo();
  },
};

/* One live region for the suite, created before the first paint. Two
   products each appending their own would put two elements with id="say"
   in one document, and the second one would never be read. */
window.__SUITE.region();

/* One delegated listener per event, on the container, so a repaint can
   never leave a handler behind or bind one twice. */
const host = window.__SUITE.host("tasks");
if (host) {
  host.addEventListener("focusin", (e) => { if (e.target.closest(".carry")) holdUndo(); });
  host.addEventListener("focusout", (e) => { if (e.target.closest(".carry")) releaseUndo(); });
  host.addEventListener("mouseenter", (e) => { if (e.target.closest && e.target.closest(".carry")) holdUndo(); }, true);
  host.addEventListener("mouseleave", (e) => { if (e.target.closest && e.target.closest(".carry")) releaseUndo(); }, true);
  host.addEventListener("input", (event) => {
    const field = event.target.closest && event.target.closest(".card[data-draft] .cardTitle");
    if (field) draftText = field.textContent;
  });
  /* The light-dismiss handler is gone. One panel was running two contradictory
     input models: to the keyboard the drawer was a non-modal sibling with two
     ways out, and to the pointer it was modal and ate the click — a real press
     on a card's tick with the drawer open closed the drawer and did not
     complete the task. It declares aria-modal="false" and sits beside the
     sheet rather than over it, so the board stays live behind it. The X and
     Escape are the ways out, and both already worked. */
  /* The card body must stay draggable, so its click cannot be trusted: 4px of
     travel and the browser suppresses it. A press and release that stayed
     within 8px on the same card is a click, whatever the drag machinery
     thinks, and it opens the note the press began on. */
  host.addEventListener("pointerdown", (event) => {
    const card = event.target.closest && event.target.closest(".card[data-id]");
    /* The repaint waits for the click. Repainting here destroys the control
       the press landed on before its click can fire, so ending the carry
       would have eaten the very completion it was meant to make room for. */
    if (carriedId && (!card || card.dataset.id !== carriedId)) {
      endCarry();
      setTimeout(() => { if (!carriedId) mount(); }, 0);
    }
    const control = event.target.closest && event.target.closest(".tick, .cardDots, .who, [data-act]");
    pressedControl = card && card.closest(".board") ? control : null;
    pressAt = card && card.closest(".board") && !control
      ? { id: card.dataset.id, x: event.clientX, y: event.clientY }
      : null;
  });
  host.addEventListener("pointerup", (event) => {
    const was = pressAt;
    pressAt = null;
    pressedControl = null;
    if (!was || carriedId) return;
    if (Math.hypot(event.clientX - was.x, event.clientY - was.y) >= 8) return;
    const card = event.target.closest && event.target.closest(".card[data-id]");
    if (!card || card.dataset.id !== was.id) return;
    if (String(getSelection())) return;
    if (!card.hasAttribute("aria-expanded")) { say("There is no note on this task yet."); return; }
    /* The click may or may not survive; whichever fires first wins and the
       other finds the state already settled on the same card. */
    if (openNoteId === was.id) return;
    focusId = was.id;
    openNoteId = was.id;
    refocus = true;
    say("Showing the whole note.");
    mount();
  });
  /* A half-written task was stranded by any click on empty sheet: focus fell
     to nothing, the draft stayed on the board still holding the words, and the
     instruction under it ("Enter adds it. Esc discards it.") no longer worked
     because nothing had focus to receive the keystroke. Focus moving to a real
     control keeps the composer alive; focus falling to nothing commits what
     was typed, and discards what was not. */
  host.addEventListener("focusout", (event) => {
    const field = event.target.closest && event.target.closest(".card[data-draft] .cardTitle");
    if (!field) return;
    if (event.relatedTarget && event.relatedTarget.closest &&
        event.relatedTarget.closest("button, a, input, textarea, [tabindex]")) return;
    const words = (field.textContent || "").trim();
    setTimeout(() => {
      /* Enter already committed and repainted, which detached this field and
         opened a fresh one; committing again would add the same task twice.
         A field still in the document is a genuine blur to nothing. */
      if (!field.isConnected) return;
      if (!draftLane) return;
      if (words) commitDraft(field, false);
      else { draftLane = null; draftText = ""; mount(); }
    }, 0);
  });
  host.addEventListener("click", onClick);
  /* The board that is not on screen keeps its DOM, so it would keep
     answering the keyboard as well. A product's keys are its own. */
  document.addEventListener("keydown", (event) => { if (window.__SUITE.active("tasks")) onKey(event); });
  host.addEventListener("dragstart", onDragStart);
  host.addEventListener("dragover", onDragOver);
  host.addEventListener("drop", onDrop);
  host.addEventListener("dragend", onDragEnd);
}
addEventListener("resize", () => {
  const target = window.__SUITE.host("tasks");
  if (target) retrim(target);
});
/* The webfont swaps in after the first paint, which is what made every
   measured trim wrong on load. */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    const target = window.__SUITE.host("tasks");
    if (target) retrim(target);
  });
}

mount();


window.__SUITE.register("tasks", {
  /* `show` is the board's own repaint, deliberately the same one every
     other change goes through: it restores scroll, focus and caret, so
     arriving back on the board costs nothing you were holding. */
  show: mount,
  setState: window.__signal.setState,
  presets: PRESETS,
  decisions: DECISIONS,
  api: TASKS_API,
});
