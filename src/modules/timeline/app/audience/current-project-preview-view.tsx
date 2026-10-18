"use client";

import Link from "next/link";
import { TimelineArtifact } from "@/modules/timeline/components/artifact";
import type { AudienceTimelineDto } from "@/modules/timeline/lib/audience-timeline";
import styles from "./current-project-preview.module.css";

export function CurrentProjectPreviewView({ timeline, backHref, canEdit = false }: { timeline: AudienceTimelineDto; backHref: string; canEdit?: boolean }) {
  const edit = () => {
    const details = document.getElementById("timeline-presentation-settings");
    if (!(details instanceof HTMLDetailsElement)) return;
    details.open = true;
    details.scrollIntoView({ block: "start" });
    details.querySelector<HTMLElement>('select, input:not([type="hidden"]), textarea')?.focus();
  };
  return <section data-timeline-module className={styles.page} aria-label="Current private Timeline preview">
    <header className={styles.header}>
      <div><h1>Private preview</h1><p>The current Timeline plan. This preview does not publish or change any shared page.</p></div>
      <Link href={backHref}>Back to timeline</Link>
    </header>
    <TimelineArtifact timeline={timeline} showProductHeader={false} privatePreview
      owner={canEdit ? { onEdit: edit } : undefined} />
  </section>;
}
