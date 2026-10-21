import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';

/** Isolated UI bundle that mounts the real Ping view with an authorized synthetic source. */
export async function buildRelease2Ui(source, output) {
  const require=createRequire(source+'/package.json');
  const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
  const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{PingPersonalAssistant}from'${source}/src/components/app/messages/ping-personal-assistant';import{ConversationWorkspace}from'${source}/src/components/app/messages/conversation-workspace';import{ConversationSessionProvider}from'${source}/src/components/app/messages/conversation-session-provider';
const projects=[{id:window.__PING_PROJECT_ID__,name:'Synthetic launch'}];
const query=new URLSearchParams(location.search),conversation=location.pathname==='/conversation'||location.pathname==='/app/messages';
const view=conversation?<ConversationSessionProvider actorId='owner'><ConversationWorkspace actorId='owner' fixtureActor='owner' directMessagesEnabled privatePingEnabled projects={projects} visible initialProjectId={query.get('projectId')||window.__PING_PROJECT_ID__} initialConversationId={query.get('conversationId')||undefined} initialMessageId={query.get('messageId')||undefined} initialMessageSeq={Number(query.get('messageSeq'))||undefined}/></ConversationSessionProvider>:<PingPersonalAssistant actorId='owner' projects={projects} visible onBack={()=>history.back()} backLabel='All chats' source={window.__PING_SOURCE__} initialProjectId={window.__PING_PROJECT_ID__}/>;
createRoot(document.getElementById('root')).render(view);`;
  const stubs=new Map([
    ['fixture:conversation-workspace',`export function ConversationWorkspace(){return <p>Conversation messages use the canonical service fixture.</p>}`],
    ['fixture:demo-messages-app',`export function DemoMessagesApp(){return <p>Demo conversations are outside this check.</p>}`],
    ['fixture:personal-chat',`export function PersonalChat(){return <p>Saved notes are outside this check.</p>}`],
    ['next/link',`import React from 'react';export default function Link({prefetch,scroll,children,...props}){return <a {...props}>{children}</a>}`],
    ['next/navigation',`export const usePathname=()=>'/app/messages';export const useRouter=()=>({refresh(){},push(href){(window.__ASSISTANT_NAVIGATIONS__??=[]).push(href)},replace(){}});export const useSearchParams=()=>new URLSearchParams();`],
    ['next/dynamic',`import React,{lazy,Suspense}from'react';export default function dynamic(load){const View=lazy(()=>load().then(m=>({default:m.default??m})));return props=><Suspense fallback={<p>Loading Ping…</p>}><View {...props}/></Suspense>}`],
    ['@clerk/nextjs',`export const useUser=()=>({user:{fullName:'Synthetic owner'}});export const useAuth=()=>({isLoaded:true,userId:'owner'});`],
    ['@/components/shell/app-sidebar',`export const projectColor=()=> '#6366f1';`],
  ]);
  const bundle=await esbuild.build({absWorkingDir:source,stdin:{contents:entry,resolveDir:source,loader:'tsx'},bundle:true,write:false,outdir:output,platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},alias:{'@':path.join(source,'src')},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},external:['/fonts/*'],plugins:[{name:'fixture-seams',setup(build){build.onResolve({filter:/.*/},args=>{if(args.importer.endsWith('floating-chat-root.tsx')&&['./conversation-workspace','./demo-messages-app','./personal-chat'].includes(args.path))return{path:'fixture:'+args.path.slice(2),namespace:'fixture'};return stubs.has(args.path)?{path:args.path,namespace:'fixture'}:undefined});build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs.get(args.path),loader:'tsx',resolveDir:source}));}}]});
  for(const f of bundle.outputFiles)await fs.writeFile(path.join(output,f.path.endsWith('.js')?'app.js':'app.css'),f.contents);
  const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
  const css=await postcss([require('@tailwindcss/postcss')({base:source})]).process(await fs.readFile(source+'/src/app/globals.css','utf8'),{from:source+'/src/app/globals.css'});
  await fs.writeFile(output+'/globals.css',css.css);
  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ping Release 2 · synthetic receiver</title><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/app.css"><style>html,body{height:100%;margin:0}body{display:flex;flex-direction:column;font-family:Geist,Arial,sans-serif;background:var(--v3-canvas);color:var(--v3-text)}.fixture-label{flex:none;padding:8px 16px;font-size:12px;border-bottom:1px solid var(--v3-border)}#root{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto}@font-face{font-family:Geist;src:url('/Geist.woff2')}</style></head><body><div class="fixture-label">Synthetic SQLite · actual Ping and conversation UI/server actions · injected finite planner · no live credentials or model calls</div><div id="root"></div><script>window.__PING_SOURCE__=__PING_SOURCE_JSON__;window.__PING_PROJECT_ID__=__PING_PROJECT_ID_JSON__</script><script src="/app.js"></script></body></html>`;
}
