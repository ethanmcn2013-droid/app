import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "notes.notebook", width: 1440, height: 960 });
const r = await p.evaluate(() => ({
  indexRows: [...document.querySelectorAll(".idxRow")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70)),
  indexCount: document.querySelectorAll(".idxRow").length,
  indexHead: (document.querySelector(".indexHead, .idxHead, [class*=indexHead]")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
  dockFieldLabel: document.querySelector(".dockField")?.getAttribute("aria-label"),
  dockFieldText: (document.querySelector(".dockField")?.textContent || "").replace(/\s+/g, " ").trim(),
  bodyHasLinen: /Linen supplier rang/.test(document.body.innerText),
}));
console.log(JSON.stringify(r, null, 1));
await p.close();

// notes.seam has the "already in tasks" list — is the linen note reachable/readable there?
const p2 = await open(b, { state: "notes.seam", width: 1440, height: 960 });
console.log(JSON.stringify(await p2.evaluate(() => ({
  deskFacts: [...document.querySelectorAll(".deskFactRow, .sentRow, [class*=sentRow], [class*=deskFact]")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80)).slice(0, 8),
  allRows: [...document.querySelectorAll("[class*=crossed],[class*=already],[class*=sent]")].map((e) => String(e.className) + " :: " + (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60)).slice(0, 10),
})), null, 1));
// click the linen row in "already in tasks"
const n = await p2.locator("text=Chase linen order").count();
console.log("linen row count:", n);
if (n) {
  await p2.locator("text=Chase linen order").first().click();
  await p2.waitForTimeout(600);
  console.log("after click, page has body text?", await p2.evaluate(() => /Linen supplier rang/.test(document.body.innerText)));
  await p2.screenshot({ path: "panel/m3/linen-click.png" });
}
await p2.close();
await b.close();
