import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { workspaceStorage } from "@/server/db/schema";
import {
  createDriveFolderService,
  DRIVE_FOLDER_GENERATION_MARKER,
  DRIVE_FOLDER_WORKSPACE_MARKER,
  DriveFolderError,
} from "./drive-folders";
import { createProjectDriveAccessService } from "./project-drive-access";
import { ProjectDriveAuthorizationError } from "./project-drive-authz";
import {
  accessDependencies,
  coreAuthorization,
  freshProjectDriveCoreDb,
  jsonResponse,
  seedProjectDriveCore,
  seedStorageGenerations,
  tokenRefreshResponse,
} from "./project-drive-core.test.helpers";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function folder(input: {
  id?: string;
  workspaceId?: string;
  generationId?: string;
  parentId?: string;
  mimeType?: string;
  trashed?: boolean;
  name?: string;
}) {
  const id = input.id ?? "folder-created";
  return {
    id,
    name: input.name ?? "Project A",
    mimeType: input.mimeType ?? FOLDER_MIME,
    parents: [input.parentId ?? "root-new"],
    appProperties: {
      [DRIVE_FOLDER_WORKSPACE_MARKER]: input.workspaceId ?? "ws-a",
      [DRIVE_FOLDER_GENERATION_MARKER]: input.generationId ?? "gen-target",
    },
    webViewLink: `https://drive.example/${id}`,
    trashed: input.trashed ?? false,
  };
}

