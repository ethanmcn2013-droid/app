import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import * as schema from "@/server/db/schema";

export type ProofInput = {
  version: 1; runtimeGrant: { sourceSha: string; sourceTree: string; buildId: string; expiresAt: string; operations: string[] };
  origin: string; storeRoot: string; evidenceRoot: string; issuer: string;
  clerkOrigins: string[];
  accounts: [ { subject: string; email: string; projectId: string; planningPeriodId: string; controlProjectId: string; controlTaskId: string; siblingTaskId: string }, { subject: string; email: string; projectId: string; planningPeriodId: string; controlProjectId: string; controlTaskId: string; siblingTaskId: string } ];
  testEmailCodeEligible: boolean;
};
export function validateProofInput(input: ProofInput) {
  if (input.version !== 1 || !input.runtimeGrant || !/^[a-f0-9]{40}$/.test(input.runtimeGrant.sourceSha) || !/^[a-f0-9]{40}$/.test(input.runtimeGrant.sourceTree) ||
    !input.runtimeGrant.buildId || !Number.isFinite(Date.parse(input.runtimeGrant.expiresAt)) || Date.parse(input.runtimeGrant.expiresAt) <= Date.now() || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{3,4}$/.test(input.origin) ||
    !isAbsolute(input.storeRoot) || !isAbsolute(input.evidenceRoot) || !/^https:\/\/[a-z0-9-]+\.clerk\.accounts\.dev$/.test(input.issuer) || input.accounts.length !== 2 ||
    input.accounts.some(account => !/^user_[A-Za-z0-9]+$/.test(account.subject) || !account.email || [account.projectId, account.planningPeriodId, account.controlProjectId, account.controlTaskId, account.siblingTaskId].some(id => !/^[A-Za-z0-9_-]{1,128}$/.test(id))) ||
    ["subject", "projectId", "planningPeriodId"].some(key => new Set(input.accounts.map(account => account[key as keyof typeof account])).size !== 2)) throw new Error("Invalid private runtime admission");
  if (!["seed", "sign-in", "read", "create", "title", "restart", "cleanup"].every(operation => input.runtimeGrant.operations.includes(operation))) throw new Error("Incomplete runtime admission");
  if (new Set(input.accounts.flatMap(account => [account.projectId, account.controlProjectId])).size !== 4 || new Set(input.accounts.flatMap(account => [account.controlTaskId, account.siblingTaskId])).size !== 4) throw new Error("Control targets must be distinct");
  if (!Array.isArray(input.clerkOrigins) || input.clerkOrigins.length > 6 || !input.clerkOrigins.includes(input.issuer) || new Set(input.clerkOrigins).size !== input.clerkOrigins.length || input.clerkOrigins.some(origin => { try { const url = new URL(origin); return url.protocol !== "https:" || url.origin !== origin; } catch { return true; } })) throw new Error("Exact private Clerk origins required");
  const evidenceRelation = relative(resolve(input.storeRoot), resolve(input.evidenceRoot));
  const storeRelation = relative(resolve(input.evidenceRoot), resolve(input.storeRoot));
  if (!evidenceRelation || (!evidenceRelation.startsWith("..") && !isAbsolute(evidenceRelation)) || (!storeRelation.startsWith("..") && !isAbsolute(storeRelation))) throw new Error("Evidence and stores must have disjoint ownership");
  return input;
}
export const storeUrls = (input: ProofInput) => Object.fromEntries(["TASKS", "NOTES", "TIMELINE", "SIGNAL", "ENTITLEMENTS"].map(module => [`${module}_DATABASE_URL`, pathToFileURL(resolve(input.storeRoot, `${module.toLowerCase()}.db`)).href]));
/** Invoke only under a separately issued runtime grant. No provider calls. */
export async function seedFiveStoreFixture(input: ProofInput) {
  validateProofInput(input);
  if (existsSync(input.storeRoot)) throw new Error("Fresh fixture root must be unoccupied");
  mkdirSync(input.storeRoot, { recursive: true });
  const roots = { TASKS: "drizzle", NOTES: "drizzle-notes", TIMELINE: "drizzle-timeline", SIGNAL: "drizzle-signal" };
  const urls = storeUrls(input);
  for (const [module, directory] of Object.entries(roots)) {
    validateProofInput(input);
    const client = createClient({ url: urls[`${module}_DATABASE_URL`] });
    try {
      await client.execute("PRAGMA foreign_keys = ON");
      for (const file of readdirSync(directory).filter(file => /^\d{4}_.+\.sql$/.test(file) && (module !== "TASKS" || file >= "0014_")).sort()) { validateProofInput(input); await client.executeMultiple(readFileSync(resolve(directory, file), "utf8")); }
      if (module === "TASKS") {
        const database = drizzle(client, { schema });
        for (const [index, account] of input.accounts.entries()) {
          validateProofInput(input);
          await database.insert(schema.users).values({ id: account.subject, clerkId: account.subject, email: account.email, name: `Proof account ${index + 1}`, color: "indigo", initials: `P${index + 1}` });
          await database.insert(schema.planningPeriods).values({ id: account.planningPeriodId, ownerUserId: account.subject, name: `Proof period ${index + 1}` });
          await database.insert(schema.workspaces).values({ id: account.projectId, slug: account.projectId, name: `Proof project ${index + 1}`, ownerUserId: account.subject, planningPeriodId: account.planningPeriodId, position: 0, onboardingCompletedAt: new Date(), activeDomain: "General" });
          await database.insert(schema.workspaceMembers).values({ workspaceId: account.projectId, userId: account.subject, role: "owner" });
          await database.insert(schema.workspaces).values({ id: account.controlProjectId, slug: account.controlProjectId, name: `Control project ${index + 1}`, ownerUserId: account.subject, planningPeriodId: account.planningPeriodId, position: 1, onboardingCompletedAt: new Date() });
          await database.insert(schema.workspaceMembers).values({ workspaceId: account.controlProjectId, userId: account.subject, role: "owner" });
          for (const [taskId, projectId] of [[account.siblingTaskId, account.projectId], [account.controlTaskId, account.controlProjectId]]) await database.insert(schema.tasks).values({ id: taskId, workspaceId: projectId, title: "Fixture control task", lane: "todo", priority: "p2", assignees: [], seq: 1, position: 1 });
        }
      }
    } finally { client.close(); }
  }
  // Preserve the admitted empty-file/fail-soft read contract. The harness
  // independently checks sqlite_schema and data before and after App reads.
  validateProofInput(input); writeFileSync(resolve(input.storeRoot, "entitlements.db"), new Uint8Array());
  return urls;
}
export function ownedPath(root: string, path: string) {
  const result = relative(resolve(root), resolve(path));
  if (!result || result.startsWith("..") || isAbsolute(result)) throw new Error("Owned path check failed");
  return resolve(path);
}
