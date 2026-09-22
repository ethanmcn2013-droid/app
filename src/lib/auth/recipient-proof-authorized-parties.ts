const PRODUCTION_AUTHORIZED_PARTIES = [
  "https://app.signalstudio.ie",
  "https://tasks.signalstudio.ie",
] as const;

export const RECIPIENT_IDENTITY_PROOF_MARKER =
  "local-clerk-recipient-proof-v1";

type Environment = Readonly<Record<string, string | undefined>>;

function productionParties(): string[] {
  return [...PRODUCTION_AUTHORIZED_PARTIES];
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Keep production Clerk's exact authorized-party set while allowing the
 * controlled recipient proof to mint a localhost-bound session. The proof
 * origin is accepted only from the runner's explicit child environment.
 */
export function clerkAuthorizedParties(env: Environment): string[] {
  const marked =
    env.SIGNAL_RECIPIENT_IDENTITY_PROOF ===
    RECIPIENT_IDENTITY_PROOF_MARKER;
  if (!marked || env.VERCEL) return productionParties();

  invariant(
    env.VERCEL_ENV === "development",
    "Recipient identity proof requires the development deployment class.",
  );
  invariant(
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_"),
    "Recipient identity proof requires a Clerk development publishable key.",
  );

  const portText = env.SIGNAL_RECIPIENT_PORT?.trim() ?? "";
  const port = Number(portText);
  invariant(
    Number.isInteger(port) &&
      port >= 1024 &&
      port <= 65535 &&
      String(port) === portText,
    "Recipient identity proof port is invalid.",
  );

  const expectedOrigin = `http://localhost:${port}`;
  const suppliedOrigin = env.SIGNAL_RECIPIENT_PROOF_ORIGIN ?? "";
  let parsed: URL;
  try {
    parsed = new URL(suppliedOrigin);
  } catch {
    throw new Error("Recipient identity proof origin is invalid.");
  }
  invariant(
    suppliedOrigin === expectedOrigin &&
      parsed.protocol === "http:" &&
      parsed.hostname === "localhost" &&
      parsed.port === portText &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === "/" &&
      !parsed.search &&
      !parsed.hash,
    "Recipient identity proof origin must be the canonical localhost root for its declared port.",
  );
  invariant(
    env.NEXT_PUBLIC_SITE_URL === expectedOrigin,
    "Recipient identity proof site URL must match its canonical origin.",
  );

  return [...productionParties(), expectedOrigin];
}
