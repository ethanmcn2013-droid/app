export const READINESS_BUDGET_MS = 30000;
type Attempt = { elapsedMs: number; status?: number; redirect?: "same-origin" | "external" | "invalid" | "none"; error?: string; code?: string; causeCode?: string };
type Options = { origin: string; expiresAt: string; child: () => { pid?: number; exitCode: number | null; signalCode?: string | null }; active: () => void; fetch?: typeof fetch; budgetMs?: number; requestMs?: number; intervalMs?: number };
const code = (value: unknown) => typeof value === "string" && /^[A-Z][A-Z0-9_]{0,39}$/.test(value) ? value : undefined;
const safeError = (error: unknown) => {
  const e = error as { name?: unknown; code?: unknown; cause?: { code?: unknown } };
  return { error: ["AbortError", "TimeoutError", "TypeError", "Error"].includes(String(e?.name)) ? String(e?.name) : "Error", ...(code(e?.code) ? { code: code(e?.code) } : {}), ...(code(e?.cause?.code) ? { causeCode: code(e?.cause?.code) } : {}) };
};

/** The request race also bounds a fetch that fails to settle on abort. Never
 * read response bodies, raw errors, headers or redirect targets into evidence. */
export async function waitForProofReadiness(options: Options) {
  const start = Date.now(), deadline = Math.min(start + (options.budgetMs ?? READINESS_BUDGET_MS), Date.parse(options.expiresAt));
  const attempts: Attempt[] = [];
  const childExited = () => options.child().exitCode !== null || !!options.child().signalCode;
  const finish = (ready: boolean, reason: string) => ({ ready, reason, origin: options.origin, path: "/sign-in", elapsedMs: Date.now() - start, budgetMs: deadline - start, attempts, child: options.child() });
  while (Date.now() < deadline) {
    try { options.active(); } catch { return finish(false, "admission-inactive"); }
    if (childExited()) return finish(false, "owned-server-exited");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = Math.max(1, Math.min(options.requestMs ?? 2000, deadline - Date.now()));
      const response = await Promise.race([
        (options.fetch ?? fetch)(`${options.origin}/sign-in`, { redirect: "manual", signal: controller.signal }).then(response => {
          if (controller.signal.aborted) { void response.body?.cancel().catch(() => undefined); throw new DOMException("Readiness timeout", "TimeoutError"); }
          return response;
        }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new DOMException("Readiness timeout", "TimeoutError")); }, timeout); }),
      ]);
      const location = response.headers.get("location");
      let redirect: Attempt["redirect"] = "none";
      if (location) { try { redirect = new URL(location, options.origin).origin === options.origin ? "same-origin" : "external"; } catch { redirect = "invalid"; } }
      attempts.push({ elapsedMs: Date.now() - start, status: response.status, redirect });
      void response.body?.cancel().catch(() => undefined);
      if (response.status === 200 && !location && !childExited() && Date.now() < deadline) {
        try { options.active(); } catch { return finish(false, "admission-inactive"); }
        return finish(true, "sign-in-http-200");
      }
    } catch (error) { attempts.push({ elapsedMs: Date.now() - start, ...safeError(error) }); }
    finally { if (timer) clearTimeout(timer); controller.abort(); }
    if (childExited()) return finish(false, "owned-server-exited");
    const remaining = deadline - Date.now();
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(options.intervalMs ?? 250, remaining)));
  }
  return finish(false, "readiness-deadline");
}
