const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node build-fixture.cjs <App checkout> <scratch output directory>');
const repo = path.resolve(process.argv[2]).replaceAll('\\', '/');
const requireRepo = createRequire(path.join(repo, 'package.json'));
const esbuild = createRequire(requireRepo.resolve('tsx'))('esbuild');
const postcss = createRequire(requireRepo.resolve('@tailwindcss/postcss'))('postcss');
const tailwind = requireRepo('@tailwindcss/postcss');
const out = path.resolve(process.argv[3]);
fs.mkdirSync(out, {recursive:true});
const mock = `
import React from 'react';
export default function Link({href,children,className}) { return <a href={href} className={className}>{children}</a>; }
let failed = true;
let calls = [];
const requests = new Set();
const report = () => {
  document.querySelector('#fixture-calls').textContent = JSON.stringify(calls);
  document.querySelector('#fixture-count').textContent = 'Starter sets: ' + requests.size;
};
export function setFailure(value) { failed = value; }
async function submit(input) {
  calls.push(input);
  if (input.seedMode === 'starter' || input.reseed) requests.add(input.requestId);
  report();
  await new Promise(resolve => setTimeout(resolve, 150));
  if (failed) throw new Error('Synthetic lost response');
}
export const completeOnboardingAction = submit;
export const skipOnboardingAction = submit;
export const updateSegmentAction = submit;
export const confirmExistingSetupAction = submit;
export const useRouter = () => ({ push: url => { document.querySelector('#fixture-navigation').textContent = 'Navigation: ' + url; } });
export const useToast = () => ({ toast: text => { document.querySelector('#fixture-navigation').textContent = 'Toast: ' + text; } });
export function Dialog({open, children}) { return open ? <div role="dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="max-w-lg rounded-xl bg-white text-ink shadow-xl">{children}</div></div> : null; }
export function SectionHeader({eyebrow,title,description}) { return <header className="mb-5"><div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">{eyebrow}</div><h2 className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink">{title}</h2><p className="mt-1.5 max-w-[560px] text-[13px] leading-[1.55] text-ink-soft">{description}</p></header>; }
export const publishWorkspaceAction = async () => { throw new Error('Excluded'); };
export const unpublishWorkspaceAction = publishWorkspaceAction;
export const updateWorkspaceAction = publishWorkspaceAction;
export const setProjectBudgetAction = publishWorkspaceAction;
export const setProjectCurrencyAction = publishWorkspaceAction;
export const trackOnboardingEvent = () => {};
`;
fs.writeFileSync(path.join(out, 'boundaries.tsx'), mock);
fs.writeFileSync(path.join(out, 'entry.tsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { OnboardingFlow } from '${repo}/src/components/welcome/onboarding-flow';
import { WorkspaceSection } from '${repo}/src/components/app/settings/sections/workspace';
import { setFailure } from './boundaries';
const settings = new URLSearchParams(location.search).has('settings');
function Fixture() {
 return <><aside className="bg-bg-sunken p-3 text-xs text-ink"><strong>Isolated caller recovery fixture</strong><p>Real caller components; synthetic server actions and framework boundaries.</p><button onClick={() => setFailure(false)} className="mt-2 rounded border px-3 py-2">Allow retry to succeed</button><output id="fixture-navigation" className="ml-3">Navigation: unchanged</output><p id="fixture-count">Starter sets: 0</p><pre id="fixture-calls" className="max-w-full overflow-x-auto whitespace-pre-wrap break-all" /></aside>{settings ? <main className="mx-auto max-w-3xl p-6"><WorkspaceSection myRole="owner" workspace={{id:'project-caller-review',name:'Synthetic project',slug:'synthetic',createdAt:'2026-09-04T00:00:00Z',primaryUseCase:'other',activeDomain:'marketing',secondaryContext:null,currency:null,budgetCents:null,publishedAt:null}} /></main> : <OnboardingFlow actorUserId="caller-review" workspaceId="project-caller-review" preselectedSegment="wedding" pendingTemplate={new URLSearchParams(location.search).has("existing") ? {id:"wedding-planning-workspace",name:"Wedding planning"} : null} />}</>;
}
createRoot(document.querySelector('#root')).render(<Fixture />);
`);
const mocked = new Set(['next/navigation','next/link','@/server/actions/onboarding','@/server/actions/seed','@/server/actions/settings','@/components/primitives/toast','@/components/primitives/dialog','../settings-app','@/lib/onboarding/analytics']);
(async () => {
 await esbuild.build({ entryPoints:[path.join(out,'entry.tsx')], outfile:path.join(out,'bundle.js'), bundle:true, platform:'browser', jsx:'automatic', tsconfig:path.join(repo,'tsconfig.json'), nodePaths:[path.join(repo,'node_modules')], define:{'process.env':'{"NODE_ENV":"development"}'}, plugins:[{ name:'synthetic-request-boundaries', setup(build) { build.onResolve({filter:/.*/}, args => mocked.has(args.path) ? {path:path.join(out,'boundaries.tsx')} : undefined); } }] });
 const cssFile = path.join(repo,'src/app/globals.css');
 const css = await postcss([tailwind({base:repo})]).process(fs.readFileSync(cssFile,'utf8'), {from:cssFile});
 fs.writeFileSync(path.join(out,'bundle.css'), css.css);
 fs.writeFileSync(path.join(out,'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><title>Caller recovery fixture</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
 console.log('Built real caller components with synthetic request boundaries.');
})().catch(error => { console.error(error); process.exitCode=1; });
