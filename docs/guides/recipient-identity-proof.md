# Controlled recipient identity proof

This target prepares one narrow creator-to-recipient journey on a local loopback build. The real-session run remains unrun and unaccepted until the controlled Clerk development target and both account labels are supplied and reviewed.

## Boundary

The target uses one dedicated Clerk development instance, two distinct verified `+clerk_test` accounts, and fresh local files for Tasks, Notes, Timeline, Signal, and entitlements. Mail, Drive, Google, Stripe, Blob, deployed targets, customer identities, remote databases, and production settings are outside this run.

Keep configuration in the ignored `.env.recipient-identity.local` file. Never commit or publish that file, Clerk keys, account labels, browser state, invite tokens, databases, traces, or screenshots.

Required configuration names are:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
SIGNAL_RECIPIENT_CLERK_INSTANCE
SIGNAL_RECIPIENT_CLERK_SECRET_INSTANCE
SIGNAL_RECIPIENT_CREATOR_EMAIL
SIGNAL_RECIPIENT_RECIPIENT_EMAIL
SIGNAL_RECIPIENT_ACCOUNTS_VERIFIED=confirmed
SIGNAL_RECIPIENT_GIT_DEPLOYMENTS_DISABLED=confirmed
```

The secret-instance setting is a reviewed operator assertion used to reject an obvious mixed target before any request. Offline preflight cannot derive a Clerk instance from a secret key. `clerkSetup` proves only that Clerk issued a testing token for the secret key. Usable pairing is established later when the configured frontend consumes a backend-issued ticket and returns the expected verified user.

## Commands

Run the local refusal tests at any time:

```powershell
corepack pnpm test:recipient-identity:guard
```

After the target and both accounts are confirmed, run configuration-only preflight:

```powershell
corepack pnpm test:recipient-identity:preflight
```

Preflight parses local configuration and the repository's `vercel.json`. It requires `git.deploymentEnabled` to be `false`, but it does not contact Clerk, verify an account, create a session, create a database, or exercise the product.

Only after preflight and review may the bounded real-session run be started:

```powershell
corepack pnpm test:recipient-identity
```

The runner also requires the exact recipient-proof branch, both pinned source ancestors, a clean source tree, and a free loopback port. It builds the app, creates isolated file databases, and passes the child process an explicit small environment instead of the caller's general provider or repository credentials.

The production-mode boot contract requires a Tasks database auth-token value. For this local file target, the runner creates a fixed public sentinel inside the child environment; libSQL does not use it to authenticate the file database. Preflight still refuses every caller-supplied database auth token, and no remote database URL is allowed.

The child also fixes one canonical `http://localhost:<port>` origin. This keeps Clerk's absolute continuation rewrite internal to Next and adds that origin to Clerk's two production authorized parties only for the marked, non-Vercel development proof. Malformed proof origins fail before the app starts; ordinary and Vercel runtimes retain the exact production list.

## What the journey proves

The test uses Clerk's supported Playwright ticket helper to establish real development-instance sessions for the two controlled accounts. Ticket sign-in bypasses credential entry, verification, and MFA. The test therefore checks the signed-out invitation and its exact sign-in redirect intent, but does not claim that sign-in form interaction was exercised.

The journey checks a wrong-account refusal, the exact signed-out redirect intent and automatic return, recipient acceptance into the exact project, absence of a creator-private task, completion of one assigned task, return to Home, creator browser readback of the durable done state, replay refusal, and access refusal after membership removal. Synthetic identity tests and an issued Clerk testing token do not count as journey acceptance.

The project, pending invitation, assigned task, and membership removal are created or changed directly in the isolated local database fixture. If authenticated entry has already provisioned either controlled identity in that database, the fixture reuses the matching Clerk subject only when its stored email is absent or matches the verified account. This proof does not exercise creator invitation-authoring UI or live membership-removal UI.

## Evidence custody

At start, the runner invalidates stale recipient-proof output. During the run it records only stage booleans. In `finally` it removes the local databases, browser output, and any auth-state directory on success or failure. The ignored `experience/output/recipient-identity/receipt.json` records the exact source commit and tree, the committed `vercel.json` blob, intended provider boundary, and actually observed stages. It contains no account labels, tokens, invite link, browser state, database rows, trace, screenshot, or secret.

The sanitized local receipt still needs review and transfer into the approved private evidence location. It is not release acceptance and does not authorize a deployment.
