/** Synthetic planner evaluation only: no action executor, mail transport or production database.
 * node --import tsx --import ./src/test/register-server-only.mjs scripts/ping/assistant-model-eval.ts
 *   --self-test --output .db-evidence/model-eval/NEW-RUN --models haiku,sonnet
 * Live additionally requires --live --acknowledge-workspace-cap and PING_ASSISTANT_MODEL_EVAL_LIVE=1.
 * The coordinator must separately verify the credential's workspace and $1 console cap.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, open, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../../src/server/db/schema";
import { createPingProofFixture, PROOF_PROJECT } from "../../src/server/ping/proof-fixture";
import { assistantPayloadHash, createAssistantStore } from "../../src/server/ping/assistant/store";
import { createClaudeAssistantPlanner, compileClaudePlannerSchema, PING_ASSISTANT_PLANNER_INSTRUCTIONS, type PlannerTier } from "../../src/server/ping/assistant/claude-planner";
import { ASSISTANT_PLAN_SCHEMA, parseAssistantPlan, resolveAssistantDate, type AssistantPlan,
  type AssistantPlannerContext, type AssistantTaskFields } from "../../src/lib/ping/assistant/contract";

type Model = "haiku" | "sonnet" | "opus";
type Case = { id: string; text: string; mode?: "execute" | "draft"; context?: Partial<AssistantPlannerContext>;
  expected?: AssistantPlan; expectedOutcomes?: readonly string[]; opusSample?: boolean };
type Manifest = { version: string; synthetic: true; context: AssistantPlannerContext; cases: Case[] };
const MAX_ATTEMPTS = 60, CAP_MICRO_USD = 5_000_000;
const fixed = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const normalizedName = (value: string) => value.normalize("NFKC").trim();

/** Compare effects, not arbitrary model action IDs or template-vs-item spelling. */
export function semanticEffects(plan: AssistantPlan, context: AssistantPlannerContext): unknown {
  if (plan.outcome !== "plan") return { outcome: plan.outcome };
  const projects = new Map<string, string>();
  const target = (ref: { kind: string; name?: string; stepId?: string }) => ref.kind === "current" ? context.projectName
    : ref.kind === "name" ? normalizedName(ref.name!) : projects.get(ref.stepId!) ?? "INVALID_REFERENCE";
  const fields = (value: AssistantTaskFields, create: boolean) => ({
    ...(value.title === undefined ? {} : { title: value.title }),
    ...(value.description === undefined || create && value.description === "" ? {} : { description: value.description }),
    ...(value.assignees === undefined && !create ? {} : { assignees: (value.assignees ?? []).map(member => member.kind === "self" ? context.actorName : normalizedName(member.name)).sort() }),
    ...(value.dueDate === undefined && !create ? {} : { dueDate: value.dueDate == null ? null : resolveAssistantDate(value.dueDate, context.referenceDate) }),
    ...(value.status === undefined && !create ? {} : { status: value.status ?? "todo" }),
    ...(value.milestone === undefined && !create ? {} : { milestone: value.milestone ?? false }),
  });
  const effects = plan.actions.map(action => {
    if (action.kind === "create_project") {
      projects.set(action.id, normalizedName(action.name));
      return { kind: action.kind, name: normalizedName(action.name), ...(action.description ? { description: action.description } : {}) };
    }
    const base = { kind: action.kind, project: target(action.project) };
    if (action.kind === "create_tasks") {
      const drafts = action.tasks ?? Array.from({ length: action.template.count }, (_, index) => ({
        title: `${action.template!.titlePrefix} ${index + 1}`, description: action.template!.description,
        assignees: action.template!.distribution === "round_robin" && action.template!.assignees?.length
          ? [action.template!.assignees[index % action.template!.assignees.length]] : action.template!.assignees,
        dueDate: action.template!.dueDate, status: action.template!.status,
        milestone: action.template!.milestoneCount === undefined ? action.template!.milestone : index < action.template!.milestoneCount,
      }));
      return { ...base, tasks: drafts.map(task => fields(task, true)) };
    }
    const rest = Object.fromEntries(Object.entries(action).filter(([key]) => !["id", "project"].includes(key)));
    if (action.kind === "update_tasks") return { ...base, targets: action.targets, changes: fields(action.changes, false) };
    return { ...rest, ...base };
  });
  return { outcome: "plan", mode: plan.mode, effects };
}

