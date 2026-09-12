# Decisions, assumptions and approval items

12 September 2026 · Local execution approved. This is the authoritative project decision register; individual human, environment and release gates remain separately recorded.

## Execution approval and current decisions

After receiving the planning package, the founder explicitly instructed: “Please begin. Execute from start to finish until entirely complete,” and requested orchestration and approximately 30-minute progress reports. This authorizes the README's PC-00–14/local PC-20 envelope and its scoped product corrections. It supersedes the original planning-only request described historically below. Owned worktrees, local commits, synthetic implementation and tests are authorized. Production data, external communication, spending and later guest/files/AI expansion remain outside this envelope.

Delegated decisions: root integrates from local a709e22a; Sol owns bounded prototype and database packets; Luna inventories existing seams; fresh Sol reviews frozen contracts/UI. One writer per owned worktree. No custom orchestration framework or unverified effective-model claim.

The prototype finish reviewer returned `ship` after the mobile selection correction. This is an agent verdict on a synthetic prototype, not a founder design lock or participant result. A concrete founder question is pending: approve the direction and amend PC-03 to allow local backend implementation before the participant study, retaining study evidence as a release gate. No answer has been inferred. Independent PC-04/05 experiments continue meanwhile.

Receipt clarification: retrieving an already committed send receipt is an authorized read, even if the Project is now archived or the client audience epoch is stale. It cannot create another source/effect. Fresh canonical membership and retained-history entitlement are required; removed actors cannot recover receipts. A different normalized payload with the same request still conflicts. Every genuinely new write retains strict archive and exact-epoch enforcement.

## Authority and source reconciliation

**Original planning authority (historical):** pursue integrated communication; review supplied context; read-only repository discovery; produce the planning package. The initial prompt required planning and a stop before product implementation; the subsequent explicit execution approval above supersedes that limit. Embedded report suggestions alone still do not authorize deployment, participant recruitment or new vendors.

The two Markdown reports were reviewed across their complete sections. The Desktop prompt and pasted prompt are the same planning assignment with presentation/emphasis differences; both explicitly prohibit product implementation. They have different byte hashes and are not claimed byte-identical. The pasted prompt is the operative version for this request. Named PDF counterparts were not present on Desktop or found in the supplied attachments, this Codex workspace or Signal workspace filename search. Their presentation/diagram/content parity is **unverified**, not assumed. Markdown supplies sufficient planning scope; no PDF-only evidence is claimed.

Source evidence is current code at the STATE baseline. `docs/wave/PROGRAMME.md` contains an August snapshot saying App root was stale/dirty and a wave-specific worktree-only rule; today's read-only Git snapshot shows clean main at a newer commit. That old wave's status is historical, not current ownership truth. This planning work makes only new documentation files and does not enter that implementation wave. January launch programme and current source remain distinct from this unapproved messaging initiative.

Workspace/repo instructions ordinarily call for pushes, PR/HQ synchronization and score-based design evidence. The specific user request overrides those here: no pushes/PRs/product edits, no arbitrary score panels, no rendered product/prototype claim during planning. Future approved scope/HQ synchronization belongs to release/integration work. Skills used: OpenAI Docs for current orchestration facts and signal-handoff for durable state; neither creates additional permission authority.

## Material choices

