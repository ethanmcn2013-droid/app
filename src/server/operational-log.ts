import {
  isSensitiveFieldName,
  redactSensitiveText,
} from "@/lib/sentry-scrub";

/**
 * The operational log, and what it is not (E08.08).
 *
 * THE TWO LOGS ARE DIFFERENT THINGS
 * ---------------------------------
 * An **audit log** answers "who did what to whose data, when". It is written
 * deliberately, it is retained, it is tamper-evident, and it is evidence. It
 * lives in `workspace_events` in this database and in `entitlement_events` in
 * the shared entitlements database.
 *
 * An **operational log** answers "why did this request fail". It is written
 * incidentally, it is read by one person debugging, it is retained by whoever
 * runs the platform, and nobody governs its lifetime. On Vercel it is held by
 * Vercel; via Sentry it is held by Sentry, in whichever region the project is
 * configured for.
 *
 * The consequence is one rule: **the operational log must never carry couple
 * planning content or personal data.** A wedding workspace routinely contains
 * guests' names, suppliers' names, and — per the shipped template — dietary
 * notes, which are Article 9 special-category data about people who agreed to
 * nothing. None of that can be allowed to leak into a debugging stream nobody
 * has a retention policy for.
 *
 * WHAT THIS MODULE IS
 * -------------------
 * Sentry already applies `scrubEvent` before an event leaves the process. The
 * `console.*` path had no equivalent, so the same string was safe when thrown
 * and unsafe when logged. This module is that equivalent, and
 * `operational-log-contract.test.mjs` is the ratchet that stops a new
 * unreviewed logging site appearing.
 *
 * Two known leaks were closed when this landed, both in this repository:
 *   - `src/app/api/csp-report/route.ts` logged `document-uri` verbatim, so a
 *     CSP violation on a share page wrote `/share/<bearer token>` into the
 *     operational log. Sentry redacts exactly that shape; the console did not.
 *   - `src/server/email.ts` logged the recipient address, the subject line and
 *     the first 120 characters of the body whenever `RESEND_API_KEY` was
 *     unset. That is a configuration state, not an environment, so it could
 *     fire in production.
 */

/** Fields that may appear in an operational log line as-is. */
export type SafeLogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

const EMAIL = /\b[^\s@]+@[^\s@,;]+\.[^\s@,;]+\b/g;

/**
 * Reduce an email address to something that identifies the DOMAIN and nothing
 * else. `alice@glenmara.ie` becomes `<email@glenmara.ie>`. That is enough to
 * debug "did the send go to the right provider" and not enough to identify a
 * person.
 */
export function redactEmail(value: string): string {
  return value.replace(EMAIL, (address) => {
    const domain = address.slice(address.indexOf("@") + 1);
    return `<email@${domain}>`;
  });
}

/**
 * The single sanctioned transform for anything variable that goes into an
 * operational log. Strips provider credential shapes, authorization values,
 * bearer paths, and sensitive query strings (via the same rule Sentry uses),
 * then reduces email addresses to their domain.
 *
 * It does NOT attempt to detect free-text planning content. There is no
 * reliable way to do that, which is why the rule is "never pass content",
 * enforced by review through the contract test, rather than "pass content and
 * hope the filter catches it".
 */
export function redactForLog(value: string): string {
  return redactEmail(redactSensitiveText(value));
}

/**
 * Reduce an unknown thrown value to a log-safe one line. Error messages
 * regularly embed a URL or an address that was passed to a failing client, so
 * the message is redacted rather than trusted.
 */
export function safeError(error: unknown): string {
  if (error instanceof Error) return redactForLog(`${error.name}: ${error.message}`);
  return redactForLog(String(error));
}

/**
 * Write one operational log line.
 *
 * `scope` is a stable label, `fields` are scalars only. The type refuses an
 * object or an array, which is the shape a planning record arrives in, so the
 * common way of leaking content — spreading a row into the log — does not
 * compile.
 */
export function opLog(
  level: "warn" | "error",
  scope: string,
  message: string,
  fields: SafeLogFields = {},
): void {
  const rendered = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      `${redactForLog(key)}=${
        isSensitiveFieldName(key)
          ? "[redacted]"
          : redactForLog(String(value))
      }`,
    )
    .join(" ");
  const line = `[${redactForLog(scope)}] ${redactForLog(message)}${rendered ? ` ${rendered}` : ""}`;
  if (level === "error") console.error(line);
  else console.warn(line);
}
