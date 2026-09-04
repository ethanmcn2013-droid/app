import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { compCodes, entitlements, meta } from "@/server/db/schema";
import {
  issuanceReceiptKey, manifestHash, parseManifest, venueCodeFingerprint,
  withdrawalReceiptKey, VenueIssuanceError,
  type IssuanceEnvironment, type IssuanceManifest, type IssuanceReadback,
} from "@/lib/venue-issuance/protocol";

export type VenueIssuanceDb = LibSQLDatabase<typeof schema>;
type Reader = Pick<VenueIssuanceDb, "select">;
const fail = (code: ConstructorParameters<typeof VenueIssuanceError>[0]): never => { throw new VenueIssuanceError(code); };
export function canonicalVenueCodeNotes(manifest: IssuanceManifest, code: IssuanceManifest["codes"][number]): string {
  return JSON.stringify({ sponsor_slug: manifest.sponsorSlug, sponsor_name: manifest.sponsorName,
    source_type: "venue_edition", studio_tier: "wedding", studio_duration_days: 548,
    venue_issuance: { version: 1, issuanceId: manifest.issuanceId, sponsorId: manifest.sponsorId,
      licenseCodeId: code.licenseCodeId, codeFingerprint: code.codeFingerprint } });
}
export async function readManifest(reader: Reader, issuanceId: string): Promise<IssuanceManifest> {
  const [row] = await reader.select().from(meta).where(eq(meta.key, issuanceReceiptKey(issuanceId)));
  if (!row) return fail("not_found");
  try {
    const receipt = JSON.parse(row.value);
    const manifest = parseManifest(receipt.manifest);
    if (Object.keys(receipt).length !== 2 || receipt.manifestHash !== manifestHash(manifest) || manifest.issuanceId !== issuanceId) return fail("conflict");
    return manifest;
  } catch { return fail("conflict"); }
}
export async function readCode(reader: Reader, manifest: IssuanceManifest, expected: IssuanceManifest["codes"][number]) {
  const rows = await reader.select().from(compCodes).where(eq(compCodes.notes, canonicalVenueCodeNotes(manifest, expected)));
  const row = rows[0];
  if (rows.length !== 1 || row.tier !== "wedding" || row.durationDays !== 548 || row.quantity !== 1 ||
      ![0, 1].includes(row.redeemed) || venueCodeFingerprint(row.code) !== expected.codeFingerprint) return fail("conflict");
  return row;
}
export async function readback(reader: Reader, manifest: IssuanceManifest, now: number): Promise<IssuanceReadback> {
  const codes: IssuanceReadback["codes"] = [];
  for (const expected of manifest.codes) {
    const row = await readCode(reader, manifest, expected);
    const grants = await reader.select({ id: entitlements.id }).from(entitlements)
      .where(and(eq(entitlements.source, "comp"), eq(entitlements.notes, "comp:" + row.code)));
    if (grants.length !== row.redeemed) return fail("conflict");
    const [withdrawal] = await reader.select().from(meta).where(eq(meta.key, withdrawalReceiptKey(manifest.issuanceId, expected.licenseCodeId)));
    if (withdrawal) {
      try {
        const receipt = JSON.parse(withdrawal.value);
        if (Object.keys(receipt).length !== 3 || receipt.version !== 1 || receipt.manifestHash !== manifestHash(manifest) ||
            !Number.isSafeInteger(receipt.withdrawnAt) || receipt.withdrawnAt < manifest.issuedAt || receipt.withdrawnAt > now) return fail("conflict");
      } catch { return fail("conflict"); }
    }
    if (withdrawal && (row.redeemed !== 0 || row.expiresAt?.getTime() !== 0)) return fail("conflict");
    // Unexpected external mutations cannot turn into a ready packet.
    if (!withdrawal && row.expiresAt !== null) return fail("conflict");
    codes.push({ ...expected, state: withdrawal ? "withdrawn" : row.redeemed === 1 ? "claimed" : "available" });
  }
  return { version: 1, issuanceId: manifest.issuanceId, manifestHash: manifestHash(manifest), checkedAt: now, codes };
}
export type CanonicalVenueClaim = {
  version: 1; issuanceId: string; licenseCodeId: string; codeFingerprint: string;
  sponsorId: string; environment: IssuanceEnvironment; eligibilityKind: IssuanceManifest["eligibility"]["kind"];
  issuedAt: number; eligibilityStartsAt: number; eligibilityEndsAt: number;
  entitlementId: string; userId: string; workspaceId: string; grantStartsAt: number; grantEndsAt: number;
};
/** Internal provenance seam: no ambient connection and no bearer code returned.
 * Natural expiry retains its interval; epoch-zero revocation never qualifies.
 * The caller still verifies event time, membership, erasure and sponsor policy. */
export async function readCanonicalVenueClaim(reader: Reader, input: { entitlementId: string }): Promise<CanonicalVenueClaim | null> {
  try {
    const [grant] = await reader.select().from(entitlements).where(eq(entitlements.id, input.entitlementId));
    if (!grant || grant.source !== "comp" || grant.tier !== "wedding" || !grant.workspaceId ||
        !grant.notes?.startsWith("comp:") || !grant.expiresAt || grant.expiresAt.getTime() <= grant.startedAt.getTime()) return null;
    const code = grant.notes.slice(5);
    const [row] = await reader.select().from(compCodes).where(eq(compCodes.code, code));
    if (!row?.notes) return null;
    const binding = JSON.parse(row.notes).venue_issuance;
    if (binding?.version !== 1 || typeof binding.issuanceId !== "string") return null;
    const manifest = await readManifest(reader, binding.issuanceId);
    const expected = manifest.codes.find(item => item.licenseCodeId === binding.licenseCodeId);
    if (!expected || grant.startedAt.getTime() + 999 < manifest.issuedAt) return null;
    const canonical = await readCode(reader, manifest, expected);
    if (canonical.code !== code || canonical.redeemed !== 1 || canonical.expiresAt !== null) return null;
    const grants = await reader.select({ id: entitlements.id }).from(entitlements)
      .where(and(eq(entitlements.source, "comp"), eq(entitlements.notes, grant.notes)));
    if (grants.length !== 1 || grants[0].id !== grant.id) return null;
    const [withdrawal] = await reader.select().from(meta).where(eq(meta.key, withdrawalReceiptKey(manifest.issuanceId, expected.licenseCodeId)));
    if (withdrawal) return null;
    return { version: 1, issuanceId: manifest.issuanceId, ...expected, sponsorId: manifest.sponsorId,
      environment: manifest.environment, eligibilityKind: manifest.eligibility.kind, issuedAt: manifest.issuedAt,
      eligibilityStartsAt: manifest.eligibility.startsAt, eligibilityEndsAt: manifest.eligibility.endsAt,
      entitlementId: grant.id, userId: grant.userId, workspaceId: grant.workspaceId,
      grantStartsAt: Math.max(grant.startedAt.getTime(), manifest.issuedAt), grantEndsAt: grant.expiresAt.getTime() };
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof VenueIssuanceError && error.code !== "unavailable")) return null;
    // Absence is permanent rejection; a failed store must remain retryable.
    throw new VenueIssuanceError("unavailable");
  }
}
