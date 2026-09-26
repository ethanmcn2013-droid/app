import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import { CONCEPTS } from "@/components/concepts/registry";
import styles from "@/components/concepts/gallery.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Concepts · Signal Studio", robots: { index: false } };

const VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "projects", label: "Projects" },
  { key: "files", label: "Files" },
  { key: "board", label: "Tasks board" },
  { key: "list", label: "Tasks list" },
  { key: "calendar", label: "Tasks calendar" },
] as const;

/** Review-only gallery of the five concepts for each view. */
export default function ConceptsGallery() {
  if (!isDemoMode()) notFound();
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Concepts</h1>
        <p className={styles.subtitle}>Five directions for each view. Open one, then pick your favourites to refine.</p>
        {VIEWS.map((view) => (
          <section key={view.key} className={styles.section} aria-labelledby={`c-${view.key}`}>
            <h2 id={`c-${view.key}`} className={styles.sectionTitle}>{view.label}</h2>
            <ul className={styles.grid}>
              {CONCEPTS.filter((concept) => concept.view === view.key).map((concept) => (
                <li key={concept.n}>
                  <Link href={`/app/concepts/${concept.view}/${concept.n}`} className={styles.card}>
                    <span className={styles.shot}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/concepts/${concept.view}-${concept.n}.png`} alt="" loading="lazy" />
                    </span>
                    <span className={styles.number}>{view.label} {concept.n}</span>
                    <span className={styles.cardTitle}>{concept.title}</span>
                    <span className={styles.thesis}>{concept.thesis}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
