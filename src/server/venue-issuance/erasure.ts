import { and, eq, type SQL } from "drizzle-orm";
import { compCodes, entitlements, meta } from "@/server/db/schema";
import { VenueIssuanceError, withdrawalReceiptKey } from "@/lib/venue-issuance/protocol";
import {
  erasedConsumptionKey, erasedConsumptionReceipt, readCode, readErasedConsumption,
  readManifest, type VenueIssuanceDb,
} from "./canonical";

type Transaction = Pick<VenueIssuanceDb, "select" | "insert" | "delete">;

/** Must run inside the caller's writer transaction. Preserve only canonical
 * consumed capacity while removing the exact grants; never reconstruct a
 * receipt for a previously missing grant or adopt historical weak codes. */
export async function eraseEntitlementsInTransaction(transaction: Transaction, scope: SQL): Promise<void> {
  // isolation-ok: caller supplies the exact userId or workspaceId predicate
  // from account-erasure.ts or projects/project-deletion-rows.ts inside its
  // authorized writer transaction. The identical predicate governs deletion.
  const deleting = await transaction.select().from(entitlements).where(scope);
  for (const grant of deleting) {
    if (grant.source !== "comp" || !grant.notes?.startsWith("comp:")) continue;
    const [row] = await transaction.select().from(compCodes).where(eq(compCodes.code, grant.notes.slice(5)));
    if (!row?.notes) continue;
    let binding: { issuanceId?: string; licenseCodeId?: string } | undefined;
    try { binding = JSON.parse(row.notes).venue_issuance; } catch { continue; }
    if (!binding) continue; // Legacy codes have no canonical issuance authority.
    if (typeof binding.issuanceId !== "string" || typeof binding.licenseCodeId !== "string") throw new VenueIssuanceError("conflict");
    const manifest = await readManifest(transaction, binding.issuanceId);
    const expected = manifest.codes.find(code => code.licenseCodeId === binding.licenseCodeId);
    if (!expected) throw new VenueIssuanceError("conflict");
    const canonical = await readCode(transaction, manifest, expected);
    // isolation-ok: global uniqueness of this exact one-use code is required
    // before recording erased consumption. Cross-tenant duplicate grants must
    // block erasure, never be hidden by the caller's deletion predicate.
    const claims = await transaction.select({ id: entitlements.id }).from(entitlements)
      .where(and(eq(entitlements.source, "comp"), eq(entitlements.notes, grant.notes)));
    const [withdrawal] = await transaction.select().from(meta)
      .where(eq(meta.key, withdrawalReceiptKey(manifest.issuanceId, expected.licenseCodeId)));
    if (canonical.code !== row.code || canonical.redeemed !== 1 || canonical.expiresAt !== null ||
        grant.tier !== "wedding" || claims.length !== 1 || claims[0].id !== grant.id || withdrawal ||
        await readErasedConsumption(transaction, manifest, expected)) throw new VenueIssuanceError("conflict");
    await transaction.insert(meta).values({
      key: erasedConsumptionKey(manifest.issuanceId, expected.licenseCodeId),
      value: JSON.stringify(erasedConsumptionReceipt(manifest, expected)),
    });
  }
  await transaction.delete(entitlements).where(scope);
}
