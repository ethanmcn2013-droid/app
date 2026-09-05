import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {extractFloorCss} from './extract-floor-css.mjs';

const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const master=await readFile('docs/design/labs/tasks-2026-08/floor.html','utf8');
const generated=extractFloorCss(master).sheet;
const parsed=postcss.parse(generated);

test('committed Floor stylesheet equals extraction and is stable across checkout line endings',async()=>{
  assert.equal((await readFile('src/components/floor/floor.module.css','utf8')).replace(/\r\n/g,'\n'),generated);
  assert.equal(extractFloorCss(master.replace(/\r?\n/g,'\r\n')).sheet,generated);
});

test('all five corrected keyframe programs retain exact steps and declarations without selector prefixes',()=>{
  function frames(css){const found={};postcss.parse(css).walkAtRules('keyframes',rule=>{found[rule.params]=rule.nodes.map(step=>({step:step.selector.replace(/\s+/g,' '),declarations:step.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value])}));});return found;}
  const actual=frames(generated);
  assert.deepEqual(Object.keys(actual).sort(),['breathe','carryIn','checkDraw','settleIn','tickSettle']);
  // Programs from 0562baeb, retained in e2e4a0c8. Keep the oracle in this test
  // so the default gate works in shallow Linux checkouts without Git history.
  const step=(step,declarations)=>({step,declarations});
  assert.deepEqual(actual,{
    tickSettle:[step('0%',[['transform','scale(1)']]),step('38%',[['transform','scale(0.86)']]),step('100%',[['transform','scale(1)']])],
    checkDraw:[step('from',[['stroke-dasharray','22'],['stroke-dashoffset','22']]),step('to',[['stroke-dasharray','22'],['stroke-dashoffset','0']])],
    settleIn:[step('from',[['opacity','0'],['transform','translateY(2px)']]),step('to',[['opacity','1'],['transform','none']])],
    carryIn:[step('from',[['opacity','0'],['transform','translate(-50%, 6px)']])],
    breathe:[step('0%, 100%',[['opacity','1']]),step('50%',[['opacity','0.45']])],
  });
  for(const steps of Object.values(actual))for(const step of steps)assert.match(step.step,/^(?:from|to|\d+%)(?:,\s*\d+%)*$/);
});

test('generated output compiles as actual CSS Modules without malformed-keyframe warnings',async()=>{
  const result=await esbuild.transform(generated,{loader:'local-css'});
  assert.deepEqual(result.warnings,[]);
  assert.match(result.code,/\[data-theme=dark\]/);
});

test('regeneration preserves every shipped geometry declaration, including mobile density and fit columns',()=>{
  const geometry=/^(display|position|(?:min-|max-)?(?:width|height)|(?:padding|margin|inset|gap|top|bottom|left|right)(?:-.+)?|grid-.+|flex(?:-.+)?|align-.+|justify-.+|overflow(?:-.+)?|scroll-.+|border-radius|transform)$/;
  function rules(css){const result=[];postcss.parse(css).walkRules(rule=>{const values=rule.nodes.filter(n=>n.type==='decl'&&geometry.test(n.prop)).map(n=>[n.prop,n.value]);if(values.length){const parents=[];for(let p=rule.parent;p?.type==='atrule';p=p.parent)parents.unshift([p.name,p.params]);result.push([parents,rule.selector.replace(/\s+/g,' ').trim(),values]);}});return result;}
  // Canonicalized geometry of all 252 rules in e2e4a0c8. The original full
  // rule-by-rule comparison ran locally; this digest makes that receipt
  // reproducible in CI without fetching historical commits or copying CSS.
  const actual=rules(generated);assert.equal(actual.length,252);
  assert.equal(createHash('sha256').update(JSON.stringify(actual)).digest('hex'),'db48dc4695dc970b15d85866f9b9474fa52a6160f28a4f3b664fa8da04f1b1cc');
});

test('dark role mapping stays local and does not redefine global DS ink or paper',()=>{
  const dark=parsed.nodes.find(n=>n.type==='rule'&&n.selector===':global([data-theme="dark"]) .root');
  assert.ok(dark);
  const values=Object.fromEntries(dark.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
  assert.equal(values['--x-floor-ground'],'var(--paper)');
  assert.equal(values['--on-ink-1'],'var(--ink)');
  assert.equal(values['--x-floor-control-edge'],'var(--ink-3)');
  assert.ok(!Object.hasOwn(values,'--ink')&&!Object.hasOwn(values,'--paper'));
});

test('mobile project-strip roles use the actual control breakpoint and do not affect desktop',async()=>{
  const source=await readFile('src/components/studio-bar/active-project/active-project-control.tsx','utf8');
  const css=postcss.parse(await readFile('src/components/studio-bar/active-project/active-project.module.css','utf8'));
  assert.match(source,/PHONE_QUERY = "\(max-width: 767px\)"/);
  const rule=css.nodes.find(n=>n.type==='atrule'&&n.params==='(max-width: 767px)');
  assert.equal(rule.nodes[0].selector,'.ring[data-slot="active-project-trigger"]');
  assert.equal(rule.nodes[0].nodes.find(n=>n.prop==='--x-studio-ink').value,'var(--ink)');
});
