import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node build-fixture.mjs <App checkout> <scratch output>');
const repo = path.resolve(process.argv[2]).replaceAll('\\', '/');
const out = path.resolve(process.argv[3]);
const requireRepo = createRequire(path.join(repo, 'package.json'));
const esbuild = createRequire(requireRepo.resolve('tsx'))('esbuild');
const postcss = createRequire(requireRepo.resolve('@tailwindcss/postcss'))('postcss');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'boundaries.tsx'), `
import React from 'react';
import { buildBriefing } from '${repo}/src/modules/signal/lib/briefing/build';
export { calendarDayDifference, localWeekday } from '${repo}/src/modules/signal/lib/briefing/calendar-time';
export default function Link({href, children, className}) { return <a href={href} className={className}>{children}</a>; }
export const HomeItemLink = Link;
export const HomeViewedPing = () => null;
export async function buildBriefingForUser() {
 const now = Date.parse('2026-09-04T12:00:00Z');
 const titles = ['Confirm the ceremony reading', 'Review the supplier arrival plan', 'Choose the final music', 'Check the room layout', 'Confirm transport timing', 'Review the weekend plan'];
 const signals = titles.map((title, i) => ({id:'fixture-task-'+i, title, lane:'in-flight', priority:2, dueAt:i===0?now-86400000:null, idleDays:0, commentCount:0, blockedBy:[], sourceLabel:'Tasks · Our wedding', movedToShippedAt:null, workspaceId:'project-b'}));
 const briefing = await buildBriefing({getSignalsForUser:async()=>signals}, {userId:'synthetic-home-reader'}, now, {timezone:'Europe/Dublin'});
 return {kind:'ok', briefing, signals, authorizedScope:{label:'Our wedding', timezone:'Europe/Dublin', scope:{kind:'workspace', workspaceId:'project-b'}}};
}
`);
fs.writeFileSync(path.join(out, 'entry.tsx'), `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadHomeData } from '${repo}/src/app/app/home/home-data';
import { HomeView } from '${repo}/src/components/app/home/home-view';
export async function render() { const data = await loadHomeData({clerkId:'synthetic-home-reader'}); return {data, html:renderToStaticMarkup(<HomeView data={data}/>)}; }
`);
const boundaries = new Set(['next/link', './home-analytics', '@/modules/signal/home']);
await esbuild.build({entryPoints:[path.join(out,'entry.tsx')], outfile:path.join(out,'render.cjs'), bundle:true, platform:'node', format:'cjs', jsx:'automatic', tsconfig:path.join(repo,'tsconfig.json'), nodePaths:[path.join(repo,'node_modules')], plugins:[{name:'explicit-fixture-boundaries', setup(build) {
 build.onResolve({filter:/.*/}, args => args.path==='server-only' ? {path:'empty', namespace:'fixture'} : boundaries.has(args.path) ? {path:path.join(out,'boundaries.tsx')} : undefined);
 build.onLoad({filter:/.*/, namespace:'fixture'}, () => ({contents:'', loader:'js'}));
}}]});
const { render } = await import(pathToFileURL(path.join(out,'render.cjs')).href);
const rendered = await render();
const cssFile = path.join(repo,'src/app/globals.css');
const css = await postcss([requireRepo('@tailwindcss/postcss')({base:repo})]).process(fs.readFileSync(cssFile,'utf8'), {from:cssFile});
fs.writeFileSync(path.join(out,'bundle.css'), css.css);
fs.writeFileSync(path.join(out,'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><link rel="icon" href="data:,"><title>Home aggregate link fixture</title></head><body><aside class="border-b border-line-soft p-3 text-xs text-ink-soft">Isolated Home render · real engine, projection and component · synthetic authorised project; analytics and framework links replaced.</aside><main>'+rendered.html+'</main></body></html>');
const inputs = ['src/app/app/home/home-data.ts','src/components/app/home/home-view.tsx','src/modules/signal/lib/briefing/build.ts','src/app/globals.css'];
fs.writeFileSync(path.join(out,'source-receipt.json'), JSON.stringify({createdAt:new Date().toISOString(), boundaries:[...boundaries,'server-only'], inputs:Object.fromEntries(inputs.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex')])), data:rendered.data},null,2));
console.log('Built actual Home engine, projection and component with explicit synthetic server boundaries.');
