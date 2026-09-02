/* ═══════════════════════════════════════════════════════════════════
   WHAT THE SUITE SAYS ABOUT ITSELF — round 1, batch 2.

   Seven `misleading` findings from three seats. A product that lies is
   worse than one that visibly fails, because the failure is at least
   honest — so these outrank every defect in the round.

     · The seam promised, in bold, directly above the button, that Tasks
       receives only the words you picked. It sent the whole private note.
     · The same couple carried two irreconcilable wedding days: Notes and
       Tasks said this Saturday, Timeline said 3 October, 79 days out.
     · The ledger counted three crossings while the index badged six.
     · Notes painted two account tiles, one of which said it did nothing
       and one of which did something.

   Every assertion below was written before the fix and watched failing.
   ═══════════════════════════════════════════════════════════════════ */

import { chromium } from "@playwright/test";
import { blankComments } from "./css.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function truth({ browser, url, check, head, lab }) {
  head("11 · what the suite says about itself");

  const open = async (query, width) => {
    const page = await browser.newPage({ viewport: { width, height: width < 500 ? 844 : 960 } });
    await page.goto(url + query);
    await page.waitForTimeout(700);
    return page;
  };

  /* ── the seam keeps its own promise ──────────────────────────────
     WATCHED FAILING: cross() put `note: entry.body` on the card, so the
     whole note a person had just been promised would stay private was
     printed on the board one click later. */
  {
    const page = await open("?p=notes", 1440);
    /* Open a note that has not crossed, pick its words, peel, send. */
    const body = await page.evaluate(() => {
      const row = [...document.querySelectorAll('[data-app="notes"] .idxRow')]
        .find((r) => !/In Tasks/.test(r.textContent));
      row.click();
      return null;
    });
    await page.waitForTimeout(400);
    const whole = await page.evaluate(() => {
      const el = document.querySelector('[data-app="notes"] .readBody');
      return el ? el.textContent.trim() : null;
    });
    /* Pick one SENTENCE, not the whole note, so the promise has something
       to be measured against. */
    const picked = await page.evaluate(() => {
      const el = document.querySelector('[data-app="notes"] .readBody');
      /* The first TEXT node, and an offset inside that node — a note is
         set as prose with marks in it, so the body's own text and any one
         child's text are different lengths and the offset from one does
         not address the other. */
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = null;
      while ((node = walk.nextNode())) if (node.textContent.trim().length > 20) break;
      if (!node) return null;
      const stop = node.textContent.indexOf(".");
      const end = stop > 0 ? stop + 1 : Math.min(60, node.textContent.length);
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, end);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      return range.toString().trim();
    });
    await page.waitForTimeout(400);
    const peel = await page.$('[data-app="notes"] [data-act="peel"]');
    if (peel) { await peel.click(); await page.waitForTimeout(400); }
    const send = await page.$('[data-app="notes"] [data-act="send"]');
    if (send) { await send.click(); await page.waitForTimeout(600); }

    const card = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-app="tasks"] .card[data-id^="seam_"]')];
      const el = rows[rows.length - 1];
      if (!el) return null;
      return {
        id: el.dataset.id,
        title: (el.querySelector(".cardTitle") || {}).textContent || "",
        note: (el.querySelector(".cardNote") || {}).textContent || "",
        all: el.textContent,
      };
    });
    check("truth", "the crossing lands", Boolean(card), card ? card.id : "no card");
    if (card && whole && picked) {
      /* The promise, measured: nothing from the note that was not picked
         may appear on the board. The note's own unpicked remainder is the
         thing being protected, so that is what is looked for. */
      const rest = whole.replace(picked, "").trim();
      const leakedFrom = rest
        .split(/(?<=\.)\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 24)
        .filter((s) => card.all.includes(s.slice(0, 24)));
      check("truth", "…carrying only the words that were picked", leakedFrom.length === 0,
        leakedFrom.length ? `LEAKED: “${leakedFrom[0].slice(0, 70)}…”`
          : `${picked.length} chars picked, ${rest.length} chars kept back`);
      /* "Only the picked words" must not be satisfied by sending none of
         them. The promise is that Tasks RECEIVES these words — a card
         that arrives empty keeps the letter of it and breaks the point. */
      const key = picked.replace(/^\W+/, "").slice(0, 20);
      check("truth", "…and the picked words are actually there",
        card.all.includes(key), `looking for “${key}” in the card`);
    }
    await page.close();
  }

  /* ── one couple, one wedding day ─────────────────────────────────
     WATCHED FAILING: Notes' head read "Mara & Finn · Saturday 18 July, in
     2 days" while Timeline's count read 79 and its date read Saturday 3
     October. The suite's whole claim is one world. */
  {
    const page = await open("?p=notes", 1440);
    const said = await page.evaluate(() => {
      const W = window.WORLD, N = window.NOTES, T = window.__TLFIXTURE;
      return {
        world: W.wedding ? W.wedding.date : null,
        couple: W.wedding ? W.wedding.couple : null,
        timeline: T.project.primaryDate.date,
        timelineName: T.project.name,
        notesSubject: N.subjects["mara-finn"].when,
        notesSubjectDays: N.subjects["mara-finn"].days,
        notesNext: N.next.when,
        notesNextDays: N.next.days,
        headText: (document.querySelector('[data-app="notes"] .headNext') || {}).textContent || "",
      };
    });
    check("truth", "the world holds the wedding once", Boolean(said.world), said.world || "not declared");
    check("truth", "Timeline agrees with it", said.timeline === said.world, `${said.timeline} vs ${said.world}`);
    check("truth", "the notebook agrees with it",
      /3\s*October/.test(said.notesSubject) && said.notesSubjectDays === 79,
      `${said.notesSubject}, in ${said.notesSubjectDays} days`);
    check("truth", "and the head says the same day", /3\s*October/.test(said.headText),
      `“${said.headText.replace(/\s+/g, " ").trim().slice(0, 60)}”`);
    check("truth", "the couple is the same couple", said.couple === said.timelineName,
      `${said.couple} vs ${said.timelineName}`);
    await page.close();
  }

  /* ── the ledger counts what the index badges ─────────────────────
     WATCHED FAILING: the pile headed "what has crossed into Tasks" said
     three, and the index beside it badged six notes "In Tasks". */
  {
    const page = await open("?p=notes", 1440);
    const n = await page.evaluate(() => {
      const N = window.NOTES;
      const sent = N.notes.filter((x) => x.sent).length + N.crossed.length;
      return { counted: N.counts.sent, sent };
    });
    check("truth", "the ledger counts every crossing", n.counted === n.sent,
      `${n.counted} counted, ${n.sent} notes actually badged`);
    await page.close();
  }

  /* ── one account tile per sheet ──────────────────────────────────
     WATCHED FAILING: Notes painted two "OR" discs at once — the rail's,
     which says it does nothing, and the dock's, which announces. Two
     objects, one name, two different contracts. */
  for (const [product, width] of [["notes", 1440], ["tasks", 1440], ["notes", 390]]) {
    const page = await open(`?p=${product}`, width);
    const discs = await page.evaluate(() =>
      [...document.querySelectorAll(".railAvatar, .app:not([hidden]) .dockAvatar")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({
          where: el.className.split(" ")[0],
          label: el.getAttribute("aria-label") || "",
          disabled: el.getAttribute("aria-disabled") === "true",
        })));
    /* Two slots is correct — Tasks has always had both — but they may not
       make two different promises about the same thing. */
    const contracts = new Set(discs.map((d) => (d.disabled ? "not here yet" : "live")));
    check("truth", `${product} @${width} · the account tiles agree`, contracts.size <= 1,
      discs.map((d) => `${d.where}:${d.disabled ? "not-yet" : "live"}`).join(" "));
    await page.close();
  }

  /* ── round 2 ────────────────────────────────────────────────────
     Three more places the document stated something untrue about itself. */
  head("11b · round 2 · the same standard, three more claims");

  /* The horizon's gap sentence, in BOTH orientations.
     WATCHED FAILING: in `across` — the default — moving the nearest moment
     three weeks out, or deleting it, left the sentence naming a date that
     now held nothing. `down` was correct every time. */
  for (const layout of ["across", "down"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + `?v=paper&state=timeline.owner-flight&layout=${layout}`);
    await page.waitForTimeout(800);

    const read = () => page.evaluate(() =>
      (document.querySelector(".b-gapNote") || {}).textContent || "");
    const nearestAway = () => page.evaluate(() => {
      let best = null;
      for (const el of document.querySelectorAll(".b-measure:not(.b-back) .b-item")) {
        const a = Number(el.getAttribute("data-away"));
        if (a > 0 && (best === null || a < best)) best = a;
      }
      return best;
    });

    const before = await read();
    const wasNearest = await nearestAway();

    /* Push the nearest moment three weeks out. Whatever the sentence said,
       it may not still say it — and it must name the new nearest date. */
    const moved = await page.evaluate(async () => {
      const item = [...document.querySelectorAll(".b-measure:not(.b-back) .b-item")]
        .filter((el) => Number(el.getAttribute("data-away")) > 0)
        .sort((a, b) => Number(a.getAttribute("data-away")) - Number(b.getAttribute("data-away")))[0];
      if (!item) return false;
      const opener = item.querySelector("button, [role='button'], a") || item;
      opener.click();
      await new Promise((r) => setTimeout(r, 400));
      const plus = document.querySelector('[data-delta="7"]');
      if (!plus) return false;
      for (let i = 0; i < 3; i++) { plus.click(); await new Promise((r) => setTimeout(r, 220)); }
      const done = [...document.querySelectorAll("button")]
        .find((b) => /done|close|save/i.test(b.textContent || ""));
      if (done) done.click();
      await new Promise((r) => setTimeout(r, 600));
      return true;
    });

    if (!moved) {
      check("truth", `timeline ${layout} · the gap sentence follows a move`, false,
        "could not drive the editor");
    } else {
      const after = await read();
      const nowNearest = await nearestAway();
      /* REVISED 2026-09-02. The sentence used to name the nearest moment
         ("Nothing is planned until 1 August") and the panel found it named
         the day the tasting falls on as a void. The note is silent while a
         moment is ahead and says "Nothing is planned yet." only when none
         is — so the claim after a move is that it stays silent, and that
         the move really happened. */
      check("truth", `timeline ${layout} · the gap note stays silent while a moment is ahead`,
        nowNearest > 0 && after.trim() === "" && before.trim() === "",
        `nearest ${wasNearest} → ${nowNearest} days · says “${after.trim()}”`);
    }
    await page.close();
  }

  /* The URL contract could not write at all: a `const history` at the top
     level of one product's script shadowed `window.history` for the whole
     document, so replaceState threw on every navigation and the catch ate it.
     WATCHED FAILING: `history === window.history` was false. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(700);
    const shadowed = await page.evaluate(() => {
      try { return history === window.history; } catch (e) { return false; }
    });
    check("truth", "no product shadows window.history", shadowed === true,
      shadowed ? "history === window.history" : "a global const is shadowing it");

    const walked = await page.evaluate(async () => {
      window.__SUITE.go("notes");
      await new Promise((r) => setTimeout(r, 500));
      const q = new URLSearchParams(location.search);
      return { p: q.get("p"), state: q.get("state"),
        deck: document.querySelector("#deck").getAttribute("data-product") };
    });
    check("truth", "the URL follows the spine", walked.p === "notes" && walked.deck === "notes",
      JSON.stringify(walked));
    /* And it does not hand Notes a state that belonged to Tasks. */
    check("truth", "a departing product's state does not follow it",
      walked.state === null || walked.state !== "board",
      `state=${walked.state}`);
    await page.close();
  }

  /* One wedding day, in the prose as well as the data. The round-1 fix moved
     the date and left both fixture headers declaring the old one, one line
     under the sentence "The header declares the facts they share".
     WATCHED FAILING: both headers said 18 July. */
  for (const file of ["src/fixture.js", "tools/world.head.js"]) {
    const text = await readFile(path.join(lab, file), "utf8");
    /* The header is a wrapped box comment, so the date can be split across
       a line break. Collapse the whitespace before asking what it says. */
    const header = text.split(/\r?\n/).slice(0, 20).join(" ").replace(/\s+/g, " ");
    check("truth", `${file} · the header declares the one wedding day`,
      header.includes("3 October") && !header.includes("18 July"),
      header.includes("18 July") ? "still declares 18 July" : "3 October");
  }
}

