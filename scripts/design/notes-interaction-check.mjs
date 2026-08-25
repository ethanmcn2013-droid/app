/* The measured seat for behaviour, on the Notes master.
 *
 *   node scripts/design/notes-interaction-check.mjs
 *
 * A sibling of scripts/design/interaction-check.mjs, which belongs to the
 * Tasks exploration and is not edited by this programme.
 *
 * This exists BEFORE the first panel round. The Tasks programme built its
 * behaviour gate at round 6 and paid for it: three seats dropped at round 5,
 * one by 1.1, on defects that were invisible in a screenshot and obvious the
 * moment anyone drove the file. Every assertion here guards something a
 * capture product cannot afford to get wrong.
 *
 * Exits 1 on any failure, so a regression cannot be talked past.
 */
import { chromium } from "@playwright/test";
import path from "node:path";

const FILE = "file:///" + path.resolve("docs/design/labs/notes-2026-08/notebook.html").split("\\").join("/");
const results = [];
let failures = 0;
const errors = [];

function ok(name, pass, detail) {
  results.push({ name, pass, detail });
  if (!pass) failures += 1;
  process.stdout.write(`${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}\n`);
}

const browser = await chromium.launch();

/* PHONE WIDTHS GET A REAL PHONE.
   Round 10: every phone assertion in this file was opening a narrow
   viewport with a MOUSE, so the @media (pointer: coarse) branch — the
   one that governs the surface the locked architecture singles out —
   was never evaluated by any of them. The blocker that exposed it was a
   Save control with nine live pixels of thirty-six at 360, silently
   failing to capture a note, which this file could not see because
   getBoundingClientRect was 36x44 the whole time. Anything under 500
   CSS px is driven as a touch device now. */
async function open(query = "", viewport = { width: 1440, height: 960 }) {
  const phone = viewport.width < 500;
  const context = await browser.newContext({
    viewport,
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(FILE + query);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(280);
  return page;
}

const rowCount = (page) => page.locator(".idxRow").count();
/* Round 9 made the note sentence spans, so a pick crossing a sentence
   boundary is drawn in more than one .pick. The mark is the ink, not the
   element count: this reads what the page actually spells. */
const markText = (page, sel = ".readBody") =>
  page.evaluate(
    (s) =>
      [...document.querySelectorAll(`${s} .pick`)]
        .map((m) => m.textContent)
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
    sel,
  );
const markCount = (page, sel = ".readBody") =>
  page.evaluate((s) => (document.querySelectorAll(`${s} .pick`).length ? 1 : 0), sel);
const said = (page) => page.locator("#say").textContent();

/* ── capture: the whole promise ──────────────────────────────────── */
{
  const page = await open();
  const before = await rowCount(page);
  await page.locator(".topField").fill("Ring the marquee company back about the side panels.");
  await page.waitForTimeout(120);

  /* The sheet wakes at once, from a custom property rather than a write
     into the tree — because mutating the document while somebody is
     typing destroys the browser's own undo history. */
  const woke = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector(".top"));
    return cs.boxShadow.includes("79, 70, 229");
  });
  ok("writing wakes the sheet at once", woke);
  /* The chord does not wait for anything. */
  ok("and the chord is live immediately", (await page.locator(".topField").inputValue()).length > 0);
  await page.waitForTimeout(560);
  ok(
    "the save affordance arrives in the pause after typing",
    (await page.locator('[data-act="keep"]').count()) === 1,
  );

  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(360);
  ok("the keyboard saves the note", (await rowCount(page)) === before + 1);
  ok("the field is cleared only after the note is somewhere safe", (await page.locator(".topField").inputValue()) === "");
  /* Superseded at round 7. "Kept" was the capture receipt AND the hand's
     second-largest button AND the pill on a settled note. Capture saves;
     the hand keeps. */
  ok("saving is announced with a count", /Saved\. \d+ notes/.test(await said(page)), await said(page));

  /* Nothing this product does is unreversible, and the way back has to be
     on screen rather than remembered. */
  ok("an undo strip appears", (await page.locator(".undo").count()) === 1);
  await page.locator('[data-act="undo"]').click();
  await page.waitForTimeout(200);
  ok("undo takes the note back off the pile", (await rowCount(page)) === before);
  ok(
    "undo puts the words back in the field, not in the bin",
    (await page.locator(".topField").inputValue()).startsWith("Ring the marquee"),
  );

  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(320);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(220);
  ok("ctrl+z reverses a save", (await rowCount(page)) === before);

  /* The counts on screen may never disagree with each other. */
  const head = await page.locator(".chip").textContent();
  const foot = await page.locator(".indexHead .cnt").textContent();
  const rows = await rowCount(page);
  ok("the head's count and the index agree", foot.trim().startsWith(String(rows)), `${foot.trim()} vs ${rows} rows`);
  /* Round 9: unscoped, the entrance to the queue is a verb carrying its
     count ("Go through 8") rather than a bare statistic of how far
     behind you are. The count is still on the head and still resolves
     from the same accessor; only the grammar changed. */
  ok("the head states the outstanding decisions", /\d+ still to decide|Go through \d+/.test(head), head);
  await page.close();
}

/* ── reading: lifting a note out of the index ────────────────────── */
{
  const page = await open();
  const scroller = page.locator("#index");
  await scroller.evaluate((n) => (n.scrollTop = 220));
  await page.waitForTimeout(80);
  const scrollBefore = await scroller.evaluate((n) => n.scrollTop);

  await page.locator(".idxRow").nth(4).click();
  await page.waitForTimeout(220);
  ok("a row opens onto the desk", (await page.locator(".readBody").count()) === 1);
  ok("opening is announced", (await said(page)).startsWith("Open."));
  ok(
    "opening does not annihilate the index's scroll position",
    Math.abs((await scroller.evaluate((n) => n.scrollTop)) - scrollBefore) < 4,
    `${await scroller.evaluate((n) => n.scrollTop)} vs ${scrollBefore}`,
  );
  /* Round 8 inverted this. It asserted that arrival parked the keyboard
     on the dismiss control, which meant the first Enter after opening a
     note closed it again, and the body's accessible name — the
     instruction the person needs — was never read. Escape is still the
     way back and is still drawn on the button. */
  ok(
    "arrival lands on the note itself, not on the way out of it",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("readBody")),
    await page.evaluate(() => (document.activeElement || {}).className || "none"),
  );
  ok(
    "and the instruction on the note is what gets read on arrival",
    await page.evaluate(() => {
      const a = document.activeElement;
      return !!(a && (a.getAttribute("aria-label") || "").includes("Pick the words"));
    }),
  );
  ok(
    "arrow keys on arrival pick a sentence rather than ejecting into the index",
    await (async () => {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(180);
      return await page.evaluate(() => !!document.querySelector(".readBody .pick"));
    })(),
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(220);
  ok("escape puts the note back", (await page.locator(".readBody").count()) === 0);
  ok(
    "focus returns to the row it came from",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("idxRow")),
  );
  /* Superseded at round 6. The pile is still restored, but a row is now
     given scroll-margin against the sticky group rule, so returning to a
     row that was sitting under the rule moves the pile by up to the rule's
     own height — which is the fix, not a regression. Both facts are
     asserted: the place is kept, and the row is legible when you get
     back to it. */
  ok(
    "closing does not annihilate the scroll position either",
    Math.abs((await scroller.evaluate((n) => n.scrollTop)) - scrollBefore) <= 70,
    `${await scroller.evaluate((n) => n.scrollTop)} vs ${scrollBefore}`,
  );
  ok(
    "and the row it returns to is clear of the group rule, not under it",
    await page.evaluate(() => {
      const row = document.querySelector(".idxRow[data-cursor]");
      const rule = document.querySelector(".idxDay");
      if (!row || !rule) return true;
      const r = row.getBoundingClientRect();
      const d = rule.getBoundingClientRect();
      return r.bottom <= d.top + 1 || r.top >= d.bottom - 1;
    }),
  );
  await page.close();
}

/* ── the index's keyboard model ──────────────────────────────────── */
{
  const page = await open();
  const stops = await page.evaluate(() => document.querySelectorAll('.idxRow[tabindex="0"]').length);
  ok("the index has exactly one tab stop", stops === 1, `${stops} stops`);

  await page.locator('.idxRow[tabindex="0"]').focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(140);
  ok(
    "the arrows walk the index",
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".idxRow")];
      return rows.indexOf(document.activeElement) === 1;
    }),
  );
  ok("walking announces where you are", /^2 of \d+\./.test(await said(page)));
  ok("the walked row is visible without a pointer", (await page.locator(".idxRow[data-cursor]").count()) === 1);

  /* Walking off the end must stop, not wrap silently into nothing. */
  for (let i = 0; i < 60; i += 1) await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(160);
  ok(
    "the walk stops at the end rather than losing focus",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("idxRow")),
  );

  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  ok("enter opens the walked row", (await page.locator(".readBody").count()) === 1);
  await page.close();
}

/* ── the hand ────────────────────────────────────────────────────── */
{
  const page = await open("?state=review");
  const depthBefore = await page.locator(".handCard").count();
  const ofBefore = await page.locator(".handOf").textContent();

  await page.keyboard.press("t");
  await page.waitForTimeout(360);
  /* T does not send anything on its own. It opens the same peel the
     notebook uses, inside the hand, so the promise the product is sold on
     is not skipped by its own review flow. */
  /* Superseded at round 6. T used to open an empty peel from the hand
     while the identical button on the desk refused — one control, one
     key, two behaviours, and the room you happened to be standing in
     decided which of the product's promises applied. Both rooms now run
     the same function, so both obey the same precondition: nothing opens
     the seam until somebody has picked the words that will cross. With a
     keyboard route into picking, refusing is no longer a dead end. */
  ok("T opens the peel inside the hand", (await page.locator(".hand .peel").count()) === 1);
  ok("the queue has not moved yet", (await page.locator(".handOf").textContent()) === ofBefore);
  await page.evaluate(() => {
    const body = document.querySelector(".handBody");
    const range = document.createRange();
    range.selectNodeContents(body);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await page.waitForTimeout(260);
  await page.locator(".peelField").fill("Ask about the ballroom from 8am");
  await page.waitForTimeout(120);
  await page.locator('[data-act="send"]').click();
  await page.waitForTimeout(360);
  ok("sending advances the queue", (await page.locator(".handOf").textContent()) !== ofBefore);
  ok("the decision is announced with what is left", /left\.$/.test(await said(page)));
  /* The pile behind the top card is capped at three: eight sheets of paper
     drawn on top of each other is a smudge, not a count. So the depth
     says "there is more behind this" and the exact number is always in
     words and in the pips, which is the claim the direction is allowed to
     make. */
  ok("the depth behind the top card is capped, not unbounded", depthBefore <= 3, `${depthBefore}`);
  ok(
    "the exact number left is always stated in words",
    /\d+ still to decide/.test(await page.locator(".deckNote").textContent()),
    await page.locator(".deckNote").textContent(),
  );
  ok("a decision is reversible", (await page.locator(".undo").count()) === 1);

  await page.keyboard.press("Control+z");
  await page.waitForTimeout(240);
  ok("ctrl+z puts the decision back", (await page.locator(".handOf").textContent()) === ofBefore);
  ok("the hand is back to where it was", (await page.locator(".handCard").count()) === depthBefore);

  await page.keyboard.press("k");
  await page.waitForTimeout(320);
  ok("K keeps the top card", (await said(page)).startsWith("Kept in Notes"));

  /* The pips have to be a count, not a decoration. */
  const pips = await page.evaluate(() => {
    const all = [...document.querySelectorAll(".pips i")];
    return { total: all.length, done: all.filter((i) => i.hasAttribute("data-done")).length };
  });
  ok("the pips count the decisions made", pips.done === 1 && pips.total > 1, JSON.stringify(pips));

  /* Empty the hand and check the end reports what the queue did. */
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("k");
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(300);
  ok("the end of the queue reports what it did", (await page.locator(".emptyTitle").textContent()).includes("decided"));
  ok(
    "the end of the queue offers a way onward, not a dead end",
    (await page.locator('.emptyMove .act').count()) >= 1,
  );
  await page.close();
}

/* ── search ──────────────────────────────────────────────────────── */
{
  const page = await open();
  /* The caret starts in the capture field, so search answers the chord
     that works while writing. A bare slash is a character in somebody's
     note, and the dock advertises the chord rather than the key. */
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(240);
  ok("the chord opens search", (await page.locator("#q").count()) === 1);
  ok("and puts the caret in it", await page.evaluate(() => document.activeElement.id === "q"));

  await page.locator("#q").fill("orchard");
  await page.waitForTimeout(220);
  const hits = await rowCount(page);
  ok("typing filters the index", hits > 0 && hits < 14, `${hits} hits`);
  ok("the caret survives every keystroke", await page.evaluate(() => document.activeElement.id === "q"));
  ok("matches are marked inside the person's own words", (await page.locator("#index mark").count()) > 0);

  await page.locator("#q").fill("zzzzzz");
  await page.waitForTimeout(220);
  ok("no results is not a dead end", (await page.locator(".emptyMove .act").count()) >= 1);
  ok("no results names what was searched for", (await page.locator(".emptyTitle").textContent()).includes("zzzzzz"));

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("escape clears the query before it leaves", (await page.locator("#q").inputValue()) === "");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("a second escape leaves search", (await page.locator("#q").count()) === 0);
  ok("and the whole notebook is back", (await rowCount(page)) === 14);
  await page.close();
}

/* ── voice ───────────────────────────────────────────────────────── */
{
  const page = await open();
  await page.locator('.verb[data-act="voice"]').first().click();
  await page.waitForTimeout(240);
  ok("voice takes the floor", (await page.locator(".dark").count()) === 1);
  ok("listening is announced", (await said(page)).startsWith("Listening"));

  /* The disclosure is not negotiable and it is not behind a press. */
  const note = await page.locator(".darkNote").textContent();
  ok("the disclosure is on screen while it is listening", note.includes("speech service"));
  ok("the disclosure names who receives the audio", note.includes("Signal Studio does not receive"));
  ok(
    "the words arrive as a live region, not as decoration",
    (await page.locator('.darkSaid[role="status"]').count()) === 1,
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(240);
  ok("escape leaves without keeping anything", (await page.locator(".dark").count()) === 0);
  ok("and says so", (await said(page)) === "Nothing was kept.");

  await page.locator('.verb[data-act="voice"]').first().click();
  await page.waitForTimeout(200);
  await page.locator('[data-act="voice-stop"]').click();
  await page.waitForTimeout(260);
  ok("stopping reads it back", (await page.locator(".piece").count()) === 2);
  /* Superseded at round 6. The transcript was printed above the pieces
     and again inside them — the same sentences twice, at the exact moment
     the product is asking to be trusted with somebody's voice. The pieces
     ARE the record: her words, in the product's type, editable. */
  ok("what was said comes back once, in the fields she can edit", (await page.locator(".saidWas").count()) === 0);
  ok(
    "and the pieces carry her words verbatim",
    await page.evaluate(() => {
      const said = document.querySelector(".saidHead");
      const joined = [...document.querySelectorAll(".pieceField")].map((f) => f.value).join(" ");
      return Boolean(said) && joined.length > 40 && !said.textContent.includes(joined.slice(0, 30));
    }),
  );
  ok(
    "and the caret is in the first of them, not on the body",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("pieceField")),
  );
  ok("and what came back is spoken in her words, not counted", /came back\. First:/i.test(await said(page)), await said(page));
  ok(
    "every piece is editable and separately named",
    await page.evaluate(() =>
      [...document.querySelectorAll(".pieceField")].every((f) => /Note \d+ of \d+/.test(f.getAttribute("aria-label"))),
    ),
  );
  await page.close();
}

/* ── word-safe trimming ──────────────────────────────────────────── */
{
  const page = await open("?state=pressure");
  const trims = await page.evaluate(() => {
    const out = [];
    for (const text of document.querySelectorAll(".idxText")) {
      const shown = text.textContent.trim();
      const full = text.dataset.full;
      if (shown === full) continue;
      out.push({ shown, full });
    }
    return out;
  });
  ok("the dense index trims something", trims.length > 0, `${trims.length} rows trimmed`);
  ok(
    "no trim cuts mid-word",
    trims.every((t) => {
      const shown = t.shown.replace(/…$/, "").trim();
      return t.full.startsWith(shown) && (t.full[shown.length] === undefined || /\s/.test(t.full[shown.length]));
    }),
    trims.filter((t) => {
      const shown = t.shown.replace(/…$/, "").trim();
      return !(t.full.startsWith(shown) && (t.full[shown.length] === undefined || /\s/.test(t.full[shown.length])));
    })[0]?.shown,
  );
  ok(
    "a trim never deletes content from the accessible name",
    await page.evaluate(() =>
      [...document.querySelectorAll(".idxRow")].every((r) => r.getAttribute("aria-label").includes(r.querySelector(".idxText").dataset.full)),
    ),
  );

  /* A trim measured at one width and never re-measured is a lie at every
     other width. */
  const wideChars = await page.evaluate(() =>
    [...document.querySelectorAll(".idxText")].reduce((n, t) => n + t.textContent.length, 0));
  await page.setViewportSize({ width: 820, height: 960 });
  await page.waitForTimeout(300);
  const narrowChars = await page.evaluate(() =>
    [...document.querySelectorAll(".idxText")].reduce((n, t) => n + t.textContent.length, 0));
  ok("the trim re-runs on resize", narrowChars < wideChars, `${wideChars} wide, ${narrowChars} narrow`);
  ok(
    "and nothing overflows its row after it",
    await page.evaluate(() => [...document.querySelectorAll(".idxText")].every((t) => t.scrollWidth <= t.clientWidth + 1)),
  );
  await page.close();
}

/* ── the honesty states ──────────────────────────────────────────── */
{
  const page = await open("?state=not-yet");
  const held = await page.locator('.state[data-tone="hold"]').first();
  ok("held on this device is stated in ink, not as an error", (await held.textContent()).includes("Nothing is lost"));
  const colours = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll(".state, .state *")) {
      for (const prop of ["color", "backgroundColor", "borderTopColor"]) {
        const m = String(getComputedStyle(el)[prop]).match(/rgba?\(([^)]+)\)/);
        if (!m) continue;
        const [r, g, b, a = 1] = m[1].split(",").map(Number);
        if (a === 0) continue;
        const grey = Math.abs(r - g) <= 2 && Math.abs(g - b) <= 2;
        const indigo = Math.abs(r - 79) <= 40 && Math.abs(g - 70) <= 40 && Math.abs(b - 229) <= 50;
        if (!grey && !indigo) bad.push(`${prop} ${getComputedStyle(el)[prop]}`);
      }
    }
    return [...new Set(bad)];
  });
  ok("no honesty state reaches for a warning colour", colours.length === 0, colours.slice(0, 3).join(" · "));
  ok(
    "the one destructive act says what it destroys before it happens",
    (await page.locator('.state[data-tone="destroy"] p').textContent()).includes("undo this"),
  );
    /* The loading line has to promise the order that actually arrives. It
     was still promising "newest first" two rounds after the pile stopped
     being ordered that way. */
  ok(
    "the loading frame promises the order that arrives",
    (await page.locator(".skelSay").textContent()).includes("what each one is about"),
    await page.locator(".skelSay").textContent(),
  );
  await page.close();
}

