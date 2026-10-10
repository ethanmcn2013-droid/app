# Redis rate protection

The App uses Redis for short-lived attempt counters, not as its primary user-data database. AI/extraction checks are best effort; access-code redemption and configured Timeline checks fail closed. A Redis outage does not remove authentication, ownership or entitlement checks.

## Configuration

Use one complete pair of server-only variables:

- Direct Upstash: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Vercel Marketplace: `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

Blank legacy variables do not suppress the Marketplace pair. A partially populated direct pair is rejected rather than mixed with Marketplace credentials. The endpoint must be an HTTPS origin. Do not use the read-only token: counters require writes. `KV_URL` and `REDIS_URL` are not used by this REST client. Do not copy secrets into reports.

Each fixed-window check makes one `/multi-exec` request containing INCR and EXPIRE NX. Both command results must be valid. Redis transactions prevent interleaving but do not roll back individual command errors. The total deadline, including JSON-body reading, is 1.5 seconds. No retry or redirect is allowed. Existing key namespaces and expiry durations are preserved; this is not a sliding-window limiter.

Redemption denies before looking up a code or modifying access if protection cannot be checked. Its unavailable response is distinct from quota exhaustion. Timeline also returns `unavailable` for network/HTTP/response failures instead of attributing them to the caller. Existing public-link policy is retained: an entirely unconfigured optional limiter does not disable the high-entropy link; partial/configured failure still denies. AI/extraction retains its existing best-effort availability policy, with throttled, scrubbed operational warnings. No caller identifiers, tokens or provider error bodies are logged. Unconfigured development Timeline limits remain process-local and cannot prove production enforcement.

## Verify before release

1. Run `pnpm test:redis`, the invitation-code and redemption-copy tests, typecheck, changed-file lint and affected security/logging contracts. These use isolated mocks; they generate no live Redis traffic.
2. Integrate through the active release owner. Run the full normal CI and build gates on the composed candidate. A branch test does not verify another deployment.
3. On an authorised isolated Redis resource, exercise genuine feature flows from two app instances. Verify shared quota, expiry reset and outage messages, and inspect provider command metrics. Do not use real customer codes or recipient data.
4. Confirm the exact production binding and resource plan before deployment. Record the deployment ID and observed feature outcomes. Never substitute an artificial keep-alive for these checks.

## Inactivity and cost decision

Upstash's [FAQ](https://upstash.com/docs/redis/help/faq) says inactive free databases may be backed up and removed after at least 30 days. Recovery involves a new database and restore; unchanged endpoints or automatic wake-up are not promised. A code rollback cannot undo archival.

Prefer retaining a required database on pay-as-you-go after billing approval, rather than a keep-alive cron or unnecessary replacement. The [published pricing](https://upstash.com/pricing/redis) and inspected Marketplace offer list $0.20 per 100,000 commands; a fixed 250 MB offer is $10/month plus charges for read regions. Confirm the actual offer, storage/replication charges and tax when approving. Paid usage does not inherit the free command allowance. Plan selection and payment authorisation are account actions, separate from merging this patch.

## Rollback

Revert the code commit through the release coordinator and restore the prior reviewed deployment if behaviour regresses. There is no data migration or dependency change. A rollback restores the old failure-open redemption risk, so it is a temporary incident action, not the desired steady state. Keep the existing resource and bindings; do not rotate/delete credentials or downgrade a plan as part of code rollback. If the store has been archived, create/restore through an approved provider procedure and update every affected environment, then redeploy and verify actual receiving.
