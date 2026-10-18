import type { AudienceTimelineDto } from "../../lib/audience-timeline";
import { master3ConfirmationSubject, master3TimelineTitle } from "../../lib/master3-labels";
import { buildMaster3Model, type Master3Model } from "./master3-model";

const shortDate = (date: string) => new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
}).format(new Date(`${date}T12:00:00Z`)).replace(",", "");

/** Public schedule wording only. This is never a receipt that an email was sent. */
export function master3FollowCopy(timeline?: AudienceTimelineDto, suppliedModel?: Master3Model) {
  if (!timeline) return {
    offer: "updates" as "updates" | "photos" | null,
    invitation: "Get an email when there’s news.", buttonLabel: "Follow",
    confirmationSubject: "Confirm your updates", sender: "Signal",
    nextEmail: "Updates follow the dates on this timeline.", closedText: null as string | null,
  };
  const model = suppliedModel ?? buildMaster3Model(timeline);
  const p = model.presentation, owner = master3TimelineTitle(timeline);
  const weddingAfter = model.after && (timeline.audienceKind === "couple" || p.market === "wedding");
  // The wedding closes ordinary updates after its real final date, even if
  // the public projection contains a later For you date. Photos are separate.
  const reminders = weddingAfter ? [] : model.reminders;
  const photoOffer = model.after && p.afterFollow === true && !p.photosUrl;
  const remainingPost = reminders.find(reminder => reminder.kind === "post-final");
  const postDatesLeft = !weddingAfter && (p.market === "launch" || p.market === "school") &&
    model.postFinal.some(item => !item.datePassed && item.sourceState !== "covered");
  const closed = model.after && !photoOffer && !postDatesLeft;
  const offer = model.duringNow || closed || (model.after && !!p.photosUrl)
    ? null : photoOffer ? "photos" : "updates";
  const next = reminders[0];
  const reminderTitle = next?.milestoneId
    ? model.milestones.find(item => item.publicId === next.milestoneId)?.title : undefined;
  const what = next?.kind === "final"
    ? next.daysBefore === 30 ? "One month to go" : next.daysBefore === 7 ? "One week to go" : "One day to go"
    : reminderTitle ? `${reminderTitle} reminder` : "A timeline reminder";
  const nextEmail = model.noDates ? `Next email: when ${owner} add the dates.`
    : photoOffer ? "Next email: when the photos are up."
    : next ? `Next email: ${what}, ${next.date === model.today ? "today" : shortDate(next.date)}.`
    : "No more emails are scheduled.";
  const postTitle = remainingPost?.milestoneId
    ? model.milestones.find(item => item.publicId === remainingPost.milestoneId)?.title : undefined;
  const defaultPitch = model.noDates ? `Get an email when ${owner} add the dates.`
    : photoOffer ? `Get one email when ${owner} add the photos. Nothing else after that.`
    : model.after && postTitle ? `Get a reminder before ${postTitle}.`
    : model.after && postDatesLeft ? "Get an email when the remaining dates change."
    : reminders.some(reminder => reminder.kind === "for-you")
      ? "Get a reminder before anything you need to do, and news as it happens."
      : "Get an email when there’s news.";
  return {
    offer, invitation: p.pitch || defaultPitch,
    buttonLabel: photoOffer ? "Email me the photos" : "Follow",
    confirmationSubject: master3ConfirmationSubject(timeline), sender: `${owner} via Signal`, nextEmail,
    closedText: !model.duringNow && closed
      ? p.photosUrl ? "The photos are available. No more emails are scheduled." : "The final date has passed. No more emails are scheduled."
      : null,
  };
}

/** Matches the server's address shape; the server remains authoritative. */
export function master3FollowEmailError(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  return email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) && !/[\r\n]/.test(email)
    ? null : "Enter a valid email address.";
}
