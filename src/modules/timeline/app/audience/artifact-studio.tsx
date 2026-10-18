"use client";
import Link from "next/link";
import type { AudienceTimelineDto } from "@/modules/timeline/lib/audience-timeline";
import {
  TimelineArtifact,
  TimelinePhonePreview,
} from "@/modules/timeline/components/artifact";
import { effectivePublicationState, publicationStateLabel } from "@/modules/timeline/lib/format";
import type { presentViewerCount } from "@/modules/timeline/lib/viewer-count";
import styles from "./artifact-studio.module.css";

export function TimelineArtifactStudio({
  publication,
  timeline,
  managerHref,
  timelinesHref,
  guestPreviewHref,
  followerCount,
  settingsAvailable,
  saveReferralAction,
}: {
  publication: { state: string; activeShareCount: number; milestoneCount: number; views: ReturnType<typeof presentViewerCount> };
  timeline: AudienceTimelineDto;
  managerHref: string;
  timelinesHref: string;
  guestPreviewHref: string;
  followerCount?: number;
  settingsAvailable: boolean;
  saveReferralAction?: (enabled: boolean) => Promise<void>;
}) {
  function openSettings() {
    const settings = document.getElementById("timeline-presentation-settings");
    if (!(settings instanceof HTMLDetailsElement)) return;
    settings.open = true;
    settings.scrollIntoView({ block: "start", behavior: "instant" });
    settings.querySelector<HTMLElement>("summary")?.focus();
  }
  const live = publication.state === "published" && publication.activeShareCount > 0;
  // Already floor/coarsen the aggregate on the server; do not serialize raw view counts.
  const views = publication.views;

  return (
    <div data-timeline-module className={styles.studio}>
      <div className={styles.topline}>
        <Link className={styles.back} href={managerHref}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Shared pages
        </Link>
        <span className={styles.status} data-live={live ? "true" : undefined}>
          {publicationStateLabel(effectivePublicationState(publication))}
        </span>
      </div>

      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Your shared page</p>
          <h1>Your timeline, with the controls you need.</h1>
        </div>
        <p className={styles.introCopy}>
          Edit the details guests can see, manage sharing and check email followers.
          The phone preview below shows the guest view without owner controls.
        </p>
      </header>

      <dl className={styles.stats} aria-label="Timeline publication details">
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Views</dt>
          {views.state === "shown" ? (
            <dd className={styles.statValue}>
              {views.countLabel}
              {views.lastViewedLabel ? (
                <p className={styles.statNote}>Last opened in {views.lastViewedLabel}.</p>
              ) : null}
            </dd>
          ) : (
            <dd className={styles.statNote}>{views.note}</dd>
          )}
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Milestones shared</dt>
          <dd className={styles.statValue}>{publication.milestoneCount}</dd>
        </div>
      </dl>

      <section aria-labelledby="artifact-canvas-heading">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionIndex}>On a large screen</p>
            <h2 id="artifact-canvas-heading">The full timeline</h2>
          </div>
          <Link className={styles.manageLink} href={managerHref}>
            Manage milestones and link
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className={styles.canvas}>
          <TimelineArtifact timeline={timeline} embedded owner={{
            initial: (timeline.ownerDisplayLabel || timeline.label).slice(0, 1),
            ...(settingsAvailable ? { onEdit: openSettings } : { editHref: managerHref }),
            menu: [...(settingsAvailable ? [{ label: "Timeline details", onSelect: openSettings }] : []), { label: "Preview as guest", href: guestPreviewHref }, { label: "Manage sharing", href: managerHref }, { label: "Your timelines", href: timelinesHref }],
            ...(followerCount !== undefined ? { followerCount } : {}),
            ...(saveReferralAction ? { referral: { enabled: timeline.presentation?.referral !== false, save: saveReferralAction } } : {}),
          }} />
        </div>
      </section>

      <section id="guest-phone-preview" className={styles.phoneSection} aria-labelledby="phone-preview-heading">
        <div className={styles.phoneCopy}>
          <p className={styles.sectionIndex}>On a phone</p>
          <h2 id="phone-preview-heading">The guest view, on a phone.</h2>
          <p>
            This is the responsive guest view. Scroll it and open milestones
            without the owner controls above.
          </p>
          <p className={styles.phoneNote}>Previewing never adds a view.</p>
        </div>
        <div className={styles.deviceStage}>
          <TimelinePhonePreview timeline={timeline} label="Guest phone preview" />
        </div>
      </section>
    </div>
  );
}
