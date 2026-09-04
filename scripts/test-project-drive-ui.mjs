import { spawnSync } from "node:child_process";

// Always use a credential-free review posture, even if the invoking shell has
// provider/DB settings. Service tests inject disposable local SQLite fixtures.
const result = spawnSync(process.execPath, [
  "--import", "tsx", "--import", "./src/test/register-server-only.mjs", "--test",
  "src/lib/project-drive-ui.test.ts",
  "src/lib/project-drive-upload-machine.test.ts",
  "src/lib/drive-resumable-upload.test.ts",
  "src/server/connections/project-drive-ui-status.test.ts",
  "src/server/project-drive-ui-contract.test.mjs",
], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "review", NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: "preview" },
});
process.exit(result.status ?? 1);