/* ── the seam ────────────────────────────────────────────────────── */
{
  const page = await open("?state=seam");
  ok("the note it came from is never covered", (await page.locator(".readBody").count()) === 1);
  ok("the words that cross are marked inside the person's own sentence", (await markCount(page, ".readBody, .handBody")) === 1);
  ok(
    "the wording field is labelled by the label above it",
    await page.evaluate(() => {
      const f = document.querySelector(".peelField");
      const id = f.getAttribute("aria-labelledby");
      return Boolean(id && document.getElementById(id));
    }),
  );
  ok(
    "the destination is a real control with a real name, not a bare select",
    await page.evaluate(() => {
      const p = document.querySelector(".picker");
      return p.tagName === "BUTTON" && /Which project/.test(p.getAttribute("aria-label"));
    }),
  );
  /* Once, at the top of the thing it is about. It was on screen four
     times in four grammars: the header chip, a line under the note, the
     boundary above the wording and a restatement under the buttons. */
  ok("the boundary is stated", (await page.locator(".peelBoundary").textContent()).includes("the exact words you pick"));
  const promises = await page.evaluate(() =>
    (document.querySelector(".top").innerText.match(/stays here|still private|nothing else from this note|still yours to edit/g) || []));
  ok("and only once", promises.length <= 1, promises.join(" · "));
  await page.close();
}

/* ── nothing invisible is focusable, everything focusable is named ── */
{
  for (const state of ["notebook", "review", "search", "voice", "readback", "seam", "nothing", "not-yet", "pressure"]) {
    const page = await open(`?state=${state}`);
    const bad = await page.evaluate(() => {
      const out = { invisible: [], unnamed: [], noFocusRing: [] };
      for (const el of document.querySelectorAll("button, a[href], input, textarea, select, [tabindex]")) {
        if (el.tabIndex < 0) continue;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        /* Round 9 sharpened this. The rule existed for the paid-for
           defect "a control at zero opacity must be inert" — a keyboard
           user tabbing onto an invisible button is lost. display:none
           and visibility:hidden are BOTH genuinely inert: driven in
           Chromium, Tab skips a visibility:hidden button and does NOT
           skip an opacity:0 one. Conflating them made the correct
           technique for hiding a control without touching the DOM
           during a typing burst look like the defect, while the actual
           defect — opacity:0 — went unchecked. Both are checked now,
           and the one that is really reachable is the one that fails. */
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (Number(cs.opacity) === 0 || r.width === 0 || r.height === 0) {
          out.invisible.push(el.className || el.tagName);
          continue;
        }
        const name = (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.textContent || el.getAttribute("placeholder") || "").trim();
        if (!name) out.unnamed.push(el.className || el.tagName);
      }
      return out;
    });
    ok(`${state}: nothing invisible is focusable`, bad.invisible.length === 0, bad.invisible.slice(0, 3).join(" · "));
    ok(`${state}: everything focusable carries a name`, bad.unnamed.length === 0, bad.unnamed.slice(0, 3).join(" · "));
  }
}

/* ── the phone ───────────────────────────────────────────────────── */
{
  const page = await open("", { width: 390, height: 844 });
  /* One object at the foot, carrying capture, the verbs, the suite and
     the account. Two stacked floating bars was the locked architecture
     unbuilt, and it cost 163px of an 844px screen. */
  ok("there is one object at the foot, not two", (await page.locator(".rail").count()) === 0);
  const dockBox = await page.locator(".dock").boundingBox();
  ok("and it is at the foot", dockBox.y + dockBox.height > 760, `${Math.round(dockBox.y)}`);
  ok("it carries the suite", (await page.locator(".dock .railTile").count()) >= 3);
  ok("it carries the account", await page.locator(".dock .dockAvatar").isVisible());
  ok("the desk stands down and the index takes the screen", await page.locator(".desk").isHidden());
  ok("capture is in it", await page.locator(".phoneField").isVisible());

  /* And the row gives its width to the person's words. */
  const rowFacts = await page.evaluate(() => {
    const row = document.querySelector(".idxRow");
    const text = row.querySelector(".idxText");
    return {
      row: Math.round(row.getBoundingClientRect().width),
      words: Math.round(text.getBoundingClientRect().width),
      lines: Math.round(text.getBoundingClientRect().height / parseFloat(getComputedStyle(text).lineHeight)),
      chars: text.textContent.trim().length,
    };
  });
  ok(
    "the words get most of the row, not the metadata",
    rowFacts.words / rowFacts.row > 0.78,
    `${rowFacts.words} of ${rowFacts.row}`,
  );
  ok("over two lines", rowFacts.lines >= 2, `${rowFacts.lines} lines`);
  ok("so a note is readable rather than a stub", rowFacts.chars > 30, `${rowFacts.chars} characters`);

  await page.locator(".phoneField").fill("Bar restock, tonic and the good olives.");
  await page.waitForTimeout(140);
  const before = await rowCount(page);
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(340);
  ok("the phone saves the note too", (await rowCount(page)) === before + 1);

  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("nothing scrolls sideways on a phone", over <= 1, `${over}px`);
  await page.close();
}

/* ── no sideways scroll anywhere ─────────────────────────────────── */
{
  for (const width of [1920, 1440, 1280, 1024, 768, 390]) {
    const page = await open("?state=pressure", { width, height: 900 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`no sideways scroll at ${width}`, over <= 1, `${over}px`);
    await page.close();
  }
}

/* ── stillness ───────────────────────────────────────────────────── */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce" });
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  await page.goto(FILE);
  await page.waitForTimeout(240);
  await page.locator(".topField").fill("A note written with motion turned off.");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(180);
  ok(
    "a machine that asks for stillness gets it, and still gets the note",
    (await page.locator(".idxRow").count()) === 15 && (await page.locator(".fly").count()) === 0,
  );
  await page.close();
}


/* ══════════════════════════════════════════════════════════════════
   ROUND 1
   Every assertion below guards a defect a panel seat found by driving
   this file, and a refuter then failed to kill. None of them was visible
   in a frame.
   ══════════════════════════════════════════════════════════════════ */

/* ── the capture loop closes on every device ─────────────────────── */
{
  const page = await open();
  ok(
    "the caret starts where the thought goes",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("topField")),
    await page.evaluate(() => document.activeElement.tagName + "." + document.activeElement.className),
  );

  /* Typed, not filled. fill() sets the value in one shot and hides the
     defect that made search type backwards. */
  await page.keyboard.type("Ring the marquee company back");
  await page.waitForTimeout(160);
  ok("typing lands in order", (await page.locator(".topField").inputValue()) === "Ring the marquee company back");
  /* The count settles in the pause after typing, never during it: a write
     into the document mid-burst is what destroyed the browser's own undo
     history. */
  await page.waitForTimeout(560);
  ok("the counter counts", (await page.locator("[data-count]").textContent()).startsWith("29 /"));

  await page.keyboard.type(" about the side panels");
  await page.waitForTimeout(560);
  ok("and keeps counting", (await page.locator("[data-count]").textContent()).startsWith("51 /"));

  /* Undo must never eat the words being written. */
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(160);
  ok(
    "ctrl+z does not eat a live draft",
    (await page.locator(".topField").inputValue()).includes("marquee"),
    await page.locator(".topField").inputValue(),
  );

  const before = await rowCount(page);
  await page.locator('[data-act="keep"]').click();
  await page.waitForTimeout(420);
  ok("keeping by pointer works", (await rowCount(page)) === before + 1);
  ok(
    "and focus comes back to the capture field",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("topField")),
    await page.evaluate(() => document.activeElement.tagName + "." + document.activeElement.className),
  );
  ok(
    "the undo strip says what happened, in the present",
    (await page.locator(".undo span").first().textContent()).trim() === "Saved.",
    await page.locator(".undo span").first().textContent(),
  );
  /* Round 9: "30s" was the only abbreviation in a product that writes
     "280 characters or fewer" in full, and the delete card three inches
     away already said "thirty seconds". One fact, one grammar. */
  ok("and how long the way back lasts", (await page.locator(".undoFor").textContent()).includes("30 seconds"));
  await page.close();
}

/* ── the phone can commit a note by touch ────────────────────────── */
{
  const page = await open("", { width: 390, height: 844 });
  /* Round 9: the control is always in the tree now, because inserting
     it 450ms after the first keystroke meant it did not exist for the
     whole of the three seconds the product is named for. What must
     still be true is that it is not offered before there is anything to
     commit — not visible, and not reachable by Tab. */
  ok(
    "the commit is not offered before there is anything to commit",
    await page.evaluate(() => {
      const k = document.querySelector('[data-act="keep"]');
      return !k || getComputedStyle(k).visibility === "hidden";
    }),
  );
  ok(
    "and it is on screen from the very first character, not after a pause",
    await (async () => {
      await page.locator(".phoneField").click();
      await page.keyboard.type("R", { delay: 0 });
      await page.waitForTimeout(70);
      return await page.evaluate(() => {
        const k = document.querySelector('[data-act="keep"]');
        return Boolean(k) && getComputedStyle(k).visibility === "visible";
      });
    })(),
  );
  await page.locator(".phoneField").click();
  await page.keyboard.type("Bar restock, tonic and the good olives.");
  await page.waitForTimeout(560);
  const commit = page.locator('.dock [data-act="keep"]');
  ok("a commit control appears in the dock", (await commit.count()) === 1);
  ok("it says what it does", (await commit.getAttribute("aria-label")) === "Save it", await commit.getAttribute("aria-label"));
  const box = await commit.boundingBox();
  ok("and a finger can land on it", box.width >= 36 && box.height >= 36, `${Math.round(box.width)}x${Math.round(box.height)}`);

  const before = await rowCount(page);
  await commit.click();
  await page.waitForTimeout(420);
  ok("tapping it keeps the note", (await rowCount(page)) === before + 1);
  ok("and the field is empty for the next thought", (await page.locator(".phoneField").inputValue()) === "");
  await page.close();
}

/* ── a note the size of a sentence, with a quote mark in it ──────── */
{
  const page = await open();
  const body = 'Ask the band about the "first dance" song list.';
  await page.keyboard.type(body);
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(420);
  /* Found by its words, not by its position: the pile is grouped by what
     each note is about, so a new note is not necessarily the first row. */
  const row = page.locator(".idxRow", { hasText: "Ask the band" }).first();
  const label = await row.getAttribute("aria-label");
  ok("a quote mark does not truncate the row's accessible name", label.includes("first dance"), label);
  const full = await row.locator(".idxText").getAttribute("data-full");
  ok("nor the text the trim measures against", full.includes("first dance"), full);
  await page.close();
}

/* ── search types forwards ───────────────────────────────────────── */
{
  const page = await open();
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(240);
  await page.keyboard.type("marquee");
  await page.waitForTimeout(240);
  ok("search types forwards", (await page.locator("#q").inputValue()) === "marquee", await page.locator("#q").inputValue());
  ok("and the caret stays at the end", await page.evaluate(() => document.querySelector("#q").selectionStart) === 7);

  /* The nearest match is computed, not asserted. */
  await page.locator("#q").fill("");
  await page.keyboard.type("drahcro");
  await page.waitForTimeout(260);
  ok("a nonsense query does not invent a nearest match", (await page.locator(".noHits .emptyBody").textContent()).includes("Nothing in the notebook"));
  ok("and still offers a way back", (await page.locator('.noHits [data-act="clear-search"]').count()) === 1);

  await page.locator("#q").fill("");
  await page.keyboard.type("marqueeee");
  await page.waitForTimeout(260);
  const near = page.locator('.noHits [data-act="nearest"]');
  ok("a near-miss query names a real note", (await near.count()) === 1);
  await near.click();
  await page.waitForTimeout(300);
  ok("and opening it actually opens it", (await page.locator(".readBody").count()) === 1);
  ok("with the note it promised", (await page.locator(".readBody").textContent()).toLowerCase().includes("marquee"));
  await page.close();
}

/* ── the seam is a sequence, not a photograph ────────────────────── */
{
  const page = await open("?state=seam");
  ok("the note it came from is on screen", (await page.locator(".readBody").count()) === 1);
  ok("the words that will cross are marked inside it", (await markCount(page)) === 1);
  const picked = await markText(page);
  ok("and the wording is seeded from exactly those words", (await page.locator(".peelField").inputValue()).includes(picked.replace(/[.]$/, "").split(" ").slice(0, 4).join(" ")) || (await page.locator(".peelField").inputValue()).length > 0);

  await page.locator(".peelField").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" before guests arrive");
  await page.waitForTimeout(140);
  await page.locator('[data-act="send"]').click();
  await page.waitForTimeout(300);
  ok("sending produces a receipt", (await page.locator("[data-receipt]").count()) === 1);
  ok("the receipt carries the edited wording", (await page.locator(".peelSent").textContent()).includes("before guests arrive"));
  ok("and promises the note stayed", (await page.locator("[data-receipt] .peelWhy").textContent()).includes("still yours to edit"));
  ok("the send is announced", (await said(page)).includes("Your note stayed here"));
  ok("and it is reversible", (await page.locator(".undo").count()) === 1);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(260);
  ok("undo un-sends it", (await page.locator("[data-receipt]").count()) === 0);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(240);
  ok("escape leaves the seam without sending", (await page.locator(".peel").count()) === 0);
  /* Round 8: the master said "crossed" twelve times in visible text and
     accessible names, a verb notes-copy.ts never uses. The promise is
     the same; the words are the product's own. */
  ok("and says nothing was sent", (await said(page)).includes("Nothing was sent"));
  await page.close();
}

