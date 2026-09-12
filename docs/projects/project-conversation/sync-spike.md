# PC-05 two-process synchronization experiment

12 September 2026. Final tested code: `dd93297e`. Local synthetic EX-02 passes the stated local latency and retrieval checks. This is a feasibility result, not an authenticated product or deployed-performance claim. Independent architecture disposition is recorded in STATE.

## What actually ran

`node scripts/conversations/sync-experiment.mjs C:/Users/ethan/Documents/Codex/2026-09-12/plea/work/conversation-sync-final` created one fresh synthetic file database from the supported 0014–0027 baseline plus the proposed isolated schema. It launched two real Node v22.23.2 child processes, each binding a different loopback port and opening its own connection to the same WAL file. Both processes exited after the test; the separate prototype preview remains available.

Each profile creates distinct synthetic users with canonical membership rows, then sends ten distinct messages while readers independently poll across both instances. The 200-viewer profile is a stress profile, not a proposed audience-limit increase. Each message directs attention to at most 50 explicit mentions. The experiment checks actual attention-row counts against that intended fan-out. It retains first-observed timestamps independently of send acknowledgment so early readers are not lost from the measurement. All 2,600 expected message/viewer observations occurred, and final paginated histories contained every acknowledged source ID. Six post-removal probes across both instances returned only `unavailable`.

The HTTP identity header is an explicit fixture input, **not authentication**. These HTTP processes live under `scripts/`, are not Next routes, and must never be deployed. Clerk identity/session behavior, origin/CSRF enforcement and real API integration are PC-06/07 work.

## Measurements

| Distinct viewers | Directed recipients/message | Send p95 | Other-client visibility p95 | Warm first-page p95 | Poll p95 | Observed/expected |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 10 | 29.22 ms | 977 ms | 25.21 ms | 18.63 ms | 100/100 |
| 50 | 50 | 50.99 ms | 979 ms | 66.71 ms | 19.46 ms | 500/500 |
| 200 | 50 | 58.25 ms | 991 ms | 305.09 ms | 49.34 ms | 2,000/2,000 |

Targets checked: send p95 ≤800 ms; other-client visibility p95 ≤1,500 ms; warm first-page p95 ≤1,000 ms. Visibility uses the persisted transaction timestamp, which is sampled before commit, so it also includes the committing transaction's remaining time. Local clocks share one host. Profile duration includes verification/pagination overhead; it is not a steady-state benchmark window. Warm first-page timings do not mean complete-history transfer time.

Final run: 10:34:02.530–10:34:19.330 UTC. Runtime processes 23520 and 14756; now closed. 2,336 total history requests and 30 sends, six intentional authorization refusals, zero HTTP failures and zero send busy retries. Polled change pages carry `private, no-store, max-age=0`. Raw result is committed as [sync-result.json](evidence/sync-result.json).

## Demand and practical limits

The UI scheduling experiment in `src/lib/conversations/polling.ts` uses a one-second visible active interval, 15-second list interval, 10% jitter, hidden pause and exponential failure backoff capped at 30 seconds. It permits one in-flight request and rejects stale account/Project responses. Three deterministic scheduler tests cover these behaviors; the load experiment separately proves actual cross-process store visibility. It does not pretend its HTTP loop directly mounts that UI scheduler.

At steady state before latency/jitter, 50 visible viewers imply approximately 50 history requests/second (180,000/hour); 200 imply approximately 200/second (720,000/hour). Fifty list viewers imply approximately 3.33 requests/second (12,000/hour). Hidden viewers pause. These are derived demand estimates, not observed billable invocation totals. A successful local history read executes BEGIN, one authorization query, one bounded changes/current-message query, one has-more query and COMMIT: five client SQL commands. Three are SELECT statements, so the 50-viewer hypothesis implies approximately 150 SELECTs/second before extra pagination. Fan-out writes add attention/outbox inserts per eligible recipient; the experiment measured up to 50 per message.

Hosted invocation, database rows read, egress, cross-region latency and monetary cost remain **unverified**. No vendor price or production budget is inferred. The local queue allows one operation per connection and bounds pending HTTP operations to 256; this protects the native adapter observed here. It is not a distributed queue or proof of remote-adapter correctness.

## Failure history and decision

The first EX-02 run met latency targets but review found the store was directing attention to all Project members, so its intended-recipient labels were inaccurate. It is superseded. A new O12 test reproduced that defect (unmentioned member received one event instead of zero), then the store was corrected to Project mentions/DM recipient semantics. The final run adds explicit row-count assertions and is the only accepted metrics table above. Follow, mute, quiet hours and external delivery policy remain PC-11 work.

Retain shared-store polling as the **local implementation hypothesis**; no broker purchase is justified by this evidence. Before production integration is treated as deployable, verify the selected remote driver's transaction and primary-snapshot semantics in an explicitly isolated provider environment. The native interactive handle crashes recorded in [transaction-spike](transaction-spike.md) prevent treating the local persistent-connection workaround as a drop-in remote implementation. Preserve that adapter boundary and keep nonfixture controls off until its own evidence passes.
