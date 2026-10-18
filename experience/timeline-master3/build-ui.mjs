import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
/** Bundle the real artifact. No product rendering, model or service substitutes. */
export async function buildUi(source,output){
 const require=createRequire(path.join(source,'package.json'));
 const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {TimelineArtifact} from '${source.replaceAll('\\','/')}/src/modules/timeline/components/artifact/timeline-artifact';
 const fixture=JSON.parse(document.getElementById('fixture-data').textContent);const query=new URLSearchParams(location.search);
 createRoot(document.getElementById('artifact-root')).render(<TimelineArtifact timeline={fixture.dto} privatePreview={fixture.viewerScenario==='owner'} theme={query.get('theme')==='dark'?'dark':'light'}/>);
 window.__MASTER3_FIXTURE_READY__={fixtureId:fixture.fixtureId,synthetic:true,followService:'unavailable',renderedComponent:'TimelineArtifact'};`;
 await fs.mkdir(output,{recursive:true});
 const bundle=await esbuild.build({absWorkingDir:source,stdin:{contents:entry,resolveDir:source,loader:'tsx'},bundle:true,write:false,outdir:output,platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},alias:{'@':path.join(source,'src')},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},external:['/fonts/*']});
 for(const file of bundle.outputFiles)await fs.writeFile(path.join(output,file.path.endsWith('.js')?'app.js':'app.css'),file.contents);
 const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
 const css=await postcss([require('@tailwindcss/postcss')({base:source})]).process(await fs.readFile(path.join(source,'src/app/globals.css'),'utf8'),{from:path.join(source,'src/app/globals.css')});
 await fs.writeFile(path.join(output,'globals.css'),css.css);
 const font=path.join(source,'node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2');await fs.access(font);return {font};
}
export function fixtureHtml(fixture,theme,textSpacing=false){
 const json=JSON.stringify(fixture).replaceAll('<','\\u003c');
 return `<!doctype html><html lang="en" data-theme="${theme}" style="color-scheme:${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic Master 3 fixture</title><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/app.css"><style>@font-face{font-family:Geist;font-weight:100 900;src:url('/Geist.woff2')}html,body{margin:0;min-height:100%;font-family:Geist,Arial,sans-serif}#fixture-label{position:fixed;bottom:0;right:0;z-index:2147483647;max-width:320px;padding:3px 7px;background:#fff;color:#202020;border:1px solid #777;font:11px Arial,sans-serif;pointer-events:none}body{background:var(--v3-canvas,#fafafa);color:var(--v3-text,#161616)}${textSpacing?'#artifact-root *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}#artifact-root p{margin-bottom:2em!important}':''}</style></head><body><aside id="fixture-label" aria-label="Fixture notice">Invented local design data · no auth, follow service or publication</aside><main id="artifact-root"></main><script type="application/json" id="fixture-data">${json}</script><script src="/app.js"></script></body></html>`;
}