/* ── the ledger of what crossed ──────────────────────────────────── */
{
  const page = await open("?state=seam");
  const rows = page.locator(".indexWrap .idxRow");
  ok("the ledger has the crossings in it", (await rows.count()) === 3);
  const tags = await page.locator(".indexWrap .idxTag").allTextContents();
  ok("no row in it says the note is still to decide", !tags.some((t) => /decide/i.test(t)), tags.join(" · "));
  ok("every row carries the lane the task is in", tags.every((t) => ["To do", "In progress", "Waiting"].includes(t.trim())), tags.join(" · "));
  const first = await rows.first().getAttribute("aria-label");
  ok("a row names the words that crossed", first.startsWith("Clear Sunday 11am late checkout"), first.slice(0, 60));
  ok("and says the note stayed in Notes", first.includes("stayed in Notes"), first.slice(-50));
  const bodies = await page.locator(".indexWrap .idxText").allTextContents();
  ok(
    "the private note body is never reprinted in the ledger",
    !bodies.some((b) => b.includes("Mara asked about a late checkout")),
    bodies[0],
  );
  ok("no pending dot survives on a crossed row", (await page.locator(".indexWrap .idxMark i").count()) === 0);
  await page.close();
}

/* ── dictation takes the keyboard with the floor ─────────────────── */
{
  const page = await open();
  await page.locator('.verb[data-act="voice"]').first().click();
  await page.waitForTimeout(300);
  ok(
    "focus lands inside the takeover",
    await page.evaluate(() => document.activeElement && document.activeElement.dataset.act === "voice-stop"),
    await page.evaluate(() => document.activeElement.tagName + " " + (document.activeElement.dataset.act || "")),
  );
  ok("and everything behind it is inert", (await page.locator(".sheet[inert], .rail[inert]").count()) === 2);
  /* Round the whole loop. A takeover that lets Tab fall out to the
     document body drops a keyboard user out of a live microphone. */
  let escaped = null;
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(70);
    const where = await page.evaluate(() => {
      const a = document.activeElement;
      return { inDark: Boolean(a.closest && a.closest(".dark")), what: a.tagName + " " + (a.className || "") };
    });
    if (!where.inDark && !escaped) escaped = where.what;
  }
  ok("tab cannot walk out of it", escaped === null, escaped || "");
  await page.keyboard.press("Shift+Tab");
  await page.waitForTimeout(90);
  ok(
    "and it walks backwards too",
    await page.evaluate(() => Boolean(document.activeElement.closest(".dark"))),
  );

  await page.locator('[data-act="voice-stop"]').click();
  await page.waitForTimeout(260);
  ok("the notebook is live again after it", (await page.locator("[inert]").count()) === 0);

  /* Editing what came back, then keeping it, has to keep the edit. */
  const field = page.locator(".pieceField").first();
  await field.click();
  await field.press("End");
  await page.keyboard.type(" Ask twice.");
  await page.waitForTimeout(140);
  await page.locator('[data-act="keep-both"]').click();
  await page.waitForTimeout(420);
  ok("keeping both really adds both", (await rowCount(page)) === 16, `${await rowCount(page)} rows`);
  const labels = await page.locator(".idxRow").allTextContents();
  ok("and keeps the edit that was just made", labels.join(" ").includes("Ask twice"), labels[0]);
  ok("the count it announces is the count on screen", (await said(page)).includes("16 in the notebook"), await said(page));
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  ok("and it is reversible, back to the words you were editing", (await page.locator(".piece").count()) === 2);
  ok("with the edit still in them", (await page.locator(".pieceField").first().inputValue()).includes("Ask twice"));
  await page.close();
}

/* ── the hand has a way out ──────────────────────────────────────── */
{
  const page = await open("?state=review");
  ok("there is a visible way back to the pile", (await page.locator('.handFoot [data-act="notebook"]').count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(260);
  ok("escape leaves the queue", (await page.locator(".handTop").count()) === 0);
  ok("and says where you are", (await said(page)).includes("Back to your notes"), await said(page));
  ok("with the notebook underneath", (await page.locator(".topField").count()) === 1);
  await page.close();
}

/* ── the notebook knows what its notes are about ─────────────────── */
{
  const page = await open();
  ok("the pile can be grouped two ways", (await page.locator(".groupBtn").count()) === 2);
  /* The resting state is what each note is ABOUT. Shipped as an opt-in it
     was an answer filed in a drawer: the product still opened on the
     calendar of when you typed. */
  const subjects = await page.locator(".idxDay").allTextContents();
  ok("the pile opens on what each note is about", subjects.some((t) => t.includes("Mara & Finn")), subjects.join(" | "));
  ok(
    "and on the thing the venue is facing, not the nearest date",
    subjects[0].includes("Mara & Finn"),
    subjects[0],
  );
  ok(
    "every group's slot means the same thing",
    subjects.every((t) => /,\s(today|in \d+ days?)|No date/.test(t)),
    subjects.join(" | "),
  );

  await page.locator('[data-act="group-day"]').click();
  await page.waitForTimeout(260);
  const dayRules = await page.locator(".idxDay").allTextContents();
  ok("and it can still be read by when", dayRules[0].trim().startsWith("Today"), dayRules[0]);

  await page.locator('[data-act="group-about"]').click();
  await page.waitForTimeout(260);
  ok(
    "a dated subject says when the venue is actually facing it",
    subjects.some((t) => t.includes("Saturday 18 July") && /in \d+ days?/.test(t)),
    subjects.find((t) => t.includes("Mara & Finn")),
  );
  ok("the soonest thing is first", subjects[0].includes("Mara & Finn") || subjects[0].includes("The course"), subjects[0]);
  ok("the change is announced", (await said(page)).includes("what each note is about"));
  ok(
    "the pressed state is real, not painted",
    (await page.locator('[data-act="group-about"]').getAttribute("aria-pressed")) === "true",
  );
  await page.close();
}

/* ── nothing is painted on ───────────────────────────────────────── */
{
  const page = await open();
  /* Every control in the resting state either changes something or says
     out loud that it belongs to a surface outside this master. */
  const dead = [];
  const acts = await page.evaluate(() =>
    [...document.querySelectorAll("[data-act]")].map((b) => b.dataset.act).filter((a, i, all) => all.indexOf(a) === i));
  for (const act of acts) {
    if (act === "keep") continue;
    const before = await page.evaluate(() => document.body.innerHTML.length + "|" + (document.getElementById("say") || {}).textContent);
    await page.locator(`[data-act="${act}"]`).first().click().catch(() => {});
    await page.waitForTimeout(160);
    const after = await page.evaluate(() => document.body.innerHTML.length + "|" + (document.getElementById("say") || {}).textContent);
    if (before === after) dead.push(act);
    await page.goto(FILE);
    await page.waitForTimeout(200);
  }
  ok("no control takes a click and answers with nothing", dead.length === 0, dead.join(" · "));
  await page.close();
}

/* ── the pile has a floor, and the writing has a measure ─────────── */
{
  const page = await open("?state=pressure");
  await page.locator("#index").evaluate((n) => (n.scrollTop = n.scrollHeight));
  await page.waitForTimeout(220);
  const clear = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".idxRow")];
    const last = rows[rows.length - 1].getBoundingClientRect();
    const dock = document.querySelector(".dock").getBoundingClientRect();
    return dock.top - last.bottom;
  });
  ok("the oldest note is not eaten by the dock", clear > 8, `${Math.round(clear)}px of clearance`);

  const measures = await page.evaluate(() => {
    const out = {};
    for (const sel of [".readBody", ".topField"]) {
      const node = document.querySelector(sel);
      if (!node) continue;
      const cs = getComputedStyle(node);
      out[sel] = Math.round(node.getBoundingClientRect().width / (parseFloat(cs.fontSize) * 0.45));
    }
    return out;
  });
  for (const [sel, cpl] of Object.entries(measures)) {
    ok(`${sel} is on a legible measure`, cpl >= 45 && cpl <= 78, `${cpl} characters per line`);
  }
  await page.close();
}

/* ── the arrival is staged ───────────────────────────────────────── */
{
  const page = await open();
  await page.keyboard.type("A thought that should visibly land.");
  await page.waitForTimeout(120);
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(70);
  /* The words themselves travel, on their own layer, because paint()
     remounts the tree and anything animated inside it did not exist a
     frame ago. */
  const fly = page.locator(".fly");
  ok("the words leave the field", (await fly.count()) === 1);
  ok("carrying what was written", (await fly.textContent()).includes("visibly land"));
  ok("outside the notebook's own tree", await page.evaluate(() => document.querySelector(".fly").parentElement === document.body));
  ok("and hidden from a reader who has already been told", (await fly.getAttribute("aria-hidden")) === "true");
  ok("the row it became is marked while they land", (await page.locator(".idxRow[data-arriving]").count()) === 1);
  await page.waitForTimeout(1000);
  ok("the words clear themselves", (await page.locator(".fly").count()) === 0);
  ok("and so does the mark", (await page.locator(".idxRow[data-arriving]").count()) === 0);
  await page.close();
}


/* ══════════════════════════════════════════════════════════════════
   ROUND 3
   ══════════════════════════════════════════════════════════════════ */

/* ── the subject is something the product does ───────────────────── */
{
  const page = await open();
  const chip = page.locator('[data-act="filing"]');
  ok("the capture sheet says where the words will go", (await chip.count()) === 1);
  ok("and it opens on what the venue is facing", (await chip.textContent()).includes("Mara & Finn"));

  await chip.click();
  await page.waitForTimeout(180);
  ok("it opens a real list", (await page.locator('.pickerPop [role="option"]').count()) >= 4);
  ok("with one of them marked", (await page.locator('[role="option"][aria-selected="true"]').count()) === 1);
  await page.locator('.pickerPop [data-key="the-house"]').click();
  await page.waitForTimeout(200);
  ok("choosing one changes where the words go", (await chip.textContent()).includes("The house"));
  ok("and says so", (await said(page)).includes("Filing under The house"));

  await page.locator(".topField").click();
  await page.keyboard.type("Reprint the welcome sign before the open day.");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(700);
  const filed = await page.evaluate(() => {
    const row = [...document.querySelectorAll(".idxRow")].find((r) => r.textContent.includes("Reprint the welcome"));
    if (!row) return null;
    const section = row.closest(".idxSection");
    const head = section ? section.querySelector(".idxDay") : null;
    return head ? head.textContent : null;
  });
  ok("the note a person wrote lands where they filed it", Boolean(filed && filed.includes("The house")), String(filed));

  const seen = await page.evaluate(() => {
    const row = [...document.querySelectorAll(".idxRow")].find((r) => r.textContent.includes("Reprint the welcome"));
    if (!row) return false;
    const box = row.getBoundingClientRect();
    const scroller = document.querySelector("#index").getBoundingClientRect();
    return box.top >= scroller.top - 4 && box.bottom <= scroller.bottom + 4;
  });
  ok("and inside the pile the person is looking at", seen);
  await page.close();
}

/* ── a note can be re-filed from the note itself ─────────────────── */
{
  const page = await open();
  await page.locator(".idxRow").nth(1).click();
  await page.waitForTimeout(240);
  const refile = page.locator('[data-act="refile"]');
  ok("an open note says what it is about, as a control", (await refile.count()) === 1);
  await refile.click();
  await page.waitForTimeout(180);
  await page.locator('.pickerPop [data-key="the-studio"]').click();
  await page.waitForTimeout(240);
  ok("moving it is announced", (await said(page)).includes("Moved to The studio"));
  ok("and reversible", (await page.locator(".undo").count()) === 1);
  await page.close();
}

/* ── the subject rule leads, and stays ───────────────────────────── */
{
  const page = await open();
  const type = await page.evaluate(() => {
    const rule = document.querySelector(".idxDay");
    const row = document.querySelector(".idxRow .idxText");
    const cs = getComputedStyle(rule);
    return {
      rule: parseFloat(cs.fontSize),
      row: parseFloat(getComputedStyle(row).fontSize),
      sticky: cs.position,
      tag: rule.tagName,
      level: rule.getAttribute("aria-level"),
    };
  });
  ok("the subject rule is not smaller than the rows it heads", type.rule >= type.row, `${type.rule} vs ${type.row}`);
  ok("it stays with what it heads", type.sticky === "sticky");
  ok("and it is a heading on the tree", type.tag === "H3" && type.level === "3", `${type.tag} ${type.level}`);
  ok("the rows are items on the tree", (await page.locator('.idxItem[role="listitem"]').count()) > 5);
  ok("and each one is still a button", (await page.evaluate(() => {
    const b = document.querySelector(".idxRow");
    return b.tagName === "BUTTON" && !b.hasAttribute("role");
  })));
  await page.close();
}

/* ── the grouping survives the density that needs it ─────────────── */
{
  const page = await open("?state=pressure");
  ok("36 notes are still grouped by what they are about", (await page.locator(".idxDay").count()) >= 3);
  ok("and the control is still there", (await page.locator(".groupBtn").count()) === 2);
  await page.close();
}

/* ── the two planes share a column ───────────────────────────────── */
{
  for (const width of [1280, 1440, 1920]) {
    const page = await open("", { width, height: 900 });
    const edges = await page.evaluate(() => {
      const paper = document.querySelector(".pile").getBoundingClientRect();
      const row = document.querySelector(".idxRow").getBoundingClientRect();
      return { paperL: paper.left, paperR: paper.right, rowL: row.left, rowR: row.right };
    });
    ok(
      `the desk and the index share a column at ${width}`,
      Math.abs(edges.paperL - (edges.rowL + 10)) < 4 && Math.abs(edges.paperR - (edges.rowR - 10)) < 4,
      `paper ${Math.round(edges.paperL)}..${Math.round(edges.paperR)} row ${Math.round(edges.rowL)}..${Math.round(edges.rowR)}`,
    );
    await page.close();
  }
}

/* ── the peel is a smaller piece of paper ────────────────────────── */
{
  const page = await open("?state=seam");
  const sizes = await page.evaluate(() => {
    const note = document.querySelector(".top").getBoundingClientRect();
    const peel = document.querySelector(".peel").getBoundingClientRect();
    return { noteW: note.width, peelW: peel.width, noteA: note.width * note.height, peelA: peel.width * peel.height };
  });
  ok("the peel is narrower than the note it came from", sizes.peelW < sizes.noteW - 40, `${Math.round(sizes.peelW)} vs ${Math.round(sizes.noteW)}`);
  await page.close();
}

/* ── one sentence, one setting ───────────────────────────────────── */
{
  const leadings = new Set();
  for (const [state, sel] of [["notebook", ".topField"], ["review", ".handBody"], ["readback", ".pieceField"], ["seam", ".peelField"]]) {
    const p2 = await open(`?state=${state}`);
    const v = await p2.evaluate((s2) => {
      const n = document.querySelector(s2);
      if (!n) return null;
      const cs = getComputedStyle(n);
      return `${cs.fontSize}/${cs.lineHeight}/${cs.letterSpacing}`;
    }, sel);
    if (v) leadings.add(v);
    await p2.close();
  }
  ok("a person's own words are set identically everywhere", leadings.size === 1, [...leadings].join(" · "));
}

