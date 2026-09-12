import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isDevelopmentFromPublishableKey,
  isDevelopmentFromSecretKey,
  parsePublishableKey,
} from "@clerk/shared/keys";

const REQUIRED = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "SIGNAL_RECIPIENT_CLERK_INSTANCE",
  "SIGNAL_RECIPIENT_CLERK_SECRET_INSTANCE",
  "SIGNAL_RECIPIENT_CREATOR_EMAIL",
  "SIGNAL_RECIPIENT_RECIPIENT_EMAIL",
  "SIGNAL_RECIPIENT_ACCOUNTS_VERIFIED",
  "SIGNAL_RECIPIENT_GIT_DEPLOYMENTS_DISABLED",
];

const DATABASE_URLS = [
  "TASKS_DATABASE_URL",
  "NOTES_DATABASE_URL",
  "TIMELINE_DATABASE_URL",
  "SIGNAL_DATABASE_URL",
  "ENTITLEMENTS_DATABASE_URL",
];

const REMOTE_DATABASE_SCHEMES = /^(?:https?|libsql|wss?):\/\//i;
const TEST_EMAIL = /^[^@\s]+\+clerk_test@[^@\s]+\.[^@\s]+$/i;
const LOCAL_ENV_FILES = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
];

const FORBIDDEN_PROVIDER_KEYS = [
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "CLERK_API_URL",
  "CLERK_TESTING_TOKEN",
];

const DATABASE_AUTH_KEYS = [
  "TASKS_AUTH_TOKEN",
  "NOTES_AUTH_TOKEN",
  "TIMELINE_AUTH_TOKEN",
  "SIGNAL_AUTH_TOKEN",
  "ENTITLEMENTS_AUTH_TOKEN",
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function unquote(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

export function readDedicatedEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const result = {};
  for (const [index, raw] of readFileSync(filePath, "utf8").split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    invariant(match, `Invalid environment line ${index + 1}.`);
    invariant(!(match[1] in result), `Duplicate environment key ${match[1]}.`);
    result[match[1]] = unquote(match[2].trim());
  }
  return result;
}

export function mergeDedicatedEnv(base, dedicated) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(dedicated)) {
    if (merged[key] && merged[key] !== value) {
      throw new Error(`Mixed environment values for ${key}.`);
    }
    merged[key] = value;
  }
  return merged;
}

