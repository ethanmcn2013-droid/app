/**
 * Stage 1 · the snapshot cron's two gates prove themselves (D-026 / R7).
 *
 * The route's job below the gates is composition of already-tested snapshot
 * helpers, so what is proven here is the part only this file owns: the
 * CRON_SECRET contract and the flag posture. Both paths return before any
 * database client is constructed, which is also why this test needs no db.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

type RouteModule = typeof import("./route");
let route: RouteModule | null = null;
async function load(): Promise<RouteModule> {
  route ??= await import("./route");
  return route;
}

function withEnv<T>(
  values: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  const prior = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    prior.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const restore = () => {
    for (const [key, value] of prior) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  return run().finally(restore);
}

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/analytics-snapshots", { headers });
}

test("wrong bearer is refused 401 when a secret is configured", async () => {
  const { GET } = await load();
  await withEnv(
    { CRON_SECRET: "the-real-secret", SIGNAL_ANALYTICS_SNAPSHOTS_ENABLED: "true" },
    async () => {
      const res = await GET(request({ authorization: "Bearer wrong" }));
      assert.equal(res.status, 401);
      const body = (await res.json()) as { ok: boolean; error: string };
      assert.deepEqual(body, { ok: false, error: "unauthorized" });
    },
  );
});

test("missing bearer is refused 401 when a secret is configured", async () => {
  const { GET } = await load();
  await withEnv(
    { CRON_SECRET: "the-real-secret", SIGNAL_ANALYTICS_SNAPSHOTS_ENABLED: "true" },
    async () => {
      const res = await GET(request());
      assert.equal(res.status, 401);
    },
  );
});

test("flag off returns a truthful skip, not an error", async () => {
  const { GET } = await load();
  await withEnv(
    { CRON_SECRET: "the-real-secret", SIGNAL_ANALYTICS_SNAPSHOTS_ENABLED: undefined },
    async () => {
      const res = await GET(request({ authorization: "Bearer the-real-secret" }));
      assert.equal(res.status, 200);
      const body = (await res.json()) as { ok: boolean; skipped?: string };
      assert.deepEqual(body, { ok: true, skipped: "flag-off" });
    },
  );
});

test("flag values other than the literal string true stay off", async () => {
  const { GET } = await load();
  for (const value of ["1", "yes", "TRUE", "on"]) {
    await withEnv(
      { CRON_SECRET: "s", SIGNAL_ANALYTICS_SNAPSHOTS_ENABLED: value },
      async () => {
        const res = await GET(request({ authorization: "Bearer s" }));
        const body = (await res.json()) as { skipped?: string };
        assert.equal(
          body.skipped,
          "flag-off",
          `"${value}" must not enable the writer; the flag is the literal string "true"`,
        );
      },
    );
  }
});
