// Apply the family furniture to every artifact source in all three labs.
//
//   node scripts/design/family/apply.mjs            # patch every source
//   node scripts/design/family/apply.mjs --only=notes
//   node scripts/design/family/apply.mjs --check    # report, write nothing
//
// Idempotent: the injected block is fenced with <!--fam:start--> markers and
// is stripped before being written again, so this can run after every build.
//
// It also removes the bottom-of-page `nav.setNav` each session invented, on
// the founder's instruction that the set belongs at the top of the page and
// not at the foot of it.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { SET, rail, tail, FONT_LINK } from "./family.mjs";

const WS = "C:/Users/ethan/signal-studio-workspace";
const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const only = [...args].find((a) => a.startsWith("--only="))?.slice(7);

/* ── balanced element removal ───────────────────────────────────────────
   Cut <tag …class="setNav"…> … </tag> including nested same-name tags.
   Regex alone cannot do this; a two-line scanner can. */
function cutElementByClass(html, className) {
  let out = html;
  for (let guard = 0; guard < 20; guard++) {
    const at = out.indexOf(`class="${className}"`);
    if (at < 0) break;
    const open = out.lastIndexOf("<", at);
    if (open < 0) break;
    const nameMatch = /^<([a-zA-Z][\w-]*)/.exec(out.slice(open, at + 40));
    if (!nameMatch) break;
    const tag = nameMatch[1];
    const openTag = new RegExp(`<${tag}(\\s|>)`, "gi");
    const closeTag = new RegExp(`</${tag}\\s*>`, "gi");
    let depth = 0;
    let cursor = open;
    let end = -1;
    while (cursor < out.length) {
      openTag.lastIndex = cursor;
      closeTag.lastIndex = cursor;
      const o = openTag.exec(out);
      const c = closeTag.exec(out);
      if (!c) break;
      if (o && o.index < c.index) {
        depth++;
        cursor = o.index + 1;
      } else {
        depth--;
        cursor = c.index + 1;
        if (depth === 0) {
          end = c.index + c[0].length;
          break;
        }
      }
    }
    if (end < 0) break;
    out = out.slice(0, open) + out.slice(end);
  }
  return out;
}

function stripFam(html) {
  let s = html;
  s = s.replace(/<!--fam:start-->[\s\S]*?<!--fam:end-->\n?/g, "");
  s = s.replace(/<style id="famCss">[\s\S]*?<\/style>\n?/g, "");
  return s;
}

function ensureFonts(html, builtPath) {
  if (/fonts\.googleapis\.com\/css2\?family=Geist/.test(html)) return html;
  // A lab that embeds its own Geist does not need a second source for it.
  // When patching a shell the fonts are inlined at build time, so the built
  // output is what has to be asked, not the shell.
  if (/@font-face/.test(html)) return html;
  if (builtPath && existsSync(builtPath)) {
    try {
      if (/@font-face/.test(readFileSync(builtPath, "utf8").slice(0, 400000))) return html;
    } catch {}
  }
  const t = html.indexOf("</title>");
  if (t < 0) return FONT_LINK + "\n" + html;
  return html.slice(0, t + 8) + "\n" + FONT_LINK + html.slice(t + 8);
}

/* ── the pass ───────────────────────────────────────────────────────── */
const rows = [];
for (const [key, p] of Object.entries(SET.products)) {
  if (only && only !== key) continue;
  for (const doc of SET.docs) {
    const slot = doc.slot;
    // built documents are patched at their shell, static ones in place
    const source = p.shells?.[slot] ?? p.files[slot];
    const file = path.join(WS, p.worktree, p.lab, source);
    if (!existsSync(file)) {
      rows.push([key, slot, source, "MISSING"]);
      continue;
    }
    const before = readFileSync(file, "utf8");
    let s = stripFam(before);
    const hadSetNav = /class="setNav"/.test(s);
    s = cutElementByClass(s, "setNav");
    s = ensureFonts(s, path.join(WS, p.worktree, p.lab, p.files[slot]));

    const ground = slot === "console" ? "ink" : "paper";
    const block = `<!--fam:start-->\n${rail(key, slot, { ground })}\n<!--fam:end-->\n`;

    // the rail goes first in the document, the stylesheet last, so it wins
    // ties against whatever the page defined for itself.
    s = block + s + tail();

    const changed = s !== before;
    if (!check && changed) writeFileSync(file, s, "utf8");
    rows.push([key, slot, source, changed ? (hadSetNav ? "railed, setNav removed" : "railed") : "unchanged"]);
  }
}

const w = (s, n) => String(s).padEnd(n);
console.log(w("product", 10) + w("slot", 10) + w("source", 26) + "result");
console.log("-".repeat(74));
for (const r of rows) console.log(w(r[0], 10) + w(r[1], 10) + w(r[2], 26) + r[3]);
const missing = rows.filter((r) => r[3] === "MISSING");
if (missing.length) {
  console.log(`\n${missing.length} source(s) not yet written:`);
  for (const m of missing) console.log("  " + m[0] + " / " + m[1] + " -> " + m[2]);
}
