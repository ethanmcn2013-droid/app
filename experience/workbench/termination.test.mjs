import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runWithOutput } from "./run.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputRoot = path.join(repo, "experience", "output", "workbench-runs");

test("a terminated Playwright child preserves an unknown receipt and returns wrapper exit 1", async () => {
  const output = path.join(outputRoot, `termination-${randomUUID()}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_500);
  let receipt;
  try {
    receipt = await runWithOutput({ output, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  assert.equal(receipt.status, "unknown");
  assert.equal(receipt.exitCode, null);
  assert.equal(receipt.ready, false);
  assert.equal(receipt.wrapperExitCode, 1);
  assert.equal(receipt.journey.status, "unknown");
  assert.equal(receipt.journey.termination.requested, true);
  if (process.platform === "win32") {
    assert.match(receipt.journey.termination.mechanism, /taskkill \/PID \d+ \/T \/F/);
  } else {
    assert.match(receipt.journey.termination.mechanism, /SIGTERM process group \d+/);
  }
  assert.equal(receipt.build.status, "not-confirmed");
  assert.deepEqual(receipt.missingProof, ["The fixed populated-task browser journey did not pass with four captured viewport screenshots."]);

  const receiptPath = path.join(output, "receipt.json");
  assert.equal(existsSync(receiptPath), true);
  assert.equal(JSON.parse(readFileSync(receiptPath, "utf8")).exitCode, null);
  assert.equal(existsSync(path.join(output, "playwright-stderr.log")), true);
  assert.equal(receipt.artifacts.some((artifact) => artifact.name === "playwright-stdout.partial.txt"), true);
  for (const artifact of receipt.artifacts) {
    assert.equal(existsSync(path.join(output, artifact.path)), true, artifact.name);
  }
});
