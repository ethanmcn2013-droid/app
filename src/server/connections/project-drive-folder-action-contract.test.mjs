import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function exportedAction(code, name) {
  const marker = `export async function ${name}`;
  const start = code.indexOf(marker);
  assert.notEqual(start, -1, `${name} must remain an explicit action`);
  const next = code.indexOf("export async function ", start + marker.length);
  return code.slice(start, next === -1 ? code.length : next);
}

describe("Project Drive folder lifecycle wiring", () => {
  it("keeps OAuth consent separate from the explicit board-storage action", () => {
    const actions = source("actions/connections.ts");
    const begin = exportedAction(actions, "beginGoogleDriveConnectionAction");
    const enable = exportedAction(
      actions,
      "enableGoogleDriveForProjectAction",
    );
    assert.doesNotMatch(begin, /enableProjectGoogleDriveStorage/);
    assert.match(enable, /if\s*\(isDemoMode\(\)\)\s*return/);
    assert.match(
      enable,
      /authorizeProjectDrive\s*\(\s*projectId\s*,\s*["']manageProject["']/,
    );
    assert.ok(
      enable.indexOf("isDemoMode()") < enable.indexOf("authorizeProjectDrive"),
      "demo mode must stop before identity or database access",
    );
    assert.ok(
      enable.indexOf("authorization.archived") <
        enable.indexOf("enableProjectGoogleDriveStorage"),
      "archived Projects must stop before storage work",
    );
  });

  it("returns a minimized action DTO rather than operation or credential rows", () => {
    const management = source(
      "connections/project-drive-folder-management.ts",
    );
    const shape = management.slice(
      management.indexOf("export type ProjectDriveFolderSetupState"),
      management.indexOf(
        "export const DEMO_PROJECT_DRIVE_FOLDER_SETUP_STATE",
      ),
    );
    for (const safeField of [
      "status",
      "coverage",
      "pendingMemberCount",
      "memberGapCount",
      "folderUrl",
    ]) {
      assert.match(shape, new RegExp(`\\b${safeField}\\b`));
    }
    assert.doesNotMatch(
      shape,
      /operationId|connectionId|storageGenerationId|refreshToken|accessToken/,
    );
  });

  it("keeps storage-owner handover explicit, authorized, and non-destructive", () => {
    const actions = source("actions/connections.ts");
    const handover = exportedAction(
      actions,
      "handoverGoogleDriveForProjectAction",
    );
    assert.match(handover, /if\s*\(isDemoMode\(\)\)\s*return/);
    assert.match(
      handover,
      /authorizeProjectDrive\s*\(\s*projectId\s*,\s*["']manageProject["']/,
    );
    assert.ok(
      handover.indexOf("authorization.archived") <
        handover.indexOf("handoverProjectGoogleDriveStorage"),
      "archived Projects must stop before handover work",
    );
    assert.doesNotMatch(
      handover,
      /\b(?:delete|move|trash|remove)\w*\s*\(/i,
    );

    const lifecycle = source(
      "connections/project-drive-storage-handover.ts",
    );
    const publicShape = lifecycle.slice(
      lifecycle.indexOf("export type ProjectDriveStorageHandoverState"),
      lifecycle.indexOf(
        "export const DEMO_PROJECT_DRIVE_STORAGE_HANDOVER_STATE",
      ),
    );
    assert.doesNotMatch(
      publicShape,
      /operationId|connectionId|storageGenerationId|refreshToken|accessToken/,
    );
  });

  it("commits rename revision and exact-generation intent before provider execution", () => {
    const projects = source("projects/service.ts");
    const rename = projects.slice(
      projects.indexOf("export async function renameProject"),
      projects.indexOf("export async function reorderProject"),
    );
    const transactionAt = rename.indexOf("db.transaction");
    const prepareAt = rename.indexOf(
      "prepareAccountFencedProjectDriveOperationInTransaction",
    );
    const executeAt = rename.indexOf("executeProjectDriveFolderOperation");
    assert.ok(transactionAt > -1 && prepareAt > transactionAt);
    assert.ok(executeAt > prepareAt);
    assert.match(rename, /workspaceRevision:\s*updated\[0\]\.revision/);
    assert.match(rename, /storageGenerationId:\s*currentStorage\[0\]\.id/);
    assert.match(rename, /\{ behavior: ["']immediate["'] \}/);
  });

  it("materializes storage and existing-member intents in one writer transaction", () => {
    const executor = source(
      "connections/project-drive-folder-operation-executor.ts",
    );
    const persist = executor.slice(
      executor.indexOf("async function persistProvision"),
      executor.indexOf("async function persistRename"),
    );
    assert.match(persist, /transaction\.insert\(workspaceStorage\)/);
    assert.match(persist, /prepareExistingMemberDriveGrantIntents\s*\(/);
    assert.match(persist, /journalForTransaction\(transaction\)/);
    assert.doesNotMatch(
      persist,
      /deps\.folders\.|deps\.executeGrant|createGoogleDriveFolder|renameGoogleDriveFile/,
    );
  });

  it("dispatches exact existing-member grants only after folder persistence returns", () => {
    const executor = source(
      "connections/project-drive-folder-operation-executor.ts",
    );
    const provision = executor.slice(
      executor.indexOf('if (claim.operationKind === "folder_provision")'),
      executor.indexOf("let result: ProjectDriveFolderRenameResult"),
    );
    const persistAt = provision.indexOf("await persistProvision(claim, result)");
    const dispatchAt = provision.indexOf("await deps.executeGrant(grantOperation)");
    assert.ok(persistAt > -1 && dispatchAt > persistAt);
    assert.match(provision, /for \(const grantOperation of persisted\.grantOperations\)/);
    assert.doesNotMatch(
      provision,
      /Promise\.all|Promise\.allSettled/,
      "same-folder permission mutations must be dispatched sequentially",
    );
    assert.match(
      provision.slice(dispatchAt),
      /catch\s*\{/,
      "one post-commit runtime failure must not strand later member intents",
    );
  });

  it("uses one process-wide same-folder permission queue across dispatchers", () => {
    const executor = source(
      "connections/project-drive-grant-operation-executor.ts",
    );
    const factory = executor.slice(
      executor.indexOf("export function projectDriveGrantOperationExecutorFromEnv"),
      executor.indexOf("export async function executeProjectDriveGrantOperation"),
    );
    assert.doesNotMatch(factory, /createFolderPermissionMutationQueue/);
    assert.match(
      factory,
      /recoverOrCreateExactDriveUserPermission\(\s*session,\s*input,\s*fetch,?\s*\)/,
    );
    const transport = source("connections/drive-grants.ts");
    assert.match(
      transport,
      /const processPermissionMutations = createFolderPermissionMutationQueue\(\)/,
    );
  });

  it("dispatches the accepted member's exact grant only after membership commits", () => {
    const settings = source("actions/settings.ts");
    const accept = exportedAction(settings, "acceptInviteAction");
    const transactionAt = accept.indexOf("const driveGrantIntent = await db.transaction");
    const prepareAt = accept.indexOf("prepareCurrentMemberDriveGrantIntent");
    const commitBoundaryAt = accept.indexOf('{ behavior: "immediate" }');
    const dispatchAt = accept.indexOf("executeProjectDriveGrantOperation");
    const cookieAt = accept.indexOf("const c = await cookies()");
    assert.ok(transactionAt > -1 && prepareAt > transactionAt);
    assert.ok(commitBoundaryAt > prepareAt && dispatchAt > commitBoundaryAt);
    assert.ok(cookieAt > dispatchAt);
    assert.match(
      accept,
      /workspaceId:\s*driveGrantIntent\.operation\.workspaceId/,
    );
    assert.match(
      accept,
      /operationId:\s*driveGrantIntent\.operation\.operationId/,
    );
    assert.match(accept, /if \(driveGrantIntent\.kind === ["']grant-intent["']\)/);
    assert.match(
      accept.slice(dispatchAt, cookieAt),
      /catch\s*\{/,
      "a post-commit runtime failure must not report that invite acceptance failed",
    );
  });
});
