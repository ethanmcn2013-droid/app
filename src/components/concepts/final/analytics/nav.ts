"use client";

/** How the lenses hand off to each other. */

import { useRouter } from "next/navigation";
import { useInDemo, useSurfaceHref } from "../../demo/links";
import { update, type Lens } from "./store";

/** Move to another lens: follow the URL in the demo, switch in place elsewhere. */
export function useGoLens() {
  const inDemo = useInDemo();
  const href = useSurfaceHref();
  const router = useRouter();
  return (lens: Lens) => {
    window.dispatchEvent(new CustomEvent("analytics:lens", { detail: lens }));
    if (inDemo) router.push(lens === "ask" ? href("analytics") : href("analytics", lens), { scroll: false });
  };
}

/** Hand off to Ask with a question already asked about a project. */
export function askAbout(project: string, qid: string | null, from: string) {
  update({ scope: project, pendingAsk: qid ? { qid, scope: project, from } : null });
}

/** Hand off to Replay on a project, at a day if given. */
export function replayOf(project: string, day?: number) {
  update({ scope: project, pendingReplay: { project, day } });
}
