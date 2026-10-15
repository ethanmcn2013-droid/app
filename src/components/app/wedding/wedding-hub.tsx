import Link from "next/link";
import styles from "./wedding-hub.module.css";

export type WeddingHubProject = Readonly<{
  id: string;
  name: string;
  href: string;
}>;

/** A directory for the Wedding work that exists today. Guest lists lead to
 * the established, project-authorized guest route; future tools stay static. */
export function WeddingHub({
  projects,
  available = true,
}: {
  projects: readonly WeddingHubProject[];
  available?: boolean;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Wedding hub</h1>
            <p className={styles.intro}>Guest lists for the wedding Projects you can open.</p>
          </div>
          <Link href="/app/project" className={styles.projectsLink}>
            Choose or create a Project
          </Link>
        </header>

        <div className={styles.content}>
          <section className={styles.projects} aria-labelledby="wedding-projects-title">
            <div className={styles.sectionHeading}>
              <h2 id="wedding-projects-title">Your wedding Projects</h2>
              {available && projects.length > 0 ? <span>{projects.length}</span> : null}
            </div>

            {!available ? (
              <div className={styles.empty} role="status">
                <h3>Projects aren’t available right now</h3>
                <p>Try again in a moment, or open Projects to choose a wedding.</p>
                <Link href="/app/project" className={styles.recoveryLink}>Open Projects</Link>
              </div>
            ) : projects.length > 0 ? (
              <ul className={styles.projectList}>
                {projects.map((project) => (
                  <li key={project.id}>
                    <Link href={project.href} className={styles.projectLink}>
                      <span className={styles.projectText}>
                        <span className={styles.projectName}>{project.name}</span>
                        <span className={styles.projectAction}>Open guest list</span>
                      </span>
                      <svg className={styles.chevron} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="m7.5 4.5 5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.empty}>
                <h3>No wedding Projects yet</h3>
                <p>Choose a wedding Project you can open, or create one in Projects.</p>
                <Link href="/app/project" className={styles.recoveryLink}>Go to Projects</Link>
              </div>
            )}
          </section>

          <section className={styles.coming} aria-labelledby="wedding-coming-title">
            <h2 id="wedding-coming-title">More planning tools</h2>
            <p>The guest list is ready. These tools are still being built.</p>
            <ul>
              <li><span>Seating</span><span className={styles.soon}>Coming soon</span></li>
              <li><span>Budget</span><span className={styles.soon}>Coming soon</span></li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
