import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const prefix = "signal-board-fidelity-run-";

/** Remove only this invocation's fixture after the libSQL child has exited. */
export function runBoardFidelityTests({
  execute = spawnSync,
  create = mkdtempSync,
  remove = rmSync,
  env = process.env,
} = {}) {
  const tempRoot = resolve(tmpdir());
  const created = resolve(create(join(tempRoot, prefix)));
  if (dirname(created) !== tempRoot || !basename(created).startsWith(prefix)) {
    throw new Error("Board fidelity test root is outside the system temp directory");
  }
  let result;
  let childError;
  try {
    result = execute(process.execPath, [
      "--import", "tsx", "--test", "src/server/actions/board-fidelity.persisted.test.mjs",
    ], {
      cwd: appRoot,
      env: { ...env, BOARD_FIDELITY_TEST_ROOT: created },
      stdio: "inherit", shell: false, windowsHide: true,
    });
    childError = result.error;
  } catch (error) {
    childError = error;
  }
  try { remove(created, { recursive: true, force: true }); }
  catch (error) {
    throw new Error("Board fidelity test fixture cleanup failed after child exit", { cause: error });
  }
  if (childError) throw childError;
  return result?.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runBoardFidelityTests();
}
