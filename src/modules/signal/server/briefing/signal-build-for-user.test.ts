import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  buildBriefingForUser,
  DEMO_BRIEFING_NOW,
} from "./signal-build-for-user";

/**
 * signal-build-for-user.test.ts — ported from
 * signal/src/server/briefing/build-for-user.test.ts.
 *
 * S8: ported copy; this test exercises the module's copy of
 * buildBriefingForUser, not the cron's copy in signal.git.
 *
 * Demo path: sets SIGNAL_ACCESS_MODE=demo so isDemoMode() returns true,
 * bypassing DB calls and using the fixed synthetic clock.
 */
test("demo briefing uses a fixed synthetic clock", async () => {
  const originalMode = process.env.SIGNAL_ACCESS_MODE;
  const originalPublicMode = process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE;
  const originalVercelEnv = process.env.VERCEL_ENV;

  process.env.SIGNAL_ACCESS_MODE = "demo";
  delete process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE;
  delete process.env.VERCEL_ENV;

  try {
    const result = await buildBriefingForUser({
      clerkId: "demo-user",
      cadence: "daily",
    });
    assert.equal(result.kind, "ok");
    if (result.kind === "ok") {
      assert.equal(result.briefing.generatedAt, DEMO_BRIEFING_NOW);
      assert.ok(
        result.briefing.needsAttention.length +
          result.briefing.quietRisks.length >
          0,
      );
    }
  } finally {
    if (originalMode === undefined) delete process.env.SIGNAL_ACCESS_MODE;
    else process.env.SIGNAL_ACCESS_MODE = originalMode;
    if (originalPublicMode === undefined) {
      delete process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE;
    } else {
      process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = originalPublicMode;
    }
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  }
});
