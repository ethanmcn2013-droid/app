import { launch, open } from "./drive.mjs";

const b = await launch();
for (const st of ["timeline.desk", "timeline.owner-flight", "timeline.phone"]) {
  const p = await open(b, { state: st, width: 1440, height: 960 });
  const r = await p.evaluate(() => {
    const det = document.querySelector("details");
    const sum = document.querySelector(".b-behindSummary");
    const behind = document.querySelector(".b-behind, [class*=behind]");
    return {
      summaryText: (sum?.textContent || "").replace(/\s+/g, " ").trim(),
      detailsOpen: det ? det.open : null,
      behindHTMLText: (behind?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300),
      visibleProse: [...document.querySelectorAll("[class*=behind] *")].filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 0).map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 12),
      countClaim: (document.body.innerText.match(/\d+ moments?/g) || []),
    };
  });
  console.log("=== " + st);
  console.log(JSON.stringify(r, null, 1));
  await p.close();
}
await b.close();
