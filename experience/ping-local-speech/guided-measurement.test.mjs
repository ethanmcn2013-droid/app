import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetadataFence,compareGuidedResults} from './guided-measurement.mjs';
const old='00000000-0000-4000-8000-000000000001',fresh='00000000-0000-4000-8000-000000000002';
test('reload begins a new sequence; duplicates and retired pages cannot mutate observations',()=>{
 const fence=createMetadataFence();fence.register('attempt',old);assert.equal(fence.accept('attempt',old,20),true);
 fence.register('attempt',fresh);assert.equal(fence.accept('attempt',fresh,1),true);assert.equal(fence.accept('attempt',fresh,1),false);
 assert.throws(()=>fence.accept('attempt',old,21),/retired/);assert.throws(()=>fence.register('attempt',old),/reclaim/);
 assert.throws(()=>fence.accept('another',fresh,1),/Unregistered/);
});
test('bounded fences fail closed without evicting old-page protection',()=>{const fence=createMetadataFence({limit:1});fence.register('a',old);assert.throws(()=>fence.register('b',fresh),/capacity/);assert.throws(()=>fence.register('a',fresh),/capacity/);assert.equal(fence.accept('a',old,1),true);});
const benchmark={runtime:'node22',platform:'win32',architecture:'x64',browser:'chromium1',viewport:'1440x960',buildMode:'fixture',cachePolicy:'warm',warmupPolicy:'5',cohort:'synthetic',harnessSha256:'a'.repeat(64),fixtureManifestSha256:'b'.repeat(64),observerMode:'custody-sync'};
const result=()=>({timingProtocol:'ping.guided.latency.v2',timingExtension:'ping.guided.measurement.v1',benchmark,rows:[{caseId:'01'}],timingStatistics:{percentile:'nearest-rank'},timingSummary:[{metric:'apply-to-visible',mode:'scripted',evidence:'scripted',clock:'browser-monotonic',sampleOutcome:'completed',caseOutcome:'matched',count:2,medianMs:10,p95Ms:12}],latencyCoverage:{startedAttempts:2}});
test('comparator retains denominators and rejects incompatible or incomplete receipts',()=>{const a=result(),b=result();b.timingSummary[0].medianMs=8;assert.equal(compareGuidedResults(a,b).groups[0].medianDeltaMs,-2);
 for(const key of Object.keys(benchmark)){const changed=result();changed.benchmark={...benchmark,[key]:key.endsWith('Sha256')?'c'.repeat(64):'different'};assert.throws(()=>compareGuidedResults(a,changed),/Incompatible/);}
 const absent=result();delete absent.benchmark;assert.throws(()=>compareGuidedResults(a,absent));const protocol=result();protocol.timingProtocol='v1';assert.throws(()=>compareGuidedResults(a,protocol),/protocol/);
});