/* ── picking does not move the page ──────────────────────────────── */
{
  const page = await open();
  await page.locator(".idxRow").nth(2).click();
  await page.waitForTimeout(240);
  const before = await page.evaluate(() => document.querySelector(".indexHead").getBoundingClientRect().top);
  await page.evaluate(() => {
    const body = document.querySelector(".readBody");
    const range = document.createRange();
    range.selectNodeContents(body);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await page.waitForTimeout(300);
  ok("a pick raises a statement of what will cross", (await page.locator(".pickBar").count()) === 1);
  /* Round 9: the note is sentence spans now, so a pick that crosses a
     sentence boundary is marked in more than one span. Counting spans
     asserted the old markup; what actually matters is that the ink on
     the page spells the picked string exactly. */
  ok(
    "and marks the words in the note, exactly",
    await page.evaluate(() => {
      const marks = [...document.querySelectorAll(".readBody .pick")];
      if (!marks.length) return false;
      const drawn = marks.map((m) => m.textContent).join("").replace(/s+/g, " ").trim();
      const body = document.querySelector(".readBody").textContent.replace(/s+/g, " ");
      return drawn.length > 2 && body.includes(drawn);
    }),
    await page.evaluate(() =>
      [...document.querySelectorAll(".readBody .pick")].map((m) => m.textContent).join("|"),
    ),
  );
  const after = await page.evaluate(() => document.querySelector(".indexHead").getBoundingClientRect().top);
  ok("without moving the page under the person's hand", Math.abs(after - before) < 3, `${Math.round(before)} then ${Math.round(after)}`);
  await page.close();
}

/* ── the keyboard reaches the list that is on screen ─────────────── */
{
  for (const state of ["notebook", "review", "seam", "search", "pressure"]) {
    const page = await open(`?state=${state}`);
    const stops = await page.evaluate(() => document.querySelectorAll('.idxRow[tabindex="0"]').length);
    const rows = await page.locator(".idxRow").count();
    ok(`${state}: whatever list is on screen owns the tab stop`, rows === 0 || stops === 1, `${stops} stops, ${rows} rows`);
    await page.close();
  }
}

/* ── one long note does not eat the other plane ──────────────────── */
{
  const page = await open("?state=pressure");
  const planes = await page.evaluate(() => ({
    index: document.querySelector("#index").getBoundingClientRect().height,
    rows: document.querySelectorAll(".idxRow").length,
  }));
  ok("the index survives a nine-hundred-word note", planes.index > 200 && planes.rows > 6, JSON.stringify(planes));
  await page.close();
}

/* ── one lexicon ─────────────────────────────────────────────────── */
{
  const page = await open();
  const words = await page.evaluate(() => document.body.innerText);
  ok("the place notes live has one name", !/the pile/i.test(words), (words.match(/[^\n]*pile[^\n]*/i) || [])[0] || "");
  ok("and the crossing has one verb", !/turn into a task/i.test(words), (words.match(/[^\n]*turn into[^\n]*/i) || [])[0] || "");
  await page.close();
}


/* ══════════════════════════════════════════════════════════════════
   ROUND 4
   ══════════════════════════════════════════════════════════════════ */

/* ── a phone can read a note, and act on it ──────────────────────── */
{
  const page = await open("", { width: 390, height: 844 });
  await page.locator(".idxRow").nth(1).click();
  await page.waitForTimeout(320);
  ok("tapping a row opens the note", (await page.locator(".phoneSheet").count()) === 1);
  ok("in full", (await page.locator(".phoneSheet .readBody").textContent()).length > 60);
  ok("with the pile behind it inert", (await page.locator(".sheet[inert]").count()) === 1);
  ok("and a way back", (await page.locator('.phoneSheet [data-act="close"]').count()) === 1);
  ok("it says what the note is about, as a control", (await page.locator('.phoneSheet [data-act="refile"]').count()) === 1);
  ok(
    "the primary states its precondition rather than refusing after the press",
    (await page.locator('.phoneSheetFoot [data-act="peel"]').textContent()).includes("Pick the words"),
  );

  await page.evaluate(() => {
    const body = document.querySelector(".phoneSheet .readBody");
    const range = document.createRange();
    range.selectNodeContents(body);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await page.waitForTimeout(320);
  ok("picking works on a phone", (await page.locator(".phoneSheet .pickBar").count()) === 1);
  /* The pick bar states; the note's own primary acts. Two ink buttons live
     at the same instant is what this replaced. */
  ok("and the strip states rather than acts", (await page.locator(".phoneSheet .pickBar button").count()) === 0);
  await page.locator('.phoneSheetFoot [data-act="peel"]').click();
  await page.waitForTimeout(280);
  ok("and the peel opens in the sheet", (await page.locator(".phoneSheet .peel").count()) === 1);
  await page.locator('.phoneSheet [data-act="send"]').click();
  await page.waitForTimeout(320);
  ok("a note can be crossed into Tasks from a phone", (await page.locator(".phoneSheet [data-receipt]").count()) === 1);

  await page.locator('.phoneSheet [data-act="close-peel"]').click();
  await page.waitForTimeout(260);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(260);
  ok("escape puts the note back", (await page.locator(".phoneSheet").count()) === 0);
  ok("and the pile is live again", (await page.locator("[inert]").count()) === 0);
  await page.close();
}

/* ── the note's facts sit beside it, not over it ─────────────────── */
{
  const page = await open();
  await page.locator(".idxRow").nth(1).click();
  await page.waitForTimeout(280);
  ok("the desk is a two-column plane", (await page.locator(".top[data-two]").count()) === 1);
  const shape = await page.evaluate(() => {
    const body = document.querySelector(".readBody").getBoundingClientRect();
    const aside = document.querySelector(".deskAside").getBoundingClientRect();
    return { bodyR: body.right, asideL: aside.left, asideW: aside.width };
  });
  ok("with the facts in a margin beside the writing", shape.asideL > shape.bodyR - 4, `${Math.round(shape.bodyR)} then ${Math.round(shape.asideL)}`);
  ok("and the margin is a real column", shape.asideW > 200, `${Math.round(shape.asideW)}`);
  await page.close();
}

/* ── the index has rank ──────────────────────────────────────────── */
{
  const page = await open();
  const t = await page.evaluate(() => {
    const rule = getComputedStyle(document.querySelector(".idxDay"));
    /* Round 9: with the lede budget finally enforced on the seeded
       notes, no shipped note earns a lede, so there is no <b> in the
       index to measure. That is the point of the change — the machine
       stops re-weighting a person's prose — so the rank this asserts is
       the one that actually carries it: the day rule over the row. */
    const row = getComputedStyle(document.querySelector(".idxRow .idxText"));
    const bolds = document.querySelectorAll(".idxRow .idxText b").length;
    const overBudget = [...document.querySelectorAll(".idxRow .idxText b")]
      .filter((n) => n.textContent.trim().length > 48).length;
    return { rule: parseFloat(rule.fontSize), row: parseFloat(row.fontSize), bolds, overBudget };
  });
  ok("the heading outranks the rows beneath it", t.rule > t.row, `${t.rule} over ${t.row}`);
  ok("and no row spends the lede weight past its declared budget", t.overBudget === 0, `${t.bolds} ledes, ${t.overBudget} over 48`);
  await page.close();
}

/* ── the group rules do not stack ────────────────────────────────── */
{
  const page = await open("?state=pressure");
  await page.locator("#index").evaluate((n) => (n.scrollTop = 600));
  await page.waitForTimeout(240);
  const stuck = await page.evaluate(() => {
    const top = document.querySelector("#index").getBoundingClientRect().top;
    return [...document.querySelectorAll(".idxDay")].filter((h) => Math.abs(h.getBoundingClientRect().top - top) < 2).length;
  });
  ok("only one group rule is ever stuck at the top", stuck <= 1, `${stuck} stuck`);
  await page.close();
}

/* ── the hand does not bob ───────────────────────────────────────── */
{
  const page = await open("?state=review");
  const tops = [];
  for (let i = 0; i < 4; i += 1) {
    tops.push(await page.evaluate(() => Math.round(document.querySelector(".indexWrap").getBoundingClientRect().top)));
    await page.keyboard.press("k");
    await page.waitForTimeout(360);
  }
  ok("working the queue does not move the plane beneath it", new Set(tops).size === 1, tops.join(" · "));
  await page.close();
}

/* ── the signature moment is set in the product's own type ───────── */
{
  const page = await open();
  await page.keyboard.type("A sentence that has to look like the product wrote it.");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(80);
  const fly = await page.evaluate(() => {
    const n = document.querySelector(".fly");
    if (!n) return null;
    const cs = getComputedStyle(n);
    return { size: cs.fontSize, lh: cs.lineHeight, ls: cs.letterSpacing, family: cs.fontFamily.split(",")[0] };
  });
  ok("the flying words carry a real size", Boolean(fly) && fly.size !== "16px", JSON.stringify(fly));
  ok("a real leading", Boolean(fly) && fly.lh !== "normal", fly && fly.lh);
  ok("and the product's typeface", Boolean(fly) && /Geist/.test(fly.family), fly && fly.family);

  const at = [];
  for (let i = 0; i < 4; i += 1) {
    at.push(await page.evaluate(() => {
      const n = document.querySelector(".fly");
      return n ? Math.round(n.getBoundingClientRect().top) : null;
    }));
    await page.waitForTimeout(115);
  }
  const moving = at.filter((v, i) => i > 0 && v !== null && at[i - 1] !== null && v !== at[i - 1]).length;
  ok("the words travel for most of the moment", moving >= 2, at.join(" · "));
  await page.close();
}

/* ── the person's words outrank the machine's version ────────────── */
{
  const page = await open("?state=seam");
  /* Seeded, the picked words and the wording are the same sentence, and
     the seam prints it once. They appear together only once the wording
     has been edited away from them. */
  ok("the seam does not print the same sentence twice", (await page.locator(".peelFrom").count()) === 0);
  await page.locator(".peelField").fill("Warm the orchard room before guests arrive");
  await page.waitForTimeout(240);
  await page.locator(".peelField").blur();
  await page.locator('[data-act="send"]').hover();
  await page.waitForTimeout(120);
  /* Re-render by touching state the paint path owns. */
  await page.keyboard.press("Tab");
  await page.waitForTimeout(160);
  const rank = await page.evaluate(() => {
    const picked = document.querySelector(".peelFrom span");
    const wording = document.querySelector(".peelField");
    if (!picked) return null;
    return { picked: parseFloat(getComputedStyle(picked).fontSize), wording: parseFloat(getComputedStyle(wording).fontSize) };
  });
  ok(
    "and when it shows both, the words a person picked are not demoted",
    rank === null || rank.picked >= rank.wording,
    rank ? `${rank.picked} vs ${rank.wording}` : "not shown until edited",
  );
  await page.close();
}

/* ── undo in the field is the field's ────────────────────────────── */
{
  const page = await open();
  await page.keyboard.type("Ring the marquee company back about the side panels");
  await page.waitForTimeout(180);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(180);
  const after = await page.locator(".topField").inputValue();
  ok("one undo gives back more than one letter", after.length < 40, `${after.length} characters left`);
  await page.close();
}

/* ── no lab vocabulary in product chrome ─────────────────────────── */
{
  for (const state of ["notebook", "pressure", "review", "seam"]) {
    const page = await open(`?state=${state}`);
    const words = await page.evaluate(() => document.body.innerText);
    ok(
      `${state}: no lab vocabulary in the chrome`,
      !/fixture|exploration|extension of the/i.test(words),
      (words.match(/[^\n]*(fixture|exploration)[^\n]*/i) || [])[0] || "",
    );
    await page.close();
  }
}


/* ══════════════════════════════════════════════════════════════════
   ROUND 5
   ══════════════════════════════════════════════════════════════════ */

/* ── undo, at the speed a person actually types ──────────────────── */
{
  for (const delay of [40, 90]) {
    const page = await open();
    await page.locator(".topField").click();
    await page.keyboard.type("Ring the marquee company back about the side panels", { delay });
    await page.waitForTimeout(200);
    const before = (await page.locator(".topField").inputValue()).length;
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(200);
    const after = (await page.locator(".topField").inputValue()).length;
    ok(
      `one undo gives back a burst at ${delay}ms a key`,
      before - after > 5,
      `${before} then ${after}`,
    );
    await page.close();
  }
}

/* ── the lede is a budget, not a full stop ───────────────────────── */
{
  const page = await open();
  /* A note captured in three seconds has no terminal punctuation, and the
     600-weight lede was derived from one — so every real capture came out
     entirely semibold. */
  await page.keyboard.type("ring the marquee people about the side panels before four on friday");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(700);
  const row = page.locator(".idxRow", { hasText: "ring the marquee people" }).first();
  const weights = await row.locator(".idxText").evaluate((n) => {
    const out = [];
    for (const child of n.childNodes) {
      const el = child.nodeType === 1 ? child : n;
      out.push(getComputedStyle(el).fontWeight);
    }
    return out;
  });
  ok("a note with no full stop is not set entirely in semibold", weights.includes("400"), weights.join(" · "));
  await page.locator(".idxRow", { hasText: "ring the marquee people" }).first().click();
  await page.waitForTimeout(260);
  const desk = await page.evaluate(() => {
    const b = document.querySelector(".readBody");
    const lede = b.querySelector(".lede");
    return { hasLede: Boolean(lede), whole: b.textContent.length, ledeLen: lede ? lede.textContent.length : 0 };
  });
  ok("and on the desk the lede is a budget, not the whole note", !desk.hasLede || desk.ledeLen < desk.whole * 0.8, JSON.stringify(desk));
  await page.close();
}

/* ── the queue never scolds, and never refuses silently ──────────── */
{
  const page = await open("?state=review");
  /* The first card carries a pick the person made earlier. It is DRAWN on
     the card, so the primary says what it will do rather than asking for
     something that is already there — one expression answers what is
     marked, what the button says, and what the seam receives. */
  ok("a standing pick is drawn on the card, not held invisibly", (await markCount(page, ".handBody")) === 1);
  ok(
    "and the primary reads off the same pick it will send",
    (await page.locator('.handFoot [data-act="d-task"]').textContent()).includes("Send to Tasks"),
  );
  /* Walk on to a card nobody has picked from. */
  await page.locator('[data-act="d-later"]').click();
  await page.waitForTimeout(320);
  ok("a card with no pick states its precondition at rest", (await markCount(page, ".handBody")) === 0);
  ok(
    "and its primary says so",
    (await page.locator('.handFoot [data-act="d-task"]').textContent()).includes("Pick the words"),
  );
  await page.keyboard.press("t");
  await page.waitForTimeout(320);
  ok("T with nothing picked does not open the seam from nothing", (await page.locator(".hand .peel").count()) === 0);
  ok("it invites instead, in the card itself", (await page.locator(".hand .nudge").count()) === 1);
  /* Round 8 inverted this. The invitation names the arrow keys inside
     the note, so it stands the person inside the note rather than back
     on the button they pressed — the ring lands on the thing the
     sentence is about, and the keys it names work on the next press. */
  ok(
    "and the press stands you inside the note the instruction is about",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("handBody")),
    await page.evaluate(() => (document.activeElement || {}).className || "none"),
  );
  const heard = await said(page);
  ok("pressing it invites rather than reprimands", !/^Highlight/.test(heard), heard);
  ok("and it says what to do next", /pick the words/i.test(heard), heard);
  /* Round 9 added a third route — tapping a sentence — because a phone
     had neither of the other two. All three are named. */
  ok("and it names every route into picking, not just the mouse one", /arrow keys/i.test(heard) && /tap a sentence/i.test(heard), heard);
  /* The invitation stays until it is answered. It used to be cleared on a
     4.2-second clock, so the sentence telling somebody what to do
     disappeared while they were doing it. */
  await page.waitForTimeout(4600);
  ok("and the invitation is still there five seconds later", (await page.locator(".hand .nudge").count()) === 1);
  ok("and it is not dressed as an error", (await page.locator(".hand .nudge svg").getAttribute("data-i")) !== "alert");
  await page.locator(".handBody").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  const pickedText = await markText(page, ".handBody");
  await page.keyboard.press("t");
  await page.waitForTimeout(320);
  ok("picking, then pressing, opens the peel", (await page.locator(".hand .peel").count()) === 1);
  ok("the peel asks in its own field", (await page.locator(".peelField").getAttribute("placeholder")).length > 6);
  ok(
    "and it carries exactly the words that were picked",
    (await page.locator(".peelField").inputValue()).toLowerCase().startsWith(pickedText.trim().toLowerCase().slice(0, 24)),
  );
  ok("with the card's own actions stood down", (await page.locator('.handFoot [data-act="d-task"]').count()) === 0);
  await page.close();
}

/* ── delete asks, and keeps the promise printed beside it ────────── */
{
  const page = await open("?state=review");
  const before = await page.locator(".handOf").textContent();
  await page.locator('[data-act="d-delete"]').click();
  await page.waitForTimeout(260);
  ok("delete asks before it deletes", (await page.locator(".confirm").count()) === 1);
  ok("and nothing has happened yet", (await page.locator(".handOf").textContent()) === before);
  await page.locator('[data-act="d-delete-no"]').click();
  await page.waitForTimeout(240);
  ok("saying no keeps the note", (await page.locator(".handOf").textContent()) === before);

  await page.locator('[data-act="d-delete"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-act="d-delete-yes"]').click();
  await page.waitForTimeout(320);
  ok("saying yes deletes it", (await page.locator(".handOf").textContent()) !== before);
  ok("and the way back says how long it lasts", (await page.locator(".undoFor").textContent()).includes("30 seconds"));
  await page.close();
}

/* ── the desk's foot is designed ─────────────────────────────────── */
{
  const page = await open();
  await page.locator(".idxRow").nth(1).click();
  await page.waitForTimeout(280);
  const foot = await page.evaluate(() => {
    const top = document.querySelector(".top");
    const write = document.querySelector(".deskWrite");
    const aside = document.querySelector(".deskAside");
    const pad = parseFloat(getComputedStyle(top).paddingBottom);
    const foot = document.querySelector(".topFoot");
    const tallest = Math.max(
      write.getBoundingClientRect().bottom,
      aside.getBoundingClientRect().bottom,
      foot ? foot.getBoundingClientRect().bottom : 0,
    );
    return Math.round(top.getBoundingClientRect().bottom - tallest - pad);
  });
  ok("the paper ends where its content ends", Math.abs(foot) < 30, `${foot}px of unexplained foot`);
  await page.close();
}

/* ── the margin never outmeasures the writing ────────────────────── */
{
  for (const width of [768, 900, 1080, 1280, 1440]) {
    const page = await open("", { width, height: 900 });
    await page.locator(".idxRow").nth(1).click();
    await page.waitForTimeout(280);
    const cols = await page.evaluate(() => {
      const w = document.querySelector(".deskWrite").getBoundingClientRect().width;
      const a = document.querySelector(".deskAside").getBoundingClientRect().width;
      const side = document.querySelector(".deskAside").getBoundingClientRect().left >
        document.querySelector(".deskWrite").getBoundingClientRect().left + 10;
      return { w, a, side };
    });
    ok(
      `the writing outmeasures its margin at ${width}`,
      !cols.side || cols.w > cols.a,
      `${Math.round(cols.w)} writing vs ${Math.round(cols.a)} margin`,
    );
    await page.close();
  }
}

/* ── the chrome belongs to the column ────────────────────────────── */
{
  const page = await open("", { width: 1920, height: 900 });
  const edges = await page.evaluate(() => {
    const head = document.querySelector(".head").getBoundingClientRect();
    const row = document.querySelector(".idxRow").getBoundingClientRect();
    return { headL: head.left, headR: head.right, rowL: row.left, rowR: row.right };
  });
  ok(
    "the head resolves to the same column as the pile at 1920",
    Math.abs(edges.headL - (edges.rowL - 20)) < 24 && Math.abs(edges.headR - (edges.rowR + 20)) < 24,
    `head ${Math.round(edges.headL)}..${Math.round(edges.headR)} row ${Math.round(edges.rowL)}..${Math.round(edges.rowR)}`,
  );
  await page.close();
}

/* ── one name for the search ─────────────────────────────────────── */
{
  const page = await open();
  const names = await page.evaluate(() => {
    const b = document.querySelector('[data-act="search"]');
    return { label: (b.getAttribute("aria-label") || "").trim(), visible: b.textContent.trim() };
  });
  /* The keycap is not part of the label a person would say out loud. */
  const spoken = names.visible.replace(/(Ctrl|⌘)\s?K$/, "").trim();
  ok("the visible label is inside the accessible name", names.label.includes(spoken), `${names.label} / ${spoken}`);
  await page.close();
}

/* ── the phone's group rule is one line ──────────────────────────── */
{
  const page = await open("", { width: 390, height: 844 });
  const rule = await page.evaluate(() => {
    const h = document.querySelector(".idxDay");
    const lh = parseFloat(getComputedStyle(h).lineHeight);
    const pad = parseFloat(getComputedStyle(h).paddingTop) + parseFloat(getComputedStyle(h).paddingBottom);
    return Math.round((h.getBoundingClientRect().height - pad) / lh);
  });
  ok("the group rule is at most two lines on a phone", rule <= 2, `${rule} lines`);

  const clamped = await page.evaluate(() =>
    [...document.querySelectorAll(".idxText")].filter((t) => t.dataset.clamped !== undefined).length);
  /* Superseded at round 7. The mark used to be a pseudo-element parked at
     the box's right edge, which is not where the second line ends — so it
     landed mid-word with half a glyph showing through the gradient beside
     it. The mark is the last character of the sentence now, which is the
     same rule the one-line desktop row has always obeyed. */
  const marks = await page.evaluate(() => {
    const t = [...document.querySelectorAll(".idxText")].find((n) => n.dataset.clamped !== undefined);
    return t ? t.textContent.trim().slice(-1) : "";
  });
  ok("a clamped row says it is clamped, in the sentence", clamped === 0 || marks === "…", `${clamped} clamped, ends "${marks}"`);
  ok(
    "and no clamped row hides a line behind the mark",
    await page.evaluate(() =>
      [...document.querySelectorAll(".idxText")].every((t) => t.scrollHeight <= t.clientHeight + 2)),
  );
  await page.close();
}

/* ── the spoken words keep the measure ───────────────────────────── */
{
  const page = await open("?state=voice");
  const cpl = await page.evaluate(() => {
    const n = document.querySelector(".darkSaid");
    return Math.round(n.getBoundingClientRect().width / (parseFloat(getComputedStyle(n).fontSize) * 0.45));
  });
  ok("the spoken words are on the same measure as every other surface", cpl >= 45 && cpl <= 78, `${cpl} characters per line`);
  await page.close();
}

/* ── one destination on the note's row ───────────────────────────── */
{
  const page = await open();
  await page.locator(".idxRow").nth(1).click();
  await page.waitForTimeout(260);
  const text = await page.locator(".topFoot").textContent();
  ok(
    "the note's row offers one destination, the one the boundary covers",
    !/Timeline/i.test(text),
    text.trim(),
  );
  await page.close();
}

/* ── round 6: the second plane has two edges ─────────────────────── */
{
  const page = await open("?state=pressure");
  ok(
    "the group rule leads out instead of guillotining the row under it",
    await page.evaluate(() => {
      const rule = document.querySelector(".idxDay");
      return getComputedStyle(rule, "::before").backgroundImage.includes("gradient");
    }),
  );
  /* Walking with the keyboard can never park a row half under the rule. */
  await page.locator(".idxRow").first().focus();
  for (let i = 0; i < 9; i += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(70);
  }
  ok(
    "and the arrows never park a row under it",
    await page.evaluate(() => {
      const row = document.querySelector(".idxRow[data-cursor]");
      const rules = [...document.querySelectorAll(".idxDay")];
      if (!row) return false;
      const r = row.getBoundingClientRect();
      return rules.every((d) => {
        const b = d.getBoundingClientRect();
        return r.bottom <= b.top + 1 || r.top >= b.bottom - 1;
      });
    }),
  );
  await page.close();
}

/* ── round 6: the resting pile does not wear a keyboard cursor ───── */
{
  const page = await open();
  const wash = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--indigo-wash").trim());
  ok(
    "at rest the cursor is ink, not the colour of words about to cross",
    await page.evaluate((w) => {
      const row = document.querySelector(".idxRow[data-cursor]");
      if (!row) return true;
      const paint = getComputedStyle(row).backgroundColor;
      const probe = document.createElement("i");
      probe.style.backgroundColor = w;
      document.body.appendChild(probe);
      const indigo = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return paint !== indigo;
    }, wash),
  );
  await page.locator(".idxRow[data-cursor]").focus();
  await page.waitForTimeout(120);
  ok(
    "and it lights the moment the pile has the keyboard",
    await page.evaluate((w) => {
      const row = document.querySelector(".idxRow[data-cursor]");
      const paint = getComputedStyle(row).backgroundColor;
      const probe = document.createElement("i");
      probe.style.backgroundColor = w;
      document.body.appendChild(probe);
      const indigo = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return paint === indigo;
    }, wash),
  );
  /* And after a capture the emphasis is on the row that just arrived, not
     on the one the cursor happened to be holding by id. */
  await page.locator(".topField").fill("Check the chair covers arrived in the right ivory.");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(900);
  ok(
    "and after a keep it holds the words that just landed",
    (await page.locator(".idxRow[data-cursor] .idxText").textContent()).includes("chair covers"),
  );
  await page.close();
}

/* ── round 6: the undo strip never lands on a person's words ─────── */
{
  const page = await open();
  await page.locator(".topField").fill("Confirm the cake table goes by the window, not the door.");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(900);
  ok("the sheet declares the band spoken for", (await page.locator(".sheet[data-undo]").count()) === 1);
  await page.evaluate(() => {
    const idx = document.getElementById("index");
    idx.scrollTop = idx.scrollHeight;
  });
  await page.waitForTimeout(200);
  ok(
    "and at the foot of the pile the last row still ends above it",
    await page.evaluate(() => {
      const strip = document.querySelector(".undo");
      const rows = [...document.querySelectorAll(".idxRow")];
      const s = strip.getBoundingClientRect();
      return rows.every((r) => {
        const b = r.getBoundingClientRect();
        return b.bottom <= s.top + 1 || b.top >= s.bottom - 1;
      });
    }),
  );
  await page.close();
}

/* ── round 6: deferring is not deciding ──────────────────────────── */
{
  const page = await open("?state=review");
  const ofBefore = await page.locator(".handOf").textContent();
  const pendingBefore = await page.locator(".chip").count();
  await page.locator('[data-act="d-later"]').click();
  await page.waitForTimeout(320);
  ok("putting a card to the back does not advance the count", (await page.locator(".handOf").textContent()) === ofBefore, `${ofBefore} then ${await page.locator(".handOf").textContent()}`);
  ok("and it does not grow the denominator either", !(await page.locator(".handOf").textContent()).includes("of 9"));
  ok("the strip says what happened, and does not claim a decision", (await page.locator(".undo span").first().textContent()).includes("back"));
  ok(
    "and nothing on the card credits a decision nobody made",
    !(await page.locator(".deckNote").textContent()).includes("decided just now"),
  );
  ok("the head's count is unchanged", (await page.locator(".chip").count()) === pendingBefore);
  await page.close();
}

/* ── round 6: one count, one scope, one grammar ──────────────────── */
{
  const page = await open();
  const lede = await page.locator(".headNext span").textContent();
  const chip = await page.locator(".chip").textContent();
  ok("the head does not print the chip's phrase beside the chip", !lede.includes("still to decide"), `${lede} | ${chip}`);
  /* Round 6 asserted the scope was named where it is READ ALOUD. Round 8
     found the inversion that left behind: the name was right and the
     screen was ambiguous, so the pill read as the subject's count and
     the group below it said a different number. The visible text and
     the name now state the same scope in the same words. */
  /* Round 9 replaced the unscoped half. "8 still to decide in the
     notebook" named the room it was standing in, and was the loudest
     string in the product saying how far behind you are. Unscoped it is
     now a verb with its count, which cannot be read as the adjacent
     couple's figure the way a bare count could — so the scope wording is
     asserted where it does real work, on the scoped chip. */
  ok(
    "unscoped, the chip is the act it performs and carries its count",
    /^Go through \d+$/.test((await page.locator(".chip").textContent()).trim()),
    await page.locator(".chip").textContent(),
  );
  ok(
    "and its name says the same thing in the same words",
    /Go through the \d+ notes still to decide/.test(await page.locator(".chip").getAttribute("aria-label")),
    await page.locator(".chip").getAttribute("aria-label"),
  );
  {
    await page.locator(".headNext").click();
    await page.waitForTimeout(260);
    const scoped = (await page.locator('.chip[data-act="review"]').textContent()).trim();
    ok(
      "scoped, it names the subject it counts, on screen",
      /still to decide in /.test(scoped),
      scoped,
    );
    ok(
      "and its name says that in the same words too",
      (await page.locator('.chip[data-act="review"]').getAttribute("aria-label")).includes("still to decide in "),
      await page.locator('.chip[data-act="review"]').getAttribute("aria-label"),
    );
    await page.locator('[data-act="unscope"]').click();
    await page.waitForTimeout(220);
  }
  ok(
    "and no index group rule reproduces the head's label, date and count together",
    await page.evaluate(() => {
      const name = document.querySelector(".headName");
      const label = name ? name.textContent.trim() : "";
      return [...document.querySelectorAll(".idxDay")].every(
        (d) => !(d.textContent.includes(label) && /still to decide/i.test(d.textContent)),
      );
    }),
  );
  await page.close();
}
{
  const page = await open("?state=review");
  ok(
    "the hand's second count says what it counts",
    (await page.locator(".indexHead .cnt").textContent()).includes("behind this one"),
  );
  await page.close();
}

/* ── round 6: the product's own privacy words, nowhere invented ──── */
{
  for (const state of ["notebook", "nothing", "capture"]) {
    const page = await open(`?state=${state}`);
    const text = await page.evaluate(() => document.body.innerText);
    ok(`${state}: no privacy claim stronger than the product's own`, !/Nobody else can read/i.test(text));
    await page.close();
  }
  const page = await open();
  ok(
    "and the header chip carries the conditional in its accessible name",
    (await page.locator('[data-act="privacy"]').getAttribute("aria-label")).includes("until you send something on"),
  );
  await page.close();
}

/* ── round 6: reduced motion holds the arrival, it does not delete it ── */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(FILE);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(280);
  await page.locator(".topField").fill("Ask about the corkage on the second bar.");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(220);
  ok("reduced motion still marks where the words went", (await page.locator(".idxRow[data-arriving]").count()) === 1);
  ok(
    "and brings that row into view",
    await page.evaluate(() => {
      const row = document.querySelector(".idxRow[data-arriving]");
      const idx = document.getElementById("index");
      const r = row.getBoundingClientRect();
      const b = idx.getBoundingClientRect();
      return r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
    }),
  );
  ok(
    "and nothing is animated to get there",
    await page.evaluate(() => {
      const row = document.querySelector(".idxRow[data-arriving]");
      const d = getComputedStyle(row).animationDuration;
      return d === "0s" || d === "";
    }),
  );
  await page.waitForTimeout(800);
  ok("and the mark is released, not left on", (await page.locator(".idxRow[data-arriving]").count()) === 0);
  await page.close();
}

/* ── round 6: the head prints on a phone ─────────────────────────── */
{
  for (const width of [360, 390, 414]) {
    const page = await open("", { width, height: 844 });
    ok(
      `${width}: what the house is facing prints in the head`,
      await page.evaluate(() => {
        const el = document.querySelector(".headNext");
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 60 && r.height > 8;
      }),
    );
    ok(
      `${width}: and nothing in the head is laid out past the sheet's edge`,
      await page.evaluate(() => {
        const sheet = document.querySelector(".sheet").getBoundingClientRect();
        return [...document.querySelectorAll(".head *")].every((n) => {
          const r = n.getBoundingClientRect();
          return r.width === 0 || (r.right <= sheet.right + 1 && r.left >= sheet.left - 1);
        });
      }),
    );
    await page.close();
  }
}

/* ── round 6: the filing popup answers a keyboard ────────────────── */
{
  const page = await open();
  await page.locator('[data-act="filing"]').click();
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(140);
  ok(
    "the arrows walk the options, not the pile behind them",
    await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("role") === "option"),
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Home");
  await page.waitForTimeout(140);
  ok(
    "and Home reaches the first of them",
    await page.evaluate(() => {
      const opts = [...document.querySelectorAll('.pickerPop [role="option"]')];
      return opts[0] === document.activeElement;
    }),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("escape closes it", (await page.locator(".pickerPop").count()) === 0);
  ok(
    "and hands the keyboard back to the control that opened it",
    await page.evaluate(() => document.activeElement && document.activeElement.dataset.act === "filing"),
  );
  await page.locator('[data-act="filing"]').click();
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(140);
  const chosen = await page.evaluate(() => document.activeElement.textContent.trim());
  await page.keyboard.press("Enter");
  await page.waitForTimeout(260);
  ok("and Enter commits the one it is on", (await page.locator(".filingBtn").first().textContent()).includes(chosen.split("No date")[0].trim().slice(0, 10)), chosen);
  await page.close();
}

/* ── round 6: the search field drives the selection it paints ────── */
{
  const page = await open();
  /* The caret starts in the capture field, which is where it belongs, so
     search is opened by its own control rather than by a slash that would
     land in somebody's sentence. */
  await page.locator('[data-act="search"]').first().click();
  await page.waitForTimeout(260);
  await page.keyboard.type("the");
  await page.waitForTimeout(320);
  const first = await page.locator(".idxRow[data-cursor] .idxText").textContent();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(220);
  const second = await page.locator(".idxRow[data-cursor] .idxText").textContent();
  ok("the arrows walk the drawn selection from inside the field", first !== second, `${first.slice(0, 24)} then ${second.slice(0, 24)}`);
  ok(
    "and the caret is still in the field",
    await page.evaluate(() => document.activeElement && document.activeElement.id === "q"),
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  ok("and enter opens the row it is on", (await page.locator(".readBody").count()) === 1);
  await page.close();
}

/* ── round 6: picking has a keyboard route ───────────────────────── */
{
  const page = await open();
  await page.locator(".idxRow").nth(2).click();
  await page.waitForTimeout(260);
  ok(
    "the note is a tab stop with a name that says what it is for",
    (await page.locator(".readBody").getAttribute("aria-label")).toLowerCase().includes("pick the words"),
  );
  /* This note may carry a pick made earlier, which is drawn at rest. What
     is graded is the change the keyboard makes, and that it can be given
     back to exactly where it started. */
  const atRest = await page.locator('[data-act="peel"]').textContent();
  const restPick = (await markCount(page))
    ? await markText(page)
    : "";
  await page.locator(".readBody").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(240);
  ok("the arrows pick a whole sentence", (await markCount(page)) === 1);
  const one = await markText(page);
  ok("and it is announced in words, not in a colour", /words picked/.test(await said(page)), await said(page));
  await page.keyboard.press("Shift+ArrowRight");
  await page.waitForTimeout(240);
  const two = await markText(page);
  ok("shift extends it to the next one", two.length > one.length, `${one.length} then ${two.length}`);
  ok(
    "and the primary reads off the same pick",
    (await page.locator('[data-act="peel"]').textContent()).includes("Send to Tasks"),
  );
  await page.keyboard.press(" ");
  await page.waitForTimeout(240);
  const after = (await markCount(page))
    ? await markText(page)
    : "";
  /* ROUND 11 INVERTED THESE.
     They asserted that Space gives a restored mark BACK — which is what
     the old standingPick() did, falling through to the fixture's
     note.pick on every read. The panel measured that as the defect it
     is: the product announced "Nothing picked." while fourteen words
     stayed drawn in indigo, the bar still read "14 words picked. Send to
     Tasks will use exactly these", and the primary stayed armed — under
     a heading whose whole promise is that only picked words cross. A
     mark nobody made must be releasable, and releasing it must stick. */
  ok("space releases the mark", after === "", `"${restPick}" then "${after}"`);
  ok(
    "and it stays released rather than being restored by the next repaint",
    await (async () => {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(240);
      await page.locator(".idxRow").nth(2).click();
      await page.waitForTimeout(300);
      return (await markCount(page)) === 0;
    })(),
  );
  ok(
    "and the primary stops claiming there is something to send",
    !(await page.locator('[data-act="peel"]').textContent()).includes("Send to Tasks"),
    await page.locator('[data-act="peel"]').textContent(),
  );
  ok(
    "a restored mark says it was picked before, not just that it is picked",
    atRest.includes("Send to Tasks"),
    atRest,
  );
  await page.close();
}

/* ── round 7: the words go through a gate as strict as the pixels ── */
{
  /* Seven rounds governed colour, weight, contrast, radii, motion, the
     type ramp and both ladders. Nothing governed the lexicon, and every
     copy finding this programme has produced came out of that gap: two
     verbs for one act, three grammars for one state, a sentence that
     disagrees with its own number. */
  const BANNED = [
    [/waiting on a decision/i, "one state, one noun: still to decide"],
    [/\bKept\. \d+ notes/, "capture saves; the hand keeps"],
    [/Nobody else can read/i, "no privacy claim stronger than the product's own"],
    [/direction [ABC]|hybrid|specimen room|artboard/i, "no lab vocabulary in product chrome"],
    /* Round 8. The persona is a venue manager, and three of her fourteen
       notes were a software founder's product backlog — onboarding
       teachers, launch pricing, a lecturer — with two of the four groups
       in the resting frame existing to carry them. A whitelist of venue
       words fails on Aoife, northlight and the Hendersons, so this is a
       blocklist of the vendor lexicon instead. "lecturer" is deliberately not in it: the
       course note stays, because a venue manager taking a cash-flow
       course is her own life and not a vendor's backlog, and it is the
       one note showing the notebook holds more than events. */
    [
      /\b(teacher onboarding|launch pricing|annual option|discount code|sign-?up|classroom)\b/i,
      "no vendor vocabulary in the demo notebook",
    ],
    /* Round 8. "Crossed" is the founder's architecture word for the
       sealed edge and belongs in the source comments. notes-copy.ts
       never says it, and the master said it twelve times in visible
       text and accessible names — one promise in three grammars across
       three screens. */
    [/\bcross(ed|es|ing)?\b/i, "the crossing verb never reaches a visible string"],
  ];
  for (const state of ["notebook", "capture", "review", "search", "seam", "readback", "voice", "pressure", "nothing", "not-yet"]) {
    const page = await open(`?state=${state}`);
    const text = await page.evaluate(() => {
      const names = [...document.querySelectorAll("[aria-label]")].map((n) => n.getAttribute("aria-label"));
      return `${document.body.innerText}\n${names.join("\n")}`;
    });
    for (const [pattern, why] of BANNED) {
      ok(`${state}: ${why}`, !pattern.test(text), (text.match(pattern) || [""])[0]);
    }
    await page.close();
  }
  /* And the spoken half, which no rendered-text check can see. */
  const page = await open();
  await page.locator(".topField").fill("Ring the florist about the second arch.");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(800);
  const heard = await said(page);
  ok("capture says it saved, and the state noun is the one the pile uses", /^Saved\./.test(heard) && /still to decide/.test(heard), heard);
  await page.close();
}

/* ── round 7: a sentence agrees with its own number ──────────────── */
{
  const page = await open();
  await page.locator('[data-act="search"]').first().click();
  await page.waitForTimeout(240);
  await page.keyboard.type("ballroom");
  await page.waitForTimeout(360);
  const one = await page.locator(".indexHead .cnt").textContent();
  const rows = await page.locator(".idxRow").count();
  ok("at one result the sentence is singular", rows !== 1 || (/\bhas\b/.test(one) && /\bin it\b/.test(one)), `${rows} rows: ${one}`);
  await page.locator("#q").fill("");
  await page.keyboard.type("the");
  await page.waitForTimeout(360);
  const many = await page.locator(".indexHead .cnt").textContent();
  ok("at more than one it is plural", /\bhave\b/.test(many) && /in them\b/.test(many), many);
  await page.close();
}

/* ── round 7: search says which row and why it matched ───────────── */
{
  const page = await open();
  await page.locator('[data-act="search"]').first().click();
  await page.waitForTimeout(240);
  await page.keyboard.type("ballroom");
  await page.waitForTimeout(360);
  ok(
    "every result shows the words that matched",
    await page.evaluate(() =>
      [...document.querySelectorAll(".idxRow .idxText")].every((t) => /ballroom/i.test(t.textContent))),
  );
  ok(
    "exactly one row is marked, and it is the cursor",
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".idxRow")];
      const cursor = rows.find((r) => r.hasAttribute("data-cursor"));
      if (!cursor) return false;
      const lit = getComputedStyle(cursor).backgroundColor;
      return rows.filter((r) => r !== cursor).every((r) => getComputedStyle(r).backgroundColor !== lit);
    }),
    await page.evaluate(() => {
      const c = document.querySelector(".idxRow[data-cursor]");
      return c ? getComputedStyle(c).backgroundColor : "no cursor";
    }),
  );
  await page.close();
}

