import assert from "node:assert/strict";
import test from "node:test";
import { getAccessMode } from "./access-mode";

test("production deployment cannot activate demo or review mode", () => {
  const original = { ...process.env };
  try {
    process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "production";
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

test("preview deployment resolves demo identically on server and browser", () => {
  const original = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
    process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "demo";

    // Server render has VERCEL_ENV; the browser bundle does not. Access mode
    // must depend only on the injected public deployment posture in both.
    process.env.VERCEL_ENV = "preview";
    assert.equal(getAccessMode(), "demo");
    delete process.env.VERCEL_ENV;
    assert.equal(getAccessMode(), "demo");
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    Object.assign(process.env, original);
  }
});

test("unclassified production build fails closed", () => {
  const original = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV;
    process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
    assert.equal(getAccessMode(), "production");
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    Object.assign(process.env, original);
  }
});
