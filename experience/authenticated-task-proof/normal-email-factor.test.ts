import assert from "node:assert/strict";
import test from "node:test";
import { emailFactorDecision, selectNormalEmailCode, safeEmailFactorState, factorRoute, type EmailFactorState } from "./normal-email-factor";
const state = (patch: Partial<EmailFactorState> = {}) => safeEmailFactorState({ route: "first", ...patch });
const ready = () => state({ code: true, codeCount: 1, emailPrompt: true });
const setup = (observe: () => Promise<unknown>, patch: Partial<Parameters<typeof selectNormalEmailCode>[0]> = {}) => ({ expiresAt: new Date(Date.now() + 60000).toISOString(), active: () => undefined, observe, openMethods: async () => undefined, chooseEmail: async () => undefined, budgetMs: 1000, pollMs: 1, ...patch });
test("direct first-factor email OTP does not open menus or send another code", async () => {
  let clicks = 0;
  const result = await selectNormalEmailCode(setup(async () => ({ ...ready(), emailOptionCount: 1, emailOptionVisible: true }), { openMethods: async () => { clicks++; }, chooseEmail: async () => { clicks++; } }));
  assert.equal(result.emailPrompt, true); assert.equal(clicks, 0);
  assert.equal(emailFactorDecision(state({ ...ready(), codeCount: 6 }), { opened: false, selected: false }), "ready");
  assert.throws(() => emailFactorDecision(state({ ...ready(), codeCount: 7 }), { opened: false, selected: false }), { code: "EMAIL_FACTOR_AMBIGUOUS" });
});
test("waits through transient state then opens offered normal methods and selects email once", async () => {
  const observations = [state({ route: "start" }), state({ password: true }), state({ password: true, anotherMethodCount: 1, anotherMethodVisible: true }), state({ password: true, anotherMethodCount: 1, anotherMethodVisible: true }), state({ alternatives: true, emailOptionCount: 1, emailOptionVisible: true }), state({ alternatives: true, emailOptionCount: 1, emailOptionVisible: true }), ready()];
  const seen: unknown[] = []; let opened = 0, chosen = 0;
  await selectNormalEmailCode(setup(async () => observations.shift() ?? ready(), { openMethods: async ms => { assert(ms > 0 && ms <= 2000); opened++; }, chooseEmail: async () => { chosen++; }, onState: value => seen.push(value) }));
  assert.equal(opened, 1); assert.equal(chosen, 1); assert(seen.length >= 5);
});
test("already offered email option requires no alternate menu; ambiguous controls refuse all clicks", async () => {
  let selected = false, opened = 0;
  await selectNormalEmailCode(setup(async () => selected ? ready() : state({ emailOptionCount: 1, emailOptionVisible: true }), { chooseEmail: async () => { selected = true; }, openMethods: async () => { opened++; } }));
  assert.equal(opened, 0);
  await assert.rejects(selectNormalEmailCode(setup(async () => state({ emailOptionCount: 2, emailOptionVisible: true }), { chooseEmail: async () => { throw Error("Must not click"); } })), { code: "EMAIL_FACTOR_AMBIGUOUS" });
});
test("second factor, reset, trust/protect and unknown origins/routes never select or fill a factor", async () => {
  for (const route of ["second", "reset", "trust", "protect", "outside", "unsupported"] as const) {
    let clicked = false;
    await assert.rejects(selectNormalEmailCode(setup(async () => ({ ...ready(), route }), { openMethods: async () => { clicked = true; }, chooseEmail: async () => { clicked = true; } })), { code: "EMAIL_FACTOR_UNSUPPORTED_ROUTE" });
    assert.equal(clicked, false);
  }
});
test("settled unsupported branches have explicit finite failure codes, without password/reset action", async () => {
  for (const [observed, code] of [[state({ password: true }), "EMAIL_FACTOR_PASSWORD_ONLY"], [state({ alternatives: true }), "EMAIL_FACTOR_NOT_OFFERED"], [state({ code: true, codeCount: 1 }), "EMAIL_FACTOR_CODE_PURPOSE"], [state({ route: "start" }), "EMAIL_FACTOR_TIMEOUT"]] as const) {
    const began = Date.now();
    await assert.rejects(selectNormalEmailCode(setup(async () => observed, { budgetMs: 25 })), { code });
    assert(Date.now() - began < 1500);
  }
});
test("hung observation/action and admission expiry cannot hold factor selection open", async () => {
  await assert.rejects(selectNormalEmailCode(setup(() => new Promise(() => undefined), { budgetMs: 30 })), { code: "EMAIL_FACTOR_OBSERVE_TIMEOUT" });
  await assert.rejects(selectNormalEmailCode(setup(async () => state({ emailOptionCount: 1, emailOptionVisible: true }), { budgetMs: 30, chooseEmail: () => new Promise(() => undefined) })), { code: "EMAIL_FACTOR_ACTION_TIMEOUT" });
  let observed = false;
  await assert.rejects(selectNormalEmailCode(setup(async () => { observed = true; return ready(); }, { expiresAt: "2000-01-01T00:00:00Z" })), { code: "EMAIL_FACTOR_INACTIVE" }); assert.equal(observed, false);
  await assert.rejects(selectNormalEmailCode(setup(async () => ready(), { active: () => { throw Error("private account data"); } })), { code: "EMAIL_FACTOR_INACTIVE" });
});
test("observed route/control metadata drops raw URLs, identifiers, values and unknown fields", () => {
  const raw = "user_private secret@example.test sk_test_secret";
  assert.equal(factorRoute(`http://127.0.0.1:49731/sign-in/factor-one?token=${raw}`, "http://127.0.0.1:49731"), "first");
  assert.equal(factorRoute("https://foreign.example/sign-in/factor-one", "http://127.0.0.1:49731"), "outside");
  const safe = safeEmailFactorState({ ...ready(), rawURL: raw, email: raw, passwordValue: raw, anotherMethodCount: 99999 });
  assert.equal(safe.anotherMethodCount, 2); assert(!JSON.stringify(safe).includes(raw));
});

test("only exact semantic headings include hidden matches; interactive method and OTP locators remain visible-only", async () => {
  const { normalEmailControls } = await import("./normal-email-factor");
  const calls: { role: string; options: Record<string, unknown> }[] = [];
  const locator = { or() { return this; } };
  const page = { getByRole(role: string, options: Record<string, unknown>) { calls.push({ role, options }); return locator; }, locator() { return locator; } };
  normalEmailControls(page as never);
  const hidden = calls.filter(call => call.options.includeHidden === true);
  assert.deepEqual(hidden.map(call => [call.role, call.options.name, call.options.exact]), [["heading", "Check your email", true], ["heading", "Use another method", true]]);
  assert(calls.filter(call => call.role !== "heading").every(call => call.options.includeHidden !== true));
  assert.equal(emailFactorDecision(state({ code: false, codeCount: 1, emailPrompt: true }), { opened: false, selected: false }), "wait");
  assert.equal(emailFactorDecision(state({ ...ready(), route: "start" }), { opened: false, selected: false }), "wait");
});