| ID / original proposal | Evidence and alternatives | Recommendation / effect / cost / verification / approval |
|---|---|---|
| **D-PC01 DM scope**: workspace DMs broader than project | ADR 0001 and ProjectId define workspace=Project; no broader organization membership store. Alternatives: new organization model now; global DM with shared-project test; defer DMs. | **Recommend Project-scoped pair DMs in VS2**, visibly named Project, one immutable pair per Project. This narrows convenience and may produce multiple rooms for same pair. Small integration cost versus new tenant system. Verify pair uniqueness, consent and removal. **Founder must accept narrowing**; otherwise defer DMs until architecture owner supplies an approved broader scope. No silent Space implementation. |
| **D-PC02 Notes audience**: save a decision to project/shared note | Notes action and ADR establish author-private data; filing is not sharing, separate DB. Alternative shared Notes requires new ownership/access/lifecycle model. | **Save to my Notes**, private filing and safe source link; team durable decision still can be a deliberate project message/task. Shared Notes is deferred. Cross-store idempotent receiver needed. Verify privacy + crash recovery EX-03. **Founder approval of reduced shared-outcome promise** required; do not market shared Notes. |
| **D-PC03 dates/Timeline**: due task automatically appears in Timeline | Existing Tasks Schedule/Calendar and milestone-only Timeline sync; public artifacts deliberately curated. Alternative auto-milestone would expose/overload timeline semantics. | Use canonical task dates in Tasks Schedule/Calendar; explicitly selected milestones follow existing Timeline path. Low integration cost. Verify no automatic publication/milestone change. **Founder accepts corrected journey expectation**. |
| **D-PC04 database/transport**: Supabase candidate realtime module | Actual Clerk/libSQL/Drizzle, no RLS, process-local SSE off in prod. Alternatives Supabase backend+broker, dedicated broker, managed Stream chat. | Keep current Tasks DB; primary-authorized polling first, outbox for alerts; no new paid service. Highest risk is consistency/performance/cost; EX-01/02 decide. If target/ceiling fails, return with specific opaque-broker decision, not silently degrade targets. **Approve bounded local experiment, not vendor purchase or permanent architecture before evidence**. |
| **D-PC05 navigation**: Projects/Tasks/Timeline, Notes under More | Current suite is Notes/Tasks/Timeline+Home; architecture task explores optional tools. | Preserve shell; prototype Messages discoverability/pinning and panel/full view only. Avoid coupling to navigation reshuffle. Verify solo and mobile labels and one main landmark. Founder prototype direction gate remains. |
| **D-PC06 canonical Discussion**: compatible adapter preferred | Comments already canonical; current action lacks retries/revisions and uses seed mentions; AI affordances already exist. | Extend current comments with compatible receipts/revisions/thread metadata and structured mentions. No mirrored chat messages or AI dependency. More adapter testing than greenfield generic table, but retains history. Verify old IDs/links and archive/write rules. Local implementation approval at G0; no migration now. |
| **D-PC07 attachments**: reuse only when secure | Protected storage/type validation exists; scanner/quarantine and room authorization missing. | Text/linked work internal pilot; file gate only if guest use case requires it. No implicit Project Drive dependency. Verify upload route rejects new chat attachments while disabled. Founder guest scope later. |
| **D-PC08 agent operating model**: choose A/B/C | Native explicit model/effort requests supported; actual worker identity/usage not returned; config/account evidence in orchestration. | B Sol-led routine execution, Astra high-risk checkpoints, selective Luna; C sequential fallback. No new framework, fleet or pricing claim. Advisory work caps; founder accepts local execution envelope and any cash ceiling before remote use. |
| **D-PC09 attention**: one directed-conversation count | Existing task Inbox has no generic thread receipts, old cron cannot be assumed to deliver to all users. | New canonical conversation-attention records consumed by both Inbox/Messages; old task reminders remain separate meaning. Mute suppresses directed badge/interruptions, ordinary history marker stays. Generic external alerts protect content; no excerpt by default. Verify hidden replies/DST/multidevice and honest delivery status. Founder approves product semantics through prototype. |
| **D-PC10 lifecycle/admin**: policy open | No project-conversation retention/admin/guest policy approved, privileged DB operators exist. | Proposed no E2EE claim, no ordinary owner DM visibility, metadata-only support. Retention duration, backup expiry, erasure/pseudonymization, holds/export/admin access and support response must be chosen before real data. Founder + appropriate privacy reviewer, PC-13/20; **blocks live pilot, not synthetic local work**. |
| **D-PC11 study sequencing**: audit after prototype | User explicitly authorizes technical planning now. | Audit now; after EXECUTE isolated feasibility may overlap prototype review; backend integration waits G1. Human evidence never fabricated. Founder controls material change to that gate. |

## Assumptions and unresolved facts with owners

| ID | Fact type / assumption | Owner / resolving task / effect |
|---|---|---|
| A01 | Assumed initial adults already collaborate in shared Projects; no pupil/anonymous audience | Founder PC-03/15; recruitment/pilot gate |
| A02 | Blocked live environment facts: exact Turso primary/read behavior, deployed schema, Clerk tenant, Resend, scheduling, Blob and feature flags | Technical owner EX-01/02/04 + PC-20 using designated test environment; no production inspection in planning |
| A03 | Proposed all retained Project conversation history visible to active eligible Project members, including later members; DM history remains pair-specific and requires current Project membership | Founder PC-01/03; show invitation/audience history before enablement |
| A04 | Proposed leaving/removal denies future DM history under this Project; surviving other participant retains their access to conversation history, sending disabled if pair no longer eligible | Founder PC-10; membership/rejoin/block rules must be clear, no silent reopening consent |
| A04b | Proposed each DM pair requires explicit acceptance; membership return does not restore departed participant access until deliberate pair reopening with retained-history disclosure. Blocking stops delivery but current participants may still read retained history. | Founder PC-01/10; exact state machine in technical-plan foundational clarifications |
| A05 | Proposed in-memory navigation drafts only, no cross-browser-restart guarantee | Founder design PC-03; later persistence requires explicit shared-device policy |
| A06 | Remote search FTS/transaction and cost targets not measured; model capability savings not measured | EX-01/02/05 and calibration packets; treat as evidence gates |
| A07 | Existing source main may differ from newer January receiving branch and uncommitted hierarchy prototype | Integrator PC-00; never apply packets to a different baseline without diff review |
| A08 | Desktop prompt formatting equivalence not assumed byte-for-byte; PDFs unavailable | Planning provenance recorded; no implementation blocker from duplicate format absence |

## New risks from repository grounding

**N01:** no RLS means a missed participant predicate is a disclosure risk. Keep domain repository small, primary/snapshot authorization and negative SQL tests; Astra accepts EX-01.

**N02:** synchronization polling may generate millions of monthly requests at modest concurrency. EX-02 measures actual unit cost; founder can choose broker only after a concrete comparison and cost approval.

**N03:** existing invitation code comments overstate verified-email enforcement, and old comment/notification/outbox APIs can return success-shaped results without the required durable semantics. Adapt contracts only in scope; do not describe existing features as proven safe by filenames/comments.

**N04:** Notes and Tasks are separate stores; a shared transaction would be fictional. Explicit operation receipt and receiver idempotency preserve outcome across failures; residual pending-link state is visible and repairable.

**N05:** concurrent architecture/January/Drive initiatives may change source ownership, schema order or permission semantics. PC-00 refreshes only affected evidence; no requirement to finish a whole suite reorganization first.

## Approval record

No new founder decisions have been recorded as approved by this planning work. Recommended G0 approval is the local development scope and D-PC01–09/11 directions, with D-PC10 policy and all real pilot/release/spend decisions held. Replying EXECUTE after reviewing README adopts its stated recommended local envelope unless you specify narrower tasks or amended decisions. A bare EXECUTE never authorizes production, external outreach/invites, new spending, destructive data operations or unapproved guest/AI release.
