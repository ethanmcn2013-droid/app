# Signal App

This repository owns the signed-in Signal Studio app at app.signalstudio.ie: project management for non-technical teams. Home is the authenticated front door: the next target date and this week's pace, four ways to start, and a year of activity. The Full Briefing was retired on 20 October 2026; /app/home/briefing and legacy /app/signal links redirect to Home. This entrypoint is self-contained in an isolated checkout. Product source and checks belong here; shared workflow tools live in Signal Operations.

<!-- signal-shared-rules:begin -->
<!-- Source: docs/agent-rules.md; sha256: b87309ff14660a99c962bd2deca2147faaf782e9f04ccfce01d5bec15b2c2068 -->
## Shared working rules

Signal Studio builds one coherent product system. Use current source and accepted product facts; do not revive an archived architecture or infer scope from an old chat.

These product and programme rules apply to Signal work. Personal work follows its own purpose, checks, and acceptance target; it does not inherit Signal launch or programme constraints.

- Follow the user's scope. Research-only requests stay read-only. For authorized implementation, own relevant checks, review, integration, receiving verification, and closeout.
- Integrate routine in-scope work without a founder merge click once current checks and proportionate revision-bound review pass. Missing review, unresolved findings, changed source/target, and explicit release holds prevent eligibility. Production consequences must be authorized and verified separately.
  During this migration, apply that integration path only to explicitly admitted, individually reviewed pilots. Adopt it as the general operating default after the P6 qualification receipt; enabling a repository setting alone does not qualify the workflow.
- One task owns its branch and checkout; one session holds the writer claim. Concurrent writers use isolated worktrees. Transfer the claim before another provider edits. Preserve unrelated changes.
- Use the existing task authority and handoff anchor. Record intended outcome, owner, source revision, target, evidence, next proof, and paused-state restore location. A new chat is not a new source of truth.
- Run the owning checks against the final state. UI changes require a real rendered check. Never report a test, review, merge, deployment, or acceptance that was not observed.
- Keep code, customer/privacy boundaries, secrets, and production/test environments distinct. Access to a tool does not authorize every effect it can perform.
- Ask the founder for a material decision outside standing authority, such as changed product direction, pricing/legal commitments, purchases, external communication, or destructive action beyond the adopted housekeeping policy. Prepare concrete options first.
- Before pausing or retiring work, preserve useful commits and files and verify the restore route. Never delete by age alone, remove another owner's state, or treat a squashed commit as unpublished solely from ancestry.
- Finish with target proof, task-state readbacks, and cleanup of owned disposable resources. A draft PR or a successful merge alone is not completion.
- Prefer purpose-based names, concise entrypoints, and scoped procedures. Automate mechanical bookkeeping; spend review effort in proportion to impact.
<!-- signal-shared-rules:end -->

## Task authority and completion

Use the existing private Delivery task and its current handoff anchor to identify the outcome, writer, source, destination and acceptance target. Respect the current WIP limits in the owning private operating contract; parent outcomes do not consume child-task WIP. Only the current coordinator admits work sequentially. A new checkout or issue comment alone does not establish distributed ownership.

Done requires appropriate revision-bound review, intended receiving-result proof, an acceptance receipt, explicit Project update, native Completed closure and both readbacks, followed by owned-resource closeout. Parked or superseded work closes as Not planned with its restore or successor link. Provider changes transfer the same task's writer claim before editing.

Programme-only development remains internal with isolated test data. Programme dates and a merge do not authorize production changes or external communication. Preserve task-specific release holds until explicitly superseded.

## Setup and checks

Use the package-manager version declared in package.json, currently pnpm 11.9.0, through Corepack. CI uses Node 22; this source has no .node-version pin. Install with corepack pnpm install --frozen-lockfile in the actual task checkout. Keep environment values in approved secret storage or ignored configuration; never copy production credentials into test fixtures or evidence.

