import { launch, open } from "./drive.mjs";

const b = await launch();

async function watch(p) {
  await p.evaluate(() => {
    window.__ann = [];
    for (const t of document.querySelectorAll("[aria-live],[role=status],[role=alert],[role=log]")) {
      new MutationObserver(() => window.__ann.push((t.textContent || "").trim().slice(0, 160))).observe(t, { childList: true, subtree: true, characterData: true });
    }
  });
}
const dump = async (p, tag) => console.log("  " + tag + " ANN " + JSON.stringify(await p.evaluate(() => { const x = window.__ann; window.__ann = []; return x; })));
const act = async (p) => await p.evaluate(() => {
  const a = document.activeElement;
  if (!a) return "none";
  const r = a.getBoundingClientRect();
  return String(a.className).split(" ")[0] + " | " + (a.getAttribute("aria-label") || a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 44) + (r.bottom < 0 || r.top > 960 ? " OFFSCREEN" : "");
});

async function drag(p, from, to, steps = 30) {
  const a = await p.locator(from).boundingBox();
  const c = typeof to === "string" ? await p.locator(to).boundingBox() : to;
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await p.mouse.down();
  await p.mouse.move(c.x + (c.width || 0) / 2, c.y + (c.height || 0) / 2, { steps });
  await p.mouse.up();
}

/* 1 — Tasks: real pointer drag of a card across lanes */
{
  const p = await open(b, { state: "tasks.board", width: 1440, height: 960 });
  await watch(p);
  const before = await p.evaluate(() => [...document.querySelectorAll(".tray")].map((t) => t.getAttribute("aria-label")).join(" / "));
  await drag(p, "article.card >> nth=0", ".tray[data-lane] >> nth=2");
  await p.waitForTimeout(600);
  const after = await p.evaluate(() => [...document.querySelectorAll(".tray")].map((t) => t.getAttribute("aria-label")).join(" / "));
  console.log("DRAG tasks:", before, "->", after);
  await dump(p, "drag");
  console.log("  focus:", await act(p));
  await p.close();
}

/* 2 — Notes: real selection drag across words, then peel, then send */
{
  const p = await open(b, { state: "notes.notebook", width: 1440, height: 960 });
  await watch(p);
  // lift a note onto the desk from the index
  const rows = await p.locator(".idxRow").count();
  console.log("NOTES index rows:", rows);
  await p.locator(".idxRow").nth(1).click();
  await p.waitForTimeout(500);
  await dump(p, "lift");
  console.log("  focus after lift:", await act(p));
  const body = await p.locator(".readBody").count();
  console.log("  readBody present:", body);
  if (body) {
    const box = await p.locator(".readBody").first().boundingBox();
    await p.mouse.move(box.x + 12, box.y + 12);
    await p.mouse.down();
    await p.mouse.move(box.x + 220, box.y + 12, { steps: 30 });
    await p.mouse.up();
    await p.waitForTimeout(500);
    await dump(p, "select");
    console.log("  peel button:", await p.locator('[data-act="peel"]').count(), "visible:", await p.locator('[data-act="peel"]').first().isVisible().catch(() => false));
    console.log("  selection:", await p.evaluate(() => String(getSelection()).slice(0, 60)));
  }
  await p.close();
}

/* 3 — Notes: Ctrl+K */
{
  const p = await open(b, { state: "notes.notebook", width: 1440, height: 960 });
  await watch(p);
  await p.keyboard.press("Control+k");
  await p.waitForTimeout(500);
  await dump(p, "ctrl-k");
  console.log("CTRL-K focus:", await act(p));
  await p.keyboard.type("linen");
  await p.waitForTimeout(500);
  await dump(p, "typed");
  console.log("  results:", await p.evaluate(() => [...document.querySelectorAll(".findRow,.searchRow,[class*=find] li,[class*=result]")].map((e) => (e.textContent || "").trim().slice(0, 40)).slice(0, 5)));
  await p.screenshot({ path: "panel/m3/ctrlk.png" });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  console.log("  after esc focus:", await act(p));
  await p.close();
}

/* 4 — Timeline: orientation switch */
{
  const p = await open(b, { state: "timeline.owner-flight", width: 1440, height: 960 });
  await watch(p);
  await p.locator('[data-layout-to="down"]').click();
  await p.waitForTimeout(600);
  await dump(p, "to-down");
  console.log("ORIENT focus:", await act(p));
  await p.locator('[data-layout-to="across"]').click();
  await p.waitForTimeout(600);
  await dump(p, "to-across");
  console.log("  focus:", await act(p));
  await p.close();
}

/* 5 — spine: switch products and come back, is state preserved */
{
  const p = await open(b, { state: "tasks.board", width: 1440, height: 960 });
  await watch(p);
  await p.locator(".late").nth(1).click();
  await p.waitForTimeout(500);
  const filtered = await p.evaluate(() => [...document.querySelectorAll(".tray")].map((t) => t.getAttribute("aria-label")).join(" / "));
  await p.locator('[data-rail="notes"]').click();
  await p.waitForTimeout(600);
  await dump(p, "to-notes");
  console.log("SPINE focus after switch:", await act(p));
  await p.locator('[data-rail="tasks"]').click();
  await p.waitForTimeout(600);
  const back = await p.evaluate(() => [...document.querySelectorAll(".tray")].map((t) => t.getAttribute("aria-label")).join(" / "));
  console.log("  filter kept?", filtered === back, "|", back);
  console.log("  focus back:", await act(p));
  await p.close();
}

await b.close();
