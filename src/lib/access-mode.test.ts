import assert from "node:assert/strict";
import test from "node:test";
import { getAccessMode } from "./access-mode";

test("production deployment cannot activate demo or review mode", () => {
  const original = { ...process.env };
  try {
    process.env.VERCEL_ENV = "production";
    process.env.SIGNAL_ACCESS_MODE = "demo";
    delete process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    delete process.env.DEMO_MODE;
    assert.equal(getAccessMode(), "production");
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    Object.assign(process.env, original);
  }
});
