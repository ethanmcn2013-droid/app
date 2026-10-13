export type FactorRoute = "start" | "first" | "second" | "trust" | "reset" | "protect" | "unsupported" | "outside";
import type { Page } from "@playwright/test";
export type EmailFactorState = { route: FactorRoute; code: boolean; codeCount: number; emailPrompt: boolean; emailOptionCount: number; emailOptionVisible: boolean; anotherMethodCount: number; anotherMethodVisible: boolean; password: boolean; alternatives: boolean };
// English labels from the pinned official Clerk UI/localization source cited
// in README. No generic "send code", password/reset, SMS or MFA selector.
export function normalEmailControls(page: Page) {
  return { "choose-code": page.getByRole("button", { name: /^Email code to .+/i }), code: page.locator('input[autocomplete="one-time-code"]').or(page.getByRole("textbox", { name: "Enter verification code", exact: true })), "another-method": page.getByRole("link", { name: "Use another method", exact: true }), password: page.locator('input[type="password"]'), "email-prompt": page.getByRole("heading", { name: "Check your email", exact: true, includeHidden: true }), "alternative-menu": page.getByRole("heading", { name: "Use another method", exact: true, includeHidden: true }) };
}
export const EMAIL_FACTOR_CODES = ["EMAIL_FACTOR_TIMEOUT", "EMAIL_FACTOR_NOT_OFFERED", "EMAIL_FACTOR_PASSWORD_ONLY", "EMAIL_FACTOR_CODE_PURPOSE", "EMAIL_FACTOR_UNSUPPORTED_ROUTE", "EMAIL_FACTOR_AMBIGUOUS", "EMAIL_FACTOR_OBSERVE_TIMEOUT", "EMAIL_FACTOR_ACTION_TIMEOUT", "EMAIL_FACTOR_INACTIVE"] as const;
type FailureCode = typeof EMAIL_FACTOR_CODES[number];
export class EmailFactorSelectionError extends Error { constructor(public readonly code: FailureCode) { super(code); this.name = "EmailFactorSelectionError"; } }
export function factorRoute(raw: string, origin: string): FactorRoute {
  try { const url = new URL(raw); if (url.origin !== origin) return "outside";
    const path = url.pathname.replace(/\/$/, "");
    return ({ "/sign-in": "start", "/sign-in/factor-one": "first", "/sign-in/factor-two": "second", "/sign-in/client-trust": "trust", "/sign-in/reset-password": "reset", "/sign-in/protect-check": "protect" } as Record<string, FactorRoute>)[path] ?? "unsupported";
  } catch { return "outside"; }
}
export function safeEmailFactorState(value: unknown): EmailFactorState {
  const state = value as Partial<EmailFactorState> | undefined;
  const cardinality = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 ? Math.min(2, Number(value)) : 0;
  return { route: ["start", "first", "second", "trust", "reset", "protect", "unsupported", "outside"].includes(state?.route ?? "") ? state!.route! : "unsupported", code: state?.code === true, codeCount: Number.isInteger(state?.codeCount) && Number(state?.codeCount) >= 0 ? Math.min(7, Number(state?.codeCount)) : 0, emailPrompt: state?.emailPrompt === true, emailOptionCount: cardinality(state?.emailOptionCount), emailOptionVisible: state?.emailOptionVisible === true, anotherMethodCount: cardinality(state?.anotherMethodCount), anotherMethodVisible: state?.anotherMethodVisible === true, password: state?.password === true, alternatives: state?.alternatives === true };
}
export function emailFactorDecision(state: EmailFactorState, history: { opened: boolean; selected: boolean }): "wait" | "ready" | "open-methods" | "choose-email" {
  if (!["first", "start"].includes(state.route)) throw new EmailFactorSelectionError("EMAIL_FACTOR_UNSUPPORTED_ROUTE");
  if (state.route === "start") return "wait";
  if (state.emailOptionCount > 1 || state.anotherMethodCount > 1 || (state.code && (state.password || ![1, 6].includes(state.codeCount)))) throw new EmailFactorSelectionError("EMAIL_FACTOR_AMBIGUOUS");
  if (state.code) return state.emailPrompt ? "ready" : "wait";
  if (state.emailOptionVisible && state.emailOptionCount === 1 && !history.selected) return "choose-email";
  if (state.anotherMethodVisible && state.anotherMethodCount === 1 && !history.opened && !history.selected) return "open-methods";
  return "wait";
}

/** Only ordinary offered first-factor email-code UI. One menu open and one
 * email-option click maximum; never password/reset/resend/second-factor work. */
export async function selectNormalEmailCode(options: { expiresAt: string; active: () => void; observe: () => Promise<unknown>; openMethods: (timeoutMs: number) => Promise<void>; chooseEmail: (timeoutMs: number) => Promise<void>; onState?: (state: EmailFactorState) => void; budgetMs?: number; pollMs?: number }) {
  const start = performance.now(), budget = Math.max(0, Math.min(options.budgetMs ?? 30000, Date.parse(options.expiresAt) - Date.now()));
  if (!Number.isFinite(budget) || budget <= 0) throw new EmailFactorSelectionError("EMAIL_FACTOR_INACTIVE");
  const remaining = () => Math.max(0, budget - (performance.now() - start));
  const history = { opened: false, selected: false };
  let state = safeEmailFactorState(undefined), previous = "";
  const active = () => { try { options.active(); } catch { throw new EmailFactorSelectionError("EMAIL_FACTOR_INACTIVE"); } };
  const bounded = async <T>(action: () => Promise<T>, ms: number, code: FailureCode) => { let timer: ReturnType<typeof setTimeout> | undefined; try { return await Promise.race([action(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new EmailFactorSelectionError(code)), Math.max(1, ms)); })]); } finally { if (timer) clearTimeout(timer); } };
  while (remaining() > 0) {
    active();
    state = safeEmailFactorState(await bounded(options.observe, Math.min(500, remaining()), "EMAIL_FACTOR_OBSERVE_TIMEOUT"));
    const serialized = JSON.stringify(state); if (serialized !== previous) { options.onState?.(state); previous = serialized; }
    active(); if (remaining() <= 0) break;
    const decision = emailFactorDecision(state, history);
    if (decision === "ready") return state;
    if (decision === "open-methods" || decision === "choose-email") {
      const timeout = Math.max(1, Math.min(2000, remaining()));
      await bounded(() => decision === "open-methods" ? options.openMethods(timeout) : options.chooseEmail(timeout), timeout, "EMAIL_FACTOR_ACTION_TIMEOUT");
      if (decision === "open-methods") history.opened = true; else history.selected = true;
    }
    else await new Promise(resolve => setTimeout(resolve, Math.min(options.pollMs ?? 100, remaining())));
  }
  throw new EmailFactorSelectionError(state.code && !state.emailPrompt ? "EMAIL_FACTOR_CODE_PURPOSE" : state.password && !state.anotherMethodVisible && !state.emailOptionVisible ? "EMAIL_FACTOR_PASSWORD_ONLY" : state.alternatives && !state.emailOptionVisible ? "EMAIL_FACTOR_NOT_OFFERED" : "EMAIL_FACTOR_TIMEOUT");
}
