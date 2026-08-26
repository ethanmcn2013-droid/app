import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "notes.seam", width: 1440, height: 960 });
console.log(JSON.stringify(await p.evaluate(() => {
  const rows = [...document.querySelectorAll("*")].filter((e) => /Chase linen order/.test(e.textContent || "") && e.children.length <= 3);
  return rows.map((e) => ({
    tag: e.tagName, cls: String(e.className), role: e.getAttribute("role"), ti: e.tabIndex,
    label: e.getAttribute("aria-label"), txt: (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    clickable: e.tagName === "BUTTON" || e.tagName === "A" || e.getAttribute("role") === "button",
  }));
}), null, 1));
console.log("--- the whole 'already in tasks' block ---");
console.log(await p.evaluate(() => {
  const h = [...document.querySelectorAll("*")].find((e) => /ALREADY IN TASKS|Already in tasks/i.test(e.textContent || "") && e.children.length < 12);
  let n = h; while (n && !/so far/.test(n.textContent || "")) n = n.parentElement;
  const blk = n ? n.closest("section,div") : null;
  return blk ? blk.outerHTML.replace(/\s+/g, " ").slice(0, 2400) : "not found";
}));
await p.close();
await b.close();
