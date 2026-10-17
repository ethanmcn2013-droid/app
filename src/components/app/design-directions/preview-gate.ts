import "server-only";
import { isReviewMode } from "@/lib/access-mode";
import type { DirectionId, ReviewState } from "./data";

type Params = Record<string, string | string[] | undefined>;

/** An explicit local review switch; never widens a real Project's access. */
export function homeProjectsPreview(params: Params): { direction: DirectionId; state: ReviewState } | null {
  if (!isReviewMode() || process.env.SIGNAL_HOME_PROJECTS_REVIEW !== "1") return null;
  const direction = params.design;
  if (direction !== "a" && direction !== "b" && direction !== "c") return null;
  const state = params.state;
  return { direction, state: state === "empty" || state === "partial" || state === "loading" || state === "error" ? state : "busy" };
}
