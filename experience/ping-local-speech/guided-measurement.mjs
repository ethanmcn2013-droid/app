import assert from 'node:assert/strict';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
// Only a registered active page may advance observation state. Retired pages cannot
// reclaim an attempt; the bounded registry fails closed rather than evicting fences.
export function createMetadataFence({limit=256}={}) {
  const attempts=new Map();
  return {
    register(attemptId,pageId) {
      assert.ok(typeof attemptId==='string'&&uuid(pageId),'Invalid page registration');
      let entry=attempts.get(attemptId);
      if(!entry){assert.ok(attempts.size<limit,'Page registry capacity reached');entry={active:null,pages:new Map()};attempts.set(attemptId,entry);}
      assert.ok(entry.active===pageId||!entry.pages.has(pageId),'Retired page cannot reclaim attempt');
      assert.ok(entry.pages.has(pageId)||entry.pages.size<limit,'Page registry capacity reached');
      entry.active=pageId;if(!entry.pages.has(pageId))entry.pages.set(pageId,0);
    },
    accept(attemptId,pageId,sequence) {
      const entry=attempts.get(attemptId);
      assert.ok(entry?.active===pageId,'Unregistered or retired observation page');
      assert.ok(Number.isSafeInteger(sequence)&&sequence>0&&sequence<=1000000,'Invalid metadata sequence');
      if(sequence<=entry.pages.get(pageId))return false;
      entry.pages.set(pageId,sequence);return true;
    },
  };
}

const keys=['runtime','platform','architecture','browser','viewport','buildMode','cachePolicy','warmupPolicy','cohort','harnessSha256','fixtureManifestSha256','observerMode'];
export function validateBenchmark(value) {
  assert.ok(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key)),'Unsupported benchmark metadata');
  for(const key of keys)assert.ok(typeof value[key]==='string'&&/^[A-Za-z0-9_.:+ x/-]{1,160}$/.test(value[key]),'Missing or invalid benchmark '+key);
  for(const key of ['harnessSha256','fixtureManifestSha256'])assert.match(value[key],/^[a-f0-9]{64}$/);
  return Object.fromEntries(keys.map(key=>[key,value[key]]));
}
// No environment guessing: incomplete receipts and protocol differences fail closed.
export function compareGuidedResults(before,after) {
  assert.equal(before.timingProtocol,after.timingProtocol,'Incompatible timing protocols');
  assert.equal(before.timingExtension,after.timingExtension,'Incompatible timing extensions');
  const a=validateBenchmark(before.benchmark),b=validateBenchmark(after.benchmark);
  assert.deepEqual(a,b,'Incompatible benchmark cohorts or environments');
  assert.deepEqual(before.timingStatistics,after.timingStatistics,'Incompatible statistics');
  assert.deepEqual(before.rows.map(row=>row.caseId),after.rows.map(row=>row.caseId),'Incompatible planned cases');
  const key=g=>JSON.stringify([g.metric,g.mode,g.evidence,g.clock,g.sampleOutcome,g.caseOutcome]);
  const prior=new Map(before.timingSummary.map(group=>[key(group),group]));
  assert.deepEqual([...prior.keys()].sort(),after.timingSummary.map(key).sort(),'Incompatible measured cohorts');
  return {scope:'Synthetic guided fixture comparison only',beforeCoverage:before.latencyCoverage,afterCoverage:after.latencyCoverage,
    groups:after.timingSummary.map(group=>({metric:group.metric,mode:group.mode,evidence:group.evidence,sampleOutcome:group.sampleOutcome,
      beforeCount:prior.get(key(group)).count,afterCount:group.count,
      medianDeltaMs:group.medianMs===null?null:group.medianMs-prior.get(key(group)).medianMs,
      p95DeltaMs:group.p95Ms===null?null:group.p95Ms-prior.get(key(group)).p95Ms}))};
}