/* ── round 7: the ledger records the crossing ────────────────────── */
{
  const page = await open("?state=seam");
  const before = await page.locator(".indexHead .cnt").textContent();
  const rowsBefore = await page.locator(".idxRow").count();
  await page.locator('.peel [data-act="send"]').click();
  await page.waitForTimeout(420);
  ok("what crossed appears in the ledger of what has crossed", (await page.locator(".idxRow").count()) === rowsBefore + 1);
  ok("and the count resolves from the same list", (await page.locator(".indexHead .cnt").textContent()) !== before);
  ok(
    "and the ledger prints the words that crossed, not the note",
    await page.evaluate(() => {
      const first = document.querySelector(".idxRow .idxText");
      return first.textContent.trim().length > 3;
    }),
  );
  /* Round 8. The lane assertion above only ever ran on the RESTING
     ledger, so the one row a person is actually looking for — the row
     she just made — was the only row never checked, and it carried a
     project name into a column of Tasks lanes. Re-run after the send,
     and assert no tag is a workspace, so the two kinds of fact can
     never swap places again. */
  {
    const after = await page.locator(".indexWrap .idxTag").allTextContents();
    ok(
      "every row STILL carries a lane after the send, the new one included",
      after.every((t) => ["To do", "In progress", "Waiting"].includes(t.trim())),
      after.join(" · "),
    );
    ok(
      "and no row's lane slot holds a project name",
      await page.evaluate(() => {
        const shops = new Set((window.N ? window.N.notes : []).map((n) => n.workspace).filter(Boolean));
        return [...document.querySelectorAll(".indexWrap .idxTag")].every((t) => !shops.has(t.textContent.trim()));
      }),
      after.join(" · "),
    );
  }
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(360);
  ok("taking it back removes the row again", (await page.locator(".idxRow").count()) === rowsBefore);
  ok("and says where you now are, not what was reversed", /Nothing went to Tasks/.test(await said(page)), await said(page));
  await page.close();
}

