import {
  HOME_APP_PATH,
  PRODUCT_APP_PATHS,
  PROJECT_APP_PATH,
} from "@/lib/product-urls";

/** The four everyday destinations. Notes remains available under More. */
export const CORE_DESTINATIONS = [
  { id: "home", label: "Home", path: HOME_APP_PATH },
  { id: "project", label: "Projects", path: PROJECT_APP_PATH },
  { id: "tasks", label: "Tasks", path: PRODUCT_APP_PATHS.tasks },
  { id: "timeline", label: "Timeline", path: PRODUCT_APP_PATHS.timeline },
] as const;

export type CoreDestinationId = (typeof CORE_DESTINATIONS)[number]["id"];

function owns(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function activeCoreDestination(pathname: string): CoreDestinationId | null {
  if (owns(pathname, PROJECT_APP_PATH)) return "project";
  if (owns(pathname, HOME_APP_PATH)) return "home";
  if (owns(pathname, PRODUCT_APP_PATHS.timeline)) return "timeline";
  if (owns(pathname, PRODUCT_APP_PATHS.tasks) || owns(pathname, "/app/task")) return "tasks";
  return null;
}
