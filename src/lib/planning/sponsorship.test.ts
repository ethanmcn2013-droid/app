import { test } from "node:test";
import assert from "node:assert/strict";
import { projectSponsorActivation } from "./sponsorship";

const base = {
  activationId: "activation-1",
  sponsorReference: "venue-reference-42",
  metadata: { activationLabel: "A & B", primaryDate: "2027-06-12" },
  metadataVersion: 1,
  consentReceiptId: "consent-1",
  consentedAt: new Date("2026-07-12T12:00:00Z"),
  revokedAt: null,
} as const;

test("active current consent projects only explicitly consented activation fields", () => {
  const dto = projectSponsorActivation({ ...base, status: "active" });
  assert.equal(dto.activationLabel, "A & B");
  assert.equal(dto.primaryDate, "2027-06-12");
  assert.equal("workspaceId" in dto, false);
});

test("revocation and expiry immediately remove every optional metadata field", () => {
  for (const status of ["revoked", "expired"] as const) {
    const dto = projectSponsorActivation({
      ...base,
      status,
      revokedAt: new Date("2026-08-01T00:00:00Z"),
    });
    assert.equal(dto.activationLabel, null);
    assert.equal(dto.primaryDate, null);
    assert.equal("workspaceId" in dto, false);
  }
});

test("unknown consent versions and empty receipts fail closed", () => {
  assert.equal(
    projectSponsorActivation({ ...base, status: "active", metadataVersion: 2 }).activationLabel,
    null,
  );
  assert.equal(
    projectSponsorActivation({ ...base, status: "active", consentReceiptId: "" }).primaryDate,
    null,
  );
});
