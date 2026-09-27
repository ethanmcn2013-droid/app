const HASH = /^sha256:[a-f0-9]{64}$/i;
const RUN_ID = /^[a-z0-9][a-z0-9-]{7,63}$/i;

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameStringSet(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

function sinkKey(sink) {
  return `${sink.name}\u0000${sink.configHash}\u0000${sink.mode}`;
}

function validateSinkList(sinks, path, errors, { allowTest = true } = {}) {
  add(errors, Array.isArray(sinks), `${path} must be an array`);
  if (!Array.isArray(sinks)) return;
  const names = new Set();
  for (const [index, sink] of sinks.entries()) {
    const label = `${path}[${index}]`;
    add(errors, isPlainObject(sink), `${label} must be an object`);
    if (!isPlainObject(sink)) continue;
    add(errors, typeof sink.name === "string" && sink.name.trim() !== "", `${label}.name is required`);
    add(errors, !names.has(sink.name), `${path} contains duplicate sink name ${String(sink.name)}`);
    names.add(sink.name);
    add(errors, HASH.test(sink.configHash ?? ""), `${label}.configHash must be a sha256 digest`);
    add(errors, sink.mode === "disabled" || (allowTest && sink.mode === "test"), `${label}.mode must be disabled${allowTest ? " or test" : ""}`);
  }
}

/** Validate a captured manifest against the runtime's observed, non-secret target identity. */
export function validateTargetManifest(manifest, observed) {
  const errors = [];
  add(errors, isPlainObject(manifest), "manifest must be an object");
  add(errors, isPlainObject(observed), "observed target must be an object");
  if (!isPlainObject(manifest) || !isPlainObject(observed)) return { ok: false, errors };

  add(errors, manifest.schemaVersion === 1, "manifest.schemaVersion must be 1");
  add(errors, RUN_ID.test(manifest.runId ?? ""), "manifest.runId must be a stable run identifier");
  add(errors, manifest.fixtureNamespace === `reliability-${manifest.runId}`, "fixtureNamespace must be scoped to this run");

  const environment = manifest.environment;
  const actualEnvironment = observed.environment;
  add(errors, isPlainObject(environment), "manifest.environment is required");
  add(errors, isPlainObject(actualEnvironment), "observed.environment is required");
  if (isPlainObject(environment) && isPlainObject(actualEnvironment)) {
    add(errors, ["local-service-test", "authenticated-local-test", "hosted-test"].includes(environment.kind), "environment.kind must explicitly identify a non-production test environment");
    add(errors, environment.production === false, "manifest environment must explicitly be non-production");
    add(errors, actualEnvironment.production === false, "observed environment must explicitly be non-production");
    add(errors, typeof environment.identity === "string" && environment.identity.trim() !== "", "environment.identity is required");
    add(errors, environment.identity === actualEnvironment.identity, "environment identity mismatch");
    add(errors, HASH.test(environment.configHash ?? ""), "environment.configHash must be a sha256 digest");
    add(errors, environment.configHash === actualEnvironment.configHash, "environment config hash mismatch");
    add(errors, environment.kind === actualEnvironment.kind, "environment kind mismatch");
  }

  add(errors, Array.isArray(manifest.allowedOrigins) && manifest.allowedOrigins.length > 0, "at least one exact allowed origin is required");
  add(errors, typeof observed.origin === "string" && manifest.allowedOrigins?.includes(observed.origin), "observed origin is not allowlisted");
  for (const origin of manifest.allowedOrigins ?? []) {
    let parsed;
    try { parsed = new URL(origin); } catch { /* reported below */ }
    add(errors, Boolean(parsed && ["http:", "https:"].includes(parsed.protocol) && parsed.origin === origin), `allowed origin must be an exact HTTP(S) origin: ${String(origin)}`);
    if (environment?.kind === "authenticated-local-test") {
      add(errors, Boolean(parsed && parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)), "authenticated-local-test allowlisted app origins must be loopback HTTP");
    }
    if (environment?.kind === "hosted-test") {
      add(errors, Boolean(parsed && parsed.protocol === "https:"), "hosted-test allowlisted app origins must use HTTPS");
    }
  }

  const networkOrigins = manifest.allowedNetworkOrigins ?? [];
  add(errors, Array.isArray(networkOrigins), "allowedNetworkOrigins must be an array");
  if (Array.isArray(networkOrigins)) {
    for (const origin of networkOrigins) {
      let parsed;
      try { parsed = new URL(origin); } catch { /* reported below */ }
      add(errors, Boolean(parsed && ["http:", "https:"].includes(parsed.protocol) && parsed.origin === origin), `network origin must be an exact HTTP(S) origin: ${String(origin)}`);
    }
  }
  const actualNetworkOrigins = observed.networkOrigins ?? [];
  add(errors, Array.isArray(actualNetworkOrigins), "observed.networkOrigins must be an array");
  add(errors, sameStringSet(networkOrigins, actualNetworkOrigins), "observed network origins differ from the allowlist");
  if (environment?.kind === "local-service-test") {
    add(errors, observed.externalNetworkEnabled === false, "external network access must be disabled for local service tests");
  } else if (["authenticated-local-test", "hosted-test"].includes(environment?.kind)) {
    add(errors, observed.externalNetworkEnabled === true, "authenticated test network access must be explicitly enabled");
    add(errors, networkOrigins.includes("https://api.clerk.com"), "authenticated tests must allowlist the Clerk Backend API origin");
    add(errors, networkOrigins.length >= 2, "authenticated tests require explicit app-auth and Clerk Backend API origins");
    if (environment.kind === "authenticated-local-test") {
      const appOrigin = observed.origin;
      let parsed;
      try { parsed = new URL(appOrigin); } catch { /* reported below */ }
      add(errors, Boolean(parsed && parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)), "authenticated-local-test app origin must use loopback HTTP");
      add(errors, manifest.executionMode === "authenticated-local-test", "executionMode must explicitly identify authenticated local testing");
    }
    if (environment.kind === "hosted-test") {
      add(errors, manifest.executionMode === "hosted-authenticated-route", "executionMode must explicitly identify hosted authenticated route testing");
    }
  }

  if (["authenticated-local-test", "hosted-test"].includes(environment?.kind)) {
    const authentication = manifest.authentication;
    const actualAuthentication = observed.authentication;
    add(errors, isPlainObject(authentication) && isPlainObject(actualAuthentication), "hosted-test authentication identity is required");
    if (isPlainObject(authentication) && isPlainObject(actualAuthentication)) {
      add(errors, typeof authentication.issuer === "string" && authentication.issuer.trim() !== "", "authentication.issuer is required");
      add(errors, networkOrigins.includes(authentication.issuer), "authentication issuer must be included in allowedNetworkOrigins");
      add(errors, HASH.test(authentication.configHash ?? ""), "authentication.configHash must be a sha256 digest");
      add(errors, authentication.issuer === actualAuthentication.issuer && authentication.configHash === actualAuthentication.configHash, "authentication identity mismatch");
      add(errors, authentication.mode === "clerk-development" && actualAuthentication.mode === "clerk-development", "authenticated tests must use the documented Clerk development-test mode");
    }
  }

  add(errors, isPlainObject(manifest.expectedTargetHashes), "expectedTargetHashes is required");
  add(errors, isPlainObject(observed.targetHashes), "observed.targetHashes is required");
  if (isPlainObject(manifest.expectedTargetHashes) && isPlainObject(observed.targetHashes)) {
    const expectedNames = Object.keys(manifest.expectedTargetHashes).sort();
    const actualNames = Object.keys(observed.targetHashes).sort();
    for (const requiredName of ["tasks", "notes", "timeline", "signal", "attachments"]) {
      add(errors, Object.hasOwn(manifest.expectedTargetHashes, requiredName), `expected target hash for ${requiredName} is required`);
    }
    add(errors, sameStringSet(expectedNames, actualNames), "observed target set differs from manifest");
    for (const name of expectedNames) {
      const expectedHash = manifest.expectedTargetHashes[name];
      add(errors, HASH.test(expectedHash ?? ""), `expected target hash for ${name} must be a sha256 digest`);
      add(errors, expectedHash === observed.targetHashes[name], `target hash mismatch for ${name}`);
    }
  }

  validateSinkList(manifest.allowedDeliverySinks, "allowedDeliverySinks", errors);
  validateSinkList(observed.deliverySinks, "observed.deliverySinks", errors);
  if (Array.isArray(manifest.allowedDeliverySinks) && Array.isArray(observed.deliverySinks)) {
    const allowed = manifest.allowedDeliverySinks.map(sinkKey).sort();
    const actual = observed.deliverySinks.map(sinkKey).sort();
    add(errors, sameStringSet(allowed, actual), "observed delivery sinks differ from the allowlist");
  }
  add(errors, observed.externalDeliveryEnabled === false, "external delivery must be disabled");
  if (manifest.testActors !== undefined) {
    add(errors, Array.isArray(manifest.testActors) && manifest.testActors.length >= 2, "at least two test actor identities are required");
    add(errors, Array.isArray(observed.testActors), "observed.testActors must be an array");
    const validActor = (actor) => isPlainObject(actor)
      && HASH.test(actor.actorHash ?? "")
      && ["synthetic", "controlled-test"].includes(actor.kind)
      && actor.ownershipConfirmed === true;
    add(errors, manifest.testActors?.every(validActor), "test actors must be hashed and ownership-confirmed");
    add(errors, observed.testActors?.every(validActor), "observed actors must be hashed and ownership-confirmed");
    add(errors, sameStringSet((manifest.testActors ?? []).map((actor) => JSON.stringify(actor)), (observed.testActors ?? []).map((actor) => JSON.stringify(actor))), "observed actors differ from the test actor manifest");
  } else {
    add(errors, Array.isArray(manifest.syntheticIdentities) && manifest.syntheticIdentities.length >= 2, "at least two synthetic identities are required");
    add(errors, manifest.syntheticIdentities?.every((id) => typeof id === "string" && /^(synthetic|synthetic-reliability)-[a-z0-9-]+$/i.test(id)), "manifest identities must be explicitly synthetic");
    add(errors, sameStringSet(manifest.syntheticIdentities ?? [], observed.syntheticIdentities ?? []), "observed identities differ from the synthetic identity manifest");
  }

  return { ok: errors.length === 0, errors };
}

/** The callback is unreachable unless every identity check passes. */
export async function runWithTargetGuard({ manifest, observed, write }) {
  if (typeof write !== "function") throw new TypeError("write must be a function");
  const result = validateTargetManifest(manifest, observed);
  if (!result.ok) {
    const error = new Error(`Reliability target guard rejected the target: ${result.errors.join("; ")}`);
    error.code = "RELIABILITY_TARGET_REJECTED";
    error.validation = result;
    throw error;
  }
  return write({ fixtureNamespace: manifest.fixtureNamespace, runId: manifest.runId, evidenceScope: manifest.executionMode ?? manifest.environment.kind });
}
