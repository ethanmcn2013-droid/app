import Link from "next/link";
import { TimelineArtifact } from "@/modules/timeline/components/artifact";
import type { AudienceTimelineDto } from "@/modules/timeline/lib/audience-timeline";
import styles from "./current-project-preview.module.css";

export function CurrentProjectPreviewView({ timeline, backHref }: { timeline: AudienceTimelineDto; backHref: string }) {
  return <section data-timeline-module className={styles.page} aria-label="Current private Timeline preview">
    <header className={styles.header}>
      <div><h1>Private preview</h1><p>The current Timeline plan. This preview does not publish or change any shared page.</p></div>
      <Link href={backHref}>Back to timeline</Link>
    </header>
    <TimelineArtifact timeline={timeline} showProductHeader={false} privatePreview />
  </section>;
}
