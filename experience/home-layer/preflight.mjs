/**
 * Home operating-layer evidence harness · preflight.
 *
 * Answers one question before anything is captured: **can this machine see the
 * lab, and if not, why not.** There are four answers and the harness behaves
 * differently for each. None of them is "carry on and hope".
 *
 *   open        the lab renders. Captures are real evidence.
 *   closed      the server answers, the lab returns 404. Expected on any
 *               demo/review-mode server, including every default Vercel
 *               preview (R-H17) and the local dev server on :3212. Captures
 *               are refused and recorded as `blocked`.
 *   unreachable nothing is listening. Nothing is captured, nothing is claimed.
 *   degraded    the server answers but the control routes disagree with each
 *               other, so the environment is not the one this harness models.
 *
 * WHY A 404 IS NOT A FAILURE AND NOT A PASS. `contracts/LAB_ISOLATION.md` §3
 * makes every refusal an identical 404 on purpose: a 403 would tell an
 * authenticated non-reviewer that there is something to be refused. The cost of
 * that good decision is that this harness cannot tell "flag off" from "not a
 * reviewer" from "route deleted" — so it does not guess. It records `closed`,
 * names the three possible causes, and writes zero captures. A harness that
 * treated an empty run as a clean run would be the same false clear the
 * fixtures spend their whole length preventing.
 */

export const PREFLIGHT_SCHEMA = "signal-home-lab-preflight/1";

export const LAB_ROUTE = "/lab/home-operating-layer";
/** A pre-existing lab that is public by design. Proves the server is up and serving lab routes. */
const CONTROL_LAB_ROUTE = "/lab/timeline-a";

async function probe(baseUrl, route, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(new URL(route, baseUrl), {
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "signal-home-lab-preflight" },
    });
    const body = await response.text();
    return {
      route,
      status: response.status,
      location: response.headers.get("location"),
      robots: response.headers.get("x-robots-tag"),
      bytes: body.length,
      ms: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      route,
      status: null,
      location: null,
      robots: null,
      bytes: null,
      ms: Date.now() - startedAt,
      error: String(error?.message ?? error).slice(0, 200),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ baseUrl: string, timeoutMs?: number, fetchImpl?: Function }} options
 */
export async function preflight({ baseUrl, timeoutMs = 8000 }) {
  const root = await probe(baseUrl, "/", timeoutMs);
  if (root.error !== null) {
    return finalise({
      state: "unreachable",
      baseUrl,
      probes: [root],
      reason: `nothing answered at ${baseUrl}: ${root.error}`,
      remedy: [
        `start or point at a server, then re-run with HOME_LAB_BASE_URL=<url>`,
        `this harness never starts a server of its own — see capture-contract.json "server"`,
      ],
    });
  }

  const control = await probe(baseUrl, CONTROL_LAB_ROUTE, timeoutMs);
  const lab = await probe(baseUrl, LAB_ROUTE, timeoutMs);
  const probes = [root, control, lab];

  if (control.status !== 200) {
    return finalise({
      state: "degraded",
      baseUrl,
      probes,
      reason: `the control lab route ${CONTROL_LAB_ROUTE} answered ${control.status}, not 200 — this server is not serving /lab as this harness expects`,
      remedy: [
        "confirm the server is this repository at this branch",
        "if /lab now requires sign-in for everyone, contracts/LAB_ISOLATION.md §1 has been contradicted and that is the finding, not a harness bug",
      ],
    });
  }

  if (lab.status === 200) {
    return finalise({
      state: "open",
      baseUrl,
      probes,
      reason: `${LAB_ROUTE} rendered`,
      remedy: [],
    });
  }

  if (lab.status === 404) {
    return finalise({
      state: "closed",
      baseUrl,
      probes,
      reason: `${LAB_ROUTE} answered 404. By design every refusal is the same 404, so the cause is one of three and this harness cannot tell them apart`,
      causes: [
        "HOME_REVIEW_LAB_ENABLED is not literally true or 1",
        "the server runs demo or review access mode, which the guard refuses outright (R-H17: a default Vercel preview and the local dev server both do)",
        "the signed-in account is absent from HOME_REVIEW_LAB_REVIEWERS, or has no verified primary email",
      ],
      remedy: [
        "HOME_REVIEW_LAB_ENABLED=true",
        "SIGNAL_ACCESS_MODE=production with real Clerk keys",
        "sign in as an allowlisted reviewer, and pass the session cookie with HOME_LAB_STORAGE_STATE=<playwright storage state json>",
      ],
    });
  }

  if (lab.status >= 300 && lab.status < 400) {
    return finalise({
      state: "degraded",
      baseUrl,
      probes,
      reason: `${LAB_ROUTE} answered ${lab.status} to ${lab.location ?? "an unnamed location"}. A redirect confirms the route exists, which contracts/LAB_ISOLATION.md §1 requires it never do`,
      remedy: ["this is a contract regression in the guard, not a harness configuration problem"],
    });
  }

  return finalise({
    state: "degraded",
    baseUrl,
    probes,
    reason: `${LAB_ROUTE} answered ${lab.status}, which is neither the documented 200 nor the documented 404`,
    remedy: ["read the server log for this request before capturing anything"],
  });
}

function finalise(result) {
  return Object.freeze({
    schemaVersion: PREFLIGHT_SCHEMA,
    checkedAt: new Date().toISOString(),
    canCapture: result.state === "open",
    causes: [],
    remedy: [],
    ...result,
  });
}

/** One line, for a terminal. */
export function formatPreflight(result) {
  const lines = [
    `preflight: ${result.state.toUpperCase()} at ${result.baseUrl}`,
    `  ${result.reason}`,
  ];
  for (const probeResult of result.probes ?? []) {
    lines.push(
      `  ${String(probeResult.status ?? "ERR").padEnd(4)} ${probeResult.route.padEnd(28)} ` +
        `${probeResult.bytes === null ? probeResult.error : `${probeResult.bytes}B`} ${probeResult.ms}ms`,
    );
  }
  for (const cause of result.causes ?? []) lines.push(`  cause? ${cause}`);
  for (const step of result.remedy ?? []) lines.push(`  fix   ${step}`);
  return lines.join("\n");
}

// ── Self-test ───────────────────────────────────────────────────────────────

export function selfTest() {
  const failures = [];
  const check = (name, condition, detail) => {
    if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  };

  const open = finalise({ state: "open", baseUrl: "http://x", probes: [], reason: "r" });
  check("open can capture", open.canCapture === true);

  for (const state of ["closed", "unreachable", "degraded"]) {
    const result = finalise({ state, baseUrl: "http://x", probes: [], reason: "r" });
    check(`${state} cannot capture`, result.canCapture === false);
  }

  const closed = finalise({
    state: "closed",
    baseUrl: "http://x",
    probes: [],
    reason: "r",
    causes: ["a", "b", "c"],
  });
  check("closed names every possible cause rather than picking one", closed.causes.length === 3);
  check("formatting a result never throws", typeof formatPreflight(closed) === "string");

  return failures;
}
