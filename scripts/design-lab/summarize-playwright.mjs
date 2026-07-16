import { readFile } from "node:fs/promises";

const file = process.argv[2] ?? "artifacts/tasks-redesign/playwright-results.json";
const report = JSON.parse(await readFile(file, "utf8"));
const failures = [];

function walk(suite, parents = []) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      for (const result of test.results ?? []) {
        if (result.status !== "failed" && result.status !== "timedOut") continue;
        const message = result.error?.message ?? result.errors?.[0]?.message ?? "";
        const axeEnd = message.indexOf("\n\nexpect(");
        let axe = null;
        if (message.trimStart().startsWith("[") && axeEnd > 0) {
          try { axe = JSON.parse(message.slice(0, axeEnd)); } catch { axe = null; }
        }
        const ids = [...message.matchAll(/"id": "([^"]+)"/g)].map((match) => match[1]);
        const ruleIds = [...new Set(ids.filter((id) => !id.startsWith("color-contrast-") && !id.startsWith("target-") && !id.startsWith("aria-") || ["color-contrast", "target-size", "aria-required-attr", "aria-prohibited-attr", "aria-required-children"].includes(id)))];
        failures.push({
          title: [...parents, spec.title].join(" > "),
          ruleIds,
          axe,
          summary: message.split("\n").slice(0, 8).join(" | "),
        });
      }
    }
  }
  for (const child of suite.suites ?? []) walk(child, [...parents, child.title]);
}

walk(report);
for (const failure of failures) {
  console.log(`${failure.title}\n  rules: ${failure.ruleIds.join(", ") || "n/a"}\n  ${failure.summary}`);
  if (failure.axe) {
    for (const violation of failure.axe) {
      console.log(`    ${violation.id} (${violation.impact}): ${violation.nodes.length} node(s)`);
      for (const node of violation.nodes.slice(0, 8)) console.log(`      ${node.target.join(" > ")} :: ${node.html}`);
    }
  }
}
console.log(`\n${failures.length} failed result(s)`);
