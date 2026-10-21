import { createHash } from "node:crypto";
import { open } from "node:fs/promises";

export const A3_RECOVERY_BINDINGS = Object.freeze({
  originalInputsSha256: "a81975c2f1d7232346bf20e0c040e1372bbc13a2fb6bcad42aff2690b7986eb6",
  partialReportSha256: "1cd9d108389315a9184f434f1ae9318b0938f362fb9b886852e5ec7e9833b8f4",
  backupDbSha256: "89e7d4c5f13777a0bbcbc2bc584d53757031d8279620d471ebf2ea2815cecc66",
  providerObservationSha256: "89733f769f00d370b6636d1289fa56118d790bbdac775f36c9891655f117aaa4",
  independentReviewSha256: "c696caaed356820792cceb6d412b677d71a5f745f44ef8e3b1aed5c7df9e05f8",
  admissionSha256: "685b6b6ffa3f1ee98f71f105d8ee0ea66a4d5ffa48b1c302c9be53cb00d8352b",
  templateSha256: "9f6619d1946c8a23de8ecd3461186c3cac9f032bd03d67231847f2d5b3852073",
  a3RunId: "4c1f9d5b-014b-4a50-ba28-98a83b56f282",
  a3RequestId: "r2eval_a3_1430a649",
  a3ProviderRequestId: "req_011CgFbJWStQAwMjsVBtUtA3",
  inputTokens: 19049,
  outputTokens: 0,
  estimatedMicroUsd: 38098,
  priorPhysicalAttempts: 3,
  priorEstimatedMicroUsd: 118528,
  maxPhysicalAttempts: 63,
  maxAccountedMicroUsd: 5_000_000,
});

export const A3_FORMATTING_MIGRATION = Object.freeze({
  path: "src/server/ping/assistant/task-context.ts",
  historicalRawSha256: "8eaeb0c9de2c067f8897430d67bbd3f25b55901965174905fee21388fe0f0a94",
  canonicalLfSha256: "54b351fa66f10a561d09bcc16b026ed7c5e9deae6fafdb1cc9bfeeafded89cfb",
  reason: "Four CRLF line endings normalized by Git; source text and prompt logic are unchanged.",
});

export function matchesHistoricalEvaluationInput(path: string, expectedSha256: string, bytes: Uint8Array): boolean {
  const actual = sha256(bytes);
  return actual === expectedSha256 || path === A3_FORMATTING_MIGRATION.path &&
    expectedSha256 === A3_FORMATTING_MIGRATION.historicalRawSha256 && actual === A3_FORMATTING_MIGRATION.canonicalLfSha256;
}

export type RecoveryApproval = Readonly<{
  version: 1;
  status: "approved";
  purpose: "ping-release2-group-a3-recovery";
  noRetryA3: true;
  qualityCreditA3: false;
  continueOnly: readonly ["A4", "A5", "A6"];
  approvedBy: "root acting under Ethan's bounded evaluation authority; independently reviewed";
  templateSha256: string;
  reviewedRecoverySha256: string;
  approvedAt: string;
  admissionSha256: string;
  originalInputsSha256: string;
  partialReportSha256: string;
  backupDbSha256: string;
  providerObservationSha256: string;
  independentReviewSha256: string;
  currentRunnerSha256: string;
  offlineRuntimeProof: Readonly<{ sha256: string; platform: "linux"; nodeMajor: 22; workflowRun: string }>;
}>;

