# Isolated sprint preview authentication boundary

The controlled sprint preview uses the single nominated origin
`https://signal-studio-sprint-ethanmcn2013-1730s-projects.vercel.app`.
It is a real Clerk development-session target, separate from the local
recipient proof. The marked proxy appends that exact origin to Clerk's two
production authorized parties only when every guard below passes. The
unmarked production authorized-party list remains unchanged.

Set these on the nominated Vercel preview branch, not on production:

| Variable | Required value or condition |
| --- | --- |
| `SIGNAL_SPRINT_PREVIEW_AUTH` | `isolated-clerk-preview-v1` |
| `VERCEL`, `VERCEL_ENV`, `NODE_ENV` | `1`, `preview`, `production` (Vercel supplied) |
| `NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV` | `preview` (Next build injection) |
| `NEXT_PUBLIC_SIGNAL_ACCESS_MODE`, `SIGNAL_ACCESS_MODE` | Both `production`, so client and server keep the real Clerk gate |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` | Exact nominated origin above, without trailing slash |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Matching Clerk development-instance keys (`pk_test_`, `sk_test_`); operator verifies the actual pair |
| `TASKS_DATABASE_URL`/`TASKS_AUTH_TOKEN`, `NOTES_DATABASE_URL`/`NOTES_AUTH_TOKEN`, `TIMELINE_DATABASE_URL`/`TIMELINE_AUTH_TOKEN`, `SIGNAL_DATABASE_URL`/`SIGNAL_AUTH_TOKEN`, `ENTITLEMENTS_DATABASE_URL`/`ENTITLEMENTS_AUTH_TOKEN` | Five isolated preview stores with nonempty tokens; each URL must match the reviewed SHA-256 fingerprint pinned in the proxy helper |
| `SIGNAL_CONVERSATION_DATABASE_MODE`, `SIGNAL_CONVERSATION_REMOTE_ENABLED`, `SIGNAL_CONVERSATION_REMOTE_TARGET`, `SIGNAL_CONVERSATION_REMOTE_URL_SHA256` | `remote`, `true`, `tasks-preview`, and the pinned Tasks preview URL fingerprint |
| `RESEND_API_KEY` | Absent or empty; no outbound invite mail during this proof |

The operator must verify branch scoping, every provider binding and the
five-store target receipt before running the deployed journey. A wrong marker,
production deployment class, auth mode, origin, Clerk key class, mail key or
store binding fails closed before Clerk middleware accepts a session. The
Tasks conversation runtime has its own independent remote target guard and
actor allowlist; set `SIGNAL_CONVERSATION_INTERNAL_ENABLED` and
`SIGNAL_CONVERSATION_SEND_ENABLED` only for approved internal actors after
schema rehearsal. Leave `SIGNAL_CONVERSATION_DM_ENABLED` unset: DMs have a
separate unresolved retention decision.

For later public-page testing, separately scope `NEXT_PUBLIC_TASKS_PUBLIC_URL`
and `NEXT_PUBLIC_TIMELINE_SITE_URL` to the nominated host so generated links
remain inside the isolated target. `NEXT_PUBLIC_STUDIO_URL` controls marketing
links and does not authorize app data. Outbound invite delivery is disabled;
the existing no-key email helper returns a development skip receipt, not proof
of delivery. Do not mark the creator invite UI or recipient-email journey
accepted from this deployment until an approved sink and honest UI status are
verified. Preview authorization alone does not accept migrations, remote
transaction behavior, account lifecycle, or release.
