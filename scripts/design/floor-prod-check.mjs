/* The measured seat for the shipped board.
 *
 *   node scripts/design/floor-prod-check.mjs [baseUrl]
 *
 * The lab gate (scripts/design/interaction-check.mjs) proves the design
 * master. This proves the thing that actually ships: the same board, over the
 * real store, inside the real app. Every assertion here exists because a
 * panel seat found the defect it guards, or because the founder's own
 * production data showed a case the demo fixture never produced.
 *
 * Exits non-zero on any failure.
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3510";
const results = [];
let failures = 0;

function ok(name, pass, detail) {
  results.push({ name, pass, detail });
  if (!pass) failures += 1;
}

const browser = await chromium.launch();
const errors = [];

async function open(path = "/app/tasks", viewport = { width: 1440, height: 960 }) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)));
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-board]", { timeout: 30_000 });
  await page.waitForTimeout(1200);
  return page;
}

const counts = (page) =>
  page.evaluate(() => {
    const out = {};
    document.querySelectorAll("[data-lane]").forEach((t) => {
      out[t.dataset.lane] = t.querySelectorAll("[data-id]").length;
    });
    return out;
  });

/* ── the shell is the design ──────────────────────────────────────── */
{
  const page = await open();
  const shell = await page.evaluate(() => {
    const has = (sel) => Boolean(document.querySelector(sel));
    const cls = (frag) => [...document.querySelectorAll("*")].some(
      (n) => typeof n.className === "string" && n.className.includes("floor-module") && n.className.includes(frag));
    return {
      spine: cls("rail"), sheet: has("[data-sheet]"), dock: cls("dock"), tabs: cls("seg"),
      oldBar: has('[class*="studio-bar"]'),
      sidebar: has('[class*="projects-sidebar"]'),
      lanes: getComputedStyle(document.querySelector("[data-board]")).gridTemplateColumns.split(" ").length,
      columns: document.querySelectorAll("[data-lane]").length,
    };
  });
  ok("one spine, one sheet, one dock", shell.spine && shell.sheet && shell.dock && shell.tabs, JSON.stringify(shell));
  ok("the old chrome is gone", !shell.oldBar && !shell.sidebar, JSON.stringify(shell));
  ok("the board draws exactly the workspace's columns", shell.lanes === shell.columns,
    `${shell.lanes} tracks for ${shell.columns} columns`);

  /* Every column says what it holds — the line is part of the composition,
     and a workspace that never edited a column has no description of its own. */
  const notes = await page.$$eval('[class*="trayNote"]', (n) => n.map((x) => x.textContent.trim()));
  ok("every column says what it is for", notes.length > 0 && notes.every(Boolean), JSON.stringify(notes));
  await page.close();
}

/* ── the palette is locked ────────────────────────────────────────── */
{
  const page = await open();
  const strays = await page.evaluate(() => {
    const out = [];
    const ok = (c) => {
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return true;
      const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (c.includes("rgba") && /,\s*0\)$/.test(c)) return true;
      const trio = `${r},${g},${b}`;
      return trio === "17,17,17" || trio === "79,70,229" || trio === "255,255,255" || trio === "0,0,0";
    };
    document.querySelectorAll("[data-sheet] *").forEach((n) => {
      const cs = getComputedStyle(n);
      for (const prop of ["color", "backgroundColor", "borderTopColor"]) {
        const v = cs[prop];
        if (!ok(v)) out.push(`${(n.className || n.tagName).toString().slice(-22)} ${prop} ${v}`);
      }
    });
    return [...new Set(out)];
  });
  ok("nothing on the sheet is off-palette", strays.length === 0, JSON.stringify(strays.slice(0, 4)));
  await page.close();
}

/* ── a card with nothing to say says nothing ──────────────────────── */
{
  const page = await open();
  const bare = await page.evaluate(() => {
    const card = document.querySelector("[data-id]");
    const clone = card.cloneNode(true);
    clone.querySelectorAll('[class*="cardNote"], [class*="who"], [class*="tag"], [class*="hi"], [class*="cm"]')
      .forEach((n) => n.remove());
    clone.setAttribute("data-bare", "");
    card.parentElement.appendChild(clone);
    const box = clone.getBoundingClientRect();
    const title = clone.querySelector('[class*="cardTitle"]').getBoundingClientRect();
    const pct = Math.round(((box.bottom - title.bottom) / box.height) * 100);
    clone.remove();
    return pct;
  });
  ok("a title-only card is not mostly empty", bare <= 40, `${bare}% of the card is below its title`);
  await page.close();
}

