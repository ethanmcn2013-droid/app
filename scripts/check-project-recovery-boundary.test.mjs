import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const checker = fileURLToPath(new URL("./check-module-boundaries.mjs", import.meta.url));
const allowedImport = "@/modules/timeline/server/project-recovery";
const cases = [
  ["exact host and module surface", "server/project-recovery.ts", allowedImport, true],
  ["different host", "server/other-recovery.ts", allowedImport, false],
  ["nested host", "server/project-recovery/other.ts", allowedImport, false],
  ["module database internals", "server/project-recovery.ts", "@/modules/timeline/server/db/timeline-client", false],
  ["nested recovery internals", "server/project-recovery.ts", allowedImport + "/internal", false],
  ["other module", "server/project-recovery.ts", "@/modules/notes/server/project-recovery", false],
  ["relative import does not enlarge exception", "server/project-recovery.ts", "../modules/timeline/server/project-recovery", false],
];

for (const [label, host, target, allowed] of cases) {
  test(`recovery module boundary: ${label}`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "signal-recovery-boundary-"));
    const write = (relative, source) => {
      const file = path.join(directory, "src", relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, source);
    };
    try {
      // The scanner inspects this small source tree; it never executes fixtures.
      for (const segment of ["notes", "timeline", "signal", "home"]) {
        write(`app/app/${segment}/page.tsx`, 'import { requireAppAccessTasks } from "@/server/app-access";\nexport default async function Page() { await requireAppAccessTasks(); return null; }\n');
      }
      write(host, `import { fixture } from ${JSON.stringify(target)};\nexport { fixture };\n`);
      const result = spawnSync(process.execPath, [checker], { cwd: directory, encoding: "utf8", windowsHide: true, timeout: 10000 });
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.equal(result.status, allowed ? 0 : 1, result.stdout + result.stderr);
      if (allowed) assert.match(result.stdout, /\[module-boundaries\] ok/);
      else {
        assert.match(result.stderr, /\[rule-2\]/);
        assert.ok(result.stderr.includes(host));
        assert.equal((result.stderr.match(/\[rule-/g) ?? []).length, 1, result.stderr);
      }
    } finally {
      assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
      assert.ok(path.basename(directory).startsWith("signal-recovery-boundary-"));
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}