/* ── round 7: deferring does not lower what is left ──────────────── */
{
  const page = await open("?state=review");
  const drawn = () => page.locator(".deckNote [data-left]").textContent();
  const before = await drawn();
  const behindBefore = await page.locator(".indexHead .cnt").textContent();
  await page.locator('[data-act="d-later"]').click();
  await page.waitForTimeout(340);
  ok("the drawn count does not fall when nothing was decided", (await drawn()) === before, `${before} then ${await drawn()}`);
  ok("and neither does the pile's own count", (await page.locator(".indexHead .cnt").textContent()) === behindBefore);
  ok(
    "the drawn count, the rows below it and the spoken sentence name one number",
    await page.evaluate(() => {
      const left = parseInt(document.querySelector(".deckNote [data-left]").textContent, 10);
      const rows = document.querySelectorAll(".idxRow").length;
      return left === rows + 1;
    }),
  );
  ok("and the card put to the back says what it is", (await page.locator('.idxTag:text-is("Left for later")').count()) === 1);
  await page.close();
}

/* ── round 7: the hand hands over the keyboard ───────────────────── */
{
  const page = await open();
  await page.locator('.chip[data-act="review"]').click();
  await page.waitForTimeout(340);
  ok(
    "entering the queue lands the keyboard on the card",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("handBody")),
  );
  ok("and the announcement names the card, not only a count", /First, /.test(await said(page)), await said(page));
  await page.locator('[data-act="d-keep"]').click();
  await page.waitForTimeout(340);
  ok("and each decision names the one it dealt next", /Next, /.test(await said(page)), await said(page));
  await page.close();
}

/* ── round 7: the head is a control, and it scopes the notebook ──── */
{
  const page = await open();
  const allRows = await page.locator(".idxRow").count();
  await page.locator('[data-act="scope"]').click();
  await page.waitForTimeout(340);
  const scopedRows = await page.locator(".idxRow").count();
  ok("pressing what the house is facing narrows the pile to it", scopedRows > 0 && scopedRows < allRows, `${allRows} then ${scopedRows}`);
  ok("and the head offers the way back", (await page.locator('[data-act="unscope"]').count()) === 1);
  ok("and says what it is showing", /Showing Mara & Finn only/.test(await said(page)), await said(page));
  await page.locator('.chip[data-act="review"]').click();
  await page.waitForTimeout(340);
  ok(
    "and the queue is scoped to it too, so the room is this Saturday's work",
    await page.evaluate(() => {
      const of = document.querySelector(".handOf").textContent;
      return parseInt(of.split("of")[1], 10) <= 3;
    }),
    await page.locator(".handOf").textContent(),
  );
  await page.close();
}

/* ── round 7: a note can be written on a second visit ────────────── */
{
  const page = await open();
  await page.locator(".idxRow").nth(2).click();
  await page.waitForTimeout(280);
  const was = await page.locator(".readBody").textContent();
  await page.locator('[data-act="edit"]').click();
  await page.waitForTimeout(280);
  ok("the note becomes the same field the desk already is", (await page.locator("textarea.readBody").count()) === 1);
  ok(
    "and the caret is in it, after the words already there",
    await page.evaluate(() => {
      const f = document.querySelector("textarea.readBody");
      return document.activeElement === f && f.selectionStart === f.value.length;
    }),
  );
  await page.keyboard.type(" They said yes, from seven.");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(360);
  const now = await page.locator(".readBody").textContent();
  ok("saving keeps what was written", now.includes("They said yes, from seven"), now.slice(-40));
  ok("and it is the same note, not a second one", now.startsWith(was.slice(0, 24)));
  ok("and the desk says the note was edited", (await page.locator(".deskAside").textContent()).includes("edited"));
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(340);
  ok("and it can be put back", !(await page.locator(".readBody").textContent()).includes("They said yes"));
  ok("saying so in the state you are now in", /says what it said before/.test(await said(page)), await said(page));
  await page.close();
}

/* ── round 7: the card is one object across a queue of eight ─────── */
{
  const page = await open("?state=review");
  const frames = [];
  for (let i = 0; i < 4; i += 1) {
    frames.push(await page.evaluate(() => {
      const r = document.querySelector(".handTop").getBoundingClientRect();
      const b = document.querySelector(".handBody").getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width), body: Math.round(b.height) };
    }));
    await page.locator('[data-act="d-keep"]').click();
    await page.waitForTimeout(320);
  }
  ok("the card holds one width across the queue", new Set(frames.map((f) => f.width)).size === 1, JSON.stringify(frames.map((f) => f.width)));
  ok("and one left edge", new Set(frames.map((f) => f.left)).size === 1, JSON.stringify(frames.map((f) => f.left)));
  ok("and a person's words never get less than three lines", frames.every((f) => f.body >= 60), JSON.stringify(frames.map((f) => f.body)));
  await page.close();
}

/* ── round 7: the dictation floor is live ────────────────────────── */
{
  const page = await open();
  await page.locator('.verb[data-act="voice"]').first().click();
  await page.waitForTimeout(300);
  ok("the clock starts at nothing", (await page.locator(".darkTime").textContent()).trim() === "0:00", await page.locator(".darkTime").textContent());
  const heights = await page.evaluate(() => [...document.querySelectorAll(".darkWave i")].map((i) => i.style.height));
  await page.waitForTimeout(1400);
  ok("the clock runs", (await page.locator(".darkTime").textContent()) !== "0:00", await page.locator(".darkTime").textContent());
  const after = await page.evaluate(() => [...document.querySelectorAll(".darkWave i")].map((i) => i.style.height));
  ok("and the wave hears you", heights.join() !== after.join());
  ok(
    "and the words already spoken were not rebuilt underneath",
    (await page.locator(".darkSaid").count()) === 1,
  );
  await page.close();
}

