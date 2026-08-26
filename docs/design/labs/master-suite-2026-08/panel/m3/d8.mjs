import { launch, open } from "./drive.mjs";

const b = await launch();
const watch = async (p) => p.evaluate(() => { window.__a = []; for (const t of document.querySelectorAll("[aria-live],[role=status]")) new MutationObserver(() => window.__a.push((t.textContent || "").trim().slice(0, 160))).observe(t, { childList: true, subtree: true, characterData: true }); });
const dump = async (p, t) => console.log("  " + t + " ->", JSON.stringify(await p.evaluate(() => { const x = window.__a; window.__a = []; return x; })));
const act = async (p) => p.evaluate(() => { const a = document.activeElement; return String(a.className).split(" ")[0] + " | " + (a.getAttribute("aria-label") || a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 44); });

/* Timeline head buttons */
{
  const p = await open(b, { state: "timeline.owner-flight", width: 1440, height: 960 });
  await watch(p);
  for (const label of ["Add a moment", "Preview", "Get the link"]) {
    await p.locator(`.b-act:has-text("${label}")`).first().click();
    await p.waitForTimeout(700);
    await dump(p, label);
    console.log("     focus:", await act(p), "| dialogs:", await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].map((d) => (d.getAttribute("aria-label") || d.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80))));
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);
  }
  await p.close();
}

/* Notes picker — the custom listbox */
{
  const p = await open(b, { state: "notes.seam", width: 1440, height: 960 });
  await watch(p);
  const pick = p.locator(".picker").first();
  console.log("PICKER attrs:", JSON.stringify(await p.evaluate(() => { const e = document.querySelector(".picker"); return e ? { tag: e.tagName, role: e.getAttribute("role"), exp: e.getAttribute("aria-expanded"), ctrl: e.getAttribute("aria-controls"), haspopup: e.getAttribute("aria-haspopup"), label: e.getAttribute("aria-label") } : null; })));
  await pick.click();
  await p.waitForTimeout(500);
  console.log("  after open:", JSON.stringify(await p.evaluate(() => {
    const lb = document.querySelector("[role=listbox]");
    return {
      listbox: lb ? { label: lb.getAttribute("aria-label"), active: lb.getAttribute("aria-activedescendant"), activeResolves: lb.getAttribute("aria-activedescendant") ? !!document.getElementById(lb.getAttribute("aria-activedescendant")) : null } : null,
      options: [...document.querySelectorAll("[role=option]")].map((o) => ({ t: (o.textContent || "").trim().slice(0, 24), sel: o.getAttribute("aria-selected"), id: o.id, ti: o.tabIndex })),
      focus: String(document.activeElement.className).split(" ")[0] + "|" + (document.activeElement.getAttribute("aria-label") || document.activeElement.textContent || "").trim().slice(0, 30),
    };
  }), null, 1));
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(250);
  console.log("  ArrowDown focus:", await act(p), "activedesc:", await p.evaluate(() => document.querySelector("[role=listbox]")?.getAttribute("aria-activedescendant")));
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  console.log("  Esc focus:", await act(p));
  await p.close();
}

/* Tasks card menu */
{
  const p = await open(b, { state: "tasks.board", width: 1440, height: 960 });
  await watch(p);
  await p.locator(".cardDots").first().click({ force: true });
  await p.waitForTimeout(500);
  await dump(p, "cardDots");
  console.log("  menu:", JSON.stringify(await p.evaluate(() => {
    const m = document.querySelector(".cardMenu");
    return m ? { role: m.getAttribute("role"), label: m.getAttribute("aria-label"), items: [...m.querySelectorAll("button")].map((x) => ({ t: (x.textContent || "").trim().slice(0, 24), role: x.getAttribute("role"), cur: x.getAttribute("aria-current"), ti: x.tabIndex })) } : null;
  }), null, 1));
  console.log("  trigger:", await p.evaluate(() => { const t = document.querySelector(".cardDots"); return { exp: t.getAttribute("aria-expanded"), pop: t.getAttribute("aria-haspopup") }; }), "focus:", await act(p));
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  console.log("  after Esc focus:", await act(p));
  await p.close();
}
await b.close();
