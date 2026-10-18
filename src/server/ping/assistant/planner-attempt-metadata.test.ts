import test from "node:test";
import assert from "node:assert/strict";
import {ATTEMPT_STAGES,parsePlannerAttemptMetadata, type PlannerAttemptMetadata} from "./planner-attempt-metadata";
const sample=():PlannerAttemptMetadata=>({version:'ping.planner-attempt.v1',revision:0,model:'claude-sonnet-5-5',maxOutputTokens:4096,effort:'medium',deadlineMs:60000,logical:'pending',physical:'pending',dispatched:false,httpStatus:null,providerRequestId:null,stopReason:null,failureCode:null,cacheReadTokens:null,cacheWriteTokens:null,cacheWrite5mTokens:null,cacheWrite1hTokens:null,ttftMs:null,hiddenReasoning:null,stages:Object.fromEntries(ATTEMPT_STAGES.map(k=>[k,null])) as PlannerAttemptMetadata['stages']});
test('closed metadata rejects private content, unknown fields, invalid IDs and invented timing',()=>{
  assert.deepEqual(parsePlannerAttemptMetadata(sample()),sample());
  for(const extra of [{prompt:'private'},{providerRequestId:'secret'},{hiddenReasoning:'private'},{ttftMs:2},{logical:'arbitrary'},
    {stages:{...sample().stages,body:NaN}},{stages:{...sample().stages,body:-1}},{revision:101}])assert.equal(parsePlannerAttemptMetadata({...sample(),...extra}),null);
  const input=sample(),parsed=parsePlannerAttemptMetadata(input)!;parsed.stages.logical=10;assert.equal(input.stages.logical,null);
});
