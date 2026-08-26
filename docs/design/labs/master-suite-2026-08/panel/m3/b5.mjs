import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "notes.seam", width: 1440, height: 960 });
console.log("BEFORE send:");
console.log(" already-in-tasks rows:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll(".index[aria-label] .idxItem")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60)))));
console.log(" header:", await p.evaluate(() => (document.querySelector(".indexWrap")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90)));
await p.locator('[data-act="send"]').first().click();
await p.waitForTimeout(800);
console.log("AFTER send:");
console.log(" rows:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll(".index[aria-label] .idxItem")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60)))));
console.log(" header:", await p.evaluate(() => (document.querySelector(".indexWrap")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90)));
console.log(" clickable rows:", await p.evaluate(() => [...document.querySelectorAll(".index[aria-label] .idxItem")].map((e) => e.querySelector("button,a[href],[role=button]") ? "yes" : "no")));

// now go to notebook and search for Heating (the note we just sent from) and for linen
await p.locator('.dockField, [aria-label="Search everything you wrote"]').first().click().catch(() => {});
await p.waitForTimeout(300);
for (const q of ["Heating", "Linen"]) {
  const p2 = await open(b, { state: "notes.notebook", width: 1440, height: 960 });
  await p2.evaluate(() => { window.__a = []; for (const t of document.querySelectorAll("[aria-live],[role=status]")) new MutationObserver(() => window.__a.push((t.textContent || "").trim().slice(0, 120))).observe(t, { childList: true, subtree: true, characterData: true }); });
  await p2.keyboard.press("Control+k");
  await p2.waitForTimeout(300);
  await p2.keyboard.type(q, { delay: 30 });
  await p2.waitForTimeout(600);
  console.log(" search " + q + " ->", JSON.stringify(await p2.evaluate(() => window.__a.slice(-1))));
  await p2.close();
}
await p.close();
await b.close();
