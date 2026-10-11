import { readFile } from "node:fs/promises";
import { verifyPersistedWorkflow } from "./local-service-harness";

async function main() {
  const input = JSON.parse(await readFile(process.argv[2], "utf8"));
  console.log(JSON.stringify(await verifyPersistedWorkflow(input.databaseUrl, input.checkpoint)));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
