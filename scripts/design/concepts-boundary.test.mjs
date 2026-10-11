import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

function readConfig(env) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
    'const module=await import("./next.config.ts"); const config=module.default.default??module.default; console.log(JSON.stringify(config.turbopack??null));'],
    { cwd: process.cwd(), env: { ...process.env, VERCEL_ENV: "", NODE_ENV: "production", ...env }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}

for (const flag of ["", "true"]) {
  test(`production excludes unpicked concepts with legacy override ${flag || "unset"}`, () => {
    for (const deployment of ["production", ""]) {
      assert.equal(readConfig({ VERCEL_ENV: deployment, SIGNAL_CONCEPTS_IN_BUILD: flag }).resolveAlias[
        "@/components/concepts/registry"], "./src/components/concepts/registry.production.ts");
    }
  });
}
test("preview and development retain the complete review registry", () => {
  assert.equal(readConfig({ VERCEL_ENV: "preview" }), null);
  assert.equal(readConfig({ NODE_ENV: "development" }), null);
});
test("concept routes retain the fail-closed access gate", () => {
  for (const file of ["src/app/app/concepts/page.tsx", "src/app/app/concepts/[view]/[n]/page.tsx"]) {
    assert.match(readFileSync(file, "utf8"), /if \(!isDemoMode\(\)\) notFound\(\);/);
  }
});

test("reduced-motion prototype hook has a deterministic SSR snapshot without window", async () => {
  const { createElement } = await import("react");
  const { renderToString } = await import("react-dom/server");
  const hookExports = await import("../../src/components/concepts/use-review-reduced-motion.ts");
  const usePreference = hookExports.useReviewReducedMotion ?? hookExports.default.useReviewReducedMotion;
  function Probe() { return createElement("span", null, String(usePreference())); }
  assert.equal(renderToString(createElement(Probe)), "<span>false</span>");
});
