import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./db/timeline-schema";
import { calendarDateInTimeZone, endOfCalendarDayInZone } from "../lib/audience-timeline";
import { validateMaster3ProjectSettings } from "../lib/master3-presentation";

type Database = LibSQLDatabase<typeof schema>;
type Executor = Pick<Database, "select" | "insert" | "update" | "run">;
type Kind = typeof schema.timelineGuestDeliveries.$inferSelect.kind;
type Recipient = { subscription: typeof schema.timelineGuestSubscriptions.$inferSelect;
  publication: typeof schema.timelinePublications.$inferSelect };
export type GuestNotificationMessage = Readonly<{ to: string; subject: string; text: string; html: string }>;
export type GuestNotificationTransport = Readonly<{ configured: boolean;
  send(message: GuestNotificationMessage): Promise<{ state: "sent" | "failed" | "unknown"; providerMessageId?: string }> }>;
export type GuestNotificationLinks = Readonly<{ deliveryLink(input: {
  subscriptionId: string; purpose: "view" | "unsubscribe"; expiresAt: Date;
}): string }>;
export type GuestNotificationAuthorization = (input: {
  subscriptionId: string; publicationId: string; shareTokenHash: string; now: Date;
}) => Promise<boolean>;
const { timelineGuestSubscriptions: subscriptions, timelineGuestDeliveries: deliveries,
  timelinePublications: publications, audienceShares: shares, timelinePublicationItems: items,
  timelinePublicationPresentation: presentations } = schema;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const reminderKinds = new Set<Kind>(["final30", "final7", "final1", "foryou7"]);
const keyFor = (subscriptionId: string, publicationId: string, kind: Kind, event: string) =>
  `${digest(["timeline.guest.delivery.v1", publicationId, kind, event])}:${subscriptionId}`;

async function recipients(executor: Executor, now: Date, publicationId: string, subscriptionId: string): Promise<Recipient[]> {
  return executor.select({ subscription: subscriptions, publication: publications }).from(subscriptions)
    .innerJoin(publications, eq(publications.id, subscriptions.publicationId))
    .innerJoin(shares, and(eq(shares.publicationId, publications.id), eq(shares.tokenHash, subscriptions.shareTokenHash)))
    .where(and(eq(subscriptions.state, "confirmed"), isNotNull(subscriptions.confirmedAt),
      eq(subscriptions.deliveryState, "sent"), eq(publications.state, "published"), eq(shares.state, "active"),
      or(isNull(shares.expiresAt), gt(shares.expiresAt, now)), eq(publications.id, publicationId), eq(subscriptions.id, subscriptionId))).limit(1);
}

// SQL fan-out keeps a large confirmed audience complete without loading emails
// or silently truncating followers. The unique key makes every rerun inert.
async function insertForPublication(executor: Executor, input: { publicationId: string; kind: Kind; event: string;
  dueAt: Date; now: Date; reminder?: boolean }) {
  const prefix = `${digest(["timeline.guest.delivery.v1", input.publicationId, input.kind, input.event])}:`;
  const nowSeconds = Math.floor(input.now.getTime() / 1000), dueSeconds = Math.floor(input.dueAt.getTime() / 1000);
  const result = await executor.run(sql`INSERT INTO timeline_guest_deliveries
    (id,subscription_id,publication_id,kind,dedupe_key,due_at,status,created_at)
    SELECT lower(hex(randomblob(16))),s.id,s.publication_id,${input.kind},${prefix}||s.id,${dueSeconds},'pending',${nowSeconds}
    FROM timeline_guest_subscriptions s JOIN timeline_publications p ON p.id=s.publication_id
    JOIN audience_shares a ON a.publication_id=p.id AND a.token_hash=s.share_token_hash
    WHERE p.id=${input.publicationId} AND p.state='published' AND s.state='confirmed' AND s.confirmed_at IS NOT NULL
      AND s.delivery_state='sent' AND a.state='active' AND (a.expires_at IS NULL OR a.expires_at>${nowSeconds})
      AND (${!input.reminder} OR s.confirmed_at<=${dueSeconds}) ON CONFLICT(dedupe_key) DO NOTHING`);
  return result.rowsAffected;
}

/** Invoke only inside the owner's explicit published mutation transaction. No preview hook. */
export async function enqueuePublishedGuestUpdate(executor: Executor, input: {
  publicationId: string; kind: "update" | "date_change" | "photos"; eventKey: string; now?: Date;
}) {
  if (!input.eventKey || input.eventKey.length > 512 || !["update", "date_change", "photos"].includes(input.kind))
    throw new TypeError("Invalid publication notification event");
  const now = input.now ?? new Date();
  return insertForPublication(executor, { ...input, event: input.eventKey, dueAt: now, now });
}

