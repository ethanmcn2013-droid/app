/* NOTES · THE STACK — the locked master, live.
 *
 * There is one source of truth and one render path. A handler mutates a fact
 * and asks for a repaint; nothing touches DOM it did not create. Every repaint
 * puts the operator back exactly where they were — same scroll, same focus,
 * same caret — because a capture product that loses your place is a capture
 * product that loses your work.
 */
(function () {
  const N = window.NOTES;
  const I = window.ICON;
  const params = new URLSearchParams(location.search);
  /* Text going into markup, and text going into an ATTRIBUTE, are two
     different jobs. esc() alone left quotes intact, so a note reading
     Ask the band about the "first dance" song list truncated its own
     aria-label and its own trim source at the first quote — the row lost
     two thirds of a person's sentence and said nothing about it. */
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const attr = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ── the decision layer ──────────────────────────────────────────
     The three finished rooms are three preset combinations of five
     decisions. Nothing else distinguishes them, which is what guarantees
     every mix stays on the three-colour lock. */
  const PRESETS = {
    locked: { paper: "stacked", index: "airy", radius: "soft", indigo: "subtle", type: "calm" },
    quiet: { paper: "flat", index: "tight", radius: "sharp", indigo: "subtle", type: "calm" },
    studio: { paper: "stacked", index: "airy", radius: "round", indigo: "subtle", type: "expressive" },
    press: { paper: "deep", index: "tight", radius: "soft", indigo: "forward", type: "expressive" },
  };
  const DECISIONS = ["paper", "index", "radius", "indigo", "type"];
  const variant = params.get("v") || "locked";

  /* Standalone the decisions live on the document; inside the console they
     live on the deck element, and this code does not know the difference,
     which is what keeps one implementation of the notebook. */
  const root = document.getElementById("deck") || document.documentElement;
  const preset = PRESETS[variant] || PRESETS.locked;
  root.setAttribute("data-variant", variant);
  for (const key of DECISIONS) root.setAttribute("data-" + key, params.get(key) || preset[key]);

  /* ── the mutable world ───────────────────────────────────────── */
  let state = params.get("state") || "notebook";
  let WORK = null;        /* the notebook, seeded from the fixture         */
  let draft = "";         /* what is on the top sheet and not yet saved    */
  let openId = null;      /* the note lifted onto the desk                 */
  let cursorId = null;    /* the index's single tab stop                   */
  let query = "";         /* the search                                    */
  let queueAt = 0;        /* how far through the hand                      */
  let decided = [];       /* what the hand has settled, newest last        */
  let undone = null;      /* the last reversible act                       */
  let undoTimer = null;
  let settling = null;    /* a sheet on its way to the pile                */
  let refocus = null;     /* what to put focus back on after a repaint     */
  /* What a note is ABOUT is the resting state. Shipped as an opt-in
     control it was, in a seat's words, an answer filed in a drawer: the
     product still opened on Today / Yesterday / Monday, which is the
     calendar of when you typed rather than of what you are facing. */
  let group = params.get("group") || "about";
  let peeling = null;     /* the note a task is being written from         */
  let taskWording = "";   /* the words that will cross                     */
  let sentTask = null;    /* the receipt, once Tasks has it                */
  let arriving = null;    /* the id of the note being staged into the pile */
  let pieces = N.speech.separated.slice(); /* the read-back, as edited      */
  let seamTouched = false; /* the seam has been entered at least once       */
  let picked = null;      /* the words highlighted in a note, right now      */
  let pickedWords = null; /* the words a peel was opened from                */
  let nudge = null;       /* the one sentence asking for a pick              */

  const MOD = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* Capture lives on the desk's paper on a wide screen and in the dock on a
     phone, and exactly one of them is ever rendered. Rendering both and
     hiding one with CSS left an invisible textarea in the document at every
     width, which is a focusable control nobody can see — the exact defect
     the standing checklist names.
     The decision is taken from the width of the product's own container,
     not from the viewport. A viewport query is the wrong question the
     moment this file is placed inside anything — a console, a split view,
     a preview — and it answered that wrong question silently. */
  const PHONE_AT = 720;
  const phone = { matches: false };
  function readWidth() {
    const box = document.getElementById("root");
    const w = box ? box.getBoundingClientRect().width : 0;
    return (w || innerWidth) <= PHONE_AT;
  }

  function seed() {
    if (state === "nothing") return [];
    if (state === "pressure") return N.dense.slice();
    return N.notes.slice();
  }
  function work() {
    if (!WORK) WORK = seed();
    return WORK;
  }

  /* Every count on screen is derived from the same list, so the head can
     never state a number the body below it disagrees with. */
  function counts() {
    const w = work().filter((n) => !n.deleted);
    return {
      total: w.length,
      pending: w.filter((n) => n.pending).length,
      sent: w.filter((n) => n.sent).length,
    };
  }

  /* ── announcements ───────────────────────────────────────────────
     The live region is created once and lives outside everything this
     file repaints. Rendered inside the repainted subtree it was destroyed
     and rebuilt on every act, so the text never *changed* in a region a
     screen reader was already watching — which is the difference between
     announcing and not announcing, and is invisible in a screenshot. */
  const region = document.createElement("p");
  region.className = "sr";
  region.id = "say";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  document.body.appendChild(region);
  const say = (text) => {
    region.textContent = text;
  };

  /* ── the way back ────────────────────────────────────────────── */
  function offerUndo(label, revert) {
    undone = { label, revert };
    clearTimeout(undoTimer);
    /* The strip waits while you are reading it. Ten seconds is long enough
       to notice a mistake and short enough not to become chrome. */
    undoTimer = setTimeout(() => {
      undone = null;
      paint();
    }, 10000);
  }
  function doUndo() {
    if (!undone) return false;
    const { revert, label } = undone;
    undone = null;
    clearTimeout(undoTimer);
    revert();
    say(`Undone. ${label}`);
    paint();
    return true;
  }

  /* ── acts ────────────────────────────────────────────────────── */
  /* One shape for a note, used everywhere one is made. Three call sites
     were building the object by hand and the newest one forgot `about`,
     so opening a note you had just written threw on note.about.label and
     took the whole repaint with it. */
  function makeNote(body, opts) {
    const o = opts || {};
    const title = body.split(/(?<=[.?!”])\s/)[0] || body;
    return {
      id: o.id || `new_${Date.now()}_${Math.round(performance.now())}`,
      body,
      title,
      rest: body.slice(title.length).trim(),
      source: o.source || "typed",
      when: "Just now",
      day: "Today",
      ms: 0,
      task: null,
      pick: null,
      sent: false,
      reviewed: false,
      edited: false,
      pending: true,
      words: body.trim().split(/\s+/).length,
      about: N.subjects[o.about || "the-house"],
      aboutKey: o.about || "the-house",
    };
  }

  function keepDraft() {
    const body = draft.trim();
    if (!body) return;
    const note = makeNote(body);
    draft = "";
    work().unshift(note);
    say(`Kept. ${counts().total} notes, ${counts().pending} waiting on a decision.`);
    /* The strip says what just happened, in the present, and the button
       says what pressing it will do. Written as the post-undo sentence and
       shown before the undo, it told the operator their note had already
       gone back to the sheet while it was sitting safely on the pile. */
    offerUndo("Kept on the pile.", () => {
      WORK = work().filter((n) => n !== note);
      draft = body;
    });
    /* The capture field is where the next thought goes, so that is where
       the caret goes. Without this, keeping by mouse dropped focus to the
       body and the next thing typed went nowhere. */
    refocus = { kind: "field", sel: phone.matches ? ".phoneField" : ".topField" };
    if (reduced) {
      paint();
      return;
    }
    /* THE MOMENT.
       The promise is the three seconds between a thought and it being
       safe, and it was asserted in copy and shown nowhere: the words
       vanished from the field at frame one and a row hard-cut in
       elsewhere. Staging it as CSS state on the sheet and the row cannot
       work — paint() remounts the whole tree, so any transition is on an
       element that did not exist a frame ago. So the words themselves
       travel, as one fixed-position copy outside the render tree, from
       where they were written to the row they became. Nothing in the
       notebook animates; the thought does. */
    const field = mount.querySelector(phone.matches ? ".phoneField" : ".topField");
    const from = field ? field.getBoundingClientRect() : null;
    const size = field ? getComputedStyle(field) : null;
    arriving = note.id;
    paint();
    const row = mount.querySelector(`.idxRow[data-id="${CSS.escape(note.id)}"] .idxText`);
    if (from && row) flyWords(body, from, row.getBoundingClientRect(), size);
    setTimeout(() => {
      arriving = null;
      paint();
    }, 620);
  }

  /* One copy of the words, in the air, on its own layer. It is
     aria-hidden because the live region has already said what happened,
     and it removes itself whether the animation finishes or is cut. */
  function flyWords(text, from, to, size) {
    const ghost = document.createElement("div");
    ghost.className = "fly";
    ghost.setAttribute("aria-hidden", "true");
    ghost.textContent = text;
    ghost.style.cssText = [
      `left:${from.left}px`,
      `top:${from.top}px`,
      `width:${from.width}px`,
      `font-size:${size ? size.fontSize : "17px"}`,
      `line-height:${size ? size.lineHeight : "1.55"}`,
      `letter-spacing:${size ? size.letterSpacing : "normal"}`,
    ].join(";");
    document.body.appendChild(ghost);
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const scale = Math.min(1, to.width / Math.max(1, from.width));
    const done = () => ghost.remove();
    const animation = ghost.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.9, offset: 0.82 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
      ],
      { duration: 460, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" },
    );
    animation.addEventListener("finish", done);
    animation.addEventListener("cancel", done);
    setTimeout(done, 900);
  }

  function queue() {
    return work().filter((n) => n.pending);
  }

  function decide(kind) {
    const note = queue()[queueAt];
    if (!note) return;
    const before = { queueAt, pending: note.pending, reviewed: note.reviewed, sent: note.sent, task: note.task };
    /* The decision reaches the notebook. Before this the hand incremented
       a counter and pushed onto a local array: the live region announced
       a decision, the card advanced, and the note behind it was untouched
       in every other state. */
    if (kind === "task") {
      /* The same sequence the notebook uses, opened inside the hand rather
         than instead of it. Sending a note to Tasks from the queue with no
         peel at all skipped the one promise the product is sold on; taking
         the person out of the queue to do it would cost them their place
         in eight decisions. */
      peeling = note.id;
      pickedWords = note.pick || note.title.replace(/[.]$/, "");
      taskWording = pickedWords.replace(/^[a-z]/, (c) => c.toUpperCase()).replace(/[.]$/, "");
      sentTask = null;
      say(`${N.copy.sourceLabel}: ${pickedWords}. ${N.copy.payload}`);
      refocus = { kind: "field", sel: ".peelField" };
      paint();
      return;
    }
    if (kind === "keep" || kind === "later") {
      note.pending = kind === "keep" ? false : true;
      note.reviewed = kind === "keep";
    } else if (kind === "delete") {
      note.deleted = true;
      note.pending = false;
    }
    if (kind !== "later") queueAt = before.queueAt;
    else queueAt += 1;
    decided.push({ note, kind, before });
    const left = queue().length - (kind === "later" ? queueAt : 0);
    const label =
      kind === "task"
        ? `Turned into a task. ${left} left.`
        : kind === "keep"
          ? `Kept in Notes. ${left} left.`
          : kind === "later"
            ? `Left for later. ${left} left.`
            : `Deleted. ${left} left.`;
    say(label);
    /* The strip states what happened, in the present. One string was being
       painted before the undo and concatenated after it, so at the moment
       the ear heard "turned into a task" the eye read "that decision was
       put back". */
    const strip =
      kind === "task"
        ? "Turned into a task."
        : kind === "keep"
          ? "Kept in Notes."
          : kind === "later"
            ? "Left for later."
            : "Deleted.";
    offerUndo(strip, () => {
      Object.assign(note, {
        pending: before.pending,
        reviewed: before.reviewed,
        sent: before.sent,
        task: before.task,
        deleted: false,
      });
      queueAt = before.queueAt;
      decided.pop();
    });
    if (reduced) {
      paint();
      return;
    }
    settling = "hand";
    paint();
    setTimeout(() => {
      settling = null;
      paint();
    }, 220);
  }

  /* ── the seam ────────────────────────────────────────────────────
     The sealed one-way edge is the product's second promise, and it was a
     photograph: three controls that took a click and answered with
     nothing. It is a real sequence now — pick the words, edit the wording,
     choose where it goes, send, and get a receipt — and the note it comes
     from is never covered at any point in it. */
  /* The whole product turns on this. "Tasks only ever receives the exact
     words you pick" was, until now, a sentence over a field seeded with
     whatever the fixture happened to carry: eleven of the fourteen notes
     had no picked words at all and sent their first sentence instead.
     A person can now pick, and nothing crosses that they did not. */
  function pickedRange() {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const body = mount.querySelector(".readBody");
    if (!body) return null;
    const range = sel.getRangeAt(0);
    if (!body.contains(range.commonAncestorContainer)) return null;
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (text.length < 3) return null;
    return text;
  }

  function offerPick() {
    const text = pickedRange();
    if (text === picked) return;
    picked = text;
    if (text) say(`${text.split(/\s+/).length} words picked. ${N.copy.begin} to make them a task.`);
    paint();
  }

  function startPeel(id, opts) {
    const o = opts || {};
    const note = work().find((n) => n.id === id) || N.notes[13];
    /* Nothing is seeded that the person did not pick. Pressing the primary
       action with nothing highlighted says so, in the product's own words,
       rather than quietly sending a sentence they never chose. */
    const words = o.words || picked || note.pick;
    if (!words) {
      say(N.copy.nothingSelected);
      nudge = N.copy.nothingSelected;
      openId = note.id;
      paint();
      setTimeout(() => {
        nudge = null;
        paint();
      }, 4200);
      return;
    }
    nudge = null;
    peeling = note.id;
    pickedWords = words;
    openId = note.id;
    sentTask = null;
    taskWording = words.replace(/^[a-z]/, (c) => c.toUpperCase()).replace(/[.]$/, "");
    say(`${N.copy.sourceLabel}: ${words}. ${N.copy.payload}`);
    refocus = { kind: "field", sel: ".peelField" };
    paint();
  }
  function cancelPeel() {
    if (!peeling) return;
    peeling = null;
    pickedWords = null;
    sentTask = null;
    say("Nothing crossed. Your note is unchanged.");
    refocus = { kind: "act", sel: state === "review" ? '[data-act="d-task"]' : '[data-act="peel"]' };
    paint();
  }
  function sendPeel() {
    if (!peeling || !taskWording.trim()) return;
    const note = work().find((n) => n.id === peeling);
    const wording = taskWording.trim();
    const before = note ? { sent: note.sent, task: note.task, pending: note.pending } : null;
    if (note) {
      note.sent = true;
      note.task = wording;
      note.pending = false;
    }
    /* In the hand, the crossing settles the card and the next one comes
       up. In the notebook it settles the note and stays where it is. */
    if (state === "review") {
      sentTask = null;
      peeling = null;
      pickedWords = null;
      taskWording = "";
      decided.push({ note, kind: "task", before });
      say(`${N.copy.sentReceipt} ${Math.max(0, queue().length)} left.`);
      offerUndo("Turned into a task.", () => {
        if (note && before) Object.assign(note, before);
        decided.pop();
      });
      paint();
      return;
    }
    sentTask = { wording, project: N.projects[0] };
    say(`${N.copy.sentReceipt} ${N.copy.stayedPut}`);
    offerUndo("Sent to Tasks.", () => {
      if (note && before) Object.assign(note, before);
      sentTask = null;
      peeling = note ? note.id : null;
    });
    refocus = { kind: "act", sel: '[data-act="open-task"]' };
    paint();
  }

  function openSearch() {
    state = "search";
    refocus = { kind: "field", sel: "#q" };
    say("Search everything you have written.");
    paint();
  }

  function openNote(id) {
    picked = null;
    nudge = null;
    openId = id;
    cursorId = id;
    const note = work().find((n) => n.id === id);
    if (note) say(`Open. ${note.title}`);
    refocus = { kind: "read" };
    paint();
  }
  function closeNote() {
    if (!openId) return;
    picked = null;
    nudge = null;
    const id = openId;
    openId = null;
    say("Put back.");
    refocus = { kind: "row", id };
    paint();
  }

  /* ── the index's one tab stop ────────────────────────────────── */
  function visible() {
    const w = work().filter((n) => !n.deleted);
    if (!query) return w;
    const q = query.toLowerCase();
    return w.filter((n) => n.body.toLowerCase().includes(q));
  }
  function moveCursor(step) {
    const rows = visible();
    if (!rows.length) return;
    const at = rows.findIndex((n) => n.id === cursorId);
    const next = at < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, at + step));
    cursorId = rows[next].id;
    refocus = { kind: "row", id: cursorId };
    say(`${next + 1} of ${rows.length}. ${rows[next].title}`);
    paint();
  }

  /* ── word-safe trimming ──────────────────────────────────────────
     The index shows one line. A CSS ellipsis cuts wherever the box ends,
     which lands mid-word and reads as damage; this measures the row after
     layout and cuts at the last word boundary that fits. It re-runs on
     fonts.ready and on resize, because a trim measured in a fallback face
     is a trim measured against the wrong widths. The full text is always
     in the row's accessible name, so nothing is ever hidden from a reader
     that is visible to a looker. */
  function trimRows() {
    for (const row of document.querySelectorAll(".idxRow")) {
      const text = row.querySelector(".idxText");
      if (!text) continue;
      const full = text.dataset.full;
      if (!full) continue;
      const lede = text.dataset.lede || "";
      text.innerHTML = `<b>${hl(lede)}</b>${full.length > lede.length ? ` <span>${hl(full.slice(lede.length).trim())}</span>` : ""}`;
      if (text.scrollWidth <= text.clientWidth) continue;
      const rest = full.slice(lede.length).trim();
      /* Trim the preview first, then the lede, and never below the first
         four words of a person's own sentence. */
      let words = rest.split(" ");
      while (words.length && text.scrollWidth > text.clientWidth) {
        words.pop();
        text.innerHTML = `<b>${hl(lede)}</b>${words.length ? ` <span>${hl(words.join(" "))}…</span>` : ""}`;
      }
      if (text.scrollWidth <= text.clientWidth) continue;
      let head = lede.split(" ");
      while (head.length > 4 && text.scrollWidth > text.clientWidth) {
        head.pop();
        text.innerHTML = `<b>${hl(head.join(" "))}…</b>`;
      }
      /* Below four words there is nothing left to give back, so the row
         admits it with an ellipsis rather than letting the browser slice a
         letter in half against the status pill. */
      if (text.scrollWidth > text.clientWidth) text.dataset.clipped = "";
      else delete text.dataset.clipped;
    }
  }

  /* ── chrome ──────────────────────────────────────────────────── */
  function rail() {
    const tiles = [
      ["notes", "Notes"],
      ["tasks", "Tasks"],
      ["timeline", "Timeline"],
      ["more", "More"],
    ];
    return `
      <nav class="rail" aria-label="Signal Studio">
        <span class="railMark" aria-hidden="true">${I.home}<i></i></span>
        <span class="railDivider" aria-hidden="true"></span>
        <div class="railGroup">
          ${tiles
            .map(
              ([k, name]) =>
                `<button class="railTile" type="button"${k === "notes" ? ' data-active aria-current="page"' : ""} aria-label="${name}${k === "notes" ? ", the page you are on" : ""}">${I[k]}</button>`,
            )
            .join("")}
        </div>
        <span class="railSpacer"></span>
        <button class="railAvatar" type="button" aria-label="${esc(N.operator.role)}. Account and settings">${N.operator.initials}</button>
      </nav>`;
  }

  function head() {
    const c = counts();
    const chip =
      state === "review"
        ? ""
        : c.pending > 0
          ? `<button class="chip" type="button" data-act="review" aria-label="${c.pending} to decide. Go through the notes waiting on a decision.">${c.pending} to decide</button>`
          : "";
    return `
      <header class="head">
        <span class="word">notes</span>
        <span class="headRule" aria-hidden="true"></span>
        <h1 class="headName">${esc(N.workspace)}</h1>
        ${chip}
        <div class="headActions">
          <button class="headAct" type="button" data-act="privacy">${I.lock}<span>${esc(N.copy.privacy)}</span></button>
          <button class="headAct" type="button" data-act="options" aria-label="Notes options">${I.dots}</button>
        </div>
      </header>`;
  }

  function dock() {
    const live = Boolean(draft.trim());
    /* On a phone the dock IS the capture instrument, so the dock has to
       carry the act of keeping. Without it the product's whole promise —
       a thought is safe in three seconds — was unreachable by touch: the
       only way to commit a note was a keyboard chord on a device with no
       keyboard. */
    const commit = live
      ? `<button class="dockGlyph" data-ink type="button" data-act="keep" aria-label="Put it on the pile">${I.check}</button>`
      : "";
    /* On a wide screen the capture field is on the desk's paper, and
       reading a note replaces it. So the dock carries the way back to
       writing, which is otherwise off the screen entirely. */
    const backToWriting =
      !phone.matches && openId
        ? `<button class="dockGlyph" type="button" data-act="write" aria-label="Write a note">${I.typed}</button>
           <span class="dockRule" aria-hidden="true"></span>`
        : "";
    return `
      <div class="dockWrap">
        <div class="dock"${live ? " data-live" : ""}>
          ${
            phone.matches
              ? `<textarea class="phoneField" rows="2" aria-label="Write a note" placeholder="${attr(N.copy.placeholder)}">${esc(draft)}</textarea>
                 ${live ? `<span class="dockCount tab" aria-hidden="true">${draft.length}</span>` : ""}
                 ${commit}
                 <span class="dockRule" aria-hidden="true"></span>
                 <button class="dockGlyph" type="button" data-act="search" aria-label="Search notebook">${I.search}</button>`
              : `${backToWriting}<button class="dockField" type="button" data-act="search" aria-label="Search notebook">${I.search}<span>Search everything you wrote</span><kbd>${MOD === "⌘" ? "⌘K" : "Ctrl K"}</kbd></button>`
          }
          <span class="dockRule" aria-hidden="true"></span>
          <button class="dockGlyph" type="button" data-act="voice" aria-label="${attr(N.copy.voiceStart)}">${I.mic}</button>
          <button class="dockGlyph" type="button" data-act="photo" aria-label="Read a photo">${I.photo}</button>
          <span class="dockRule" aria-hidden="true"></span>
          <button class="dockAvatar" type="button" aria-label="${attr(N.operator.role)}. Account and settings">${N.operator.initials}</button>
        </div>
      </div>`;
  }

  function undoStrip() {
    if (!undone) return "";
    return `
      <div class="undo" role="status">
        <span>${esc(undone.label)}</span>
        <button class="undoAct" type="button" data-act="undo">${I.undo}Undo<kbd>${MOD}+Z</kbd></button>
      </div>`;
  }

  /* ── the desk ────────────────────────────────────────────────── */
  function behind(n) {
    return Array.from({ length: n }, (_, i) => `<div class="behind" data-n="${n - i}" aria-hidden="true"></div>`).join("");
  }
  /* The sheets behind stretch to the height of their own container, so
     the container has to be the paper and nothing else. Given the whole
     pile they stretched behind the peel as well, and two overlapping
     white rectangles with no edge between them is not depth, it is mud. */
  function deskOf(inner, opts) {
    const o = opts || {};
    const n = o.behind === undefined ? 2 : o.behind;
    return `
      <section class="desk" aria-label="${attr(o.label || "Write a note")}">
        <div class="pile"><div class="paperStack">${behind(n)}${inner}</div>${o.under || ""}</div>
      </section>`;
  }

  function topSheet() {
    /* On a phone the desk stands down entirely and the dock carries
       capture, so there is no top sheet to render. */
    if (phone.matches) return "";
    const live = draft.trim() ? " data-live" : "";
    const isSettling = settling && settling !== "hand" ? " data-settling" : "";
    return deskOf(
      `<div class="top"${live}${isSettling}>
        <textarea class="topField" rows="2" aria-label="Write a note" placeholder="${esc(N.copy.placeholder)}">${esc(draft)}</textarea>
        <div class="topFoot">
          <button class="verb" type="button" data-act="voice">${I.mic}${esc(N.copy.voiceStart)}</button>
          <button class="verb" type="button" data-act="photo">${I.photo}Read a photo</button>
          <span class="spacer"></span>
          ${
            draft.trim()
              ? `<span class="topMeta tab" data-count>${draft.length} / 4000</span>
                 <button class="act" data-ink type="button" data-act="keep">${I.check}Put it on the pile<kbd>${MOD}+Enter</kbd></button>`
              : `<span class="topMeta">Nobody else can read this</span>`
          }
        </div>
      </div>`,
    );
  }

  function peelPanel(note) {
    if (sentTask) {
      return `
        <div class="peel" data-receipt>
          <div class="peelTop">
            <span class="peelMark" aria-hidden="true">${I.check}</span>
            <span class="peelLabel">${esc(N.copy.confirmed)}</span>
          </div>
          <p class="peelSent">${esc(sentTask.wording)}</p>
          <p class="peelWhy">${esc(N.copy.stayedPut)}</p>
          <div class="peelRow">
            <button class="act" type="button" data-act="open-task">${I.tasks}${esc(N.copy.open)}</button>
            <span class="spacer"></span>
            <button class="act" data-quiet type="button" data-act="close-peel">Done</button>
          </div>
        </div>`;
    }
    return `
      <div class="peel">
        <div class="peelTop">
          <span class="peelMark" aria-hidden="true">${I.tasks}</span>
          <span class="peelLabel">${esc(N.copy.heading)}</span>
        </div>
        <p class="peelBoundary">${esc(N.copy.handoffBoundary)}</p>
        ${pickedWords ? `<p class="peelFrom"><b>${esc(N.copy.sourceLabel)}</b><span>${esc(pickedWords)}</span></p>` : ""}
        <span class="peelLabel" id="peel-label">${esc(N.copy.wordingLabel)}</span>
        <textarea class="peelField" rows="1" aria-labelledby="peel-label">${esc(taskWording)}</textarea>
        <div class="peelRow">
          <button class="picker" type="button" aria-label="${attr(N.copy.destinationLabel)}: ${attr(N.projects[0])}"><b>To</b>${esc(N.projects[0])}${I.chevron}</button>
          <span class="spacer"></span>
          <button class="act" data-quiet type="button" data-act="cancel-peel">${esc(N.copy.cancel)}</button>
          <button class="act" data-primary type="button" data-act="send">${I.send}${esc(N.copy.send)}</button>
        </div>
        <p class="peelWhy">${esc(N.copy.payload)}</p>
      </div>`;
  }

  function readSheet(note) {
    const src = N.sources[note.source];
    const isPeeling = peeling === note.id;
    /* The words that will cross are marked inside the person's own
       sentence, so what crosses can be checked against where it came
       from without either of them being covered. */
    /* While a task is being written, the words that will cross stay marked
       inside the person's own sentence, so what crosses can be checked
       against where it came from without either being covered. */
    const mark = isPeeling ? pickedWords : null;
    const bodyHtml =
      mark && note.body.includes(mark)
        ? esc(note.body).replace(esc(mark), `<span class="pick">${esc(mark)}</span>`)
        : `<span class="lede">${esc(note.title)}</span>${note.rest ? ` ${esc(note.rest)}` : ""}`;
    if (isPeeling) {
      return deskOf(
        `<div class="top">
          <p class="readSrc">
            ${I[src.icon]}<span>${src.label}</span>
            <span class="sep" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span>
            <span class="sep" aria-hidden="true"></span><span>${esc(note.about.label)}</span>
          </p>
          <p class="readBody">${bodyHtml}</p>
          ${sentTask ? "" : `<p class="stays">${I.lock}${esc(N.copy.stayedPut)}</p>`}
        </div>`,
        { behind: 1, label: `Turning a note into a task: ${note.title}`, under: peelPanel(note) },
      );
    }
    return deskOf(
      `<div class="top">
        <p class="readSrc">
          ${I[src.icon]}<span>${src.label}</span>
          <span class="sep" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span>
          <span class="sep" aria-hidden="true"></span><span>${esc(note.about.label)}${note.about.when ? `, ${esc(note.about.when)}` : ""}</span>
          ${note.edited ? '<span class="sep" aria-hidden="true"></span><span>edited</span>' : ""}
          ${note.sent ? `<span class="sep" aria-hidden="true"></span><span>In Tasks as <a href="#tasks">${esc(note.task || "a task")}</a></span>` : ""}
        </p>
        <p class="readBody"><span class="lede">${esc(note.title)}</span>${note.rest ? ` ${esc(note.rest)}` : ""}</p>
        ${picked ? `<div class="pickBar"><span class="pickCount tab">${picked.split(/\s+/).length} words picked</span><button class="act" data-ink type="button" data-act="peel">${I.tasks}${esc(N.copy.begin)}</button></div>` : ""}
        ${nudge ? `<p class="nudge" role="status">${I.alert}${esc(nudge)}</p>` : ""}
        <div class="topFoot">
          <button class="act" data-primary type="button" data-act="peel">${I.tasks}Turn into a task</button>
          <button class="act" type="button" data-act="timeline">${I.share}Send to Timeline</button>
          <button class="act" data-quiet type="button" data-act="more" aria-label="More actions for this note">${I.dots}</button>
          <span class="spacer"></span>
          <button class="act" data-quiet type="button" data-act="close">Put it back<kbd>Esc</kbd></button>
        </div>
      </div>`,
      { behind: 1, label: `Reading: ${note.title}` },
    );
  }

  /* ── the index ───────────────────────────────────────────────── */
  /* A match is marked inside the person's own words. Escaping happens
     first and the mark is inserted into the escaped string, so a note
     containing a bracket cannot become markup. */
  function hl(text) {
    const safe = esc(text);
    if (!query.trim()) return safe;
    const needle = esc(query.trim()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return safe.replace(new RegExp(`(${needle})`, "gi"), "<mark>$1</mark>");
  }

  function idxRow(note, opts) {
    const o = opts || {};
    const src = N.sources[note.source];
    /* The ledger of what has crossed shows the WORDS THAT CROSSED, never
       the private note they came from. The whole promise of this product
       is that the note stayed here; a ledger that reprints it is the one
       surface that must not. */
    const crossed = o.mode === "crossed";
    const lede = crossed ? note.task : note.title;
    const rest = crossed ? "" : note.rest;
    const when = crossed ? note.crossedWhen || note.when : note.when;
    const name = crossed
      ? `${note.task}. In Tasks, ${note.lane}. Crossed ${when}. The note it came from stayed in Notes.`
      : `${note.title} ${note.rest || ""}`.trim() +
        `. ${src.label}. ${note.when}.${note.pending ? " To decide." : note.sent ? " In Tasks." : " Kept."}`;
    const tag = crossed
      ? `<span class="idxTag">${esc(note.lane)}</span>`
      : note.sent
        ? `<span class="idxTag">In Tasks</span>`
        : note.pending
          ? `<span class="idxTag">To decide</span>`
          : `<span class="idxTag" data-quiet>Kept</span>`;
    const cursor = note.id === cursorId ? " data-cursor" : "";
    const open = note.id === openId ? " data-open" : "";
    const arrivingNow = note.id === arriving ? " data-arriving" : "";
    return `
      <button class="idxRow" type="button" data-id="${attr(note.id)}"${cursor}${open}${arrivingNow}
        tabindex="${note.id === cursorId ? "0" : "-1"}"
        aria-label="${attr(name)}">
        <span class="idxMark" aria-hidden="true">${crossed ? I.tasks : I[src.icon]}${!crossed && note.pending ? "<i></i>" : ""}</span>
        <span class="idxText" data-full="${attr(crossed ? note.task : `${note.title} ${note.rest || ""}`.trim())}" data-lede="${attr(lede)}"><b>${hl(lede)}</b>${rest ? ` <span>${hl(rest)}</span>` : ""}${crossed ? '<span class="idxFrom">from a note that stayed here</span>' : ""}</span>
        ${tag}
        <span class="idxWhen tab">${esc(when)}</span>
      </button>`;
  }

  /* The index can be read two ways, and both are true.
     By day is when you wrote it. By subject is what it is about — which
     Saturday, which couple, the house, the course. A notebook grouped only
     by the day it was captured is a notebook that would look identical if
     it belonged to anyone doing anything; this one knows that these notes
     are about a wedding on Saturday, and says so. */
  function groupsOf(notes) {
    if (group === "about") {
      const order = [];
      const bag = new Map();
      for (const note of notes) {
        if (!bag.has(note.aboutKey)) {
          bag.set(note.aboutKey, []);
          order.push(note.aboutKey);
        }
        bag.get(note.aboutKey).push(note);
      }
      /* By what the venue is facing, then by date inside that. The day the
         house is running comes before a dated commitment that is not the
         business, which comes before standing work. */
      order.sort((a, b) => {
        const A = N.subjects[a];
        const B = N.subjects[b];
        if (A.stake !== B.stake) return A.stake - B.stake;
        if (A.days === null && B.days === null) return bag.get(b).length - bag.get(a).length;
        if (A.days === null) return 1;
        if (B.days === null) return -1;
        return A.days - B.days;
      });
      /* Every group's slot means the same thing: the date it is facing, or
         that it has none. A count in one and a deadline in another was two
         meanings in one column. */
      return order.map((key) => {
        const about = N.subjects[key];
        const waiting = bag.get(key).filter((n) => n.pending).length;
        return {
          label: about.label,
          note:
            about.days === null
              ? "No date"
              : about.days === 0
                ? `${about.when}, today`
                : `${about.when}, in ${about.days} day${about.days === 1 ? "" : "s"}`,
          tail: waiting ? `${waiting} to decide` : "",
          rows: bag.get(key),
        };
      });
    }
    const order = [];
    const bag = new Map();
    for (const note of notes) {
      if (!bag.has(note.day)) {
        bag.set(note.day, []);
        order.push(note.day);
      }
      bag.get(note.day).push(note);
    }
    return order.map((day) => ({ label: day, note: "", tail: "", rows: bag.get(day) }));
  }

  function groupControl() {
    return `
      <span class="groupBy" role="group" aria-label="How the pile is grouped">
        <button class="groupBtn" type="button" data-act="group-about"${group === "about" ? " data-on" : ""} aria-pressed="${group === "about"}">What it is about</button>
        <button class="groupBtn" type="button" data-act="group-day"${group === "day" ? " data-on" : ""} aria-pressed="${group === "day"}">When</button>
      </span>`;
  }

  function indexOf(notes, opts) {
    const o = opts || {};
    const rows = [];
    if (o.noDays) {
      for (const note of notes) rows.push(idxRow(note, o));
    } else {
      for (const g of groupsOf(notes)) {
        rows.push(
          `<p class="idxDay">${esc(g.label)}${g.note ? `<span class="idxDayNote">${esc(g.note)}</span>` : ""}${g.tail ? `<span class="idxDayTail">${esc(g.tail)}</span>` : ""}</p>`,
        );
        for (const note of g.rows) rows.push(idxRow(note, o));
      }
    }
    if (!rows.length) rows.push(o.empty || "");
    return `
      <div class="indexWrap">
        <div class="indexHead">
          <span>${esc(o.title || "The pile")}</span>
          <span class="cnt">${esc(o.count || `${notes.length} notes`)}</span>
          ${o.group === false || o.noDays ? "" : groupControl()}
        </div>
        <div class="index" id="index" role="list" aria-label="${attr(o.title || "The pile")}">${rows.join("")}</div>
      </div>`;
  }

  /* ── states ──────────────────────────────────────────────────── */
  const STATES = {};

  const notebook = () => {
    const rows = visible();
    const open = openId ? work().find((n) => n.id === openId) : null;
    const c = counts();
    return {
      desk: open ? readSheet(open) : topSheet(),
      body: indexOf(rows, { title: "The pile", count: `${c.total} notes` }),
      dock: true,
    };
  };
  STATES.notebook = notebook;
  STATES.capture = notebook;
  STATES.pressure = () => {
    const open = openId ? work().find((n) => n.id === openId) : null;
    return {
      desk: open
        ? readSheet(open)
        : deskOf(
            `<div class="top">
              <p class="readSrc">${I.typed}<span>Written</span><span class="sep" aria-hidden="true"></span><span class="tab">${esc(N.long.when)}</span><span class="sep" aria-hidden="true"></span><span>${N.long.words} words</span></p>
              <p class="readBody readLong">${esc(N.long.body)}</p>
              <div class="topFoot">
                <button class="act" data-primary type="button" data-act="peel">${I.tasks}Turn into a task</button>
                <button class="act" data-quiet type="button" data-act="more" aria-label="More actions for this note">${I.dots}</button>
                <span class="spacer"></span>
                <button class="act" data-quiet type="button" data-act="close">Put it back<kbd>Esc</kbd></button>
              </div>
            </div>`,
            { behind: 1, label: `Reading: ${N.long.title}` },
          ),
      body: indexOf(visible(), {
        title: "The pile",
        count: `${counts().total} notes, peak season, an extension of the fixture`,
        noDays: true,
      }),
      dock: true,
    };
  };

  STATES.review = () => {
    const note = queue()[queueAt];
    const left = Math.max(0, queue().length - queueAt);
    /* The count is of decisions MADE, not of an index into a list that
       shrinks under it. Marking a note decided removes it from the queue,
       so an index-based count stood still while the card behind it
       changed. */
    const total = queue().length + decided.length;
    const pips = Array.from({ length: total }, (_, i) =>
      `<i${i < decided.length ? " data-done" : i === decided.length ? " data-now" : ""}></i>`).join("");
    if (!note) {
      return {
        desk: deskOf(
          `<div class="top">
            <h2 class="emptyTitle">Everything is decided.</h2>
            <p class="emptyBody">${decided.length} notes went through. ${decided.filter((d) => d.kind === "task").length} became tasks and the rest stayed here.</p>
            <div class="emptyMove">
              <button class="act" data-ink type="button" data-act="tasks">${I.tasks}See them in Tasks</button>
              <button class="act" type="button" data-act="notebook">${I.arrowRight}Back to the pile</button>
            </div>
          </div>`,
          { behind: 0, label: "Nothing left to decide" },
        ),
        body: indexOf(work().filter((n) => !n.pending).slice(0, 8), { title: "The pile", count: `${counts().total} notes`, noDays: true }),
        dock: true,
      };
    }
    const depth = Math.min(3, Math.max(0, left - 1));
    const src = N.sources[note.source];
    return {
      desk: `
        <section class="desk" aria-label="Notes waiting on a decision">
          <div class="hand">
            <div class="handStack">
            ${Array.from({ length: depth }, (_, i) => `<div class="handCard" data-n="${depth - i}" aria-hidden="true"></div>`).join("")}
            <article class="handTop"${settling === "hand" ? " data-settling" : ""}>
              <div class="handQ">
                <h2 class="handTitle">Worth doing something about?</h2>
                <span class="handOf tab">${decided.length + 1} of ${total}</span>
                <span class="pips" role="img" aria-label="${decided.length} of ${total} decided">${pips}</span>
              </div>
              <p class="readSrc">${I[src.icon]}<span>${src.label}</span><span class="sep" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span></p>
              <p class="handBody">${esc(note.body)}</p>
              <div class="handFoot">
                <button class="act" data-primary type="button" data-act="d-task">${I.tasks}Turn into a task<kbd>T</kbd></button>
                <button class="act" type="button" data-act="d-keep">${I.keep}Just keep it<kbd>K</kbd></button>
                <span class="spacer"></span>
                <button class="act" data-quiet type="button" data-act="d-later">Decide later</button>
                <button class="act" data-quiet data-destroy type="button" data-act="d-delete">${I.trash}Delete</button>
                <button class="act" data-quiet type="button" data-act="notebook">Back to the pile<kbd>Esc</kbd></button>
              </div>
            </article>
            </div>
            ${peeling === note.id ? peelPanel(note) : ""}
            <p class="deckNote">${I.undo}<span data-left>${left} still to decide.</span> ${
              decided.length
                ? `${decided.length} decided just now, and every one of them can be put back.`
                : "Nothing is decided until you say so, and every decision can be put back."
            }</p>
          </div>
        </section>`,
      body: indexOf(queue().slice(queueAt + 1), { title: "Still in the hand", count: `${Math.max(0, left - 1)} left`, noDays: true }),
      dock: true,
    };
  };

  STATES.voice = () => {
    const said = N.speech.transcript;
    const cut = said.lastIndexOf(" ", 100);
    const bars = Array.from({ length: 28 }, (_, i) => 0.26 + 0.68 * Math.abs(Math.sin(i * 1.37)));
    const base = notebook();
    return {
      ...base,
      over: `
        <section class="dark" aria-label="Dictating">
          <div class="darkTop">
            <span class="darkTag"><span class="rec" aria-hidden="true"></span>Listening</span>
            <span class="darkTime tab">0:07</span>
            <span class="spacer"></span>
          </div>
          <div class="darkBody">
            <p class="darkSaid" role="status">${esc(said.slice(0, cut))}<span class="tail"> ${esc(said.slice(cut + 1))}</span></p>
            <div class="darkWave" aria-hidden="true">${bars.map((b) => `<i style="height:${Math.round(b * 40)}px"></i>`).join("")}</div>
          </div>
          <div class="darkFoot">
            <p class="darkNote">${esc(N.copy.voiceDisclosure)}</p>
            <span class="spacer"></span>
            <button class="darkAct" type="button" data-act="voice-cancel">Cancel</button>
            <button class="darkAct" data-primary type="button" data-act="voice-stop">${I.stop}Stop and read it back</button>
          </div>
        </section>`,
    };
  };

  STATES.readback = () => ({
    desk: deskOf(
      `<div class="top">
        <p class="saidWas"><b>What you said, once</b>${esc(N.speech.transcript)}</p>
        <div class="pieces">
          ${pieces
            .map(
              (p, i) => `
            <div class="piece">
              <textarea class="pieceField" rows="1" data-i="${i}" aria-label="Note ${i + 1} of ${pieces.length}">${esc(p)}</textarea>
              <button class="drop" type="button" data-act="drop-piece" data-i="${i}" aria-label="Drop note ${i + 1}">${I.close}</button>
            </div>`,
            )
            .join("")}
        </div>
        <div class="topFoot">
          <button class="verb" type="button">${I.plus}Add another</button>
          <span class="spacer"></span>
          <span class="topMeta">${pieces.length} note${pieces.length === 1 ? "" : "s"}, not one</span>
          <button class="act" data-quiet type="button" data-act="discard-speech">Discard</button>
          <button class="act" data-ink type="button" data-act="keep-both">${I.check}Put ${pieces.length === 1 ? "it" : "both"} on the pile</button>
        </div>
      </div>`,
      { behind: 1, label: "What came back" },
    ),
    body: indexOf(work().slice(0, 8), { title: "The pile", count: `${counts().total} notes` }),
    dock: true,
  });

  STATES.seam = () => {
    const note = work().find((n) => n.id === peeling) || work()[13] || N.notes[13];
    /* Only on the way in. Re-peeling whenever `peeling` is null made
       cancelling the seam a no-op: Escape cleared it and the next paint
       put it straight back. */
    if (!peeling && !seamTouched) {
      peeling = note.id;
      seamTouched = true;
    }
    if (!pickedWords) pickedWords = note.pick || note.title.replace(/[.]$/, "");
    if (!taskWording) {
      taskWording = pickedWords.replace(/^[a-z]/, (c) => c.toUpperCase()).replace(/[.]$/, "");
    }
    return {
      desk: readSheet(note),
      body: indexOf(N.crossed, {
        title: "What has crossed into Tasks",
        count: `${N.counts.sent} so far, and every note stayed here`,
        noDays: true,
        mode: "crossed",
        group: false,
      }),
      dock: true,
    };
  };

  /* The nearest thing the notebook actually has, computed, not asserted.
     The panel found the product stating with full confidence that the
     nearest note to the nonsense query "drahcro" was one about the hire
     company — a hard-coded sentence, in a product whose whole claim is
     that it is honest about what it holds. */
  function nearest(q) {
    const tokens = q.toLowerCase().split(/[^a-z0-9]+/i).filter((t) => t.length >= 3);
    if (!tokens.length) return null;
    let best = null;
    for (const note of work()) {
      const body = note.body.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        for (let len = token.length; len >= 3; len -= 1) {
          if (body.includes(token.slice(0, len))) {
            score += len / token.length;
            break;
          }
        }
      }
      if (score > 0 && (!best || score > best.score)) best = { note, score };
    }
    return best ? best.note : null;
  }

  STATES.search = () => {
    const rows = visible();
    const near = rows.length ? null : nearest(query);
    return {
      desk: `
        <div class="searchTop">
          <div class="searchBar">
            ${I.search}
            <input id="q" value="${esc(query)}" aria-label="Search notebook" placeholder="Search everything you wrote">
            <button class="esc" type="button" data-act="clear-search">Esc</button>
          </div>
        </div>`,
      body: indexOf(rows, {
        title: query ? "Found" : "Everything you have written",
        count: query ? `${rows.length} of ${counts().total} notes have “${query}” in them` : `${counts().total} notes`,
        noDays: true,
        empty: `
          <div class="noHits">
            <h2 class="emptyTitle">No note says “${esc(query)}”.</h2>
            <p class="emptyBody">${
              near
                ? `The closest is ${esc(near.about.label)}, from ${esc(near.when)}.`
                : "Nothing in the notebook is close to it either."
            }</p>
            <div class="emptyMove">
              ${near ? `<button class="act" data-ink type="button" data-act="nearest" data-id="${attr(near.id)}">${I.arrowRight}Open that one</button>` : ""}
              <button class="act" ${near ? 'data-quiet' : 'data-ink'} type="button" data-act="clear-search">Back to the pile</button>
            </div>
          </div>`,
      }),
      dock: true,
    };
  };

  STATES.nothing = () => ({
    desk: deskOf(
      `<div class="top">
        <h2 class="emptyTitle">${esc(N.copy.emptyTitle)}</h2>
        <p class="emptyBody">Nobody else can read what you write here. Notes only sends something on when you pick the words yourself.</p>
        <div class="emptyMove">
          <button class="act" data-ink type="button" data-act="first">${I.typed}Write the first one</button>
          <button class="act" type="button" data-act="voice">${I.mic}Or say it</button>
        </div>
      </div>`,
      { behind: 0, label: "An empty notebook" },
    ),
    body: `
      <div class="indexWrap">
        <div class="indexHead"><span>Every other empty in this product</span><span class="cnt">one first move each</span></div>
        <div class="index">
          <div class="specs">
            <div class="spec">
              <p class="specName">Nothing matched</p>
              <h3 class="emptyTitle">No note says “marquee sides”.</h3>
              <p class="emptyBody">The closest is one about the hire company, from Thursday.</p>
              <div class="emptyMove"><button class="act" type="button">${I.search}Open that one</button><button class="act" data-quiet type="button">Clear the search</button></div>
              <p class="specWhy">A search with no hits offers the nearest thing it does have. A dead end is a defect.</p>
            </div>
            <div class="spec">
              <p class="specName">Nothing to decide</p>
              <h3 class="emptyTitle">Everything is decided.</h3>
              <p class="emptyBody">Eight notes went through this morning. Three became tasks and five stayed here.</p>
              <div class="emptyMove"><button class="act" type="button">${I.tasks}See the three in Tasks</button></div>
              <p class="specWhy">The end of a queue reports what the queue did, and points at where the work went.</p>
            </div>
            <div class="spec">
              <p class="specName">Nothing has crossed</p>
              <h3 class="emptyTitle">Nothing has left Notes yet.</h3>
              <p class="emptyBody">When you turn a note into a task, only the words you pick cross. This is where they get listed.</p>
              <div class="emptyMove"><button class="act" type="button">${I.arrowRight}Pick a note to start with</button></div>
              <p class="specWhy">An empty ledger explains the promise it exists to keep, then offers the one move that fills it.</p>
            </div>
            <div class="spec">
              <p class="specName">After a clear-out</p>
              <h3 class="emptyTitle">Your pile is empty again.</h3>
              <p class="emptyBody">Fourteen notes went to Tasks or were deleted. Nothing is waiting on you.</p>
              <div class="emptyMove"><button class="act" type="button" data-act="undo-delete">${I.undo}Undo the last delete</button></div>
              <p class="specWhy">An empty that follows an action is a different empty from a first-use one, and it offers the way back.</p>
            </div>
          </div>
        </div>
      </div>`,
    dock: true,
  });

  STATES["not-yet"] = () => ({
    desk: deskOf(
      `<div class="top" data-live>
        <p class="readBody">Written while the connection was down.</p>
        <div class="topFoot">
          <span class="topMeta">Held on this device. Nothing is lost.</span>
          <span class="spacer"></span>
          <button class="act" type="button" data-act="retry">${I.undo}Try now</button>
        </div>
      </div>`,
      { behind: 1, label: "A note held on this device" },
    ),
    body: `
      <div class="indexWrap">
        <div class="indexHead"><span>When the product does not yet have your work</span><span class="cnt">nothing here is an apology</span></div>
        <div class="index">
          <div class="states">
            <div class="state" data-tone="hold">
              ${I.wifiOff}
              <div>
                <b>Held on this device</b>
                <p>You are offline, so this one is saved here. Notes will put it on the pile the moment you reconnect. Nothing is lost and nothing has left.</p>
              </div>
            </div>
            <div class="state">
              ${I.alert}
              <div>
                <b>That did not save</b>
                <p>Your words are still on the paper, exactly as you left them. Nothing has been cleared.</p>
              </div>
              <button class="act" type="button" data-act="retry">Save it again</button>
            </div>
            <div class="state">
              ${I.split}
              <div>
                <b>This note changed somewhere else</b>
                <p>${esc(N.copy.sourceChanged)}</p>
              </div>
              <button class="act" type="button">Read both</button>
            </div>
            <div class="state" data-tone="destroy">
              ${I.trash}
              <div>
                <b>Delete this note?</b>
                <p>It has not been sent anywhere, so deleting it here deletes it everywhere. You can undo this for thirty seconds.</p>
              </div>
              <button class="act" data-ink type="button" data-act="destroy">Delete it</button>
            </div>
            <div>
              <p class="idxDay">Still arriving</p>
              ${[88, 64, 92, 58]
                .map(
                  (w) =>
                    `<div class="skelRow" aria-hidden="true"><div class="sk" style="width:${w}%"></div><div class="sk" style="width:${Math.round(w * 0.6)}%"></div></div>`,
                )
                .join("")}
              <p class="skelSay" role="status">Opening your notebook. Fourteen notes, newest first.</p>
            </div>
          </div>
        </div>
      </div>`,
    dock: true,
  });

  /* ── paint ───────────────────────────────────────────────────── */
  const mount = document.getElementById("root");

  function paint() {
    /* Nothing here may cost the operator their place. Both the index's
       scroll and the caret in whatever field they are typing in are
       captured before the repaint and restored after it. */
    const indexBefore = document.getElementById("index");
    const scroll = indexBefore ? indexBefore.scrollTop : 0;
    const active = document.activeElement;
    /* A field is found again by id first and by its own class second. The
       class alone produced the selector "." for any field without one,
       which threw and took the whole repaint with it. */
    const caret =
      active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")
        ? {
            sel: active.id
              ? `#${active.id}`
              : active.classList[0]
                ? `.${active.classList[0]}`
                : null,
            start: active.selectionStart,
            end: active.selectionEnd,
          }
        : null;

    const build = STATES[state] || STATES.notebook;
    const s = build();
    mount.innerHTML = `
      <div class="floor">
        ${rail()}
        <main class="sheet">
          ${head()}
          ${s.desk || ""}
          ${s.body || ""}
          ${s.dock ? dock() : ""}
          ${undoStrip()}
        </main>
        ${s.over || ""}
      </div>`;

    const indexAfter = document.getElementById("index");
    if (indexAfter) indexAfter.scrollTop = scroll;
    trimRows();

    /* Taking the whole floor to ink has to take the keyboard with it. The
       overlay paints after the sheet, so without this the way out of
       dictation was seventeen tab stops behind a notebook nobody can see,
       and a screen-reader user was reading a pile of notes while the
       microphone was live. */
    const over = mount.querySelector(".dark");
    for (const behindIt of mount.querySelectorAll(".sheet, .rail")) {
      if (over) behindIt.setAttribute("inert", "");
      else behindIt.removeAttribute("inert");
    }

    if (refocus) {
      if (refocus.kind === "act") {
        const target = mount.querySelector(refocus.sel);
        if (target) target.focus({ preventScroll: true });
      } else if (refocus.kind === "row") {
        const row = mount.querySelector(`.idxRow[data-id="${CSS.escape(refocus.id)}"]`);
        if (row) {
          row.focus({ preventScroll: true });
          row.scrollIntoView({ block: "nearest" });
        }
      } else if (refocus.kind === "read") {
        const close = mount.querySelector('[data-act="close"]');
        if (close) close.focus({ preventScroll: true });
      } else if (refocus.kind === "field") {
        const field = mount.querySelector(refocus.sel);
        if (field) field.focus({ preventScroll: true });
      }
      refocus = null;
    } else if (caret && caret.sel) {
      const field = mount.querySelector(caret.sel);
      if (field && field.setSelectionRange) {
        field.focus({ preventScroll: true });
        try {
          field.setSelectionRange(caret.start, caret.end);
        } catch {
          /* a field that does not support a range keeps focus and no caret */
        }
      }
    }
    document.documentElement.setAttribute("data-state", state);
    root.setAttribute("data-group", group);
  }

  /* ── events ──────────────────────────────────────────────────── */
  mount.addEventListener("input", (e) => {
    const field = e.target.closest(".topField, .phoneField");
    if (field) {
      draft = field.value;
      /* The counter is written straight into its own node. Repainting on
         every keystroke to update it would be the same defect the search
         field had: a repaint costs the caret. Repainting only when the
         sheet crosses from empty to live left the count frozen at whatever
         it was when the first character landed. */
      const live = Boolean(draft.trim());
      const wasLive = mount.querySelector("[data-live]") !== null;
      if (wasLive !== live) {
        paint();
        const again = mount.querySelector(field.className.includes("phoneField") ? ".phoneField" : ".topField");
        if (again) {
          again.focus({ preventScroll: true });
          again.setSelectionRange(field.selectionStart, field.selectionEnd);
        }
        return;
      }
      for (const node of mount.querySelectorAll(".topMeta[data-count], .dockCount")) {
        node.textContent = node.classList.contains("dockCount") ? String(draft.length) : `${draft.length} / 4000`;
      }
      return;
    }
    const q = e.target.closest("#q");
    if (q) {
      /* No refocus here. Setting one focused the field without restoring
         the caret, which put every new character at index 0 — typing
         "marquee" produced "eeuqram". The caret path in paint() already
         re-finds this field by id and restores the range. */
      query = q.value;
      paint();
      return;
    }
    const piece = e.target.closest(".pieceField");
    if (piece) {
      pieces[Number(piece.dataset.i)] = piece.value;
      return;
    }
    const wording = e.target.closest(".peelField");
    if (wording) taskWording = wording.value;
  });

  mount.addEventListener("click", (e) => {
    const row = e.target.closest(".idxRow");
    if (row) {
      openNote(row.dataset.id);
      return;
    }
    const act = e.target.closest("[data-act]");
    if (!act) return;
    const a = act.dataset.act;
    if (a === "group-day" || a === "group-about") {
      group = a === "group-day" ? "day" : "about";
      say(group === "about" ? "Grouped by what each note is about." : "Grouped by when each note was written.");
      refocus = { kind: "act", sel: `[data-act="${a}"]` };
      paint();
      return;
    }
    if (a === "peel") { startPeel(openId); return; }
    if (a === "cancel-peel") { cancelPeel(); return; }
    if (a === "send") { sendPeel(); return; }
    if (a === "close-peel" || a === "open-task") {
      peeling = null;
      sentTask = null;
      say(a === "open-task" ? "Opening Tasks. Your note stayed here." : "Done. Your note stayed here.");
      refocus = { kind: "read" };
      paint();
      return;
    }
    if (a === "write") {
      openId = null;
      peeling = null;
      refocus = { kind: "field", sel: phone.matches ? ".phoneField" : ".topField" };
      say("Ready to write.");
      paint();
      return;
    }
    if (a === "nearest") {
      query = "";
      state = "notebook";
      openNote(act.dataset.id);
      return;
    }
    if (a === "drop-piece") {
      const i = Number(act.dataset.i);
      const dropped = pieces[i];
      pieces = pieces.filter((_, n) => n !== i);
      say(`Dropped. ${pieces.length} left.`);
      offerUndo("Dropped one of them.", () => {
        pieces = [...pieces.slice(0, i), dropped, ...pieces.slice(i)];
      });
      paint();
      return;
    }
    if (a === "discard-speech") {
      state = "notebook";
      pieces = N.speech.separated.slice();
      say("Discarded. Nothing was kept.");
      paint();
      return;
    }
    if (a === "timeline" || a === "more" || a === "privacy" || a === "options" || a === "photo" || a === "retry" || a === "destroy") {
      /* Named so the panel can see they are deliberately inert in the lab
         rather than dead: each belongs to a surface outside this master. */
      say("Not part of this exploration.");
      return;
    }
    if (a === "keep" || a === "first") {
      if (a === "first") {
        refocus = { kind: "field", sel: phone.matches ? ".phoneField" : ".topField" };
        paint();
        return;
      }
      keepDraft();
    } else if (a === "close") closeNote();
    else if (a === "undo") doUndo();
    else if (a === "review") {
      state = "review";
      say(`${counts().pending} to decide.`);
      paint();
    } else if (a === "notebook" || a === "tasks") {
      state = "notebook";
      paint();
    } else if (a === "d-task") decide("task");
    else if (a === "d-keep") decide("keep");
    else if (a === "d-later") decide("later");
    else if (a === "d-delete") decide("delete");
    else if (a === "search") {
      state = "search";
      refocus = { kind: "field", sel: "#q" };
      paint();
    } else if (a === "clear-search") {
      query = "";
      refocus = { kind: "field", sel: "#q" };
      paint();
    } else if (a === "voice") {
      state = "voice";
      pieces = N.speech.separated.slice();
      say("Listening. Speak whenever you are ready. Stop when you are done.");
      refocus = { kind: "act", sel: '[data-act="voice-stop"]' };
      paint();
    } else if (a === "voice-cancel" || a === "voice-stop") {
      state = a === "voice-stop" ? "readback" : "notebook";
      say(a === "voice-stop" ? "Two notes came back from that." : "Nothing was kept.");
      paint();
    } else if (a === "keep-both") {
      /* The edited values, not the ones the model first proposed. A person
         who fixes a transcription and presses keep has to get the fixed
         version; before this the button announced two notes and added
         neither. */
      const made = pieces
        .map((body) => body.trim())
        .filter(Boolean)
        .map((body, i) => {
          const title = body.split(/(?<=[.?!”])\s/)[0] || body;
          return {
            id: `spoken_${Date.now()}_${i}`,
            body,
            title,
            rest: body.slice(title.length).trim(),
            source: "voice",
            when: "Just now",
            day: "Today",
            ms: 0,
            task: null,
            sent: false,
            reviewed: false,
            edited: false,
            pending: true,
            words: body.trim().split(/\s+/).length,
            about: N.subjects["mara-finn"],
            aboutKey: "mara-finn",
          };
        });
      for (const note of [...made].reverse()) work().unshift(note);
      state = "notebook";
      arriving = made.length ? made[0].id : null;
      say(`${made.length} note${made.length === 1 ? "" : "s"} on the pile. ${counts().total} in the notebook.`);
      offerUndo(`${made.length} kept from what you said.`, () => {
        WORK = work().filter((n) => !made.includes(n));
        state = "readback";
      });
      paint();
      setTimeout(() => {
        arriving = null;
        paint();
      }, 600);
    }
  });

  /* The whole keyboard model, in one place, so nothing can advertise a key
     the file does not answer. */
  addEventListener("keydown", (e) => {
    const typing = e.target.matches("textarea, input, [contenteditable]");

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      /* While there is a live draft in the capture field, undo belongs to
         the browser and to the words being typed. Intercepting it there
         reverted the previously saved note and overwrote the draft the
         person was in the middle of writing — undo destroying work is the
         worst possible failure in a capture product. */
      if (typing && e.target.closest(".topField, .phoneField") && draft.trim()) return;
      if (doUndo()) e.preventDefault();
      return;
    }
    /* The caret starts in the capture field, which is the whole point, so
       a bare slash can never reach a shortcut handler — it is a character
       somebody is typing into their note. Search therefore answers the
       chord that works while writing, and the dock advertises that chord
       rather than one the file cannot honour. */
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openSearch();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (draft.trim()) {
        e.preventDefault();
        keepDraft();
      }
      return;
    }
    if (e.key === "Escape") {
      if (peeling) {
        e.preventDefault();
        cancelPeel();
        return;
      }
      if (state === "review") {
        e.preventDefault();
        state = "notebook";
        say("Back to the pile.");
        paint();
        return;
      }
      if (state === "readback") {
        e.preventDefault();
        state = "notebook";
        pieces = N.speech.separated.slice();
        say("Discarded. Nothing was kept.");
        paint();
        return;
      }
      if (state === "voice") {
        state = "notebook";
        say("Nothing was kept.");
        paint();
        return;
      }
      if (state === "search") {
        if (query) {
          query = "";
          refocus = { kind: "field", sel: "#q" };
          paint();
        } else {
          state = "notebook";
          paint();
        }
        return;
      }
      if (openId) {
        e.preventDefault();
        closeNote();
      }
      return;
    }
    /* A takeover holds the keyboard until it is left. Inerting what is
       behind it stops Tab reaching the notebook, but the last control
       still handed focus to the document body, so a keyboard user fell out
       of a live microphone into nothing. This wraps. */
    if (state === "voice" && e.key === "Tab") {
      const stops = [...mount.querySelectorAll(".dark button, .dark [tabindex]:not([tabindex='-1'])")];
      if (stops.length) {
        const at = stops.indexOf(document.activeElement);
        const next = e.shiftKey ? at - 1 : at + 1;
        if (at === -1 || next < 0 || next >= stops.length) {
          e.preventDefault();
          stops[e.shiftKey ? stops.length - 1 : 0].focus();
        }
      }
      return;
    }

    if (typing) return;

    if (e.key === "/") {
      e.preventDefault();
      openSearch();
      return;
    }
    if (state === "review") {
      const key = e.key.toLowerCase();
      if (key === "t") {
        e.preventDefault();
        decide("task");
        return;
      }
      if (key === "k") {
        e.preventDefault();
        decide("keep");
        return;
      }
    }
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      moveCursor(1);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      moveCursor(-1);
    } else if ((e.key === "Enter" || e.key === " ") && e.target.closest(".idxRow")) {
      /* The row is a button, so the browser already does this. It is
         written down so the model is complete in one place. */
    }
  });

  /* Picking is a pointer gesture and a keyboard one, so both are watched.
     selectionchange fires on the document, which is why this is not bound
     to the note body. */
  document.addEventListener("selectionchange", () => {
    if (!openId || peeling) return;
    clearTimeout(pickTimer);
    pickTimer = setTimeout(offerPick, 120);
  });
  let pickTimer = null;

  /* A trim measured against a fallback face is a trim measured against the
     wrong widths, and one measured before a resize is simply stale. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(trimRows);
  let resizeTimer = null;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(trimRows, 90);
  });

  /* The container decides, so the container is what is watched. */
  phone.matches = readWidth();
  if (typeof ResizeObserver === "function") {
    const mountEl = document.getElementById("root");
    new ResizeObserver(() => {
      const next = readWidth();
      if (next !== phone.matches) {
        phone.matches = next;
        paint();
      }
    }).observe(mountEl.parentElement || mountEl);
  }
  addEventListener("resize", () => {
    const next = readWidth();
    if (next !== phone.matches) {
      phone.matches = next;
      paint();
    }
  });

  /* Seed the cursor on the first row so the index always has a tab stop. */
  if (!cursorId) {
    const first = visible()[0];
    if (first) cursorId = first.id;
  }
  if (state === "capture") {
    draft = "Ring the marquee company back about the side panels. They close at four on a Friday, so it has to be before then.";
  }
  if (state === "search" && !query) query = "orchard";
  if (state === "notebook" && params.get("open")) openId = params.get("open");

  paint();

  /* Three seconds between a thought and it being safe, and the file was
     spending nine tab presses of them on navigation. The caret starts
     where the thought goes. */
  {
    const field = mount.querySelector(".topField, .phoneField");
    if (field && !params.get("nofocus")) field.focus({ preventScroll: true });
  }

  /* The console drives the same file through this. */
  window.NOTEBOOK = {
    presets: PRESETS,
    decisions: DECISIONS,
    setState(next) {
      state = next;
      openId = null;
      if (next === "capture") {
        draft = "Ring the marquee company back about the side panels. They close at four on a Friday, so it has to be before then.";
      } else if (next !== "search") {
        draft = "";
      }
      if (next === "search") query = query || "orchard";
      else query = "";
      queueAt = 0;
      decided = [];
      undone = null;
      peeling = null;
      sentTask = null;
      taskWording = "";
      arriving = null;
      seamTouched = false;
      pieces = N.speech.separated.slice();
      WORK = null;
      cursorId = (visible()[0] || {}).id || null;
      paint();
      const field = mount.querySelector(".topField, .phoneField");
      if (field) field.focus({ preventScroll: true });
    },
    state: () => state,
  };
})();
