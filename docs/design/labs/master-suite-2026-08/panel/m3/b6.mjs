import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "notes.seam", width: 1440, height: 960 });
await p.evaluate(() => { window.__a = []; for (const t of document.querySelectorAll("[aria-live],[role=status]")) new MutationObserver(() => window.__a.push((t.textContent || "").trim().slice(0, 200))).observe(t, { childList: true, subtree: true, characterData: true }); });
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.index[aria-label="Already in Tasks"] .idxItem')].map((li) => {
  const btn = li.querySelector("button,a[href],[role=button]");
  return btn ? { tag: btn.tagName, cls: String(btn.className), label: btn.getAttribute("aria-label"), ti: btn.tabIndex, act: btn.dataset ? JSON.stringify(btn.dataset) : null } : null;
})), null, 1));
const row = p.locator('.index[aria-label="Already in Tasks"] .idxItem button').nth(1);
await row.click();
await p.waitForTimeout(800);
console.log("announce:", JSON.stringify(await p.evaluate(() => window.__a)));
console.log("body has 'Linen supplier rang'?", await p.evaluate(() => /Linen supplier rang/.test(document.body.innerText)));
console.log("current product:", await p.evaluate(() => [...document.querySelectorAll("[data-rail]")].find((r) => r.getAttribute("aria-current"))?.dataset.rail));
await p.screenshot({ path: "panel/m3/linen-open.png" });
await p.close();
await b.close();
