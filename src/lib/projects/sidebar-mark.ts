/**
 * The sidebar's status dot: its two kinds and what each is called. Kept
 * apart from the rule that works them out (sidebar-projects.ts) so the
 * browser loads these few lines and none of the model behind them.
 */
export type SidebarProjectMark = "late" | "risk";

export const SIDEBAR_MARK_LABEL: Readonly<Record<SidebarProjectMark, string>> = {
  late: "Past its target date",
  risk: "At risk",
};
