import test from "node:test";
import assert from "node:assert/strict";
import { runWithTargetGuard, validateTargetManifest } from "./target-manifest.mjs";

const hash = (digit) => `sha256:${digit.repeat(64)}`;
const stores = { tasks: hash("1"), notes: hash("2"), timeline: hash("3"), signal: hash("4"), attachments: hash("5") };
const sinks = [{ name: "delivery", configHash: hash("6"), mode: "disabled" }];
const manifest = {
  schemaVersion: 1,
  runId: "run-20260927",
  fixtureNamespace: "reliability-run-20260927",
  environment: { kind: "local-service-test", identity: "fixture-app", configHash: hash("a"), production: false },
  allowedOrigins: ["http://127.0.0.1:3000"],
  expectedTargetHashes: stores,
  allowedDeliverySinks: sinks,
  syntheticIdentities: ["synthetic-alice", "synthetic-bob"],
};
const observed = {
  environment: { ...manifest.environment },
  origin: "http://127.0.0.1:3000",
  targetHashes: { ...stores },
  deliverySinks: structuredClone(sinks),
  externalDeliveryEnabled: false,
  externalNetworkEnabled: false,
  syntheticIdentities: [...manifest.syntheticIdentities],
};

test("accepts an exact isolated synthetic target manifest", () => {
  assert.deepEqual(validateTargetManifest(manifest, observed), { ok: true, errors: [] });
});

test("rejects a changed DB binding before the write callback is entered", async () => {
  let writes = 0;
  const changed = structuredClone(observed);
  changed.targetHashes.tasks = hash("f");
  await assert.rejects(
    runWithTargetGuard({ manifest, observed: changed, write: () => { writes += 1; } }),
    (error) => error.code === "RELIABILITY_TARGET_REJECTED" && error.validation.errors.some((entry) => entry.includes("target hash mismatch for tasks")),
  );
  assert.equal(writes, 0);
});

test("rejects production, non-allowlisted origins, delivery and incomplete target sets", () => {
  for (const mutate of [
    (copy) => { copy.environment.production = true; },
    (copy) => { copy.origin = "https://production.example"; },
    (copy) => { copy.externalDeliveryEnabled = true; },
    (copy) => { copy.targetHashes = { tasks: hash("1") }; },
    (copy) => { copy.syntheticIdentities = ["real-account"]; },
  ]) {
    const copy = structuredClone(observed);
    mutate(copy);
    assert.equal(validateTargetManifest(manifest, copy).ok, false);
  }
});

test("rejects an invalid or non-run-specific fixture namespace", () => {
  const copy = structuredClone(manifest);
  copy.fixtureNamespace = "shared-fixture";
  assert.equal(validateTargetManifest(copy, observed).ok, false);
});

test("accepts only an explicitly identified hosted test deployment and controlled hashed actors", () => {
  const hostedManifest = structuredClone(manifest);
  const hostedObserved = structuredClone(observed);
  hostedManifest.executionMode = "hosted-authenticated-route";
  hostedManifest.environment = { kind: "hosted-test", identity: "preview-123", configHash: hash("b"), production: false };
  hostedManifest.allowedOrigins = ["https://preview-test.example"];
  hostedManifest.allowedNetworkOrigins = ["https://preview-test.example", "https://auth-test.example", "https://api.clerk.com"];
  hostedManifest.authentication = { issuer: "https://auth-test.example", configHash: hash("c"), mode: "clerk-development" };
  hostedManifest.testActors = [
    { actorHash: hash("d"), kind: "controlled-test", ownershipConfirmed: true },
    { actorHash: hash("e"), kind: "controlled-test", ownershipConfirmed: true },
  ];
  delete hostedManifest.syntheticIdentities;
  hostedObserved.environment = { ...hostedManifest.environment };
  hostedObserved.origin = hostedManifest.allowedOrigins[0];
  hostedObserved.networkOrigins = [...hostedManifest.allowedNetworkOrigins];
  hostedObserved.authentication = { ...hostedManifest.authentication };
  hostedObserved.testActors = structuredClone(hostedManifest.testActors);
  hostedObserved.externalNetworkEnabled = true;
  delete hostedObserved.syntheticIdentities;
  assert.deepEqual(validateTargetManifest(hostedManifest, hostedObserved), { ok: true, errors: [] });

  hostedObserved.networkOrigins = ["https://preview-test.example", "https://unapproved.example"];
  assert.equal(validateTargetManifest(hostedManifest, hostedObserved).ok, false);
});

test("accepts authenticated local Next only on loopback with exact Clerk issuer and BAPI allowlists", () => {
  const localManifest = structuredClone(manifest);
  const localObserved = structuredClone(observed);
  localManifest.executionMode = "authenticated-local-test";
  localManifest.environment = { kind: "authenticated-local-test", identity: "local-next-test", configHash: hash("b"), production: false };
  localManifest.allowedOrigins = ["http://127.0.0.1:3000"];
  localManifest.allowedNetworkOrigins = ["https://auth-test.example", "https://api.clerk.com"];
  localManifest.authentication = { issuer: "https://auth-test.example", configHash: hash("c"), mode: "clerk-development" };
  localManifest.testActors = [
    { actorHash: hash("d"), kind: "controlled-test", ownershipConfirmed: true },
    { actorHash: hash("e"), kind: "controlled-test", ownershipConfirmed: true },
  ];
  delete localManifest.syntheticIdentities;
  localObserved.environment = { ...localManifest.environment };
  localObserved.origin = localManifest.allowedOrigins[0];
  localObserved.networkOrigins = [...localManifest.allowedNetworkOrigins];
  localObserved.authentication = { ...localManifest.authentication };
  localObserved.testActors = structuredClone(localManifest.testActors);
  localObserved.externalNetworkEnabled = true;
  delete localObserved.syntheticIdentities;
  assert.deepEqual(validateTargetManifest(localManifest, localObserved), { ok: true, errors: [] });

  localObserved.origin = "https://production.example";
  assert.equal(validateTargetManifest(localManifest, localObserved).ok, false);
});
