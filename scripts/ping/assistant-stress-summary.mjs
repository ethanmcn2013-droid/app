import { readFile, writeFile, stat, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error("Usage: node scripts/ping/assistant-stress-summary.mjs <single TAP attempt or ten-batch directory> <summary.json>");
const directory = (await stat(resolve(input))).isDirectory();
const files = directory ? (await readdir(resolve(input))).filter(name => /^batch-\d{3}-\d{3}\.log$/.test(name)).sort().map(name => resolve(input, name)) : [resolve(input)];
const attempts = await Promise.all(files.map(async file => ({ file, raw: await readFile(file, "utf8") })));
const raw = attempts.map(attempt => attempt.raw).join("\n");
const samples = raw.split(/\r?\n/).filter(line => line.startsWith('# {"synthetic":true,"id":')).map(line => JSON.parse(line.slice(2)));
const failures = raw.split(/\r?\n/).filter(line => /^not ok \d+ - /.test(line));
const seen = new Set(samples.map(sample => sample.id));
if (seen.size !== samples.length) throw Error("Duplicate scenario IDs: do not combine attempts");
const times = samples.map(sample => sample.serverSpanMs).sort((a, b) => a - b);
const percentile = p => times.length ? times[Math.ceil(times.length * p) - 1] : null;
const complete = samples.length === 100 && failures.length === 0 && (!directory || files.length === 10) && attempts.every(attempt => /# fail 0\b/.test(attempt.raw) && /# skipped 0\b/.test(attempt.raw));
const summary = {
  version: "ping.assistant.synthetic-stress.v1", input: resolve(input), inputSha256: createHash("sha256").update(raw).digest("hex"),
  attempts: attempts.map(attempt => ({ file: attempt.file, sha256: createHash("sha256").update(attempt.raw).digest("hex") })),
  synthetic: true, expectedScenarios: 100, completedScenarios: samples.length, uniqueScenarios: seen.size, complete, failures,
  time: { referenceInstant: "2026-10-18T09:00:00.000Z", referenceDate: "2026-10-18", timeZone: "Europe/Dublin" },
  serverSpanMs: { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: times.at(-1) ?? null },
  statuses: samples.reduce((counts, sample) => ({ ...counts, [sample.status]: (counts[sample.status] ?? 0) + 1 }), {}),
  boundary: "Actual synthetic file-backed SQLite, durable store, service and actions; fake structured one-shot planner and dispatcher; server span includes scenario assertions and excludes migration/setup. No model-quality, browser, production performance, real email, provider, or Timeline publication claim.",
  samples,
};
await writeFile(resolve(output), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ complete, completedScenarios: samples.length, failures: failures.length, serverSpanMs: summary.serverSpanMs }));
if (!complete) process.exitCode = 1;
