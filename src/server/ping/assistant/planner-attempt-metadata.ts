import "server-only";
export const PLANNER_ATTEMPT_VERSION = "ping.planner-attempt.v1";
export const ATTEMPT_STAGES = ["reservation", "headers", "body", "validation", "accounting", "logical", "physical"] as const;
export type PlannerAttemptMetadata = {
  version: typeof PLANNER_ATTEMPT_VERSION; revision: number;
  model: "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5";
  maxOutputTokens: number; effort: "medium" | null; deadlineMs: number;
  logical: "pending" | "completed" | "failed" | "deadline" | "cancelled";
  physical: "pending" | "settled"; dispatched: boolean;
  httpStatus: number | null; providerRequestId: string | null;
  stopReason: "end_turn" | "max_tokens" | "refusal" | "other" | null;
  // `plan` remains accepted for persisted records from before these safe subtypes existed.
  failureCode: "provider" | "response" | "plan" | "plan_json" | "plan_envelope" | "plan_schema" | "budget" | "accounting" | "request" | null;
  cacheReadTokens: number | null; cacheWriteTokens: number | null; cacheWrite5mTokens: number | null; cacheWrite1hTokens: number | null;
  ttftMs: null; hiddenReasoning: null;
  stages: Record<typeof ATTEMPT_STAGES[number], number | null>;
};
const keys = ["version","revision","model","maxOutputTokens","effort","deadlineMs","logical","physical","dispatched","httpStatus","providerRequestId","stopReason","failureCode","cacheReadTokens","cacheWriteTokens","cacheWrite5mTokens","cacheWrite1hTokens","ttftMs","hiddenReasoning","stages"];
const object = (v: unknown): v is Record<string,unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const natural = (v: unknown,max:number):boolean => Number.isSafeInteger(v) && Number(v)>=0 && Number(v)<=max;
/** Closed private projection: never accepts arbitrary labels, body text or errors. */
export function parsePlannerAttemptMetadata(value: unknown): PlannerAttemptMetadata | null {
  if(!object(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k))||
    value.version!==PLANNER_ATTEMPT_VERSION||!natural(value.revision,100)||
    !["claude-haiku-5-5","claude-sonnet-5-5","claude-opus-5-5"].includes(String(value.model))||
    !natural(value.maxOutputTokens,16_384)||Number(value.maxOutputTokens)<1||!natural(value.deadlineMs,120_000)||Number(value.deadlineMs)<1||
    ![null,"medium"].includes(value.effort as null)||!["pending","completed","failed","deadline","cancelled"].includes(String(value.logical))||
    !["pending","settled"].includes(String(value.physical))||typeof value.dispatched!=="boolean"||
    !(value.httpStatus===null||natural(value.httpStatus,599)&&Number(value.httpStatus)>=100)||
    !(value.providerRequestId===null||typeof value.providerRequestId==="string"&&/^req_[A-Za-z0-9_-]{1,120}$/.test(value.providerRequestId))||
    ![null,"end_turn","max_tokens","refusal","other"].includes(value.stopReason as null)||
    ![null,"provider","response","plan","plan_json","plan_envelope","plan_schema","budget","accounting","request"].includes(value.failureCode as null)||
    [value.cacheReadTokens,value.cacheWriteTokens,value.cacheWrite5mTokens,value.cacheWrite1hTokens].some(n=>n!==null&&!natural(n,1_000_000))||
    value.ttftMs!==null||value.hiddenReasoning!==null||!object(value.stages)||Object.keys(value.stages).length!==ATTEMPT_STAGES.length||
    ATTEMPT_STAGES.some(k=>!Object.hasOwn(value.stages as object,k)||((value.stages as Record<string,unknown>)[k]!==null&&
      !(typeof (value.stages as Record<string,unknown>)[k]==="number"&&Number.isFinite((value.stages as Record<string,number>)[k])&&(value.stages as Record<string,number>)[k]>=0&&(value.stages as Record<string,number>)[k]<=300_000))))return null;
  return structuredClone(value) as PlannerAttemptMetadata;
}
