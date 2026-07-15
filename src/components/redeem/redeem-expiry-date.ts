const REDEEM_EXPIRY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Europe/London",
});

export function formatRedeemExpiryDate(expiresAt: string): string {
  return REDEEM_EXPIRY_FORMATTER.format(new Date(expiresAt));
}
