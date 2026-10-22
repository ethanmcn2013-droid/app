import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDeploymentPreflight } from './deploy-preflight.mjs';
const good = { repository:'ethanmcn2013-droid/app', dirtyTracked:[], head:'abc', originMain:'abc', vercelProject:'app', expectedVercelProject:'app', requiredChecks:[{name:'Verify',sha:'abc',conclusion:'success'}], productionDeployment:'dpl-good', expectedProductionDeployment:'dpl-good' };
test('accepts only clean, current, correctly linked and verified custody', () => { const r=evaluateDeploymentPreflight(good); assert.equal(r.ok,true); assert.equal(r.receipt.head,'abc'); });
for (const [label, change, expected] of [
 ['wrong repository',{repository:'other/app'},'repository is not ethanmcn2013-droid/app'],
 ['dirty source',{dirtyTracked:['M src/a.ts']},'tracked files are modified'],
 ['stale checkout',{head:'old'},'HEAD does not match origin/main'],
 ['wrong project',{vercelProject:'studio'},'linked Vercel project is incorrect'],
 ['failed check',{requiredChecks:[{sha:'abc',conclusion:'failure'}]},'required CI is missing, failed, or belongs to another commit'],
 ['stale production',{productionDeployment:'dpl-other'},'production deployment differs from custody baseline']
]) test(`refuses ${label}`,()=>{ const r=evaluateDeploymentPreflight({...good,...change}); assert.equal(r.ok,false); assert.ok(r.failures.includes(expected)); });
test('fails closed when CI evidence is absent',()=>assert.equal(evaluateDeploymentPreflight({...good,requiredChecks:[]}).ok,false));
