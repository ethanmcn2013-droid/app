import { launch, open } from "./drive.mjs";

const b = await launch();
for (const q of ["linen", "Linen", "supplier", "tonic", "heating", "orchard"]) {
  const p = await open(b, { state: "notes.notebook", width: 1440, height: 960 });
  await p.evaluate(() => {
    window.__ann = [];
    for (const t of document.querySelectorAll("[aria-live],[role=status]")) new MutationObserver(() => window.__ann.push((t.textContent || "").trim().slice(0, 200))).observe(t, { childList: true, subtree: true, characterData: true });
  });
  await p.keyboard.press("Control+k");
  await p.waitForTimeout(400);
  await p.keyboard.type(q, { delay: 40 });
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => ({
    ann: window.__ann.slice(-1),
    fieldValue: (document.activeElement && ("value" in document.activeElement ? document.activeElement.value : document.activeElement.textContent)) || "",
    rows: [...document.querySelectorAll(".findRow,.idxRow,[class*=hit],[class*=find]")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60)).slice(0, 6),
    visibleSearchText: (document.querySelector("[class*=find],[class*=search],[class*=Find]")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200),
  }));
  console.log(q, JSON.stringify(r, null, 0));
  if (q === "linen") await p.screenshot({ path: "panel/m3/find-linen.png" });
  if (q === "supplier") await p.screenshot({ path: "panel/m3/find-supplier.png" });
  await p.close();
}
await b.close();
