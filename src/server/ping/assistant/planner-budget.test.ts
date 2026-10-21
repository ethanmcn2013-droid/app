import test from "node:test";
import assert from "node:assert/strict";
import {estimatePlannerMicroUsd, estimatePlannerUsageMicroUsd, plannerReservation, PLANNER_DEVELOPMENT_CAP_MICRO_USD, PLANNER_TOTAL_CAP_MICRO_USD} from "./planner-budget";

test("standard rates use integer microdollars, upward rounding and Haiku threshold",()=>{
  assert.equal(estimatePlannerMicroUsd("claude-haiku-5-5",8_000,2_000),1_800);
  assert.equal(estimatePlannerMicroUsd("claude-haiku-5-5",1,0),1);
  assert.equal(estimatePlannerMicroUsd("claude-haiku-5-5",100_000,1_000),10_500);
  assert.equal(estimatePlannerMicroUsd("claude-haiku-5-5",100_001,1_000),52_501);
  assert.equal(estimatePlannerMicroUsd("claude-sonnet-5-5",20_000,16_000),200_000);
  assert.equal(estimatePlannerMicroUsd("claude-opus-5-5",20_000,8_000),240_000);
});
test("cache rates use total prompt size for Haiku tier, distinguish writes and price output inclusive of thinking",()=>{
  assert.equal(estimatePlannerUsageMicroUsd("claude-sonnet-5-5",{inputTokens:100,outputTokens:20,cacheReadTokens:100,cacheWrite5mTokens:100,cacheWrite1hTokens:100}),1060);
  assert.equal(estimatePlannerUsageMicroUsd("claude-haiku-5-5",{inputTokens:1,outputTokens:0,cacheReadTokens:100_000,cacheWrite5mTokens:0,cacheWrite1hTokens:0}),5001);
});
test("reservation pins development/global caps and model ceiling rather than a token guess",()=>{
  const value=plannerReservation({runId:"run-1",requestId:"request-1",model:"claude-sonnet-5-5",inputTokenUpperBound:1_000_000,maxOutputTokens:16_384});
  assert.equal(value.reservedMicroUsd,2_163_840);
  assert.equal(value.developmentCapMicroUsd,5_000_000);assert.equal(value.totalCapMicroUsd,100_000_000);
  assert.equal(PLANNER_DEVELOPMENT_CAP_MICRO_USD,5_000_000);assert.equal(PLANNER_TOTAL_CAP_MICRO_USD,100_000_000);
  assert.ok(Object.isFrozen(value));
});
test("invalid counts, identities and models fail closed",()=>{
  for(const value of [-1,NaN,Infinity,0.1,Number.MAX_SAFE_INTEGER])assert.throws(()=>estimatePlannerMicroUsd("claude-haiku-5-5",value,1));
  assert.throws(()=>estimatePlannerMicroUsd("unknown" as never,1,1));
  assert.throws(()=>plannerReservation({runId:"private name!",requestId:"r",model:"claude-haiku-5-5",inputTokenUpperBound:1,maxOutputTokens:1}));
});
test("production reserves against $100 a month from the first of the UTC month; elsewhere the $5 development cap stays",()=>{
  const now=Date.UTC(2026,9,21,14,30);
  const production=plannerReservation({runId:"run_a",requestId:"request_a",model:"claude-sonnet-5-5",inputTokenUpperBound:1_000,maxOutputTokens:100,production:true,nowMs:now});
  assert.equal(production.developmentCapMicroUsd,100_000_000);
  assert.equal(production.totalCapMicroUsd,100_000_000);
  assert.equal(production.periodStartMs,Date.UTC(2026,9,1));
  const local=plannerReservation({runId:"run_b",requestId:"request_b",model:"claude-sonnet-5-5",inputTokenUpperBound:1_000,maxOutputTokens:100});
  assert.equal(local.developmentCapMicroUsd,PLANNER_DEVELOPMENT_CAP_MICRO_USD);
  assert.equal(local.periodStartMs,undefined);
});
