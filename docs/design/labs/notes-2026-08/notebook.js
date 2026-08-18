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
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

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
  let confirmDelete = null;
  let refocus = null;     /* what to put focus back on after a repaint     */
  let held = false;       /* the offline note, held on this device         */

  const MOD = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* Capture lives on the desk's paper on a wide screen and in the dock on a
     phone, and exactly one of them is ever rendered. Rendering both and
     hiding one with CSS left an invisible textarea in the document at every
     width, which is a focusable control nobody can see — the exact defect
     the standing checklist names. */
  const phone = matchMedia("(max-width: 720px)");
  phone.addEventListener("change", () => paint());

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
    const w = work();
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
  function keepDraft() {
    const body = draft.trim();
    if (!body) return;
    const title = body.split(/(?<=[.?!”])\s/)[0] || body;
    const note = {
      id: `new_${Date.now()}`,
      body,
      title,
      rest: body.slice(title.length).trim(),
      source: "typed",
      when: "Just now",
      day: "Today",
      ms: 0,
      task: null,
      sent: false,
      reviewed: false,
      edited: false,
      pending: true,
      words: body.trim().split(/\s+/).length,
    };
    draft = "";
    const put = () => {
      work().unshift(note);
    };
    put();
    say(`Kept. ${counts().total} notes, ${counts().pending} waiting on a decision.`);
    offerUndo("The note went back to the sheet.", () => {
      WORK = work().filter((n) => n !== note);
      draft = body;
    });
    if (reduced) {
      paint();
      return;
    }
    settling = note.id;
    paint();
    setTimeout(() => {
      settling = null;
      paint();
    }, 220);
  }

  function decide(kind) {
    const note = N.pending[queueAt];
    if (!note) return;
    const before = queueAt;
    queueAt += 1;
    decided.push({ note, kind });
    const label =
      kind === "task"
        ? `Turned into a task. ${N.counts.review - queueAt} left.`
        : kind === "keep"
          ? `Kept in Notes. ${N.counts.review - queueAt} left.`
          : kind === "later"
            ? `Left for later. ${N.counts.review - queueAt} left.`
            : `Deleted. ${N.counts.review - queueAt} left.`;
    say(label);
    offerUndo("That decision was put back.", () => {
      queueAt = before;
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

  function openNote(id) {
    openId = id;
    cursorId = id;
    const note = work().find((n) => n.id === id);
    if (note) say(`Open. ${note.title}`);
    refocus = { kind: "read" };
    paint();
  }
  function closeNote() {
    if (!openId) return;
    const id = openId;
    openId = null;
    say("Put back.");
    refocus = { kind: "row", id };
    paint();
  }

  /* ── the index's one tab stop ────────────────────────────────── */
  function visible() {
    const w = work();
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
          ? `<button class="chip" type="button" data-act="review" aria-label="${c.pending} notes are waiting on a decision. Go through them">${c.pending} to decide</button>`
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
    return `
      <div class="dockWrap">
        <div class="dock">
          ${
            phone.matches
              ? `<textarea class="phoneField" rows="2" aria-label="Write a note" placeholder="${esc(N.copy.placeholder)}">${esc(draft)}</textarea>
                 <button class="dockGlyph" type="button" data-act="search" aria-label="Search notebook">${I.search}</button>`
              : `<button class="dockField" type="button" data-act="search" aria-label="Search notebook">${I.search}<span>Search everything you wrote</span><kbd>/</kbd></button>`
          }
          <span class="dockRule" aria-hidden="true"></span>
          <button class="dockGlyph" type="button" data-act="voice" aria-label="${esc(N.copy.voiceStart)}">${I.mic}</button>
          <button class="dockGlyph" type="button" data-act="photo" aria-label="Read a photo">${I.photo}</button>
          <span class="dockRule" aria-hidden="true"></span>
          <button class="dockAvatar" type="button" aria-label="${esc(N.operator.role)}. Account and settings">${N.operator.initials}</button>
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
  function deskOf(inner, opts) {
    const o = opts || {};
    return `
      <section class="desk" aria-label="${esc(o.label || "Write a note")}">
        <div class="pile">${behind(o.behind === undefined ? 2 : o.behind)}${inner}</div>
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
              ? `<span class="topMeta tab">${draft.length} / 4000</span>
                 <button class="act" data-ink type="button" data-act="keep">${I.check}Put it on the pile<kbd>${MOD}+Enter</kbd></button>`
              : `<span class="topMeta">Nobody else can read this</span>`
          }
        </div>
      </div>`,
    );
  }

  function readSheet(note) {
    const src = N.sources[note.source];
    return deskOf(
      `<div class="top">
        <p class="readSrc">
          ${I[src.icon]}<span>${src.label}</span>
          <span class="sep" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span>
          ${note.edited ? '<span class="sep" aria-hidden="true"></span><span>edited</span>' : ""}
          ${note.sent ? `<span class="sep" aria-hidden="true"></span><span>In Tasks as <a href="#tasks">${esc(note.task || "a task")}</a></span>` : ""}
        </p>
        <p class="readBody"><span class="lede">${esc(note.title)}</span>${note.rest ? ` ${esc(note.rest)}` : ""}</p>
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

  function idxRow(note) {
    const src = N.sources[note.source];
    const tag = note.sent
      ? `<span class="idxTag">In Tasks</span>`
      : note.pending
        ? `<span class="idxTag">To decide</span>`
        : `<span class="idxTag" data-quiet>Kept</span>`;
    const name = `${note.title} ${note.rest || ""}`.trim();
    const cursor = note.id === cursorId ? " data-cursor" : "";
    const open = note.id === openId ? " data-open" : "";
    return `
      <button class="idxRow" type="button" data-id="${note.id}"${cursor}${open}
        tabindex="${note.id === cursorId ? "0" : "-1"}"
        aria-label="${esc(name)}. ${src.label}. ${esc(note.when)}.${note.pending ? " Waiting on a decision." : note.sent ? " In Tasks." : " Kept."}">
        <span class="idxMark" aria-hidden="true">${I[src.icon]}${note.pending ? "<i></i>" : ""}</span>
        <span class="idxText" data-full="${esc(name)}" data-lede="${esc(note.title)}"><b>${hl(note.title)}</b>${note.rest ? ` <span>${hl(note.rest)}</span>` : ""}</span>
        ${tag}
        <span class="idxWhen tab">${esc(note.when)}</span>
      </button>`;
  }

  function indexOf(notes, opts) {
    const o = opts || {};
    let day = null;
    const rows = [];
    for (const note of notes) {
      if (!o.noDays && note.day !== day) {
        day = note.day;
        rows.push(`<p class="idxDay">${esc(day)}</p>`);
      }
      rows.push(idxRow(note));
    }
    if (!rows.length) rows.push(o.empty || "");
    return `
      <div class="indexWrap">
        <div class="indexHead"><span>${esc(o.title || "The pile")}</span><span class="cnt">${esc(o.count || `${notes.length} notes`)}</span></div>
        <div class="index" id="index" role="list" aria-label="${esc(o.title || "The pile")}">${rows.join("")}</div>
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
    const note = N.pending[queueAt];
    const left = N.counts.review - queueAt;
    const pips = N.pending.map((_, i) => `<i${i < queueAt ? " data-done" : i === queueAt ? " data-now" : ""}></i>`).join("");
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
                <span class="handOf tab">${queueAt + 1} of ${N.counts.review}</span>
                <span class="pips" role="img" aria-label="${queueAt} of ${N.counts.review} decided">${pips}</span>
              </div>
              <p class="readSrc">${I[src.icon]}<span>${src.label}</span><span class="sep" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span></p>
              <p class="handBody">${esc(note.body)}</p>
              <div class="handFoot">
                <button class="act" data-primary type="button" data-act="d-task">${I.tasks}Turn into a task<kbd>T</kbd></button>
                <button class="act" type="button" data-act="d-keep">${I.keep}Just keep it<kbd>K</kbd></button>
                <span class="spacer"></span>
                <button class="act" data-quiet type="button" data-act="d-later">Decide later</button>
                <button class="act" data-quiet type="button" data-act="d-delete">${I.trash}Delete</button>
              </div>
            </article>
            </div>
            <p class="deckNote">${I.undo}<span data-left>${left} still to decide.</span> ${
              decided.length
                ? `${decided.length} decided just now, and every one of them can be put back.`
                : "Nothing is decided until you say so, and every decision can be put back."
            }</p>
          </div>
        </section>`,
      body: indexOf(N.pending.slice(queueAt + 1), { title: "Still in the hand", count: `${Math.max(0, left - 1)} left`, noDays: true }),
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
          ${N.speech.separated
            .map(
              (p, i) => `
            <div class="piece">
              <textarea class="pieceField" rows="1" aria-label="Note ${i + 1} of ${N.speech.separated.length}">${esc(p)}</textarea>
              <button class="drop" type="button" aria-label="Drop note ${i + 1}">${I.close}</button>
            </div>`,
            )
            .join("")}
        </div>
        <div class="topFoot">
          <button class="verb" type="button">${I.plus}Add another</button>
          <span class="spacer"></span>
          <span class="topMeta">Two notes, not one</span>
          <button class="act" data-quiet type="button">Discard</button>
          <button class="act" data-ink type="button" data-act="keep-both">${I.check}Put both on the pile</button>
        </div>
      </div>`,
      { behind: 1, label: "What came back" },
    ),
    body: indexOf(work().slice(0, 8), { title: "The pile", count: `${counts().total} notes` }),
    dock: true,
  });

  STATES.seam = () => {
    const note = N.notes[13];
    const marked = esc(note.body).replace(
      "Switch on before guests arrive, not when.",
      '<span class="pick">Switch on before guests arrive, not when.</span>',
    );
    return {
      desk: `
        <section class="desk" aria-label="Turning a note into a task">
          <div class="pile">
            <div class="top">
              <p class="readSrc">${I.typed}<span>Written</span><span class="sep" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span></p>
              <p class="readBody">${marked}</p>
              <p class="stays">${I.lock}${esc(N.copy.stayedPut)}</p>
            </div>
            <div class="peel">
              <div class="peelTop">
                <span class="peelMark" aria-hidden="true">${I.tasks}</span>
                <span class="peelLabel" id="peel-label">${esc(N.copy.wordingLabel)}</span>
              </div>
              <textarea class="peelField" rows="1" aria-labelledby="peel-label">Switch the orchard room heating on 40 minutes before guests arrive</textarea>
              <div class="peelRow">
                <button class="picker" type="button" aria-label="${esc(N.copy.destinationLabel)}: ${esc(N.projects[0])}"><b>To</b>${esc(N.projects[0])}${I.chevron}</button>
                <span class="spacer"></span>
                <button class="act" data-quiet type="button" data-act="close">${esc(N.copy.cancel)}</button>
                <button class="act" data-primary type="button" data-act="send">${I.send}${esc(N.copy.send)}</button>
              </div>
              <p class="peelWhy">${esc(N.copy.payload)}</p>
            </div>
          </div>
        </section>`,
      body: indexOf(N.crossed, { title: "What has crossed into Tasks", count: `${N.counts.sent} so far`, noDays: true }),
      dock: true,
    };
  };

  STATES.search = () => {
    const rows = visible();
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
          <div style="padding:26px 0 0">
            <h2 class="emptyTitle">No note says “${esc(query)}”.</h2>
            <p class="emptyBody">The closest is one about the hire company, from Thursday.</p>
            <div class="emptyMove">
              <button class="act" data-ink type="button" data-act="nearest">${I.search}Open that one</button>
              <button class="act" data-quiet type="button" data-act="clear-search">Clear the search</button>
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

    if (refocus) {
      if (refocus.kind === "row") {
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
  }

  /* ── events ──────────────────────────────────────────────────── */
  mount.addEventListener("input", (e) => {
    const field = e.target.closest(".topField, .phoneField");
    if (field) {
      draft = field.value;
      /* The other field has to agree without stealing the caret from the
         one being typed in. */
      for (const twin of mount.querySelectorAll(".topField, .phoneField")) {
        if (twin !== field && twin.value !== draft) twin.value = draft;
      }
      const foot = mount.querySelector(".topFoot");
      const top = mount.querySelector(".top");
      const wasLive = top && top.hasAttribute("data-live");
      const isLive = Boolean(draft.trim());
      if (foot && wasLive !== isLive) paint();
      return;
    }
    const q = e.target.closest("#q");
    if (q) {
      query = q.value;
      refocus = { kind: "field", sel: "#q" };
      paint();
    }
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
    if (a === "keep" || a === "first") {
      if (a === "first") {
        refocus = { kind: "field", sel: ".topField" };
        paint();
        return;
      }
      keepDraft();
    } else if (a === "close") closeNote();
    else if (a === "undo") doUndo();
    else if (a === "review") {
      state = "review";
      say(`${N.counts.review} notes to decide.`);
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
      say("Listening. Speak whenever you are ready.");
      paint();
    } else if (a === "voice-cancel" || a === "voice-stop") {
      state = a === "voice-stop" ? "readback" : "notebook";
      say(a === "voice-stop" ? "Two notes came back from that." : "Nothing was kept.");
      paint();
    } else if (a === "keep-both") {
      state = "notebook";
      say("Both notes are on the pile.");
      offerUndo("Both notes were taken back off the pile.", () => {});
      paint();
    }
  });

  /* The whole keyboard model, in one place, so nothing can advertise a key
     the file does not answer. */
  addEventListener("keydown", (e) => {
    const typing = e.target.matches("textarea, input, [contenteditable]");

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      if (doUndo()) e.preventDefault();
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
    if (typing) return;

    if (e.key === "/") {
      e.preventDefault();
      state = "search";
      refocus = { kind: "field", sel: "#q" };
      paint();
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

  /* A trim measured against a fallback face is a trim measured against the
     wrong widths, and one measured before a resize is simply stale. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(trimRows);
  let resizeTimer = null;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(trimRows, 90);
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
      WORK = null;
      cursorId = (visible()[0] || {}).id || null;
      paint();
    },
    state: () => state,
  };
})();