export function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateRecoveryApproval(value: unknown, actual: Readonly<{
  admissionSha256: string;
  originalInputsSha256: string;
  partialReportSha256: string;
  backupDbSha256: string;
  providerObservationSha256: string;
  independentReviewSha256: string;
  currentRunnerSha256: string;
  templateSha256: string;
  reviewedRecoverySha256: string;
  platform: string;
  nodeMajor: number;
  physicalAttempts: number;
  accountedMicroUsd: number;
}>): RecoveryApproval {
  const a = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const proof = a.offlineRuntimeProof && typeof a.offlineRuntimeProof === "object"
    ? a.offlineRuntimeProof as Record<string, unknown> : {};
  const expectedKeys = ["version","status","purpose","noRetryA3","qualityCreditA3","continueOnly","approvedBy","templateSha256","reviewedRecoverySha256","approvedAt",
    "admissionSha256","originalInputsSha256","partialReportSha256","backupDbSha256","providerObservationSha256","independentReviewSha256","currentRunnerSha256","offlineRuntimeProof"].sort();
  const proofKeys = ["sha256","platform","nodeMajor","workflowRun"].sort();
  const pinned = A3_RECOVERY_BINDINGS;
  if (Object.keys(a).sort().join("\0") !== expectedKeys.join("\0") || Object.keys(proof).sort().join("\0") !== proofKeys.join("\0") ||
      a.version !== 1 || a.status !== "approved" || a.purpose !== "ping-release2-group-a3-recovery" ||
      a.noRetryA3 !== true || a.qualityCreditA3 !== false || JSON.stringify(a.continueOnly) !== JSON.stringify(["A4", "A5", "A6"]) ||
      a.approvedBy !== "root acting under Ethan's bounded evaluation authority; independently reviewed" ||
      a.templateSha256 !== pinned.templateSha256 || a.templateSha256 !== actual.templateSha256 ||
      a.reviewedRecoverySha256 !== actual.reviewedRecoverySha256 || !/^[a-f0-9]{64}$/.test(String(a.reviewedRecoverySha256)) ||
      typeof a.approvedAt !== "string" || !Number.isFinite(Date.parse(a.approvedAt)) ||
      a.admissionSha256 !== pinned.admissionSha256 || a.admissionSha256 !== actual.admissionSha256 ||
      a.originalInputsSha256 !== pinned.originalInputsSha256 || a.originalInputsSha256 !== actual.originalInputsSha256 ||
      a.partialReportSha256 !== pinned.partialReportSha256 || a.partialReportSha256 !== actual.partialReportSha256 ||
      a.backupDbSha256 !== pinned.backupDbSha256 || a.backupDbSha256 !== actual.backupDbSha256 ||
      a.providerObservationSha256 !== pinned.providerObservationSha256 || a.providerObservationSha256 !== actual.providerObservationSha256 ||
      a.independentReviewSha256 !== pinned.independentReviewSha256 || a.independentReviewSha256 !== actual.independentReviewSha256 ||
      a.currentRunnerSha256 !== actual.currentRunnerSha256 || !/^[a-f0-9]{64}$/.test(String(a.currentRunnerSha256)) ||
      proof.sha256 === undefined || !/^[a-f0-9]{64}$/.test(String(proof.sha256)) || proof.platform !== "linux" ||
      actual.platform !== "linux" || proof.nodeMajor !== 22 || actual.nodeMajor !== 22 ||
      typeof proof.workflowRun !== "string" || !proof.workflowRun.trim() ||
      actual.physicalAttempts !== pinned.priorPhysicalAttempts || actual.accountedMicroUsd !== pinned.priorEstimatedMicroUsd ||
      actual.physicalAttempts + 3 > pinned.maxPhysicalAttempts ||
      actual.accountedMicroUsd + 2_163_840 > pinned.maxAccountedMicroUsd) {
    throw new Error("a3_recovery_approval_invalid");
  }
  return value as RecoveryApproval;
}

export function recoveryClaimPath(outputRoot: string): string {
  return `${outputRoot}/a3-recovery-${A3_RECOVERY_BINDINGS.partialReportSha256}-${A3_RECOVERY_BINDINGS.a3RunId}.claimed`;
}

export async function claimRecoveryOnce(path: string, binding: string): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try { await handle.writeFile(`${binding}\n`, "utf8"); await handle.sync(); }
  finally { await handle.close(); }
}

export function validateRecoveredA3Rows(rows: readonly Record<string, unknown>[], lineage: Record<string, unknown>): boolean {
  const row = rows[2], usage = row?.usage && typeof row.usage === "object" ? row.usage as Record<string, unknown> : {};
  const attempt = row?.providerAttempt && typeof row.providerAttempt === "object" ? row.providerAttempt as Record<string, unknown> : {};
  const attempts = rows.slice(3).map(item => item.caseId);
  return rows.length === 6 && rows[0]?.caseId === "A1" && rows[1]?.caseId === "A2" && rows[2]?.caseId === "A3" &&
    row?.status === "provider_failed_no_answer_no_quality_credit" && row.runId === A3_RECOVERY_BINDINGS.a3RunId &&
    row.requestId === A3_RECOVERY_BINDINGS.a3RequestId && typeof row.providerAttemptProvenance === "string" &&
    attempt.dispatched === true && attempt.physical === "settled" && attempt.logical === "failed" && attempt.httpStatus === 499 &&
    attempt.providerRequestId === A3_RECOVERY_BINDINGS.a3ProviderRequestId && usage.qualityCredit === 0 && usage.outputTokens === 0 &&
    usage.estimatedCostMicrousd === A3_RECOVERY_BINDINGS.estimatedMicroUsd && lineage.kind === "a3-provider-failure-reconciled-v1" &&
    lineage.originalReportSha256 === A3_RECOVERY_BINDINGS.partialReportSha256 && lineage.originalBackupDbSha256 === A3_RECOVERY_BINDINGS.backupDbSha256 &&
    lineage.originalInputsSha256 === A3_RECOVERY_BINDINGS.originalInputsSha256 &&
    lineage.providerObservationSha256 === A3_RECOVERY_BINDINGS.providerObservationSha256 &&
    lineage.independentReviewSha256 === A3_RECOVERY_BINDINGS.independentReviewSha256 && lineage.a3QualityCredit === 0 &&
    lineage.attemptsCarried === A3_RECOVERY_BINDINGS.priorPhysicalAttempts && lineage.estimatedMicroUsdCarried === A3_RECOVERY_BINDINGS.priorEstimatedMicroUsd &&
    JSON.stringify(attempts) === JSON.stringify(["A4", "A5", "A6"]);
}

