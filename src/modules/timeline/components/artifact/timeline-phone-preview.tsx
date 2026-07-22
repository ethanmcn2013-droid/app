import type { AudienceTimelineDto } from "@/modules/timeline/lib/audience-timeline";
import { TimelineArtifact } from "./timeline-artifact";
import styles from "./timeline-phone-preview.module.css";

export type TimelinePhonePreviewProps = Readonly<{
  timeline: AudienceTimelineDto;
  className?: string;
  label?: string;
}>;

/**
 * An owner-only responsive preview. It renders the production artifact itself,
 * never a screenshot or a second visual implementation. Tracking belongs to
 * the shared route, so mounting this wrapper cannot create an audience view.
 */
export function TimelinePhonePreview({
  timeline,
  className,
  label = "Phone preview",
}: TimelinePhonePreviewProps) {
  return (
    <section
      className={[styles.preview, className].filter(Boolean).join(" ")}
      aria-label={`${label} of ${timeline.label}`}
      data-timeline-phone-preview
    >
      <header className={styles.previewHeader}>
        <span>{label}</span>
        <span>Live shared view</span>
      </header>
      <div className={styles.device}>
        <span className={styles.speaker} aria-hidden="true" />
        <div className={styles.screen}>
          <TimelineArtifact timeline={timeline} compact />
        </div>
        <span className={styles.homeIndicator} aria-hidden="true" />
      </div>
      <p className={styles.previewNote}>
        This preview uses the same responsive page your guests receive. Previewing it never adds a view.
      </p>
    </section>
  );
}
