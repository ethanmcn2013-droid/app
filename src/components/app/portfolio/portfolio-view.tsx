/**
 * All projects: the Timeline front door (v3, round 2).
 *
 * `/app/timeline` (bare, or with only the sidebar's `?workspaceId=`) answers
 * "how is everything going?" before anything else: the title and the view
 * tabs, one sentence, the status chips, then the chart, with its axis high
 * enough that nine rows fit on a laptop screen. The frame renders here; the
 * answer, chips, toolbar and grid are `PortfolioGantt`.
 */

import { portfolioViewFromSearch, type ProjectPortfolio } from "@/lib/projects/project-portfolio";
import { PortfolioEmpty, PortfolioUnavailable } from "./portfolio-empty";
import { PortfolioGantt } from "./portfolio-gantt";
import { TimelineTabs, type SwitcherOption, type TimelineTabProject } from "./timeline-tabs";
import styles from "./portfolio.module.css";

export type PortfolioSearch = Readonly<{ zoom?: string; group?: string; sort?: string; status?: string }>;

export function PortfolioView({
  portfolio,
  openProjectId,
  tabProject,
  plans,
  allHref,
  search,
}: {
  portfolio: ProjectPortfolio;
  openProjectId: string | null;
  /** The Project the second tab names: the last one opened. */
  tabProject: TimelineTabProject | null;
  /** That Project's plans, for the switcher's first section. */
  plans: readonly SwitcherOption[];
  allHref: string;
  search: PortfolioSearch;
}) {
  const rows = portfolio.kind === "ready" ? portfolio.rows : [];
  const openNow = openProjectId && rows.some((row) => row.id === openProjectId) ? openProjectId : null;
  const others: SwitcherOption[] = rows
    .filter((row) => row.href && !row.sample && row.id !== tabProject?.id)
    .slice(0, 12)
    .map((row) => ({ key: `project:${row.id}`, name: row.name, href: row.href!, tile: { id: row.id, monogram: row.monogram } }));

  return (
    <div className={`${styles.page} thin-scroll`} data-timeline-portfolio="">
      <div className={styles.column}>
        <header className={styles.header}>
          <h1 className={styles.title}>Timeline</h1>
          <TimelineTabs
            current="all"
            allHref={allHref}
            project={tabProject}
            sections={[
              { title: tabProject ? `Timelines in ${tabProject.name}` : "Timelines", options: plans },
              { title: "Other projects", options: others },
            ]}
          />
        </header>
        {portfolio.kind === "unavailable" ? <PortfolioUnavailable /> : null}
        {portfolio.kind === "ready" && rows.length === 0 ? <PortfolioEmpty todayIso={portfolio.todayIso} /> : null}
      </div>

      {portfolio.kind === "ready" && rows.length > 0 ? (
        <PortfolioGantt portfolio={portfolio} openProjectId={openNow} initialView={portfolioViewFromSearch(search)} />
      ) : null}
    </div>
  );
}
