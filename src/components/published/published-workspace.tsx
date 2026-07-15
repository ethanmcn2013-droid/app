import { DefaultTheme } from "./default-theme";
import { WeddingTheme } from "./wedding-theme";
import { FreelanceTheme } from "./freelance-theme";
import { StudentTheme } from "./student-theme";
import { MarketingTheme } from "./marketing-theme";
import { TradesTheme } from "./trades-theme";
import { PublishedFooter } from "./published-footer";
import type { PublishedWorkspaceProps } from "./types";

/**
 * Dispatcher for `/p/{slug}`. Picks the right domain theme based on
 * the workspace's `activeDomain`, falls back to the default theme
 * for workspaces with no domain set. The shared `<PublishedFooter>`
 * always renders after, regardless of theme.
 */
export function PublishedWorkspace(props: PublishedWorkspaceProps) {
  return (
    <>
      {renderTheme(props)}
      <PublishedFooter domain={props.workspace.activeDomain} />
    </>
  );
}

function renderTheme(props: PublishedWorkspaceProps) {
  switch (props.workspace.activeDomain) {
    case "wedding":
      return <WeddingTheme {...props} />;
    case "freelance":
      return <FreelanceTheme {...props} />;
    case "student":
      return <StudentTheme {...props} />;
    case "marketing":
      return <MarketingTheme {...props} />;
    case "trades":
      return <TradesTheme {...props} />;
    default:
      return <DefaultTheme {...props} />;
  }
}
