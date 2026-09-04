# Comp redemption security review

**Verdict:** no new entitlement-escalation, capacity-race, partial-commit, or raw-database-error disclosure defect was validated in the reviewed comp implementation. **One P2 routing/recovery defect remains:** the non-venue success link loses the stored Project at its destination. Input type/length validation also remains an inherited hardening gap; this review did not establish an exploitable denial of service or data disclosure from it.

Reviewed immutable candidate **b2e6f6faba09564536bcb4a7d6033b5aa8ad124f**, against parent **4305beab94549e75ad45809852ceb8ddd21cc39d**. Earlier dirty-file observations are superseded by this candidate. Review date: 4 September 2026.

Repository: C:/Users/ethan/signal-studio-workspace/worktrees/app/feat-january-core-integration

## Validated residual: P2 — non-venue replay loses the original Project on arrival

**Changed entry:** src/components/redeem/redeem-result-card.tsx:66–70.  
**Inherited root:** src/app/welcome/page.tsx:25, 33–50.  
**Confidence:** high. **Classification:** existing behavior left unresolved by the new explicit link, not a newly introduced authorization bypass.

An authenticated user redeems a non-venue code for Project A, switches their active cookie to another Project B they can access, then retries the same code. The new action correctly returns A. The actual result component generates /welcome?workspaceId=a. However, WelcomePage reads only the use parameter and calls getActiveWorkspace(). With B selected, it evaluates isFirstRun(B). If B already has tasks, it redirects to /app/home without the Project parameter. The promised stored destination has been lost. With an empty B, the onboarding decision is likewise based on B.

**Independent reproduction:** the harness executed the immutable action twice against real SQLite, rendered the actual result component as an element tree, then invoked the actual WelcomePage with its emitted workspaceId. The recorded first-run lookup was b and the redirect was exactly /app/home. Authentication/context dependencies were controlled stubs; the real auth.ts accessor was separately traced and reads the legacy active cookie, without consuming URL search parameters. Both fixture Projects were authorized for the actor.

**Impact:** the paid/gift access remains on A while the success journey sends the user into a different onboarding context or an unscoped home destination. No cross-tenant read, unauthorized write, or entitlement transfer was demonstrated. This is a functional recovery/destination defect, not a high-severity security finding.

**Required action:** use an existing Project-aware destination for non-venue success, or make the welcome route explicitly resolve and preserve workspaceId through its decisions and redirects. Test the destination route as well as the generated link. Acceptance scenario: grant A, active B, replay, follow result link; every Project-specific decision must remain bound to authorized A.

## Independently validated properties

The scratch harness completed **46 checks**, including **26 checks explicitly exercising the actual action**, plus input-boundary and destination reproductions that also call it. These are separate from the lead's 12 helper tests. A passing reproduction of a defect is included in the 46; this number is not an all-clear verdict.

| Boundary | Observed result |
| --- | --- |
| New sponsored claim | One entitlement, one consumed slot, 18 tasks, 18 activities, one retry receipt and final Project template/domain metadata. |
| Partial writes | Actual action calls with SQLite triggers failing after seven task writes, after nine activity writes, at receipt insertion, or at final Project metadata update rolled back the whole claim. Identical retries then succeeded. |
| Unknown commit outcome | A wrapper committed the real transaction and then threw a synthetic lost-acknowledgement error. The action returned its safe retry error. Replaying the same code returned original A and did not duplicate the claim. |
| User edits/deletions | After that committed claim, deleting all seeded tasks and changing Project template/domain metadata did not cause replay to recreate content or overwrite the edits. |
| Concurrent writers | Independent connections racing the same actor/code converged on one grant/starter. Two actors competing for the final slot produced one success and one exhausted result. |
| Authorization/fences | Foreign actor, missing context, archived Project, actor account-deletion tombstone and pending Project-deletion operation refused a new claim. Removed membership and archive refused prior-grant replay. The actual authorization, deletion checks and SQLite transaction executed. |
| Expiry/revocation | Expired and epoch-zero prior grants were refused. Expired code prevented a new claim but did not change an existing unexpired grant's original term; changing code duration/capacity did not extend that grant. |
| Historical exact grant | An old random-ID grant with only two prior tasks and no receipt returned its original Project while leaving those tasks and missing metadata unchanged. This demonstrates preservation, **not completed historical fulfilment**. |
| Historical ambiguity | Multiple exact actor/code comp grants were refused without consuming capacity or creating tasks. The committed failure copy no longer asserts that access remains active. |
| Sponsor identity | Resolution comes from the exact looked-up comp_codes row, matching the prior lookupSponsorByCode contract. Another code's sponsor metadata did not classify a plain gift as sponsored. |
| URL encoding | A synthetic sponsor slug containing ampersands, a fake workspaceId and a fragment stayed inside the v parameter. The emitted venue link retained exactly one authorized workspaceId. |
| NEW/REPLAY notes | Both actual action paths suppressed sponsor JSON and internal comp: bearer notes. Both preserved trimmed human gift prose. Neither returned codeNotes, the entitlement object, the synthetic code, or the private sponsor name. |
| Error privacy | Actual Drizzle failures containing synthetic bearer/sponsor values, nested-cause failures at auth/provision/transaction/limiter seams, and the post-commit error produced the fixed retry Error. The explicitly captured Sentry Error was the same safe Error, with no cause/query/params and only the stable action tag in its capture context. No global scrubber was used. |
| Limiters | User denial stopped the explicit action provisioning/helper lookup and skipped the IP bucket. IP denial stopped helper lookup after the user bucket. Arguments were actor/10/10 m and selected IP/40/1 h. Missing/throwing request headers retained the user bucket. |
| Demo | Success/expired/used/unknown demo values returned before action auth, limiter, provisioning or database access. REVIEW-SUCCESS in non-demo mode did not grant real access. Mode selection itself was stubbed; deployment flag configuration was not tested. |
| Client-callable grants | Student self-grant remained unavailable and non-admin minting was refused. applyTemplateInTransaction is exported from a server-only DB module, not a use-server action module; its new caller supplies the existing writer transaction. |

