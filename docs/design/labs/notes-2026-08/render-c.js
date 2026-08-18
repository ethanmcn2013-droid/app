/* C · The Stack — the renderer.
 *
 * Two planes: a desk carrying the newest piece of paper, and an index
 * carrying everything older. Every state is those two planes doing something
 * different, which is what keeps a physical metaphor from becoming a set of
 * unrelated screens that happen to have shadows on them.
 */
(function () {
  const N = window.NOTES;
  const I = window.ICON;
  const params = new URLSearchParams(location.search);
  const state = params.get("state") || "notebook";
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  /* ── chrome ─────────────────────────────────────────────────────── */

  function rail() {
    const tiles = ["notes", "tasks", "timeline", "more"];
    const names = { notes: "Notes", tasks: "Tasks", timeline: "Timeline", more: "More" };
    return `
      <nav class="rail" aria-label="Signal Studio">
        <span class="railMark" aria-hidden="true">${I.home}<i></i></span>
        <span class="railDivider" aria-hidden="true"></span>
        <div class="railGroup">
          ${tiles
            .map(
              (k) =>
                `<button class="railTile" type="button" ${k === "notes" ? 'data-active aria-current="page"' : ""} aria-label="${names[k]}${k === "notes" ? ", the page you are on" : ""}">${I[k]}</button>`,
            )
            .join("")}
        </div>
        <span class="railSpacer"></span>
        <button class="railAvatar" type="button" aria-label="${esc(N.operator.role)}. Account and settings">${N.operator.initials}</button>
      </nav>`;
  }

  function head(facts) {
    return `
      <header class="head">
        <span class="word">notes</span>
        <span class="headRule" aria-hidden="true"></span>
        <h1 class="headName">${esc(N.workspace)}</h1>
        ${facts || ""}
        <div class="headActions">
          <button class="headAct" type="button">${I.lock}<span>${esc(N.copy.privacy)}</span></button>
          <button class="headAct" type="button" aria-label="Notes options">${I.dots}</button>
        </div>
      </header>`;
  }

  function pendingChip(n) {
    if (!n) return "";
    return `<button class="chip" type="button" aria-label="${n} notes are waiting on a decision. Go through them">${n} to decide</button>`;
  }

  function dock() {
    return `
      <div class="dockWrap">
        <div class="dock">
          <span class="dockField" role="button" tabindex="0" aria-label="Search notebook">${I.search}<span>Search everything you wrote</span><kbd>/</kbd></span>
          <span class="dockRule" aria-hidden="true"></span>
          <button class="dockGlyph" type="button" aria-label="${esc(N.copy.voiceStart)}">${I.mic}</button>
          <button class="dockGlyph" type="button" aria-label="Read a photo">${I.photo}</button>
          <span class="dockRule" aria-hidden="true"></span>
          <button class="dockAvatar" type="button" aria-label="${esc(N.operator.role)}. Account and settings">${N.operator.initials}</button>
        </div>
      </div>`;
  }

  /* ── the desk ───────────────────────────────────────────────────── */

  /* The two sheets behind the top one are decoration and are hidden from
     the reader: the notes they stand for are in the index below, and
     naming them twice gives a screen reader a duplicate notebook. */
  function behind(n) {
    return Array.from({ length: n }, (_, i) => `<div class="behind" data-n="${n - i}" aria-hidden="true"></div>`).join("");
  }

  function desk(inner, opts) {
    const o = opts || {};
    return `
      <section class="desk" aria-label="${o.label || "Write a note"}">
        <div class="pile">
          ${behind(o.behind === undefined ? 2 : o.behind)}
          ${inner}
        </div>
      </section>`;
  }

  function topSheet(opts) {
    const o = opts || {};
    return desk(
      `<div class="top"${o.value ? " data-live" : ""}>
        <textarea class="topField" rows="2" aria-label="Write a note" placeholder="${esc(N.copy.placeholder)}">${o.value ? esc(o.value) : ""}</textarea>
        <div class="topFoot">
          <button class="verb" type="button">${I.mic}${esc(N.copy.voiceStart)}</button>
          <button class="verb" type="button">${I.photo}Read a photo</button>
          <span class="spacer"></span>
          ${
            o.value
              ? `<span class="topMeta tab">118 / 4000</span><button class="act" data-ink type="button">${I.check}Put it on the pile</button>`
              : `<span class="topMeta">Nobody else can read this</span>`
          }
        </div>
      </div>`,
      { behind: o.behind },
    );
  }

  /* A note lifted out of the index and read on the desk. */
  function readSheet(note) {
    const src = N.sources[note.source];
    return desk(
      `<div class="top">
        <p class="readSrc">${I[src.icon]}<span>${src.label}</span><span class="dot" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span>${note.sent ? `<span class="dot" aria-hidden="true"></span><span>In Tasks as ${esc(note.task)}</span>` : ""}</p>
        <p class="readBody"><span class="lede">${esc(note.title)}</span>${note.rest ? ` ${esc(note.rest)}` : ""}</p>
        <div class="topFoot">
          <button class="act" data-primary type="button">${I.tasks}Turn into a task</button>
          <button class="act" type="button">${I.share}Send to Timeline</button>
          <button class="act" data-quiet type="button" aria-label="More actions for this note">${I.dots}</button>
          <span class="spacer"></span>
          <span class="topMeta">Put it back<kbd style="margin-left:7px">Esc</kbd></span>
        </div>
      </div>`,
      { behind: 1, label: "Reading a note" },
    );
  }

  /* ── the index ──────────────────────────────────────────────────── */

  function idxRow(note, opts) {
    const o = opts || {};
    const src = N.sources[note.source];
    const tag = note.sent
      ? `<span class="idxTag">In Tasks</span>`
      : note.pending
        ? `<span class="idxTag">To decide</span>`
        : `<span class="idxTag" style="box-shadow:none;color:var(--ink-3)">Kept</span>`;
    return `
      <button class="idxRow" type="button"${o.open ? " data-open" : ""} aria-label="${esc(note.title)}. ${src.label}. ${esc(note.when)}.${note.pending ? " Waiting on a decision." : note.sent ? " In Tasks." : ""}">
        <span class="idxMark" aria-hidden="true">${I[src.icon]}${note.pending ? "<i></i>" : ""}</span>
        <span class="idxText"><b>${o.html || esc(note.title)}</b>${note.rest ? ` <span>${o.restHtml || esc(note.rest)}</span>` : ""}</span>
        ${tag}
        <span class="idxWhen tab">${esc(note.when)}</span>
      </button>`;
  }

  function index(notes, opts) {
    const o = opts || {};
    let day = null;
    const rows = [];
    notes.forEach((note, i) => {
      if (!o.noDays && note.day !== day) {
        day = note.day;
        rows.push(`<p class="idxDay">${esc(day)}</p>`);
      }
      rows.push(idxRow(note, { open: o.openIndex === i }));
    });
    return `
      <div class="indexWrap">
        <div class="indexHead"><span>${esc(o.title || "Everything else")}</span><span class="cnt">${esc(o.count || `${notes.length} notes`)}</span></div>
        <div class="index">${rows.join("")}</div>
      </div>`;
  }

  /* ── states ─────────────────────────────────────────────────────── */

  const STATES = {};

  STATES.notebook = () => ({
    facts: pendingChip(N.counts.review),
    body: `${topSheet({})}${index(N.notes, { title: "The pile", count: `${N.counts.notebook} notes` })}`,
    dock: true,
  });

  STATES.capture = () => ({
    facts: pendingChip(N.counts.review),
    body: `${topSheet({
      value:
        "Ring the marquee company back about the side panels. They close at four on a Friday, so it has to be before then.",
    })}${index(N.notes, { title: "The pile", count: `${N.counts.notebook} notes` })}`,
    dock: true,
  });

  /* The whole floor goes to ink. The sheet is still behind it, so nothing
     is lost or unmounted, and the words arrive at the size a person
     speaking would expect them to. */
  STATES.voice = () => {
    const bars = [0.3, 0.68, 0.44, 0.92, 0.58, 0.28, 0.84, 0.5, 0.72, 0.36, 0.96, 0.6, 0.42, 0.8, 0.32, 0.64, 0.52, 0.88, 0.4, 0.7, 0.26, 0.56, 0.82, 0.46, 0.66, 0.34, 0.78, 0.5];
    const said = N.speech.transcript;
    const cut = said.lastIndexOf(" ", 100);
    return {
      facts: pendingChip(N.counts.review),
      body: `${topSheet({})}${index(N.notes.slice(0, 8), { title: "The pile", count: `${N.counts.notebook} notes` })}`,
      dock: true,
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
            <button class="darkAct" type="button">Cancel</button>
            <button class="darkAct" data-primary type="button">${I.stop}Stop and read it back</button>
          </div>
        </section>`,
    };
  };

  STATES.readback = () => ({
    facts: pendingChip(N.counts.review),
    body: `
      ${desk(
        `<div class="top split">
          <p class="saidWas"><b>What you said, once</b>${esc(N.speech.transcript)}</p>
          <div class="pieces">
            ${N.speech.separated
              .map(
                (p, i) => `
              <div class="piece"${i === 0 ? " data-focus" : ""}>${esc(p)}
                <button class="drop" type="button" aria-label="Drop this one">${I.close}</button>
              </div>`,
              )
              .join("")}
          </div>
          <div class="topFoot">
            <button class="verb" type="button">${I.plus}Add another</button>
            <span class="spacer"></span>
            <span class="topMeta">Two notes, not one</span>
            <button class="act" data-quiet type="button">Discard</button>
            <button class="act" data-ink type="button">${I.check}Put both on the pile</button>
          </div>
        </div>`,
        { behind: 1, label: "What came back" },
      )}
      ${index(N.notes.slice(0, 8), { title: "The pile", count: `${N.counts.notebook} notes` })}`,
    dock: true,
  });

  /* The hand. Four cards deep, the top one live, and the depth behind it
     is the number of decisions left — visible without reading a figure. */
  STATES.review = () => {
    const note = N.pending[3];
    const pips = N.pending.map((_, i) => `<i${i < 3 ? " data-done" : i === 3 ? " data-now" : ""}></i>`).join("");
    return {
      facts: "",
      body: `
        <section class="desk" aria-label="Notes waiting on a decision">
          <div class="hand">
            <div class="handCard" data-n="3" aria-hidden="true"></div>
            <div class="handCard" data-n="2" aria-hidden="true"></div>
            <div class="handCard" data-n="1" aria-hidden="true"></div>
            <article class="handTop">
              <div class="handQ">
                <h2 class="handTitle">Worth doing something about?</h2>
                <span class="handOf tab">4 of ${N.counts.review}</span>
                <span class="pips" role="img" aria-label="3 of ${N.counts.review} decided">${pips}</span>
              </div>
              <p class="readSrc">${I[N.sources[note.source].icon]}<span>${N.sources[note.source].label}</span><span class="dot" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span></p>
              <p class="handBody">${esc(note.body)}</p>
              <div class="handFoot">
                <button class="act" data-primary type="button">${I.tasks}Turn into a task<kbd>T</kbd></button>
                <button class="act" type="button">${I.keep}Just keep it<kbd>K</kbd></button>
                <span class="spacer"></span>
                <button class="act" data-quiet type="button">Decide later</button>
                <button class="act" data-quiet type="button">${I.trash}Delete</button>
              </div>
            </article>
            <p class="deckNote">${I.undo}Three decided this morning. ${I.arrowRight ? "" : ""}Undo any of them until you leave.</p>
          </div>
        </section>
        ${index(N.pending.slice(4), { title: "Still in the hand", count: `${N.counts.review - 4} left`, noDays: true })}`,
      dock: true,
    };
  };

  /* The note stays on the desk. The task peels off it as a second, smaller
     piece of paper carrying only the words that will cross. */
  STATES.seam = () => {
    const note = N.notes[13];
    const marked = esc(note.body).replace(
      "Switch on before guests arrive, not when.",
      '<span class="pick">Switch on before guests arrive, not when.</span>',
    );
    return {
      facts: "",
      body: `
        <section class="desk" aria-label="Turning a note into a task">
          <div class="pile">
            <div class="top">
              <p class="readSrc">${I.typed}<span>Written</span><span class="dot" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span></p>
              <p class="readBody">${marked}</p>
              <p class="stays">${I.lock}${esc(N.copy.stayedPut)}</p>
            </div>
            <div class="peel">
              <div class="peelTop">
                <span class="peelMark" aria-hidden="true">${I.tasks}</span>
                <span class="peelLabel">${esc(N.copy.wordingLabel)}</span>
              </div>
              <textarea class="peelField" rows="1" aria-label="${esc(N.copy.wordingLabel)}">Switch the orchard room heating on 40 minutes before guests arrive</textarea>
              <div class="peelRow">
                <button class="picker" type="button" aria-label="${esc(N.copy.destinationLabel)}: ${esc(N.projects[0])}"><b>To</b>${esc(N.projects[0])}${I.chevron}</button>
                <span class="spacer"></span>
                <button class="act" data-quiet type="button">${esc(N.copy.cancel)}</button>
                <button class="act" data-primary type="button">${I.send}${esc(N.copy.send)}</button>
              </div>
              <p class="peelWhy">${esc(N.copy.payload)}</p>
            </div>
          </div>
        </section>
        ${index(N.crossed, { title: "What has crossed into Tasks", count: `${N.counts.sent} so far`, noDays: true })}`,
      dock: true,
    };
  };

  STATES.search = () => {
    const q = "orchard";
    const hits = N.notes.filter((n) => n.body.toLowerCase().includes(q));
    const hl = (t) => esc(t).replace(new RegExp(`(${q})`, "gi"), "<mark>$1</mark>");
    return {
      facts: "",
      body: `
        <div class="searchTop">
          <div class="searchBar">
            ${I.search}
            <input value="${q}" aria-label="Search notebook">
            <span class="esc">Esc</span>
          </div>
        </div>
        <div class="indexWrap">
          <div class="indexHead"><span>Found</span><span class="cnt">in everything you have written</span></div>
          <div class="hits index">
            <p class="hitsCount"><b>${hits.length}</b> notes have “${q}” in them</p>
            ${hits
              .map(
                (n) => `
              <div class="hit">
                ${I[N.sources[n.source].icon]}
                <div>
                  <p class="hitBody" style="margin:0"><b>${hl(n.title)}</b> ${hl(n.rest)}</p>
                  <p class="hitWhen tab" style="margin:0">${esc(n.when)}${n.sent ? " · In Tasks" : ""}</p>
                </div>
              </div>`,
              )
              .join("")}
          </div>
        </div>`,
      dock: true,
    };
  };

  STATES.pressure = () => ({
    facts: pendingChip(12),
    body: `
      ${desk(
        `<div class="top">
          <p class="readSrc">${I.typed}<span>Written</span><span class="dot" aria-hidden="true"></span><span class="tab">${esc(N.long.when)}</span><span class="dot" aria-hidden="true"></span><span>${N.long.words} words</span></p>
          <p class="readBody" style="font-size:16.5px;line-height:1.62">${esc(N.long.body)}</p>
          <div class="topFoot">
            <button class="act" data-primary type="button">${I.tasks}Turn into a task</button>
            <button class="act" data-quiet type="button" aria-label="More actions for this note">${I.dots}</button>
            <span class="spacer"></span>
            <span class="topMeta">Put it back<kbd style="margin-left:7px">Esc</kbd></span>
          </div>
        </div>`,
        { behind: 1, label: "Reading a note" },
      )}
      ${index(N.dense.slice(0, 30), { title: "The pile", count: `${N.counts.dense} notes, peak season, an extension of the fixture`, noDays: true })}`,
    dock: true,
  });

  STATES.nothing = () => ({
    facts: "",
    body: `
      ${desk(
        `<div class="top emptyPaper">
          <h2 class="emptyTitle">${esc(N.copy.emptyTitle)}</h2>
          <p class="emptyBody">Nobody else can read what you write here. Notes only sends something on when you pick the words yourself.</p>
          <div class="emptyMove">
            <button class="act" data-ink type="button">${I.typed}Write the first one</button>
            <button class="act" type="button">${I.mic}Or say it</button>
          </div>
        </div>`,
        { behind: 0, label: "An empty notebook" },
      )}
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
              <div class="emptyMove"><button class="act" type="button">${I.undo}Undo the last delete</button></div>
              <p class="specWhy">An empty that follows an action is a different empty from a first-use one, and it offers the way back.</p>
            </div>
          </div>
        </div>
      </div>`,
    dock: true,
  });

  STATES["not-yet"] = () => ({
    facts: "",
    body: `
      ${desk(
        `<div class="top" data-live>
          <p class="readBody" style="font-size:17px">Written while the connection was down.</p>
          <div class="topFoot">
            <span class="topMeta">${I.wifiOff ? "" : ""}Held on this device. Nothing is lost.</span>
            <span class="spacer"></span>
            <button class="act" type="button">${I.undo}Try now</button>
          </div>
        </div>`,
        { behind: 1, label: "A note held on this device" },
      )}
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
              <span class="act" role="presentation"></span>
            </div>
            <div class="state">
              ${I.alert}
              <div>
                <b>That did not save</b>
                <p>Your words are still on the paper, exactly as you left them. Nothing has been cleared.</p>
              </div>
              <button class="act" type="button">Save it again</button>
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
              <button class="act" data-ink type="button">Delete it</button>
            </div>
            <div class="state" style="box-shadow:none;padding:6px 0 0;display:block">
              <p class="idxDay" style="padding-top:8px">Still arriving</p>
              ${[88, 64, 92, 58].map((w) => `<div style="padding:12px 0;border-top:1px solid var(--line-soft)"><div class="sk" style="width:${w}%"></div><div class="sk" style="width:${Math.round(w * 0.6)}%"></div></div>`).join("")}
              <p class="skelSay">Opening your notebook. Fourteen notes, newest first.</p>
            </div>
          </div>
        </div>
      </div>`,
    dock: true,
  });

  /* ── paint ──────────────────────────────────────────────────────── */

  const s = (STATES[state] || STATES.notebook)();
  document.getElementById("root").innerHTML = `
    <div class="floor">
      ${rail()}
      <main class="sheet">
        ${head(s.facts)}
        ${s.body}
        ${s.dock ? dock() : ""}
      </main>
      ${s.over || ""}
    </div>`;
  document.documentElement.setAttribute("data-state", state);
})();
