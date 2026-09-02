import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
  providerConnections,
  workspaceStorage,
} from "@/server/db/schema";
import {
  createProjectDriveAccessService,
  ProjectDriveAccessError,
} from "./project-drive-access";
import {
  accessDependencies,
  coreAuthorization,
  freshProjectDriveCoreDb,
  jsonResponse,
  seedProjectDriveCore,
  seedStorageGenerations,
  tokenRefreshResponse,
} from "./project-drive-core.test.helpers";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

describe("request-local Project Drive access", () => {
  it("uses the newest current credential in the stored account lineage without repointing history", async () => {
    const fixture = await freshProjectDriveCoreDb();
    cleanups.push(fixture.cleanup);
    await seedProjectDriveCore(fixture.client);
    await seedStorageGenerations(fixture.client);
    const tokenBodies: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      assert.match(String(input), /oauth2\.googleapis\.com\/token/);
      tokenBodies.push(String(init?.body));
      return tokenRefreshResponse("access-from-new-lineage");
    };
    const service = createProjectDriveAccessService(
      accessDependencies(fixture.db, fetchImpl),
    );

    let seenAccessToken = "";
    const observed = await service.withStorageSession(
      // The access seam is capability-neutral: future upload/finalize calls
      // use a task-level proof, while folder/grant managers refine theirs.
      coreAuthorization("member-a", "ws-a", false),
      { kind: "generation", storageGenerationId: "gen-old" },
      async (session) => {
        seenAccessToken = session.accessToken;
        return {
          credentialId: session.credential.id,
          storedConnectionId: session.storage.connectionId,
          storedRoot: session.storageRootFolderId,
          currentRoot: session.credential.rootFolderId,
        };
      },
    );

    assert.deepEqual(observed, {
      credentialId: "conn-new",
      storedConnectionId: "conn-old",
      storedRoot: "root-old",
      currentRoot: "root-new",
    });
    assert.equal(seenAccessToken, "access-from-new-lineage");
    assert.equal(tokenBodies.length, 1);
    assert.match(tokenBodies[0], /refresh_token=refresh-new/);
    assert.doesNotMatch(tokenBodies[0], /refresh-old/);
    const [storage] = await fixture.db
      .select()
      .from(workspaceStorage)
      .where(eq(workspaceStorage.id, "gen-old"));
    assert.equal(storage.connectionId, "conn-old");
  });

  it("refuses a historical generation from another project before refresh", async () => {
    const fixture = await freshProjectDriveCoreDb();
    cleanups.push(fixture.cleanup);
    await seedProjectDriveCore(fixture.client);
    await seedStorageGenerations(fixture.client);
    let calls = 0;
    const service = createProjectDriveAccessService(
      accessDependencies(fixture.db, async () => {
        calls += 1;
        return tokenRefreshResponse();
      }),
    );

    await assert.rejects(
      () =>
        service.withStorageSession(
          coreAuthorization("owner", "ws-a"),
          { kind: "generation", storageGenerationId: "gen-other" },
          async () => null,
        ),
      (error: unknown) =>
        error instanceof ProjectDriveAccessError &&
        error.code === "storage-not-found",
    );
    assert.equal(calls, 0);
  });

  it("rejects a stored scope set that is not exactly drive.file", async () => {
    const fixture = await freshProjectDriveCoreDb();
    cleanups.push(fixture.cleanup);
    await seedProjectDriveCore(fixture.client);
    await seedStorageGenerations(fixture.client);
    await fixture.db
      .update(providerConnections)
      .set({ scopes: ["unexpected"] })
      .where(eq(providerConnections.id, "conn-new"));
    let calls = 0;
    const service = createProjectDriveAccessService(
      accessDependencies(fixture.db, async () => {
        calls += 1;
        return tokenRefreshResponse();
      }),
    );

    await assert.rejects(
      () =>
        service.withStorageSession(
          coreAuthorization("owner", "ws-a"),
          { kind: "current" },
          async () => null,
        ),
      (error: unknown) =>
        error instanceof ProjectDriveAccessError &&
        error.code === "unexpected-scope-set",
    );
    assert.equal(calls, 0);
  });

  it("marks the current credential and every same-lineage folder needs_reauth on invalid_grant", async () => {
    const fixture = await freshProjectDriveCoreDb();
    cleanups.push(fixture.cleanup);
    await seedProjectDriveCore(fixture.client);
    await seedStorageGenerations(fixture.client);
    const service = createProjectDriveAccessService(
      accessDependencies(fixture.db, async () =>
        jsonResponse({ error: "invalid_grant", error_description: "do-not-log" }, 400),
      ),
    );

    let caught: unknown;
    try {
      await service.withStorageSession(
        coreAuthorization("member-a", "ws-a"),
        { kind: "generation", storageGenerationId: "gen-old" },
        async () => null,
      );
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof ProjectDriveAccessError);
    assert.equal(caught.code, "needs-reauth");
    assert.doesNotMatch(caught.message, /invalid_grant|do-not-log|refresh-new/);

    const [connection] = await fixture.db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, "conn-new"));
    assert.equal(connection.status, "needs_reauth");
    const states = await fixture.db
      .select({ id: workspaceStorage.id, state: workspaceStorage.state })
      .from(workspaceStorage);
    assert.deepEqual(
      states
        .filter((row) => row.id !== "gen-other")
        .map((row) => [row.id, row.state])
        .sort(),
      [
        ["gen-current", "needs_reauth"],
        ["gen-old", "needs_reauth"],
      ],
    );
    assert.equal(
      states.find((row) => row.id === "gen-other")?.state,
      "active",
    );
  });

  it("does not retain a thrown transport secret in its public error", async () => {
    const fixture = await freshProjectDriveCoreDb();
    cleanups.push(fixture.cleanup);
    await seedProjectDriveCore(fixture.client);
    await seedStorageGenerations(fixture.client);
    const service = createProjectDriveAccessService(
      accessDependencies(fixture.db, async () => {
        throw new Error("network carried refresh-new and bearer-secret");
      }),
    );

    await assert.rejects(
      () =>
        service.withStorageSession(
          coreAuthorization("owner", "ws-a"),
          { kind: "current" },
          async () => null,
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.doesNotMatch(error.message, /refresh-new|bearer-secret/);
        return true;
      },
    );
  });
});
