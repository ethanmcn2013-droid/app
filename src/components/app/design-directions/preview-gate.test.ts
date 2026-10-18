import assert from "node:assert/strict";
import test from "node:test";
import { homeProjectsPreview } from "./preview-gate";

test("design previews require an explicit review environment and never enable production", () => {
  const keys = ["SIGNAL_ACCESS_MODE", "NEXT_PUBLIC_SIGNAL_ACCESS_MODE", "SIGNAL_HOME_PROJECTS_REVIEW", "NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV"] as const;
  const before = keys.map(key => [key, process.env[key]] as const);
  try {
    process.env.SIGNAL_ACCESS_MODE = "review";
    process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
    process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
    process.env.SIGNAL_HOME_PROJECTS_REVIEW = "1";
    assert.deepEqual(homeProjectsPreview({ design: "a", state: "partial" }), { direction: "a", state: "partial" });
    assert.equal(homeProjectsPreview({ design: ["a", "b"] }), null);
    assert.equal(homeProjectsPreview({ design: "unknown" }), null);
    delete process.env.SIGNAL_HOME_PROJECTS_REVIEW;
    assert.equal(homeProjectsPreview({ design: "a" }), null);
    process.env.SIGNAL_HOME_PROJECTS_REVIEW = "1";
    process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "production";
    assert.equal(homeProjectsPreview({ design: "a" }), null);
    process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
    process.env.SIGNAL_ACCESS_MODE = "production";
    process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "production";
    assert.equal(homeProjectsPreview({ design: "a" }), null);
  } finally {
    for (const [key, value] of before) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
