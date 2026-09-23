# Agent orchestration

12 September 2026 · Capability evidence for this local Codex session. Configuration examples are proposals inside this document only. No live agent configuration, authentication or billing path was changed.

## Recommended operating model

Choose **B: Astra planning/checkpoint review, Sol coordinates routine execution**. The plan is cross-cutting enough to justify high-capability architecture review, but its approved tasks should become narrow enough for Sol to implement without the founder paying repeated architecture/context cost. Keep one active integration slice, usually one Sol writer and at most one independent reader/verifier. Use Luna selectively for bounded reference inventory or specified fixtures. Use Astra at PC-01/04/06/08/09/12/14/16 risk gates; do not route cosmetic edits to it automatically.

Fallback **C: one agent sequentially**, explicitly selected Sol medium/high for routine work, with a founder-visible Astra checkpoint handoff where needed. If effective mixed-model identity cannot be established, do not silently substitute several Astra workers. Stop delegating and continue the bounded task sequentially on the known selected session. This remains a useful workflow without an orchestration platform.

Option A (Astra continually coordinates Sol/Luna) is supported at the tool-request level here and suits short high-risk investigations, but makes every routine dispatch/status/context turn expensive. Option B is preferred for sustained implementation once contracts settle. None is proven cheaper by this planning session; evaluate total accepted outcome cost, including inherited context, retries, review, integration, defects and founder handling.

## Verified capability matrix

| Capability | Evidence | Status / consequence / fallback |
|---|---|---|
| Local Codex client | Running executable `C:/Users/ethan/AppData/Local/OpenAI/Codex/bin/7ac07f4ce733f89a/codex.exe --version` reports `codex-cli 0.153.4` | Verified embedded engine. PATH `codex --version` is separately `0.152.1`; do not treat it as the running app engine. Desktop GUI shell version was not exposed by file metadata. |
| Parent configuration | Allowlisted reads of `.codex/config.toml`: model `gpt-6-astra`, effort `high`, service_tier `default` | Configured values verified; not proof of per-turn effective runtime overrides. No current-turn effective model/effort metadata was returned by app tools. |
| Model identifiers | Active collaboration schema + local `models_cache.json` list `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-luna` | Verified selectable request IDs, not aliases invented from worker names. Official API model catalog is corroboration, not proof of Codex account entitlement. |
| Effort support | Local catalog: Astra low/medium/high/xhigh/max/ultra (default medium); Sol same (default low); Luna low/medium/high/xhigh/max (default medium) | Verified advertised settings. Specify effort explicitly; Luna low is not its catalog default. |
| Native workers | `collaboration.spawn_agent` accepted PC-DISC-01 request with Luna/low; worker returned useful source inventory. A Sol/high read-only cross-check was also requested | Dispatch and useful delegation verified. Return/list tools expose task/status, not effective model/effort or per-agent usage. Mixed-model execution requested, effective identity unverified. |
| Model/context controls | Active tool schema accepts `model`, `reasoning_effort`, `fork_turns`; full-history forks inherit and reject overrides | Verified contract: overrides require `none` or bounded turn count. Use `none` + self-contained task packet. Context isolation selection supported, exact billing/context savings unmeasured. |
| Permissions | Current session danger-full-access, approval never; schema says workers share tools/filesystem and no per-worker sandbox field | Verified unrestricted inherited permissions. Read-only packet is behavioral, not enforced sandbox. Do not claim a worktree or prompt is a security boundary. Use native restricted session if one is later selected; do not weaken parent settings. |
| Concurrency | Active harness says four slots including root | Verified current limit = three workers max. Proposed process cap normally one worker, at most two independent workers; never exceed three. No nested delegation. |
| Worktrees | `git worktree list --porcelain` enumerated existing App task worktrees; shared workspace contract defines task naming | Supported and read-only verified; none created in planning. Use one owner per new task-named worktree after execution approval. App saved-project list was empty, so do not invent a project ID for app task creation. |
| Billing/auth | Safe auth metadata: `auth_mode=chatgpt`, account tokens present, API key false. App usage tool: Pro, Codex 7-day window 11% used at observation, credit balance 0 | Existing account allowance path indicated. Account-wide readings cannot price this task/worker or prove no other spending. No API keys/reset/credit purchase. |
| Usage granularity | `get_usage_limits` returns account windows/credit state, not task token totals; agent results have no token ledger | Per-task compute unverified. Use tool calls/output budget/retry count/review passes as labelled proxies. Do not report invented dollars/savings/token totals. |
| Service tier | Parent config says default; collaboration tool advertises priority availability without a tier-selection field | Requested no premium override. Effective worker tier/cost is unverified; no claim of standard worker billing. Before sustained execution disclose this and verify available account controls; sequential fallback avoids an unverified fleet. |
| Browser/computer tools | Current tools/skills include Playwright via local tooling, in-app browser and Windows computer use; model catalog has image/tool support | Advertised support, not an end-to-end per-model UI trial. Prefer deterministic Playwright checks; do not assume computer use requires Astra. Escalate difficult visual judgment only. |

Evidence avoids credentials, account IDs and token values. Usage percentage is a dated shared-account observation; never attribute its changes entirely to this task.

### Precedence: documentation versus this session

