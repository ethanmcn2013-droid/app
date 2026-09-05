import { createHash } from "node:crypto";

/** Paired with Studio src/lib/venue-fulfilment/protocol.ts. No bearer codes in
 * manifests, readbacks or usage provenance. Only the issue envelope carries them. */
export const VENUE_ISSUANCE_PATH = "/api/internal/venue-issuance";
export const MAX_VENUE_CODES = 25;
export const MAX_ISSUANCE_BODY_BYTES = 24_576;
export type IssuanceEnvironment = "internal_test" | "production";
export type IssuanceManifest = {
  version: 1;
  issuanceId: string;
  sponsorId: string;
  sponsorSlug: string;
  sponsorName: string;
  environment: IssuanceEnvironment;
  issuedAt: number;
  eligibility: { kind: "standard" | "founding" | "pilot"; reference: string; startsAt: number; endsAt: number };
  tier: "wedding";
  durationDays: 548;
  codes: Array<{ licenseCodeId: string; codeFingerprint: string }>;
};
export type IssuanceCommand =
  | { operation: "issue"; manifest: IssuanceManifest; codes: Array<{ licenseCodeId: string; code: string }> }
  | { operation: "read"; issuanceId: string; manifestHash: string }
  | { operation: "withdraw"; issuanceId: string; manifestHash: string; licenseCodeId: string };
export type CodeReadback = { licenseCodeId: string; codeFingerprint: string; state: "available" | "claimed" | "withdrawn" };
export type IssuanceReadback = { version: 1; issuanceId: string; manifestHash: string; checkedAt: number; codes: CodeReadback[] };
export class VenueIssuanceError extends Error {
  constructor(public readonly code: "invalid" | "conflict" | "not_found" | "already_claimed" | "unavailable") { super(code); }
}
export const issuanceReceiptKey = (id: string) => "venue-issuance:v1:" + id;
export const withdrawalReceiptKey = (id: string, codeId: string) => "venue-withdrawal:v1:" + id + ":" + codeId;
export const venueCodeFingerprint = (code: string) => createHash("sha256").update("venue-code:v1:" + code).digest("hex");
export const manifestHash = (manifest: IssuanceManifest) => createHash("sha256").update(JSON.stringify(parseManifest(manifest))).digest("hex");

const invalid = (): never => { throw new VenueIssuanceError("invalid"); };
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.hasOwn(row, key))) return invalid();
  return row;
}
function string(value: unknown, pattern: RegExp, max = 160): string {
  if (typeof value !== "string" || value.length > max || !pattern.test(value)) return invalid();
  return value;
}
function timestamp(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > 8_000_000_000_000_000) return invalid();
  return value as number;
}
const id = (value: unknown) => string(value, /^vi-[a-f0-9]{32}$/);
const codeId = (value: unknown) => string(value, /^vlc-[a-f0-9]{32}$/);
const hash = (value: unknown) => string(value, /^[a-f0-9]{64}$/);
export function parseManifest(value: unknown): IssuanceManifest {
  const row = object(value, ["version", "issuanceId", "sponsorId", "sponsorSlug", "sponsorName", "environment", "issuedAt", "eligibility", "tier", "durationDays", "codes"]);
  if (row.version !== 1 || row.tier !== "wedding" || row.durationDays !== 548 ||
      (row.environment !== "internal_test" && row.environment !== "production")) return invalid();
  const eligibility = object(row.eligibility, ["kind", "reference", "startsAt", "endsAt"]);
  if (!["standard", "founding", "pilot"].includes(eligibility.kind as string)) return invalid();
  const issuedAt = timestamp(row.issuedAt), startsAt = timestamp(eligibility.startsAt), endsAt = timestamp(eligibility.endsAt);
  if (startsAt > issuedAt || issuedAt >= endsAt) return invalid();
  if (!Array.isArray(row.codes) || row.codes.length < 1 || row.codes.length > MAX_VENUE_CODES) return invalid();
  const codes = row.codes.map(value => {
    const code = object(value, ["licenseCodeId", "codeFingerprint"]);
    return { licenseCodeId: codeId(code.licenseCodeId), codeFingerprint: hash(code.codeFingerprint) };
  });
  if (new Set(codes.map(code => code.licenseCodeId)).size !== codes.length ||
      new Set(codes.map(code => code.codeFingerprint)).size !== codes.length) return invalid();
  return {
    version: 1, issuanceId: id(row.issuanceId),
    sponsorId: string(row.sponsorId, /^[A-Za-z0-9_-]{1,96}$/),
    sponsorSlug: string(row.sponsorSlug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 48),
    sponsorName: string(row.sponsorName, /^[^\u0000-\u001f\u007f]{1,160}$/),
    environment: row.environment, issuedAt,
    eligibility: { kind: eligibility.kind as IssuanceManifest["eligibility"]["kind"],
      reference: string(eligibility.reference, /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/), startsAt, endsAt },
    tier: "wedding", durationDays: 548, codes,
  };
}
export function parseIssuanceCommand(value: unknown): IssuanceCommand {
  const operation = (value as { operation?: unknown } | null)?.operation;
  if (operation === "issue") {
    const row = object(value, ["operation", "manifest", "codes"]);
    const manifest = parseManifest(row.manifest);
    if (!Array.isArray(row.codes) || row.codes.length !== manifest.codes.length) return invalid();
    const codes = row.codes.map((value, index) => {
      const row = object(value, ["licenseCodeId", "code"]);
      const licenseCodeId = codeId(row.licenseCodeId);
      const code = string(row.code, /^VENUE-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
      if (licenseCodeId !== manifest.codes[index].licenseCodeId || venueCodeFingerprint(code) !== manifest.codes[index].codeFingerprint) return invalid();
      return { licenseCodeId, code };
    });
    return { operation, manifest, codes };
  }
  if (operation === "read" || operation === "withdraw") {
    const row = object(value, operation === "read" ? ["operation", "issuanceId", "manifestHash"] : ["operation", "issuanceId", "manifestHash", "licenseCodeId"]);
    const base = { issuanceId: id(row.issuanceId), manifestHash: hash(row.manifestHash) };
    return operation === "read" ? { operation, ...base } : { operation, ...base, licenseCodeId: codeId(row.licenseCodeId) };
  }
  return invalid();
}
export function parseReadback(value: unknown, manifest: IssuanceManifest): IssuanceReadback {
  const row = object(value, ["version", "issuanceId", "manifestHash", "checkedAt", "codes"]);
  if (row.version !== 1 || row.issuanceId !== manifest.issuanceId || row.manifestHash !== manifestHash(manifest) ||
      !Array.isArray(row.codes) || row.codes.length !== manifest.codes.length) return invalid();
  const codes = row.codes.map((value, index): CodeReadback => {
    const code = object(value, ["licenseCodeId", "codeFingerprint", "state"]);
    const expected = manifest.codes[index];
    if (code.licenseCodeId !== expected.licenseCodeId || code.codeFingerprint !== expected.codeFingerprint ||
        !["available", "claimed", "withdrawn"].includes(code.state as string)) return invalid();
    return { ...expected, state: code.state as CodeReadback["state"] };
  });
  return { version: 1, issuanceId: manifest.issuanceId, manifestHash: row.manifestHash as string, checkedAt: timestamp(row.checkedAt), codes };
}