/* ── round 8: the commit row holds only things you can press ────── */
{
  const page = await open("?state=readback");
  ok(
    "the row where the commit and the destroy live holds no prose",
    await page.evaluate(() =>
      [...document.querySelectorAll(".topFoot")].every((f) =>
        [...f.children].every((c) => c.tagName === "BUTTON" || c.classList.contains("spacer")),
      ),
    ),
    await page.evaluate(() =>
      [...document.querySelectorAll(".topFoot")]
        .flatMap((f) => [...f.children])
        .filter((c) => c.tagName !== "BUTTON" && !c.classList.contains("spacer"))
        .map((c) => c.tagName + "." + c.className)
        .join(" · "),
    ),
  );
  ok(
    "and the hint sits on the fields it describes",
    (await page.locator(".saidHint").count()) === 1,
  );
  ok(
    "the hint and the primary agree on how many pieces there are",
    await page.evaluate(() => {
      const hint = document.querySelector(".saidHint").textContent;
      const primary = document.querySelector('[data-act="keep-both"]').textContent;
      const n = document.querySelectorAll(".pieceField").length;
      const tail = n === 1 ? "it" : n === 2 ? "both" : "them";
      return hint.includes("keep " + tail) && primary.includes("Keep " + tail);
    }),
  );
  ok(
    "and Add another actually adds another",
    await (async () => {
      const before = await page.locator(".pieceField").count();
      await page.locator('[data-act="add-piece"]').click();
      await page.waitForTimeout(300);
      return (await page.locator(".pieceField").count()) === before + 1;
    })(),
  );
  await page.close();
}

/* ── round 7: nothing in the product is unreversible except delete ── */
{
  const page = await open("?state=readback");
  await page.locator('[data-act="discard-speech"]').click();
  await page.waitForTimeout(340);
  ok("discarding what you said can be taken back", (await page.locator(".undo").count()) === 1);
  /* Round 8: one guarantee, one carrier. The window was stated three
     ways — "for 30s" in the strip, "thirty seconds" on the delete card,
     "Undo for 30 seconds" in this announcement. The strip owns it and
     counts it down; the announcement states what happened. */
  ok("and says what happened, without a second grammar for the window", /Discarded\. Nothing was kept\./.test(await said(page)), await said(page));
  ok("the strip carries the window", /for \d+ seconds/.test(await page.locator(".undoFor").textContent()), await page.locator(".undoFor").textContent());
  ok(
    "and the window actually moves",
    await (async () => {
      const first = await page.locator(".undoFor").textContent();
      await page.waitForTimeout(2100);
      const second = await page.locator(".undoFor").textContent();
      return first !== second;
    })(),
  );
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(340);
  ok("and the pieces come back", (await page.locator(".pieceField").count()) === 2);
  await page.close();
}

/* ── round 7: the undo strip never crosses a row's words ─────────── */
{
  for (const width of [390, 768, 1440]) {
    const page = await open("", { width, height: width === 390 ? 844 : 960 });
    if (width === 390) await page.locator(".phoneField").fill("Confirm the second bar has its own float.");
    else await page.locator(".topField").fill("Confirm the second bar has its own float.");
    await page.keyboard.press("Control+Enter");
    await page.waitForTimeout(900);
    for (const at of [0, 0.5, 1]) {
      await page.evaluate((f) => {
        const idx = document.getElementById("index");
        idx.scrollTop = (idx.scrollHeight - idx.clientHeight) * f;
      }, at);
      await page.waitForTimeout(180);
      ok(
        `${width} @${at}: no row and no group rule passes under the strip`,
        await page.evaluate(() => {
          const strip = document.querySelector(".undo");
          if (!strip) return true;
          const s = strip.getBoundingClientRect();
          /* Clipped to the scroller, because a row scrolled out of view
             still reports a rect below the box it lives in — what is
             asked is whether anything a person can SEE passes under the
             strip. */
          const box = document.getElementById("index").getBoundingClientRect();
          return [...document.querySelectorAll(".idxRow, .idxDay")].every((n) => {
            const r = n.getBoundingClientRect();
            const top = Math.max(r.top, box.top);
            const bottom = Math.min(r.bottom, box.bottom);
            if (bottom <= top) return true;
            return bottom <= s.top + 1 || top >= s.bottom - 1 || r.right <= s.left || r.left >= s.right;
          });
        }),
      );
    }
    await page.close();
  }
}

/* ── round 7: the phone reserves what the dock covers ────────────── */
{
  const page = await open("", { width: 390, height: 844 });
  await page.evaluate(() => {
    const idx = document.getElementById("index");
    idx.scrollTop = idx.scrollHeight;
  });
  await page.waitForTimeout(240);
  ok(
    "the last row of the notebook is not under the dock",
    await page.evaluate(() => {
      const dock = document.querySelector(".dock").getBoundingClientRect();
      const rows = [...document.querySelectorAll(".idxRow")];
      const last = rows[rows.length - 1].getBoundingClientRect();
      return last.bottom <= dock.top + 1;
    }),
  );
  ok(
    "and a person's own writing is the same size here as everywhere else",
    await page.evaluate(() => {
      const f = getComputedStyle(document.querySelector(".phoneField"));
      return parseFloat(f.fontSize) === 17;
    }),
  );
  await page.close();
}

/* ── round 7: the ends of a long note are one key away ───────────── */
{
  const page = await open("?state=pressure");
  ok("the long note renders at all", (await page.locator(".readLong").count()) === 1);
  await page.locator(".readBody").focus();
  await page.keyboard.press("End");
  await page.waitForTimeout(260);
  const last = await markText(page);
  await page.keyboard.press("Home");
  await page.waitForTimeout(260);
  const first = await markText(page);
  ok("end reaches its last sentence and home its first", last !== first && first.length > 3, `"${first.slice(0, 24)}" / "${last.slice(0, 24)}"`);
  await page.close();
}


/* ══════════════════════════════════════════════════════════════════
   ROUND 9
   ══════════════════════════════════════════════════════════════════ */

/* ── the note is an instrument, on every device ──────────────────── */
{
  const page = await open("?state=pressure");
  ok("the note is made of sentences a pointer can reach", (await page.locator(".readBody .sent").count()) > 1);
  ok(
    "and each one says it is pressable",
    await page.evaluate(() => getComputedStyle(document.querySelector(".readBody .sent")).cursor === "pointer"),
  );
  const before = await markText(page);
  await page.locator(".readBody .sent").nth(1).click();
  await page.waitForTimeout(320);
  const after = await markText(page);
  ok("pressing a sentence picks it", Boolean(after) && after !== before, `"${before}" then "${after}"`);
  await page.close();
}
{
  const page = await open("?state=notebook", { width: 390, height: 844, hasTouch: true, isMobile: true });
  await page.locator(".idxRow").nth(1).click();
  await page.waitForTimeout(420);
  ok("a phone reader gets the same instrument", (await page.locator(".phoneSheet .sent").count()) >= 1);
  const before = await markText(page, ".phoneSheet");
  await page.locator(".phoneSheet .sent").nth(1).click();
  await page.waitForTimeout(420);
  const after = await markText(page, ".phoneSheet");
  ok("and a tap picks a sentence, which is the only route a phone has", Boolean(after) && after !== before, `"${before}" then "${after}"`);
  await page.close();
}

/* ── only the exact words, which means whole ones ─────────────────── */
{
  const page = await open("?state=pressure");
  await page.evaluate(() => {
    const body = document.querySelector(".readBody");
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const n = walker.nextNode();
    const t = n.textContent;
    const a = Math.max(1, t.indexOf(" ", 8) - 3);
    const b = Math.max(a + 12, t.indexOf(" ", 40) - 2);
    const range = document.createRange();
    range.setStart(n, a);
    range.setEnd(n, Math.min(b, t.length - 1));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await page.waitForTimeout(420);
  const drawn = await markText(page);
  ok("a drag that starts and ends mid-word still picks whole words", drawn.length > 3, drawn);
  ok(
    "and both ends of it are whole words from the note",
    await page.evaluate((d) => {
      const body = document.querySelector(".readBody").textContent.replace(/\s+/g, " ");
      const at = body.indexOf(d);
      if (at < 0) return false;
      const before = at === 0 ? " " : body[at - 1];
      const after = at + d.length >= body.length ? " " : body[at + d.length];
      return /\s/.test(before) && /\s/.test(after);
    }, drawn),
    drawn,
  );
  await page.close();
}

/* ── the seam answers one question once ──────────────────────────── */
{
  const page = await open("?state=seam");
  ok(
    "the peel is paper, not a callout with a caret",
    await page.evaluate(() => getComputedStyle(document.querySelector(".peel"), "::before").content === "none"),
  );
  const subjectBefore = await page.locator('.deskAside [data-act="refile"]').textContent();
  await page.locator('[data-act="destination"]').click();
  await page.waitForTimeout(300);
  const seam = await page.evaluate(() => {
    const btn = document.querySelector('[data-act="destination"]').textContent.replace(/^To/, "").trim();
    const opts = [...document.querySelectorAll('.pickerPop [role="option"]')];
    const marked = opts
      .filter((o) => o.getAttribute("aria-selected") === "true")
      .map((o) => o.querySelector("span").textContent);
    return { btn, marked, inList: opts.some((o) => o.querySelector("span").textContent === btn) };
  });
  ok("the destination it shows is one of the options it offers", seam.inList, seam.btn);
  ok(
    "and exactly one option is marked, the one it shows",
    seam.marked.length === 1 && seam.marked[0] === seam.btn,
    JSON.stringify(seam),
  );
  await page.locator('.pickerPop [role="option"]').nth(2).click();
  await page.waitForTimeout(280);
  await page.locator('[data-act="cancel-peel"]').click();
  await page.waitForTimeout(380);
  const subjectAfter = await page.locator('.deskAside [data-act="refile"]').textContent();
  ok(
    "and choosing a destination never edits the note, which is what the seam promises out loud",
    subjectAfter === subjectBefore,
    `${subjectBefore} then ${subjectAfter}`,
  );
  await page.close();
}

/* ── the commit control is reachable by pointer ──────────────────── */
{
  for (const size of [
    { width: 1440, height: 960 },
    { width: 1440, height: 800 },
    { width: 1280, height: 800 },
  ]) {
    const page = await open("?state=seam", size);
    ok(
      `the send is not under the dock at ${size.width}x${size.height}`,
      await page.evaluate(() => {
        const send = document.querySelector('.peel [data-act="send"]');
        if (!send) return false;
        const r = send.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return Boolean(hit && hit.closest('[data-act="send"]'));
      }),
    );
    await page.close();
  }
}

/* ── the way forward from a pick, and the way out of a confirm ───── */
{
  const page = await open("?state=pressure");
  await page.locator(".readBody").focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  ok("Enter on a standing pick opens the seam", (await page.locator(".peel").count()) === 1);
  await page.close();
}
{
  const page = await open("?state=review");
  await page.locator('[data-act="d-delete"]').click();
  await page.waitForTimeout(320);
  ok(
    "the confirmation opens on the safe half",
    await page.evaluate(() => document.activeElement.dataset.act === "d-delete-no"),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(340);
  ok("escape cancels the confirmation rather than leaving the room", (await page.locator('[data-act="d-delete-yes"]').count()) === 0);
  ok("and it is still the room it was", (await page.locator(".hand").count()) === 1);
  await page.keyboard.press("l");
  await page.waitForTimeout(320);
  ok("and a later card never arrives already armed", (await page.locator('[data-act="d-delete-yes"]').count()) === 0);
  await page.close();
}

/* ── search says what it did ─────────────────────────────────────── */
{
  const page = await open("?state=search");
  const open0 = await said(page);
  await page.locator("#q").fill("");
  await page.keyboard.type("florist", { delay: 18 });
  await page.waitForTimeout(900);
  const hit = await said(page);
  ok("filtering says how many it found", hit !== open0 && /notes? ha(s|ve)/.test(hit), hit.slice(0, 80));
  await page.locator("#q").fill("");
  await page.keyboard.type("zzzqqwob", { delay: 18 });
  await page.waitForTimeout(900);
  const miss = await said(page);
  ok(
    "and the way out of a dead end is spoken, not only drawn",
    /No note says/.test(miss) && /Back to your notes/.test(miss),
    miss.slice(0, 110),
  );
  await page.close();
}

/* ── the commit control does not move while you type ─────────────── */
{
  const page = await open();
  await page.locator(".topField").click();
  await page.keyboard.type("Ring the marquee company about the side panels", { delay: 22 });
  await page.waitForTimeout(760);
  const typed = await page.evaluate(() => {
    const b = document.querySelector('.topFoot [data-act="keep"]');
    return {
      right: Math.round(b.getBoundingClientRect().right),
      kids: [...b.parentNode.children].map((c) => c.className.split(" ")[0]).join("|"),
    };
  });
  await page.close();
  const t2 = await open("?state=capture");
  const tmpl = await t2.evaluate(() => {
    const b = document.querySelector('.topFoot [data-act="keep"]');
    return {
      right: Math.round(b.getBoundingClientRect().right),
      kids: [...b.parentNode.children].map((c) => c.className.split(" ")[0]).join("|"),
    };
  });
  ok("the foot a typist sees is the foot the template draws", typed.kids === tmpl.kids, `${typed.kids} vs ${tmpl.kids}`);
  ok("and the commit control is in the same place in both", Math.abs(typed.right - tmpl.right) < 2, `${typed.right} vs ${tmpl.right}`);
  await t2.close();
}

/* ── the lede budget holds on the notes actually shipped ─────────── */
{
  for (const room of ["?state=notebook", "?state=pressure"]) {
    const page = await open(room);
    ok(
      `${room}: no rendered row spends the lede weight past its budget`,
      await page.evaluate(() => [...document.querySelectorAll(".idxRow .idxText b")].every((n) => n.textContent.trim().length <= 48)),
    );
    ok(
      `${room}: and no note is set entirely in the lede weight`,
      await page.evaluate(() =>
        [...document.querySelectorAll(".idxRow .idxText")].every((t) => {
          const b = t.querySelector("b");
          return !b || b.textContent.trim().length < t.textContent.trim().length * 0.8;
        }),
      ),
    );
    await page.close();
  }
}


/* ══════════════════════════════════════════════════════════════════
   ROUND 10
   ══════════════════════════════════════════════════════════════════ */

/* ── the phone can actually reach the control that keeps the note ── */
{
  /* The Save control had nine live pixels of thirty-six at 360: the
     suite row was painted over it, a real tap at the white check left
     the field full and said nothing, and the thought was silently not
     captured. getBoundingClientRect saw 36x44 the whole time, which is
     why the audit's touch pass could not see it either. This asserts
     the composited hit area, not the box. */
  for (const width of [360, 375, 390, 414, 430]) {
    for (const len of [1, 100, 3999]) {
      const page = await open("", { width, height: 844 });
      await page.evaluate((n) => {
        const f = document.querySelector(".phoneField");
        f.value = "x".repeat(n);
        f.dispatchEvent(new Event("input", { bubbles: true }));
      }, len);
      await page.waitForTimeout(620);
      const hit = await page.evaluate(() => {
        const k = document.querySelector('.dock [data-act="keep"]');
        if (!k) return { absent: true };
        const kb = k.getBoundingClientRect();
        const db = document.querySelector(".dock").getBoundingClientRect();
        const cy = Math.round(kb.top + kb.height / 2);
        const cx = Math.round(kb.left + kb.width / 2);
        let run = 0;
        for (let x = Math.ceil(kb.left); x <= Math.floor(kb.right); x += 1) {
          const el = document.elementFromPoint(x, cy);
          if (el && el.closest('[data-act="keep"]')) run += 1;
        }
        let down = 0;
        for (let y = Math.ceil(kb.top); y <= Math.floor(kb.bottom); y += 1) {
          const el = document.elementFromPoint(cx, y);
          if (el && el.closest('[data-act="keep"]')) down += 1;
        }
        return {
          across: run,
          downward: down,
          w: Math.round(kb.width),
          inside: kb.left >= db.left - 1 && kb.right <= db.right + 1,
        };
      });
      ok(
        `${width} @${len} chars: every drawn pixel of the commit is the commit`,
        !hit.absent && hit.across >= hit.w - 1,
        `${hit.across}/${hit.w} live`,
      );
      ok(`${width} @${len} chars: and it sits inside the dock`, !hit.absent && hit.inside);
      await page.close();
    }
  }
}
{
  /* And the gesture itself, with a real finger rather than a click. */
  for (const width of [360, 390, 430]) {
    const page = await open("", { width, height: 844 });
    await page.locator(".phoneField").click();
    await page.keyboard.type("Ring the marquee company about the side panels", { delay: 0 });
    await page.waitForTimeout(620);
    const box = await page.locator('.dock [data-act="keep"]').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(620);
    ok(
      `${width}: a real tap at the visual centre of Save keeps the note`,
      (await page.locator(".phoneField").inputValue()) === "",
      await page.locator(".phoneField").inputValue(),
    );
    ok(`${width}: and it says so`, /Saved\./.test(await said(page)), (await said(page)).slice(0, 40));
    await page.close();
  }
}
{
  /* The inverse, because raising the commit's stacking without removing
     the overflow would have traded a silent non-save for a silent
     wrong-save, which is worse. Every other control in the foot must
     answer its own tap. */
  const page = await open("", { width: 360, height: 844 });
  const wrong = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(".dock .railTile, .dock .dockAvatar, .dock .dockGlyph")) {
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2));
      if (!hit || !el.contains(hit)) {
        if (hit && hit.closest('[data-act="keep"]')) out.push(el.getAttribute("aria-label") || el.className);
      }
    }
    return out;
  });
  ok("at 360 no other dock control's own centre reaches the commit instead", wrong.length === 0, wrong.join(" · "));
  await page.close();
}

