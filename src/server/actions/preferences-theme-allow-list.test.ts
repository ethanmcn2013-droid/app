/**
 * The user-preferences server action's allow-list — the enforcement boundary
 * behind the appearance control.
 *
 * WHY THIS FILE EXISTS. `updateUserPreferencesAction` is a "use server" entry
 * point: its argument arrives over the wire from a client component and is
 * whatever the caller sent. The action's answer to that is to build a fresh
 * `patch` and copy across only the fields whose values appear in a fixed list
 * — never to spread the input. Dark mode (D-013, 2026-08-11) widened the theme
 * list from two values to three with no test underneath it, so nothing stopped
 * the next widening from being `String(raw.themeMode)`.
 *
 * HOW IT IS TESTED WITHOUT WEAKENING THE ACTION. A "use server" module may only
 * export async functions, so the allow-list cannot be exported for inspection
 * and no validation seam can be added without breaking that contract. Rather
 * than change the module, this test seeds `require.cache` with stand-ins for
 * the action's three collaborators — auth, the preferences writer and
 * `revalidatePath` — before the action is first required, then calls the real
 * exported action and reads the patch that reached the writer. The action's
 * own source is untouched and every assertion below runs its actual body.
 *
 * (The same seam is what lets this run at all: `getCurrentUser` needs Clerk and
 * a request scope, and `revalidatePath` needs a Next render context. Neither
 * exists in a `node --test` process, and neither is what this file is about.)
 *
 * Run:
 *   node --import tsx --import ./src/test/register-server-only.mjs --test \
 *     src/server/actions/preferences-theme-allow-list.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { before, describe, it } from "node:test";

type Patch = Record<string, unknown>;

const req = createRequire(__filename);

let lastPatch: Patch | null = null;
let writes = 0;
let revalidated: string[] = [];

function seed(specifier: string, exports: Record<string, unknown>) {
  const filename = req.resolve(specifier);
  req.cache[filename] = {
    id: filename,
    filename,
    path: path.dirname(filename),
    loaded: true,
    exports,
    children: [],
    paths: [],
  } as never;
}

// Seeded at module scope: the action must not have been required yet.
seed("next/cache", {
  revalidatePath: (p: string) => {
    revalidated.push(p);
  },
});
seed("@/server/auth", {
  getCurrentUser: async () => "user_allow_list_test",
});
seed("@/server/db/preferences", {
  upsertUserPreferences: async (_userId: string, patch: Patch) => {
    writes += 1;
    lastPatch = patch;
  },
});

let updateUserPreferencesAction: (raw: unknown) => Promise<void>;

/** Calls the real action with an arbitrary payload and returns what was written. */
async function submit(raw: unknown): Promise<Patch> {
  lastPatch = null;
  writes = 0;
  revalidated = [];
  await updateUserPreferencesAction(raw);
  assert.equal(writes, 1, "the action must always reach the writer, even with nothing valid");
  assert.deepEqual(revalidated, ["/settings/notifications"]);
  const patch = lastPatch;
  if (!patch) throw new Error("the writer must have received a patch object");
  return patch;
}

const source = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), "utf8");