export function evaluatePlan(item: Case, actual: AssistantPlan, context: AssistantPlannerContext) {
  if (item.expectedOutcomes) return item.expectedOutcomes.includes(actual.outcome);
  return !!item.expected && fixed(semanticEffects(item.expected, context)) === fixed(semanticEffects(actual, context));
}

function oracleSelfCheck(manifest: Manifest) {
  const altered = (id: string, change: (action: Record<string, unknown>) => void) => {
    const item = manifest.cases.find(item => item.id === id)!;
    const plan = structuredClone(item.expected) as Extract<AssistantPlan, { outcome: "plan" }>;
    change(plan.actions[0] as unknown as Record<string, unknown>);
    assert.equal(evaluatePlan(item, plan, { ...manifest.context, ...item.context }), false, `Oracle must reject altered effects: ${id}`);
  };
  altered("02", action => { (action.template as { count: number }).count = 99; });
  altered("03", action => { (action.targets as { limit: number }).limit = 89; });
  altered("04", action => { (action.template as { milestoneCount: number }).milestoneCount = 4; });
  altered("11", action => { (action.changes as { assignees: unknown[] }).assignees = [{ kind: "name", name: "Owen Vale" }]; });
  altered("18", action => { (action.changes as { dueDate: string }).dueDate = "tomorrow"; });
  const sample = manifest.cases.find(item => item.expected?.outcome === "plan")!;
  const expected = sample.expected as Extract<AssistantPlan, { outcome: "plan" }>;
  const wrong: AssistantPlan = { ...expected, actions: [...expected.actions, { id: "unexpected", kind: "open_chat", project: { kind: "current" } }] };
  assert.equal(evaluatePlan(sample, wrong, manifest.context), false, "Oracle must reject an extra action");
  assert.equal(parseAssistantPlan({ ...expected, actions: [{ id: "bad", kind: "publish_timeline" }] }), null);
}

function cli(args: string[]) {
  const values = new Map<string, string>(), flags = new Set<string>();
  const switches = new Set(["--self-test", "--live", "--acknowledge-workspace-cap", "--allow-opus"]);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (switches.has(arg)) { if (flags.has(arg)) throw new Error("duplicate_option"); flags.add(arg); }
    else {
      if (!["--output", "--models", "--cases"].includes(arg) || values.has(arg) || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("invalid_option");
      values.set(arg, args[++index]);
    }
  }
  if (flags.has("--live") === flags.has("--self-test") || !values.get("--output") || !values.get("--models")) throw new Error("explicit_mode_output_models_required");
  const models = values.get("--models")!.split(",") as Model[];
  if (!models.length || new Set(models).size !== models.length || models.some(model => !["haiku", "sonnet", "opus"].includes(model)) || models.includes("opus") && !flags.has("--allow-opus")) throw new Error("model_not_admitted");
  return { live: flags.has("--live"), acknowledgeCap: flags.has("--acknowledge-workspace-cap"), output: resolve(values.get("--output")!),
    models, caseIds: values.get("--cases")?.split(",") };
}

async function freshOutput(path: string) {
  const cwd = await realpath(process.cwd()), rel = relative(cwd, path);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("output_must_be_ignored_checkout_path");
  try { execFileSync("git", ["check-ignore", "--quiet", "--", rel], { stdio: "ignore" }); }
  catch { throw new Error("output_must_be_gitignored"); }
  await mkdir(dirname(path), { recursive: true });
  const parent = await realpath(dirname(path));
  if (relative(cwd, parent).startsWith("..")) throw new Error("output_parent_escaped_checkout");
  await mkdir(path); // Existing evidence is never overwritten or resumed as a new evaluation.
}