The privacy conclusion concerns the action's explicit error/capture boundary. It does not certify all Sentry automatic instrumentation, request URL collection, provider SDK behavior, or infrastructure logs. Likewise, the limiter checks verify action integration with controlled allow() results, not deployed Redis availability. getCurrentUser's existing internal provisioning is outside that action-ordering claim.

## Input bounds: inherited, not a validated security exploit

At src/server/actions/comp.ts, normalization calls rawCode.trim().toUpperCase() before the try/catch, without a runtime string check or action-specific maximum length.

- null, undefined, a number, an object and an array each threw TypeError before auth, database work or explicit Sentry capture.
- A 65,536-character string passed through both limiter calls to an exact database lookup and returned not-found.
- Whitespace-only input did no lookup. Lowercase/outer-whitespace input converged on the existing canonical claim. A SQL-looking string remained an exact bound lookup and created nothing.

These observations do not establish sensitive-data exposure, unauthorized entitlement mutation or a service-wide denial of service. Request transport limits were not exercised. A bounded parser is a useful follow-up, but the compatible maximum must accommodate historically minted codes and prefixes. The report does not call the action uniformly input-bounded or every possible exception sanitized.

## Historical and composition limits

Unknown partial historical grants remain operator reconciliation, as the committed COMP-REDEMPTION.md explicitly states. A successful prior-grant response confirms the existing authorized grant, not that its historical starter was fully delivered. No synthetic repair receipt was written and no missing content was recreated. Historical capacity consumed before entitlement creation also remains outside the new atomic guarantee.

The exported template helper's behavior is unchanged apart from its name/export and caller reuse. The couple-access-term signature change permits a transaction reader; the term calculation is unchanged. The package adds the new helper test to the default test command. The modified source contracts now follow the delegated helper. Those changes were inspected; the lead's later comp-notes source-contract adjustment, c163 integration tree and forthcoming a104 Event availability composition are **not** covered by this immutable review. No shared entitlement-reader, broader Event policy, Drive, or billing review was performed.

The existing /redeem/[code] page still invokes redemption during server rendering. That inherited GET behavior was observed as a caller, not redesigned or validated as a new explicit-consent flow here.

No full Linux/default gate, typecheck, browser/HTTP transport run, production configuration check or human comprehension test was performed independently for this review. The lead's reported gates are not substituted for the behavior evidence above.

## Reproduction and scope record

All runtime source was loaded from b2e6f6fa or matching pinned copies and transpiled in memory. Real Drizzle/libSQL used fresh migrated SQLite files beneath task scratch. Auth, provisioning, access-mode, headers, limiter and Sentry were controlled at their environment seams; the comp helper, template helper, authorization SQL, fences, note filter and URL code were not replaced. No real provider, credential, production database or outbound message was used.

Harness:

C:/Users/ethan/Documents/Codex/2026-09-04/here-are-6-prompts-i-have-2/work/comp-redemption-security-review/proof.cjs

Results and reviewed-file hashes:

C:/Users/ethan/Documents/Codex/2026-09-04/here-are-6-prompts-i-have-2/work/comp-redemption-security-review/results.json

Re-run in PowerShell:

~~~powershell
& 'C:/Users/ethan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' 'C:/Users/ethan/Documents/Codex/2026-09-04/here-are-6-prompts-i-have-2/work/comp-redemption-security-review/proof.cjs'
~~~

Validation rubric: reachable entry; exact identity/scope; persisted before/after state; attempted counterexample; calibrated impact/inheritance. The scoped threat model treats signed-in code holders and retries as untrusted, Clerk identity and operator-issued code metadata as trusted inputs, and database capacity/grants/tasks/metadata plus caller/telemetry serialization as the protected boundaries. Every candidate taken into validation is accounted for above: routing survives; input bounds remain a hardening gap; sponsor confusion, partial new commits, double claims, replay resurrection and explicit error leakage were refuted in the tested cases.

Only task scratch and this report were written. No repository runtime or test edits, commit, push, merge or deployment was performed.

