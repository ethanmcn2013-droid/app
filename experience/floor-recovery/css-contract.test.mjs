import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { extractFloorCss } from '../../scripts/design/extract-floor-css.mjs';

const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const master = await readFile('docs/design/labs/tasks-2026-08/floor.html', 'utf8');
const sheet = extractFloorCss(master).sheet;

test('owning master generates the exact committed Floor stylesheet', async () => {
  assert.equal((await readFile('src/components/floor/floor.module.css', 'utf8')).replace(/\r\n/g, '\n'), sheet);
  assert.equal(extractFloorCss(master.replace(/\r?\n/g, '\r\n')).sheet, sheet);
});

test('disclosure adds exactly two geometry rules; all 252 existing geometry rules retain their accepted digest', () => {
  // This explicitly accounts for the new behavior. The older theme test still
  // freezes *all* geometry; principal owns integrating this delta into that gate.
  const geometry = /^(display|position|(?:min-|max-)?(?:width|height)|(?:padding|margin|inset|gap|top|bottom|left|right)(?:-.+)?|grid-.+|flex(?:-.+)?|align-.+|justify-.+|overflow(?:-.+)?|scroll-.+|border-radius|transform)$/;
  const old = [], added = [];
  const additions = ['.noteToggle', '.root[data-density="compact"] .card[data-open] .cardNote'];
  postcss.parse(sheet).walkRules(rule => {
    const values = rule.nodes.filter(n => n.type === 'decl' && geometry.test(n.prop)).map(n => [n.prop, n.value]);
    if (!values.length) return;
    const parents = [];
    for (let p = rule.parent; p?.type === 'atrule'; p = p.parent) parents.unshift([p.name, p.params]);
    const selector = rule.selector.replace(/\s+/g, ' ').trim();
    (additions.includes(selector) ? added : old).push([parents, selector, values]);
  });
  assert.deepEqual(added, [
    [[], '.noteToggle', [['grid-column', '2'], ['grid-row', '2'], ['min-width', '0'], ['display', 'block'], ['padding', '0'], ['margin', '0']]],
    [[], '.root[data-density="compact"] .card[data-open] .cardNote', [['max-height', 'none']]],
  ]);
  assert.equal(old.length, 252);
  assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'), 'db48dc4695dc970b15d85866f9b9474fa52a6160f28a4f3b664fa8da04f1b1cc');
});
