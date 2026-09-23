import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const {chromium,expect}=require('@playwright/test');
const bundle=await esbuild.build({
  entryPoints:[path.join(root,'experience/reorder-list-pointer-fixture.tsx')],
  absWorkingDir:root,bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',
  define:{'process.env.NODE_ENV':'"test"'},logLevel:'silent',
});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:800,height:600},reducedMotion:'reduce'});
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const alpha=page.locator('[data-reorder-item][data-id="alpha"]');
  const toggle=alpha.getByRole('button',{name:'Toggle Alpha'});
  await expect(toggle).toBeVisible();

  // Actual pointer clicks on nested actions must reach their handlers.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await alpha.getByRole('button',{name:'Open Alpha'}).click();
  assert.deepEqual(await page.evaluate(()=>({toggles:window.reorderPointerProbe.toggleHits,
    opens:window.reorderPointerProbe.openHits})),{toggles:1,opens:1});
  assert.deepEqual(await page.locator('[data-reorder-item]').evaluateAll((rows)=>rows.map((row)=>row.dataset.id)),['alpha','beta']);

  // The grip still starts a real pointer drag and changes controlled order.
  const grip=alpha.locator('[data-reorder-grip]');
  const box=await grip.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2+65,{steps:6});
  await page.mouse.up();
  await expect.poll(()=>page.locator('[data-reorder-item]').evaluateAll((rows)=>rows.map((row)=>row.dataset.id)))
    .toEqual(['beta','alpha']);
  assert.deepEqual(await page.evaluate(()=>window.reorderPointerProbe.orders.at(-1)),['beta','alpha']);
  // Existing keyboard grip path remains usable after pointer input.
  await grip.focus();
  await grip.press('Space');
  await expect(grip).toHaveAttribute('aria-pressed','true');
  await grip.press('ArrowUp');
  await expect.poll(()=>page.locator('[data-reorder-item]').evaluateAll((rows)=>rows.map((row)=>row.dataset.id)))
    .toEqual(['alpha','beta']);
  await grip.press('Space');
  await expect(grip).toHaveAttribute('aria-pressed','false');
  console.log('PASS nested pointer actions, grip pointer reorder and keyboard reorder');
}finally{await browser?.close();}
