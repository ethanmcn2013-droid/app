import { createHash } from "node:crypto";

const PRODUCTION_AUTHORIZED_PARTIES = [
  "https://app.signalstudio.ie",
  "https://tasks.signalstudio.ie",
] as const;

export const RECIPIENT_IDENTITY_PROOF_MARKER =
  "local-clerk-recipient-proof-v1";

export const SPRINT_PREVIEW_AUTH_MARKER = "isolated-clerk-preview-v1";
const SPRINT_PREVIEW_ORIGIN = "https://signal-studio-sprint-ethanmcn2013-1730s-projects.vercel.app";
const SPRINT_PREVIEW_STORE_HASHES = {
  TASKS: "06206364b8984495b3c29fbe66881c36810c401c507fa1e49a51f851b43a01fa",
  NOTES: "9ea2d455aaf65b1ac38f9cef48a8f344951e5af7f3ca1657bb4a5007deef1507",
  TIMELINE: "2fee62edc05e12217fc947cfa0e6cbe2611c8ba751c74c87fab2b873159bf4a0",
  SIGNAL: "6f1044a3d591f073a26af416f784a8a283be765e8e2eb14eedeb4b893702b2d2",
  ENTITLEMENTS: "fd45bd6e9e3528d7ef3c3cb9db131ac67fe4493f20f36045377e41d29de8d927",
} as const;

type PreviewStore = keyof typeof SPRINT_PREVIEW_STORE_HASHES;
type PreviewStoreHashes = Readonly<Record<PreviewStore, string>>;
const PREVIEW_STORES = Object.keys(SPRINT_PREVIEW_STORE_HASHES) as PreviewStore[];

type Environment = Readonly<Record<string, string | undefined>>;

function productionParties(): string[] {
  return [...PRODUCTION_AUTHORIZED_PARTIES];
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Pure test seam: the proxy always supplies the reviewed five-store hashes. */
export function sprintPreviewAuthorizedPartiesForTargets(
  env: Environment,
  approvedHashes: PreviewStoreHashes,
): string[] {
  invariant(env.SIGNAL_SPRINT_PREVIEW_AUTH === SPRINT_PREVIEW_AUTH_MARKER,
    "Sprint preview auth marker is invalid.");
  invariant(env.SIGNAL_RECIPIENT_IDENTITY_PROOF === undefined,
    "Sprint preview auth cannot overlap the local recipient proof.");
  invariant(env.VERCEL === "1" && env.VERCEL_ENV === "preview" && env.NODE_ENV === "production" &&
    env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV === "preview" &&
    env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE === "production" && env.SIGNAL_ACCESS_MODE === "production",
  "Sprint preview auth requires the isolated Vercel preview with the production auth gate.");
  invariant(env.NEXT_PUBLIC_SITE_URL === SPRINT_PREVIEW_ORIGIN &&
    env.NEXT_PUBLIC_APP_URL === SPRINT_PREVIEW_ORIGIN,
  "Sprint preview site and app URLs must match the nominated origin.");
  invariant(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") &&
    env.CLERK_SECRET_KEY?.startsWith("sk_test_"),
  "Sprint preview auth requires a Clerk development key pair.");
  invariant(!env.RESEND_API_KEY,
    "Sprint preview auth forbids outbound Resend mail.");
  invariant(env.SIGNAL_CONVERSATION_DATABASE_MODE === "remote" &&
    env.SIGNAL_CONVERSATION_REMOTE_ENABLED === "true" &&
    env.SIGNAL_CONVERSATION_REMOTE_TARGET === "tasks-preview" &&
    env.SIGNAL_CONVERSATION_REMOTE_URL_SHA256 === approvedHashes.TASKS,
  "Sprint preview auth requires the verified isolated Tasks mode.");
  for (const store of PREVIEW_STORES) {
    const url = env[`${store}_DATABASE_URL`];
    const token = env[`${store}_AUTH_TOKEN`];
    invariant(!!url && !!token?.trim() &&
      createHash("sha256").update(url).digest("hex") === approvedHashes[store],
    `Sprint preview auth requires the verified isolated ${store} store.`);
  }
  return [...productionParties(), SPRINT_PREVIEW_ORIGIN];
}

/**
 * Keep production Clerk's exact authorized-party set. The controlled local
 * recipient proof and isolated deployed sprint proof have independent,
 * fail-closed branches for their single nominated origins.
 */
export function clerkAuthorizedParties(env: Environment): string[] {
  if (env.SIGNAL_SPRINT_PREVIEW_AUTH !== undefined) {
    return sprintPreviewAuthorizedPartiesForTargets(env, SPRINT_PREVIEW_STORE_HASHES);
  }

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