/* ═══════════════════════════════════════════════════════════════════
   11c · ROUND 5 — four more claims, and one place that loses your place.

   The round's standing misleading findings were all the same shape: a
   sentence that was TRUE WHEN IT WAS WRITTEN and had been outlived by
   the thing it described. A closed door still apologising for a surface
   that now ships. A completion screen counting two outcomes out of
   three, printing a zero as a fact, and offering the journey nobody took
   as its only filled action. An index head reciting the workspace total
   over eight rows.

   That class does not announce itself: nothing throws, nothing looks
   broken, and every one of these read as finished prose. It is findable
   only by asking the product a question you already know the answer to,
   which is what each assertion below does.

   Every one was written before its fix and watched failing.
   ═══════════════════════════════════════════════════════════════════ */
export async function truthFive({ browser, url, check, head, lab }) {
  head("11c · round 5 · doors that outlived what they were honest about");

  /* ── the two door sentences ──────────────────────────────────────
     WATCHED FAILING: the source carried "Filter, Sort and Display come
     with the other views." and "Search comes with the other views." while
     the board shipped all four. Read from SOURCE as well as from the
     screen, because these strings are reachable from states this gate does
     not enumerate — a sentence that is wrong is wrong wherever it lands. */
  {
    const text = await readFile(path.join(lab, "src/tasks.js"), "utf8");
    /* Only the string literals, never the prose in the comments explaining
       why they changed. A rule that reads its own explanation as evidence
       fails the moment somebody documents the fix. */
    const strings = text.match(/"[^"\n]*"/g) || [];
    const stale = strings.filter((s) => /comes? with the other views/.test(s));
    check("truth", "no shipped surface still apologises for itself",
      stale.length === 0, stale.slice(0, 2).join(" · ") || "none");
  }

  /* And the same claim from the SCREEN: Ctrl+K reaches the real field. */
  {
    const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(700);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(250);
    const landed = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        onField: !!(el && el.classList && el.classList.contains("dockInput")),
        said: (document.querySelector("[aria-live]") || {}).textContent || "",
      };
    });
    check("truth", "Ctrl+K lands on the search that exists",
      landed.onField === true, JSON.stringify(landed));
    check("truth", "and does not announce a door",
      !/comes? with the other views/.test(landed.said), landed.said);
    await page.close();
  }

  /* ── the completion screen counts what happened ──────────────────
     WATCHED FAILING: "8 notes went through. 0 became tasks and the rest
     stayed here." — a zero printed as a fact, with "the rest" standing in
     for all eight — and "See them in Tasks" as the only filled action on
     the screen, pointing at nothing. Driven rather than asserted: the seam
     is walked to its end by keeping every note, which is the state that
     produced the sentence. */
  {
    const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    await page.goto(url + "?v=paper&state=notes.seam");
    await page.waitForTimeout(700);
    const end = await page.evaluate(async () => {
      /* The seam OPENS on its threshold — "Go through 8" — and the four
         verbs only exist once you are inside it. A rule that starts
         clicking verbs on the threshold clicks nothing, finds no empty,
         and reports the state it never reached. */
      const go = document.querySelector('[data-act="review"]');
      if (go) { go.click(); await new Promise((r) => setTimeout(r, 500)); }
      for (let i = 0; i < 30; i += 1) {
        let keep = document.querySelector('[data-act="d-keep"]');
        /* One card in this deck opens with its task composer already
           written — the demo's own centrepiece — and the four verbs are
           not offered while it is open. Backing out of the peel is part
           of walking the deck, not a special case. */
        if (!keep) {
          const back = document.querySelector('[data-act="cancel-peel"]');
          if (!back) break;
          back.click();
          await new Promise((r) => setTimeout(r, 400));
          keep = document.querySelector('[data-act="d-keep"]');
        }
        if (!keep) break;
        keep.click();
        await new Promise((r) => setTimeout(r, 160));
      }
      await new Promise((r) => setTimeout(r, 500));
      return {
        body: (document.querySelector(".emptyBody") || {}).textContent || "",
        toTasks: !!document.querySelector('.emptyMove [data-act="tasks"]'),
        back: !!document.querySelector('.emptyMove [data-act="notebook"]'),
      };
    });
    check("truth", "the completion screen reached its end",
      /went through/.test(end.body), end.body || "never reached the empty");
    check("truth", "it does not print a zero as an outcome",
      !/\b0 became\b/.test(end.body), end.body);
    check("truth", "no journey to Tasks is offered when none went there",
      end.toTasks === false, end.toTasks ? "offered anyway" : "not offered");
    check("truth", "and the way back is still there", end.back === true);
    await page.close();
  }

  /* ── the index head counts its own rows ──────────────────────────
     WATCHED FAILING: "Your notes · 14 notes" over eight rows in the state
     after deciding, and over two rows under an active search. The count
     came from the WORKSPACE and the list came from the SCREEN. Checked in
     two states and again with a query running — a rule that only reads the
     resting state never sees the search half, which is the same bug. */
  {
    const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    /* The count lives in `.indexHead`, which is a SIBLING of `#index` —
       the list itself carries only rows. A first draft of this rule looked
       for the count inside `#index`, found nothing, read NaN and passed
       every state without measuring one of them: the absence read as a
       pass. It is scoped to the notes product because three are mounted. */
    const readHead = () => page.evaluate(() => {
      const wrap = document.querySelector('[data-app="notes"] .indexWrap');
      if (!wrap) return null;
      const el = wrap.querySelector(".indexHead .cnt");
      return {
        text: (el || {}).textContent || "",
        rows: wrap.querySelectorAll("#index .idxRow").length,
        found: !!el,
      };
    });
    for (const state of ["notes.notebook", "notes.seam"]) {
      await page.goto(url + "?v=paper&state=" + state);
      await page.waitForTimeout(700);
      const said = await readHead();
      /* Measured, not assumed: a state where the head or the rows are
         missing is a rule that proved nothing, and says so. */
      check("truth", state + " · the index head is there to be read",
        !!said && said.found === true && said.rows > 0,
        said ? said.found + " / " + said.rows + " rows" : "no index");
      const claimed = said ? Number((said.text.match(/(\d+)/) || [])[1]) : NaN;
      check("truth", state + " · the index head counts the rows it lists",
        Number.isFinite(claimed) && (claimed === said.rows || / of /.test(said.text)),
        said ? 'head "' + said.text.trim() + '" over ' + said.rows + " rows" : "no index");
    }
    await page.goto(url + "?v=paper&state=notes.notebook");
    await page.waitForTimeout(700);
    const typed = await page.evaluate(async () => {
      const q = document.getElementById("q");
      if (!q) return false;
      q.focus();
      q.value = "a";
      q.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 600));
      return true;
    });
    if (typed) {
      const said = await readHead();
      const claimed = said ? Number((said.text.match(/(\d+)/) || [])[1]) : NaN;
      check("truth", "under a search the head says how many of how many",
        Number.isFinite(claimed) && claimed === said.rows,
        said ? 'head "' + said.text.trim() + '" over ' + said.rows + " rows" : "no index");
    }
    await page.close();
  }

  /* ── the caret survives the breakpoint ───────────────────────────
     WATCHED FAILING: the capture field is `.topField` on the desk and
     `.phoneField` on the phone — one field, two class names. Put the
     caret in it, cross the breakpoint, and the repaint looked up the
     class it had captured, found nothing, and dropped focus AND the
     caret on the body. The words survived; the place in them did not,
     and the next keystroke went nowhere.

     Three things about how this is driven, each of which cost a false
     failure before it was understood:

     · `notes.capture` OPENS with words already in the field. Typing them
       here schedules a repaint whose landing this rule cannot see, and
       racing it replaces the node under the caret — the harness losing
       the caret and blaming the product.
     · The field is focused with a REAL CLICK. A scripted `focus()` does
       not give the document focus, and `paint()` reads
       `document.activeElement` to decide whether anybody is typing; a
       headless document that does not hold focus answers BODY however
       its DOM is focused, so the product correctly restores nothing.
     · Nothing may touch the page between the click and the crossing —
       not `bringToFront`, not an extra probe of who has focus. Reading
       is not free here: every one of those resets the active element to
       the body while leaving `document.hasFocus()` true, which is the
       most convincing false negative in this file.

     The landing is then WATCHED as a focus event rather than sampled,
     and the caret is read on the tick after it, because `focusin` fires
     from inside `focus()` — one line before the caret is put back. */
  {
    const own = await chromium.launch();
    const page = await own.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + "?v=paper&state=notes.capture");
    await page.waitForTimeout(900);

    await page.click(".topField, .phoneField", { position: { x: 40, y: 12 } }).catch(() => {});
    const ready = await page.evaluate(() => {
      const el = document.querySelector(".topField, .phoneField");
      if (!el || !el.setSelectionRange) return null;
      el.setSelectionRange(8, 8);
      window.__LANDED = null;
      window.__SEEN = [];
      document.addEventListener("focusin", (e) => {
        const t = e.target;
        window.__SEEN.push(String((t && t.className) || (t && t.tagName) || "?"));
        if (t && t.classList && t.classList.contains("phoneField")) {
          setTimeout(() => { window.__LANDED = { at: t.selectionStart, value: t.value }; }, 0);
        }
      }, true);
      return {
        onField: document.activeElement === el,
        words: (el.value || "").length,
        at: el.selectionStart,
      };
    });
    check("truth", "the caret is in the field before the wall moves",
      !!ready && ready.onField === true && ready.words > 0 && ready.at === 8,
      ready ? JSON.stringify(ready) : "no field");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => window.__LANDED !== null, null, { timeout: 4000 })
      .catch(() => {});
    const after = await page.evaluate(() => ({
      landed: window.__LANDED,
      seen: window.__SEEN,
      active: document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : "?",
      field: (document.querySelector(".phoneField") || {}).value || "",
    }));
    check("truth", "crossing the breakpoint keeps the words",
      /marquee company/.test(after.field), after.field.slice(0, 40) || "empty");
    check("truth", "and puts the caret back in the field it became",
      !!after.landed,
      after.landed ? "landed" : "never arrived · seen [" + (after.seen || []).join(", ") + "] · active=" + after.active);
    check("truth", "and keeps the caret where it was",
      !!after.landed && after.landed.at === 8,
      after.landed ? "caret at " + after.landed.at + ", expected 8" : "never arrived");

    await page.close();
    await own.close();
  }
}