describe("Project Drive board folders", () => {
  it("refuses a task-only proof before database or provider work", async () => {
    const fixture = await freshProjectDriveCoreDb();
    cleanups.push(fixture.cleanup);
    let providerCalls = 0;
    const fetchImpl: typeof fetch = async () => {
      providerCalls += 1;
      throw new Error("provider must not be reached");
    };
    const access = createProjectDriveAccessService(
      accessDependencies(fixture.db, fetchImpl),
    );
    const service = createDriveFolderService({
      database: fixture.db,
      access,
      fetchImpl,
    });
    await assert.rejects(
      () =>
        service.provision(coreAuthorization("member-a", "ws-a", false), {
          storageGenerationId: "gen-target",
          folderName: "Project A",
        }),
      ProjectDriveAuthorizationError,
    );
    assert.equal(providerCalls, 0);
  });

  it("creates one marked folder beneath the private root and persists its immutable generation", async () => {
    const fixture = await freshProjectDriveCoreDb();
    cleanups.push(fixture.cleanup);
    await seedProjectDriveCore(fixture.client);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      if (init?.method === "GET") return jsonResponse({ files: [] });
      if (init?.method === "POST") return jsonResponse(folder({}));
      throw new Error("unexpected request");
    };
    const access = createProjectDriveAccessService(
      accessDependencies(fixture.db, fetchImpl),
    );
    const service = createDriveFolderService({
      database: fixture.db,
      access,
      fetchImpl,
    });

    const result = await service.provision(
      coreAuthorization("owner", "ws-a"),
      { storageGenerationId: "gen-target", folderName: "Project A" },
    );
    assert.equal(result.outcome, "created");
    assert.equal(result.folderId, "folder-created");
    const create = calls.find(
      (call) =>
        call.init?.method === "POST" && call.url.includes("/drive/v3/files"),
    );
    assert.ok(create);
    const body = JSON.parse(String(create.init?.body)) as Record<string, unknown>;
    assert.deepEqual(body.parents, ["root-new"]);
    assert.deepEqual(body.appProperties, {
      [DRIVE_FOLDER_WORKSPACE_MARKER]: "ws-a",
      [DRIVE_FOLDER_GENERATION_MARKER]: "gen-target",
    });

    const [stored] = await fixture.db
      .select()
      .from(workspaceStorage)
      .where(eq(workspaceStorage.id, "gen-target"));
    assert.equal(stored.workspaceId, "ws-a");
    assert.equal(stored.connectionId, "conn-new");
    assert.equal(stored.folderId, "folder-created");
    assert.equal(stored.isCurrent, true);
  });

  it("adopts one exact marked folder but rejects wrong parent, project, MIME, trash, and multiple hits", async (t) => {
    const cases = [
      { name: "wrong parent / account", files: [folder({ parentId: "root-other" })], code: "folder-invalid" },
      { name: "cross-project marker", files: [folder({ workspaceId: "ws-b" })], code: "folder-invalid" },
      { name: "wrong MIME", files: [folder({ mimeType: "text/plain" })], code: "folder-invalid" },
      { name: "trashed", files: [folder({ trashed: true })], code: "folder-invalid" },
      {
        name: "multiple generation matches",
        files: [folder({ id: "folder-one" }), folder({ id: "folder-two" })],
        code: "folder-ambiguous",
      },
    ] as const;

    for (const scenario of cases) {
      await t.test(scenario.name, async () => {
        const fixture = await freshProjectDriveCoreDb();
        cleanups.push(fixture.cleanup);
        await seedProjectDriveCore(fixture.client);
        const fetchImpl: typeof fetch = async (input) =>
          String(input).includes("oauth2.googleapis.com/token")
            ? tokenRefreshResponse()
            : jsonResponse({ files: scenario.files });
        const access = createProjectDriveAccessService(
          accessDependencies(fixture.db, fetchImpl),
        );
        const service = createDriveFolderService({
          database: fixture.db,
          access,
          fetchImpl,
        });
        await assert.rejects(
          () =>
            service.provision(coreAuthorization("owner", "ws-a"), {
              storageGenerationId: "gen-target",
              folderName: "Project A",
            }),
          (error: unknown) =>
            error instanceof DriveFolderError && error.code === scenario.code,
        );
        assert.equal(
          Number(
            (
              await fixture.client.execute(
                "SELECT COUNT(*) AS value FROM workspace_storage WHERE workspace_id = 'ws-a'",
              )
            ).rows[0].value,
          ),
          0,
        );
      });
    }
  });

  it("adopts an exact existing provider folder without issuing create", async () => {
    const fixture = await freshProjectDriveCoreDb();
    cleanups.push(fixture.cleanup);
    await seedProjectDriveCore(fixture.client);
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      methods.push(init?.method ?? "GET");
      return jsonResponse({ files: [folder({ id: "folder-adopted" })] });
    };
    const access = createProjectDriveAccessService(
      accessDependencies(fixture.db, fetchImpl),
    );
    const service = createDriveFolderService({
      database: fixture.db,
      access,
      fetchImpl,
    });
    const result = await service.provision(
      coreAuthorization("owner", "ws-a"),
      { storageGenerationId: "gen-target", folderName: "Project A" },
    );
    assert.equal(result.outcome, "adopted");
    assert.deepEqual(methods, ["GET"]);
  });

  it("renames only the current generation after re-verifying its exact markers and parent", async () => {
    const fixture = await freshProjectDriveCoreDb();
    cleanups.push(fixture.cleanup);
    await seedProjectDriveCore(fixture.client);
    await seedStorageGenerations(fixture.client);
    const driveCalls: Array<{ url: string; init?: RequestInit }> = [];
    const currentFolder = folder({
      id: "folder-current",
      generationId: "gen-current",
      parentId: "root-old",
    });
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return tokenRefreshResponse();
      }
      driveCalls.push({ url, init });
      return jsonResponse({ ...currentFolder, name: "Renamed Project" });
    };
    const access = createProjectDriveAccessService(
      accessDependencies(fixture.db, fetchImpl),
    );
    const service = createDriveFolderService({
      database: fixture.db,
      access,
      fetchImpl,
    });
    const result = await service.renameCurrent(
      coreAuthorization("owner", "ws-a"),
      "Renamed Project",
    );
    assert.equal(result.storageGenerationId, "gen-current");
    assert.equal(result.outcome, "renamed");
    assert.equal(driveCalls.length, 2);
    assert.ok(driveCalls.every((call) => call.url.includes("folder-current")));
    assert.ok(driveCalls.every((call) => !call.url.includes("folder-old")));
    assert.equal(driveCalls[1].init?.method, "PATCH");
    assert.deepEqual(JSON.parse(String(driveCalls[1].init?.body)), {
      name: "Renamed Project",
    });
  });

  it("will not replace a current immutable generation during provisioning", async () => {
    const fixture = await freshProjectDriveCoreDb();
    cleanups.push(fixture.cleanup);
    await seedProjectDriveCore(fixture.client);
    await seedStorageGenerations(fixture.client);
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return tokenRefreshResponse();
    };
    const access = createProjectDriveAccessService(
      accessDependencies(fixture.db, fetchImpl),
    );
    const service = createDriveFolderService({
      database: fixture.db,
      access,
      fetchImpl,
    });
    await assert.rejects(
      () =>
        service.provision(coreAuthorization("owner", "ws-a"), {
          storageGenerationId: "gen-replacement",
          folderName: "Replacement",
        }),
      (error: unknown) =>
        error instanceof DriveFolderError && error.code === "storage-conflict",
    );
    assert.equal(calls, 0);
  });
});
