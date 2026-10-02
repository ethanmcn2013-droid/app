export const WORKLOAD = Object.freeze({
  sessions: Object.freeze({ chat: 4, browsing: 4, hidden: 2 }),
  repetitions: 3,
  warmupMs: 5 * 60_000,
  measuredMs: 20 * 60_000,
  totalRequestCap: 30_000,
  chatPollMs: 1_000,
  chatSendMs: 60_000,
  browseListMs: 15_000,
  browseDataMs: 30_000,
  taskMutationMs: 60_000,
});

function integerInRange(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer from ${min} through ${max}`);
  }
}

export function estimateMixedRequestCount({ repetitions = WORKLOAD.repetitions } = {}) {
  integerInRange(repetitions, 1, WORKLOAD.repetitions, "repetitions");
  const duration = WORKLOAD.warmupMs + WORKLOAD.measuredMs;
  const countEvery = (count, interval) => Array.from({ length: count }, (_, index) =>
    Math.ceil((duration - index * 1_000) / interval)).reduce((sum, value) => sum + value, 0);
  const perRepeat = countEvery(WORKLOAD.sessions.chat, WORKLOAD.chatPollMs)
    + countEvery(WORKLOAD.sessions.chat, WORKLOAD.chatSendMs)
    + countEvery(WORKLOAD.sessions.browsing, WORKLOAD.browseListMs)
    + countEvery(WORKLOAD.sessions.browsing, WORKLOAD.browseDataMs)
    + countEvery(WORKLOAD.sessions.browsing, WORKLOAD.taskMutationMs);
  return perRepeat * repetitions;
}

/** Return deterministic nominal request slots, with sessions staggered over one minute. */
export function buildMixedWorkloadSchedule({ repetitions = WORKLOAD.repetitions, requestCap = WORKLOAD.totalRequestCap } = {}) {
  integerInRange(repetitions, 1, WORKLOAD.repetitions, "repetitions");
  integerInRange(requestCap, 1, WORKLOAD.totalRequestCap, "requestCap");
  const estimatedRequests = estimateMixedRequestCount({ repetitions });
  if (estimatedRequests > requestCap) {
    throw new RangeError(`planned request count ${estimatedRequests} exceeds cap ${requestCap}`);
  }

  const runDurationMs = WORKLOAD.warmupMs + WORKLOAD.measuredMs;
  const events = [];
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    const repeatOffsetMs = (repetition - 1) * runDurationMs;
    const addSeries = (sessionType, sessionIndex, journey, intervalMs) => {
      const sessionId = `${sessionType}-${sessionIndex}`;
      const staggerMs = (sessionIndex - 1) * 1_000;
      for (let atMs = staggerMs; atMs < runDurationMs; atMs += intervalMs) {
        events.push({
          atMs: repeatOffsetMs + atMs,
          phase: atMs < WORKLOAD.warmupMs ? "warmup" : "measured",
          repetition,
          sessionId,
          journey,
          logicalOperationId: `${repetition}:${sessionId}:${journey}:${atMs}`,
        });
      }
    };

    for (let index = 1; index <= WORKLOAD.sessions.chat; index += 1) {
      addSeries("chat", index, "chat.poll", WORKLOAD.chatPollMs);
      addSeries("chat", index, "chat.send", WORKLOAD.chatSendMs);
    }
    for (let index = 1; index <= WORKLOAD.sessions.browsing; index += 1) {
      addSeries("browsing", index, "conversation.list", WORKLOAD.browseListMs);
      addSeries("browsing", index, "task.mutate", WORKLOAD.taskMutationMs);
      const staggerMs = (index - 1) * 1_000;
      for (let atMs = staggerMs; atMs < runDurationMs; atMs += WORKLOAD.browseDataMs) {
        const routes = ["home.read", "files.read", "analytics.read"];
        const journey = routes[Math.floor(atMs / WORKLOAD.browseDataMs) % routes.length];
        events.push({
          atMs: repeatOffsetMs + atMs,
          phase: atMs < WORKLOAD.warmupMs ? "warmup" : "measured",
          repetition,
          sessionId: `browsing-${index}`,
          journey,
          logicalOperationId: `${repetition}:browsing-${index}:${journey}:${atMs}`,
        });
      }
    }
  }

  events.sort((left, right) => left.atMs - right.atMs || left.sessionId.localeCompare(right.sessionId) || left.journey.localeCompare(right.journey));
  if (events.length > requestCap) throw new RangeError(`generated request count ${events.length} exceeds cap ${requestCap}`);
  return {
    sessions: { ...WORKLOAD.sessions },
    repetitions,
    warmupMs: WORKLOAD.warmupMs,
    measuredMs: WORKLOAD.measuredMs,
    nominalRequests: events.length,
    totalRequestCap: requestCap,
    nominalRequestsPerSecond: events.length / (repetitions * runDurationMs / 1_000),
    events,
  };
}
