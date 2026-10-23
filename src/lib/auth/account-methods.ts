import { enabledSocialProviders, SOCIAL_PROVIDER_DEFINITIONS } from "./social-providers";

type ExternalAccount = Readonly<{
  provider: string;
  emailAddress?: string | null;
  username?: string | null;
  verification?: { status: string } | null;
}>;

/** Linked identities remain visible when offering new connections is disabled. */
export function accountSocialProviders(accounts: readonly ExternalAccount[], configured?: string | null) {
  const enabled = enabledSocialProviders(configured);
  return SOCIAL_PROVIDER_DEFINITIONS.filter((provider) =>
    enabled.some((item) => item.id === provider.id) ||
    accounts.some((account) => account.provider === provider.id.replace(/^oauth_/, "")),
  ).map((provider) => ({
    ...provider,
    canConnect: enabled.some((item) => item.id === provider.id),
  }));
}

export function connectedSocialMethods(accounts: readonly ExternalAccount[]) {
  return SOCIAL_PROVIDER_DEFINITIONS.flatMap((provider) => {
    const account = accounts.find((item) => item.provider === provider.id.replace(/^oauth_/, ""));
    return account ? [{
      kind: provider.id.replace(/^oauth_/, "") as "google" | "github" | "apple" | "facebook",
      label: provider.label,
      identifier: account.emailAddress ?? account.username ?? null,
      verified: account.verification?.status === "verified",
      connected: true,
    }] : [];
  });
}

export type AccountPhone = Readonly<{ number: string; verified: boolean }>;

/** Identifier verification does not establish that phone sign-in is enabled. */
export function primaryAccountPhone(user: Readonly<{
  primaryPhoneNumberId?: string | null;
  phoneNumbers?: readonly Readonly<{
    id: string;
    phoneNumber: string;
    verification?: { status: string } | null;
  }>[];
}>): AccountPhone | null {
  const phone = user.phoneNumbers?.find((item) => item.id === user.primaryPhoneNumberId);
  return phone ? { number: phone.phoneNumber, verified: phone.verification?.status === "verified" } : null;
}
