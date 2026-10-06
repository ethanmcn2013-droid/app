/**
 * Ids that tie Home's two tabs to the panel they show. Plain values, so the
 * server-rendered pages and the client tablist can both read them.
 */

export type HomeTab = "home" | "overview";

export const HOME_TABPANEL_ID = "home-view-panel";

export const homeTabId = (tab: HomeTab) => `home-view-tab-${tab}`;