/* ── finishing a task is witnessed and reversible ─────────────────── */
{
  const page = await open();
  const before = await counts(page);
  const doneLane = await page.evaluate(() =>
    [...document.querySelectorAll("[data-lane]")].at(-1).dataset.lane);

  await page.locator('[data-act="tick"]').first().click();
  const seen = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 16; i += 1) {
      const g = document.querySelector('[class*="cardGhost"]');
      out.push(g ? getComputedStyle(g).transform : "gone");
      await new Promise((r) => setTimeout(r, 20));
    }
    return out;
  });
  const moving = seen.filter((t) => t !== "gone" && t !== "none");
  ok("the completed card is drawn in flight", moving.length >= 3, seen.slice(0, 5).join(" | "));
  ok("and it actually travels", new Set(moving).size >= 3, `${new Set(moving).size} distinct positions`);

  await page.waitForTimeout(600);
  ok("it lands in Done", (await counts(page))[doneLane] === before[doneLane] + 1, JSON.stringify(await counts(page)));
  ok("the ghost is cleaned up", (await page.locator('[class*="cardGhost"]').count()) === 0);
  ok("nothing is left invisible",
    await page.evaluate(() => [...document.querySelectorAll("[data-id]")].every((c) => c.style.opacity !== "0")));
  ok("focus survives the completion",
    await page.evaluate(() => Boolean(document.activeElement?.closest("[data-id]"))),
    await page.evaluate(() => document.activeElement?.tagName ?? "none"));

  /* Focus surviving is not the same as focus being reachable. On a narrow
     board the card that just completed can land a column off screen, and
     focus parked on something invisible is both a lost operator and a
     focus-visibility failure. */
  ok("and lands somewhere the operator can see",
    await page.evaluate(() => {
      const host = document.activeElement?.closest("[data-id]");
      const board = document.querySelector("[data-board]");
      if (!host || !board) return false;
      const r = host.getBoundingClientRect();
      const b = board.getBoundingClientRect();
      return r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= 0 && r.bottom <= innerHeight;
    }));

  ok("a way back is offered", (await page.locator('[data-act="undo"]').count()) === 1);
  await page.locator('[data-act="undo"]').click();
  await page.waitForTimeout(600);
  ok("undo puts it back", (await counts(page))[doneLane] === before[doneLane], JSON.stringify(await counts(page)));

  /* The record outlives the strip: nothing that was true stops being true
     because six seconds passed. */
  await page.locator('[data-act="tick"]').first().click();
  await page.waitForTimeout(7000);
  ok("the strip retires", (await page.locator('[data-act="undo"]').count()) === 0);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(600);
  ok("but ctrl+z still works", (await counts(page))[doneLane] === before[doneLane], JSON.stringify(await counts(page)));
  await page.close();
}

/* ── the board keeps the operator's place ─────────────────────────── */
{
  const page = await open();
  const tall = await page.evaluate(() => {
    const body = [...document.querySelectorAll("[data-tray-body]")]
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    body.scrollTop = 60;
    return body.closest("[data-lane]").dataset.lane;
  });
  await page.waitForTimeout(200);
  const kept = await page.evaluate((lane) => {
    const body = document.querySelector(`[data-lane="${lane}"] [data-tray-body]`);
    return body.scrollTop;
  }, tall);
  await page.locator('[data-act="tick"]').first().click();
  await page.waitForTimeout(700);
  const after = await page.evaluate((lane) => {
    const body = document.querySelector(`[data-lane="${lane}"] [data-tray-body]`);
    return body ? body.scrollTop : -1;
  }, tall);
  ok("a repaint does not throw away a column's place", kept === 0 || Math.abs(after - kept) < 20,
    `${kept} -> ${after}`);
  await page.close();
}

/* ── nothing is clipped without saying so ─────────────────────────── */
{
  for (const width of [1440, 1280, 1100, 768, 390]) {
    const page = await open("/app/tasks", { width, height: 900 });
    const silent = await page.$$eval("[data-trim]", (nodes) =>
      nodes.filter((n) => n.scrollHeight > n.clientHeight + 1 && !n.textContent.includes("…"))
        .map((n) => n.textContent.slice(0, 30)));
    ok(`no text is clipped without an ellipsis at ${width}`, silent.length === 0, JSON.stringify(silent));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    ok(`the page does not scroll sideways at ${width}`, !overflow);
    await page.close();
  }
}