function dayOffset(day: string, offset: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) ||
    new Date(day).toISOString().slice(0, 10) !== day) throw new TypeError("Invalid reminder date");
  const result = new Date(`${day}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}
type Reminder = { kind: Kind; event: string; day: string; dueAt: Date };
async function reminders(executor: Executor, publication: Recipient["publication"]): Promise<Reminder[]> {
  const [snapshot] = await executor.select().from(presentations).where(eq(presentations.publicationId, publication.id));
  const settings = validateMaster3ProjectSettings(snapshot?.settingsJson ?? {});
  const publicItems = (await executor.select().from(items).where(eq(items.publicationId, publication.id)))
    .filter(item => item.state !== "cancelled" && item.unpublishedAt === null);
  const explicitFinal = publicItems.filter(item => settings.items?.[item.publicId]?.final === true);
  if (explicitFinal.length > 1) throw new TypeError("Ambiguous final reminder");
  const dated = publicItems.filter(item => item.calendarDate).sort((a, b) =>
    a.calendarDate!.localeCompare(b.calendarDate!) || a.sortOrder - b.sortOrder || a.publicId.localeCompare(b.publicId));
  const final = explicitFinal.length ? { id: explicitFinal[0].publicId, date: explicitFinal[0].calendarDate }
    : publication.primaryDate ? { id: "primary", date: publication.primaryDate }
      : dated.length ? { id: dated[dated.length - 1].publicId, date: dated[dated.length - 1].calendarDate } : null;
  const result: Reminder[] = [];
  const add = (kind: Kind, id: string, date: string, days: number) => {
    const day = dayOffset(date, -days), previous = dayOffset(day, -1);
    result.push({ kind, event: digest([id, date]), day,
      dueAt: new Date(endOfCalendarDayInZone(previous, publication.timezone).getTime() + 1) });
  };
  if (final?.date) for (const days of [30, 7, 1]) add(`final${days}` as Kind, final.id, final.date, days);
  for (const item of dated) if (settings.items?.[item.publicId]?.forYou === true && item.state !== "covered")
    add("foryou7", item.publicId, item.calendarDate!, 7);
  return result;
}

/** Durable future schedules; missed calendar windows are suppressed, not sent with a false day count. */
export async function scheduleGuestReminders(database: Database, now = new Date()) {
  return database.transaction(async tx => {
    const published = await tx.select().from(publications).where(eq(publications.state, "published")).orderBy(asc(publications.id));
    let inserted = 0, unavailablePublications = 0;
    for (const publication of published) {
      let specs: Reminder[], today: string;
      try { today = calendarDateInTimeZone(now, publication.timezone); specs = await reminders(tx, publication); }
      catch { unavailablePublications++; continue; }
      for (const reminder of specs) if (reminder.day >= today)
        inserted += await insertForPublication(tx, { publicationId: publication.id, kind: reminder.kind,
          event: reminder.event, dueAt: reminder.dueAt, now, reminder: true });
    }
    return { inserted, unavailablePublications };
  }, { behavior: "immediate" });
}

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
function message(recipient: Recipient, kind: Kind, links: GuestNotificationLinks, now: Date): GuestNotificationMessage {
  const expiresAt = new Date(now.getTime() + 365 * 86_400_000);
  const view = links.deliveryLink({ subscriptionId: recipient.subscription.id, purpose: "view", expiresAt });
  const unsubscribe = links.deliveryLink({ subscriptionId: recipient.subscription.id, purpose: "unsubscribe", expiresAt });
  for (const link of [view, unsubscribe]) { const url = new URL(link); if (url.protocol !== "https:" || url.username || url.password) throw new Error("guest_link_unavailable"); }
  const label = recipient.publication.label.replace(/[\r\n]/g, " ").slice(0, 240);
  const summary = kind === "date_change" ? "The published date has changed." : kind === "photos" ? "Photos have been added to the published timeline."
    : kind === "foryou7" ? "An item marked For you is seven days away." : kind.startsWith("final") ? `The final date is ${kind.slice(5)} day${kind === "final1" ? "" : "s"} away.`
      : "The published timeline has been updated.";
  const text = `${label}\n\n${summary}\n\nView timeline: ${view}\nUnsubscribe: ${unsubscribe}`;
  return { to: recipient.subscription.email, subject: `${label} · Timeline update`, text,
    html: `<p>${escape(label)}</p><p>${escape(summary)}</p><p><a href="${escape(view)}">View timeline</a></p><p><a href="${escape(unsubscribe)}">Unsubscribe</a></p>` };
}

/** Required real transport gate: the existing no-key dev shim is never a successful delivery. */
export async function createGuestNotificationTransport(port?: {
  emailConfigured: boolean; resend: unknown | null;
  sendEmail(input: GuestNotificationMessage): Promise<{ ok: boolean; id?: string }>;
}): Promise<GuestNotificationTransport> {
  const email = port ?? await import("@/server/email");
  const configured = email.emailConfigured && email.resend !== null;
  return { configured, async send(input) {
    if (!configured) return { state: "failed" };
    const result = await email.sendEmail(input);
    return result.ok && result.id && result.id !== "dev-no-resend" ? { state: "sent", providerMessageId: result.id } : { state: "unknown" };
  } };
}

/** Claim commits before any physical send. Sending/unknown rows are never automatically retried. */
export async function dispatchDueGuestNotifications(input: { database: Database; transport: GuestNotificationTransport;
  links: GuestNotificationLinks; authorize: GuestNotificationAuthorization; now?: Date; clock?: () => Date; limit?: number }) {
  const clock = input.clock ?? (input.now ? () => new Date(input.now!.getTime()) : () => new Date());
  const { database, transport, links } = input, now = clock(), limit = input.limit ?? 20;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !Number.isFinite(now.getTime())) throw new TypeError("Invalid dispatch bound");
  const result = { sent: 0, failed: 0, unknown: 0, suppressed: 0, configured: transport.configured };
  if (!transport.configured) return result;
  // A process lost after its durable claim cannot authorize a replacement send.
  await database.update(deliveries).set({ status: "unknown", lastErrorCode: "interrupted_claim" })
    .where(and(eq(deliveries.status, "sending"), lte(deliveries.claimedAt, new Date(now.getTime() - 10 * 60_000))));
  const due = await database.select({ id: deliveries.id }).from(deliveries)
    .where(and(eq(deliveries.status, "pending"), lte(deliveries.dueAt, now))).orderBy(asc(deliveries.dueAt), asc(deliveries.id)).limit(limit);
  for (const row of due) {
    const attemptId = randomUUID();
    const claimed = await database.transaction(tx => tx.update(deliveries).set({ status: "sending", attemptId, claimedAt: clock() })
      .where(and(eq(deliveries.id, row.id), eq(deliveries.status, "pending"))).returning(), { behavior: "immediate" });
    if (!claimed.length) continue;
    try {
      const candidate = (await recipients(database, clock(), claimed[0].publicationId, claimed[0].subscriptionId))[0];
      // The source-authority resolver can read a different product database;
      // do not recursively use its global Timeline connection inside our writer.
      const authorized = candidate && await input.authorize({ subscriptionId: candidate.subscription.id,
        publicationId: candidate.publication.id, shareTokenHash: candidate.subscription.shareTokenHash, now: clock() });
      // The final writer lock serializes an already-committed unsubscribe against dispatch.
      // The earlier claim remains durable even if this transaction/process is lost.
      const state = await database.transaction(async tx => {
        const delivery = claimed[0];
        const dispatchNow = clock();
        const recipient = (await recipients(tx, dispatchNow, delivery.publicationId, delivery.subscriptionId))[0];
        let allowed = recipient !== undefined && (reminderKinds.has(delivery.kind) ||
          recipient.subscription.confirmedAt!.getTime() <= delivery.createdAt.getTime());
        if (recipient && reminderKinds.has(delivery.kind)) {
          const today = calendarDateInTimeZone(dispatchNow, recipient.publication.timezone);
          allowed = (await reminders(tx, recipient.publication)).some(spec => spec.kind === delivery.kind && spec.day === today &&
            keyFor(recipient.subscription.id, recipient.publication.id, spec.kind, spec.event) === delivery.dedupeKey);
        }
        if (!recipient || !allowed || !authorized) {
          await tx.update(deliveries).set({ status: "suppressed", lastErrorCode: "recipient_unavailable" }).where(eq(deliveries.id, row.id));
          return "suppressed" as const;
        }
        let messageKind = delivery.kind;
        if (messageKind === "photos") {
          const [snapshot] = await tx.select().from(presentations).where(eq(presentations.publicationId, delivery.publicationId));
          if (!validateMaster3ProjectSettings(snapshot?.settingsJson ?? {}).presentation?.photosUrl) messageKind = "update";
        }
        const payload = message(recipient, messageKind, links, dispatchNow);
        let outcome: Awaited<ReturnType<GuestNotificationTransport["send"]>>;
        try { outcome = await transport.send(payload); } catch { outcome = { state: "unknown" }; }
        const sent = outcome.state === "sent" && typeof outcome.providerMessageId === "string" &&
          outcome.providerMessageId.trim().length > 0 && outcome.providerMessageId.length <= 256 && outcome.providerMessageId !== "dev-no-resend";
        const status = sent ? "sent" : outcome.state === "failed" ? "failed" : "unknown";
        await tx.update(deliveries).set({ status, providerMessageId: sent ? outcome.providerMessageId : null,
          sentAt: sent ? clock() : null, failedAt: status === "failed" ? clock() : null,
          lastErrorCode: sent ? null : status === "failed" ? "provider_rejected" : "delivery_unconfirmed" })
          .where(and(eq(deliveries.id, row.id), eq(deliveries.attemptId, attemptId)));
        return status;
      }, { behavior: "immediate" });
      result[state]++;
    } catch {
      // Never replay a claim after a lost provider/result transaction.
      await database.update(deliveries).set({ status: "unknown", lastErrorCode: "dispatch_unconfirmed" })
        .where(and(eq(deliveries.id, row.id), eq(deliveries.attemptId, attemptId), eq(deliveries.status, "sending")));
      result.unknown++;
    }
  }
  return result;
}
