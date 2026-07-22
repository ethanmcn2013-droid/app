import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizeSuiteContextForSignal } from "@/lib/suite-context";

/**
 * Locks the Phase 6 Opus MAJOR-1 fix: the identifier guard rejects control
 * characters, NOT hyphens. Tasks workspace ids are hyphenated UUIDs — the
 * suite-context hop must carry them into workspace_id.
 */
describe("normalizeSuiteContextForSignal", () => {
  it("carries a hyphenated UUID workspaceId through as workspace_id", () => {
    const params = new URLSearchParams({
      sourceProduct: "tasks",
      contextVersion: "2",
      workspaceId: "0f8fad5b-d9cb-469f-a165-70867728950e",
    });
    const result = normalizeSuiteContextForSignal(params);
    assert.equal(result.get("workspace_id"), "0f8fad5b-d9cb-469f-a165-70867728950e");
  });

  it("rejects identifiers containing control characters", () => {
    const params = new URLSearchParams({
      sourceProduct: "tasks",
      contextVersion: "2",
      workspaceId: "bad\u0001id",
    });
    const result = normalizeSuiteContextForSignal(params);
    assert.equal(result.get("workspace_id"), null);
  });
});
