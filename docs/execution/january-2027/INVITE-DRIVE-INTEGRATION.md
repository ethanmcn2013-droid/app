# Invitation arrival and Drive integration

Observed 2026-09-04. Principal integration of `fix/january-invite-arrival`
(`0dfb2f8d`) into the preserved Drive candidate (`7d4040cb`).

Accepting an invitation to B preserves the Drive deletion fence and grant journal,
claims the still-live token and commits membership atomically, updates both project
preferences to B, and returns the canonical My work destination. Existing members
retain their actual role. Verified current account identity governs acceptance.
GET requests do not consume invitation state.

The additional integration test executes the real acceptance action, transaction,
project resolution and grant preparation against disposable SQLite. Provider dispatch
alone is replaced with an unavailable-provider fixture. Acceptance remains committed
and selects B, while the journal retains the exact B folder, recipient subject and
verified email in a pending grant. This is not observed Google behaviour.

Validation: 25 invitation/intent tests passed; the 23 relevant Drive-wiring and
task-security contracts passed after reconciliation; project-context contracts,
typecheck and focused ESLint passed. Receiving-branch Linux full-suite/build and
rendered final invitation states remain integration gates. The original handoff's
Windows SQLite cleanup failures are not reclassified as passes.

Open: real authentication rehearsal, cross-invite capacity concurrency, first-use
comprehension, and the wider useful-action/public-artifact loop. Human comprehension
and provider delivery are unverified. No production data, real recipient or provider
account was used. Automatic Git deployments remain disabled on this candidate.