/* ── the dock does not change height while somebody is typing ────── */
{
  /* The counter used to be printed twice, in two grammars, and widened
     the foot mid-draft. paint() measures the dock into --dock-h, which
     drives the pile's reserve, so a dock that grows as the count crosses
     a threshold heaves the pile under the person's thumb. */
  for (const width of [360, 390]) {
    const page = await open("", { width, height: 844 });
    const heights = [];
    for (const n of [3599, 3600, 3601]) {
      await page.evaluate((len) => {
        const f = document.querySelector(".phoneField");
        f.value = "x".repeat(len);
        f.dispatchEvent(new Event("input", { bubbles: true }));
      }, n);
      await page.waitForTimeout(620);
      heights.push(await page.evaluate(() => Math.round(document.querySelector(".dock").getBoundingClientRect().height)));
    }
    ok(
      `${width}: the counter appearing does not move the dock`,
      heights[0] === heights[1] && heights[1] === heights[2],
      heights.join("/"),
    );
    await page.close();
  }
}
{
  /* One number, once. It was printed as a bare aria-hidden count in the
     verbs row AND as "n / 4000" beside the commit. */
  const page = await open("", { width: 390, height: 844 });
  await page.locator(".phoneField").fill("Confirm the second bar has its own float.");
  await page.waitForTimeout(620);
  ok("the phone prints the draft length once, or not at all", (await page.locator(".dockCount").count()) <= 1);
  await page.close();
}


/* ══════════════════════════════════════════════════════════════════
   ROUND 11
   ══════════════════════════════════════════════════════════════════ */

/* ── every room exists on a phone ────────────────────────────────── */
{
  /* Only `notebook` had a phone branch, so every other state rendered
     into .desk, which is display:none under 720px. A real tap on the
     head chip — the product's own primary call to action — entered a
     room with six invisible-but-focusable controls, no card, and no way
     back. Dictation was worse: the ink floor closed into a white sheet
     that does not exist on a phone, and the words a person had just
     spoken were nowhere. */
  for (const width of [360, 390]) {
    for (const state of ["review", "readback"]) {
      const page = await open(`?state=${state}`, { width, height: 844 });
      const room = await page.evaluate(() => {
        const dlg = document.querySelector(".phoneSheet, .dark");
        if (!dlg) return { none: true };
        const buttons = [...dlg.querySelectorAll("button")];
        const words = dlg.querySelector(".handBody, .pieceField");
        return {
          kind: dlg.className.split(" ")[0],
          controls: buttons.length,
          tooSmall: buttons.filter((el) => el.getBoundingClientRect().height < 44).length,
          wordsVisible: words ? words.getBoundingClientRect().height > 0 : false,
          exit: buttons.some((el) => /notebook|discard-speech/.test(el.dataset.act || "")),
        };
      });
      ok(`${width} ${state}: the room renders at all`, !room.none, JSON.stringify(room));
      ok(`${width} ${state}: and its words are on screen`, room.wordsVisible === true);
      ok(`${width} ${state}: every control in it takes a finger`, room.tooSmall === 0, `${room.tooSmall} under 44px`);
      ok(`${width} ${state}: and there is a visible way out, not just Escape`, room.exit === true);
      const blind = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll("button, [tabindex]")) {
          if (el.tabIndex < 0) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) out.push(el.dataset.act || el.className);
        }
        return out;
      });
      ok(`${width} ${state}: nothing focusable is drawn at nothing`, blind.length === 0, blind.slice(0, 4).join(" · "));
      await page.close();
    }
  }
}
{
  /* The way out has to work by finger, and land where the next thought
     goes. */
  const page = await open("?state=review", { width: 390, height: 844 });
  const box = await page.locator('.phoneSheet [data-act="notebook"]').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(620);
  ok("a real tap on the way out closes the phone hand", (await page.locator(".phoneSheet").count()) === 0);
  ok(
    "and the caret is where the next thought goes",
    await page.evaluate(() => document.activeElement.classList.contains("phoneField")),
  );
  await page.close();
}
{
  /* Keys pressed inside the dialog must not drive the plane behind it.
     hand-arrows-drive-the-index-behind is on the closed list and this is
     a new surface for it. */
  const page = await open("?state=review", { width: 390, height: 844 });
  const before = await page.evaluate(() => ({
    top: document.getElementById("index")?.scrollTop ?? null,
    cursor: document.querySelector(".idxRow[data-cursor]")?.dataset.id ?? null,
  }));
  await page.locator(".handBody").focus();
  for (const key of ["ArrowDown", "ArrowUp", "j"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(140);
  }
  const after = await page.evaluate(() => ({
    top: document.getElementById("index")?.scrollTop ?? null,
    cursor: document.querySelector(".idxRow[data-cursor]")?.dataset.id ?? null,
  }));
  ok(
    "navigation keys inside the phone hand leave the index alone",
    before.top === after.top && before.cursor === after.cursor,
    `${JSON.stringify(before)} then ${JSON.stringify(after)}`,
  );
  await page.close();
}

/* ── leaving a room gives the keyboard back ──────────────────────── */
{
  /* The file states the rule at keepDraft and set it in exactly one
     branch; every other exit dropped the caret on document.body, so the
     next sentence typed after leaving review, search, voice or the
     readback went nowhere. Typed, not filled — fill hides a caret at
     index zero. */
  const exits = [
    ["review", "Escape", null],
    ["voice", "Escape", null],
    ["readback", "Escape", null],
    ["readback", null, '[data-act="keep-both"]'],
    ["readback", null, '[data-act="discard-speech"]'],
  ];
  for (const [state, key, sel] of exits) {
    const page = await open(`?state=${state}`);
    if (key) await page.keyboard.press(key);
    else await page.locator(sel).click();
    await page.waitForTimeout(900);
    await page.keyboard.type("Order two more cases of tonic.", { delay: 0 });
    await page.waitForTimeout(320);
    ok(
      `leaving ${state} by ${key || sel.match(/"(.*)"/)[1]} leaves the caret where the next thought goes`,
      (await page.locator(".topField").inputValue()).includes("tonic"),
      await page.evaluate(() => (document.activeElement.className || document.activeElement.tagName).split(" ")[0]),
    );
    await page.close();
  }
}

/* ── a mark nobody made can be let go ────────────────────────────── */
{
  /* standingPick() fell through to the fixture's note.pick on every
     read, so three notes opened already marked under a heading whose
     whole promise is that only picked words cross — and the documented
     clear key could not touch it: the product announced "Nothing
     picked." while the words stayed drawn and the primary stayed armed. */
  const page = await open("?state=review");
  const armed = await page.evaluate(() => ({
    marked: document.querySelectorAll(".handBody .pick").length > 0,
    primary: document.querySelector('[data-act="d-task"]').textContent.trim(),
  }));
  ok("a restored mark is drawn at rest", armed.marked === true);
  await page.locator(".handBody").focus();
  await page.keyboard.press(" ");
  await page.waitForTimeout(420);
  const released = await page.evaluate(() => ({
    marked: document.querySelectorAll(".handBody .pick").length > 0,
    primary: document.querySelector('[data-act="d-task"]').textContent.trim(),
    said: document.querySelector(".sr")?.textContent || "",
  }));
  ok("and space lets it go", released.marked === false, JSON.stringify(released));
  ok(
    "and the primary stops claiming there is something to send",
    !released.primary.includes("Send to Tasks"),
    released.primary,
  );
  ok("and what is said matches what is drawn", /Nothing picked/.test(released.said), released.said.slice(0, 40));
  await page.close();
}

/* ── the sheet goes back to rest after the act it exists for ─────── */
{
  /* Round 10 seated the commit permanently and drove its visibility from
     wakeSheet(), which only ran from the input listener — so after a
     save the field was empty and the sheet still wore a filled Save with
     the privacy line gone, for the rest of the session. Three seats
     reported it independently. */
  const page = await open();
  const look = () =>
    page.evaluate(() => {
      const k = document.querySelector('.topFoot [data-act="keep"]');
      const r = document.querySelector(".topFoot .restPart");
      return {
        field: document.querySelector(".topField").value,
        keep: k ? getComputedStyle(k).visibility : "absent",
        promise: r ? getComputedStyle(r).visibility : "absent",
      };
    });
  await page.locator(".topField").click();
  await page.keyboard.type("Ring the florist about the second arch.", { delay: 0 });
  await page.waitForTimeout(620);
  const writing = await look();
  ok("while writing, the commit is offered", writing.keep === "visible" && writing.promise === "hidden");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(900);
  const rest = await look();
  ok(
    "and after the save the sheet is back at rest",
    rest.field === "" && rest.keep === "hidden" && rest.promise === "visible",
    JSON.stringify(rest),
  );
  await page.close();
}


/* ══════════════════════════════════════════════════════════════════
   ROUND 12
   ══════════════════════════════════════════════════════════════════ */

/* ── the peel sends the words that are marked ────────────────────── */
{
  /* With the peel open the note stayed a fully live-LOOKING pick surface
     — a tab stop, named as the instrument, still drawing the mark — and
     every pick route wrote a variable the peel does not read, so it
     announced "6 words picked. The task will use these words." and then
     sent the old ones. Two causes: pickTarget() returned null in a room
     that sets `peeling` without `openId`, and offerPick was never coupled
     at all. Recorded as fixed at round 9; it was not, because the patch
     threw before writing and nobody re-drove it. */
  const agree = async (page) =>
    page.evaluate(() => {
      const mark = [...document.querySelectorAll(".readBody .pick")].map((m) => m.textContent).join("").trim();
      const field = document.querySelector(".peelField").value.trim();
      const norm = (t) => t.toLowerCase().replace(/[.]$/, "");
      return { mark, field, agree: norm(mark) === norm(field) };
    });
  {
    const page = await open("?state=seam");
    await page.locator(".readBody .sent").nth(2).click();
    await page.waitForTimeout(480);
    const r = await agree(page);
    ok("pressing another sentence moves what the peel will send", r.agree, `${r.mark.slice(0, 30)} vs ${r.field.slice(0, 30)}`);
    ok(
      "and what it says matches what it will send",
      /words picked/.test(await said(page)) && /task will use these words/.test(await said(page)),
      (await said(page)).slice(0, 60),
    );
    await page.close();
  }
  {
    const page = await open("?state=seam");
    const box = await page.locator(".readBody .sent").first().boundingBox();
    await page.mouse.move(box.x + 20, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + 170, box.y + 8, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(560);
    const r = await agree(page);
    ok("a real drag moves what the peel will send too", r.agree, `${r.mark.slice(0, 30)} vs ${r.field.slice(0, 30)}`);
    /* And the guard that makes that safe: a caret move inside the wording
       field must not drive a repaint, or typing the task loses its
       place. */
    await page.locator(".peelField").click();
    await page.keyboard.type(" and tell Aoife", { delay: 10 });
    await page.waitForTimeout(420);
    ok(
      "and typing the wording keeps its caret",
      (await page.locator(".peelField").inputValue()).includes("Aoife") &&
        (await page.evaluate(() => document.activeElement.classList.contains("peelField"))),
    );
    await page.close();
  }
}

/* ── a drag keeps the keyboard it advertises ─────────────────────── */
{
  /* offerPick was the only pick route that never set refocus, so a real
     mouse pick left activeElement on BODY once the repaint landed — and
     then the arrow keys the margin advertises in the same sentence were
     inert, and Space, the documented release key, did nothing. */
  for (const [state, sel] of [
    ["pressure", ".readBody"],
    ["review", ".handBody"],
  ]) {
    const page = await open(`?state=${state}`);
    const box = await page.locator(`${sel} .sent`).first().boundingBox();
    await page.mouse.move(box.x + 30, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 8, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(520);
    ok(
      `${state}: a real drag leaves the keyboard on the note it picked in`,
      await page.evaluate((s) => document.activeElement.matches(s), sel),
      await page.evaluate(() => (document.activeElement.className || document.activeElement.tagName).split(" ")[0]),
    );
    const before = await markText(page, sel);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(320);
    ok(`${state}: so the arrows it advertises actually answer`, (await markText(page, sel)) !== before);
    await page.close();
  }
}
{
  /* The adjacent break that guard exists to prevent: offerPick also runs
     on release with no text, and arming the note body there would yank
     the caret out of whatever a click had just opened, 120ms later. */
  const page = await open("?state=pressure");
  await page.locator(".readBody .sent").first().click();
  await page.waitForTimeout(320);
  await page.locator('[data-act="search"]').first().click();
  await page.waitForTimeout(700);
  ok(
    "and releasing a pick by clicking away does not steal the caret",
    await page.evaluate(() => document.activeElement.id === "q"),
    await page.evaluate(() => document.activeElement.id || document.activeElement.className.split(" ")[0]),
  );
  await page.close();
}

/* ── a phone can let go of a mark it did not make ────────────────── */
{
  /* Round 11's strip told a phone to press space. A phone has no space
     key, so the string stated a falsehood; pressing the sentence that IS
     the pick now lets it go, on every device. */
  const page = await open("?state=review", { width: 390, height: 844 });
  const strip = await page.locator(".pickBar").textContent();
  ok("the strip names a gesture the device has", !/press space/i.test(strip) || /tap/i.test(strip), strip.trim().slice(0, 70));
  const mark = await page.locator(".handBody .pick").first().boundingBox();
  await page.touchscreen.tap(mark.x + mark.width / 2, mark.y + mark.height / 2);
  await page.waitForTimeout(520);
  ok("and a real tap on the mark lets it go", (await markCount(page, ".handBody")) === 0);
  ok("and says so", /Nothing picked/.test(await said(page)), (await said(page)).slice(0, 30));
  await page.close();
}

/* ── the ink room is legible ─────────────────────────────────────── */
{
  /* Round 11 moved the phone readback into the .dark overlay and left
     every line wearing its light-room tint: .saidHead, .saidHint and
     .pieceField all at contrast 1.00 against rgb(17,17,17). The person's
     own dictated words were invisible. The audit could not see it
     because its contrast pass only ran at 1440, where that room is a
     white sheet; it measures phone widths now, and this is the
     behavioural half. */
  const page = await open("?state=readback", { width: 390, height: 844 });
  const legible = await page.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const room = document.querySelector(".dark");
    if (!room) return { noRoom: true };
    const bg = getComputedStyle(room).backgroundColor;
    const out = {};
    for (const sel of [".saidHead", ".pieceField"]) {
      const el = room.querySelector(sel);
      if (!el) continue;
      const l1 = lum(getComputedStyle(el).color);
      const l2 = lum(bg);
      out[sel] = Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2));
    }
    return out;
  });
  ok("the dictated words are visible on the ink floor", (legible[".pieceField"] || 0) >= 4.5, JSON.stringify(legible));
  ok("and so is the line that explains them", (legible[".saidHead"] || 0) >= 4.5, JSON.stringify(legible));
  await page.close();
}

ok("no console errors anywhere", errors.length === 0, [...new Set(errors)].slice(0, 3).join(" · "));

await browser.close();
process.stdout.write(`\n${results.length} assertions · ${failures} failing\n`);
if (failures) process.exitCode = 1;
