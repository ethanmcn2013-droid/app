import { launch, open } from "./drive.mjs";

const b = await launch();
const states = ["tasks.board","tasks.dense","notes.notebook","notes.seam","notes.voice","timeline.owner-flight","timeline.desk","timeline.phone"];
const widths = [[390,844],[720,900],[1024,900],[1440,960],[1920,1000]];
const matched = new Set();
let all = null;

for (const st of states) {
  for (const [W,H] of widths) {
    for (const layout of (st.startsWith("timeline") ? ["across","down"] : [null])) {
      const p = await open(b, { state: st, width: W, height: H, touch: W <= 480, layout: layout || undefined });
      const r = await p.evaluate(() => {
        const sels = [];
        const hits = [];
        const walk = (rules) => {
          for (const rule of rules) {
            if (rule.cssRules && rule.type !== 1) { walk(rule.cssRules); continue; }
            if (rule.type !== 1) continue;
            for (const raw of rule.selectorText.split(",")) {
              const s = raw.trim();
              if (!s) continue;
              sels.push(s);
              // strip pseudo-classes/elements that cannot be matched statically
              const probe = s
                .replace(/::[a-z-]+(\([^)]*\))?/g, "")
                .replace(/:(hover|focus|focus-visible|focus-within|active|visited|target|checked|disabled|enabled|placeholder-shown|autofill|indeterminate|default|user-invalid|invalid|valid|required|optional|read-only|read-write|any-link|link|fullscreen|picture-in-picture|open|popover-open|modal)\b/g, "");
              if (!probe.trim()) { hits.push(s); continue; }
              try { if (document.querySelector(probe)) hits.push(s); } catch { hits.push(s); }
            }
          }
        };
        for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch {} }
        return { sels, hits };
      });
      if (!all) all = r.sels;
      for (const h of r.hits) matched.add(h);
      await p.close();
    }
  }
}

const uniq = [...new Set(all)];
const dead = uniq.filter((s) => !matched.has(s));
console.log("total selectors:", uniq.length, "matched somewhere:", uniq.length - dead.length, "never matched:", dead.length);
for (const d of dead) console.log("  DEAD  " + d);
await b.close();
