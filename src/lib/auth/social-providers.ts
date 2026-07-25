export const SOCIAL_PROVIDER_DEFINITIONS = [
  { id: "oauth_google", label: "Google" },
  { id: "oauth_github", label: "GitHub" },
  { id: "oauth_apple", label: "Apple" },
] as const;

export type SocialProviderId =
  (typeof SOCIAL_PROVIDER_DEFINITIONS)[number]["id"];

const DEFAULT_ENABLED_PROVIDERS: readonly SocialProviderId[] = [
  "oauth_google",
];

/**
 * Keep account settings aligned with the production Clerk instance.
 * Google is the verified default. When another provider is enabled in Clerk,
 * set NEXT_PUBLIC_CLERK_SOCIAL_PROVIDERS to a comma-separated strategy list
 * in the same production deployment.
 */
export function enabledSocialProviders(
  configured: string | null | undefined =
    process.env.NEXT_PUBLIC_CLERK_SOCIAL_PROVIDERS,
) {
  const requested = configured
    ?.split(",")
    .map((value) => value.trim())
    .filter((value): value is SocialProviderId =>
      SOCIAL_PROVIDER_DEFINITIONS.some((provider) => provider.id === value),
    );
  const enabled =
    requested && requested.length > 0
      ? new Set<SocialProviderId>(requested)
      : new Set<SocialProviderId>(DEFAULT_ENABLED_PROVIDERS);

  return SOCIAL_PROVIDER_DEFINITIONS.filter((provider) =>
    enabled.has(provider.id),
  );
}