describe("updateUserPreferencesAction — the theme allow-list", () => {
  before(async () => {
    const mod = await import("@/server/actions/preferences");
    updateUserPreferencesAction = mod.updateUserPreferencesAction as typeof updateUserPreferencesAction;
  });

  it("accepts each of system, light and dark and writes it through unchanged", async () => {
    for (const themeMode of ["system", "light", "dark"]) {
      assert.deepEqual(await submit({ themeMode }), { themeMode }, themeMode);
    }
  });

  it("drops anything outside the three, without failing the request", async () => {
    // Everything here is a value the wire can carry. None of them may reach the
    // column, and none of them may turn a preferences save into an error — the
    // action's contract is "silently dropped rather than written".
    const rejected: unknown[] = [
      "Dark",
      "DARK",
      "Light",
      " dark",
      "dark ",
      "",
      "auto",
      "sepia",
      "high-contrast",
      "system,dark",
      "dark'; drop table user_preferences; --",
      "__proto__",
      "constructor",
      "toString",
      null,
      0,
      1,
      true,
      false,
      [],
      ["dark"],
      {},
      { toString: () => "dark" },
    ];

    for (const themeMode of rejected) {
      assert.deepEqual(
        await submit({ themeMode }),
        {},
        `themeMode ${JSON.stringify(themeMode) ?? String(themeMode)} must be dropped`,
      );
    }
  });

  it("treats an absent theme as no opinion, not as a reset", async () => {
    assert.deepEqual(await submit({}), {});
    assert.deepEqual(await submit({ themeMode: undefined }), {});
  });

  it("builds the patch fresh, so no unlisted key can ride along with a valid theme", async () => {
    const patch = await submit({
      themeMode: "dark",
      // Not fields of the patch type at all — the point is that a caller can
      // still put them on the wire.
      isAdmin: true,
      userId: "someone-else",
      role: "owner",
      workspaceId: "ws-not-mine",
    });
    assert.deepEqual(patch, { themeMode: "dark" });
  });

  it("keeps the other fields' allow-lists working beside the theme's", async () => {
    // A rejected theme must not take a valid neighbour down with it, and a
    // valid theme must not carry a rejected neighbour in.
    assert.deepEqual(await submit({ themeMode: "neon", weeklySummary: "mondays" }), {
      weeklySummary: "mondays",
    });
    assert.deepEqual(await submit({ themeMode: "dark", dailySignalCadence: "hourly" }), {
      themeMode: "dark",
    });
    assert.deepEqual(
      await submit({ themeMode: "light", dailySignalCadence: "weekdays", weeklySummary: "off" }),
      { themeMode: "light", dailySignalCadence: "weekdays", weeklySummary: "off" },
    );
  });

  it("never spreads the caller's object into the patch", async () => {
    // The behavioural test above proves today's body; this proves the shape
    // that keeps it true, because `{ ...raw }` would pass every case above the
    // moment someone also kept the includes() checks.
    const actionSource = source("src", "server", "actions", "preferences.ts");
    assert.doesNotMatch(actionSource, /\.\.\.\s*raw/);
    assert.match(actionSource, /const patch: UserPreferencesPatch = \{\};/);
    assert.match(actionSource, /await upsertUserPreferences\(me, patch\);/);
    assert.doesNotMatch(actionSource, /upsertUserPreferences\(me, raw\)/);
  });

  it("keeps the allow-list and the ThemeMode union from drifting apart", async () => {
    const actionSource = source("src", "server", "actions", "preferences.ts");
    const dbSource = source("src", "server", "db", "preferences.ts");

    const listed = /const THEME: ThemeMode\[\] = \[([^\]]*)\];/.exec(actionSource);
    assert.ok(listed, "the theme allow-list must stay a named ThemeMode[] constant");
    const allowList = listed[1]
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);

    const union = /export type ThemeMode = ([^;]+);/.exec(dbSource);
    assert.ok(union, "ThemeMode must stay a declared union in src/server/db/preferences.ts");
    const unionMembers = union[1]
      .split("|")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);

    assert.deepEqual(
      [...allowList].sort(),
      [...unionMembers].sort(),
      "every ThemeMode the type admits must be on the server allow-list, and no more",
    );
    assert.deepEqual(allowList, ["system", "light", "dark"]);
    assert.match(dbSource, /themeMode: "system"/, "the stored default must remain system");
  });

  it("is guarded before the write, not after it", async () => {
    const actionSource = source("src", "server", "actions", "preferences.ts");
    assert.ok(
      actionSource.indexOf("THEME.includes(raw.themeMode)") <
        actionSource.indexOf("await upsertUserPreferences(me, patch);"),
      "the allow-list check must sit ahead of the write",
    );
  });
});