async function main() {
  const options = cli(process.argv.slice(2));
  // No credential access in self-test, nor before explicit live admission.
  if (options.live && (!options.acknowledgeCap || process.env.PING_ASSISTANT_MODEL_EVAL_LIVE !== "1")) throw new Error("live_preflight_required");
  const bytes = await readFile(resolve("experience/ping-assistant/model-cases.json"));
  const manifest = JSON.parse(bytes.toString("utf8")) as Manifest;
  if (manifest.version !== "ping.assistant.model-cases.v1" || manifest.synthetic !== true || manifest.cases.length !== 20 || new Set(manifest.cases.map(item => item.id)).size !== 20) throw new Error("invalid_synthetic_manifest");
  for (const item of manifest.cases) {
    if (!item.id || !item.text || item.expected && !parseAssistantPlan(item.expected) || !item.expected && !item.expectedOutcomes?.length) throw new Error("invalid_synthetic_case");
  }
  const selected = manifest.cases.filter(item => !options.caseIds || options.caseIds.includes(item.id));
  if (!selected.length || options.caseIds?.some(id => !selected.some(item => item.id === id))) throw new Error("invalid_case_selection");
  const attempts = options.models.flatMap(model => selected.filter(item => model !== "opus" || item.opusSample).map(item => ({ model, item })));
  if (!attempts.length || attempts.length + (options.live ? 0 : 1) > MAX_ATTEMPTS || attempts.filter(a => a.model === "opus").length > 4) throw new Error("attempt_limit_exceeded");
  oracleSelfCheck(manifest);
  await freshOutput(options.output);
  const ledger = await open(resolve(options.output, "attempts.jsonl"), "wx");
  const append = async (value: unknown) => { await ledger.write(`${JSON.stringify(value)}\n`); await ledger.sync(); };
  const source = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  await writeFile(resolve(options.output, "manifest.json"), JSON.stringify({ version: "ping.assistant.model-eval.v1", source,
    fixtureHash: createHash("sha256").update(bytes).digest("hex"), synthetic: true, live: options.live,
    models: options.models, semanticAttempts: attempts.length, expectedFailureSelfTests: options.live ? 0 : 1, maxAttempts: MAX_ATTEMPTS, localCapMicroUsd: CAP_MICRO_USD,
    externalCap: "Operator must separately verify the credential workspace and its $1 console limit before live execution.",
    scope: "Planner semantic proposals only; no task execution, messages, browser, speech or production qualification." }, null, 2));
  // The existing proof fixture's custody marker is fixed to Alice; evaluation budget runs use its separately seeded owner.
  const proof = await createPingProofFixture({ scratchDirectory: options.output, databasePath: resolve(options.output, "synthetic.sqlite"),
    mode: "create", binding: { actorId: "alice", projectId: PROOF_PROJECT, sessionId: randomUUID(), sourceRevision: source,
      manifestSha256: createHash("sha256").update(bytes).digest("hex") } });
  const database = drizzle(proof.client, { schema }), store = createAssistantStore(database);
  const controller = new AbortController();
  const stop = () => controller.abort(); process.once("SIGINT", stop); process.once("SIGTERM", stop);
  const schemaValue = compileClaudePlannerSchema({ type: "object", properties: { plan: ASSISTANT_PLAN_SCHEMA }, required: ["plan"], additionalProperties: false });
  let passed = 0, failed = 0, dispatched = 0;
  try {
    // The only live credential read occurs here, after admission/output/fixture setup.
    const apiKey = options.live ? process.env.ANTHROPIC_API_KEY : "synthetic-evaluation-key-no-network";
    if (!apiKey) throw new Error("approved_key_env_required");
    for (const { model, item } of attempts) {
      if (controller.signal.aborted) break;
      const requestId = `eval-${model}-${item.id}-${randomUUID()}`;
      const created = await store.createRun({ actorId: "owner", requestId, requestHash: assistantPayloadHash({ model, caseId: item.id }),
        request: { synthetic: true, caseId: item.id, model } });
      const runId = created.run.id;
      const context = { ...manifest.context, ...item.context, mode: item.mode ?? "execute" };
      const tier: PlannerTier = model === "haiku" ? "simple" : model === "sonnet" ? "bulk" : "evaluation";
      await append({ event: "attempt_started", runId, requestId, caseId: item.id, model, at: new Date().toISOString() });
      const started = performance.now();
      const transport: typeof fetch = options.live ? async (url, init) => { dispatched++; return fetch(url, init); }
        : async (_url, init) => {
          dispatched++;
          const request = JSON.parse(String(init?.body));
          assert.equal(request.messages.length, 1); assert.ok(request.system.includes("finite Ping assistant plan"));
          const plan = item.expected ?? { version: "ping.assistant.v1", outcome: item.expectedOutcomes![0], message: "Synthetic refusal or clarification" };
          return Response.json({ type: "message", role: "assistant", model: request.model, stop_reason: "end_turn",
            content: [{ type: "text", text: JSON.stringify({ plan }) }], usage: { input_tokens: 1000, output_tokens: 500 } });
        };
      const planner = createClaudeAssistantPlanner<AssistantPlan>({ apiKey, fetch: transport, budget: store.budget, schema: schemaValue,
        instructions: PING_ASSISTANT_PLANNER_INSTRUCTIONS, allowEvaluation: model === "opus", deadlineMs: 60_000,
        validate: value => {
          if (!value || typeof value !== "object" || Object.keys(value).length !== 1 || !("plan" in value)) return null;
          const plan = parseAssistantPlan(value.plan);
          return plan && (plan.outcome !== "plan" || plan.mode === context.mode) ? plan : null;
        } });
      try {
        const result = await planner.plan({ runId, requestId, text: item.text, context, tier }, controller.signal);
        const ok = evaluatePlan(item, result.plan, context); if (ok) passed++; else failed++;
        await store.finishRun("owner", runId, ok ? "completed" : "failed", { message: ok ? "Synthetic semantic oracle passed" : "Synthetic semantic oracle failed" });
        await append({ event: "attempt_finished", runId, caseId: item.id, model: result.model, passed: ok,
          planningMs: performance.now() - started, usage: result.usage, effects: semanticEffects(result.plan, context) });
      } catch (error) {
        failed++;
        const safe = error instanceof Error && /^planner_[a-z_]+$/.test(error.message) ? error.message : "evaluation_attempt_failed";
        await append({ event: "attempt_failed", runId, caseId: item.id, model, code: safe, planningMs: performance.now() - started });
        await store.finishRun("owner", runId, "failed", { message: safe });
        // A timeout may leave physical work running. Never start another provider request after uncertainty.
        if (["planner_deadline", "planner_cancelled", "planner_provider_unavailable", "planner_request_failed"].includes(safe)) break;
      }
    }
    if (!options.live) {
      const requestId = `eval-expected-failure-${randomUUID()}`;
      const created = await store.createRun({ actorId: "owner", requestId, requestHash: assistantPayloadHash({ fault: "synthetic_http_503" }) });
      let calls = 0;
      await append({ event: "attempt_started", runId: created.run.id, requestId, caseId: "self-test-http-503", model: "haiku", expectedFailure: true });
      const fault = createClaudeAssistantPlanner<AssistantPlan>({ apiKey: "synthetic-evaluation-key-no-network", schema: schemaValue,
        instructions: PING_ASSISTANT_PLANNER_INSTRUCTIONS, budget: store.budget, validate: () => null,
        fetch: async () => { calls++; dispatched++; return new Response(null, { status: 503 }); } });
      await assert.rejects(fault.plan({ runId: created.run.id, requestId, text: "Synthetic failure", context: manifest.context, tier: "simple" }, controller.signal), /planner_provider_unavailable/);
      assert.equal(calls, 1, "No automatic provider retry");
      await store.finishRun("owner", created.run.id, "failed", { message: "Expected synthetic HTTP 503; reservation retained" });
      await append({ event: "attempt_failed", runId: created.run.id, caseId: "self-test-http-503", model: "haiku", expectedFailure: true,
        code: "planner_provider_unavailable", automaticRetries: 0 });
    }
    const rows = await database.all<{ reserved: number; estimated: number; unknown: number }>(sql`SELECT COALESCE(SUM(reserved_micro_usd),0) reserved,
      COALESCE(SUM(estimated_micro_usd),0) estimated, SUM(CASE WHEN usage_state='unknown' THEN 1 ELSE 0 END) unknown FROM assistant_runs`);
    const summary = { synthetic: true, live: options.live, semanticAttempts: attempts.length, expectedFailureSelfTests: options.live ? 0 : 1, passed, failed, dispatched,
      interrupted: controller.signal.aborted, budget: rows[0], estimatesAreNotBilling: true };
    await append({ event: "evaluation_finished", ...summary });
    await writeFile(resolve(options.output, "summary.json"), JSON.stringify(summary, null, 2));
    if (!options.live) {
      assert.equal(passed, attempts.length); assert.equal(failed, 0); assert.equal(dispatched, attempts.length + 1);
      assert.equal(rows[0].unknown, 1); assert.ok(rows[0].reserved > rows[0].estimated, "Unknown reservation must remain charged");
    }
    console.log(JSON.stringify({ output: options.output, passed, failed, dispatched, synthetic: true, live: options.live }));
    if (failed || controller.signal.aborted) process.exitCode = 1;
  } finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); await ledger.close(); proof.client.close(); }
}

main().catch(() => { console.error("Model evaluation stopped. Preserve the output directory and inspect its bounded ledger; no automatic retry was made."); process.exitCode = 1; });
