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
  let visitSequence = 0;
  function load(name) {
    const file = [name, name + ".ts", name + ".tsx", name + "/index.ts"].find(f => fs.existsSync(root + "/" + f) && fs.statSync(root + "/" + f).isFile()) ?? name;
    if (file === "src/server/db/index.ts") return { db };
    if (file === "src/server/auth.ts") return { getCurrentUser: async () => state.actor, getActiveWorkspaceOrNull: async () => state.ambient };
    if (file === "src/lib/access-mode.ts") return { isDemoMode: () => state.demo };
    if (file === "src/server/db/queries.ts") return {
      getTasks: async ws => db.select().from(schema.tasks).where(eq(schema.tasks.workspaceId, ws)),
      // Represent the production query helper's same Drizzle INSERT against
      // the disposable store, including its 60-character user-agent limit.
      recordShareLinkVisit: async (token, userAgent) => db.insert(schema.shareLinkVisits).values({
        id: `fixture-visit-${++visitSequence}`,
        token,
        userAgentHint: userAgent ? userAgent.slice(0, 60) : null,
      }),
    };
    if (file === "src/server/db/board-config-read.ts") return { readWorkspaceColumnConfig: async () => null };
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
    if (file === "src/server/actions/project-authz.ts") {
      const original = mod.exports.authorizeProjectCandidate;
      mod.exports.authorizeProjectCandidate = async (...args) => {
        const candidate = await original(...args);
        // The fixture removes membership after preflight but before the
        // action's immediate writer transaction reauthorizes stored truth.
        if (state.afterAuth) {
          const afterAuth = state.afterAuth;
          state.afterAuth = null;
          await afterAuth();
        }
        return candidate;
      };
    }
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
  async function seedVenueCohort({ count = 40, claimAt, grantEndsAt }) {
    if (!Number.isSafeInteger(count) || count < 1 || count > 50 ||
        !Number.isSafeInteger(claimAt) || !Number.isSafeInteger(grantEndsAt) || grantEndsAt <= claimAt)
      throw new Error("Invalid synthetic cohort");
    const protocol = load("src/lib/venue-issuance/protocol.ts");
    const canonical = load("src/server/venue-issuance/canonical.ts");
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const rows = [], issuances = [];
    for (let start = 0; start < count; start += 25) {
      const cohort = Math.floor(start / 25) + 1;
      const chunk = Math.min(25, count - start);
      const codes = Array.from({ length: chunk }, (_, offset) => {
        const n = start + offset + 1;
        const suffix = Array.from({ length: 5 }, (_, place) => alphabet[Math.floor(n / (alphabet.length ** place)) % alphabet.length]).join("");
        const code = "VENUE-ABCDE-" + suffix;
        return { licenseCodeId: "vlc-" + n.toString(16).padStart(32, "0"), code,
          codeFingerprint: protocol.venueCodeFingerprint(code) };
      });
      const manifest = { version: 1, issuanceId: "vi-" + cohort.toString(16).padStart(32, "0"),
        sponsorId: "synthetic-sponsor", sponsorSlug: "synthetic", sponsorName: "Synthetic venue",
        environment: "internal_test", issuedAt: claimAt - 2 * 86400000,
        eligibility: { kind: "pilot", reference: "pilot-cohort-fixture", startsAt: claimAt - 3 * 86400000,
          endsAt: grantEndsAt + 86400000 }, tier: "wedding", durationDays: 548,
        codes: codes.map(({ licenseCodeId, codeFingerprint }) => ({ licenseCodeId, codeFingerprint })) };
      issuances.push({ manifest, codes });
      await db.insert(schema.meta).values({ key: protocol.issuanceReceiptKey(manifest.issuanceId),
        value: JSON.stringify({ manifest, manifestHash: protocol.manifestHash(manifest) }) });
      for (let i = 0; i < codes.length; i++) {
        const n = start + i + 1;
        const userId = "cohort-user-" + n, projectId = "cohort-project-" + n;
        await db.insert(schema.users).values({ id: userId, clerkId: "clerk-cohort-" + n, initials: "FX", color: "fixture" });
        await db.insert(schema.workspaces).values({ id: projectId, slug: projectId, name: projectId, ownerUserId: userId });
        await db.insert(schema.workspaceMembers).values({ workspaceId: projectId, userId, role: "owner" });
        await db.insert(schema.compCodes).values({ code: codes[i].code, tier: "wedding", durationDays: 548,
          quantity: 1, redeemed: 0, notes: canonical.canonicalVenueCodeNotes(manifest, manifest.codes[i]) });
        const claimed = await load("src/server/db/comp-redemption.ts").claimCompEntitlement(db, {
          code: codes[i].code, actorUserId: userId, candidateProjectId: projectId, now: new Date(claimAt),
        });
        if (!claimed.ok || claimed.entitlement.expiresAt.getTime() < grantEndsAt)
          throw new Error("Synthetic canonical venue claim failed");
        const entitlementId = claimed.entitlement.id;
        rows.push({ n, userId, projectId, entitlementId, issuanceId: manifest.issuanceId,
          licenseCodeId: codes[i].licenseCodeId });
      }
    }
    return { rows, issuances };
  }
  async function actionAt(instant, input) {
    const old = Date.now;
    Date.now = () => instant;
    try { return await load("src/server/actions/tasks.ts").addTaskAction(input); }
    finally { Date.now = old; }
  }
  const issued = options.seedClaim === false ? null : await seedClaim();
  const usageSchema = load("src/server/sponsored-use/schema.ts");
  return { db, client, schema, usageSchema, state, load, now, issued, seedClaim, seedVenueCohort, actionAt,
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
