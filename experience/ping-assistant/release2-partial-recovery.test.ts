import assert from "node:assert/strict";
import { A3_FORMATTING_MIGRATION, matchesHistoricalEvaluationInput, A3_RECOVERY_BINDINGS, claimRecoveryOnce, recoveryClaimPath, sha256, validateRecoveryApproval, validateRecoveredA3Rows } from "./release2-partial-recovery";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const b = A3_RECOVERY_BINDINGS;
const runnerHash = "a".repeat(64);
const proofHash = "b".repeat(64);
const approval = (): Record<string, unknown> => ({ version: 1, status: "approved", purpose: "ping-release2-group-a3-recovery", noRetryA3: true,
  qualityCreditA3: false, continueOnly: ["A4", "A5", "A6"],
  approvedBy: "root acting under Ethan's bounded evaluation authority; independently reviewed",
  templateSha256: b.templateSha256, reviewedRecoverySha256: "d".repeat(64), approvedAt: "2026-10-21T17:00:00.000Z",
  admissionSha256: b.admissionSha256, originalInputsSha256: b.originalInputsSha256, partialReportSha256: b.partialReportSha256,
  backupDbSha256: b.backupDbSha256, providerObservationSha256: b.providerObservationSha256,
  independentReviewSha256: b.independentReviewSha256, currentRunnerSha256: runnerHash,
  offlineRuntimeProof: { sha256: proofHash, platform: "linux", nodeMajor: 22, workflowRun: "https://github.com/example/actions/runs/1" } });
const actual = () => ({ admissionSha256: b.admissionSha256, originalInputsSha256: b.originalInputsSha256,
  partialReportSha256: b.partialReportSha256, backupDbSha256: b.backupDbSha256, providerObservationSha256: b.providerObservationSha256,
  independentReviewSha256: b.independentReviewSha256, currentRunnerSha256: runnerHash, templateSha256: b.templateSha256,
  reviewedRecoverySha256: "d".repeat(64), platform: "linux", nodeMajor: 22,
  physicalAttempts: 3, accountedMicroUsd: 118528 });

async function main() {
const currentSource=await readFile(A3_FORMATTING_MIGRATION.path);
const canonicalSource=Buffer.from(currentSource.toString("utf8").replace(/\r\n/g,"\n"));
assert.match(A3_FORMATTING_MIGRATION.historicalRawSha256,/^[a-f0-9]{64}$/);
assert.equal(sha256(canonicalSource),A3_FORMATTING_MIGRATION.canonicalLfSha256);
assert.equal(matchesHistoricalEvaluationInput(A3_FORMATTING_MIGRATION.path,sha256(currentSource),currentSource),true);
assert.equal(matchesHistoricalEvaluationInput(A3_FORMATTING_MIGRATION.path,A3_FORMATTING_MIGRATION.historicalRawSha256,canonicalSource),true);
assert.equal(matchesHistoricalEvaluationInput("other.ts",A3_FORMATTING_MIGRATION.historicalRawSha256,canonicalSource),false);
assert.equal(matchesHistoricalEvaluationInput(A3_FORMATTING_MIGRATION.path,A3_FORMATTING_MIGRATION.historicalRawSha256,Buffer.concat([canonicalSource,Buffer.from("changed")])),false);

for (const [name, value] of Object.entries(b)) if (name.endsWith("Sha256")) assert.match(String(value), /^[a-f0-9]{64}$/, name);
assert.equal(sha256(await readFile("experience/ping-assistant/release2-recovery-approval.template.json")), b.templateSha256);
assert.equal(sha256(await readFile("experience/reviews/2026-10-21-ping-release2/grouped-A3-reconciliation-review.md")), b.independentReviewSha256);
assert.equal(validateRecoveryApproval(approval(), actual()).noRetryA3, true);
assert.notEqual(sha256("immutable"), sha256("tampered"));
assert.equal(recoveryClaimPath("/output"), `/output/a3-recovery-${b.partialReportSha256}-${b.a3RunId}.claimed`);
for (const mutate of [
  (v: ReturnType<typeof approval>) => { v.partialReportSha256 = "0".repeat(64); },
  (v: ReturnType<typeof approval>) => { v.currentRunnerSha256 = "0".repeat(64); },
  (v: ReturnType<typeof approval>) => { v.noRetryA3 = false; },
  (v: ReturnType<typeof approval>) => { v.continueOnly = ["A3", "A4", "A5"] as unknown as ["A4", "A5", "A6"]; },
  (v: ReturnType<typeof approval>) => { (v.offlineRuntimeProof as Record<string, unknown>).platform = "win32"; },
]) {
  const changed = approval(); mutate(changed);
  assert.throws(() => validateRecoveryApproval(changed, actual()), /a3_recovery_approval_invalid/);
}
assert.throws(() => validateRecoveryApproval(approval(), { ...actual(), platform: "win32" }), /a3_recovery_approval_invalid/);
assert.throws(() => validateRecoveryApproval(approval(), { ...actual(), physicalAttempts: 2 }), /a3_recovery_approval_invalid/);
assert.throws(() => validateRecoveryApproval(approval(), { ...actual(), accountedMicroUsd: 2_900_000 }), /a3_recovery_approval_invalid/);
assert.throws(() => validateRecoveryApproval({ ...approval(), extra: true }, actual()), /a3_recovery_approval_invalid/);
assert.throws(() => validateRecoveryApproval(approval(), { ...actual(), partialReportSha256: "0".repeat(64) }), /a3_recovery_approval_invalid/);
const dir = await mkdtemp(join(tmpdir(), "ping-a3-recovery-"));
try {
  const claim = recoveryClaimPath(dir);
  await claimRecoveryOnce(claim, "bound-report-sha256");
  await assert.rejects(claimRecoveryOnce(claim, "bound-report-sha256"));
} finally { await rm(dir, { recursive: true, force: true }); }
const rows:Record<string,unknown>[]=[{caseId:"A1"},{caseId:"A2"},{caseId:"A3",status:"provider_failed_no_answer_no_quality_credit",
  runId:b.a3RunId,requestId:b.a3RequestId,providerAttemptProvenance:"external provider reconciliation",providerAttempt:{dispatched:true,physical:"settled",logical:"failed",
    httpStatus:499,providerRequestId:b.a3ProviderRequestId},usage:{qualityCredit:0,outputTokens:0,estimatedCostMicrousd:b.estimatedMicroUsd}},
  {caseId:"A4"},{caseId:"A5"},{caseId:"A6"}];
const lineage:Record<string,unknown>={kind:"a3-provider-failure-reconciled-v1",originalReportSha256:b.partialReportSha256,
  originalBackupDbSha256:b.backupDbSha256,originalInputsSha256:b.originalInputsSha256,providerObservationSha256:b.providerObservationSha256,independentReviewSha256:b.independentReviewSha256,
  a3QualityCredit:0,attemptsCarried:b.priorPhysicalAttempts,estimatedMicroUsdCarried:b.priorEstimatedMicroUsd};
assert.equal(validateRecoveredA3Rows(rows,lineage),true);
assert.equal(validateRecoveredA3Rows(rows.map((row,index)=>index===2?{...row,status:"ready"}:row),lineage),false);
assert.equal(validateRecoveredA3Rows(rows,{...lineage,originalReportSha256:"0".repeat(64)}),false);
process.stdout.write("release2 partial recovery approval tests passed\n");
}
void main();