- Quick source checks: corepack pnpm typecheck and corepack pnpm lint.
- Owning tests: corepack pnpm test; its pretest and posttest hooks include additional truth, arrival and Project Drive suites. Do not omit or duplicate them accidentally.
- Build: corepack pnpm build, including the built-token check.
- Database changes: corepack pnpm db:contract, plus the applicable isolated rehearsal and migration-ledger checks.
- Front-facing language: corepack pnpm first-contact:language; actual rendered and behavioral evidence is still required.

Read .github/workflows/verify.yml for final head/integration gates and their paired Studio inputs. Its required typecheck · test status depends on every canonical verification job and fails when verification fails, skips or is cancelled. The former duplicate ci.yml is retired; Project Drive lifecycle wiring and the informational parser step remain in Verify. Use the workflow's immutable compatible Studio revision for parity; latest Studio main is not an interchangeable fixture. Select additional checks from package.json and the owning contract for the changed behavior. A local subset is not full CI or production proof.

Development uses corepack pnpm dev with a task-owned available port. Git isolation does not isolate ports, databases, dependencies or background processes. Record their actual target and process identity before startup; stop only verified owned resources. Refresh the current deployment route and Git-deployment setting before integration. DEPLOY.md describes the release procedure, but historical comments do not establish current account configuration. A merge alone is not a deployment receipt; verify revision, READY state, canonical alias and intended live behavior when release is authorized.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Product, design and access contracts

Follow docs/SUITE_URL_AND_NAMING_CONTRACT.md and the typed constants in src/lib/product-urls.ts. Marketing uses signalstudio.ie/{notes|tasks|timeline}; signed-in products use app.signalstudio.ie/app/{notes|tasks|timeline} and Home /app/home. Retired /app/board, /app/plan, /app/brief, /app/home/briefing and legacy /app/signal inputs remain compatibility redirects only; new UI, analytics, docs and email must not emit them.

For front-facing changes preserve the priority order: considered experience, deliberate design, then unaided utility. Use docs/brand.md, the installed signal-ds tokens and owning component styles; preserve existing spacing, type, motion, loading/error/empty-state and copy standards. The existing quality-council evidence and 9.5 gate live in experience/QUALITY_COUNCIL_EVIDENCE.md. Relevant first-contact behavior follows docs/FIRST_CONTACT_TEST.md. A workflow refactor does not waive these gates or require a design panel for unrelated engineering. Delightful moments require an explicit animate-or-restrained verdict. The operator re-derives the north star about every six months; its durable decision and review date live in Studio content/hq/decisions/product-north-star.md. Locate that owning repository explicitly rather than assuming a parent checkout.

Before invitations, sharing, guest access, templates or public output, read docs/COLLABORATION_LOOP.md. Preserve authentication, tenant isolation, privacy, entitlement and erasure boundaries; choose stronger domain checks and independent review for changes to them.

## Database release safety

Never run drizzle-kit push or drizzle-kit migrate directly against production: the historical 0000-0013 chain is non-idempotent. The approved production route is db-migrate-encrypted on main, with verified encrypted backup upload before apply; the old db-migrate workflow must remain disabled. The receipt-backed corepack pnpm db:migrate command remains the low-level engine, and db:contract is the pre-flight gate. Read DEPLOY.md section 4 and drizzle/MIGRATIONS.md before migration work. Task scope and current release authority still govern execution.

## Product records and maintained context

For product-state changes, open or update a Studio PR against the matching HQ source in the same delivery cycle: content/hq/features for scope/status/impact; content/hq/risks for risks; content/hq/decisions for product/pricing/brand/GTM decisions; content/hq/campaigns for campaign changes; content/atlas for cross-product flows, data shapes and schedules (update lastVerified); content/hq/messaging.md for messaging. Shipped operator-visible changes also update this repository's CHANGELOG.md. Verify the owning Studio contract and revision before writing there. Historical log-cycle/check-cycles scripts are retired.

The shared block is maintained in Signal Operations docs/agent-rules.md; its version/hash is recorded above. CLAUDE.md imports this local entrypoint. Repository setup and invariants stay here; specialist procedures load when relevant, live priorities/ownership stay in Delivery, and past evidence remains historical. docs/agent-context-migration.md records the removal of the former mandatory parent dependency.
