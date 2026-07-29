import "@/modules/timeline/timeline.css";

/**
 * Timeline route-group layout. Its only job is loading the module's scoped
 * stylesheet for EVERY timeline route: previously only /app/timeline
 * imported it, so hard loads of /app/timeline/[projectSlug] and the
 * audience surfaces rendered tl-* classes (skeletons, structural motion)
 * unstyled.
 */
export default function TimelineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
