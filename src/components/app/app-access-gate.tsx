import { requireAppAccess } from "@/server/require-app-access";

/**
 * Async server gate for the authed app. Awaits the closed-beta allowlist check
 * (production only) and only then renders the app content, so a non-allowlisted
 * account is redirected to /waitlist before any protected screen paints.
 *
 * Wrap the app children under a Suspense boundary so the wordmark loader paints
 * while the check resolves:
 *
 *   <Suspense fallback={<AppLoading />}>
 *     <AppAccessGate>{children}</AppAccessGate>
 *   </Suspense>
 *
 * Copied byte-identical across the four product repos.
 */
export async function AppAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppAccess();
  return <>{children}</>;
}