/* ═══════════════════════════════════════════════════════════════════
   11d · ROUND 5, batch A — the sentences the surface prints, and the
   two objects that had stepped off their own ladders.

   Every one written before its fix and watched failing.
   ═══════════════════════════════════════════════════════════════════ */
export async function truthFiveB({ browser, url, check, head, lab }) {
  head("11d · round 5 · what the board says when it has nothing to show");

  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  await page.goto(url + "?v=paper&state=tasks.board");
  await page.waitForTimeout(800);

  /* ── the miss sentence ───────────────────────────────────────────
     WATCHED FAILING: search for something no card says and the board
     answered "Nothing on the board is. All 13 are hidden." — a copula
     with nothing after it, printed as the product's own voice. */
  const typeQuery = (q) => page.evaluate(async (text) => {
    const field = document.querySelector('[data-app="tasks"] .dockInput');
    if (!field) return null;
    field.focus();
    field.value = text;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));
    /* The miss sentence is printed in the board's own empty, not in a
       status strip — a first draft of this rule looked for a strip that
       does not exist, read "" and passed the copula test on nothing. */
    const line = document.querySelector('[data-app="tasks"] .emptyBoard');
    return {
      said: (line || {}).textContent || "",
      cards: document.querySelectorAll('[data-app="tasks"] .card:not([data-draft])').length,
    };
  }, q);

  const miss = await typeQuery("zzqqxx");
  check("truth", "a search miss is measurable", !!miss && miss.cards === 0,
    miss ? miss.cards + " cards, said: " + miss.said : "no field");
  if (miss) {
    check("truth", "the miss sentence has no bare copula",
      !/\bis\.\s/.test(miss.said) && !/\bis\.$/.test(miss.said.trim()), miss.said);
    check("truth", "the miss sentence names what was searched for",
      /zzqqxx/.test(miss.said), miss.said);
  }
  await typeQuery("");

  /* ── a couple is not a tag ───────────────────────────────────────
     WATCHED FAILING: "Mara & Finn" sat under the heading "By tag"
     alongside Venue and Bar, and filtering to Venue printed "Showing 4
     tasks for Venue." One heading and one preposition for two kinds. */
  const groups = await page.evaluate(async () => {
    /* Filter became a group inside Show; the claim is about the groups. */
    const open = document.querySelector('[data-app="tasks"] [data-tool="show"], [data-app="tasks"] [data-act="tool"][data-value="filter"], [data-app="tasks"] [data-tool="filter"]')
      || [...document.querySelectorAll('[data-app="tasks"] [data-act="tool"]')]
        .find((b) => /filter|show/i.test(b.textContent || ""));
    if (!open) return null;
    open.click();
    await new Promise((r) => setTimeout(r, 400));
    const pop = document.querySelector('[data-app="tasks"] .toolPop, [data-app="tasks"] [role="menu"]');
    if (!pop) return null;
    const labels = [...pop.querySelectorAll(".toolLabel")].map((e) => e.textContent.trim());
    const under = {};
    let current = null;
    for (const el of pop.querySelectorAll(".toolLabel, .toolItem")) {
      if (el.classList.contains("toolLabel")) { current = el.textContent.trim(); under[current] = []; }
      else if (current) under[current].push((el.textContent || "").replace(/\s+/g, " ").trim());
    }
    return { labels, under };
  });
  check("truth", "the filter menu separates couples from tags",
    !!groups && groups.labels.includes("By couple") && groups.labels.includes("By tag"),
    groups ? groups.labels.join(" / ") : "no filter menu");
  if (groups && groups.under["By tag"]) {
    check("truth", "no couple is filed under By tag",
      !groups.under["By tag"].some((t) => /&/.test(t)),
      groups.under["By tag"].join(", "));
  }

  /* And the sentence agrees with the group it came from. */
  /* ONE FILTER PER PAGE. Toggling a filter off and reopening the menu in
     the same run left the second name unreachable and the second sentence
     unmeasured — the rule reported on Venue and said nothing at all about
     the couple, which is the half the finding was actually about. */
  const said = {};
  for (const name of ["Venue", "Mara & Finn"]) {
    const p1 = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    await p1.goto(url + "?v=paper&state=tasks.board");
    await p1.waitForTimeout(800);
    said[name] = await p1.evaluate(async (who) => {
      const open = [...document.querySelectorAll('[data-app="tasks"] [data-act="tool"]')]
        .find((b) => /filter|show/i.test(b.textContent || ""));
      if (!open) return "NO FILTER TOOL";
      open.click();
      await new Promise((r) => setTimeout(r, 450));
      const item = [...document.querySelectorAll('[data-app="tasks"] .toolItem')]
        .find((b) => (b.textContent || "").includes(who));
      if (!item) return "NOT OFFERED";
      item.click();
      await new Promise((r) => setTimeout(r, 600));
      const carry = document.querySelector('[data-app="tasks"] .carryName');
      const live = document.getElementById("say");
      return ((carry || {}).textContent || (live || {}).textContent || "").trim() || "SAID NOTHING";
    }, name);
    await p1.close();
  }
  /* Both are CHECKED, never skipped. Guarding each behind "if the menu
     offered it" is the absence-reads-as-a-pass shape this lab has now met
     six times: the couple's sentence was never measured on the first run
     and the section still reported green. A claim that could not be
     measured is a claim that failed. */
  check("truth", "a tag is 'tagged', not 'for'",
    !!said.Venue && said.Venue !== "NOT OFFERED"
      && / tagged Venue/.test(said.Venue) && !/ for Venue/.test(said.Venue),
    said.Venue || "never measured");
  check("truth", "a couple is 'for', not 'tagged'",
    !!said["Mara & Finn"] && said["Mara & Finn"] !== "NOT OFFERED"
      && / for Mara & Finn/.test(said["Mara & Finn"]),
    said["Mara & Finn"] || "never measured");
  await page.close();

  /* ── the doors name destinations, not moods ──────────────────────
     WATCHED FAILING: `settings: "Your workspace, your way."` — the one
     door whose entire job is to say what is behind it, saying nothing,
     in a register its four siblings had already left. */
  {
    /* Comments blanked FIRST. The rule failed on the sentence explaining
       why the slogan went — the mirror of this lab's oldest false pass,
       and just as much a rule not reading what it thinks it is reading. */
    const text = blankComments(await readFile(path.join(lab, "src/app.js"), "utf8"));
    const block = (text.match(/var NOT_YET = \{[\s\S]*?\};/) || [""])[0];
    const lines = block.match(/"[^"\n]+"/g) || [];
    check("truth", "every closed door names a destination", lines.length >= 5,
      lines.length + " doors");
    check("truth", "no closed door is a slogan",
      !/your way|your rules|the way you/i.test(block),
      (block.match(/.*your way.*/i) || [""])[0].trim());
  }

  /* ── the read-back speaks the note's own words ───────────────────
     WATCHED FAILING: the speech block said "from eight in the morning"
     and "the whole setup window"; the note it belongs to says "from 8am
     on the Saturday" and "the whole morning setup". Dictate, look at
     what you said, and the product had rewritten it. */
  {
    const text = await readFile(path.join(lab, "src/fixture.js"), "utf8");
    const speech = (text.match(/speech: \{[\s\S]*?\},/) || [""])[0];
    const n03 = (text.match(/id: "n03",[\s\S]*?\},/) || [""])[0];
    const body = (n03.match(/body: "([^"]+)"/) || [])[1] || "";
    const transcript = (speech.match(/transcript:\s*\n?\s*"([^"]+)"/) || [])[1] || "";
    check("truth", "the speech fixture and the note it belongs to are one string",
      !!body && body === transcript,
      "note: " + body.slice(0, 48) + " | speech: " + transcript.slice(0, 48));
    /* And the two separated notes are that same string, split. */
    const parts = (speech.match(/separated: \[([\s\S]*?)\]/) || [])[1] || "";
    const joined = (parts.match(/"[^"]+"/g) || []).map((s) => s.slice(1, -1)).join(" ");
    check("truth", "the separated notes are the transcript, split",
      joined === transcript, joined.slice(0, 60));
  }

  /* ── the search field has a focused state ────────────────────────
     WATCHED FAILING: the focus block was shared with `.is-live`, so the
     field looked identical whether the keyboard was in it or a query was
     merely running — no ring, in a product where every other control has
     carried one since round 1. */
  {
    const p2 = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    await p2.goto(url + "?v=paper&state=tasks.board");
    await p2.waitForTimeout(700);
    const ring = await p2.evaluate(() => {
      const field = document.querySelector('[data-app="tasks"] .dockField');
      const input = document.querySelector('[data-app="tasks"] .dockInput');
      if (!field || !input) return null;
      /* STYLE, not width. getComputedStyle reports an outline-width even
         when outline-style is `none` — the browser keeps the width and
         simply does not paint it — so a rule reading the width alone reads
         3px on a field with no ring at all, and then fails a real 2px ring
         for being thinner than the one that was never there. */
      const read = () => {
        const cs = getComputedStyle(field);
        return { style: cs.outlineStyle, w: parseFloat(cs.outlineWidth) || 0 };
      };
      const rest = read();
      input.focus();
      const held = read();
      return { rest, held };
    });
    check("truth", "the search field paints a ring when the keyboard is in it",
      !!ring && ring.held.style !== "none" && ring.held.w >= 2 && ring.rest.style === "none",
      ring ? "rest " + ring.rest.style + " → focus " + ring.held.style + " " + ring.held.w + "px" : "no field");

    /* ── the dock monogram is back on the ramp ────────────────────
       WATCHED FAILING: 10px with a hand-typed 0.04em, a ninth step under
       an eight-step ramp, on an object set from the ramp in both other
       places it appears. */
    const disc = await p2.evaluate(() => {
      const el = document.querySelector('[data-app="tasks"] .dockAvatar');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { size: cs.fontSize, track: cs.letterSpacing, w: el.offsetWidth };
    });
    check("truth", "the dock monogram is on the type ramp",
      !!disc && parseFloat(disc.size) === 11 && disc.track !== "normal",
      disc ? disc.size + " / " + disc.track : "no monogram");
    /* And the two discs MATCH. A token borrowed from another product's
       scope resolves to nothing and computes `normal` without warning —
       the declaration reads correct and the tracking is simply absent.
       Measuring the pair is what catches that; reading the rule cannot. */
    const pair = await p2.evaluate(() => {
      const a = document.querySelector(".railAvatar");
      const b = document.querySelector('[data-app="tasks"] .dockAvatar');
      if (!a || !b) return null;
      return { rail: getComputedStyle(a).letterSpacing, dock: getComputedStyle(b).letterSpacing };
    });
    check("truth", "the two monograms are tracked the same",
      !!pair && pair.rail === pair.dock, pair ? pair.rail + " vs " + pair.dock : "-");
    check("truth", "and the disc did not resize",
      !!disc && disc.w === 34, disc ? disc.w + "px" : "-");
    await p2.close();
  }

  /* ── the chip carries its noun ───────────────────────────────────
     WATCHED FAILING: "Go through 8" — eight of what, on a screen holding
     notes, tasks, days and projects. The tooltip had the noun; the chip,
     which is the thing you read, did not. */
  {
    const p3 = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    await p3.goto(url + "?v=paper&state=notes.notebook");
    await p3.waitForTimeout(700);
    const chip = await p3.evaluate(() => {
      const el = document.querySelector('[data-app="notes"] [data-act="review"]');
      return el ? { text: el.textContent.replace(/\s+/g, " ").trim(),
        name: el.getAttribute("title") || el.getAttribute("aria-label") || "" } : null;
    });
    check("truth", "the review chip names what it counts",
      !!chip && /\d+\s+(note|to decide)/.test(chip.text),
      chip ? chip.text : "no chip");
    check("truth", "and the fuller sentence is still the accessible name",
      !!chip && /note/.test(chip.name), chip ? chip.name : "-");
    await p3.close();
  }
}
