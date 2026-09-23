import { and, eq } from "drizzle-orm";
import { compCodes, entitlements, meta } from "@/server/db/schema";
import {
  issuanceReceiptKey, manifestHash, parseIssuanceCommand, withdrawalReceiptKey, VenueIssuanceError,
  type IssuanceCommand, type IssuanceEnvironment, type IssuanceManifest, type IssuanceReadback,
} from "@/lib/venue-issuance/protocol";
import { canonicalVenueCodeNotes, readCode, readManifest, readback, type VenueIssuanceDb } from "./canonical";
export type { VenueIssuanceDb } from "./canonical";
const fail = (code: ConstructorParameters<typeof VenueIssuanceError>[0]): never => { throw new VenueIssuanceError(code); };

/** Capacity creation only. The existing comp claim remains the only grant writer.
 * A batch and its immutable manifest commit in one immediate transaction. */
export async function executeVenueIssuance(database: VenueIssuanceDb, raw: IssuanceCommand, environment: IssuanceEnvironment, now = Date.now()): Promise<IssuanceReadback> {
  const command = parseIssuanceCommand(raw);
  return retryBusy(() => database.transaction(async tx => {
    let manifest: IssuanceManifest;
    if (command.operation === "issue") {
      manifest = command.manifest;
      if (manifest.environment !== environment || manifest.issuedAt > now) return fail("invalid");
      const key = issuanceReceiptKey(manifest.issuanceId);
      const [existing] = await tx.select().from(meta).where(eq(meta.key, key));
      if (existing) {
        const prior = await readManifest(tx, manifest.issuanceId);
        if (manifestHash(prior) !== manifestHash(manifest)) return fail("conflict");
      } else {
        for (let i = 0; i < command.codes.length; i++) {
          const code = command.codes[i];
          const [collision] = await tx.select({ code: compCodes.code }).from(compCodes).where(eq(compCodes.code, code.code));
          if (collision) return fail("conflict"); // Never adopt a historical code by hashing it.
          await tx.insert(compCodes).values({ code: code.code, tier: "wedding", durationDays: 548,
            quantity: 1, redeemed: 0, notes: canonicalVenueCodeNotes(manifest, manifest.codes[i]), expiresAt: null });
        }
        await tx.insert(meta).values({ key, value: JSON.stringify({ manifest, manifestHash: manifestHash(manifest) }) });
      }
    } else {
      manifest = await readManifest(tx, command.issuanceId);
      if (manifest.environment !== environment || manifestHash(manifest) !== command.manifestHash) return fail("conflict");
      if (command.operation === "withdraw") {
        const expected = manifest.codes.find(code => code.licenseCodeId === command.licenseCodeId);
        if (!expected) return fail("not_found");
        const row = await readCode(tx, manifest, expected);
        const grants = await tx.select({ id: entitlements.id }).from(entitlements)
          .where(and(eq(entitlements.source, "comp"), eq(entitlements.notes, "comp:" + row.code)));
        if (row.redeemed !== 0 || grants.length) return fail("already_claimed");
        const key = withdrawalReceiptKey(manifest.issuanceId, expected.licenseCodeId);
        const [prior] = await tx.select().from(meta).where(eq(meta.key, key));
        if (!prior) {
          if (row.expiresAt !== null) return fail("conflict");
          const changed = await tx.update(compCodes).set({ expiresAt: new Date(0) })
            .where(and(eq(compCodes.code, row.code), eq(compCodes.redeemed, 0))).returning({ code: compCodes.code });
          if (changed.length !== 1) return fail("already_claimed");
          await tx.insert(meta).values({ key, value: JSON.stringify({ version: 1, manifestHash: command.manifestHash, withdrawnAt: now }) });
        }
      }
    }
    return readback(tx, manifest, now);
  }, { behavior: "immediate" }));
}
async function retryBusy<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); } catch (error) {
      const e = error as { code?: string; cause?: { code?: string } };
      if (attempt >= 5 || (e.code !== "SQLITE_BUSY" && e.cause?.code !== "SQLITE_BUSY")) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}