export function validateRecipientIdentityEnv(env, options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const hasPath = options.exists ?? existsSync;

  const missing = REQUIRED.filter((key) => !env[key]?.trim());
  invariant(missing.length === 0, `Missing recipient identity settings: ${missing.join(", ")}.`);

  invariant(
    env.SIGNAL_RECIPIENT_ACCOUNTS_VERIFIED === "confirmed",
    "The two controlled accounts must be recorded as verified before any Clerk request.",
  );
  invariant(
    env.SIGNAL_RECIPIENT_GIT_DEPLOYMENTS_DISABLED === "confirmed",
    "Git deployments for this branch must be confirmed disabled before any Clerk request.",
  );

  invariant(
    isDevelopmentFromPublishableKey(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    "The Clerk publishable key must belong to a development instance.",
  );
  invariant(
    isDevelopmentFromSecretKey(env.CLERK_SECRET_KEY),
    "The Clerk secret key must belong to a development instance.",
  );
  const parsed = parsePublishableKey(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  invariant(parsed?.instanceType === "development", "The Clerk publishable key is not a development key.");
  invariant(
    parsed.frontendApi === env.SIGNAL_RECIPIENT_CLERK_INSTANCE,
    "The declared Clerk instance does not match the publishable key.",
  );
  invariant(
    env.SIGNAL_RECIPIENT_CLERK_SECRET_INSTANCE === env.SIGNAL_RECIPIENT_CLERK_INSTANCE,
    "The secret-key instance label does not match the publishable-key instance.",
  );

  const creatorEmail = env.SIGNAL_RECIPIENT_CREATOR_EMAIL.trim().toLowerCase();
  const recipientEmail = env.SIGNAL_RECIPIENT_RECIPIENT_EMAIL.trim().toLowerCase();
  invariant(TEST_EMAIL.test(creatorEmail), "Creator must use a +clerk_test address in the development instance.");
  invariant(TEST_EMAIL.test(recipientEmail), "Recipient must use a +clerk_test address in the development instance.");
  invariant(creatorEmail !== recipientEmail, "Creator and recipient must be different controlled accounts.");

  for (const key of DATABASE_URLS) {
    const value = env[key]?.trim();
    invariant(!value || !REMOTE_DATABASE_SCHEMES.test(value), `${key} must not point to a remote database.`);
  }
  for (const key of DATABASE_AUTH_KEYS) {
    invariant(!env[key]?.trim(), `${key} must be unset for the isolated local run.`);
  }
  for (const key of FORBIDDEN_PROVIDER_KEYS) {
    invariant(!env[key]?.trim(), `${key} must be unset for this provider-bounded run.`);
  }

  invariant(env.VERCEL !== "1", "A Vercel runtime is not an allowed recipient proof target.");
  invariant(env.VERCEL_ENV !== "production", "Production Vercel settings are not allowed.");
  invariant(env.NODE_ENV !== "production", "Run the harness from a normal local shell, not a production shell.");
  if (env.NEXT_PUBLIC_SITE_URL) {
    const site = new URL(env.NEXT_PUBLIC_SITE_URL);
    invariant(
      site.protocol === "http:" && ["127.0.0.1", "localhost"].includes(site.hostname),
      "NEXT_PUBLIC_SITE_URL must be loopback HTTP when supplied.",
    );
  }
  if (env.SIGNAL_ACCESS_MODE) {
    invariant(env.SIGNAL_ACCESS_MODE === "production", "The journey must exercise the production access gate.");
  }

  const conflictingFiles = LOCAL_ENV_FILES.filter((name) => hasPath(path.join(cwd, name)));
  invariant(
    conflictingFiles.length === 0,
    `Remove mixed Next environment files from this dedicated worktree: ${conflictingFiles.join(", ")}.`,
  );

  const port = Number(env.SIGNAL_RECIPIENT_PORT ?? "4389");
  invariant(Number.isInteger(port) && port >= 1024 && port <= 65535, "SIGNAL_RECIPIENT_PORT is invalid.");

  return Object.freeze({
    creatorEmail,
    recipientEmail,
    clerkInstance: parsed.frontendApi,
    port,
    baseURL: `http://127.0.0.1:${port}`,
  });
}

export function validateDeploymentConfig(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const read = options.readFile ?? ((filePath) => readFileSync(filePath, "utf8"));
  let config;
  try {
    config = JSON.parse(read(path.join(cwd, "vercel.json")));
  } catch {
    throw new Error("vercel.json must be present and valid before any Clerk request.");
  }
  invariant(
    config?.git?.deploymentEnabled === false,
    "vercel.json must set git.deploymentEnabled to false before any Clerk request.",
  );
}

export function configurationReport(config) {
  return {
    ok: true,
    scope: "configuration only; provider not contacted",
    target: "declared local Clerk development-instance target",
    accountLabels: "two declared labels; accounts and sessions unverified",
    secretKeyInstance: "operator assertion only; usable pairing is observed later through ticket consumption and verified-user readback",
    port: config.port,
    nonClerkProviders: "excluded from the later child process",
    databases: "not created or inspected; the runner creates fresh local files after this preflight",
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const envPath = path.resolve(process.argv[2] ?? ".env.recipient-identity.local");
    const env = mergeDedicatedEnv(process.env, readDedicatedEnv(envPath));
    const config = validateRecipientIdentityEnv(env);
    validateDeploymentConfig();
    console.log(JSON.stringify(configurationReport(config), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
