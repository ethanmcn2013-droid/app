import "server-only";
import type { PlannerAttemptMetadata } from "./planner-attempt-metadata";

export const PLANNER_RATE_CARD = "anthropic-standard-global-2026-10-18";
export const PLANNER_DEVELOPMENT_CAP_MICRO_USD = 5_000_000;
export const PLANNER_TOTAL_CAP_MICRO_USD = 100_000_000;
export type PlannerModel = "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5";
export type PlannerBudgetReservation = Readonly<{
  runId: string; requestId: string; model: PlannerModel; reservedMicroUsd: number;
  developmentCapMicroUsd: number; totalCapMicroUsd: number; rateCardId: string; attempt?: PlannerAttemptMetadata;
}>;
export type PlannerUsageRecord = Readonly<{
  runId: string; requestId: string; inputTokens: number | null; outputTokens: number | null;
  estimatedMicroUsd: number | null; state: "usage_observed" | "unknown";
}>;
/** Implementations must reserve atomically and durably before dispatch. An already
 * reserved request returns false: a response loss never authorizes another call.
 * Unknown reservations are retained. Usage is rate-card arithmetic, not a bill. */
export interface PlannerBudgetPort {
  reserve(value: PlannerBudgetReservation): Promise<boolean>;
  recordUsage(value: PlannerUsageRecord): Promise<void>;
  recordAttempt?(value: {runId:string; requestId:string; attempt:PlannerAttemptMetadata}): Promise<void>;
}
const natural = (value: number) => Number.isSafeInteger(value) && value >= 0;
export function estimatePlannerMicroUsd(model: PlannerModel, inputTokens: number, outputTokens: number): number {
  if (!natural(inputTokens) || !natural(outputTokens) || inputTokens > 1_000_000 || outputTokens > 128_000)
    throw new Error("planner_usage_invalid");
  const rates = model === "claude-haiku-5-5" ? inputTokens <= 100_000 ? [100_000, 500_000] : [500_000, 2_500_000]
    : model === "claude-sonnet-5-5" ? [2_000_000, 10_000_000]
    : model === "claude-opus-5-5" ? [4_000_000, 20_000_000] : null;
  if (!rates) throw new Error("planner_model_invalid");
  return Math.ceil((inputTokens * rates[0] + outputTokens * rates[1]) / 1_000_000);
}
export function estimatePlannerUsageMicroUsd(model: PlannerModel, value: {
  inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWrite5mTokens: number; cacheWrite1hTokens: number;
}): number {
  if (!Object.values(value).every(natural)) throw new Error("planner_usage_invalid");
  const totalInput=value.inputTokens+value.cacheReadTokens+value.cacheWrite5mTokens+value.cacheWrite1hTokens;
  if (!natural(totalInput) || totalInput>1_000_000 || value.outputTokens>128_000) throw new Error("planner_usage_invalid");
  const inputRate=model==="claude-haiku-5-5"?(totalInput<=100_000?100_000:500_000):model==="claude-sonnet-5-5"?2_000_000:model==="claude-opus-5-5"?4_000_000:null;
  if(inputRate===null)throw new Error("planner_model_invalid");
  const outputRate=inputRate*5;
  const cacheReadMultiplier=model==="claude-haiku-5-5"?0.1:0.05;
  return Math.ceil((value.inputTokens*inputRate+value.outputTokens*outputRate+value.cacheReadTokens*inputRate*cacheReadMultiplier+
    value.cacheWrite5mTokens*inputRate*1.25+value.cacheWrite1hTokens*inputRate*2)/1_000_000);
}
export function plannerReservation(input: {
  runId: string; requestId: string; model: PlannerModel; inputTokenUpperBound: number; maxOutputTokens: number;
}): PlannerBudgetReservation {
  for (const value of [input.runId, input.requestId]) if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error("planner_identity_invalid");
  return Object.freeze({runId: input.runId, requestId: input.requestId, model: input.model,
    reservedMicroUsd: estimatePlannerMicroUsd(input.model, input.inputTokenUpperBound, input.maxOutputTokens),
    developmentCapMicroUsd: PLANNER_DEVELOPMENT_CAP_MICRO_USD, totalCapMicroUsd: PLANNER_TOTAL_CAP_MICRO_USD,
    rateCardId: PLANNER_RATE_CARD});
}
