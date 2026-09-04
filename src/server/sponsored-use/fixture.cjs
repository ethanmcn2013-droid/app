/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness loads actual TS actions with explicit framework boundaries. */
const fs = require("node:fs"), path = require("node:path");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const { tmpdir } = require("node:os");
const root = path.resolve(__dirname, "../../..");
const dep = createRequire(root + "/package.json"), ts = dep("typescript");
const { createClient } = dep("@libsql/client"), { drizzle } = dep("drizzle-orm/libsql");
const { eq } = dep("drizzle-orm");
const SALT = "synthetic-only-usage-salt-for-fixtures";
async function usageFixture(options = {}) {
  const directory = fs.mkdtempSync(path.join(tmpdir(), "usage-action-"));
  const client = createClient({ url: pathToFileURL(path.join(directory, "local.db")).href });
  await client.execute("PRAGMA journal_mode=WAL");
  for (const file of fs.readdirSync(root + "/drizzle").filter(f => /^\d{4}_.+\.sql$/.test(f) && f >= "0014_").sort())
    await client.executeMultiple(fs.readFileSync(root + "/drizzle/" + file, "utf8"));
  let db;
  const state = { actor: "owner", ambient: "a", demo: false, afterAuth: null };
  const cache = new Map();
  function load(name) {
    const file = [name, name + ".ts", name + ".tsx", name + "/index.ts"].find(f => fs.existsSync(root + "/" + f) && fs.statSync(root + "/" + f).isFile()) ?? name;
    if (file === "src/server/db/index.ts") return { db };
    if (file === "src/server/auth.ts") return { getCurrentUser: async () => state.actor, getActiveWorkspaceOrNull: async () => state.ambient };
    if (file === "src/lib/access-mode.ts") return { isDemoMode: () => state.demo };
    if (file === "src/server/db/queries.ts") return { getTasks: async ws => db.select().from(schema.tasks).where(eq(schema.tasks.workspaceId, ws)) };
    if (file === "src/server/db/board-config-read.ts") return { readWorkspaceColumnConfig: async () => { if(state.afterAuth) await state.afterAuth(); return null; } };
    if (file === "src/lib/board-columns.ts") return { isDoneColumnKey: lane => lane === "done" };
    if (file === "src/server/db/seed.ts") return { LEGACY_WORKSPACE_ID: "legacy" };
    if (file === "src/server/events.ts") return { emitTasksChanged: () => {} };
    if (file === "src/server/demo/tasks-demo.ts") return { demoTasks: () => [] };
    if (file.startsWith("src/server/attachments/") || file === "src/server/milestones.ts") return {};
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    if (file.endsWith(".json")) { mod.exports = JSON.parse(fs.readFileSync(root + "/" + file)); return mod.exports; }
    const source = fs.readFileSync(root + "/" + file, "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const req = spec => {
      if (spec === "server-only") return {};
      if (spec === "next/cache") return { revalidatePath: () => {} };
      if (spec.startsWith("@/")) return load("src/" + spec.slice(2));
      if (spec.startsWith(".")) return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
      return dep(spec);
    };
    new Function("require", "module", "exports", "fetch", js)(req, mod, mod.exports, () => { throw Error("Real network forbidden"); });
    return mod.exports;
  }
  const schema = load("src/server/db/schema.ts"); db = drizzle(client, { schema });
  for (const id of ["owner", "member", "outsider"]) await db.insert(schema.users).values({ id, clerkId: "clerk-" + id, initials: "FX", color: "fixture" });
  for (const id of ["a", "b"]) {
    const owner = id === "a" ? "owner" : "outsider";
    await db.insert(schema.workspaces).values({ id, slug: id, name: id, ownerUserId: owner });
    await db.insert(schema.workspaceMembers).values({ workspaceId: id, userId: owner, role: "owner" });
  }
  await db.insert(schema.workspaceMembers).values({ workspaceId: "a", userId: "member", role: "member" });
  const now = Date.now();
  async function seedClaim(actor = "owner", project = "a", digit = "a") {
    const protocol = load("src/lib/venue-issuance/protocol.ts");
    const canonical = load("src/server/venue-issuance/canonical.ts");
    const code = "VENUE-ABCDE-FGHJ" + (actor === "owner" ? "K" : "M");
    const manifest = { version:1,issuanceId:"vi-"+digit.repeat(32),sponsorId:"synthetic-sponsor",
      sponsorSlug:"synthetic",sponsorName:"Synthetic venue",environment:"internal_test",issuedAt:now-2*86400000,
      eligibility:{kind:"pilot",reference:"pilot-fixture-only",startsAt:now-3*86400000,endsAt:now+86400000},
      tier:"wedding",durationDays:548,codes:[{licenseCodeId:"vlc-"+digit.repeat(32),codeFingerprint:protocol.venueCodeFingerprint(code)}] };
    await db.insert(schema.meta).values({key:protocol.issuanceReceiptKey(manifest.issuanceId),value:JSON.stringify({manifest,manifestHash:protocol.manifestHash(manifest)})});
    await db.insert(schema.compCodes).values({code,tier:"wedding",durationDays:548,quantity:1,redeemed:1,notes:canonical.canonicalVenueCodeNotes(manifest,manifest.codes[0])});
    await db.insert(schema.entitlements).values({id:"claim-"+actor,userId:actor,workspaceId:project,source:"comp",tier:"wedding",
      startedAt:new Date(now-86400000),expiresAt:new Date(now+86400000),notes:"comp:"+code});
    return {manifest,code};
  }
  const issued = options.seedClaim === false ? null : await seedClaim();
  const usageSchema = load("src/server/sponsored-use/schema.ts");
  return { db, client, schema, usageSchema, state, load, now, issued, seedClaim,
    action: load("src/server/actions/tasks.ts").addTaskAction,
    counts: async () => {
      const out = {};
      for (const table of ["tasks", "activities", "sponsored_use_intents", "sponsored_use_subjects"])
        out[table] = Number((await client.execute("SELECT count(*) AS n FROM " + table)).rows[0].n);
      return out;
    },
    close: () => {
      client.close();
      // Windows libSQL can retain a handle until process exit. Never mask an
      // assertion failure with that disposable-file cleanup limitation.
      try { fs.rmSync(directory, { recursive: true, force: true }); }
      catch (error) { if (!["EPERM", "EBUSY"].includes(error.code)) throw error; }
    },
  };
}
module.exports = { usageFixture, SALT };
