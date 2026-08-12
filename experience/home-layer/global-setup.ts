import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { formatPreflight, preflight } from "./preflight.mjs";
import { loadCaptureContract } from "./invariants";

/**
 * Home operating-layer evidence harness · global setup.
 *
 * Runs preflight once per Playwright run and writes the result where the specs
 * can read it. It deliberately DOES NOT THROW when the lab is shut.
 *
 * Throwing here would abort the run, and an aborted run produces no report —
 * so the reason would exist only in a terminal somebody has already closed. A
 * written preflight file plus a gate test that fails inside the report keeps
 * the reason attached to the evidence, which is where the next person looks.
 */
async function globalSetup(): Promise<void> {
  const contract = loadCaptureContract();
  const baseUrl = process.env[contract.server.envVar] ?? contract.server.defaultBaseUrl;
  const result = await preflight({ baseUrl });

  const outputRoot = path.join(process.cwd(), contract.paths.outputRoot);
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(
    path.join(process.cwd(), contract.paths.preflightFile),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );

  console.log(formatPreflight(result));
  if (!result.canCapture) {
    console.log(
      "\nThe lab is not open. The `harness-self-proof` project still runs and still means something; " +
        "every home-lab project will fail its gate test with the reason above, which is the correct outcome — " +
        "a suite that cannot see its subject has not passed.\n",
    );
  }
}

export default globalSetup;
