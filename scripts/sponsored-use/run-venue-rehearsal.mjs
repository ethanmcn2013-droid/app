import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const index = process.argv.indexOf("--studio-root");
if (index < 0 || !process.argv[index + 1]) throw new Error("Supply --studio-root with the paired local checkout");
const studioRoot = resolve(process.argv[index + 1]);
if (!existsSync(resolve(studioRoot, "src/lib/account/instrumentation/usage-fixture.cjs"))) throw new Error("Paired Studio fixture is unavailable");
// Explicit allowlist: no inherited provider/database/HQ/Clerk secrets or env files.
const env = { NODE_ENV: "test", STUDIO_REPO_PATH: studioRoot, APP_REPO_PATH: root };
for (const key of ["PATH", "SystemRoot", "TEMP", "TMP"]) if (process.env[key]) env[key] = process.env[key];
const child = spawn(process.execPath, ["--import", "tsx", "--import", "./src/test/register-server-only.mjs",
  "--test", "--test-concurrency=1", "src/server/venue-issuance/composition.test.cjs"], {
  cwd: root, env, windowsHide: true, stdio: "inherit",
});
child.on("error", () => { process.stderr.write("Local rehearsal process could not start\n"); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
