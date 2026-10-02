import {spawnSync} from "node:child_process";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {basename, dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const prefix = "signal-provision-fast-run-";

/** The child closes libSQL, then this parent deletes only its freshly made fixture root. */
export function runProvisionFastTests({
  execute = spawnSync,
  create = mkdtempSync,
  remove = rmSync,
  env = process.env,
} = {}) {
  const tempRoot = resolve(tmpdir());
  const created = resolve(create(join(tempRoot, prefix)));
  if (dirname(created) !== tempRoot || !basename(created).startsWith(prefix)) {
    throw new Error("Provision test fixture root is outside the system temp directory");
  }

  let result;
  let childError;
  try {
    result = execute(process.execPath, [
      "--import", "tsx", "--import", "./src/test/register-server-only.mjs", "--test",
      "src/server/db/ensure-user-fast-path.test.ts",
    ], {
      cwd: appRoot,
      env: {...env, SIGNAL_PROVISION_FAST_TEST_ROOT: created},
      stdio: "inherit", shell: false, windowsHide: true,
    });
    childError = result.error;
  } catch (error) {
    childError = error;
  }

  // spawnSync returned: the child process and its native SQLite handles are gone.
  try { remove(created, {recursive: true, force: true}); }
  catch (error) {
    throw new Error("Provision test fixture cleanup failed after child exit", {cause: error});
  }
  if (childError) throw childError;
  return result?.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runProvisionFastTests();
}
