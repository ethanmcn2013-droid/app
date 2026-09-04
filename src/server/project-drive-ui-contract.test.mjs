import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
test("review and flag-off status return before the DB/provider/auth graph is imported", () => {
  for (const mode of ["review", "development"]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { registerHooks } from 'node:module';
      registerHooks({ resolve(specifier, context, next) {
        if (/server\\/(db|auth|connections)/.test(specifier)) throw Error('FORBIDDEN import: ' + specifier);
        return next(specifier, context);
      }});
      const imported = await import('./src/server/actions/project-drive-status.ts');
      const { getProjectDriveStatusAction } = imported.default ?? imported;
      const result = await getProjectDriveStatusAction('foreign-project');
      if (result.kind !== '${mode === "review" ? "review" : "disabled"}') throw Error(JSON.stringify(result));
      const ownerActions = await import('./src/server/actions/project-drive-handover-ui.ts');
      const { getProjectDriveHandoverAction, changeProjectDriveOwnerAction } = ownerActions.default ?? ownerActions;
      const choices = await getProjectDriveHandoverAction('foreign-project');
      if (choices.kind !== '${mode === "review" ? "review" : "disabled"}') throw Error(JSON.stringify(choices));
      const change = await changeProjectDriveOwnerAction('foreign-project', 'forged-owner');
      if (change !== '${mode === "review" ? "demo" : "disabled"}') throw Error(change);
      const recovery = await import('./src/server/actions/drive-upload-recovery.ts');
      const { recoverDriveUploadAction } = recovery.default ?? recovery;
      const checked = await recoverDriveUploadAction('foreign-task', 'foreign-resource');
      if (checked !== '${mode === "review" ? "review" : "disabled"}') throw Error(checked);
    `], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NEXT_PUBLIC_SIGNAL_ACCESS_MODE: mode, NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: "preview", NEXT_PUBLIC_PROJECT_DRIVE_UI: mode === "review" ? "true" : "false" } });
    assert.equal(result.status, 0, result.stderr);
  }
});
test("status action proves explicit project authority before and after its read", () => {
  const source = read("src/server/actions/project-drive-status.ts");
  assert.equal((source.match(/await authorizeProjectDrive\(projectId, "manageProject"\)/g) || []).length, 2);
  assert.ok(source.indexOf("await authorizeProjectDrive") < source.indexOf("const status = await readProjectDriveUiStatus"));
  assert.doesNotMatch(source, /getActiveWorkspace|console\.|error\.message/);
});
test("review fixtures have no production dependency or fetch path", () => {
  const fixture = read("src/components/app/settings/sections/connections-review.tsx");
  assert.doesNotMatch(fixture, /@\/server|fetch\(|window\.location|server\/actions/);
  for (const path of ["src/components/app/settings/sections/drive-handover-view.tsx", "src/components/app/detail-panel/drive-upload-review.tsx", "src/components/app/detail-panel/drive-reload-notice.tsx"]) {
    assert.doesNotMatch(read(path), /@\/server|fetch\(|window\.location|server\/actions/);
  }
  const intake = read("src/components/app/detail-panel/use-drive-uploads.ts");
  assert.ok(intake.indexOf("if (isDemoMode()) return") < intake.indexOf('import("@/server/actions'));
});
test("Resources keeps one Attach intake and truthful Drive provenance", () => {
  const source = read("src/components/app/detail-panel/resources-section.tsx");
  assert.equal((source.match(/aria-label="Attach a file"/g) || []).length, 1);
  assert.match(source, /if \(driveEnabled\) \{ void addDriveUpload\(file\); continue; \}/);
  assert.match(source, /const downloadUrl = isUpload && !isDrive && !isPending/);
  assert.match(read("src/server/actions/resources.ts"), /storage: r\.storage === "drive"/);
  assert.ok(source.indexOf("if (reloadState)") < source.indexOf("void addDriveUpload(file)"));
  assert.equal((source.match(/disabled=\{reloadState !== null\}/g) || []).length, 2, "both single input and Attach obey reload guard; drop uses the same handler");
});

test("handover actions reauthorize explicit project and expose no provider data or errors", () => {
  const source = read("src/server/actions/project-drive-handover-ui.ts");
  assert.equal((source.match(/await authorizeProjectDrive\(projectId, "manageProject"\)/g) || []).length, 4);
  assert.doesNotMatch(source, /getActiveWorkspace|console\.|error\.message|folderUrl|connectionId|sessionUrl/);
});
