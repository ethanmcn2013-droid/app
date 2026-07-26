import assert from "node:assert/strict";
import {
  isCompletedQualifiedViewResponse,
  isIntentionalEventSourceDisableResponse,
  runtimeFailures,
  type RuntimeIssue,
  type RuntimeResponse,
  type RuntimeWatch,
} from "../../experience/runtime-policy";

const pageUrl = "http://localhost:4342/app/tasks";
const eventSourceAbort: RuntimeIssue = {
  kind: "requestfailed",
  resourceType: "eventsource",
  message: "net::ERR_ABORTED",
  url: "http://localhost:4342/api/events",
};
const disabledEventSourceResponse: RuntimeResponse = {
  headers: { "x-realtime-disabled": "single-process-substrate" },
  resourceType: "eventsource",
  status: 204,
  url: eventSourceAbort.url,
};

assert.equal(
  isIntentionalEventSourceDisableResponse(disabledEventSourceResponse, pageUrl),
  true,
  "the exact marked response should attest the intentional teardown",
);

const fatalResponseVariants: Array<[string, RuntimeResponse]> = [
  ["unmarked response", { ...disabledEventSourceResponse, headers: {} }],
  ["successful stream", { ...disabledEventSourceResponse, status: 200 }],
  ["different resource type", { ...disabledEventSourceResponse, resourceType: "fetch" }],
  [
    "cross-origin endpoint",
    { ...disabledEventSourceResponse, url: "https://example.com/api/events" },
  ],
  [
    "different same-origin endpoint",
    { ...disabledEventSourceResponse, url: "http://localhost:4342/api/other" },
  ],
];

for (const [label, response] of fatalResponseVariants) {
  assert.equal(
    isIntentionalEventSourceDisableResponse(response, pageUrl),
    false,
    `${label} must not attest a benign teardown`,
  );
}

function failures(
  issue: RuntimeIssue,
  intentionalEventSourceTeardowns = new Set<string>(),
  completedQualifiedViewWrites = new Set<string>(),
) {
  const runtime: RuntimeWatch = {
    issues: [issue],
    intentionalEventSourceTeardowns,
    completedQualifiedViewWrites,
  };
  return runtimeFailures(runtime, null, pageUrl);
}

assert.deepEqual(
  failures(eventSourceAbort, new Set([eventSourceAbort.url])),
  [],
  "the exact marked same-origin realtime teardown should be benign",
);

const fatalVariants: Array<[string, RuntimeIssue, Set<string>?]> = [
  ["unmarked response", eventSourceAbort],
  [
    "cross-origin endpoint",
    { ...eventSourceAbort, url: "https://example.com/api/events" },
    new Set(["https://example.com/api/events"]),
  ],
  [
    "different same-origin endpoint",
    { ...eventSourceAbort, url: "http://localhost:4342/api/other" },
    new Set(["http://localhost:4342/api/other"]),
  ],
  [
    "query-bearing endpoint",
    { ...eventSourceAbort, url: "http://localhost:4342/api/events?retry=1" },
    new Set(["http://localhost:4342/api/events?retry=1"]),
  ],
  [
    "different resource type",
    { ...eventSourceAbort, resourceType: "fetch" },
    new Set([eventSourceAbort.url]),
  ],
  [
    "different failure",
    { ...eventSourceAbort, message: "net::ERR_CONNECTION_REFUSED" },
    new Set([eventSourceAbort.url]),
  ],
];

for (const [label, issue, marked = new Set<string>()] of fatalVariants) {
  assert.equal(failures(issue, marked).length, 1, `${label} must remain fatal`);
}

const timelinePageUrl = "http://localhost:4342/s/opaque-token";
const completedViewUrl = `${timelinePageUrl}/view`;
const completedViewResponse: RuntimeResponse = {
  headers: {},
  method: "POST",
  resourceType: "fetch",
  status: 204,
  url: completedViewUrl,
};
const completedViewAbort: RuntimeIssue = {
  kind: "requestfailed",
  resourceType: "fetch",
  message: "net::ERR_ABORTED",
  url: completedViewUrl,
};

assert.equal(
  isCompletedQualifiedViewResponse(completedViewResponse, timelinePageUrl),
  true,
  "the exact same-origin POST 204 should attest a completed qualified view",
);
assert.deepEqual(
  runtimeFailures(
    {
      issues: [completedViewAbort],
      intentionalEventSourceTeardowns: new Set(),
      completedQualifiedViewWrites: new Set([completedViewUrl]),
    },
    null,
    timelinePageUrl,
  ),
  [],
  "an abort reported after the exact POST 204 must be benign",
);
for (const [label, response] of [
  ["wrong method", { ...completedViewResponse, method: "GET" }],
  ["wrong status", { ...completedViewResponse, status: 202 }],
  ["wrong resource", { ...completedViewResponse, resourceType: "document" }],
  ["cross-origin", { ...completedViewResponse, url: "https://example.com/s/opaque-token/view" }],
] as const) {
  assert.equal(
    isCompletedQualifiedViewResponse(response, timelinePageUrl),
    false,
    `${label} must not attest a completed qualified view`,
  );
}
assert.equal(
  runtimeFailures(
    {
      issues: [completedViewAbort],
      intentionalEventSourceTeardowns: new Set(),
      completedQualifiedViewWrites: new Set(),
    },
    null,
    timelinePageUrl,
  ).length,
  1,
  "an abort without a recorded 204 must remain fatal",
);

console.log(
  "experience:runtime-policy:self-test: pass - only marked realtime teardown and an exact qualified-view POST 204 abort are benign",
);
