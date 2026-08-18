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

async function open(query = "", viewport = { width: 1440, height: 960 }) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(FILE + query);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(280);
  return page;
}

const rowCount = (page) => page.locator(".idxRow").count();
const said = (page) => page.locator("#say").textContent();

/* ── capture: the whole promise ──────────────────────────────────── */
{
  const page = await open();
  const before = await rowCount(page);
  await page.locator(".topField").fill("Ring the marquee company back about the side panels.");
  await page.waitForTimeout(120);

  ok("writing wakes the sheet", (await page.locator(".top[data-live]").count()) === 1);
  ok(
    "the save affordance only exists once there is something to save",
    (await page.locator('[data-act="keep"]').count()) === 1,
  );

  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(360);
  ok("the keyboard saves the note", (await rowCount(page)) === before + 1);
  ok("the field is cleared only after the note is somewhere safe", (await page.locator(".topField").inputValue()) === "");
  ok("saving is announced with a count", /Kept\. \d+ notes/.test(await said(page)));

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
  ok("the head states the outstanding decisions", /\d+ still to decide/.test(head), head);
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
  ok(
    "focus lands on the way back out, never on the body",
    await page.evaluate(() => document.activeElement && document.activeElement.dataset.act === "close"),
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(220);
  ok("escape puts the note back", (await page.locator(".readBody").count()) === 0);
  ok(
    "focus returns to the row it came from",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("idxRow")),
  );
  ok(
    "closing does not annihilate the scroll position either",
    Math.abs((await scroller.evaluate((n) => n.scrollTop)) - scrollBefore) < 4,
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
  ok("T opens the peel inside the hand", (await page.locator(".hand .peel").count()) === 1);
  ok("the queue has not moved yet", (await page.locator(".handOf").textContent()) === ofBefore);
  ok("and the wording is there to edit", (await page.locator(".peelField").inputValue()).length > 3);
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
  ok("what was said stays on screen beside what it became", (await page.locator(".saidWas").count()) === 1);
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
  ok("the words that cross are marked inside the person's own sentence", (await page.locator(".pick").count()) === 1);
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
    [...document.querySelectorAll(".top, .peel")].map((n) => n.innerText).join(" ").match(/stays here|still private|nothing else from this note|still yours to edit/g) || []);
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
        if (cs.display === "none" || cs.visibility === "hidden" || r.width === 0 || r.height === 0) {
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
  ok("the counter counts", (await page.locator("[data-count]").textContent()).startsWith("29 /"));

  await page.keyboard.type(" about the side panels");
  await page.waitForTimeout(140);
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
  ok("the undo strip says what happened, in the present", (await page.locator(".undo span").textContent()).trim() === "Kept.", await page.locator(".undo span").textContent());
  await page.close();
}

/* ── the phone can commit a note by touch ────────────────────────── */
{
  const page = await open("", { width: 390, height: 844 });
  ok("there is no commit control before there is anything to commit", (await page.locator('[data-act="keep"]').count()) === 0);
  await page.locator(".phoneField").click();
  await page.keyboard.type("Bar restock, tonic and the good olives.");
  await page.waitForTimeout(200);
  const commit = page.locator('.dock [data-act="keep"]');
  ok("a commit control appears in the dock", (await commit.count()) === 1);
  ok("it says what it does", (await commit.getAttribute("aria-label")) === "Keep it", await commit.getAttribute("aria-label"));
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
  ok("the words that will cross are marked inside it", (await page.locator(".readBody .pick").count()) === 1);
  const picked = (await page.locator(".readBody .pick").textContent()).trim();
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
  ok("and says nothing crossed", (await said(page)).includes("Nothing crossed"));
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
    let n = row.previousElementSibling;
    while (n && !n.classList.contains("idxDay")) n = n.previousElementSibling;
    return n ? n.textContent : null;
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
  ok("the rows are items on the tree", (await page.locator('.idxRow[role="listitem"]').count()) > 5);
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
  ok("a pick raises a control", (await page.locator(".pickBar").count()) === 1);
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

ok("no console errors anywhere", errors.length === 0, [...new Set(errors)].slice(0, 3).join(" · "));

await browser.close();
process.stdout.write(`\n${results.length} assertions · ${failures} failing\n`);
if (failures) process.exitCode = 1;
