/**
 * Which publications belong to a project, decided in one place.
 *
 * Three owner surfaces ask this question — the project page (which seeds the
 * artifact header from the latest publication), Preview (which must render the
 * frozen page a guest receives) and the shared-timelines manager. Before this
 * helper the project page used "any publication whose items touch one of this
 * project's nodes" while the manager used "matching projectSlug, or a legacy
 * publication with no projectSlug whose items touch this project". The two
 * disagreed, so a publication could be listed on one screen and invisible to
 * the other. The manager's rule is the correct one and is now the only one.
 *
 * Structural types, not the server type: this file is imported by page loaders
 * only, and keeping it free of `server-only` imports means Preview and Share
 * can share the selection without dragging a server module behind them.
 */

export type ProjectScopedPublication = Readonly<{
  projectSlug: string | null;
  lastUpdatedAt: Date;
  items: ReadonlyArray<Readonly<{ sourceRelation: string }>>;
}>;

export function publicationsForProject<T extends ProjectScopedPublication>(
  publications: readonly T[],
  projectSlug: string,
  projectSourceIds: ReadonlySet<string>,
): T[] {
  return publications.filter(
    (publication) =>
      publication.projectSlug === projectSlug ||
      // Publications minted before publications carried a project slug. They
      // are claimed by the project whose milestones they copied.
      (publication.projectSlug === null &&
        publication.items.some((item) =>
          projectSourceIds.has(item.sourceRelation),
        )),
  );
}

/** Most recently touched publication for the project, or undefined. */
export function latestPublicationForProject<T extends ProjectScopedPublication>(
  publications: readonly T[],
  projectSlug: string,
  projectSourceIds: ReadonlySet<string>,
): T | undefined {
  return publicationsForProject(publications, projectSlug, projectSourceIds).sort(
    (left, right) => right.lastUpdatedAt.getTime() - left.lastUpdatedAt.getTime(),
  )[0];
}
