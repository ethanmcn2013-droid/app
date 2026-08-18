/* A · The Desk — the renderer.
 *
 * One render path. Every state is the same floor, the same capsule, the same
 * sheet head and the same dock; only the sheet's body changes, which is the
 * only honest way to compare a direction against itself.
 */
(function () {
  const N = window.NOTES;
  const I = window.ICON;
  const params = new URLSearchParams(location.search);
  const state = params.get("state") || "notebook";
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  /* ── chrome ─────────────────────────────────────────────────────── */

  function rail() {
    const tiles = [
      { key: "notes", label: "Notes", active: true },
      { key: "tasks", label: "Tasks" },
      { key: "timeline", label: "Timeline" },
      { key: "more", label: "More" },
    ];
    return `
      <nav class="rail" aria-label="Signal Studio">
        <span class="railMark" aria-hidden="true">${I.home}<i></i></span>
        <span class="railDivider" aria-hidden="true"></span>
        <div class="railGroup">
          ${tiles
            .map(
              (t) =>
                `<button class="railTile" type="button" ${t.active ? 'data-active aria-current="page"' : ""} aria-label="${t.label}${t.active ? ", the page you are on" : ""}">${I[t.key]}</button>`,
            )
            .join("")}
        </div>
        <span class="railSpacer"></span>
        <button class="railAvatar" type="button" aria-label="${esc(N.operator.role)}. Account and settings">${N.operator.initials}</button>
      </nav>`;
  }

  /* The head names the file, states what is in it, and carries the one
     outstanding count. `facts` differs by state so no head ever states a
     number the body below it disagrees with. */
  function head(facts, actions) {
    return `
      <header class="head">
        <span class="word">notes</span>
        <span class="headRule" aria-hidden="true"></span>
        <h1 class="headName">${esc(N.workspace)}</h1>
        <div class="headFacts">${facts}</div>
        <div class="headActions">${actions || defaultActions()}</div>
      </header>`;
  }

  function defaultActions() {
    return `
      <button class="headAct" type="button">${I.lock}<span>${esc(N.copy.privacy)}</span></button>
      <button class="headAct" type="button" aria-label="Notes options">${I.dots}</button>`;
  }

  function countFacts(total, pending) {
    const parts = [`<span class="tab"><b>${total}</b> notes</span>`];
    if (pending > 0) {
      parts.push(
        `<button class="chip" type="button" aria-label="${pending} notes are waiting on a decision. Review them">${pending} want a decision</button>`,
      );
    }
    return parts.join("");
  }

  /* ── the dock, which is the composer ────────────────────────────── */

  function dock(opts) {
    const o = opts || {};
    const live = o.value ? " data-live" : "";
    const mode = o.mode ? ` data-mode="${o.mode}"` : "";
    const lead = o.mode === "search" ? `<span class="dockLead" aria-hidden="true">${I.search}</span>` : "";
    const placeholder = o.mode === "search" ? "Search everything you have written" : N.copy.placeholder;
    const glyphs =
      o.mode === "search"
        ? ""
        : `<button class="dockGlyph" type="button" aria-label="${esc(N.copy.voiceStart)}">${I.mic}</button>
           <button class="dockGlyph" type="button" aria-label="Read a photo">${I.photo}</button>
           <span class="dockRule" aria-hidden="true"></span>`;
    const value = o.value ? esc(o.value) : "";
    const rows = o.value ? Math.min(6, o.value.split("\n").length + 1) : 1;
    const hint = o.mode === "search"
      ? `<span class="dockHint"><kbd>Esc</kbd> back to writing</span>`
      : o.value
        ? `<span class="dockHint"><kbd>${"⌘"}</kbd><kbd>Enter</kbd> save</span>`
        : `<span class="dockHint"><kbd>/</kbd> search</span>`;
    const count = o.count ? `<span class="dockCount tab">${esc(o.count)}</span>` : "";
    return `
      <div class="dockWrap">
        <div class="dock"${live}${mode}>
          ${lead}
          <textarea class="dockField" rows="${rows}" aria-label="${o.mode === "search" ? "Search notebook" : "Write a note"}" placeholder="${esc(placeholder)}">${value}</textarea>
          ${glyphs}
          <button class="dockSend" type="button" ${o.value ? "" : "disabled"} aria-label="${o.mode === "search" ? "Search" : "Save this note"}">${o.mode === "search" ? I.search : I.send}</button>
          ${hint}${count}
        </div>
      </div>`;
  }

  /* ── the run ────────────────────────────────────────────────────── */

  function mark(note) {
    const src = N.sources[note.source];
    return `<span class="entryMark">${I[src.icon]}<span class="sr">${src.label}</span>${note.pending ? '<i aria-hidden="true"></i><span class="sr">Waiting on a decision</span>' : ""}</span>`;
  }

  function foot(note) {
    const bits = [`<span class="tab">${esc(note.when)}</span>`];
    if (note.sent) {
      bits.push(
        `<span class="dot" aria-hidden="true"></span><span class="crossed">${I.tasks}<span>In Tasks</span></span>`,
      );
    } else if (note.reviewed) {
      bits.push(`<span class="dot" aria-hidden="true"></span><span>Kept</span>`);
    }
    return `<div class="entryFoot">${bits.join("")}</div>`;
  }

  function entry(note, opts) {
    const o = opts || {};
    if (o.open) {
      return `
        <article class="entry" data-open>
          ${mark(note)}
          <div>
            <p class="entryTitle">${o.html || esc(note.title)}${note.rest ? ` <span class="entryRest">${o.restHtml || esc(note.rest)}</span>` : ""}</p>
          </div>
          <div class="openFoot">
            <button class="entryAct" data-primary type="button">${I.tasks}Turn into a task</button>
            <button class="entryAct" type="button">${I.share}Send to Timeline</button>
            <button class="entryAct" type="button" aria-label="More actions for this note">${I.dots}</button>
            <span class="openMeta tab">Captured ${esc(note.when)}${note.edited ? " · edited" : ""}</span>
          </div>
        </article>`;
    }
    return `
      <article class="entry" tabindex="0" role="button" aria-label="${esc(note.title)} ${esc(note.when)}">
        ${mark(note)}
        <div>
          <p class="entryTitle">${o.html || esc(note.title)}</p>
          ${note.rest ? `<p class="entryRest">${o.restHtml || esc(note.rest)}</p>` : ""}
        </div>
        ${foot(note)}
      </article>`;
  }

  /* The run groups by day, because a notebook is kept in time and a date
     rule costs one line where a per-note date costs one on every note. */
  function run(notes, opts) {
    const o = opts || {};
    let day = null;
    const out = [];
    notes.forEach((note, i) => {
      if (note.day !== day) {
        day = note.day;
        out.push(`<h2 class="dayRule">${esc(day)}</h2>`);
      }
      out.push(entry(note, { open: o.openIndex === i }));
    });
    return `<div class="run">${out.join("")}</div>`;
  }

  /* ── states ─────────────────────────────────────────────────────── */

  const STATES = {};

  STATES.notebook = () => ({
    facts: countFacts(N.counts.notebook, N.counts.review),
    body: `<div class="body">${run(N.notes, { openIndex: 2 })}</div>`,
    foot: dock({}),
  });

  STATES.capture = () => ({
    facts: countFacts(N.counts.notebook, N.counts.review),
    body: `<div class="body">${run(N.notes)}</div>`,
    foot: dock({
      value:
        "Ring the marquee company back about the side panels.\nThey close at four on a Friday, so it has to be before then.",
      count: "118 / 4000",
    }),
  });

  /* Voice takes the sheet, because a person dictating is not reading a
     notebook. Three beats on one artboard: the disclosure is present at
     every beat and costs nothing, which is the argument. */
  STATES.voice = () => {
    const bars = [0.3, 0.7, 0.45, 1, 0.62, 0.28, 0.86, 0.5, 0.74, 0.36, 0.94, 0.58, 0.42, 0.8, 0.34, 0.66, 0.5, 0.9, 0.4, 0.7, 0.25, 0.55, 0.82, 0.46];
    const said = N.speech.transcript;
    const cut = said.lastIndexOf(" ", 96);
    return {
      facts: countFacts(N.counts.notebook, N.counts.review),
      body: `<div class="body">${run(N.notes)}</div>`,
      foot: dock({}),
      over: `
        <section class="stage" aria-label="Dictating">
          <div class="stageBody">
            <p class="stageKicker"><span class="recDot" aria-hidden="true"></span>Listening<span class="stageTime tab">0:07</span></p>
            <p class="stageSaid">${esc(said.slice(0, cut))}<span class="tail"> ${esc(said.slice(cut + 1))}</span></p>
            <div class="wave" aria-hidden="true">${bars.map((b) => `<i style="height:${Math.round(b * 30)}px"></i>`).join("")}</div>
            <p class="stageDisclosure">${esc(N.copy.voiceDisclosure)}</p>
          </div>
          <div class="stageFoot">
            <button class="bigAct" type="button">Cancel</button>
            <button class="bigAct" data-primary type="button">${I.stop}Stop and read it back</button>
          </div>
        </section>`,
    };
  };

  STATES.readback = () => ({
    facts: countFacts(N.counts.notebook, N.counts.review),
    body: `
      <div class="body">
        <div class="back">
          <div class="backHead">
            <h2 class="backTitle">Two notes came out of that</h2>
            <span class="backNote">Edit anything that is not quite right</span>
          </div>
          <p class="heard"><b>What you said</b>${esc(N.speech.transcript)}</p>
          ${N.speech.separated
            .map(
              (piece, i) => `
            <div class="piece"${i === 0 ? " data-focus" : ""}>
              ${esc(piece)}
              <button class="drop" type="button" aria-label="Drop this one">${I.close}</button>
            </div>`,
            )
            .join("")}
          <div class="backFoot">
            <button class="qAct" type="button">${I.plus}Add another</button>
            <span class="spacer"></span>
            <button class="qAct" type="button">Discard</button>
            <button class="qAct" data-primary type="button">${I.check}Keep both</button>
          </div>
        </div>
      </div>`,
    foot: "",
  });

  /* Review is walked in place. The queue does not navigate away from the
     notebook: it is the notebook, one decision at a time, with the run
     underneath it and the count in the head that sent you here. */
  STATES.review = () => {
    const note = N.pending[3];
    const nextNote = N.pending[4];
    const pips = N.pending
      .map((_, i) => `<i${i < 3 ? " data-done" : i === 3 ? " data-now" : ""}></i>`)
      .join("");
    return {
      facts: `<span class="tab"><b>${N.counts.review}</b> to decide</span><span class="soft">3 decided just now</span>`,
      body: `
        <div class="body">
          <div class="walk">
            <div class="walkBar">
              <h2 class="walkTitle">Worth doing something about?</h2>
              <span class="walkOf tab">4 of ${N.counts.review}</span>
              <span class="pips" role="img" aria-label="3 of ${N.counts.review} decided">${pips}</span>
            </div>
            <article class="walkNote">
              <p class="walkMeta">${I[N.sources[note.source].icon]}<span>${N.sources[note.source].label}</span><span class="dot" aria-hidden="true"></span><span class="tab">${esc(note.when)}</span></p>
              <p class="walkBody">${esc(note.body)}</p>
              <div class="walkActions">
                <button class="qAct" data-primary type="button">${I.tasks}Turn into a task<kbd>T</kbd></button>
                <button class="qAct" type="button">${I.keep}Just keep it<kbd>K</kbd></button>
                <span class="spacer"></span>
                <button class="qAct" data-quiet type="button">Decide later</button>
                <button class="qAct" data-quiet type="button">${I.trash}Delete</button>
              </div>
            </article>
            <p class="next">${I.arrowRight}Next: ${esc(nextNote.title)}</p>
            <div class="queueTail">
              <h3 class="tailHead">Still to decide</h3>
              ${N.pending
                .slice(4)
                .map(
                  (n) => `
                <div class="tailRow">
                  ${I[N.sources[n.source].icon]}
                  <p>${esc(n.title)}</p>
                  <span class="tab">${esc(n.when)}</span>
                </div>`,
                )
                .join("")}
            </div>
          </div>
        </div>`,
      foot: "",
    };
  };

  /* The seam. The note stays on screen, the words that cross are marked
     inside the person's own sentence, and the task is written in a panel
     hanging off them. Nothing is behind a scrim. */
  STATES.seam = () => {
    const note = N.notes[13];
    const picked = "Switch the orchard room heating on 40 minutes before guests arrive";
    const body = esc(note.body);
    const marked = body.replace(
      "Switch on before guests arrive, not when.",
      '<span class="pick">Switch on before guests arrive, not when.</span>',
    );
    return {
      facts: countFacts(N.counts.notebook, N.counts.review),
      body: `
        <div class="body">
          <div class="run">
            <h2 class="dayRule">Monday</h2>
            <article class="entry seamNote" data-open>
              <span class="entryMark">${I.typed}<span class="sr">Written</span></span>
              <div>
                <p class="entryTitle" style="font-size:17px;line-height:1.62;font-weight:400">${marked}</p>
                <div class="craft">
                  <p class="craftLabel">${esc(N.copy.wordingLabel)}</p>
                  <textarea class="craftField" rows="2" aria-label="${esc(N.copy.wordingLabel)}">${esc(picked)}</textarea>
                  <div class="craftRow">
                    <button class="picker" type="button" aria-label="${esc(N.copy.destinationLabel)}: ${esc(N.projects[0])}"><b>To</b>${esc(N.projects[0])}${I.chevron}</button>
                    <span class="spacer"></span>
                    <button class="qAct" type="button">${esc(N.copy.cancel)}</button>
                    <button class="qAct" data-primary type="button">${I.send}${esc(N.copy.send)}</button>
                  </div>
                  <p class="boundary">${esc(N.copy.payload)}</p>
                </div>
              </div>
            </article>

            <div class="ledger">
              <div class="ledgerHead">
                <h2 class="ledgerTitle">What has crossed into Tasks</h2>
                <span class="ledgerNote">${N.counts.sent} so far. Every note stayed here.</span>
              </div>
              ${N.crossed
                .map(
                  (c) => `
                <div class="cross">
                  <p class="crossTask">${esc(c.task)}</p>
                  <span class="crossLane">${esc(c.lane)}</span>
                  <p class="crossFrom">from ${esc(c.title)} <span class="tab">· ${esc(c.crossedWhen)}</span></p>
                </div>`,
                )
                .join("")}
            </div>
          </div>
        </div>`,
      foot: dock({}),
    };
  };

  STATES.search = () => {
    const q = "orchard";
    const hits = N.notes.filter((n) => n.body.toLowerCase().includes(q));
    const hl = (text) =>
      esc(text).replace(new RegExp(`(${q})`, "gi"), "<mark>$1</mark>");
    return {
      facts: countFacts(N.counts.notebook, N.counts.review),
      body: `
        <div class="body">
          <div class="run">
            <p class="found"><b>${hits.length}</b> notes have “${q}” in them</p>
            ${hits.map((n) => entry(n, { html: hl(n.title), restHtml: hl(n.rest) })).join("")}
          </div>
        </div>`,
      foot: dock({ mode: "search", value: q }),
    };
  };

  /* Pressure. The long note is open at the top so the reading measure and
     the shelf's density are argued in one frame, which is the only way to
     stop a direction solving one by sacrificing the other. */
  STATES.pressure = () => {
    const long = N.long;
    return {
      facts: `<span class="tab"><b>${N.counts.dense}</b> notes</span><button class="chip" type="button">12 want a decision</button><span class="soft">peak season, an extension of the fixture</span>`,
      body: `
        <div class="body pressure">
          <div class="run">
            <h2 class="dayRule">Today</h2>
            <article class="entry" data-open>
              <span class="entryMark">${I.typed}<span class="sr">Written</span></span>
              <div>
                <p class="entryTitle" style="font-size:17px;line-height:1.62;font-weight:400">${esc(long.body)}</p>
              </div>
              <div class="openFoot">
                <button class="entryAct" data-primary type="button">${I.tasks}Turn into a task</button>
                <button class="entryAct" type="button" aria-label="More actions for this note">${I.dots}</button>
                <span class="openMeta tab">${long.words} words · captured ${esc(long.when)}</span>
              </div>
            </article>
            ${N.dense.slice(0, 14).map((n) => entry(n)).join("")}
          </div>
        </div>`,
      foot: dock({}),
    };
  };

  /* Every empty in the product, on one sheet, so no two of them can say
     the same sentence and every one carries exactly one first move. */
  STATES.nothing = () => ({
    facts: `<span class="tab"><b>0</b> notes</span>`,
    body: `
      <div class="body">
        <div class="emptyStage">
          <div class="emptyBox">
            <h2 class="emptyTitle">${esc(N.copy.emptyTitle)}</h2>
            <p class="emptyBody">Nobody else can read what you write here. Notes only sends something on when you pick the words yourself.</p>
            <div class="emptyMove">
              <button class="qAct" data-primary type="button">${I.typed}Write the first one</button>
              <button class="qAct" type="button">${I.mic}Or say it</button>
            </div>
            <div class="emptyGhosts" aria-hidden="true">
              ${[68, 52, 80].map((w) => `<div class="ghostRow"><span></span><div><div class="ghostBar" style="width:${w}%"></div><div class="ghostBar" style="width:${w - 26}%"></div></div></div>`).join("")}
            </div>

            <div class="specGrid" style="width:auto;padding-top:34px">
              <div class="spec">
                <p class="specName">Nothing matched</p>
                <h3 class="emptyTitle">No note says “marquee sides”.</h3>
                <p class="emptyBody">The closest is one about the hire company, from Thursday.</p>
                <div class="emptyMove"><button class="qAct" type="button">${I.search}Open that one</button><button class="qAct" data-quiet type="button">Clear the search</button></div>
                <p class="specWhy">A search with no hits offers the nearest thing it does have. A dead end is a bug.</p>
              </div>
              <div class="spec">
                <p class="specName">Nothing to decide</p>
                <h3 class="emptyTitle">Everything is decided.</h3>
                <p class="emptyBody">Eight notes went through this morning. Three became tasks.</p>
                <div class="emptyMove"><button class="qAct" type="button">${I.tasks}See the three in Tasks</button></div>
                <p class="specWhy">The end of a queue reports what the queue did, and points at where the work went.</p>
              </div>
              <div class="spec">
                <p class="specName">Nothing has crossed</p>
                <h3 class="emptyTitle">Nothing has left Notes yet.</h3>
                <p class="emptyBody">When you turn a note into a task, only the words you pick cross. This is where they are listed.</p>
                <div class="emptyMove"><button class="qAct" type="button">${I.arrowRight}Pick a note to start with</button></div>
                <p class="specWhy">An empty ledger explains the promise it exists to keep, then offers the one move that fills it.</p>
              </div>
              <div class="spec">
                <p class="specName">The notebook, after a clear-out</p>
                <h3 class="emptyTitle">Your notebook is empty again.</h3>
                <p class="emptyBody">Fourteen notes went to Tasks or were deleted. Nothing is waiting on you.</p>
                <div class="emptyMove"><button class="qAct" type="button">${I.undo}Undo the last delete</button></div>
                <p class="specWhy">An empty that follows an action is a different empty from a first-use one, and it offers the way back.</p>
              </div>
            </div>
          </div>
        </div>
      </div>`,
    foot: dock({}),
  });

  /* Every state where the product does not yet have your work where it
     promised. One family, one sheet, because they share one job. */
  STATES["not-yet"] = () => ({
    facts: `<span class="tab"><b>15</b> notes</span><span class="soft">1 held on this device</span>`,
    body: `
      <div class="body">
        <div class="run" style="padding-top:20px">
          <div class="state" data-tone="hold">
            ${I.wifiOff}
            <div>
              <b>Held on this device</b>
              <p>You are offline, so this one is saved here. Notes will put it in the notebook the moment you reconnect. Nothing is lost and nothing has left.</p>
            </div>
            <span class="act"><button class="qAct" type="button">${I.undo}Try now</button></span>
          </div>

          <div class="state" style="margin-top:12px">
            ${I.alert}
            <div>
              <b>That did not save</b>
              <p>Your words are still in the field, exactly as you left them. Nothing has been cleared.</p>
            </div>
            <span class="act"><button class="qAct" type="button">Save it again</button></span>
          </div>

          <div class="state" style="margin-top:12px">
            ${I.split}
            <div>
              <b>This note changed somewhere else</b>
              <p>${esc(N.copy.sourceChanged)}</p>
            </div>
            <span class="act"><button class="qAct" type="button">Read both</button></span>
          </div>

          <div class="state" data-tone="destroy" style="margin-top:12px">
            ${I.trash}
            <div>
              <b>Delete this note?</b>
              <p>It has not been sent anywhere, so deleting it here deletes it everywhere. You can undo this for thirty seconds.</p>
            </div>
            <span class="act"><button class="qAct" data-primary type="button">Delete it</button></span>
          </div>

          <h2 class="dayRule" style="padding-top:34px">Still arriving</h2>
          <div class="skel" aria-hidden="true">
            ${[86, 64, 92, 58, 78].map((w) => `<div class="skelRow"><span></span><div><div class="sk" style="width:${w}%"></div><div class="sk" style="width:${Math.round(w * 0.62)}%"></div></div></div>`).join("")}
          </div>
          <p class="skelSay">Opening your notebook. Fourteen notes, newest first.</p>
        </div>
      </div>`,
    foot: dock({}),
  });

  /* ── paint ──────────────────────────────────────────────────────── */

  const build = STATES[state] || STATES.notebook;
  const s = build();
  document.getElementById("root").innerHTML = `
    <div class="floor">
      ${rail()}
      <main class="sheet">
        ${head(s.facts, s.actions)}
        ${s.body}
        ${s.foot || ""}
        ${s.over || ""}
      </main>
    </div>`;

  document.documentElement.setAttribute("data-state", state);
})();
