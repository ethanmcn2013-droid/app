import "server-only";
import { Resend } from "resend";
import type { DailyDigest } from "@/server/db/daily-digest";
import { APP_DOMAIN, APP_ORIGIN, CONTACT_EMAIL } from "@/lib/product-urls";

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM ?? `Signal Tasks <${CONTACT_EMAIL}>`;
const BCC_DEV = process.env.RESEND_BCC_DEV;

export const resend: Resend | null = KEY ? new Resend(KEY) : null;
export const emailConfigured = Boolean(KEY);

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  /** Optional plain-text fallback. Most modern clients render html
   *  fine but accessibility tooling and some corporate filters drop
   *  HTML-only emails. */
  text?: string;
};

/** Single send entry-point. In dev (no key) it logs to the console
 *  so the action's caller still sees the payload that would have
 *  shipped. In prod, swallows transient errors and returns the id. */
export async function sendEmail(
  args: SendArgs,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!resend) {
    console.warn("[email] not configured, would have sent:", {
      to: args.to,
      subject: args.subject,
      preview: args.text?.slice(0, 120) ?? args.html.slice(0, 120),
    });
    return { ok: true, id: "dev-no-resend" };
  }
  try {
    const res = await resend.emails.send({
      from: FROM,
      to: args.to,
      bcc: BCC_DEV ? [BCC_DEV] : undefined,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    if (res.error) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, id: res.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ────────────────────────────────────────────────────────────────────
// Templates
// ────────────────────────────────────────────────────────────────────

/** Workspace invite email, sent when an owner adds a member by email
 *  through the cycle 17 / cycle 25 invite flow. The recipient clicks
 *  the link to accept and join the workspace. */
export function inviteEmailHtml(input: {
  workspaceName: string;
  inviterName: string;
  acceptUrl: string;
  expiresLabel: string;
}): string {
  const { workspaceName, inviterName, acceptUrl, expiresLabel } = input;
  return `
<!doctype html>
<html><head><meta charset="utf-8"><title>Tasks · invite</title></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:Geist,system-ui,sans-serif;color:#14151a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:48px 24px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
        <tr><td>
          <div style="font-size:14px;letter-spacing:-0.025em;font-weight:600;">tasks<span style="display:inline-block;margin-left:6px;width:8px;height:8px;border-radius:50%;background:#4f46e5;"></span></div>
          <h1 style="font-size:22px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;margin:24px 0 8px;color:#14151a;">${escapeHtml(inviterName)} added you to ${escapeHtml(workspaceName)}.</h1>
          <p style="font-size:15px;line-height:1.55;color:#475569;margin:0 0 24px;">
            One workspace, every view, the daily digest. Three editing guests on Free,
            unlimited members on Team. No card, no trial.
          </p>
          <a href="${acceptUrl}" style="display:inline-block;background:#14151a;color:#ffffff;padding:10px 18px;border-radius:999px;font-size:14px;font-weight:500;text-decoration:none;">Accept invite</a>
          <p style="font-size:12.5px;color:#94a3b8;margin:24px 0 0;">
            Link expires ${escapeHtml(expiresLabel)}. If you didn&rsquo;t expect this email, you can ignore it, nothing happens until you click.
          </p>
        </td></tr>
      </table>
      <p style="font-size:11.5px;color:#94a3b8;margin:24px 0 0;letter-spacing:0.04em;">${APP_DOMAIN} · Made for the 80% who don&rsquo;t work in tech</p>
    </td></tr>
  </table>
</body></html>
`.trim();
}

// Note: `escapeHtml` is declared once near the bottom of this file
// (after the share-link template) and used by all templates here.

/** Daily digest. Mirrors the tone of the in-app inbox: dry, restrained,
 *  no reminders to "be productive." */
export function digestEmailHtml(digest: DailyDigest, recipientName: string): string {
  const completed = digest.completedYesterday
    .slice(0, 6)
    .map((t) => `<li style="margin:0 0 4px"><span style="color:#10b981">✓</span> ${escapeHtml(t.title)}</li>`)
    .join("");
  const due = digest.dueToday
    .slice(0, 6)
    .map((t) => `<li style="margin:0 0 4px">${escapeHtml(t.title)}${t.due ? ` <span style="color:#94a3b8">· ${escapeHtml(t.due)}</span>` : ""}</li>`)
    .join("");
  const mentions = digest.mentions
    .slice(0, 5)
    .map(
      (m) =>
        `<li style="margin:0 0 6px;color:#475569"><strong style="color:#14151a">${escapeHtml(m.fromName)}</strong> on <em>${escapeHtml(m.taskTitle)}</em>: "${escapeHtml(m.snippet)}"</li>`,
    )
    .join("");

  const greeting = recipientName ? `Good morning, ${escapeHtml(recipientName)}.` : "Good morning.";

  return `
<!doctype html>
<html><head><meta charset="utf-8"><title>Tasks · daily digest</title></head>
<body style="margin:0;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14151a;background:#fafafa">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:28px">
    <div style="font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8">Daily digest</div>
    <h1 style="margin:6px 0 4px;font-size:22px;font-weight:600;letter-spacing:-0.01em">${greeting}</h1>
    <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.55">Your one summary for the day. We don't send anything else unless someone tags you directly.</p>

    ${completed ? `<h2 style="margin:18px 0 6px;font-size:13px;font-weight:600;color:#475569">Closed yesterday</h2><ul style="margin:0 0 16px 0;padding-left:18px;font-size:14px;color:#14151a">${completed}</ul>` : ""}
    ${due ? `<h2 style="margin:18px 0 6px;font-size:13px;font-weight:600;color:#475569">Due today</h2><ul style="margin:0 0 16px 0;padding-left:18px;font-size:14px;color:#14151a">${due}</ul>` : '<p style="margin:0 0 16px;color:#94a3b8;font-size:13.5px">Nothing on your plate is due in the next 24 hours.</p>'}
    ${mentions ? `<h2 style="margin:18px 0 6px;font-size:13px;font-weight:600;color:#4f46e5">Mentioned in the last 24h</h2><ul style="margin:0;padding-left:18px;font-size:13.5px;color:#14151a">${mentions}</ul>` : ""}

    <hr style="margin:28px 0;border:0;border-top:1px solid #e5e7eb">
    <p style="margin:0;font-size:11.5px;color:#94a3b8;line-height:1.55">
      Tasks. Anti-spam by design, this is the only scheduled email we send.
      <a href="${APP_ORIGIN}/app/inbox" style="color:#4f46e5;text-decoration:none">Open inbox</a> ·
      <a href="${APP_ORIGIN}/app/settings" style="color:#94a3b8;text-decoration:none">Notification settings</a>
    </p>
  </div>
</body></html>`;
}

/** Student .edu redemption code email. Plain, single CTA. */
export function studentCodeEmailHtml(code: string, redeemUrl: string): string {
  return `
<!doctype html>
<html><body style="margin:0;padding:32px;font-family:-apple-system,sans-serif;color:#14151a;background:#fafafa">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;text-align:center">
    <div style="font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#10b981">Verified student</div>
    <h1 style="margin:6px 0 12px;font-size:22px;font-weight:600">Your free Pro code is ready.</h1>
    <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.55">Pro for the full school year, on us. Click below to redeem.</p>
    <div style="margin:0 0 20px;font-family:'SF Mono','Menlo',monospace;font-size:14px;color:#14151a;background:#f3f4f6;padding:8px 12px;border-radius:8px;display:inline-block">${escapeHtml(code)}</div>
    <div>
      <a href="${escapeHtml(redeemUrl)}" style="display:inline-block;background:#14151a;color:#fff;padding:10px 20px;border-radius:9999px;text-decoration:none;font-size:13.5px;font-weight:500">Redeem now →</a>
    </div>
  </div>
</body></html>`;
}

/** Magic-link share email, owner sends a workspace preview to a guest. */
export function shareLinkEmailHtml(
  workspaceName: string,
  url: string,
  fromName: string,
): string {
  return `
<!doctype html>
<html><body style="margin:0;padding:32px;font-family:-apple-system,sans-serif;color:#14151a;background:#fafafa">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:28px">
    <div style="font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8">Shared with you</div>
    <h1 style="margin:6px 0 8px;font-size:20px;font-weight:600;letter-spacing:-0.01em">${escapeHtml(fromName)} sent you ${escapeHtml(workspaceName)}.</h1>
    <p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.55">No sign-up needed to view. Open the link below to peek; sign up only if you want to comment or edit.</p>
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:9999px;text-decoration:none;font-size:13.5px;font-weight:500">Open the project →</a>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}
