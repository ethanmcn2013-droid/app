export type SponsorActivationDTO = Readonly<{
  activationId: string;
  sponsorReference: string | null;
  status: "active" | "revoked" | "expired";
  activationLabel: string | null;
  primaryDate: string | null;
  consentedAt: Date;
  revokedAt: Date | null;
}>;

export function projectSponsorActivation(input: {
  activationId: string;
  sponsorReference: string | null;
  status: "active" | "revoked" | "expired";
  metadata: { activationLabel?: string; primaryDate?: string };
  metadataVersion: number;
  consentReceiptId: string;
  consentedAt: Date;
  revokedAt: Date | null;
}): SponsorActivationDTO {
  const consentIsCurrent =
    input.status === "active" &&
    input.metadataVersion === 1 &&
    input.consentReceiptId.trim().length > 0;
  return {
    activationId: input.activationId,
    sponsorReference: input.sponsorReference,
    status: input.status,
    activationLabel: consentIsCurrent
      ? input.metadata.activationLabel ?? null
      : null,
    primaryDate: consentIsCurrent ? input.metadata.primaryDate ?? null : null,
    consentedAt: input.consentedAt,
    revokedAt: input.revokedAt,
  };
}
