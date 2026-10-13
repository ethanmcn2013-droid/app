import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { localTaskProofUrlNormalization } from "./local-task-proof-config";

const posture = () => ({ NODE_ENV: "production", SIGNAL_LOCAL_TASK_PROOF_BUILD: "true", SIGNAL_ACCESS_MODE: "production", NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "production", SIGNAL_LOCAL_TASK_ORIGIN: "http://127.0.0.1:49731" });
test("normal/default/hosted production keep normalization; only explicit exact local proof enables it", () => {
  assert.equal(localTaskProofUrlNormalization({}), false);
  assert.equal(localTaskProofUrlNormalization({ NODE_ENV: "production", VERCEL: "1" }), false);
  assert.equal(localTaskProofUrlNormalization({ ...posture(), SIGNAL_LOCAL_TASK_PROOF_BUILD: "false" }), false);
  assert.equal(localTaskProofUrlNormalization(posture()), true);
  assert.equal(localTaskProofUrlNormalization({ ...posture(), SIGNAL_LOCAL_TASK_PROOF_BUILD: undefined, SIGNAL_LOCAL_TASK_OPERATIONS: "true" }), true);
  for (const patch of [{ SIGNAL_LOCAL_TASK_PROOF_BUILD: "TRUE" }, { SIGNAL_LOCAL_TASK_OPERATIONS: "1" }, { NODE_ENV: "development" }, { VERCEL: "1" }, { VERCEL_ENV: "production" }, { SIGNAL_ACCESS_MODE: "demo" }, { NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "demo" }, { DEMO_MODE: "true" }, { NEXT_PUBLIC_DEMO_MODE: "true" }, ...["http://localhost:49731", "https://127.0.0.1:49731", "http://127.0.0.1:49731/", "http://127.0.0.1:49731?x=1", "http://127.0.0.1:99999", "https://foreign.example"].map(SIGNAL_LOCAL_TASK_ORIGIN => ({ SIGNAL_LOCAL_TASK_ORIGIN }))]) assert.throws(() => localTaskProofUrlNormalization({ ...posture(), ...patch }));
});

test("installed Next Request + ordinary Clerk decorator preserve exact origin only with the build-defined flag", () => {
  const require = createRequire(import.meta.url);
  const { decorateRequest } = require(join(dirname(require.resolve("@clerk/nextjs/server")), "utils.js"));
  const { parseRelativeURL } = require("next/dist/shared/lib/router/utils/relativize-url.js");
  const { defaultConfig } = require("next/dist/server/config-shared.js");
  const { getDefineEnv } = require("next/dist/build/define-env.js");
  const definitions = getDefineEnv({ config: { ...defaultConfig, skipProxyUrlNormalize: localTaskProofUrlNormalization(posture()) }, dev: false, distDir: ".next", projectPath: process.cwd(), isClient: false, isEdgeServer: false, isNodeServer: true, isTurbopack: true, hasRewrites: false });
  assert.equal(definitions["process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE"], "true");
  const original = process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE;
  const input = "http://127.0.0.1:49731/sign-in";
  try {
    for (const preserve of [false, true]) {
      if (preserve) process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = "true"; else delete process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE;
      const request = Object.assign(new NextRequest(input), { clerkUrl: new URL(input) });
      const response = decorateRequest(request, NextResponse.next(), { status: "signed-out" }, undefined, undefined, undefined);
      const rewrite = response.headers.get("x-middleware-rewrite");
      assert.equal(request.url, preserve ? input : "http://localhost:49731/sign-in");
      assert.equal(rewrite, request.url);
      assert.equal(parseRelativeURL(rewrite, input).isRelative, preserve);
      assert.equal(response.headers.get("x-middleware-request-x-clerk-auth-status"), "signed-out");
      assert.equal(request.nextUrl.hostname, "localhost"); // nextUrl still normalizes: req.url is the authority.
    }
  } finally { if (original === undefined) delete process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE; else process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = original; }
});
