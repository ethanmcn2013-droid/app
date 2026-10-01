export const JOURNEY_TARGETS = Object.freeze({
  "task.mutate": 800,
  "chat.send": 800,
  "chat.poll": 1_000,
  "conversation.list": 1_000,
  "home.read": 2_000,
  "files.read": 2_000,
  "analytics.read": 2_000,
});

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(fraction * sorted.length) - 1];
}

function isValidResponse(response) {
  return response && Number.isInteger(response.statusCode)
    && response.statusCode >= 100 && response.statusCode <= 599
    && typeof response.valid === "boolean"
    && typeof response.success === "boolean"
    && !(response.success && response.errorEnvelope === true);
}

/**
 * Reconcile attempt observations against expected logical operations and acceptance limits.
 * @param {{manifest?: object, observations?: object[], expectedOperations?: object[], scheduledRequestCount?: number, requestCap?: number, maxFailureRate?: number}} options
 */
export function reconcileRun({ manifest, observations, expectedOperations, scheduledRequestCount = expectedOperations?.length, requestCap = 30_000, maxFailureRate = 0.005 } = {}) {
  const findings = [];
  const fail = (code, detail) => findings.push({ code, detail });
  if (!manifest || typeof manifest !== "object" || !manifest.acceptanceTargets || typeof manifest.acceptanceTargets !== "object" || Array.isArray(manifest.acceptanceTargets)) {
    fail("MALFORMED_MANIFEST", "manifest.acceptanceTargets must define the accepted latency limits as an object");
  }
  if (!Array.isArray(observations) || !Array.isArray(expectedOperations)) {
    fail("MALFORMED_INPUT", "observations and expectedOperations must be arrays");
    return { ok: false, findings, counts: {}, byJourney: {}, offeredRequests: 0, achievedRequests: 0, sampleCounts: {} };
  }
  if (!Number.isInteger(requestCap) || requestCap < 1 || observations.length > requestCap || !Number.isInteger(scheduledRequestCount) || scheduledRequestCount < 0 || scheduledRequestCount > requestCap) {
    fail("REQUEST_CAP_BREACHED", `scheduled ${scheduledRequestCount} requests and observed ${observations.length} attempts against cap ${requestCap}`);
  }
  const unmaterializedScheduledRequests = Number.isInteger(scheduledRequestCount)
    ? Math.max(0, scheduledRequestCount - expectedOperations.length)
    : 0;
  if (Number.isInteger(scheduledRequestCount) && scheduledRequestCount !== expectedOperations.length) {
    fail("SCHEDULE_MISMATCH", `schedule offered ${scheduledRequestCount} workload slots but expectedOperations contains ${expectedOperations.length}; each offered slot must have one expected logical operation, while retries belong in observations`);
  }

  const expectedById = new Map();
  for (const [journey, target] of Object.entries(manifest?.acceptanceTargets ?? {})) {
    if (typeof journey !== "string" || journey.length === 0 || !Number.isFinite(target) || target <= 0) {
      fail("MALFORMED_ACCEPTANCE_TARGET", `latency target for ${String(journey)} must be a positive finite number`);
    }
  }
  for (const expected of expectedOperations) {
    if (!expected || typeof expected.id !== "string" || expectedById.has(expected.id)) {
      fail("MALFORMED_EXPECTED_OPERATION", `expected operation has a missing or duplicate id: ${String(expected?.id)}`);
      continue;
    }
    expectedById.set(expected.id, expected);
  }
  const attemptsByOperation = new Map();
  const byJourney = {};
  const latencies = {};
  let malformed = 0;
  let failedAttempts = 0;
  let unauthorized = 0;

  for (const [index, observation] of observations.entries()) {
    const id = observation?.logicalOperationId;
    const expected = expectedById.get(id);
    if (!expected || !observation || typeof observation.attemptId !== "string" || !Number.isInteger(observation.attemptNumber) || observation.attemptNumber < 1) {
      malformed += 1;
      fail("MALFORMED_OBSERVATION", `observation ${index} has no matching logical operation or valid attempt identity`);
      continue;
    }
    if (observation.journey !== expected.journey) {
      malformed += 1;
      fail("MALFORMED_OBSERVATION", `operation ${id} journey does not match its expected journey`);
    }
    const validResponse = isValidResponse(observation.response);
    if (!validResponse) {
      malformed += 1;
      fail("MALFORMED_RESPONSE", `attempt ${observation.attemptId} has an invalid or contradictory response`);
    }
    if (!Number.isFinite(observation.latencyMs) || observation.latencyMs < 0) {
      malformed += 1;
      fail("MALFORMED_LATENCY", `attempt ${observation.attemptId} has invalid latency`);
    } else if (observation.phase === "measured") {
      (latencies[expected.journey] ??= []).push(observation.latencyMs);
    }
    const expectedDenial = expected.expectedOutcome === "denied"
      && validResponse
      && [401, 403].includes(observation.response.statusCode)
      && (!Array.isArray(observation.effectIds) || observation.effectIds.length === 0)
      && (!Array.isArray(observation.actualProjectIds) || observation.actualProjectIds.length === 0);
    if (typeof observation.scopeAuthorized !== "boolean") {
      malformed += 1;
      fail("MALFORMED_SCOPE", `attempt ${observation.attemptId} is missing scopeAuthorized`);
    }
    if (expected.expectedOutcome === "denied" && observation.scopeAuthorized !== false) {
      fail("UNEXPECTED_AUTHORIZATION", `denied operation ${id} did not prove that scope was denied`);
    }
    if (expected.expectedOutcome !== "denied" && observation.scopeAuthorized === false &&
        observation.unauthorizedContent !== true &&
        !(Array.isArray(observation.actualProjectIds) &&
          observation.actualProjectIds.some((projectId) => projectId !== expected.projectId))) {
      fail("SCOPE_UNVERIFIED", `attempt ${observation.attemptId} did not establish its expected scope`);
    }
    if (observation.response?.success !== true && !expectedDenial) failedAttempts += 1;
    if (expected.expectedOutcome === "denied" && observation.response?.success === true) {
      fail("UNEXPECTED_AUTHORIZATION", `denied operation ${id} returned success`);
    }
    if (expected.expectedOutcome === "denied" && Array.isArray(observation.effectIds) && observation.effectIds.length > 0) {
      fail("UNEXPECTED_AUTHORIZATION_EFFECT", `denied operation ${id} produced an effect`);
    }
    if (observation.unauthorizedContent === true) {
      unauthorized += 1;
      fail("FORBIDDEN_SCOPE_EFFECT", `attempt ${observation.attemptId} observed unauthorized scope or content`);
    }
    const expectedProjectId = expected.projectId;
    if (expectedProjectId !== undefined) {
      if (!Array.isArray(observation.actualProjectIds)) {
        malformed += 1;
        fail("MALFORMED_SCOPE", `attempt ${observation.attemptId} is missing actualProjectIds for scoped operation`);
      } else if (observation.actualProjectIds.some((projectId) => projectId !== expectedProjectId)) {
        unauthorized += 1;
        fail("FORBIDDEN_SCOPE_EFFECT", `attempt ${observation.attemptId} returned a project outside expected scope`);
      }
    }
    if (!Array.isArray(observation.effectIds) || observation.effectIds.some((effectId) => typeof effectId !== "string" || effectId.length === 0)) {
      malformed += 1;
      fail("MALFORMED_EFFECTS", `attempt ${observation.attemptId} has malformed effectIds`);
    }
    (attemptsByOperation.get(id) ?? attemptsByOperation.set(id, []).get(id)).push(observation);
    (byJourney[expected.journey] ??= { offered: 0, achieved: 0, failures: 0, samples: 0 }).offered += 1;
    if ((observation.response?.success === true && validResponse) || expectedDenial) byJourney[expected.journey].achieved += 1;
    else byJourney[expected.journey].failures += 1;
    if (observation.phase === "measured") byJourney[expected.journey].samples += 1;
  }

  const missingLogicalOperations = [];
  let acknowledgedOperations = 0;
  const acknowledgedEffectIds = new Set();
  for (const [id, expected] of expectedById) {
    const attempts = attemptsByOperation.get(id) ?? [];
    if (attempts.length === 0) {
      missingLogicalOperations.push(id);
      continue;
    }
    const acknowledged = attempts.some((attempt) => attempt.acknowledged === true || attempt.response?.success === true);
    if (acknowledged) {
      acknowledgedOperations += 1;
      const effectIds = [...new Set(attempts.flatMap((attempt) => Array.isArray(attempt.effectIds) ? attempt.effectIds : []))];
      if (expected.expectedOutcome === "write" && effectIds.length !== 1) {
        fail(effectIds.length === 0 ? "ACKNOWLEDGED_WRITE_LOST" : "DUPLICATE_LOGICAL_EFFECT", `acknowledged operation ${id} produced ${effectIds.length} distinct effects`);
      }
      for (const effectId of effectIds) {
        if (acknowledgedEffectIds.has(effectId)) fail("DUPLICATE_LOGICAL_EFFECT", `effect ${effectId} is attributed to multiple logical operations`);
        acknowledgedEffectIds.add(effectId);
      }
    }
    if (expected.expectedOutcome === "write" && !acknowledged && attempts.some((attempt) => attempt.acknowledged === true)) {
      fail("ACKNOWLEDGED_WRITE_LOST", `acknowledged write ${id} has no durable result`);
    }
  }
  if (missingLogicalOperations.length > 0) fail("MISSING_LOGICAL_OPERATIONS", `${missingLogicalOperations.length} expected operations have no attempt evidence`);

  const journeys = new Set([...Object.keys(JOURNEY_TARGETS), ...Object.keys(manifest?.acceptanceTargets ?? {}), ...Object.keys(latencies)]);
  for (const journey of journeys) {
    const values = latencies[journey] ?? [];
    const p95 = percentile(values, 0.95);
    const configuredTarget = manifest?.acceptanceTargets?.[journey] ?? JOURNEY_TARGETS[journey];
    if (values.length > 0 && configuredTarget !== undefined && p95 > configuredTarget) fail("LATENCY_BREACH", `${journey} p95 ${p95}ms exceeds ${configuredTarget}ms`);
    byJourney[journey] ??= { offered: 0, achieved: 0, failures: 0, samples: 0 };
    byJourney[journey].p50Ms = percentile(values, 0.5);
    byJourney[journey].p95Ms = p95;
    byJourney[journey].maxMs = values.length ? Math.max(...values) : null;
  }

  const offeredRequests = scheduledRequestCount;
  const startedAttempts = observations.length;
  const achievedRequests = observations.filter((observation) => {
    if (!isValidResponse(observation?.response)) return false;
    if (observation.response.success === true) return true;
    const expected = expectedById.get(observation.logicalOperationId);
    return expected?.expectedOutcome === "denied" && [401, 403].includes(observation.response.statusCode)
      && Array.isArray(observation.effectIds) && observation.effectIds.length === 0
      && Array.isArray(observation.actualProjectIds) && observation.actualProjectIds.length === 0;
  }).length;
  const failureRate = offeredRequests ? failedAttempts / offeredRequests : 0;
  if (failureRate > maxFailureRate) fail("FAILURE_RATE_BREACH", `unexpected attempt failure rate ${(failureRate * 100).toFixed(3)}% exceeds ${(maxFailureRate * 100).toFixed(3)}%`);
  for (const group of Object.values(byJourney)) {
    group.failureRate = group.offered ? group.failures / group.offered : 0;
    group.offeredPerSecond = group.offered / (manifest?.measuredDurationSeconds ?? 1);
    group.achievedPerSecond = group.achieved / (manifest?.measuredDurationSeconds ?? 1);
    group.sampleCount = group.samples;
  }

  return {
    ok: findings.length === 0,
    evidenceScope: manifest?.executionMode ?? manifest?.environment?.kind ?? "unspecified",
    findings,
    counts: {
      expectedLogicalOperations: expectedById.size,
      observedAttempts: observations.length,
      acknowledgedOperations,
      missingLogicalOperations: missingLogicalOperations.length,
      malformedObservations: malformed,
      unauthorizedEffects: unauthorized,
      unmaterializedScheduledRequests,
    },
    offeredRequests,
    startedAttempts,
    achievedRequests,
    offeredPerSecond: offeredRequests / (manifest?.measuredDurationSeconds ?? 1),
    actualAttemptPerSecond: startedAttempts / (manifest?.measuredDurationSeconds ?? 1),
    achievedPerSecond: achievedRequests / (manifest?.measuredDurationSeconds ?? 1),
    failureRate,
    sampleCounts: Object.fromEntries(Object.entries(latencies).map(([journey, values]) => [journey, values.length])),
    byJourney,
  };
}