/* ── the keyboard model is real ───────────────────────────────────── */
{
  const page = await open();
  const walk = await page.evaluate(() => {
    const stops = [...document.querySelectorAll("[data-board] a, [data-board] button, [data-board] [tabindex]")]
      .filter((n) => n.offsetParent !== null && n.getAttribute("tabindex") !== "-1");
    const lanes = document.querySelectorAll("[data-board] [data-lane]").length;
    const cards = document.querySelectorAll("[data-board] [data-id]").length;
    const scrollers = [...document.querySelectorAll("[data-tray-body]")];
    return {
      stops: stops.length,
      lanes,
      cards,
      cardStops: stops.filter((n) => n.matches("[data-id]")).length,
      /* Every scroller reachable, whether or not it holds the roving stop —
         axe rates a scrollable region with no keyboard route as serious, and
         only the column holding the roving card used to have one. */
      reachable: scrollers.every((n) => n.tabIndex >= 0),
      scrollers: scrollers.length,
    };
  });
  /* The property, stated as the property rather than as a number: however
     many cards the board holds, exactly one of them is a tab stop and the
     rest are reachable only by arrow. The remaining stops belong to the
     board's SHAPE — one scroller per column, and the controls inside
     whichever single card currently holds the stop. */
  ok("the board is a roving group, not a stop per card",
    walk.cardStops === 1 && walk.cards > 1 && walk.stops <= walk.lanes + 6,
    `${walk.cardStops} of ${walk.cards} cards is a stop; ${walk.stops} stops for ${walk.lanes} columns`);
  ok("every column scroller has a keyboard route",
    walk.reachable && walk.scrollers === walk.lanes,
    `${walk.scrollers} scrollers, all reachable: ${walk.reachable}`);

  await page.locator('[data-id][tabindex="0"]').first().focus();
  await page.keyboard.press(" ");
  await page.waitForTimeout(200);
  ok("space picks a card up", (await page.locator('[data-id][aria-grabbed="true"]').count()) === 1);
  const start = await counts(page);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
  const moved = await counts(page);
  ok("arrows carry it to the next column", JSON.stringify(moved) !== JSON.stringify(start),
    `${JSON.stringify(start)} -> ${JSON.stringify(moved)}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("escape puts it back exactly", JSON.stringify(await counts(page)) === JSON.stringify(start),
    JSON.stringify(await counts(page)));
  await page.close();
}

/* ── every view still works inside the shell ──────────────────────── */
{
  for (const [path, label] of [["/app/tasks/list", "list"], ["/app/tasks/timeline", "schedule"], ["/app/tasks/calendar", "calendar"]]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    page.on("pageerror", (e) => errors.push(`${label}: ${String(e).slice(0, 90)}`));
    await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    const shell = await page.evaluate(() => ({
      sheet: Boolean(document.querySelector("[data-sheet]")),
      interior: document.querySelectorAll('[class*="option-a-module"], [class*="shared-module"]').length,
    }));
    ok(`${label} renders inside the Studio Floor shell`, shell.sheet && shell.interior > 0, JSON.stringify(shell));
    await page.close();
  }
}


/* ── the header's facts are the board's controls ──────────────────── */
{
  const page = await open();
  const chips = await page.locator('[class*="late"]').count();
  if (chips === 0) {
    ok("the header carries at least one filter chip", false, "no overdue or today chip rendered");
  } else {
    const all = Object.values(await counts(page)).reduce((a, b) => a + b, 0);
    await page.locator('[class*="late"]').last().click();
    await page.waitForTimeout(400);
    const shown = Object.values(await counts(page)).reduce((a, b) => a + b, 0);
    ok("pressing a header fact filters the board", shown > 0 && shown < all, `${shown} of ${all}`);
    ok("and the chip reads as pressed", (await page.locator('[aria-pressed="true"]').count()) >= 1);
    ok("and the foot says what is hidden",
      /hidden/.test(await page.locator('[class*="carryName"]').first().textContent()),
      await page.locator('[class*="carryName"]').first().textContent());
    await page.locator('[class*="carryDo"]').first().click();
    await page.waitForTimeout(400);
    ok("show all brings the board back",
      Object.values(await counts(page)).reduce((a, b) => a + b, 0) === all);
  }
  await page.close();
}

ok("no console errors anywhere", errors.length === 0, [...new Set(errors)].slice(0, 3).join(" | "));

await browser.close();

for (const r of results) {
  process.stdout.write(`${r.pass ? "  pass  " : "  FAIL  "}${r.name}${r.detail && !r.pass ? `\n          ${r.detail}` : ""}\n`);
}
process.stdout.write(`\n${results.length - failures}/${results.length} checks pass\n`);
process.exit(failures ? 1 : 0);
