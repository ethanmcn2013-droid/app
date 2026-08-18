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
  ok("the head states the outstanding decisions", /\d+ to decide/.test(head));
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
  ok("T turns the top card into a task", (await page.locator(".handOf").textContent()) !== ofBefore);
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
  await page.keyboard.press("/");
  await page.waitForTimeout(220);
  ok("slash opens search", (await page.locator("#q").count()) === 1);
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
  const wideCount = trims.length;
  await page.setViewportSize({ width: 820, height: 960 });
  await page.waitForTimeout(260);
  const narrow = await page.evaluate(
    () => [...document.querySelectorAll(".idxText")].filter((t) => t.textContent.trim() !== t.dataset.full).length,
  );
  ok("the trim re-runs on resize", narrow > wideCount, `${wideCount} wide, ${narrow} narrow`);
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
  ok("the loading frame says what is arriving", (await page.locator(".skelSay").textContent()).includes("Fourteen notes"));
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
  ok("the boundary sentence is on screen", (await page.locator(".peelWhy").textContent()).includes("nothing else from this note"));
  ok("and the note is promised to stay", (await page.locator(".stays").textContent()).includes("still yours to edit"));
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
  ok("the capsule and the dock are the same object", (await page.locator(".rail").boundingBox()).y > 700);
  ok("the desk stands down and the index takes the screen", await page.locator(".desk").isHidden());
  ok("capture moves into the dock", await page.locator(".phoneField").isVisible());
  ok("the account is not offered twice", await page.locator(".dockAvatar").isHidden());

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
    (await page.locator(".idxRow").count()) === 15 && (await page.locator("[data-settling]").count()) === 0,
  );
  await page.close();
}

ok("no console errors anywhere", errors.length === 0, [...new Set(errors)].slice(0, 3).join(" · "));

await browser.close();
process.stdout.write(`\n${results.length} assertions · ${failures} failing\n`);
if (failures) process.exitCode = 1;
