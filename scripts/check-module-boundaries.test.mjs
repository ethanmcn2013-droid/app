import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const gate = fileURLToPath(new URL("./check-module-boundaries.mjs", import.meta.url));
function check(file, imported) {
  const root = mkdtempSync(join(tmpdir(), "assistant-module-boundary-"));
  const write = (path, text) => { const target = join(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text); };
  try {
    for (const segment of ["notes", "timeline", "signal", "home"]) write(`src/app/app/${segment}/page.tsx`,
      'import { requireAppAccessTasks } from "@/server/app-access"; export default async function Page(){ await requireAppAccessTasks(); return null; }');
    write("src/modules/timeline/server/assistant-preparation.ts", "export const port = true;");
    write(file, `import { port } from ${JSON.stringify(imported)}; export { port };`);
    return spawnSync(process.execPath, [gate], { cwd: root, encoding: "utf8", timeout: 10_000 });
  } finally {
    assert.equal(dirname(realpathSync(root)), realpathSync(resolve(tmpdir())));
    rmSync(root, { recursive: true, force: true });
  }
}

test("only the exact assistant host can compose the exact public Timeline preparation port", () => {
  const result = check("src/server/ping/assistant/timeline.ts", "@/modules/timeline/server/assistant-preparation");
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /module-boundaries.*ok/);
});

for (const [name, host, imported] of [
  ["neighbor host", "src/server/ping/assistant/neighbor.ts", "@/modules/timeline/server/assistant-preparation"],
  ["other module", "src/modules/notes/server/assistant.ts", "@/modules/timeline/server/assistant-preparation"],
  ["internal writer", "src/server/ping/assistant/timeline.ts", "@/modules/timeline/server/actions/workspaces"],
  ["nested port path", "src/server/ping/assistant/timeline.ts", "@/modules/timeline/server/assistant-preparation/private"],
  ["relative alias", "src/server/ping/assistant/timeline.ts", "../../../modules/timeline/server/assistant-preparation"],
]) test(`assistant exception refuses ${name}`, () => {
  const result = check(host, imported);
  assert.equal(result.status, 1); assert.match(result.stderr, /\[rule-[12]\]/);
});

test("public Timeline HTTP routes may compose only their narrow guest port", () => {
  for (const host of ["src/app/api/timeline/share/[token]/calendar/route.ts", "src/app/api/timeline/reminders/route.ts"]) {
    assert.equal(check(host, "@/modules/timeline/server/guest-http").status, 0, host);
    assert.equal(check(host, "@/modules/timeline/server/audience-timeline").status, 1, host);
  }
  assert.equal(check("src/app/api/timeline/private/route.ts", "@/modules/timeline/server/guest-http").status, 1);
  assert.equal(check("src/app/api/timeline/reminders-neighbor/route.ts", "@/modules/timeline/server/guest-http").status, 1);
});
