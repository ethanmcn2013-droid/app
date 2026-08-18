/* B · The Page — the renderer.
 *
 * One page, one render path. Every state is the same manuscript: a hanging
 * gutter, one column of prose, and whatever is happening happening inside it.
 * Nothing in this direction navigates anywhere.
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

  function head() {
    return `
      <header class="head">
        <div class="headInner">
          <span class="headPad" aria-hidden="true"></span>
          <span class="word">notes</span>
          <span class="headRule" aria-hidden="true"></span>
          <h1 class="headName">${esc(N.workspace)}</h1>
          <div class="headActions">
            <button class="headAct" type="button">${I.lock}<span>${esc(N.copy.privacy)}</span></button>
            <button class="headAct" type="button" aria-label="Notes options">${I.dots}</button>
          </div>
        </div>
      </header>`;
  }

  /* The band exists only when there are decisions. It states the number in
     a sentence rather than as a badge, and pressing it does not navigate. */
  function band(n) {
    if (!n) return "";
    return `
      <div class="band">
        <div class="bandInner">
          <span class="headPad" aria-hidden="true"></span>
          <span><b>${n} notes</b> are waiting on a decision from you.</span>
          <button class="chip" type="button">${I.arrowRight}Go through them</button>
        </div>
      </div>`;
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

  /* ── the page ───────────────────────────────────────────────────── */

  function side(note) {
    const src = N.sources[note.source];
    return `
      <div class="blockSide">
        <span class="blockWhen tab">${esc(note.when)}</span>
        <span class="blockHow">${I[src.icon]}<span>${src.label}</span></span>
        ${note.pending ? '<span class="sr">Waiting on a decision</span>' : ""}
      </div>`;
  }

  function prose(note, opts) {
    const o = opts || {};
    const lede = o.html || esc(note.title);
    const rest = note.rest ? ` ${o.restHtml || esc(note.rest)}` : "";
    return `<p class="blockBody"${o.fold ? " data-fold" : ""}><span class="lede">${lede}</span>${rest}</p>`;
  }

  /* The right margin. What became of this note, or what it is still
     waiting for, plus the one way to act on it. Never set into the prose
     column, which is the direction's whole rule. */
  function aside(note, opts) {
    const o = opts || {};
    if (o.decide) return "";
    const rows = [];
    if (note.sent) {
      rows.push(
        `<span class="receiptLine">${I.tasks}<span><b>In Tasks as</b><a href="#">${esc(note.task || "a task")}</a></span></span>`,
      );
    } else if (note.reviewed) {
      rows.push(`<span class="receiptLine">${I.keep}<span>Kept, nothing to do</span></span>`);
    } else if (note.pending) {
      /* The margin rule beside the note already says this one is waiting,
         and the note's own accessible name says so in words. Printing
         "Wants a decision" on every pending note as well repeated the
         same fact eight times down one column. */
      rows.push(`<button class="mini" data-strong type="button" aria-label="Decide about: ${esc(note.title)}">${I.arrowRight}Decide</button>`);
    }
    rows.push(`<button class="mini" type="button" aria-label="More actions for: ${esc(note.title)}">${I.dots}</button>`);
    return `<div class="blockAside">${rows.join("")}</div>`;
  }

  function block(note, opts) {
    const o = opts || {};
    const decide = o.decide
      ? `<div class="decide">
           <button class="act" data-primary type="button">${I.tasks}Turn into a task<kbd>T</kbd></button>
           <button class="act" type="button">${I.keep}Just keep it<kbd>K</kbd></button>
           <span class="spacer"></span>
           <button class="act" data-quiet type="button">Decide later</button>
           <button class="act" data-quiet type="button">${I.trash}Delete</button>
         </div>`
      : "";
    return `
      <article class="block"${note.pending ? " data-pending" : ""}>
        ${side(note)}
        <div class="blockText${o.lift ? " lift" : ""}">
          ${prose(note, o)}
          ${o.fold ? `<button class="more" type="button">${I.chevron}Read the rest, ${note.words - 60} more words</button>` : ""}
          ${decide}
        </div>
        ${aside(note, o)}
      </article>`;
  }

  function dayMark(label) {
    return `<div class="dayMark"><span>${esc(label)}</span></div>`;
  }

  /* The caret. Capture with no object around it. */
  function write(opts) {
    const o = opts || {};
    return `
      <div class="write">
        <div class="writeSide">
          <span class="writeNow">Now</span>
          <span class="writeHint">${o.value ? "not saved yet" : "start typing"}</span>
        </div>
        <div class="writeMain">
          <span class="caret" aria-hidden="true"></span>
          <textarea class="writeField" rows="1" aria-label="Write a note" placeholder="${esc(N.copy.placeholder)}">${o.value ? esc(o.value) : ""}</textarea>
          <div class="writeFoot">
            <button class="verb" type="button">${I.mic}${esc(N.copy.voiceStart)}</button>
            <button class="verb" type="button">${I.photo}Read a photo</button>
            <span class="spacer"></span>
            ${
              o.value
                ? `<span class="saveHint"><kbd>⌘</kbd><kbd>Enter</kbd></span><button class="act" data-ink type="button">${I.check}Keep it</button>`
                : ""
            }
          </div>
        </div>
        <p class="writeAside">${o.value ? "118 of 4000 characters. Nothing has left this device." : "Nobody else can read what you write here."}</p>
        <span class="writeRule" aria-hidden="true"></span>
      </div>`;
  }

  function pageOf(notes, opts) {
    const o = opts || {};
    let day = null;
    const out = [];
    notes.forEach((note, i) => {
      if (!o.noDays && note.day !== day) {
        day = note.day;
        out.push(dayMark(day));
      }
      out.push(block(note, { fold: o.foldIndex === i, ...o.each }));
    });
    return out.join("");
  }

  /* ── states ─────────────────────────────────────────────────────── */

  const STATES = {};

  STATES.notebook = () => ({
    band: N.counts.review,
    page: `${write({})}${pageOf(N.notes)}`,
  });

  STATES.capture = () => ({
    band: N.counts.review,
    page: `${write({
      value:
        "Ring the marquee company back about the side panels. They close at four on a Friday, so it has to be before then.",
    })}${pageOf(N.notes)}`,
  });

  /* Voice stays on the page. The words land exactly where typed words
     land, at the same size, and the disclosure sits under them at every
     beat rather than in front of them once. */
  STATES.voice = () => {
    const bars = [0.3, 0.62, 0.4, 0.9, 0.55, 0.26, 0.78, 0.46, 0.68, 0.34, 0.86, 0.52];
    const said = N.speech.transcript;
    const cut = said.lastIndexOf(" ", 92);
    return {
      band: N.counts.review,
      page: `
        <div class="write listening">
          <div class="writeSide liveSide">
            <span class="liveTag"><span class="recDot" aria-hidden="true"></span>Listening</span>
            <span class="writeHint tab">0:07</span>
            <span class="wave" aria-hidden="true">${bars.map((b) => `<i style="height:${Math.round(b * 22)}px"></i>`).join("")}</span>
          </div>
          <div class="writeMain">
            <p class="said" role="status">${esc(said.slice(0, cut))}<span class="tail"> ${esc(said.slice(cut + 1))}</span></p>
            <div class="writeFoot">
              <button class="act" data-quiet type="button">Cancel</button>
              <span class="spacer"></span>
              <button class="act" data-ink type="button">${I.stop}Stop and read it back</button>
            </div>
          </div>
          <p class="disclose">${esc(N.copy.voiceDisclosure)}</p>
          <span class="writeRule" aria-hidden="true"></span>
        </div>
        ${pageOf(N.notes.slice(0, 6))}`,
    };
  };

  STATES.readback = () => ({
    band: N.counts.review,
    page: `
      <div class="block">
        <div class="heardSide blockSide">
          <span class="heardLabel">What you said</span>
          <span class="blockHow">${I.mic}<span>Spoken</span></span>
        </div>
        <div class="heardBody">${esc(N.speech.transcript)}</div>
      </div>
      <div class="block">
        <div class="blockSide">
          <span class="blockWhen">Two notes</span>
          <span class="blockHow">from that</span>
        </div>
        <div class="blockText" style="border-top:1px solid var(--line-soft)">
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
          <div class="decide">
            <button class="mini" type="button">${I.plus}Add another</button>
            <span class="spacer"></span>
            <button class="act" data-quiet type="button">Discard</button>
            <button class="act" data-ink type="button">${I.check}Keep both</button>
          </div>
          <p class="taskWhy">Edit anything that is not quite right. Nothing is saved until you keep it.</p>
        </div>
      </div>
      ${pageOf(N.notes.slice(0, 5))}`,
  });

  /* Review does not navigate. The notes that want a decision lift to the
     top of the same page, in the same type, with the decision under each
     one — so the person can see how many are left without counting. */
  STATES.review = () => {
    const lifted = N.pending.slice(0, 3);
    const pips = N.pending.map((_, i) => `<i${i < 3 ? " data-done" : ""}></i>`).join("");
    return {
      band: 0,
      page: `
        <div class="queueHead">
          <h2 class="queueTitle">Eight notes want a decision</h2>
          <span class="queueNote">Three decided this morning</span>
          <span class="pips" role="img" aria-label="3 of ${N.counts.review} decided">${pips}</span>
        </div>
        ${lifted.map((n) => block(n, { decide: true, lift: true })).join("")}
        <div class="dayMark"><span>the rest of the notebook</span></div>
        ${pageOf(N.notes.filter((n) => !n.pending).slice(0, 4), { noDays: true })}`,
    };
  };

  /* The task is written in the margin beside the words it comes from. The
     page never moves and the note is never covered. */
  STATES.seam = () => {
    const note = N.notes[13];
    const marked = esc(note.body).replace(
      "Switch on before guests arrive, not when.",
      '<span class="pick">Switch on before guests arrive, not when.</span>',
    );
    return {
      band: 0,
      page: `
        <div class="block">
          ${side(note)}
          <div class="blockText">
            <p class="blockBody">${marked}</p>
            <div class="marginTask">
              <span class="taskLabel">${esc(N.copy.wordingLabel)}</span>
              <textarea class="taskField" rows="1" aria-label="${esc(N.copy.wordingLabel)}">Switch the orchard room heating on 40 minutes before guests arrive</textarea>
              <div class="taskRow">
                <button class="picker" type="button" aria-label="${esc(N.copy.destinationLabel)}: ${esc(N.projects[0])}"><b>To</b>${esc(N.projects[0])}${I.chevron}</button>
                <span class="spacer"></span>
                <button class="act" data-quiet type="button">${esc(N.copy.cancel)}</button>
                <button class="act" data-primary type="button">${I.send}${esc(N.copy.send)}</button>
              </div>
              <p class="taskWhy">${esc(N.copy.payload)}</p>
            </div>
          </div>
        </div>

        <div class="ledgerHead">
          <h2 class="ledgerTitle">What has crossed into Tasks</h2>
          <span class="ledgerNote">${N.counts.sent} so far. Every note stayed on this page.</span>
        </div>
        ${N.crossed
          .map(
            (c) => `
          <div class="block crossRow">
            <div class="crossSide"><span class="crossLane">${esc(c.lane)}</span></div>
            <div class="crossMain">
              <p class="crossTask">${esc(c.task)}</p>
              <p class="crossFrom">from ${esc(c.title)} <span class="tab">· ${esc(c.crossedWhen)}</span></p>
            </div>
          </div>`,
          )
          .join("")}`,
    };
  };

  STATES.search = () => {
    const q = "orchard";
    const hits = N.notes.filter((n) => n.body.toLowerCase().includes(q));
    const hl = (t) => esc(t).replace(new RegExp(`(${q})`, "gi"), "<mark>$1</mark>");
    return {
      band: 0,
      page: `
        <p class="foundHead"><b>${hits.length}</b> notes have “${q}” in them. Newest first.</p>
        ${hits.map((n) => block(n, { html: hl(n.title), restHtml: hl(n.rest) })).join("")}`,
    };
  };

  STATES.pressure = () => ({
    band: 12,
    page: `
      ${dayMark("Today")}
      ${block(N.long, { fold: true })}
      ${pageOf(N.dense.slice(0, 12), { noDays: true })}`,
  });

  STATES.nothing = () => ({
    band: 0,
    page: `
      <div class="block">
        <div class="emptyMain">
          <h2 class="emptyTitle">${esc(N.copy.emptyTitle)}</h2>
          <p class="emptyBody">Nobody else can read what you write here. Notes only sends something on when you pick the words yourself.</p>
          <div class="emptyMove">
            <button class="act" data-ink type="button">${I.typed}Write the first one</button>
            <button class="act" type="button">${I.mic}Or say it</button>
          </div>
        </div>
      </div>
      <div class="specs">
        <div class="specRow">
          <div class="specName">Nothing matched</div>
          <div class="specMain">
            <h3 class="emptyTitle">No note says “marquee sides”.</h3>
            <p class="emptyBody">The closest is one about the hire company, from Thursday.</p>
            <div class="emptyMove"><button class="act" type="button">${I.search}Open that one</button><button class="act" data-quiet type="button">Clear the search</button></div>
            <p class="specWhy">A search with no hits offers the nearest thing it does have. A dead end is a defect.</p>
          </div>
        </div>
        <div class="specRow">
          <div class="specName">Nothing to decide</div>
          <div class="specMain">
            <h3 class="emptyTitle">Everything is decided.</h3>
            <p class="emptyBody">Eight notes went through this morning. Three became tasks and five stayed here.</p>
            <div class="emptyMove"><button class="act" type="button">${I.tasks}See the three in Tasks</button></div>
            <p class="specWhy">The end of a queue reports what the queue did, and points at where the work went.</p>
          </div>
        </div>
        <div class="specRow">
          <div class="specName">Nothing has crossed</div>
          <div class="specMain">
            <h3 class="emptyTitle">Nothing has left Notes yet.</h3>
            <p class="emptyBody">When you turn a note into a task, only the words you pick cross. This is where they get listed.</p>
            <div class="emptyMove"><button class="act" type="button">${I.arrowRight}Pick a note to start with</button></div>
            <p class="specWhy">An empty ledger explains the promise it exists to keep, then offers the one move that fills it.</p>
          </div>
        </div>
        <div class="specRow">
          <div class="specName">After a clear-out</div>
          <div class="specMain">
            <h3 class="emptyTitle">Your notebook is empty again.</h3>
            <p class="emptyBody">Fourteen notes went to Tasks or were deleted. Nothing is waiting on you.</p>
            <div class="emptyMove"><button class="act" type="button">${I.undo}Undo the last delete</button></div>
            <p class="specWhy">An empty that follows an action is a different empty from a first-use one, and it offers the way back.</p>
          </div>
        </div>
      </div>`,
  });

  STATES["not-yet"] = () => ({
    band: 0,
    page: `
      <div class="stateRow" data-tone="hold">
        <div class="stateSide">${I.wifiOff}</div>
        <div class="stateMain">
          <p class="stateTitle">Held on this device</p>
          <p class="stateBody">You are offline, so this one is saved here. Notes will put it on the page the moment you reconnect. Nothing is lost and nothing has left.</p>
          <div class="stateMove"><button class="act" type="button">${I.undo}Try now</button></div>
        </div>
      </div>
      <div class="stateRow">
        <div class="stateSide">${I.alert}</div>
        <div class="stateMain">
          <p class="stateTitle">That did not save</p>
          <p class="stateBody">Your words are still in the field, exactly as you left them. Nothing has been cleared.</p>
          <div class="stateMove"><button class="act" type="button">Save it again</button></div>
        </div>
      </div>
      <div class="stateRow">
        <div class="stateSide">${I.split}</div>
        <div class="stateMain">
          <p class="stateTitle">This note changed somewhere else</p>
          <p class="stateBody">${esc(N.copy.sourceChanged)}</p>
          <div class="stateMove"><button class="act" type="button">Read both</button></div>
        </div>
      </div>
      <div class="stateRow">
        <div class="stateSide">${I.trash}</div>
        <div class="stateMain">
          <p class="stateTitle">Delete this note?</p>
          <p class="stateBody">It has not been sent anywhere, so deleting it here deletes it everywhere. You can undo this for thirty seconds.</p>
          <div class="stateMove"><button class="act" data-ink type="button">Delete it</button><button class="act" data-quiet type="button">Keep it</button></div>
        </div>
      </div>
      <div class="dayMark"><span>still arriving</span></div>
      <div class="skel" aria-hidden="true">
        ${[88, 62, 94, 58].map((w) => `<div class="skelRow"><div class="skelSide"><div class="sk" style="width:62px"></div></div><div class="skelMain"><div class="sk" style="width:${w}%"></div><div class="sk" style="width:${Math.round(w * 0.6)}%"></div></div></div>`).join("")}
      </div>
      <p class="skelSay">Opening your notebook. Fourteen notes, newest first.</p>`,
  });

  /* ── paint ──────────────────────────────────────────────────────── */

  const s = (STATES[state] || STATES.notebook)();
  document.getElementById("root").innerHTML = `
    <div class="floor">
      ${rail()}
      <main class="sheet">
        ${head()}
        ${band(s.band)}
        <div class="body"><div class="page">${s.page}</div></div>
        ${dock()}
      </main>
    </div>`;
  document.documentElement.setAttribute("data-state", state);
})();