Current official documentation describes custom agent files overriding model/effort, with explicit spawn values then agent defaults then parent for prior resolution. Selecting a model without effort uses that model's default; custom model-only config can preserve previously resolved effort. Live permission overrides are reapplied. This is documented behavior, not a reason to invent unexposed custom-agent controls in this harness. [Official subagent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents)

Here the active tool schema takes precedence for what can actually be requested: full fork inherits; `fork_turns=none` allows explicit model/effort. No custom agent role/config selector or sandbox override is in the collaboration schema. The safest proposed configuration is explicit packet+spawn arguments, not installing a new agent framework. Local model catalog can support efforts beyond an API documentation example; never substitute API pricing for Codex plan accounting. [Official model catalog](https://developers.openai.com/api/docs/models)

## Concrete runtime packet and dispatch

Every packet carries task ID, requested model/effort and effective model/effort when returned, baseline/hash, allowed files/actions, objective/non-goals, dependencies, source references, interface contract, exact acceptance commands, output/effort budget, stop rule, escalation and result format. Packet templates in delivery-backlog are ready after gates. Supply relevant excerpts, not both source reports or the whole conversation.

Example **proposed native call**, not active configuration:

```json
{
  "task_name": "pc07_project_conversation_ui",
  "fork_turns": "none",
  "model": "gpt-5.6-sol",
  "reasoning_effort": "medium",
  "message": "PC-07 packet with approved baseline, isolated worktree, accepted prototype, exact allowed files, receipt contract, tests and stop rules."
}
```

No tool can be called with this abbreviated example alone; coordinator must expand the actual task packet. On dispatch, preserve the receipt and any metadata. If only task name/status is returned, record effective model as unverified and do not use the worker's self-description as proof. Do not run dummy model tests: useful PC-00 inventory, PC-07 reducer/component work and PC-09 verification are the calibration set. Compare first-pass acceptance, corrections, review effort and exposed usage; do not implement the whole feature three times.

## Budgets, escalation and integration

Default proposed envelope: one active slice, one coordinator, up to two useful workers concurrently (runtime maximum three); one delegation level; one owner per worktree. Discovery packets <=12–20 calls and 700–1200 words; implementation <=25 calls before a checkpoint; high-risk review one frozen-candidate pass. These are advisory process budgets, not hard token/spend caps. No goal/token budget tool was set because no explicit numerical token budget was requested.

Escalation: worker stops on ambiguous scope, missing contract, unsafe environment, access-data inconsistency, incompatible baseline or exceeded packet allowance. Coordinator permits one targeted correction, then diagnoses specification/model/environment/dependency cause. Escalate Sol to Astra for structural uncertainty, not automatically after every test failure. Additional Astra worker needs a concrete justification. Founder is consulted only for material scope/audience/privacy/infrastructure cost or declared human gates, not each reversible component.

Worktree setup after EXECUTE: verify current `app` state and receiving branch with architecture/release owners; inspect workspace `tools/new-worktree.ps1` before use; create task branch `feat/project-conversation-<slice>` in `worktrees/app/feat-project-conversation-<slice>`. Do not move/reset the root or reuse another writer's checkout. Allocate separate local DB paths/ports and generated output. Worktrees still share credentials/providers, so block ambient production connections. Coordinator/integrator alone owns schema order, lockfiles and shared contract edits; readers verify immutable candidate hashes. Reconcile onto selected receiving baseline and rerun affected integrated tests.

The workspace ordinarily requests commit/push/HQ updates at handoff, but this user's planning boundary explicitly disallows publishing/pushing and product changes. Therefore this package stays local and uncommitted; later publishing/HQ sync is a separate action. EXECUTE as defined in README authorizes local branches/implementation and local commits, not pushes, PRs or deployment unless separately agreed.

## Exact Sol-led startup handoff

Founder selects `gpt-5.6-sol` with **medium** effort in the task/model control, then sends the following. Selecting a model is a user/app operation; this planning task did not change the current model or create a new task.

> EXECUTE the approved local Project Conversation plan. Use `C:/Users/ethan/signal-studio-workspace/app/docs/projects/project-conversation/STATE.md` as the resume index, then README, decisions, delivery-backlog and agent-orchestration. Read current workspace/repository AGENTS.md and verify the baseline, dirty files and overlapping architecture/release work before editing. I approve the local-development scope and deviations explicitly recorded in README; do not infer any other approvals. Start PC-00, then the ready tasks in dependency order with one active integration slice. Use Sol medium for routine work, high for difficult implementation, Luna low only for bounded inventory/fixtures, and Astra high for the listed high-risk reviews. Use native workers only when their effective configuration is verifiable or clearly record the limitation and use sequential fallback; never silently launch Astra workers. Preserve Project identity, private Notes, canonical Tasks/Discussion, audience checks and durable receipts. Keep all data synthetic and services isolated. Stop for the prototype/human gate, unavailable designated test environment, material scope/privacy/cost choice, and all real pilot/production/external-action gates. No production, external invites/messages, push/PR, paid service, destructive data operation, guest or AI release is authorized. Maintain STATE and evidence after each accepted packet; do not rediscover unchanged material.

If approval is narrower, replace the scope sentence with exact PC IDs and deviations. Minimal handoff is the seven files and their canonical path/baseline; original source hashes/locations in STATE support provenance. Resume only after verifying affected source drift. A new session can read these files without inheriting this entire planning conversation.
