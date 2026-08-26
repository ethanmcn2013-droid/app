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
  const params = window.__SUITE.params("notes");
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
  const root = window.__SUITE.root("notes");
  const preset = PRESETS[variant] || PRESETS.locked;
  root.setAttribute("data-variant", variant);
  for (const key of DECISIONS) root.setAttribute("data-" + key, params.get(key) || preset[key]);

  /* ── the mutable world ───────────────────────────────────────── */
  let state = params.get("state") || "notebook";
  let WORK = null;        /* the notebook, seeded from the fixture         */
  /* The ledger of what has crossed. It read from the fixture constant, so
     the one surface whose whole job is to hold the trace of the product's
     central act was the one surface the act never reached. */
  const CROSSED = N.crossed.slice();
  let draft = "";         /* what is on the top sheet and not yet saved    */
  let openId = null;      /* the note lifted onto the desk                 */
  let cursorId = null;    /* the index's single tab stop                   */
  let query = "";         /* the search                                    */
  let queueAt = 0;        /* how far through the hand                      */
  let decided = [];       /* what the hand has settled, newest last        */
  let deferred = [];      /* cards put to the back: not decisions           */
  let sentAt = null;      /* the sentence a keyboard has picked, [from,to]  */
  let editing = null;     /* the note being written on a second visit        */
  let editDraft = "";     /* what it says while it is being written          */
  /* What the whole notebook is narrowed to. The product knew the house was
     facing Mara & Finn on Saturday, printed it in its largest type, and
     then did nothing with it: the pile was still everything, the hand
     still dealt everything, and the same string was repeated inertly as a
     group rule below. A subject you can press is the difference between a
     notes app that contains wedding words and a venue's notebook. */
  let scope = null;
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
  /* What the next note is about. It opens on whatever the venue is
     facing, because that is what a person walking the building is almost
     always writing about. Until this existed the subject axis was a
     rendering of pre-tagged fixture data: every note anybody actually
     wrote was filed silently under The house. */
  let filing = "mara-finn";
  let picker = null;      /* the open subject picker, if any                 */
  let inputTimer = null;
  let confirming = null;   /* the note delete is asking about              */
  let searchSaid = null;   /* debounce for what search says out loud        */
  /* Where a press began, so a drag can be told from a tap. Without it
     the sentence-click handler fired at the end of every drag whose ends
     landed in one span, threw the dragged phrase away and picked the
     whole sentence — which made the word-safe snap unreachable by the
     one gesture it was written for. */
  let pressAt = null;
  /* True when the mark on screen was restored from a previous session
     rather than made just now. The heading promises only picked words
     cross; a mark nobody made must say so. */
  let pickRestored = false;
  /* Which note the restored mark has already been offered for. */
  let promotedFor = null;
  /* True for exactly the one repaint that lifts a note onto the desk. */
  let lifting = false;
  /* THE CEILING THE PRODUCT ACTUALLY HOLDS.
     The lab printed "n / 4000" in five places and enforced nothing, so
     it stated a ceiling it did not hold. The number is wrong as well as
     unenforced: src/modules/notes/lib/notes-hybrid.ts sets
     MAX_NOTE_BODY_CHARS = 10_000, enforced in the hybrid, the hook and
     the server action. Enforcing 4000 here would replace a permissive
     lie with a strict one and refuse a 4,500-character note the real
     product saves — a lost thought on the writing surface, which is this
     product's own third named risk. The over-limit sentence is the
     product's too, verbatim from Composer.tsx. */
  const MAX_BODY = 10000;
  const counterText = (n) =>
    n > MAX_BODY
      ? `${(n - MAX_BODY).toLocaleString("en-IE")} character${n - MAX_BODY === 1 ? "" : "s"} over. Trim it or split it in two.`
      : `${n.toLocaleString("en-IE")} / ${MAX_BODY.toLocaleString("en-IE")}`;
  /* "1 words picked." came off a bare split().length in four places. */
  const wordsPicked = (t) => {
    const n = String(t || "").trim().split(/\s+/).filter(Boolean).length;
    return n === 1 ? "1 word picked." : n + " words picked.";
  };
  /* The seam's destination, seeded from the note and living only as long
     as the peel. It used to be read from N.projects — a workspace string
     that is not one of the listbox's five options, so the control's own
     current value was absent from its own list. */
  let destination = null;

  /* Everything the capture field's own words change, written on the next
     tick rather than during the input event. */
  /* The one change that cannot wait for a pause is the sheet waking, and
     it is made without touching the document: a CSS custom property on
     the root, which the stylesheet reads. Nothing in the tree changes, so
     the browser's typing history is untouched. */
  /* The commit control used to be INSERTED by applyDraft on a 450ms
     debounce, so for the whole of the three seconds this product is
     named for the affordance that makes a thought safe was not on
     screen — and on a phone, where there is no chord, there was no way
     to keep the note at all while typing steadily. The debounce was
     protecting the browser's typing history from a mid-burst DOM
     mutation, which is the right problem and the wrong fix: it solved
     it by removing a control. The control is now always in the tree and
     this swaps visibility instead — no node created or destroyed during
     input, and visibility:hidden takes it out of the tab order too, so
     nothing is ever invisible-but-focusable. */
  function wakeSheet(live) {
    root.style.setProperty("--writing", live ? "1" : "0");
    root.style.setProperty("--commit-vis", live ? "visible" : "hidden");
    root.style.setProperty("--rest-vis", live ? "hidden" : "visible");
  }

  function applyDraft() {
    /* Nothing is inserted or removed here any more. The commit control
       and the resting privacy line are both always in the tree and
       wakeSheet swaps their visibility during the input event, so the
       affordance exists from the first character. All that is left to
       defer is the counter TEXT, which nobody needs mid-burst and which
       is the only write that must stay off the typing history. */
    const live = Boolean(draft.trim());
    const host = mount.querySelector(".top") || mount.querySelector(".dock");
    if (host) host.toggleAttribute("data-live", live);
    for (const node of mount.querySelectorAll(".topMeta[data-count], .dockCount")) {
      node.textContent = counterText(draft.length);
    }
  }

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
    const box = window.__SUITE.frame();
    const w = box ? box.getBoundingClientRect().width : 0;
    return (w || innerWidth) <= PHONE_AT;
  }

  function seed() {
    if (state === "nothing") return [];
    /* The two-hundred-word note was a picture of a note: it rendered only
       on a branch that could not be reached, so nothing in this build was
       ever measured against a long one. It is in the notebook now, which
       means it can be opened, picked from, written on and sent like any
       other note — and the pressure room simply opens it. */
    if (state === "pressure") return [N.long, ...N.dense];
    return N.notes.slice();
  }
  function work() {
    if (!WORK) WORK = seed();
    return WORK;
  }

  /* Every count on screen is derived from the same list, so the head can
     never state a number the body below it disagrees with. */
  function inScope(list) {
    return scope ? list.filter((n) => n.aboutKey === scope) : list;
  }
  function scopeLabel() {
    return scope && N.subjects[scope] ? N.subjects[scope].label : null;
  }
  function counts() {
    const w = inScope(work().filter((n) => !n.deleted));
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
  const region = window.__SUITE.region();
  const say = (text) => {
    region.textContent = text;
  };

  /* ── the way back ────────────────────────────────────────────── */
  /* Thirty seconds, said out loud, and the same number in every room. The
     product printed a thirty-second promise in one place and expired the
     strip silently at ten in another. */
  /* The hint said "either one" while the primary eight pixels away said
     "Keep both", and "either one" was already wrong the moment a third
     piece existed. One helper, read by the hint, the primary and the
     announcement, so the three cannot drift. */
  const editEither = (n) => (n === 1 ? "it" : n === 2 ? "either one" : "any of them");
  const keepWhich = (n) => (n === 1 ? "it" : n === 2 ? "both" : "them");
  /* The visible card said what to do and never how; the announcement
     fired by the same press said the useful thing. The sighted reader
     got the worse of the two. One string, one grammar, both audiences —
     which also removes a live-region redundancy, since both nodes are
     role=status and a screen reader heard two near-identical sentences
     for one press. */
  /* "Use the arrow keys inside the note, or drag across it" was false
     on a phone, which is where a couple planning a wedding actually
     reads. One gesture that is true everywhere. */
  const NUDGE_PICK =
    "Pick the words in the note that should become the task. Tap a sentence to pick it, drag across the words you want, or walk them with the arrow keys. Only those words go to Tasks.";
  const UNDO_SECONDS = 30;
  let undoTick = null;
  let undoLeft = UNDO_SECONDS;
  /* Two strings, because they are two different sentences. The strip
     states what just happened; the announcement after an undo has to
     state where the person now IS. "Undone. Sent to Tasks." is the exact
     opposite of what has occurred, read out loud at the moment somebody
     is least sure. */
  function offerUndo(label, undoneLabel, revert) {
    if (typeof undoneLabel === "function") {
      revert = undoneLabel;
      undoneLabel = `Put back. ${label}`;
    }
    undone = { label, undoneLabel, revert };
    clearTimeout(undoTimer);
    /* "for 30s" stood still for thirty seconds, so the one number that
       is actually running was the one number on the surface that never
       moved. It ticks, in the strip, which is the single carrier of
       this fact. */
    clearInterval(undoTick);
    undoLeft = UNDO_SECONDS;
    undoTick = setInterval(() => {
      undoLeft -= 1;
      const el = mount.querySelector(".undoFor");
      if (!el || undoLeft <= 0) {
        clearInterval(undoTick);
        return;
      }
      el.textContent = `for ${undoLeft} seconds`;
    }, 1000);
    undoTimer = setTimeout(() => {
      /* A clock nobody started must not move the keyboard. Repainting on
         expiry rebuilt the tree and dropped focus on the document body,
         so thirty seconds after a save the caret silently left whatever a
         person was doing. Removing one node costs nothing unless focus is
         inside it, and that one case is handled. */
      undone = null;
      clearInterval(undoTick);
      const strip = mount.querySelector(".undo");
      if (!strip) return;
      if (strip.contains(document.activeElement)) {
        const back = mount.querySelector(".idxRow[data-cursor]") || mount.querySelector(".topField, .phoneField");
        if (back) back.focus({ preventScroll: true });
      }
      strip.remove();
      const sheet = mount.querySelector(".sheet");
      if (sheet) sheet.removeAttribute("data-undo");
    }, UNDO_SECONDS * 1000);
  }
  function doUndo() {
    if (!undone) return false;
    const { revert, undoneLabel } = undone;
    undone = null;
    clearTimeout(undoTimer);
    clearInterval(undoTick);
    revert();
    say(undoneLabel);
    /* The universal way back was the only act in the file that repainted
       without naming a destination, so pressing it left the keyboard on
       document.body. Deliberately narrow: a stored destination breaks
       the cross-room case — undoing from inside search, where .topField
       does not exist, would consume refocus on a null target and skip
       the caret fallback, putting the search caret on the body. So this
       claims focus only when the control that was pressed is the one
       about to be removed. */
    const inStrip = document.activeElement && document.activeElement.closest(".undo");
    if (inStrip) {
      refocus = {
        kind: "field",
        sel: phone.matches ? ".phoneField" : ".topField",
      };
    }
    paint();
    return true;
  }

  /* ── acts ────────────────────────────────────────────────────── */
  /* One shape for a note, used everywhere one is made. Three call sites
     were building the object by hand and the newest one forgot `about`,
     so opening a note you had just written threw on note.about.label and
     took the whole repaint with it. */
  /* A note captured in three seconds does not have a full stop in it.
     Deriving the 600-weight lede from terminal punctuation therefore set
     every real capture entirely in semibold — the only hierarchy device
     this product has inside a person's own writing, decided by how
     carefully they punctuated.

     The word-safe budget that replaced it went the other way: it ran to
     88 characters and, failing that, cut at the last space before 46, so
     two thirds of the rendered characters in the index were semibold and
     a lede could end on "she". A hierarchy spent on nearly everything
     signals nothing, and a lede that stops mid-clause is a fragment, not
     a heading.

     One earned budget now. A lede is a COMPLETE sentence, short enough to
     lead, with something left after it to lead into. Anything else has no
     lede at all and renders whole at 400 — the honest treatment, and the
     one the `lede === false` path already gives. */
  /* The budget lives in data.js, beside the notes it shapes, and this
     file reads it. Two copies of one rule is how thirteen of the
     fourteen shipped notes came to ignore a budget this file declared,
     and how a thirty-eight-word note came to render entirely in 600. */
  const LEDE_MAX = N.LEDE_MAX;
  const ledeOf = N.ledeOf;

  function makeNote(body, opts) {
    const o = opts || {};
    const about = o.about || filing;
    const title = ledeOf(body) || body;
    return {
      id: o.id || `new_${Date.now()}_${Math.round(performance.now())}`,
      body,
      title,
      rest: body.slice(title.length).trim(),
      lede: Boolean(ledeOf(body)),
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
      about: N.subjects[about],
      aboutKey: about,
    };
  }

  function keepDraft() {
    const body = draft.trim();
    if (!body) return;
    const note = makeNote(body);
    draft = "";
    work().unshift(note);
    /* "Kept" was the capture receipt AND the hand's second-largest button
       AND the pill on a settled note — one word for three different acts,
       said out loud at the moment somebody is checking that the right
       thing happened. Capture saves. The hand keeps. One verb each. */
    say(`Saved. ${counts().total} notes, ${counts().pending} still to decide.`);
    /* The strip says what just happened, in the present, and the button
       says what pressing it will do. Written as the post-undo sentence and
       shown before the undo, it told the operator their note had already
       gone back to the sheet while it was sitting safely on the pile. */
    offerUndo("Saved.", "Put back. Your note is in the field again.", () => {
      WORK = work().filter((n) => n !== note);
      draft = body;
    });
    /* The capture field is where the next thought goes, so that is where
       the caret goes. Without this, keeping by mouse dropped focus to the
       body and the next thing typed went nowhere. */
    refocus = { kind: "field", sel: phone.matches ? ".phoneField" : ".topField" };
    /* The keyboard's cursor follows the thought. It held the note it was
       on by id, so the moment you kept something the new row arrived
       unemphasised at the top of its group while the indigo band stayed on
       the row below — the strongest ink on the paper pointing at the note
       you did not just write. */
    cursorId = note.id;
    arriving = note.id;
    if (reduced) {
      /* Reduced motion asks for no ANIMATION. It was being read as no
         event: the guard returned before the scroll and before the mark,
         so the one person who most needs to be told where their words
         went was the one person told nothing. The row is still brought
         into view and still marked; the mark is simply held rather than
         played. */
      paint();
      const still = mount.querySelector(`.idxRow[data-id="${CSS.escape(note.id)}"]`);
      if (still) still.scrollIntoView({ block: "center", behavior: "auto" });
      setTimeout(() => {
        arriving = null;
        paint();
      }, 620);
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
    /* Read the values, not the declaration. getComputedStyle returns a LIVE
       object, and paint() detaches the field before flyWords reads it — so
       every property came back empty and the product's signature moment
       rendered a person's own sentence in browser-default 16px/normal. */
    const cs = field ? getComputedStyle(field) : null;
    const size = cs
      ? { fontSize: cs.fontSize, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, fontWeight: cs.fontWeight }
      : null;
    paint();
    /* The words have to land somewhere the eye can follow. Filed under
       whatever the capture chip says, the new note could sit fourth group
       down and below the fold, so the moment the product exists for ended
       off screen. The pile scrolls to it first, then the words fly. */
    const rowEl = mount.querySelector(`.idxRow[data-id="${CSS.escape(note.id)}"]`);
    if (rowEl) rowEl.scrollIntoView({ block: "center" });
    const row = rowEl ? rowEl.querySelector(".idxText") : null;
    /* The row holds its breath until the words land on it, so the sentence
       is never printed in two places at once. */
    if (row) {
      row.style.opacity = "0";
      setTimeout(() => {
        row.style.opacity = "";
      }, 470);
    }
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
      `font-size:${(size && size.fontSize) || "17px"}`,
      `line-height:${(size && size.lineHeight) || "1.62"}`,
      `letter-spacing:${(size && size.letterSpacing) || "-0.021em"}`,
      `font-weight:${(size && size.fontWeight) || "400"}`,
    ].join(";");
    document.body.appendChild(ghost);
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const scale = Math.min(1, to.width / Math.max(1, from.width));
    const done = () => ghost.remove();
    /* The travel IS the moment, so the travel takes the time. It was
       covering the whole distance in 138ms of a 460ms animation and then
       hanging motionless for 320ms fading out, which reads as a blur
       followed by the same sentence printed twice. It arrives at the end
       now, and it hands over on contact. */
    const animation = ghost.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(${1 - (1 - scale) * 0.5})`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1, offset: 0.9 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0, offset: 1 },
      ],
      { duration: 520, easing: "cubic-bezier(0.32, 0.72, 0.24, 1)", fill: "forwards" },
    );
    animation.addEventListener("finish", done);
    animation.addEventListener("cancel", done);
    setTimeout(done, 900);
  }

  function queue() {
    return inScope(work().filter((n) => n.pending));
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
         in eight decisions.

         And it is literally the same sequence: one function, so the two
         rooms cannot drift into two preconditions. The hand used to open
         the seam from nothing while the desk refused — the same button,
         the same key, two behaviours, and the room you were standing in
         decided which promise applied. */
      startPeel(note.id);
      return;
    }
    if (kind === "delete" && confirming !== note.id) {
      /* The card printed "every decision can be put back" directly over a
         one-click, no-confirm verb whose own specimen room promises a
         confirmation and thirty seconds. It asks now, and the two rooms
         say the same number. */
      confirming = note.id;
      say(`Delete this note? It has not been sent anywhere, so this deletes it everywhere. You can undo this for ${UNDO_SECONDS} seconds.`);
      /* The confirmation used to open with the keyboard on Delete —
         the destroy button — so the very next Enter destroyed the note
         the question was asking about. It opens on the safe half. */
      refocus = { kind: "act", sel: '[data-act="d-delete-no"]' };
      paint();
      return;
    }
    confirming = null;
    /* Putting a card to the back is the one act in the hand that decides
       nothing, and it was counted, announced and undone as though it did:
       the counter read "2 of 9" for a queue of eight, "still to decide"
       fell by one for a note still to decide, and the strip credited the
       person with a decision they had explicitly declined to make. */
    const deferral = kind === "later";
    note.later = deferral;
    if (kind === "keep" || kind === "later") {
      note.pending = kind === "keep" ? false : true;
      note.reviewed = kind === "keep";
    } else if (kind === "delete") {
      note.deleted = true;
      note.pending = false;
    }
    if (kind !== "later") queueAt = before.queueAt;
    else queueAt += 1;
    if (deferral) deferred.push({ note, before });
    else decided.push({ note, kind, before });
    const left = queue().length - (deferral ? queueAt : 0);
    const label = deferral
      ? `Left for later. Still ${counts().pending} to decide.`
      : kind === "task"
        ? `Sent to Tasks. ${left} left.`
        : kind === "keep"
          ? `Kept in Notes. ${left} left.`
          : `Deleted. ${left} left.`;
    /* And it names the card it has just dealt, in the same grammar the
       index walk uses, so one sentence shape covers both planes. */
    const nextCard = queue()[deferral ? queueAt : before.queueAt];
    say(nextCard ? `${label} Next, ${nextCard.title}` : `${label} Nothing left to decide.`);
    if (!refocus) refocus = { kind: "act", sel: ".handBody" };
    /* The strip states what happened, in the present. One string was being
       painted before the undo and concatenated after it, so at the moment
       the ear heard "turned into a task" the eye read "that decision was
       put back". */
    const strip = deferral
      ? "That one goes to the back."
      : kind === "task"
        ? "Sent to Tasks."
        : kind === "keep"
          ? "Kept in Notes."
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
      if (deferral) deferred.pop();
      else decided.pop();
    });
    if (reduced) {
      paint();
      return;
    }
    settling = "hand";
    paint();
    setTimeout(() => {
      settling = null;
      /* decide() sets refocus to the card and it holds — until this
         repaint fires at 220ms with refocus already consumed and
         rebuilds the card, dropping the keyboard on the body after every
         single decision, in the one room built to be run from the
         keyboard. Restoring it blindly is worse and was measured so:
         after k then Escape the caret is in the capture field and a
         stale .handBody target would be null-but-truthy, skipping the
         caret fallback entirely; after k then t the caret is in the
         wording field and this would yank it out mid-typing. So restore
         only what is still true: the card is still on screen AND the
         keyboard has not already gone somewhere newer. */
      const card = mount.querySelector(".handBody");
      const active = document.activeElement;
      /* Restore where the keyboard is ALREADY the card — this repaint is
         about to destroy that element — or where it has been dropped on
         the body. Never over a newer destination: after Escape the caret
         is in the capture field and after t it is in the wording field,
         and both must survive. */
      const onCard = active && card && (active === card || card.contains(active));
      const adrift = !active || active === document.body;
      if (card && (onCard || adrift)) refocus = { kind: "act", sel: ".handBody" };
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
    /* A note being read and a card being decided are the same thing: the
       person's own words, with a decision to make about them. Picking
       works in both. */
    const bodies = [...mount.querySelectorAll(".readBody, .handBody")];
    if (!bodies.length) return null;
    const range = sel.getRangeAt(0);
    if (!bodies.some((b) => b.contains(range.commonAncestorContainer))) return null;
    /* WORD-SAFE, because the promise is the exact words. A drag takes
       raw character offsets, so beginning inside "photographs" crossed
       "hotographs until the room settled" — a beheaded word at the
       start and a severed one at the end — and the seam then read those
       back to her as her own words. The index solved this class rounds
       ago with its trims; the seam never inherited it. Each endpoint is
       walked outward only when it lands strictly INSIDE a word, so a
       drag already ending on a boundary does not swallow the next. */
    const host = bodies.find((h) => h.contains(range.commonAncestorContainer));
    const whole = host ? host.textContent : "";
    let text = sel.toString();
    if (whole) {
      const at = whole.indexOf(text);
      if (at >= 0) {
        let from = at;
        let to = at + text.length;
        const word = (ch) => ch !== undefined && /[^\s]/.test(ch);
        while (from > 0 && word(whole[from - 1]) && word(whole[from])) from -= 1;
        while (to < whole.length && word(whole[to]) && word(whole[to - 1])) to += 1;
        text = whole.slice(from, to);
        /* The snap is deliberately NOT re-applied to the live selection.
           This runs from selectionchange, so calling setBaseAndExtent
           here re-enters offerPick, and the repaint that follows wipes
           the native highlight anyway — the mark the reader actually
           sees is drawn from `picked`, which is now the snapped string. */
      }
    }
    text = text.replace(/\s+/g, " ").trim();
    if (text.length < 3) return null;
    return text;
  }

  /* The note as the sentences it is made of. A pointer picks by dragging
     across them; a keyboard picks by walking them. Both write the same
     `picked` string, so the mark, the strip and the primary's precondition
     never learn that there are two routes. */
  function sentencesOf(body) {
    const out = [];
    const re = /[^.?!”]*[.?!”]+[\s]*|[^.?!”]+$/g;
    let m;
    while ((m = re.exec(body))) {
      if (m[0].trim()) out.push(m[0]);
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
    return out.length ? out : [body];
  }
  /* THE NOTE IS AN INSTRUMENT.
     Clicking a sentence did nothing: the computed cursor on the body was
     `auto`, so the note offered no pointer affordance at all, and on a
     phone — no arrow keys, no other control — the product's promise
     reduced to "the exact words the machine picked for you". The
     sentences the arrow model already walks are now real spans, so the
     drawn pick, the keyboard pick and the pointer pick share one
     accessor. The mark is applied by character offset across those
     spans, which also survives a drag that does not align to a sentence
     — the string replace it used to do could not. */
  function bodyHtmlOf(note, mark) {
    const body = note.body;
    const parts = sentencesOf(body);
    let at = mark ? body.indexOf(mark) : -1;
    const from = at;
    const to = at >= 0 ? at + mark.length : -1;
    let cursor = 0;
    let out = "";
    parts.forEach((part, i) => {
      const start = cursor;
      const end = cursor + part.length;
      cursor = end;
      const classes = ["sent"];
      if (i === 0 && note.lede !== false) classes.push("lede");
      let inner = "";
      if (from < 0 || to <= start || from >= end) {
        inner = esc(part);
      } else {
        const a2 = Math.max(start, from) - start;
        const b2 = Math.min(end, to) - start;
        inner =
          esc(part.slice(0, a2)) +
          `<span class="pick">${esc(part.slice(a2, b2))}</span>` +
          esc(part.slice(b2));
      }
      out += `<span class="${classes.join(" ")}" data-i="${i}">${inner}</span>`;
    });
    return out;
  }

  function sentenceText(body, from, to) {
    const parts = sentencesOf(body);
    return parts.slice(from, to + 1).join("").trim();
  }
  /* Sealed edges are only sealed if you own a mouse — that was the state
     of the second promise this product makes. The words that cross are
     the words you picked, and until now picking was a drag gesture with
     no keyboard equivalent anywhere in the build. */
  function moveSentence(step, extend) {
    const note = pickTarget();
    if (!note) return false;
    const parts = sentencesOf(note.body);
    const at = sentAt || [0, 0];
    let from = at[0];
    let to = at[1];
    if (!sentAt) {
      from = 0;
      to = 0;
    } else if (extend) {
      to = Math.min(parts.length - 1, Math.max(from, to + step));
    } else {
      from = Math.min(parts.length - 1, Math.max(0, (step > 0 ? to : from) + step));
      to = from;
    }
    sentAt = [from, to];
    setPick(sentenceText(note.body, from, to), true);
    return true;
  }
  /* Forty presses to reach the last sentence of a long note is not a
     keyboard route, it is a keyboard obstacle course. */
  function jumpSentence(where, extend) {
    const note = pickTarget();
    if (!note) return false;
    const parts = sentencesOf(note.body);
    const at = sentAt || [0, 0];
    const from = where === "first" ? 0 : extend ? at[0] : parts.length - 1;
    const to = where === "first" ? (extend ? at[1] : 0) : parts.length - 1;
    sentAt = [Math.min(from, to), Math.max(from, to)];
    setPick(sentenceText(note.body, sentAt[0], sentAt[1]), true);
    return true;
  }
  function pickTarget() {
    if (state === "review") return queue()[queueAt] || null;
    if (openId) return work().find((n) => n.id === openId) || null;
    /* A peel open over a note makes that note the pick surface, even
       where the room set `peeling` without ever setting `openId`. This
       returned null there, so the note stayed a fully live-LOOKING pick
       surface — a tab stop, named as the instrument, drawing the mark —
       whose every pointer and key press did nothing at all. */
    if (peeling) return work().find((n) => n.id === peeling) || null;
    return null;
  }
  function setPick(text, acted) {
    /* paint() rebuilds the tree, and the pick surface is not a field, so
       nothing in the caret path brings it back. Without this the first
       arrow picked a sentence and dropped the keyboard on the document
       body, which made the second arrow do nothing at all. */
    refocus = { kind: "act", sel: state === "review" ? ".handBody" : ".readBody" };
    if (text === picked && !acted) {
      paint();
      return;
    }
    if (text === picked) {
      /* Same words, but the person just pressed a key: answer them, and
         the mark is theirs now rather than one the fixture restored. */
      pickRestored = false;
      couplePeel(text);
      /* couplePeel refuses to overwrite a hand-edited wording, which is
         right — nothing is silently deleted — but nothing else in the
         seam was told, so the mark, the lead panel and this line all
         named words the send would not use. When the wording has been
         edited, say what will actually cross, under the field's own
         label rather than the picked-words one. */
      const wordingEdited =
        peeling && taskWording.trim() && taskWording.trim() !== text.replace(/[.]$/, "");
      say(
        peeling
          ? wordingEdited
            ? `${wordsPicked(text)} ${N.copy.wordingLabel}: ${taskWording}. ${N.copy.payload}`
            : `${wordsPicked(text)} The task will use these words.`
          : `${wordsPicked(text)} ${N.copy.begin} to make them a task.`,
      );
      paint();
      return;
    }
    picked = text;
    couplePeel(text);
    if (text) {
      nudge = null;
      /* couplePeel refuses to overwrite a hand-edited wording, which is
         right — nothing is silently deleted — but nothing else in the
         seam was told, so the mark, the lead panel and this line all
         named words the send would not use. When the wording has been
         edited, say what will actually cross, under the field's own
         label rather than the picked-words one. */
      const wordingEdited =
        peeling && taskWording.trim() && taskWording.trim() !== text.replace(/[.]$/, "");
      say(
        peeling
          ? wordingEdited
            ? `${wordsPicked(text)} ${N.copy.wordingLabel}: ${taskWording}. ${N.copy.payload}`
            : `${wordsPicked(text)} The task will use these words.`
          : `${wordsPicked(text)} ${N.copy.begin} to make them a task.`,
      );
    } else {
      say("Nothing picked.");
    }
    paint();
  }
  function clearPick() {
    sentAt = null;
    pickRestored = false;
    if (!picked) return false;
    setPick(null);
    return true;
  }

  /* What will cross is what is marked. Both rooms used to fall back to a
     pick recorded on the note earlier while drawing nothing — so a button
     reading "Pick the words, then send" would send a sentence the person
     could not see, and the hand and the desk disagreed about which. One
     expression now answers three questions: what is drawn, what the
     primary says, and what the seam receives. */
  /* ONE variable answers what is marked. This used to fall back to the
     fixture's note.pick, so three notes opened already marked — fourteen
     words in indigo, the bar reading "14 words picked. Send to Tasks
     will use exactly these" and the primary armed — before anyone had
     picked anything, and the documented clear key could not touch it:
     clearPick returns early on !picked, so the product announced
     "Nothing picked." while the sentence stayed drawn and the primary
     stayed armed. A restored pick is a real product state; it is
     promoted into `picked` when the note is opened, so it is releasable
     by every route that releases any other pick. */
  function standingPick(note) {
    return note ? picked : picked;
  }
  /* Promote ONCE per note, and never again — the render calls this on
     every repaint, so without the guard releasing the mark just
     resurrected it on the next frame and the clear key could never win. */
  function promotePick(note) {
    if (!note || promotedFor === note.id) return;
    /* A restored mark belongs to the note it was restored from. Without
       this it followed you to the next card, so a card with no pick of
       its own arrived armed with somebody else's. A pick the PERSON made
       is theirs and persists, exactly as it did before. */
    if (pickRestored) {
      picked = null;
      pickRestored = false;
    }
    promotedFor = note.id;
    if (picked === null && note.pick) {
      picked = note.pick;
      pickRestored = true;
    }
  }

  /* Where a thought belongs is answered once, by the note itself. The
     seam's destination was hardcoded to the first project in the fixture,
     so the most consequential control in the product ignored the filing
     the person had just done on the same screen. */
  /* One answer. The N.projects[0] fallback returned a workspace string
     that is not one of the picker's options, and the crossesTo guard was
     dead, so a note filed under a dateless subject reported a place the
     listbox could never show. While a peel is open this reads the
     seam's own value; otherwise it reads the note's subject. */
  function destinationOf(note) {
    const key = peeling && peeling === (note && note.id) ? destination : note && note.aboutKey;
    const about = (key && N.subjects[key]) || (note && note.about);
    return about ? about.label : N.subjects["the-house"].label;
  }

  /* WHAT THE PEEL WILL SEND IS WHAT IS MARKED.
     With the peel open the note stays a live pick surface — a tab stop,
     named as the instrument, still drawing the mark — but the render
     reads pickedWords while every pick route writes `picked`. So a drag
     or a press announced "6 words picked. The task will use these
     words." and the seam then sent the old ones. Both routes go through
     here. An edited wording survives a re-pick, and .peelFrom then
     prints the source line on its own because wording no longer equals
     pickedWords. */
  function couplePeel(text) {
    const target = pickTarget();
    if (!text || !peeling || !target || peeling !== target.id) return;
    const edited =
      taskWording.trim() && pickedWords && taskWording.trim() !== pickedWords.replace(/[.]$/, "");
    pickedWords = text;
    if (!edited) taskWording = text.replace(/^[a-z]/, (ch) => ch.toUpperCase()).replace(/[.]$/, "");
  }

  function offerPick() {
    const text = pickedRange();
    /* A keyboard pick is drawn, not selected, so the document reports no
       selection while one is plainly on screen. Without this the first
       stray click after picking by keyboard silently threw the pick away
       and the primary went back to refusing. */
    if (!text && sentAt) return;
    if (text) sentAt = null;
    if (text === picked) return;
    picked = text;
    couplePeel(text);
    if (text) {
      /* The sentence asking for a pick cannot survive the pick. Both were
         on screen at once, twenty pixels apart, contradicting each other. */
      nudge = null;
      /* setPick clears this when the person acts; offerPick set `picked`
         and never touched it, so dragging across a different sentence on
         a note carrying a standing pick moved the mark and still said
         "Picked before, and still here" — the guarantee relabelled as
         somebody else's. Strictly inside this branch: offerPick also
         runs on release with no text, and clearing there would relabel a
         mark nobody touched. */
      pickRestored = false;
      /* A drag was the one pick route that never claimed the keyboard,
         so a real mouse pick left activeElement on BODY once the repaint
         landed — and then the arrow keys the margin advertises in the
         same sentence were inert, and Space, the documented release key,
         did nothing. Deliberately INSIDE this branch: offerPick also
         runs on release with text null, and arming the body there would
         yank the caret out of search or the capture field 120ms after a
         click opened it, which is the class search-caret-reset and
         capture-lands-where-you-cannot-see-it already paid for. */
      refocus = { kind: "act", sel: state === "review" ? ".handBody" : ".readBody" };
      /* couplePeel refuses to overwrite a hand-edited wording, which is
         right — nothing is silently deleted — but nothing else in the
         seam was told, so the mark, the lead panel and this line all
         named words the send would not use. When the wording has been
         edited, say what will actually cross, under the field's own
         label rather than the picked-words one. */
      const wordingEdited =
        peeling && taskWording.trim() && taskWording.trim() !== text.replace(/[.]$/, "");
      say(
        peeling
          ? wordingEdited
            ? `${wordsPicked(text)} ${N.copy.wordingLabel}: ${taskWording}. ${N.copy.payload}`
            : `${wordsPicked(text)} The task will use these words.`
          : `${wordsPicked(text)} ${N.copy.begin} to make them a task.`,
      );
    }
    paint();
  }

  function startPeel(id, opts) {
    const o = opts || {};
    const note = work().find((n) => n.id === id) || N.notes[13];
    /* Nothing is seeded that the person did not pick. Pressing the primary
       action with nothing highlighted says so, in the product's own words,
       rather than quietly sending a sentence they never chose. */
    const words = o.words || standingPick(note);
    if (!words) {
      say(`Nothing picked yet. ${NUDGE_PICK}`);
      nudge = NUDGE_PICK;
      if (state !== "review") openId = note.id;
      /* The press used to come back to the control that was pressed. That
         comment was written when the instruction pointed at the button;
         it now points at the note. The body is already a focusable named
         group with its own ring, so standing the person inside the thing
         the sentence is talking about ringes the target for free and
         makes the arrow keys the copy names work on the very next press,
         instead of silently walking the index. */
      refocus = { kind: "act", sel: state === "review" ? ".handBody" : ".readBody" };
      /* And it stays until it is answered. Clearing the instruction on a
         4.2-second clock meant the sentence telling somebody what to do
         disappeared while they were doing it. offerPick clears it on the
         pick; closing the note clears it too. */
      paint();
      return;
    }
    nudge = null;
    peeling = note.id;
    pickedWords = words;
    openId = note.id;
    sentTask = null;
    taskWording = words.replace(/^[a-z]/, (c) => c.toUpperCase()).replace(/[.]$/, "");
    /* The seam's destination starts as the note's own subject, which is
       one of the listbox's own options, so the control's current value
       can always be found in its own list. */
    destination = note.aboutKey || null;
    /* Read back what the field actually holds, character for character.
       This announced the raw picked words while the field held the
       sentence-cased version, so the seam stated one fact in two
       spellings at the moment it promises the exact words. */
    say(`${N.copy.sourceLabel}: ${taskWording}. ${N.copy.payload}`);
    /* The one surface where the exact words that cross are shown for
       checking opened with the caret at index 0, so the first keystroke
       landed in FRONT of them. `end: true` is the token the three
       sibling branches already carry. */
    refocus = { kind: "field", sel: ".peelField", end: true };
    paint();
  }
  function cancelPeel() {
    if (!peeling) return;
    peeling = null;
    pickedWords = null;
    sentTask = null;
    destination = null;
    say("Nothing was sent. Your note is unchanged.");
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
      const handEntry = {
        ...note,
        id: `crossed_${note.id}`,
        task: wording,
        /* The ledger column carries a Tasks LANE. destinationOf() returns
           a project, so the one row a person is looking for — the one
           she just made — carried a different kind of fact from the
           three above it: "The Orchard, events" under "In progress",
           "Waiting", "To do". The project is a real fact and it belongs
           on the receipt, not in the lane slot. */
        lane: "To do",
        crossedWhen: "just now",
        sent: true,
      };
      CROSSED.unshift(handEntry);
      window.__SUITE.cross(handEntry);
      say(`${N.copy.sentReceipt} ${Math.max(0, queue().length)} left.`);
      offerUndo("Sent to Tasks.", "Taken back. Nothing went to Tasks.", () => {
        if (note && before) Object.assign(note, before);
        CROSSED.shift();
        window.__SUITE.uncross(handEntry);
        decided.pop();
      });
      paint();
      return;
    }
    sentTask = { wording, project: destinationOf(note) };
    /* One sentence, not two overlapping ones. The receipt and the promise
       were concatenated and both said the note stayed here. The project
       rides here, where a receipt belongs, rather than in the ledger's
       lane column where it read as a lane. */
    say(`${N.copy.sentReceipt} In ${destinationOf(note)}.`);
    /* And the ledger beside it records the crossing. The pile headed
       "What has crossed into Tasks" read from a fixture constant, so the
       act the whole product exists for left no trace in the one surface
       whose job is to hold the trace of it. */
    const entry = {
      ...note,
      id: `crossed_${note.id}`,
      task: wording,
      lane: "To do",
      crossedWhen: "just now",
      sent: true,
    };
    CROSSED.unshift(entry);
    /* AND IT ARRIVES. The ledger row and the receipt on the note were
       both already true; the card at the other end of them was the one
       thing no lab could build. One act, so one undo: the suite hands
       back the way to take the card off the board and it runs beside the
       two facts this product already reverses. */
    window.__SUITE.cross(entry);
    offerUndo("Sent to Tasks.", "Taken back. Nothing went to Tasks.", () => {
      if (note && before) Object.assign(note, before);
      CROSSED.shift();
      window.__SUITE.uncross(entry);
      sentTask = null;
      peeling = note ? note.id : null;
    });
    refocus = { kind: "act", sel: '[data-act="open-task"]' };
    paint();
  }

  /* The floor going to ink is the boldest gesture this product makes, and
     it was a still life: a clock frozen at 0:07 and twenty-eight bars
     derived once from a sine curve. A microphone that does not visibly
     hear you is a microphone nobody speaks into twice. Both are written
     with textContent and inline height only — never a repaint, because a
     repaint under a speaking person would rebuild the transcript. */
  let voiceSeconds = 0;
  let voiceClock = null;
  let voiceWave = null;
  let waveLevel = 0.4;
  /* THE WAY BACK TO WRITING, in one place.
     notebook.js states the rule at keepDraft — "the capture field is
     where the next thought goes, so that is where the caret goes" — and
     set it in exactly one branch. Every other exit dropped the caret on
     document.body, so the next sentence typed after leaving review,
     search, voice or the readback went nowhere. Measured at 300ms, 900,
     1800 and 3000: BODY every time, stable, on the six commonest exits
     in the product. Pasting the assignment into five branches is how the
     five drifted apart to begin with. */
  function backToNotes(line) {
    state = "notebook";
    if (line) say(line);
    refocus = { kind: "field", sel: phone.matches ? ".phoneField" : ".topField" };
    paint();
  }

  const LISTENING = "Listening. Speak whenever you are ready. Stop when you are done.";
  /* A frame counter rather than a clock, so two runs of the shot
     harness produce the same wave and a changed frame means changed
     work. */
  let waveFrame = 0;
  function startListening() {
    stopListening();
    voiceSeconds = 0;
    waveFrame = 0;
    /* The floor announced itself once and then never again, so with your
       eyes off the screen there was no way to know it was still
       listening or how long it had heard you. The clock and the wave are
       both visual only. Every fifteen seconds, in words, through the
       polite region, so it never speaks over somebody mid-sentence. */
    say(LISTENING);
    voiceClock = setInterval(() => {
      voiceSeconds += 1;
      const el = mount.querySelector(".darkTime");
      if (el) el.textContent = `${Math.floor(voiceSeconds / 60)}:${String(voiceSeconds % 60).padStart(2, "0")}`;
      if (voiceSeconds % 15 === 0) say(`Still listening. ${voiceSeconds} seconds so far.`);
    }, 1000);
    if (reduced) return;
    let last = 0;
    const step = (now) => {
      voiceWave = requestAnimationFrame(step);
      if (now - last < 60) return;
      last = now;
      const bars = mount.querySelectorAll(".darkWave i");
      if (!bars.length) return;
      /* One amplitude, smoothed, so the bars move together the way a voice
         moves them rather than twenty-eight independent flickers. */
      /* Was Math.random(), which made the dictation frames differ
         between any two runs, so every round committed four changed
         PNGs that recorded nothing. It still moves the way a voice
         moves it; it just moves the same way twice. */
      waveFrame += 1;
      waveLevel = Math.min(1, Math.max(0.12, 0.55 + 0.42 * Math.sin(waveFrame * 0.21)));
      for (let i = 0; i < bars.length; i += 1) {
        const shape = 0.45 + 0.55 * Math.abs(Math.sin(i * 0.7 + voiceSeconds));
        const h = 6 + Math.round(34 * waveLevel * shape * (0.7 + 0.6 * Math.abs(Math.sin(i * 2.3 + waveFrame * 0.11))));
        bars[i].style.height = `${Math.min(40, h)}px`;
      }
    };
    voiceWave = requestAnimationFrame(step);
  }
  function stopListening() {
    clearInterval(voiceClock);
    if (voiceWave) cancelAnimationFrame(voiceWave);
    voiceClock = null;
    voiceWave = null;
  }

  function openSearch() {
    state = "search";
    refocus = { kind: "field", sel: "#q" };
    say("Search everything you wrote.");
    paint();
  }

  function openNote(id) {
    picked = null;
    nudge = null;
    /* Search is how you find a note, not where you read it: its desk is
       the field, so a note opened from a result had nowhere to appear.
       Opening a result leaves the search and lands on the note, which is
       what "Open that one" already did by hand for the near-miss case. */
    if (state === "search") {
      state = "notebook";
      query = "";
    }
    openId = id;
    cursorId = id;
    const note = work().find((n) => n.id === id);
    promotePick(note);
    /* The architecture's verb: reading LIFTS a note onto the desk. */
    lifting = true;
    /* The title usually ends in its own full stop, so a bare join
       printed "…keep it.. Open on the desk." */
    if (note) say(`Open. ${note.title.replace(/[.?!]+$/, "")}. Open on the desk.`);
    refocus = { kind: "read" };
    paint();
  }
  function startEdit(id) {
    const note = work().find((n) => n.id === id);
    if (!note) return;
    editing = id;
    editDraft = note.body;
    picked = null;
    sentAt = null;
    say("Editing this note. Add what you found out, then save.");
    refocus = { kind: "field", sel: ".readEdit", end: true };
    paint();
  }
  function saveEdit() {
    const note = work().find((n) => n.id === editing);
    const body = editDraft.trim();
    if (!note || !body) return;
    const before = { body: note.body, title: note.title, rest: note.rest, lede: note.lede, words: note.words, edited: note.edited };
    const title = ledeOf(body);
    Object.assign(note, {
      body,
      title: title || body,
      rest: title ? body.slice(title.length).trim() : "",
      lede: Boolean(title),
      words: body.split(/\s+/).length,
      edited: true,
    });
    editing = null;
    editDraft = "";
    say("Saved. Your note now says what you found out.");
    offerUndo("Saved.", "Put back. The note says what it said before.", () => {
      Object.assign(note, before);
    });
    refocus = { kind: "act", sel: '[data-act="edit"]' };
    paint();
  }
  function cancelEdit() {
    editing = null;
    editDraft = "";
    say("Nothing changed.");
    refocus = { kind: "act", sel: '[data-act="edit"]' };
    paint();
  }

  function closeNote() {
    editing = null;
    editDraft = "";
    sentAt = null;
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
    const w = inScope(work().filter((n) => !n.deleted));
    if (!query) return w;
    const q = query.toLowerCase();
    return w.filter((n) => n.body.toLowerCase().includes(q));
  }
  /* The walk follows the order on screen, not the order in the array. The
     pile is grouped, so the two are different: walking the array jumped
     from the third row to the fifth, then back UP the page to the fourth. */
  function walkOrder() {
    const groups = group === "about" || !listedOpts.noDays ? groupsOf(listed) : [{ rows: listed }];
    return groups.flatMap((g) => g.rows);
  }
  /* Home, End and the two page keys route through the same path so they
     inherit one announcement and one refocus contract. Written as a
     landing rather than a step, because the last row is not "n steps
     down" from wherever the cursor happens to be. */
  function landCursor(next) {
    const rows = walkOrder();
    if (!rows.length) return;
    const to = Math.min(rows.length - 1, Math.max(0, next));
    cursorId = rows[to].id;
    const inField = document.activeElement && document.activeElement.id === "q";
    refocus = inField ? { kind: "field", sel: "#q", end: true } : { kind: "row", id: cursorId };
    say(`${to + 1} of ${rows.length}. ${rows[to].title}`);
    paint();
  }
  function jumpCursor(where) {
    const rows = walkOrder();
    if (!rows.length) return;
    landCursor(where === "first" ? 0 : rows.length - 1);
  }
  function pageCursor(dir) {
    const rows = walkOrder();
    if (!rows.length) return;
    const at = rows.findIndex((n) => n.id === cursorId);
    const box = document.getElementById("index");
    const row = mount.querySelector(".idxRow");
    const h = row ? row.getBoundingClientRect().height : 0;
    const step = box && h ? Math.max(1, Math.floor(box.clientHeight / h)) : 6;
    landCursor((at < 0 ? 0 : at) + step * dir);
  }
  function moveCursor(step) {
    const rows = walkOrder();
    if (!rows.length) return;
    const at = rows.findIndex((n) => n.id === cursorId);
    const next = at < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, at + step));
    cursorId = rows[next].id;
    /* Walking the results from inside the search field must not take the
       caret out of it — a person typing a query and pressing down is still
       typing a query. Everywhere else the row itself takes the keyboard. */
    const inField = document.activeElement && document.activeElement.id === "q";
    refocus = inField ? { kind: "field", sel: "#q", end: true } : { kind: "row", id: cursorId };
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
      /* A row that wraps has already solved this in CSS; measuring
         scrollWidth on it compares the wrong axis. */
      /* A wrapped row is clamped by CSS, and the clamp has to admit it:
         mark it so the stylesheet can draw the sign, then leave it alone. */
      if (getComputedStyle(text).whiteSpace !== "nowrap") {
        /* The two-line box is trimmed the same way the one-line row is:
           whole words come off the preview until the sentence and its
           ellipsis fit, and the mark is the last character of the text
           rather than a pseudo-element parked at the box's right edge —
           which is not where line two ends, so it landed mid-word with
           half a glyph showing through the gradient beside it. */
        const whole = text.dataset.full;
        const head = text.dataset.lede || "";
        if (!whole) continue;
        const tail = whole.slice(head.length).trim();
        const draw = (words, ell) => {
          const body = words.join(" ") + (ell ? "…" : "");
          text.innerHTML = head
            ? `<b>${hl(head)}</b>${body ? ` <span>${hl(body)}</span>` : ""}`
            : hl(body);
        };
        let words = (head ? tail : whole).split(" ").filter(Boolean);
        draw(words, false);
        let cut = false;
        while (words.length > (head ? 0 : 4) && text.scrollHeight > text.clientHeight + 1) {
          words.pop();
          cut = true;
          draw(words, true);
        }
        /* On a phone the box is two lines, so a lede can be longer than
           the row on its own — and then there is nothing else to give
           back. The desktop row never faces this because its lede is
           capped at 48 characters against a full line. */
        if (head && text.scrollHeight > text.clientHeight + 1) {
          let lead = head.split(" ");
          while (lead.length > 4 && text.scrollHeight > text.clientHeight + 1) {
            lead.pop();
            cut = true;
            text.innerHTML = `<b>${hl(lead.join(" "))}…</b>`;
          }
        }
        if (cut || text.scrollHeight > text.clientHeight + 1) text.dataset.clamped = "";
        else delete text.dataset.clamped;
        continue;
      }
      const full = text.dataset.full;
      if (!full) continue;
      const lede = text.dataset.lede || "";
      /* A row with no lede is a person's sentence at one weight, and the
         trim has to leave it that way. It was rebuilding every row as
         `<b>lede</b>` from data-lede, so a note with no full stop rendered
         at 400 and then came back entirely semibold the moment the row was
         measured — the render withholding a hierarchy the trim put back. */
      if (!lede) {
        let all = full.split(" ");
        text.innerHTML = hl(full);
        while (all.length > 4 && text.scrollWidth > text.clientWidth) {
          all.pop();
          text.innerHTML = `${hl(all.join(" "))}…`;
        }
        if (text.scrollWidth > text.clientWidth) text.dataset.clipped = "";
        else delete text.dataset.clipped;
        continue;
      }
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
      /* The lede is never shortened. It is a complete sentence by
         construction, and half of one is a fragment — the same reason
         ledeOf refuses to cut mid-clause. When the preview has nothing
         left to give back the row admits it with an ellipsis rather than
         letting the browser slice a letter in half against the status
         pill. */
      if (text.scrollWidth > text.clientWidth) text.innerHTML = `<b>${hl(lede)}</b>`;
      let head = lede.split(" ");
      while (head.length > 4 && text.scrollWidth > text.clientWidth) {
        head.pop();
        text.innerHTML = `<b>${hl(head.join(" "))}…</b>`;
      }
      if (text.scrollWidth > text.clientWidth) text.dataset.clipped = "";
      else delete text.dataset.clipped;
    }
  }

  /* ── chrome ──────────────────────────────────────────────────── */
  const SUITE = [
    ["notes", "Notes"],
    ["tasks", "Tasks"],
    ["timeline", "Timeline"],
    ["more", "More"],
  ];

  function railTiles(opts) {
    const o = opts || {};
    /* On a phone the dock is the only object at the foot, and it has to
       hold capture, the verbs, the suite and the account in 372px. The
       fourth tile is a menu that the sheet's own head already carries, so
       it is the one that stands down. */
    const tiles = o.tight ? SUITE.filter(([k]) => k !== "more") : SUITE;
    return `<div class="railGroup">${tiles.map(
      ([k, name]) =>
        `<button class="railTile" type="button" data-act="suite-${k}"${k === "notes" ? ' data-active aria-current="page"' : ""} aria-label="${name}${k === "notes" ? ", the page you are on" : ""}">${I[k]}</button>`,
    ).join("")}</div>`;
  }

  /* The capsule is rendered once by the suite now. This is the phone
     dock's copy of it and the only one left; the full-height version is
     in app.js. */
  function railUnused() {
    const tiles = SUITE;
    return `
      <nav class="rail" aria-label="Signal Studio">
        <span class="railMark" aria-hidden="true">${I.home}<i></i></span>
        <span class="railDivider" aria-hidden="true"></span>
        <div class="railGroup">
          ${tiles
            .map(
              ([k, name]) =>
                `<button class="railTile" type="button" data-act="suite-${k}"${k === "notes" ? ' data-active aria-current="page"' : ""} aria-label="${name}${k === "notes" ? ", the page you are on" : ""}">${I[k]}</button>`,
            )
            .join("")}
        </div>
        <span class="railSpacer"></span>
        <button class="railAvatar" type="button" data-act="account" aria-label="${esc(N.operator.role)}. Account and settings">${N.operator.initials}</button>
      </nav>`;
  }

  /* The one fact this notebook has that no other product's would: the day
     the house is running, and how long there is. The head's top-line fact
     had been a generic count of unread items while the thing that
     actually presses on this person sat in the data unsaid. */
  function nextUp() {
    const soon = N.next;
    if (!soon) return "";
    /* The count belongs to one object. This sentence carried "1 still to
       decide" and the chip thirteen pixels to its right carried "8 still
       to decide" — the same five words, twice, in one line, reading as
       one broken phrase. The group's own rule already states its share at
       the rows it applies to; the chip is the notebook-wide figure. */
    const on = scope === soon.key;
    return `
      <button class="headNext" type="button" data-act="scope" data-key="${attr(soon.key)}" aria-pressed="${on}"
        aria-label="${attr(soon.label)}, ${attr(soon.when)}, in ${soon.days} day${soon.days === 1 ? "" : "s"}. ${on ? "Showing only these notes. Press to see the whole notebook." : "Press to see only these notes."}">
        <b>${esc(soon.label)}</b>
        <span class="dateStamp">${esc(soon.when)}, in ${soon.days} day${soon.days === 1 ? "" : "s"}</span>
      </button>${on ? `<button class="chip" data-quiet type="button" data-act="unscope">${I.close}All ${work().filter((n) => !n.deleted).length} notes</button>` : ""}`;
  }

  function head() {
    const c = counts();
    /* The loudest object in every room — solid ink, 600, top of the
       sheet — was a count of how far behind you are, with the verb
       hidden in the accessible name and the phrase "still to decide"
       said twice in one string. Unscoped it is the verb it actually is,
       which also stops it naming the room it is standing in and takes
       the 390 head off a wrapped, orphaned "days". Scoped it keeps the
       full phrase, because there the scope word is doing real work. */
    const chip =
      state === "review"
        ? ""
        : c.pending > 0
          ? /* The pill sat glued to the subject and read as that couple's
               count, and the group two inches below it said "1 still to
               decide" against the head's "8". The accessible name got
               the scope right and the screen got it ambiguous, which is
               the inversion: the credibility of every other number on
               the surface, spent to save three words. Same accessor,
               same words, on screen and in the name. */
            `<button class="chip" type="button" data-act="review" aria-label="${
              scope
                ? `${c.pending} still to decide in ${attr(scopeLabel())}. Go through them.`
                : `Go through the ${c.pending} notes still to decide.`
            }">${scope ? `${c.pending} still to decide in ${esc(scopeLabel())}` : `Go through ${c.pending}`}</button>`
          : "";
    return `
      <header class="head">
        <span class="word">notes</span>
        <span class="headRule" aria-hidden="true"></span>
        <h1 class="headName">${esc(N.workspace)}</h1>
        ${nextUp()}
        ${chip ? `<span class="headRule" aria-hidden="true"></span>${chip}` : ""}
        <div class="headActions">
          <button class="headAct" type="button" data-act="privacy" aria-label="${attr(N.copy.privacy)}. ${attr(N.copy.privacyLong)}.">${I.lock}<span>${esc(N.copy.privacy)}</span></button>
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
    /* Always in the tree, for the same reason as the desk: a phone has
       no chord, so this IS the way to keep a note, and it was absent
       for the whole time anybody was typing one. */
    const commit =
      /* Was "n / 4000" here AND a bare aria-hidden n in the verbs row:
         one number, printed twice, in two grammars, eating 37px of a
         326px foot at 360 — where it pushed the commit control out
         from under the suite row and left it with nine live pixels of
         thirty-six. The count appears when it is worth knowing. */
      (draft.length >= 3600
        ? `<span class="dockCount tab commitPart">${esc(counterText(draft.length))}</span>`
        : "") +
      `<button class="dockGlyph commitPart" data-ink type="button" data-act="keep" aria-label="Save it">${I.check}</button>`;
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
                 <div class="dockRow" data-verbs>
                   <button class="dockGlyph" type="button" data-act="search" aria-label="Search everything you wrote">${I.search}</button>
                   <button class="dockGlyph" type="button" data-act="voice" aria-label="${attr(N.copy.voiceStart)}">${I.mic}</button>
                   <button class="dockGlyph" type="button" data-act="photo" aria-label="Read a photo">${I.photo}</button>
                   ${commit}
                 </div>
                 <div class="dockRow" data-suite>
                   <span class="dockRule" aria-hidden="true"></span>
                   ${railTiles({ tight: true })}
                   <button class="dockAvatar" type="button" data-act="account" aria-label="${attr(N.operator.role)}. Account and settings">${N.operator.initials}</button>
                 </div>`
              : `${backToWriting}${
                   /* While the sheet is searching, the query field is at
                      the top of the sheet and this one sat 700px below
                      it still reading "Search everything you wrote" and
                      still advertising the chord — two search entries on
                      one screen, one of them holding "marquee" and the
                      other claiming nothing had been searched. It
                      becomes the glyph that says which mode the dock is
                      in, and exactly one control by that name exists. */
                   state === "search"
                     ? `<button class="dockGlyph" type="button" data-act="search" aria-current="true" data-ink aria-label="Search, open">${I.search}</button>`
                     : `<button class="dockField" type="button" data-act="search" aria-label="Search everything you wrote">${I.search}<span>Search everything you wrote</span><kbd>${MOD === "⌘" ? "⌘K" : "Ctrl K"}</kbd></button>`
                 }
                 <span class="dockRule" aria-hidden="true"></span>
                 <button class="dockGlyph" type="button" data-act="voice" aria-label="${attr(N.copy.voiceStart)}">${I.mic}</button>
                 <button class="dockGlyph" type="button" data-act="photo" aria-label="Read a photo">${I.photo}</button>
                 <span class="dockRule" aria-hidden="true"></span>
                 <button class="dockAvatar" type="button" data-act="account" aria-label="${attr(N.operator.role)}. Account and settings">${N.operator.initials}</button>`
          }
        </div>
      </div>`;
  }

  function undoStrip() {
    if (!undone) return "";
    return `
      <div class="undo" role="status">
        <span>${esc(undone.label)}</span>
        <button class="undoAct" type="button" data-act="undo">${I.undo}Undo<kbd>${MOD}+Z</kbd></button>
        <span class="undoFor tab">for ${Math.max(1, undoLeft)} seconds</span>
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
        <div class="pile"><div class="paperStack"${lifting ? " data-lifting" : ""}>${behind(n)}${inner}</div>${o.under || ""}</div>
      </section>`;
  }

  /* One control, in the place the words are written, saying where they
     will go. It is not a taxonomy the person has to learn: it opens on
     the thing the house is facing and it is one press to change. */
  function filingChip() {
    const about = N.subjects[filing];
    return `
      <span class="filing">
        <button class="filingBtn" type="button" data-act="filing" aria-haspopup="listbox" aria-expanded="${picker === "capture"}"
          aria-label="Filing this under ${attr(about.label)}${about.when ? `, ${attr(about.when)}` : ""}. Change it.">
          ${I.keep}<span>${esc(about.label)}</span>${I.chevron}
        </button>
        ${picker === "capture" ? subjectList("capture", filing) : ""}
      </span>`;
  }

  /* Every caller passed nothing, so every listbox in the product marked
     itself against `filing` — the CAPTURE chip's state. At the seam that
     produced three answers to one question: the button read one place,
     the note's aside read a second, and the option marked selected was a
     third. A listbox now says what the control that opened it holds. */
  function subjectList(which, current) {
    return `
      <span class="pickerPop" role="listbox" aria-label="What is this about">
        ${Object.entries(N.subjects)
          .sort((a, b) => a[1].stake - b[1].stake || (a[1].days ?? 99) - (b[1].days ?? 99))
          .map(
            ([key, about]) => `
          <button class="pickerRow" type="button" role="option" aria-selected="${key === current}"
            data-act="file-${which}" data-key="${attr(key)}">
            <span>${esc(about.label)}</span>
            <em>${about.when ? esc(about.when) : "No date"}</em>
          </button>`,
          )
          .join("")}
      </span>`;
  }

  function topSheet() {
    /* On a phone the desk stands down entirely and the dock carries
       capture, so there is no top sheet to render. */
    if (phone.matches) return "";
    const live = draft.trim() ? " data-live" : "";
    const isSettling = settling && settling !== "hand" ? " data-settling" : "";
    /* The resting frame is the one a venue owner sees for most of her
       session, and it was the only frame in the build that was not the
       direction: a compose box the width of the paper, with the privacy
       line marooned two hundred pixels out to its right, sitting on white
       above a list on the same white. That is the shape of every notes
       app there has ever been. The seam already had the answer — the
       writing holds the measure and everything true about it holds a
       ruled margin — so the resting state is composed the same way. */
    return deskOf(
      `<div class="top" data-two${live}${isSettling}>
        <div class="deskWrite">
          <textarea class="topField" rows="2" aria-label="Write a note" placeholder="${esc(N.copy.placeholder)}">${esc(draft)}</textarea>
          <div class="topFoot">
            <span class="topMeta restPart">${esc(N.copy.privacyLong)}</span>
            <span class="topMeta tab commitPart" data-count>${esc(counterText(draft.length))}</span>
            <span class="spacer commitPart"></span>
            <button class="act commitPart" data-ink type="button" data-act="keep">${I.check}${esc(N.copy.save)}<kbd>${MOD}+Enter</kbd></button>
          </div>
        </div>
        <div class="deskAside">
          <span class="deskFact"><b>${esc(N.copy.filingLabel)}</b>${filingChip()}</span>
          <span class="deskFact"><b>${esc(N.copy.otherWaysLabel)}</b>
            <span class="deskVerbs">
              <button class="verb" type="button" data-act="voice">${I.mic}${esc(N.copy.voiceStart)}</button>
              <button class="verb" type="button" data-act="photo">${I.photo}${esc(N.copy.photo)}</button>
            </span>
          </span>
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
        <div class="peelScroll">
        ${
          /* The picked words are printed once, and only when the wording
             has been edited away from them. Seeded, the two were the same
             sentence twice at the same size forty pixels apart. */
          pickedWords && taskWording.trim() && taskWording.trim() !== pickedWords.replace(/[.]$/, "")
            ? `<p class="peelFrom"><b>${esc(N.copy.sourceLabel)}</b><span>${esc(pickedWords)}</span></p>`
            : ""
        }
        <span class="peelLabel" id="peel-label">${esc(N.copy.wordingLabel)}</span>
        <textarea class="peelField" rows="1" id="peel-field" aria-labelledby="peel-label"
          placeholder="What should the task say?">${esc(taskWording)}</textarea>
        </div>
        <div class="peelRow">
          <button class="picker" type="button" data-act="destination" aria-haspopup="listbox" aria-expanded="${picker === "peel"}"
            aria-label="${attr(N.copy.destinationLabel)}: ${attr(destinationOf(note))}. Change it."><b>To</b>${esc(destinationOf(note))}${I.chevron}</button>
          ${picker === "peel" ? subjectList("peel", destination) : ""}
          <span class="spacer"></span>
          <button class="act" data-quiet type="button" data-act="cancel-peel">${esc(N.copy.cancel)}</button>
          <button class="act" data-primary type="button" data-act="send"${taskWording.trim() ? "" : " aria-disabled=\"true\""}>${I.send}${taskWording.trim() ? esc(N.copy.send) : "Write the wording, then send"}</button>
        </div>
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
    /* The repaint destroys the native selection, so the mark is drawn
       rather than borrowed: without it the only evidence of what has been
       picked disappeared the instant the control offering to use it
       appeared. */
    const mark = isPeeling ? pickedWords : standingPick(note);
    const bodyHtml =
      bodyHtmlOf(note, mark && note.body.includes(mark) ? mark : null);
    /* Everything that is true ABOUT the note lives beside it, not above
       it: the desk was a thousand pixels wide doing five hundred of work,
       and the facts were stacked on one line over the writing. */
    const aside = `
      <div class="deskAside">
        <span class="deskFact"><b>How it arrived</b><span>${src.label}, ${esc(note.when)}${note.edited ? ", edited" : ""}</span></span>
        <span class="deskFact"><b>What it is about</b>
          <span class="filing">
            <button class="filingBtn" type="button" data-act="refile" aria-haspopup="listbox" aria-expanded="${picker === "note"}"
              aria-label="This note is about ${attr(note.about.label)}${note.about.when ? `, ${attr(note.about.when)}` : ""}. Change it.">
              <span>${esc(note.about.label)}${note.about.when ? `, ${esc(note.about.when)}` : ""}</span>${I.chevron}
            </button>
            ${picker === "note" ? subjectList("note", note.aboutKey) : ""}
          </span>
        </span>
        <span class="deskFact"><b>Length</b><span class="tab">${note.words} words</span></span>
        ${/* How to take words out of this note is a fact ABOUT the note,
             so it lives in the margin with the others rather than under
             the writing column, where it cost the desk fifty-four pixels
             of height and the index paid for them. It stands down the
             moment a pick exists, because then the pick bar says it. */ ""}
        ${standingPick(note) ? "" : `<span class="deskFact"><b>${esc(N.copy.pickLabel)}</b><span class="pickHint">${esc(N.copy.pickHint)}</span></span>`}
        ${note.sent ? `<span class="deskFact"><b>In Tasks as</b><span><button class="deskFactLink" type="button" data-act="open-task" aria-label="${attr(`Open in Tasks: ${note.task || "a task"}. Your note stays here.`)}">${esc(note.task || "a task")}</button></span></span>` : ""}
      </div>`;
    if (isPeeling) {
      /* The product's signature promise is that the note never leaves and
         only the words you pick cross. It was drawn properly exactly once,
         in the review hand, and flattened into a share sidebar in the room
         where most people will meet it — same shadowless rectangle, same
         column, no edge of its own. It is a second sheet on the desk now,
         with its own paper and a notch pointing back at the note it was
         taken off. */
      return deskOf(
        `<div class="top" data-two>
          <div class="deskWrite"><p class="readBody" tabindex="0" role="group" aria-label="The note. Pick the words that should become the task, with the arrow keys.">${bodyHtml}</p></div>
          ${aside}
        </div>`,
        { behind: 1, label: `Turning a note into a task: ${note.title}`, under: peelPanel(note) },
      );
    }
    /* Everything in this build was made for the first three seconds and
       nothing for minute four. A note reading "Ask the venue whether the
       ballroom can be accessed from 8am" is a question, and the answer
       arrives on Tuesday — with nowhere to put it the only move was a
       second note that looked exactly like the first. The desk is where
       you write, so the note is written on here too. */
    if (editing === note.id) {
      return deskOf(
        `<div class="top" data-two data-live>
          <div class="deskWrite">
            <textarea class="readBody readEdit" rows="4" aria-label="Write on this note">${esc(editDraft)}</textarea>
            <div class="topFoot">
              <span class="topMeta tab" data-count>${esc(counterText(editDraft.length))}</span>
              <span class="spacer"></span>
              <button class="act" data-quiet type="button" data-act="cancel-edit">${esc(N.copy.cancel)}</button>
              <button class="act" data-ink type="button" data-act="save-edit">${I.check}${esc(N.copy.save)}<kbd>${MOD}+Enter</kbd></button>
            </div>
          </div>
          ${aside}
        </div>`,
        { behind: 1, label: `Writing on: ${note.title}` },
      );
    }
    return deskOf(
      `<div class="top" data-two>
        <div class="deskWrite">
          <p class="readBody${note.words >= 150 ? " readLong" : ""}" tabindex="0" role="group" aria-label="The note. Pick the words that should become the task, with the arrow keys.">${bodyHtml}</p>
        <div class="pickSlot">
          ${standingPick(note) ? `<p class="pickBar" role="status">${I.check}<span class="pickCount tab">${wordsPicked(standingPick(note))}</span> <span>${pickRestored ? `Picked before, and still here. ${phone.matches ? "Tap it to let it go." : "Press space to let it go."}` : "Send to Tasks will use exactly these."}</span></p>` : ""}
          ${nudge ? `<p class="nudge" role="status">${I.tasks}${esc(nudge)}</p>` : ""}
        </div>
        </div>
        ${aside}
        <div class="topFoot">
          ${
            isPeeling
              ? `<span class="topMeta">Writing the task below.</span>`
              : `<button class="act" data-primary type="button" data-act="peel">${I.tasks}${standingPick(note) ? "Send to Tasks" : "Pick the words, then send"}</button>
                 <button class="act" type="button" data-act="edit">${I.typed}Write on it</button>
                 <button class="act" data-quiet type="button" data-act="more" aria-label="More actions for this note">${I.dots}</button>`
          }
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

  /* Whatever list is on screen owns the tab stop. moveCursor walks the
     notebook, and two states render a different list, so in those states
     the index had no tabindex="0" at all and thirty tab presses never
     reached a row. */
  let listed = [];
  let listedOpts = {};

  /* A window onto the match, not the opening of the note. Searching for a
     word that appears in the fourth sentence returned rows whose visible
     text did not contain it anywhere, so the pile looked like it had
     answered a different question. */
  function matchWindow(body, q) {
    const at = body.toLowerCase().indexOf(q.toLowerCase());
    if (at < 0) return null;
    const from = Math.max(0, body.lastIndexOf(" ", Math.max(0, at - 34)) + 1);
    const stop = body.indexOf(" ", Math.min(body.length, at + q.length + 34));
    const to = stop < 0 ? body.length : stop;
    return `${from > 0 ? "…" : ""}${body.slice(from, to).trim()}${to < body.length ? "…" : ""}`;
  }

  function idxRow(note, opts) {
    const o = opts || {};
    const src = N.sources[note.source];
    /* The ledger of what has crossed shows the WORDS THAT CROSSED, never
       the private note they came from. The whole promise of this product
       is that the note stayed here; a ledger that reprints it is the one
       surface that must not. */
    const crossed = o.mode === "crossed";
    const hit = !crossed && query.trim() ? matchWindow(note.body, query.trim()) : null;
    const showsMatch = hit && !note.body.slice(0, note.title.length).toLowerCase().includes(query.trim().toLowerCase());
    const lede = crossed ? note.task : showsMatch ? "" : note.title;
    const rest = crossed ? "" : showsMatch ? hit : note.rest;
    const when = crossed ? note.crossedWhen || note.when : note.when;
    const name = crossed
      ? `${note.task}. In Tasks, ${note.lane}. Sent to Tasks ${when}. The note it came from stayed in Notes.`
      : `${note.title} ${note.rest || ""}`.trim() +
        `. ${src.label}. ${note.when}.${note.pending ? " Still to decide." : note.sent ? " In Tasks." : " Kept."}`;
    const tag = crossed
      ? `<span class="idxTag">${esc(note.lane)}</span>`
      : note.sent
        ? `<span class="idxTag">In Tasks</span>`
        : note.pending
          ? `<span class="idxTag">${note.later ? "Left for later" : "To decide"}</span>`
          : `<span class="idxTag" data-quiet>Kept</span>`;
    const cursor = note.id === cursorId ? " data-cursor" : "";
    const open = note.id === openId ? " data-open" : "";
    const arrivingNow = note.id === arriving ? " data-arriving" : "";
    return `
      <li class="idxItem" role="listitem"><button class="idxRow" type="button" data-id="${attr(note.id)}"${cursor}${open}${arrivingNow}
        tabindex="${note.id === cursorId ? "0" : "-1"}"
        aria-label="${attr(name)}">
        <span class="idxMark" aria-hidden="true">${crossed ? I.tasks : I[src.icon]}${!crossed && note.pending ? "<i></i>" : ""}</span>
        <span class="idxText" data-full="${attr(crossed ? note.task : showsMatch ? hit : `${note.title} ${note.rest || ""}`.trim())}" data-lede="${attr((note.lede === false && !crossed) || showsMatch ? "" : lede)}">${(note.lede === false && !crossed) || showsMatch ? hl(lede) : `<b>${hl(lede)}</b>`}${rest ? `${lede ? " " : ""}<span>${hl(rest)}</span>` : ""}${crossed ? '<span class="idxFrom">from a note that stayed here</span>' : ""}</span>
        ${tag}
        <span class="idxWhen tab">${esc(when)}</span>
      </button></li>`;
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
          tail: waiting ? `${waiting} still to decide` : "",
          soon: about.days !== null && about.days <= 7,
          undated: about.days === null,
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
      <span class="groupBy" role="group" aria-label="How your notes are grouped">
        <button class="groupBtn" type="button" data-act="group-about"${group === "about" ? " data-on" : ""} aria-pressed="${group === "about"}">What it is about</button>
        <button class="groupBtn" type="button" data-act="group-day"${group === "day" ? " data-on" : ""} aria-pressed="${group === "day"}">When</button>
      </span>`;
  }

  function indexOf(notes, opts) {
    const o = opts || {};
    listed = notes;
    listedOpts = o;
    /* A drawn selection has to be on a row that is on screen. Typing a
       query that filtered the cursor's row out left the mark nowhere and
       the arrows walking a list the cursor was not in. */
    if (notes.length && !notes.some((n) => n.id === cursorId)) cursorId = notes[0].id;
    if (!notes.some((n) => n.id === cursorId)) cursorId = (notes[0] || {}).id || null;
    const rows = [];
    if (o.noDays) {
      for (const note of notes) rows.push(idxRow(note, o));
    } else {
      for (const g of groupsOf(notes)) {
        /* Its own sticky context, so a rule is pushed out by the next one
           rather than every rule in the pile stacking at the top. */
        rows.push(
          `<li class="idxSection"><h3 class="idxDay" role="heading" aria-level="3"${g.soon ? " data-soon" : ""}${g.undated ? " data-undated" : ""}>${esc(g.label)}${g.note ? `<span class="idxDayNote dateStamp">${esc(g.note)}</span>` : ""}${g.tail ? `<span class="idxDayTail">${esc(g.tail)}</span>` : ""}</h3>` +
            `<ul class="idxGroupRows">${g.rows.map((note) => idxRow(note, o)).join("")}</ul></li>`,
        );
      }
    }
    if (!rows.length) rows.push(o.empty || "");
    return `
      <div class="indexWrap">
        <div class="indexHead">
          <span>${esc(o.title || "Your notes")}</span>${o.mode === "crossed" || o.noDays ? "" : `<kbd class="headKbd">${MOD === "⌘" ? "⌘↓" : "Ctrl ↓"}</kbd>`}
          ${o.count === null ? "" : `<span class="cnt">${esc(o.count || `${notes.length} notes`)}</span>`}
          ${o.group === false || o.noDays ? "" : groupControl()}
        </div>
        <ul class="index" id="index" role="list" aria-label="${attr(o.title || "Your notes")}">${rows.join("")}</ul>
      </div>`;
  }

  /* ── states ──────────────────────────────────────────────────── */
  const STATES = {};

  /* A note on a phone opens as a sheet over the pile, because there is no
     desk to lift it onto. Everything the desk can do it can do: read the
     whole note, see what it is about and change it, pick words, write the
     task, send it, and go back. */
  function phoneSheet(note) {
    const src = N.sources[note.source];
    const marked = peeling === note.id ? pickedWords : standingPick(note);
    /* Same one renderer the desk and the hand use, so all three readers
       draw sentences a finger can reach and a mark that survives a drag. */
    const bodyHtml = bodyHtmlOf(note, marked && note.body.includes(marked) ? marked : null);
    return `
      <section class="phoneSheet" role="dialog" aria-modal="true" aria-label="${attr(note.title)}">
        <div class="phoneSheetTop">
          <button class="act" data-quiet type="button" data-act="close">${I.chevron}Back to your notes</button>
          <span class="spacer"></span>
          <span class="filing">
            <button class="filingBtn" type="button" data-act="refile" aria-haspopup="listbox" aria-expanded="${picker === "note"}"
              aria-label="This note is about ${attr(note.about.label)}. Change it.">
              <span>${esc(note.about.label)}</span>${I.chevron}
            </button>
            ${picker === "note" ? subjectList("note", note.aboutKey) : ""}
          </span>
        </div>
        <div class="phoneSheetBody">
          <p class="readSrc">${I[src.icon]}<span>${src.label}</span><span class="sep" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span>${note.sent ? `<span class="sep" aria-hidden="true"></span><span>In Tasks</span>` : ""}</p>
          <p class="readBody" tabindex="0" role="group" aria-label="The note. Pick the words that should become the task, with the arrow keys.">${bodyHtml}</p>
          <div class="pickSlot">
            ${standingPick(note) ? `<p class="pickBar" role="status">${I.check}<span class="pickCount tab">${wordsPicked(standingPick(note))}</span> <span>${pickRestored ? `Picked before, and still here. ${phone.matches ? "Tap it to let it go." : "Press space to let it go."}` : "Send to Tasks will use exactly these."}</span></p>` : ""}
            ${nudge ? `<p class="nudge" role="status">${I.alert}${esc(nudge)}</p>` : ""}
          </div>
          ${peeling === note.id ? peelPanel(note) : ""}
        </div>
        ${
          peeling === note.id
            ? ""
            : `<div class="phoneSheetFoot">
                 <button class="act" data-primary type="button" data-act="peel">${I.tasks}${standingPick(note) ? "Send to Tasks" : "Pick the words, then send"}</button>
                 <button class="act" data-quiet type="button" data-act="more" aria-label="More actions for this note">${I.dots}</button>
               </div>`
        }
      </section>`;
  }

  /* An index with nothing in it says what belongs there, once. Landing
     here from the first-use empty used to give a headed, rowless column
     over six hundred pixels of blank ground — the product replacing its
     best-written empty with its worst. */
  function firstEmpty() {
    return `<p class="idxEmpty">Nothing here yet. The first thing you write lands at the top.</p>`;
  }

  const notebook = () => {
    const rows = visible();
    const open = openId ? work().find((n) => n.id === openId) : null;
    const c = counts();
    if (phone.matches) {
      return {
        desk: "",
        body: indexOf(rows, { title: "Your notes", count: `${c.total} notes`, empty: firstEmpty() }),
        dock: true,
        over: open ? phoneSheet(open) : "",
      };
    }
    return {
      desk: open ? readSheet(open) : topSheet(),
      body: indexOf(rows, { title: "Your notes", count: `${c.total} notes`, empty: firstEmpty() }),
      dock: true,
    };
  };
  STATES.notebook = notebook;
  STATES.capture = notebook;
  STATES.pressure = () => {
    /* The long note on this desk has to BE an open note, not a picture of
       one: with openId null its primary action reached for whatever note
       happened to be first and crossed the wrong words into Tasks. */
    if (!openId) {
      const long = work().find((n) => n.id === "long") || work()[0];
      if (long) openId = long.id;
    }
    const open = openId ? work().find((n) => n.id === openId) : work()[0];
    return {
      desk: readSheet(open),
      body: indexOf(visible(), {
        title: "Your notes",
        count: `${counts().total} notes`,
      }),
      dock: true,
    };
  };

  STATES.review = () => {
    const note = queue()[queueAt];
    /* What is left to decide is what is left to decide. It was the undealt
       remainder, so pressing "Decide later" — the one act that settles
       nothing — took the drawn number down by one while the product said
       out loud that the note was still waiting. The pile below carries
       the deferred cards too, at the back, saying what they are. */
    const ahead = queue().slice(queueAt + 1);
    const putBack = queue().slice(0, queueAt);
    const rest = [...ahead, ...putBack];
    const left = queue().length;
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
              <button class="act" type="button" data-act="notebook">${I.arrowRight}Back to your notes</button>
            </div>
          </div>`,
          { behind: 0, label: "Nothing left to decide" },
        ),
        body: indexOf(work().filter((n) => !n.pending).slice(0, 8), { title: "Your notes", count: `${counts().total} notes`, noDays: true }),
        dock: true,
      };
    }
    const depth = Math.min(3, Math.max(0, left - 1));
    /* A confirmation belongs to ONE card and must not outlive it. Escape
       was only one of the routes that left it armed — Decide later, an
       undo, and anything else that advances the queue did the same, so a
       later card could arrive already asking "Delete it everywhere?"
       about a note nobody had touched. Tying it to the card that is
       actually on the table closes every one of those routes at once. */
    if (confirming && confirming !== note.id) confirming = null;
    /* The dealt card gets the same treatment the desk gives a lifted
       note: a restored mark is promoted once so it is releasable. */
    promotePick(note);
    const src = N.sources[note.source];
    const handMark = peeling === note.id ? pickedWords : standingPick(note);
    const handHtml =
      bodyHtmlOf(note, handMark && note.body.includes(handMark) ? handMark : null);
    if (phone.matches) {
      /* The hand is a dialog over the live index here, not a plane on a
         desk that has stood down. It reuses .phoneSheet so the shell,
         its focus trap and its 44px controls are the ones already
         measured, and it carries a VISIBLE way out, because Escape is
         not a control on a phone. */
      return {
        desk: "",
        body: indexOf(rest, { title: "Still to decide", count: `${rest.length} behind this one`, noDays: true }),
        dock: true,
        over: `
          <section class="phoneSheet" role="dialog" aria-modal="true" aria-label="${attr(`Deciding: ` + note.title)}">
            <div class="phoneSheetTop">
              <button class="act" data-quiet type="button" data-act="notebook">${I.chevron}Back to your notes</button>
              <span class="spacer"></span>
              <span class="handOf tab">${decided.length + 1} of ${total}</span>
            </div>
            <div class="phoneSheetBody">
              <h2 class="handTitle">Worth doing something about?</h2>
              <p class="readSrc">${I[src.icon]}<span>${src.label}</span><span class="sep" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span></p>
              <p class="handBody" tabindex="0" role="group" aria-label="The note. Pick the words that should become the task, with the arrow keys.">${handHtml}</p>
              <div class="pickSlot">
                ${standingPick(note) ? `<p class="pickBar" role="status">${I.check}<span class="pickCount tab">${wordsPicked(standingPick(note))}</span> <span>${pickRestored ? `Picked before, and still here. ${phone.matches ? "Tap it to let it go." : "Press space to let it go."}` : "Send to Tasks will use exactly these."}</span></p>` : ""}
                ${nudge ? `<p class="nudge" role="status">${I.alert}${esc(nudge)}</p>` : ""}
              </div>
              ${peeling === note.id ? peelPanel(note) : ""}
            </div>
            ${
              peeling === note.id
                ? ""
                : `<div class="phoneSheetFoot" data-hand>
                     <button class="act" data-primary type="button" data-act="d-task">${I.tasks}${standingPick(note) ? "Send to Tasks" : "Pick the words, then send"}</button>
                     <button class="act" type="button" data-act="d-keep">${I.keep}Just keep it</button>
                     <button class="act" data-quiet type="button" data-act="d-later">Decide later</button>
                     <button class="act" data-quiet type="button" data-act="d-delete" aria-label="Delete this note">${I.trash}</button>
                   </div>`
            }
          </section>`,
      };
    }
    return {
      desk: `
        <section class="desk" aria-label="Notes still to decide">
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
              <p class="handBody" tabindex="0" role="group" aria-label="The note. Pick the words that should become the task, with the arrow keys.">${handHtml}</p>
              ${nudge ? `<p class="nudge" role="status">${I.tasks}${esc(nudge)}</p>` : ""}
              <div class="handFoot">
                ${
                  peeling === note.id
                    ? `<span class="topMeta">Writing the task below.</span><span class="spacer"></span>`
                    : confirming === note.id
                      ? `<span class="confirm" role="status">${I.trash}<span>Delete it everywhere?</span>
                           <button class="act" type="button" data-act="d-delete-yes">Delete</button>
                           <button class="act" data-ink type="button" data-act="d-delete-no">Keep it</button></span><span class="spacer"></span>`
                      : `<button class="act" data-primary type="button" data-act="d-task">${I.tasks}${standingPick(note) ? "Send to Tasks" : "Pick the words, then send"}<kbd>T</kbd></button>
                         <button class="act" type="button" data-act="d-keep">${I.keep}Just keep it<kbd>K</kbd></button>
                         <span class="spacer"></span>
                         <button class="act" data-quiet type="button" data-act="d-later">Decide later<kbd>L</kbd></button>
                         <button class="act" data-quiet data-destroy type="button" data-act="d-delete">${I.trash}Delete</button>`
                }
                <button class="act" data-quiet type="button" data-act="notebook">Back to your notes<kbd>Esc</kbd></button>
              </div>
            </article>
            </div>
            ${peeling === note.id ? peelPanel(note) : ""}
            <p class="deckNote">${I.undo}<span data-left>${left} still to decide.</span> ${
              decided.length
                ? `${decided.length === 1 ? "One decided just now, and you can put it back." : `${decided.length} decided just now, and you can put any of them back.`}`
                : "Nothing is decided until you say so, and every decision can be put back."
            }</p>
          </div>
        </section>`,
      body: indexOf(rest, {
        title: "Still to decide",
        /* "8 still to decide" at the head against "7 left" here is one
           number reported twice in two grammars and read as a
           contradiction. This one names what it counts, and the drawn
           count, the rows below it and the spoken sentence all resolve
           from the same list. */
        count: `${rest.length} behind this one`,
        noDays: true,
      }),
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
            <span class="darkTime tab">0:00</span>
            <span class="spacer"></span>
          </div>
          <div class="darkBody">
            <div class="darkCol">
              <p class="darkSaid" role="status">${esc(said.slice(0, cut))}<span class="tail"> ${esc(said.slice(cut + 1))}</span></p>
              <div class="darkWave" aria-hidden="true">${bars.map((b) => `<i style="height:${Math.round(b * 40)}px"></i>`).join("")}</div>
            </div>
          </div>
          <div class="darkFoot">
            <p class="darkNote">${esc(N.copy.voiceDisclosure)}</p>
            <span class="spacer"></span>
            <button class="darkAct" type="button" data-act="voice-cancel">Cancel<kbd>Esc</kbd></button>
            <button class="darkAct" data-primary type="button" data-act="voice-stop">${I.stop}Stop and read it back<kbd>${MOD}+Enter</kbd></button>
          </div>
        </section>`,
    };
  };

  STATES.readback = () => {
    if (phone.matches) {
      const base = notebook();
      return {
        ...base,
        over: `
          <section class="dark" aria-label="What came back">
            <div class="darkBody">
              <p class="saidHead">What came back, in ${pieces.length === 1 ? "one note" : `${pieces.length} notes`}.</p>
              <p class="saidHint">Edit ${editEither(pieces.length)} before you keep ${keepWhich(pieces.length)}.</p>
              <div class="pieces">
                ${pieces
                  .map(
                    (p, i) => `
                  <div class="piece">
                    <textarea class="pieceField" rows="1" data-i="${i}" aria-label="Note ${i + 1} of ${pieces.length}">${esc(p)}</textarea>
                    <button class="drop" type="button" data-act="drop-piece" data-i="${i}" aria-label="Drop note ${i + 1}">${I.close}</button>
                  </div>
                  ${i < pieces.length - 1 ? `<button class="joinSeam" type="button" data-act="join-piece" data-i="${i}" aria-label="${attr(N.copy.joinLabel)}">${esc(N.copy.join)}</button>` : ""}`,
                  )
                  .join("")}
              </div>
            </div>
            <div class="darkFoot">
              <button class="darkAct" type="button" data-act="add-piece">${I.plus}Add another</button>
              <span class="spacer"></span>
              <button class="darkAct" type="button" data-act="discard-speech">Discard</button>
              <button class="darkAct" data-primary type="button" data-act="keep-both">${I.check}Keep ${keepWhich(pieces.length)}</button>
            </div>
          </section>`,
      };
    }
    return {
    desk: deskOf(
      `<div class="top">
        <!-- The transcript was printed above the pieces and again inside
             them: the same sentences, twice, at the moment the product is
             asking somebody to trust that it heard them. The pieces are
             the truthful record — the person's words, in the product's
             own type, editable. The seam already obeys this rule about
             the picked sentence; the read-back obeys it now too. -->
        <p class="saidHead">What came back, in ${pieces.length === 1 ? "one note" : `${pieces.length} notes`}.</p>
        <!-- This sentence used to sit in the action row, between "Add
             another" and "Discard": two adjacent grey strings a pixel of
             type size apart, one of which destroys unsaved words and one
             of which does nothing at all, told apart only by a cursor a
             touch user never sees. A hint about editing belongs on the
             fields it describes. -->
        <p class="saidHint">Edit ${editEither(pieces.length)} before you keep ${keepWhich(pieces.length)}.</p>
        <div class="pieces">
          ${pieces
            .map(
              (p, i) => `
            <div class="piece">
              <textarea class="pieceField" rows="1" data-i="${i}" aria-label="Note ${i + 1} of ${pieces.length}">${esc(p)}</textarea>
              <button class="drop" type="button" data-act="drop-piece" data-i="${i}" aria-label="Drop note ${i + 1}">${I.close}</button>
            </div>
            ${i < pieces.length - 1 ? `<button class="joinSeam" type="button" data-act="join-piece" data-i="${i}" aria-label="${attr(N.copy.joinLabel)}">${esc(N.copy.join)}</button>` : ""}`,
            )
            .join("")}
        </div>
        <div class="topFoot">
          <button class="verb" type="button" data-act="add-piece">${I.plus}Add another</button>
          <span class="spacer"></span>
          <button class="act" data-quiet type="button" data-act="discard-speech">Discard</button>
          <button class="act" data-ink type="button" data-act="keep-both">${I.check}Keep ${keepWhich(pieces.length)}<kbd>${MOD}+Enter</kbd></button>
        </div>
      </div>`,
      { behind: 1, label: "What came back" },
    ),
    body: indexOf(work().slice(0, 8), { title: "Your notes", count: `${counts().total} notes` }),
    dock: true,
    };
  };

  STATES.seam = () => {
    const note = work().find((n) => n.id === peeling) || work()[13] || N.notes[13];
    /* Only on the way in. Re-peeling whenever `peeling` is null made
       cancelling the seam a no-op: Escape cleared it and the next paint
       put it straight back. */
    if (!peeling && !seamTouched) {
      peeling = note.id;
      seamTouched = true;
    }
    /* This room opens the peel directly rather than through startPeel(),
       so it has to seed the seam's destination the same way, or the
       control opens with nothing marked in its own list. */
    if (peeling && !destination) destination = note.aboutKey || null;
    promotePick(note);
    if (!pickedWords) pickedWords = picked || note.title.replace(/[.]$/, "");
    if (!taskWording) {
      taskWording = pickedWords.replace(/^[a-z]/, (c) => c.toUpperCase()).replace(/[.]$/, "");
    }
    return {
      desk: readSheet(note),
      body: indexOf(CROSSED, {
        title: "Already in Tasks",
        count: `${CROSSED.length} so far, and every note stayed here`,
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
            <input id="q" value="${esc(query)}" aria-label="Search everything you wrote" placeholder="Search everything you wrote">
            <button class="esc" type="button" data-act="clear-search">Esc</button>
          </div>
        </div>`,
      body: indexOf(rows, {
        /* The eyebrow read FOUND over a count of nought, over a headline
           saying no note says it, over a body saying nothing is close —
           one fact four times, the first of them untrue. The panel
           below states the miss in full, so the head above it stops
           counting: null is a sentinel, not "", because indexOf falls
           back to a note count on anything falsy. */
        title: query ? (rows.length ? "Found" : "Nothing matched") : "Everything you wrote",
        count: query
          ? rows.length === 0
            ? null
            : rows.length === 1
              ? `1 of ${counts().total} notes has “${query}” in it`
              : `${rows.length} of ${counts().total} notes have “${query}” in them`
          : `${counts().total} notes`,
        noDays: true,
        empty: `
          <div class="noHits">
            <h2 class="emptyTitle">No note says “${esc(query)}”.</h2>
            <p class="emptyBody">${
              near
                ? `The closest is ${esc(near.title.replace(/[.]$/, ""))}, from ${esc(near.when)}.`
                : "Nothing in the notebook is close to it either."
            }</p>
            <div class="emptyMove">
              ${near ? `<button class="act" data-ink type="button" data-act="nearest" data-id="${attr(near.id)}">${I.arrowRight}Open that one</button>` : ""}
              <button class="act" ${near ? 'data-quiet' : 'data-ink'} type="button" data-act="clear-search">Back to your notes</button>
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
        <p class="emptyBody">${esc(N.copy.privacyLong)}. Notes only sends something on when you pick the words yourself.</p>
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
              <p class="specName">Nothing in Tasks yet</p>
              <h3 class="emptyTitle">Nothing has left Notes yet.</h3>
              <p class="emptyBody">When you turn a note into a task, Tasks receives the exact words you pick and nothing else. This is where they get listed.</p>
              <div class="emptyMove"><button class="act" type="button">${I.arrowRight}Pick a note to start with</button></div>
              <p class="specWhy">An empty ledger explains the promise it exists to keep, then offers the one move that fills it.</p>
            </div>
            <div class="spec">
              <p class="specName">After a clear-out</p>
              <h3 class="emptyTitle">Your notes are empty again.</h3>
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
          <span class="topMeta">Held on this device.</span>
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
                <p>You are offline, so this one is held here. It joins the rest the moment you reconnect. Nothing is lost and nothing has left Notes.</p>
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
              <p class="skelSay" role="status">Opening your notes. Fourteen of them, by what each one is about.</p>
            </div>
          </div>
        </div>
      </div>`,
    dock: true,
  });

  /* ── the cut ─────────────────────────────────────────────────── */
  /* A note that scrolls inside itself has to say so. The desk clamped a
     150-word debrief to 298 of its 413 pixels, with no fade, no
     scrollbar and no count, so the visible text stopped on the word
     "and" and the composition read as a note that ended in a
     conjunction. A fade is a measurement: it is set only where the body
     genuinely overflows and cleared at the end of the scroll, so it can
     never claim there is more to read when there is not. Re-measured on
     every repaint, on the body's own scroll, on resize and on
     fonts.ready, because a clamp measured in a fallback face is
     measured against the wrong lines. */
  function measureClip() {
    for (const body of mount.querySelectorAll(".readBody, .handBody")) {
      /* What is below THIS reader, not what is below the top of the
         note. Measured against the total overflow it said "7 more lines
         below" to somebody three pixels from the last word. */
      const below = body.scrollHeight - body.clientHeight - body.scrollTop;
      const lh = parseFloat(getComputedStyle(body).lineHeight) || 0;
      /* Half a line, not one pixel: three pixels of sub-pixel remainder
         is not a word anybody is missing, and a fade over it would be
         the always-on decoration this was bought to avoid. */
      const clipped = below > (lh ? lh / 2 : 1);
      const lines = lh ? Math.max(1, Math.round(below / lh)) : 0;
      if (clipped) body.setAttribute("data-clipped", "");
      else body.removeAttribute("data-clipped");

      /* The same fact in words, on the same element the fade is on, so
         the gradient and the accessible name can never disagree. */
      const base = body.getAttribute("data-name") || body.getAttribute("aria-label") || "";
      if (base && !body.getAttribute("data-name")) body.setAttribute("data-name", base);
      const name = body.getAttribute("data-name");
      if (name) {
        body.setAttribute(
          "aria-label",
          clipped ? `${name} More of this note is below. Scroll, or press Page Down.` : name,
        );
      }

      /* And a line a person can read, in the space the empty pick band
         used to hold blank. */
      const host = body.parentNode;
      if (!host) continue;
      let line = host.querySelector(":scope > .clipLine");
      if (clipped && lines > 0) {
        if (!line) {
          line = document.createElement("p");
          line.className = "clipLine";
          body.insertAdjacentElement("afterend", line);
        }
        line.textContent = `${lines} more ${lines === 1 ? "line" : "lines"} below.`;
        line.hidden = false;
      } else if (line) {
        line.hidden = true;
      }
    }
  }

  /* ── paint ───────────────────────────────────────────────────── */
  const mount = window.__SUITE.host("notes");

  function paint() {
    /* Nothing here may cost the operator their place. Both the index's
       scroll and the caret in whatever field they are typing in are
       captured before the repaint and restored after it. */
    const indexBefore = document.getElementById("index");
    const scroll = indexBefore ? indexBefore.scrollTop : 0;
    /* The index was the only scroller whose place was kept. Every arrow
       press threw a long note back to its first line, including for
       someone who had scrolled it with the wheel. */
    const readBefore = mount.querySelector(".readBody, .handBody");
    const readScroll = readBefore ? readBefore.scrollTop : 0;
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

    if (state === "voice" && !voiceClock) startListening();
  else if (state !== "voice" && voiceClock) stopListening();
  const build = STATES[state] || STATES.notebook;
    const s = build();
    mount.innerHTML = `
        <main class="sheet"${undone ? " data-undo" : ""}>
          ${head()}
          ${s.desk || ""}
          ${s.body || ""}
          ${s.dock ? dock() : ""}
          ${undoStrip()}
        </main>
        ${s.over || ""}`;

    const indexAfter = document.getElementById("index");
    if (indexAfter) indexAfter.scrollTop = scroll;
    const readAfter = mount.querySelector(".readBody, .handBody");
    if (readAfter && readScroll) readAfter.scrollTop = readScroll;
    lifting = false;
    trimRows();
    /* The desk budget is written in terms the CSS can read, so the note
       yields to the peel before the second plane does. Zero when no
       peel is open, so the resting frame is untouched. */
    const peelEl = mount.querySelector(".pile > .peel");
    root.style.setProperty(
      "--peel-h",
      peelEl ? Math.round(peelEl.getBoundingClientRect().height) + "px" : "0px",
    );
    /* How far above its own bottom edge the index must land a walked row
       for that row to clear the scrim as well as the dock. The scrollport
       runs 64px behind the dock, so reserving the dock height alone left
       the row sitting in the fade at about 65% white — clear of the pill,
       erased anyway, and the fix would have been recorded as done.
       Measured rather than guessed, because both edges move. */
    const idxEl = document.getElementById("index");
    const wrapEl = mount.querySelector(".dockWrap");
    if (idxEl && wrapEl) {
      const scrim = parseFloat(getComputedStyle(root).getPropertyValue("--scrim-h")) || 96;
      const reserve = Math.max(
        0,
        Math.round(idxEl.getBoundingClientRect().bottom - (wrapEl.getBoundingClientRect().top - scrim)),
      );
      root.style.setProperty("--walk-reserve", reserve + "px");
    }
    /* The band the undo strip actually occupies, measured rather than
       guessed at 140px. With a real touch pointer the coarse block makes
       an index row 88px instead of 64, so a row straddled the strip at
       390 — invisible for nine rounds because this file opened phone
       widths with a mouse. */
    /* The sheet's resting look is a fact about the draft, not about the
       input event. Round 10 seated the commit permanently and drove its
       visibility from wakeSheet(), which is only called while somebody
       is typing — so after the product's core act the field was empty
       and the sheet still wore a filled Save with the privacy line gone,
       for the rest of the session. Every path that changes the draft
       ends in a repaint, so the truth is written here as well.
       Three seats reported it independently. */
    wakeSheet(Boolean(draft.trim()));

    const stripEl = mount.querySelector(".undo");
    const sheetEl = mount.querySelector(".sheet");
    if (stripEl && sheetEl) {
      const band = Math.max(
        0,
        Math.round(sheetEl.getBoundingClientRect().bottom - stripEl.getBoundingClientRect().top) + 10,
      );
      root.style.setProperty("--undo-band", band + "px");
    }
    measureClip();
    /* A picked sentence must never be off screen while the primary reads
       "Send to Tasks". From the fourth arrow press down, the mark sat
       below the cut with scrollTop pinned at 0, so the screen said
       "28 words picked" over words nobody could see. */
    const mark = mount.querySelector(".readBody .pick, .handBody .pick");
    if (mark) {
      mark.scrollIntoView({ block: "nearest" });
      measureClip();
    }

    /* Taking the whole floor to ink has to take the keyboard with it. The
       overlay paints after the sheet, so without this the way out of
       dictation was seventeen tab stops behind a notebook nobody can see,
       and a screen-reader user was reading a pile of notes while the
       microphone was live. */
    const over = mount.querySelector(".dark, .phoneSheet");
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
          /* block:"nearest" lands a row flush with the scrollport bottom,
             and the scrollport runs behind the dock and its 96px scrim,
             so every arrow press past the first screenful parked the
             focused row in the fade or under the slab. scroll-padding is
             declared and is not enough here, so the landing is measured
             and corrected: a row a person is standing on has to be a row
             a person can read. */
          const box = document.getElementById("index");
          const wrap = mount.querySelector(".dockWrap");
          if (box && wrap) {
            const scrim = parseFloat(getComputedStyle(root).getPropertyValue("--scrim-h")) || 96;
            const floor = wrap.getBoundingClientRect().top - scrim - 4;
            const over = row.getBoundingClientRect().bottom - floor;
            if (over > 0) box.scrollTop += over;
          }
        }
      } else if (refocus.kind === "read") {
        /* Reading a note lifted it onto the desk and then parked the
           keyboard on the way out, so the first Enter after arriving
           closed the note again. It is also the wrong destination on its
           own terms: the body is a named group whose accessible name is
           the instruction the person needs, and focus skipped past it to
           the dismiss control, so the instruction was never read. Escape
           is still the way back and is still drawn on the button; a
           close button does not need focus to work. */
        const body = mount.querySelector(".phoneSheet .readBody, .readBody");
        const close = mount.querySelector('.phoneSheet [data-act="close"], [data-act="close"]');
        const target = body || close;
        if (target) target.focus({ preventScroll: true });
      } else if (refocus.kind === "field") {
        const field = mount.querySelector(refocus.sel);
        if (field) {
          field.focus({ preventScroll: true });
          /* Focus without a caret is a field somebody has to click before
             they can type in it. Where the words are already there, the
             caret goes after them. */
          if (refocus.end && field.setSelectionRange) {
            try {
              field.setSelectionRange(field.value.length, field.value.length);
            } catch {
              /* a field with no range keeps focus and no caret */
            }
          }
        }
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
    root.setAttribute("data-state", state);
    root.setAttribute("data-group", group);
    /* The search field is outside the pile, so :focus-within can never
       fire and the drawn cursor was painted in the same ink as hover. */
    root.toggleAttribute("data-searching", Boolean(query.trim()));
    /* The dock floats, so what it covers has to be measured rather than
       guessed: a hardcoded 22px foot left the last row of the pile under
       a 103px bar on every phone. */
    const dockEl = mount.querySelector(".dock");
    root.style.setProperty("--dock-h", `${dockEl ? Math.round(dockEl.offsetHeight) : 96}px`);
  }

  /* ── events ──────────────────────────────────────────────────── */
  mount.addEventListener("input", (e) => {
    const writing = e.target.closest(".readEdit");
    if (writing) {
      /* Same rule as the capture field: nothing is written to the document
         while somebody is typing, so the browser's own undo history for
         this field survives. */
      editDraft = writing.value;
      const count = mount.querySelector("[data-count]");
      if (count) count.textContent = counterText(editDraft.length);
      return;
    }
    const field = e.target.closest(".topField, .phoneField");
    if (field) {
      draft = field.value;
      wakeSheet(Boolean(draft.trim()));
      /* NOTHING is written to the DOM inside the input event. Chromium ends
         the browser's own typing burst the moment the document is mutated
         during input, which turned one Ctrl+Z into one character — and
         undo that gives back a letter at a time is undo that does not
         work. Both the waking of the sheet and the character count are
         therefore deferred by a tick, off the input event entirely. */
      /* And not on the next tick either. At machine speed one setTimeout(0)
         lands after the whole burst; at human speed — 40 to 90ms a key —
         it lands BETWEEN every pair of keystrokes, so the document was
         still being mutated inside the typing history and one Ctrl+Z
         still gave back one character. The write waits for a pause. */
      clearTimeout(inputTimer);
      inputTimer = setTimeout(applyDraft, 450);
      return;
    }
    const q = e.target.closest("#q");
    if (q) {
      /* No refocus here. Setting one focused the field without restoring
         the caret, which put every new character at index 0. The caret
         path in paint() already re-finds this field by id. */
      query = q.value;
      paint();
      /* Search filtered in total silence: opening it announced itself
         once and then nothing changed the live region again, so typing
         a query that took the pile from fourteen rows to one, and then
         to none, said nothing at all. The no-result panel is one of the
         best-written things in this file — it names what was searched
         for, the nearest note and two ways out — and a person using it
         by ear never learned it was there. Spoken from the strings the
         room already draws, so the ear and the eye cannot drift, and
         debounced past per-character echo. */
      clearTimeout(searchSaid);
      searchSaid = setTimeout(() => {
        const head = mount.querySelector(".indexHead .cnt");
        const hits = mount.querySelectorAll(".idxRow").length;
        if (!query.trim()) return;
        if (hits) {
          const cursor = mount.querySelector(".idxRow[data-cursor] .idxText");
          say(`${head ? head.textContent.trim() : `${hits} found`}${cursor ? `. 1 of ${hits}. ${cursor.textContent.trim()}` : ""}`);
        } else {
          const title = mount.querySelector(".noHits .emptyTitle");
          const body = mount.querySelector(".noHits .emptyBody");
          const moves = [...mount.querySelectorAll(".noHits .emptyMove .act")].map((n) => n.textContent.trim());
          say(`${title ? title.textContent.trim() : ""} ${body ? body.textContent.trim() : ""} ${moves.join(", or ")}.`);
        }
      }, 350);
      return;
    }
    const piece = e.target.closest(".pieceField");
    if (piece) {
      pieces[Number(piece.dataset.i)] = piece.value;
      return;
    }
    const wording = e.target.closest(".peelField");
    if (wording) {
      taskWording = wording.value;
      /* The primary answers the field as it is typed rather than waiting
         for a repaint, so it can never sit disabled over wording that is
         already written. */
      const send = mount.querySelector('[data-act="send"]');
      if (send) {
        const ready = Boolean(taskWording.trim());
        send.toggleAttribute("aria-disabled", !ready);
        const label = send.lastChild;
        if (label && label.nodeType === 3) label.textContent = ready ? N.copy.send : "Write the wording, then send";
      }
    }
  });

  mount.addEventListener("pointerdown", (e) => {
    pressAt = { x: e.clientX, y: e.clientY };
  });
  /* A cancelled touch must not leave a stale coordinate behind, or the
     next genuine tap looks like a drag. */
  mount.addEventListener("pointercancel", () => {
    pressAt = null;
  });
  mount.addEventListener("click", (e) => {
    if (picker && !e.target.closest(".filing")) {
      picker = null;
      paint();
    }
    /* Picking had no pointer instrument at all: clicking a sentence did
       nothing, and a phone had no route in, so the promise reduced to
       "the exact words the machine picked for you". The spans the arrow
       model already walks are the targets now, so pointer and keyboard
       write the same sentAt and the same picked string. Shift extends,
       which is the contract shift-arrow already has. */
    const sent = e.target.closest(".sent");
    if (sent && sent.closest(".readBody, .handBody")) {
      /* Click fires at the end of a drag too. If this press MOVED and
         left a real selection inside the same body, the gesture was a
         drag: stand down entirely and let the selectionchange path
         write the snapped string, rather than adding a fourth route
         into one pick. Shift is exempt, because shift-click extends
         from the caret and is non-collapsed by definition. */
      const sel = document.getSelection();
      const moved = pressAt ? Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) : 0;
      const dragged =
        !e.shiftKey &&
        moved > 4 &&
        sel &&
        !sel.isCollapsed &&
        sel.anchorNode &&
        sent.closest(".readBody, .handBody").contains(sel.anchorNode);
      const target = dragged ? null : pickTarget();
      if (target) {
        const i = Number(sent.dataset.i);
        if (e.shiftKey && sentAt) {
          sentAt = [Math.min(sentAt[0], i), Math.max(sentAt[1], i)];
        } else {
          /* Pressing the sentence that IS the pick lets it go. A phone
             has no space key, and the strip tells a phone to tap it to
             let it go — so the gesture has to be true, or the strip is a
             string that states a falsehood. It is also the obvious thing
             to try with a pointer on any device. */
          const whole = sentenceText(target.body, i, i);
          if (picked && whole.trim() === picked.trim()) {
            clearPick();
            return;
          }
          sentAt = [i, i];
        }
        setPick(sentenceText(target.body, sentAt[0], sentAt[1]), true);
        return;
      }
    }
    const row = e.target.closest(".idxRow");
    if (row) {
      openNote(row.dataset.id);
      return;
    }
    const act = e.target.closest("[data-act]");
    if (!act) return;
    const a = act.dataset.act;
    /* THE SUITE SPINE ANSWERED NOTHING.
       Six controls per screen, in all ten states, carrying the strongest
       hover affordance in the product — white on a raised fill, held on
       press — and no behaviour at all. Each names where it goes rather
       than six sharing one sentence, which would only move them into the
       open more-answers-with-nothing finding. None changes the room:
       this is a lab of Notes, and a tile that evacuated a room somebody
       was mid-review in while announcing it was opening Tasks would be a
       control that says one thing and does another. */
    if (a && a.startsWith("suite-")) {
      const where = a.slice(6);
      if (where === "notes") {
        say("You are on Notes.");
        return;
      }
      if (where === "more") {
        /* Still not a surface in the suite: the rest of Signal Studio. */
        say("The rest of Signal Studio is on another screen.");
        return;
      }
      /* The doors are real. */
      window.__SUITE.go(where);
      return;
    }
    if (a === "account") {
      say(`${N.operator.role}. Account and settings are on another screen.`);
      return;
    }
    if (a === "filing" || a === "refile") {
      picker = picker ? null : a === "filing" ? "capture" : "note";
      refocus = { kind: "act", sel: `[data-act="${a}"]` };
      paint();
      return;
    }
    if (a === "destination") {
      picker = picker === "peel" ? null : "peel";
      paint();
      return;
    }
    if (a === "file-peel") {
      /* This branch used to write note.about and note.aboutKey — so the
         one surface whose printed promise is "Your note stays here" was
         the only place in the build that edited the note, and the only
         mutation with no way back. It sets where the TASK goes. */
      const about = N.subjects[act.dataset.key];
      if (about) {
        destination = act.dataset.key;
        say(`This one goes to ${about.label}.`);
      }
      picker = null;
      refocus = { kind: "act", sel: '[data-act="destination"]' };
      paint();
      return;
    }
    if (a === "file-capture" || a === "file-note") {
      const key = act.dataset.key;
      const about = N.subjects[key];
      if (a === "file-capture") {
        filing = key;
        say(`Filing under ${about.label}${about.when ? `, ${about.when}` : ""}.`);
      } else {
        const note = work().find((n) => n.id === openId);
        if (note) {
          const was = note.about;
          const wasKey = note.aboutKey;
          note.about = about;
          note.aboutKey = key;
          say(`Moved to ${about.label}.`);
          offerUndo(`Moved to ${about.label}.`, `Put back under ${was.label}.`, () => {
            note.about = was;
            note.aboutKey = wasKey;
          });
        }
      }
      picker = null;
      refocus = { kind: "act", sel: a === "file-capture" ? '[data-act="filing"]' : '[data-act="refile"]' };
      paint();
      return;
    }
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
      /* The resting desk used to offer this journey as <a href="#tasks">
         — underlined, a tab stop, and completely dead: no such id
         exists, nothing changed, nothing was announced. The receipt
         inside the peel already had the live control, so the product
         shipped two controls for one journey and the dead one was the
         one an operator meets first. One control now; but the peel's
         landing is wrong for a press that came from the aside, where
         it would throw focus off the control and across the sheet. */
      const fromDesk = !peeling;
      const crossed = peeling || openId;
      peeling = null;
      sentTask = null;
      if (a === "open-task") {
        /* It goes somewhere now. The note is not touched, not closed and
           not moved: the notebook is exactly as it was when you come
           back to it, which is the promise the receipt already made. */
        refocus = { kind: "act", sel: '[data-act="open-task"]' };
        paint();
        window.__SUITE.openTask(crossed);
        return;
      }
      say("Done. Your note stayed here.");
      refocus = fromDesk ? { kind: "act", sel: '[data-act="open-task"]' } : { kind: "read" };
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
    if (a === "scope" || a === "unscope") {
      const key = a === "unscope" ? null : act.dataset.key;
      scope = scope === key ? null : key;
      queueAt = 0;
      const c = counts();
      say(
        scope
          ? `Showing ${scopeLabel()} only. ${c.total} note${c.total === 1 ? "" : "s"}, ${c.pending} still to decide.`
          : `Showing the whole notebook. ${c.total} notes.`,
      );
      refocus = { kind: "act", sel: '[data-act="scope"]' };
      paint();
      return;
    }
    if (a === "nearest") {
      query = "";
      state = "notebook";
      openNote(act.dataset.id);
      return;
    }
    /* One spoken thought came back as two notes with no way to make it
       whole again: the only controls were drop, add, discard and keep,
       so the sole route back to one note was to delete half of what the
       person said. The seam between two pieces offers to put them back
       together, in their own order, and it is undoable exactly as
       dropping one is. */
    if (a === "join-piece") {
      const i = Number(act.dataset.i);
      if (i < 0 || i >= pieces.length - 1) return;
      const before = pieces.slice();
      pieces = [
        ...pieces.slice(0, i),
        `${pieces[i].trim()} ${pieces[i + 1].trim()}`.trim(),
        ...pieces.slice(i + 2),
      ];
      say(`Put back together. ${pieces.length === 1 ? "One note" : `${pieces.length} notes`} now.`);
      offerUndo("Put back together.", "Separated again.", () => {
        pieces = before;
      });
      refocus = { kind: "field", sel: ".pieceField", end: true };
      paint();
      return;
    }
    if (a === "drop-piece") {
      const i = Number(act.dataset.i);
      const dropped = pieces[i];
      pieces = pieces.filter((_, n) => n !== i);
      say(`Dropped. ${pieces.length} left.`);
      offerUndo("Dropped one of them.", "Put back. Both notes are here.", () => {
        pieces = [...pieces.slice(0, i), dropped, ...pieces.slice(i)];
      });
      paint();
      return;
    }
    if (a === "discard-speech") {
      /* Everything in this product can be taken back for thirty seconds
         except, until now, the one act that threw away words somebody had
         spoken out loud and could not retype. It sat 24px from the
         primary and destroyed them on one press. */
      const spoken = pieces.slice();
      state = "notebook";
      pieces = N.speech.separated.slice();
      /* One guarantee, one carrier. The strip beside this states the
         window and counts it down; saying it here as well put a third
         grammar on one fact. */
      say("Discarded. Nothing was kept.");
      offerUndo("Discarded.", "Put back. What you said is here again.", () => {
        pieces = spoken;
        state = "readback";
      });
      refocus = { kind: "field", sel: phone.matches ? ".phoneField" : ".topField" };
      paint();
      return;
    }
    /* SEVEN CONTROLS, ONE SENTENCE, NO VISIBLE ANSWER.
       Each of these takes a hover fill and a focus ring and answered a
       press with a single live-region string, identical across all of
       them and invisible to a sighted person — including "Try now",
       "Save it again" and "Delete it" in the honesty room, which is the
       worst place in the product for a control that does nothing. They
       are still outside this master, and they say what they are and
       where they go rather than sharing one sentence between seven. */
    const ELSEWHERE = {
      timeline: "Timeline is another surface in this suite. This lab is the Notes one.",
      more: "The rest of Signal Studio is on another screen.",
      privacy: `${N.copy.privacyLong} Your privacy settings are on another screen.`,
      options: "Notes options are on another screen.",
      photo: "Reading a photo happens on another screen. Nothing here changes.",
      retry: "Sending again happens on another screen. Your note is still here.",
      destroy: "Deleting for good happens on another screen. Nothing here is deleted.",
    };
    if (ELSEWHERE[a]) {
      say(ELSEWHERE[a]);
      return;
    }
    if (a === "keep" || a === "first") {
      if (a === "first") {
        /* The product's first press did nothing at all: this room renders
           no capture field — the empty replaces the desk — so the repaint
           redrew the same room and the refocus found nothing. It has to
           leave the room to keep the promise on its own label. Landing
           bare would be worse, so the room it lands in says what belongs
           there rather than heading an empty column. */
        state = "notebook";
        refocus = { kind: "field", sel: phone.matches ? ".phoneField" : ".topField" };
        paint();
        return;
      }
      keepDraft();
    } else if (a === "edit") startEdit(openId);
    else if (a === "save-edit") saveEdit();
    else if (a === "cancel-edit") cancelEdit();
    else if (a === "close") closeNote();
    else if (a === "undo") doUndo();
    else if (a === "review") {
      state = "review";
      const first = queue()[queueAt];
      /* The hand dealt in silence: it announced a count and left focus on
         the document body, so a keyboard user arrived in a room with a
         card in it and no way to know what the card said. */
      say(first ? `${counts().pending} still to decide. First, ${first.title}` : "Nothing left to decide.");
      refocus = { kind: "act", sel: ".handBody" };
      paint();
    } else if (a === "notebook") {
      backToNotes();
    } else if (a === "tasks") {
      /* A different journey: leaving for Tasks is not arriving to write,
         so it does not take the capture caret, and it says where it is
         going, which it never did. */
      state = "notebook";
      say("Opening Tasks. Your notes stayed here.");
      paint();
    } else if (a === "d-task") decide("task");
    else if (a === "d-keep") decide("keep");
    else if (a === "d-later") decide("later");
    else if (a === "d-delete" || a === "d-delete-yes") decide("delete");
    else if (a === "d-delete-no") {
      confirming = null;
      say("Nothing was deleted.");
      refocus = { kind: "act", sel: '[data-act="d-delete"]' };
      paint();
    }
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
      /* startListening() says it, so it is said once by whichever route
         reached the floor. Arriving at ?state=voice directly used to
         announce nothing at all. */
      refocus = { kind: "act", sel: '[data-act="voice-stop"]' };
      paint();
      startListening();
    } else if (a === "voice-cancel" || a === "voice-stop") {
      stopListening();
      state = a === "voice-stop" ? "readback" : "notebook";
      if (a === "voice-stop") {
        /* The boldest gesture in the product hands over to its weakest
           surface. It dropped focus on the document body and announced a
           bare count, so the one moment that has to prove the product
           heard you correctly could only be checked by looking. It hands
           back the words themselves, and the caret. */
        say(`${pieces.length === 1 ? "One note" : `${pieces.length} notes`} came back. First: ${pieces[0]} Edit ${editEither(pieces.length)}, or keep ${keepWhich(pieces.length)}.`);
        refocus = { kind: "field", sel: ".pieceField", end: true };
      } else {
        say("Nothing was kept.");
      }
      paint();
    } else if (a === "add-piece") {
      /* The control was drawn with no data-act at all, so the one verb
         in the readback room that offers to add something did nothing
         when pressed. */
      pieces = pieces.concat([""]);
      say(`Another note added. ${pieces.length} in all.`);
      refocus = { kind: "field", sel: ".pieceField" };
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
      if (made.length) cursorId = made[0].id;
      say(`${made.length} note${made.length === 1 ? "" : "s"} kept. ${counts().total} in the notebook.`);
      offerUndo(`${made.length} kept from what you said.`, "Put back. Nothing was kept from what you said.", () => {
        WORK = work().filter((n) => !made.includes(n));
        state = "readback";
      });
      /* Somebody who has just finished speaking is by definition not
         looking at the screen, and this dropped the caret on the body. */
      refocus = { kind: "field", sel: phone.matches ? ".phoneField" : ".topField" };
      paint();
      setTimeout(() => {
        arriving = null;
        /* The deferred repaint has to keep it too, or the caret survives
           600ms and then goes. */
        refocus = { kind: "field", sel: phone.matches ? ".phoneField" : ".topField" };
        paint();
      }, 600);
    }
  });

  /* The whole keyboard model, in one place, so nothing can advertise a key
     the file does not answer. */
  addEventListener("keydown", (e) => {
    /* The notebook that is not on screen keeps its DOM, so it would keep
       answering the keyboard as well. A product's keys are its own. */
    if (!window.__SUITE.active("notes")) return;
    const typing = e.target.matches("textarea, input, [contenteditable]");

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      /* While there is a live draft in the capture field, undo belongs to
         the browser and to the words being typed. Intercepting it there
         reverted the previously saved note and overwrote the draft the
         person was in the middle of writing — undo destroying work is the
         worst possible failure in a capture product. */
      /* Inside the capture field undo belongs to the field, and the file
         must not repaint underneath it either: repainting on every input
         event turned one Ctrl+Z into one character, because each repaint
         reset the field's own undo stack to a single entry. */
      if (typing && e.target.closest(".topField, .phoneField") && draft.length) return;
      if (doUndo()) e.preventDefault();
      return;
    }
    /* The caret starts in the capture field, which is the whole point, so
       a bare slash can never reach a shortcut handler — it is a character
       somebody is typing into their note. Search therefore answers the
       chord that works while writing, and the dock advertises that chord
       rather than one the file cannot honour. */
    /* The caret lives in the writing field at rest and the index was six
       Tab stops away, with no chord to reach it, so every single-letter
       key the index offers was unreachable from the state the product
       opens in. Ctrl+J is Chrome's downloads shortcut, so this is the
       arrow, with preventDefault so it never reaches the textarea's own
       paragraph move. */
    if ((e.metaKey || e.ctrlKey) && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      if (e.key === "ArrowDown") {
        const rows = walkOrder();
        if (rows.length) {
          if (!cursorId) cursorId = rows[0].id;
          refocus = { kind: "row", id: cursorId };
          const at = rows.findIndex((n) => n.id === cursorId);
          say(`${at + 1} of ${rows.length}. ${rows[at].title}`);
          paint();
        }
      } else {
        refocus = { kind: "field", sel: ".topField, .phoneField", end: true };
        say("Back to writing.");
        paint();
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openSearch();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      /* Dictating is the one flow where a person is by definition not
         looking at the screen, and it was the one room with no key that
         keeps: Escape threw the words away, and this chord — the
         product's own commit chord everywhere else — fell through to the
         draft hidden BEHIND the ink floor, silently saving a note and
         announcing "Saved. 15 notes" to somebody who thought they were
         dictating. It presses the control the room actually draws, so
         the key and the button can never mean two things. */
      if (state === "voice" || state === "readback") {
        e.preventDefault();
        const sel = state === "voice" ? '[data-act="voice-stop"]' : '[data-act="keep-both"]';
        const btn = mount.querySelector(sel);
        if (btn) btn.click();
        return;
      }
      if (editing && editDraft.trim()) {
        e.preventDefault();
        saveEdit();
        return;
      }
      if (draft.trim()) {
        e.preventDefault();
        keepDraft();
      }
      return;
    }
    /* An open popup owns the keyboard. It was a listbox with roles and no
       behaviour: the arrows walked the index behind it, Enter did nothing,
       and Tab left it hanging open over a surface it no longer belonged
       to. It claims the keys before anything else reads them. */
    if (picker) {
      const opts = [...mount.querySelectorAll('.pickerPop [role="option"]')];
      const at = opts.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
        e.preventDefault();
        const to =
          e.key === "Home" ? 0
          : e.key === "End" ? opts.length - 1
          : at < 0 ? 0
          : Math.min(opts.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
        if (opts[to]) opts[to].focus({ preventScroll: true });
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        picker = null;
        refocus = { kind: "act", sel: '[data-act="filing"], [data-act="refile"], [data-act="destination"]' };
        paint();
        return;
      }
    }
    if (e.key === "Escape") {
      if (picker) {
        e.preventDefault();
        picker = null;
        /* Closing a popup with the keyboard has to give the keyboard back
           somewhere. It was dropping focus on the document body. */
        refocus = { kind: "act", sel: '[data-act="filing"], [data-act="refile"], [data-act="destination"]' };
        paint();
        return;
      }

      if (peeling) {
        e.preventDefault();
        cancelPeel();
        return;
      }
      if (state === "review") {
        /* Escape is the universal cancel and it was skipping straight
           past a live delete confirmation to leave the room, without
           ever clearing `confirming` — so the queue re-armed the
           destructive prompt on a later visit where nobody had asked to
           delete anything. Same wording and same landing as the Keep it
           button, so the key and the control are one behaviour. */
        if (confirming) {
          e.preventDefault();
          confirming = null;
          say("Nothing was deleted.");
          refocus = { kind: "act", sel: '[data-act="d-delete"]' };
          paint();
          return;
        }
        e.preventDefault();
        sentAt = null;
        picked = null;
        nudge = null;
        backToNotes("Back to your notes.");
        return;
      }
      if (state === "readback") {
        /* The Discard button earns thirty seconds back; Escape, one key
           away, destroyed the same spoken words outright. One way out of
           a room, one promise: this presses the same control. */
        e.preventDefault();
        const btn = mount.querySelector('[data-act="discard-speech"]');
        if (btn) btn.click();
        return;
      }
      if (state === "voice") {
        backToNotes("Nothing was kept.");
        return;
      }
      if (state === "search") {
        if (query) {
          query = "";
          refocus = { kind: "field", sel: "#q" };
          paint();
        } else {
          backToNotes();
        }
        return;
      }
      if (editing) {
        e.preventDefault();
        cancelEdit();
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
    /* A row was painted as the keyboard's selection while the keyboard was
       in the search field, where the arrows did nothing and Enter did
       nothing. A drawn selection that answers no key is a lie about what
       is selected, so the field drives it. */
    if (state === "search" && document.activeElement && document.activeElement.id === "q") {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        moveCursor(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.key === "Enter" && cursorId) {
        const row = listed.find((n) => n.id === cursorId);
        if (row) {
          e.preventDefault();
          openNote(row.id);
          return;
        }
      }
    }
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

    /* The note body is a real pick surface, so while it holds focus the
       arrows belong to it and not to the pile behind it. */
    const onBody = document.activeElement && document.activeElement.matches(".readBody, .handBody");
    if (onBody && !typing) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        moveSentence(1, e.shiftKey);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        moveSentence(-1, e.shiftKey);
        return;
      }
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        jumpSentence(e.key === "Home" ? "first" : "last", e.shiftKey);
        return;
      }
      /* The body announced "5 words picked. Use these words to make them
         a task" and named no way forward, because none existed: Enter
         here was completely inert. Gated on a standing pick so Enter on
         arrival stays inert rather than firing the nudge at somebody who
         has only just opened the note, and routed through the same
         startPeel the hand's T uses so the two rooms cannot drift into
         two preconditions. */
      if (e.key === "Enter") {
        const target = pickTarget();
        if (target && standingPick(target)) {
          e.preventDefault();
          startPeel(target.id);
          return;
        }
      }
      if (e.key === " ") {
        e.preventDefault();
        if (picked) clearPick();
        else moveSentence(1, false);
        return;
      }
      /* Space is a pick key here, so the two keys a reader falls back on
         to page through prose have to stay scroll keys. They reach the
         browser untouched; this only re-measures the fade behind them. */
      if (e.key === "PageUp" || e.key === "PageDown") {
        setTimeout(measureClip, 0);
        return;
      }
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
      /* A keyboard run through eight cards had to break for the mouse on
         every skip: Decide later was drawn in the same row as T and K
         and carried no key at all. L is free, and Delete stays
         keycap-free behind its two-step confirm. */
      if (key === "l") {
        e.preventDefault();
        decide("later");
        return;
      }
    }
    /* While the hand has the floor, the most obvious key in a queue was
       driving the plane behind it: one ArrowDown left the card untouched
       and moved the cursor in the index, announcing "3 of 7" over a card
       that says "1 of 8" — one keystroke, two counts of one queue, in two
       grammars, naming a note that is not on screen. The hand owns these
       keys while it is up; if focus has drifted, they bring it back to
       the card rather than moving anything. */
    if (state === "review" && ["ArrowDown", "ArrowUp", "j", "k"].includes(e.key)) {
      e.preventDefault();
      const card = mount.querySelector(".handBody");
      if (card) {
        card.focus({ preventScroll: true });
        /* Read back what the card actually drew rather than counting the
           queue a second time here. Two accessors for one fact is how
           "1 of 8" and "3 of 7" came to be on screen together. */
        const of = mount.querySelector(".handOf");
        const title = mount.querySelector(".handTitle");
        if (of && title) say(`${of.textContent.trim()}. ${title.textContent.trim()}`);
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      moveCursor(1);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      moveCursor(-1);
    } else if (e.key === "Home" || e.key === "End") {
      /* Home and End meant something one plane up, inside the note, and
         nothing at all in the index directly below it. Returning from
         the oldest note to the newest cost thirty-six ArrowUps. */
      e.preventDefault();
      jumpCursor(e.key === "Home" ? "first" : "last");
    } else if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      pageCursor(e.key === "PageDown" ? 1 : -1);
    } else if ((e.key === "Enter" || e.key === " ") && e.target.closest(".idxRow")) {
      /* The row is a button, so the browser already does this. It is
         written down so the model is complete in one place. */
    }
  });

  /* Picking is a pointer gesture and a keyboard one, so both are watched.
     selectionchange fires on the document, which is why this is not bound
     to the note body. */
  document.addEventListener("selectionchange", () => {
    /* This was a blanket `if (peeling) return`, which shut the DRAG
       route off completely while the peel was open — so the note stayed
       a live-looking pick surface that a drag could not move. Dropping
       the guard outright is worse: pickedRange() is scoped to the note
       bodies, so a caret move inside the wording textarea returns null
       and offerPick would rebuild the whole tree on a 120ms debounce
       while somebody is typing, which is the caret-loss class this
       programme has already paid for twice. So: while peeling, act only
       on a real selection inside a note body, and otherwise do nothing
       at all. */
    if (peeling && !pickedRange()) return;
    if (!openId && state !== "review" && !peeling) return;
    clearTimeout(pickTimer);
    pickTimer = setTimeout(offerPick, 120);
  });
  let pickTimer = null;

  /* A trim measured against a fallback face is a trim measured against the
     wrong widths, and one measured before a resize is simply stale. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      trimRows();
      measureClip();
    });
  }
  let resizeTimer = null;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      trimRows();
      measureClip();
    }, 90);
  });
  /* The fade has to go out when the reader reaches the end, or it lies in
     the other direction. The body is rebuilt every repaint, so this is
     delegated from the mount rather than bound to the element. */
  window.__SUITE.host("notes").addEventListener(
    "scroll",
    (e) => {
      if (e.target && e.target.matches && e.target.matches(".readBody, .handBody")) measureClip();
    },
    true,
  );

  /* The container decides, so the container is what is watched. */
  phone.matches = readWidth();
  if (typeof ResizeObserver === "function") {
    const mountEl = window.__SUITE.frame();
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
    /* The caret starts where the thought goes — but only when this is the
       sheet on the floor. Three products each taking focus at load leaves
       it wherever the last script happened to run. */
    if (field && !params.get("nofocus") && window.__SUITE.active("notes")) field.focus({ preventScroll: true });
  }

  /* The console drives the same file through this, and now so does the
     suite. `show` is paint(), which is the repaint that already restores
     scroll, focus and caret. */
  window.__SUITE.register("notes", { show: paint, api: { paint: paint, state: () => state } });
  window.NOTEBOOK = {
    paint,
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
