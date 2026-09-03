import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createProjectDriveGrantRepairRoute } from "./route";

const originalSecret = process.env.CRON_SECRET;
const originalFlag = process.env.SIGNAL_PROJECT_DRIVE_REVOKE_REPAIR_ENABLED;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
  if (originalFlag === undefined) {
    delete process.env.SIGNAL_PROJECT_DRIVE_REVOKE_REPAIR_ENABLED;
  } else {
    process.env.SIGNAL_PROJECT_DRIVE_REVOKE_REPAIR_ENABLED = originalFlag;
  }
});

function request(authorization?: string): Request {
  return new Request(
    "http://localhost/api/cron/project-drive-grant-repair",
    authorization ? { headers: { authorization } } : undefined,
  );
}

test("requires the configured cron bearer before any repair work", async () => {
  process.env.CRON_SECRET = "real-secret";
  process.env.SIGNAL_PROJECT_DRIVE_REVOKE_REPAIR_ENABLED = "true";
  let calls = 0;
  const route = createProjectDriveGrantRepairRoute(async () => {
    calls += 1;
    return { scanned: 0, attempted: 0, repaired: 0, skipped: 0, failed: 0 };
  });

  for (const input of [request(), request("Bearer wrong")]) {
    const response = await route(input);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "unauthorized",
    });
  }
  assert.equal(calls, 0);
});

test("fails closed when CRON_SECRET is missing", async () => {
  delete process.env.CRON_SECRET;
  process.env.SIGNAL_PROJECT_DRIVE_REVOKE_REPAIR_ENABLED = "true";
  const route = createProjectDriveGrantRepairRoute(async () => {
    throw new Error("must not run");
  });

  assert.equal((await route(request("Bearer anything"))).status, 401);
});

test("the literal enable flag gates repair after authentication", async () => {
  process.env.CRON_SECRET = "secret";
  let calls = 0;
  const route = createProjectDriveGrantRepairRoute(async () => {
    calls += 1;
    return { scanned: 0, attempted: 0, repaired: 0, skipped: 0, failed: 0 };
  });

  for (const flag of [undefined, "1", "TRUE", "yes"]) {
    if (flag === undefined) {
      delete process.env.SIGNAL_PROJECT_DRIVE_REVOKE_REPAIR_ENABLED;
    } else {
      process.env.SIGNAL_PROJECT_DRIVE_REVOKE_REPAIR_ENABLED = flag;
    }
    const response = await route(request("Bearer secret"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, skipped: "flag-off" });
  }
  assert.equal(calls, 0);
});

test("returns a count-only repair receipt without provider detail", async () => {
  process.env.CRON_SECRET = "secret";
  process.env.SIGNAL_PROJECT_DRIVE_REVOKE_REPAIR_ENABLED = "true";
  const route = createProjectDriveGrantRepairRoute(async () => ({
    scanned: 4,
    attempted: 3,
    repaired: 2,
    skipped: 1,
    failed: 1,
  }));

  const response = await route(request("Bearer secret"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: false,
    scanned: 4,
    attempted: 3,
    repaired: 2,
    skipped: 1,
    failed: 1,
  });
});
