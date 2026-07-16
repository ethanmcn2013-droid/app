import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const directory = path.resolve(process.argv[2] ?? "artifacts/tasks-redesign/axe");
for (const name of (await readdir(directory)).filter((item) => item.endsWith(".json")).sort()) {
  const report = JSON.parse(await readFile(path.join(directory, name), "utf8"));
  const blocking = report.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  console.log(`${name}: ${blocking.length} blocking rule(s)`);
  for (const violation of blocking) {
    console.log(`  ${violation.id} (${violation.impact}) · ${violation.nodes.length} node(s)`);
    for (const node of violation.nodes.slice(0, 12)) {
      const data = node.any?.[0]?.data;
      const detail = data?.contrastRatio ? ` ratio=${data.contrastRatio} fg=${data.fgColor} bg=${data.bgColor}` : data?.width ? ` ${data.width}x${data.height}` : "";
      console.log(`    ${node.target.join(" > ")}${detail}`);
    }
  }
}
