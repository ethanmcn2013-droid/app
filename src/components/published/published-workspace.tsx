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
  const Theme = pickTheme(props.workspace.activeDomain);
  return (
    <>
      <Theme {...props} />
      <PublishedFooter domain={props.workspace.activeDomain} />
    </>
  );
}

function pickTheme(
  domain: PublishedWorkspaceProps["workspace"]["activeDomain"],
) {
  switch (domain) {
    case "wedding":
      return WeddingTheme;
    case "freelance":
      return FreelanceTheme;
    case "student":
      return StudentTheme;
    case "marketing":
      return MarketingTheme;
    case "trades":
      return TradesTheme;
    default:
      return DefaultTheme;
  }
}
