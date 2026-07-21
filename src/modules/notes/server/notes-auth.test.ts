import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { devFallbackEligible } from "./notes-auth";

/**
 * Locks the fail-closed invariant from the Phase 4 Opus review (M1):
 * the keyless-dev identity must be unmintable on any production build,
 * regardless of access-mode env vars or missing Clerk keys — the module
 * must not rely on the proxy's 503 backstop.
 */
describe("notes-auth devFallbackEligible", () => {
  it("never activates when NODE_ENV is production", () => {
    assert.equal(
      devFallbackEligible({
        nodeEnv: "production",
        clerkConfigured: false,
        accessMode: "development",
      }),
      false,
    );
  });

  it("never activates when Clerk is configured", () => {
    assert.equal(
      devFallbackEligible({
        nodeEnv: "development",
        clerkConfigured: true,
        accessMode: "development",
      }),
      false,
    );
  });

  it("never activates outside development access mode", () => {
    for (const accessMode of ["production", "demo", "review"]) {
      assert.equal(
        devFallbackEligible({
          nodeEnv: "development",
          clerkConfigured: false,
          accessMode,
        }),
        false,
        `accessMode=${accessMode}`,
      );
    }
  });

  it("activates only for keyless local development", () => {
    assert.equal(
      devFallbackEligible({
        nodeEnv: "development",
        clerkConfigured: false,
        accessMode: "development",
      }),
      true,
    );
  });
});
