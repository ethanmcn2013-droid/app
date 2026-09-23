/** Bounded authenticated App attestation. Never contains raw code, actor or Project ids. */
export type UsageClaimProof = {
  version: 1; issuanceId: string; licenseCodeId: string; codeFingerprint: string;
  sponsorId: string; environment: "internal_test" | "production";
  issuedAt: number; grantStartsAt: number; grantEndsAt: number;
  subjectIdHash: string; workspaceIdHash: string; epoch: string;
};
export type UsageEventProof = UsageClaimProof & { eventId: string; eventDigest: string };
export type UsageProofPage = { claims: UsageClaimProof[]; nextCursor: string | null };
export function parseClaimProof(value: unknown): UsageClaimProof | null {
  if(!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as UsageClaimProof;
  if(p.version !== 1 || !/^vi-[a-f0-9]{32}$/.test(p.issuanceId) || !/^vlc-[a-f0-9]{32}$/.test(p.licenseCodeId) ||
    !/^[a-f0-9]{64}$/.test(p.codeFingerprint) || !/^[A-Za-z0-9_-]{1,96}$/.test(p.sponsorId) ||
    !["internal_test","production"].includes(p.environment) ||
    ![p.issuedAt,p.grantStartsAt,p.grantEndsAt].every(x => Number.isSafeInteger(x) && x > 0) ||
    p.grantStartsAt < p.issuedAt || p.grantEndsAt <= p.grantStartsAt ||
    !/^[a-f0-9]{32}$/.test(p.subjectIdHash) || !/^[a-f0-9]{32}$/.test(p.workspaceIdHash) || !/^[a-f0-9]{8}$/.test(p.epoch)) return null;
  // Explicit projection drops all unknown fields at the response boundary.
  return { version:1, issuanceId:p.issuanceId,licenseCodeId:p.licenseCodeId,codeFingerprint:p.codeFingerprint,
    sponsorId:p.sponsorId,environment:p.environment,issuedAt:p.issuedAt,grantStartsAt:p.grantStartsAt,grantEndsAt:p.grantEndsAt,
    subjectIdHash:p.subjectIdHash,workspaceIdHash:p.workspaceIdHash,epoch:p.epoch };
}
