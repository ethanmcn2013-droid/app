export const SIGN_IN_STEPS = ["context", "page", "goto", "identifier", "continue", "choose-code", "code-visible", "code-fill", "redirect", "own-project-navigation", "own-project-get", "identity", "own-project-ui"] as const;
type Step = typeof SIGN_IN_STEPS[number];
export const SELECTORS = ["identifier", "continue", "choose-code", "code"] as const;
type OriginClass = "local" | "clerk-issuer" | "clerk-allowed" | "external" | "opaque" | "invalid";
type PageClass = "sign-in" | "tasks" | "app-other" | "other" | "unavailable";
type SelectorState = { count: number | null; visible: boolean | null };
export type SignInPageState = { origin: OriginClass; page: PageClass; selectors: Record<typeof SELECTORS[number], SelectorState> };
const FAILURE_CODES = ["ERR_ABORTED", "ERR_FAILED", "ERR_BLOCKED_BY_CLIENT", "ERR_NAME_NOT_RESOLVED", "ERR_CONNECTION_RESET", "ERR_CONNECTION_REFUSED", "ERR_TIMED_OUT", "ERR_CERT_AUTHORITY_INVALID", "ERR_HTTP_RESPONSE_CODE_FAILURE", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ERR_ASSERTION"];
const ERROR_NAMES = ["Error", "TimeoutError", "AbortError", "TypeError", "ReferenceError", "SyntaxError", "AssertionError"];
const safeCode = (value: unknown) => typeof value === "string" && FAILURE_CODES.includes(value) ? value : undefined;
export function safeSignInError(error: unknown) {
  const e = error as { name?: unknown; code?: unknown; cause?: { code?: unknown } };
  return { name: ERROR_NAMES.includes(String(e?.name)) ? String(e?.name) : "Error", code: safeCode(e?.code), causeCode: safeCode(e?.cause?.code) };
}
const status = (value: unknown) => Number.isInteger(value) && Number(value) >= 100 && Number(value) <= 599 ? Number(value) : undefined;
const count = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 ? Math.min(50, Number(value)) : null;
const emptySelectors = () => Object.fromEntries(SELECTORS.map(name => [name, { count: null, visible: null }])) as SignInPageState["selectors"];
const sanitizeState = (value: unknown): SignInPageState | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as SignInPageState;
  const origin: OriginClass = ["local", "clerk-issuer", "clerk-allowed", "external", "opaque", "invalid"].includes(raw.origin) ? raw.origin : "invalid";
  const page: PageClass = ["sign-in", "tasks", "app-other", "other", "unavailable"].includes(raw.page) ? raw.page : "unavailable";
  const selectors = emptySelectors();
  for (const name of SELECTORS) selectors[name] = { count: count(raw.selectors?.[name]?.count), visible: typeof raw.selectors?.[name]?.visible === "boolean" ? raw.selectors[name].visible : null };
  return { origin, page, selectors };
};

/** Fixed-schema metadata only. No raw URL, error message, DOM, console text,
 * identifier or response body can enter a persisted snapshot. */
export function signInDiagnostics(localOrigin: string, issuer: string, allowedOrigins: string[], persist: (snapshot: unknown) => void, clock = () => performance.now()) {
  const started = clock(), startedAt = new Date().toISOString();
  const steps: object[] = [], network: object[] = [], browser: object[] = [];
  const dropped = { steps: 0, network: 0, browser: 0 };
  let currentStep: Step | null = null;
  const elapsed = () => Math.max(0, Math.min(3600000, Math.floor(clock() - started) || 0));
  const originClass = (raw: string): OriginClass => { try { const url = new URL(raw); return url.origin === localOrigin ? "local" : url.origin === issuer ? "clerk-issuer" : allowedOrigins.includes(url.origin) ? "clerk-allowed" : url.origin === "null" ? "opaque" : "external"; } catch { return "invalid"; } };
  const pageState = (raw: string, selectors: Partial<Record<typeof SELECTORS[number], Partial<SelectorState>>> = {}): SignInPageState => {
    const origin = originClass(raw); let page: PageClass = "unavailable";
    if (origin === "local") { const path = new URL(raw).pathname; page = path === "/sign-in" || path.startsWith("/sign-in/") ? "sign-in" : path === "/app/tasks" ? "tasks" : /^\/app(?:\/|$)/.test(path) ? "app-other" : "other"; }
    const safe = emptySelectors();
    for (const name of SELECTORS) safe[name] = { count: count(selectors[name]?.count), visible: typeof selectors[name]?.visible === "boolean" ? selectors[name]!.visible! : null };
    return { origin, page, selectors: safe };
  };
  const snapshot = () => structuredClone({ version: 1, startedAt, elapsedMs: elapsed(), currentStep, steps, network, browser, dropped });
  const add = (channel: keyof typeof dropped, entry: object) => {
    const target = { steps, network, browser }[channel], cap = { steps: 48, network: 96, browser: 24 }[channel];
    if (target.length < cap) { target.push(entry); if (Buffer.byteLength(JSON.stringify(snapshot(), null, 2)) > 63 * 1024) { target.pop(); dropped[channel] = Math.min(1000000000, dropped[channel] + 1); } }
    else dropped[channel] = Math.min(1000000000, dropped[channel] + 1);
    persist(snapshot());
  };
  return {
    pageState, snapshot,
    network(kind: "response" | "request-failed" | "blocked", rawUrl: string, resource: string, detail?: unknown) {
      if (!["response", "request-failed", "blocked"].includes(kind)) throw new Error("Unknown network diagnostic kind");
      const resourceClass = ["document", "script", "xhr", "fetch", "image", "font", "stylesheet"].includes(resource) ? resource : "other";
      const failure = typeof detail === "string" ? safeCode(detail.match(/(?:^|net::)(ERR_[A-Z0-9_]+)\b/)?.[1]) : undefined;
      add("network", { elapsedMs: elapsed(), step: currentStep, kind, origin: originClass(rawUrl), resource: resourceClass, status: kind === "response" ? status(detail) : undefined, code: failure });
    },
    browser(kind: "page-error" | "console-error" | "console-warning", error?: unknown) { if (!["page-error", "console-error", "console-warning"].includes(kind)) throw new Error("Unknown browser diagnostic kind"); add("browser", { elapsedMs: elapsed(), step: currentStep, kind, ...(kind === "page-error" ? { error: safeSignInError(error) } : {}) }); },
    async step<T>(name: Step, action: () => Promise<T>, sample?: () => Promise<SignInPageState>, responseStatus?: () => unknown): Promise<T> {
      if (!SIGN_IN_STEPS.includes(name)) throw new Error("Unknown sign-in diagnostic step");
      currentStep = name; const began = elapsed(); add("steps", { step: name, phase: "begin", elapsedMs: began });
      const capture = async () => {
        if (!sample) return undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try { return sanitizeState(await Promise.race([sample(), new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), 500); })])); }
        catch { return undefined; } finally { if (timer) clearTimeout(timer); }
      };
      try { const result = await action(); add("steps", { step: name, phase: "pass", elapsedMs: elapsed(), durationMs: elapsed() - began, state: await capture(), status: status(responseStatus?.()) }); return result; }
      catch (error) { add("steps", { step: name, phase: "fail", elapsedMs: elapsed(), durationMs: elapsed() - began, error: safeSignInError(error), state: await capture(), status: status(responseStatus?.()) }); throw error; }
    },
  };
}
