# January follow-up integration

Internal candidate runtime: App `f3240a74bff3b5a839f272f898cd44aceb00159a`, paired Studio `b87d139ee1290f6aee75c8d023fe717357a9ab72`. These are candidate compositions, not receiving-release or deployed acceptance.

The App composition retains Home7479 and calendar/export768951 and merges the reviewed S2/S5 pair Appda62317b / Studio43bf371. The account-deletion fence still awaits usage-erasure custody before product deletion. No conflicting source change or migration renumbering was needed. App0030 and Studio additive0001/0002 remain production-held.

## Verification on 5 September

- Independent S5 fix verification:154 positive checks, with the two unchanged bug-expecting repros failing for the corrected results. Small-cohort observed metadata is omitted; invalid acknowledgements retain both event and erasure custody.
- Independent actual three-store composition:3 scenarios,24 original checkpoints and14 fresh failure probes pass. The payment, issuance, late-template, fulfilment and account-deletion writers retain their real transaction/retry boundaries. No fixture seeds a successful claim or ready fulfilment.
- Principal combined runtime: the same actual three-store rehearsal passes3/3 and24 checkpoints; the separate signed delivery/reporting/erasure rehearsal passes9/9. No real provider, settlement or identity deletion runs.
- Newly registered suites: App sponsored-use27, Home16 and invitation25 pass. Studio fulfilment16 and sponsored-use25 pass. Both full typechecks pass.
- App migration contract65 passes. The owning migration runner applies through0030 to a disposable local target, proves the no-op rerun and reports integrity OK/zero foreign-key violations. This does not certify any deployed database.
- The first Windows issuance suite reports22 assertions passed but its store-test process fails, so the command fails. An isolated unchanged store rerun with TAP diagnostics passes8/8. The first failure remains a failed receipt; its cause was not established from that reporter output. Full Linux gates must pass before receiving integration.

The local commands were run with Node24.19.0 and pinned installed dependencies. Evidence is retained in the principal task's `work/integrated-*.txt` logs and independent reports under its `outputs/` directory. The committed owner composition guides retain commands, migration identities and source inventories.

## Gate wiring

Default App tests now include the issuance, sponsored-use, Home scope and invitation suites; existing account/export, billing and Drive registrations remain. Default Studio tests include the real fulfilment and signed usage/migration suites. Its fulfilment tests require an explicit `VENUE_APP_FIXTURE_ROOT` with installed matching App dependencies.

Both Linux code workflows install the immutable counterpart using that repository's pinned package manager, record its exact revision and remove the checkout before host lint/build scanning. App additionally runs the actual three-store and signed paired rehearsals. Cross-repository code is tested at the named revision, never assumed from a moving branch. Re-pin the counterpart when its runtime changes, and again at final receiving integration; source-changing pins must receive fresh paired evidence. Main retains its existing peer selection until the later release-promotion change.

Pending: independent Notes fix acceptance/integration; final Home/Notes/Drive rendered evidence and materiality; Studio14 actual state coverage; full combined Linux/build/performance/receiving gates; updated restore proof including the new queue/shared schemas. Provider credentials, production migration receipts, worker scheduling, live lifecycle and commercial opening remain separate gates. No routine design choice is represented as a specific founder selection.

Linux CI33933581755 subsequently rejected unannotated entitlement reads in the new issuance canonical/erasure modules. The queries were followed to their callers: code-uniqueness checks intentionally include all recipients to detect corrupt duplicate consumption, the canonical lookup resolves the stored grant owner before signed usage authorization, and the eraser receives the exact account/project SQL predicate used for deletion. Per-statement rationale now uses the existing isolation contract; no query, predicate, scanner, floor or policy was weakened. The scanner and its sensitivity tests pass24 checks. This annotation is subject to review and does not certify future reads automatically.

Fresh review confirmed those five annotations against the actual callers and found no missing authorization or concrete disclosure. Notesf04a766e then passed independent198 checks/scenarios and88 immutable source-input comparisons, with no scoped residual finding. It is merged at0438ae74. The integrated candidate passes its six recovery unit checks and all five actual-source server/browser fixture runners, including27 browser scenarios. Historical receipts are preserved: the new wrapper writes a distinct run beneath ignored `experience/output/notes-recovery`, fixes the source root, clears single-case filters and passes only an explicit fixture environment. Default CI runs server regressions; the installed-browser design job runs both browser regressions and retains artifacts. Final full Next/Clerk and material design acceptance remain open.
