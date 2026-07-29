import Link from "next/link";
import type { AudienceTimelineDto } from "@/modules/timeline/lib/audience-timeline";
import type { AudienceOwnerPublication } from "@/modules/timeline/server/audience-timeline";
import {
  TimelineArtifact,
  TimelinePhonePreview,
} from "@/modules/timeline/components/artifact";
import { publicationStateLabel } from "@/modules/timeline/lib/format";
import styles from "./artifact-studio.module.css";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function displayDate(value: Date | null): string {
  return value ? DATE_FORMAT.format(value) : "No views yet";
}

export function TimelineArtifactStudio({
  publication,
  timeline,
  managerHref,
}: {
  publication: AudienceOwnerPublication;
  timeline: AudienceTimelineDto;
  managerHref: string;
}) {
  const live = publication.state === "published" && publication.activeShareCount > 0;

  return (
    <div data-timeline-module className={styles.studio}>
      <div className={styles.topline}>
        <Link className={styles.back} href={managerHref}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Shared timelines
        </Link>
        <span className={styles.status} data-live={live ? "true" : undefined}>
          {publicationStateLabel(live ? "published" : publication.state)}
        </span>
      </div>

      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Owner artifact studio</p>
          <h1>See the story they will see.</h1>
        </div>
        <p className={styles.introCopy}>
          This is the standalone experience for anyone holding your link. It
          carries no workspace navigation, private notes or operating controls.
        </p>
      </header>

      <dl className={styles.stats} aria-label="Timeline publication details">
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Timeline views</dt>
          <dd className={styles.statValue}>{publication.qualifiedViewCount.toLocaleString("en-GB")}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Last viewed</dt>
          <dd className={styles.statValue}>{displayDate(publication.lastQualifiedViewAt)}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Milestones shared</dt>
          <dd className={styles.statValue}>{publication.items.filter((item) => item.state !== "cancelled").length}</dd>
        </div>
      </dl>

      <section aria-labelledby="artifact-canvas-heading">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionIndex}>01 · Shared experience</p>
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
          <TimelineArtifact timeline={timeline} embedded />
        </div>
      </section>

      <section className={styles.phoneSection} aria-labelledby="phone-preview-heading">
        <div className={styles.phoneCopy}>
          <p className={styles.sectionIndex}>02 · Phone preview</p>
          <h2 id="phone-preview-heading">The same story, in their hand.</h2>
          <p>
            This is the real responsive artifact, not a screenshot. Scroll it,
            switch the time lens and open milestones exactly as a viewer can.
          </p>
          <p className={styles.phoneNote}>Preview only · this does not add a view</p>
        </div>
        <div className={styles.deviceStage}>
          <TimelinePhonePreview timeline={timeline} label="Viewer phone preview" />
        </div>
      </section>
    </div>
  );
}
