/* A very small, strict CSS reader.
 *
 * It exists for one job: to let the composition SEE the three stylesheets
 * rather than guess at them. It walks braces the way a browser does not —
 * a browser recovers from bad CSS and this must not have to, so an
 * unbalanced file throws here rather than being silently mis-split. That
 * failure mode is not hypothetical: it is the malformed @keyframes that
 * scoped 562 rules into nonsense in the Tasks Console.
 *
 * It scans a copy with the comments BLANKED rather than removed, so every
 * offset still points into the original text and a rule can be re-emitted
 * with its own commentary intact. Three heavily-annotated stylesheets are
 * about to be edited for weeks; a splitter that throws their reasoning away
 * is a splitter that costs more than it saves. It is also load-bearing:
 * Timeline's own gate reads trailing `/* off-ladder … *​/` markers out of
 * the stylesheet, and a comment-free copy fails a gate it should pass.
 */

/* Comments replaced by spaces of the same length, newlines kept, so every
   index into this string is the same index into the original. */
export function blankComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const STRINGS = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;

export function assertBalanced(css, label) {
  const bare = blankComments(css).replace(STRINGS, '""');
  let depth = 0;
  for (const ch of bare) {
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth < 0) throw new Error(label + ": a closing brace with nothing open");
    }
  }
  if (depth !== 0) throw new Error(label + ": " + depth + " unclosed brace(s)");
}

/* Parse into a flat, ordered list of nodes. Every node carries `start` and
 * `end`, which are offsets into the ORIGINAL text, so an emitter can slice
 * the gaps between them and keep the standalone comments too.
 *
 *   { kind: "rule",      at, selector, body, raw, start, end }
 *   { kind: "at",        at, prelude, body, raw, start, end }
 *   { kind: "statement", at, text, start, end }
 *
 * `selector` and `body` are comment-free (for analysis); `raw` is the
 * original slice (for emission). Container at-rules (@media, @supports) are
 * walked into and their prelude is carried on `at`. */
export function parse(css, label = "css") {
  assertBalanced(css, label);
  const scan = blankComments(css);
  const out = [];
  walk(scan, css, 0, scan.length, [], out);
  return out;
}

const CONTAINER = /^@(media|supports|layer|container|document|scope)\b/i;

function walk(scan, src, from, to, at, out) {
  let i = from;
  while (i < to) {
    while (i < to && /\s/.test(scan[i])) i++;
    if (i >= to) break;

    if (scan[i] === "@") {
      const semi = findTop(scan, i, to, ";");
      const brace = findTop(scan, i, to, "{");
      if (semi !== -1 && (brace === -1 || semi < brace)) {
        out.push({ kind: "statement", at: at.slice(), text: src.slice(i, semi + 1).trim(), start: i, end: semi + 1 });
        i = semi + 1;
        continue;
      }
    }

    const open = findTop(scan, i, to, "{");
    if (open === -1) break;
    const prelude = stripComments(src.slice(i, open)).trim();
    const close = matchBrace(scan, open, to);

    if (CONTAINER.test(prelude)) {
      out.push({ kind: "enter", at: at.slice(), prelude, start: i, end: open + 1 });
      walk(scan, src, open + 1, close, at.concat(prelude), out);
      out.push({ kind: "leave", at: at.slice(), prelude, start: close, end: close + 1 });
    } else if (prelude.startsWith("@")) {
      out.push({
        kind: "at", at: at.slice(), prelude,
        body: stripComments(src.slice(open + 1, close)),
        raw: src.slice(open + 1, close),
        start: i, end: close + 1,
      });
    } else {
      out.push({
        kind: "rule", at: at.slice(), selector: prelude,
        body: stripComments(src.slice(open + 1, close)).trim(),
        raw: src.slice(open + 1, close),
        rawSelector: src.slice(i, open),
        start: i, end: close + 1,
      });
    }
    i = close + 1;
  }
}

/* The next `ch` at brace depth 0, ignoring strings and parenthesised groups. */
function findTop(scan, from, to, ch) {
  let depth = 0, paren = 0, quote = null;
  for (let i = from; i < to; i++) {
    const c = scan[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "(") { paren++; continue; }
    if (c === ")") { paren--; continue; }
    if (paren > 0) continue;
    if (c === "{") { if (ch === "{" && depth === 0) return i; depth++; continue; }
    if (c === "}") { depth--; continue; }
    if (c === ch && depth === 0) return i;
  }
  return -1;
}

function matchBrace(scan, open, to) {
  let depth = 0, quote = null;
  for (let i = open; i < to; i++) {
    const c = scan[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return i; }
  }
  throw new Error("unbalanced brace");
}

/* Selector lists, split on top-level commas. */
export function selectors(selector) {
  const parts = [];
  let depth = 0, quote = null, start = 0;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) { parts.push(selector.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(selector.slice(start).trim());
  return parts.filter(Boolean);
}

/* Declarations, in order. */
export function declarations(body) {
  const out = [];
  let depth = 0, paren = 0, quote = null, start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "(") paren++;
    else if (c === ")") paren--;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ";" && depth === 0 && paren === 0) {
      const text = body.slice(start, i).trim();
      if (text) out.push(splitDecl(text));
      start = i + 1;
    }
  }
  const tail = body.slice(start).trim();
  if (tail) out.push(splitDecl(tail));
  return out;
}

function splitDecl(text) {
  const colon = text.indexOf(":");
  if (colon === -1) return { prop: text.trim(), value: "" };
  return { prop: text.slice(0, colon).trim(), value: text.slice(colon + 1).trim() };
}

/* The class names a selector actually targets. */
export function classesIn(selector) {
  const found = new Set();
  for (const m of selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) found.add(m[1]);
  return found;
}

export function norm(text) {
  return text.replace(/\s+/g, " ").trim();
}
