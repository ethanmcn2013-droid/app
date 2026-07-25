import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTimelineProjectHref,
  toAuthorizedProjectOptions,
} from "./project-switcher-model";

describe("Timeline project switcher model", () => {
  it("preserves validated workspace and planning-period context", () => {
    assert.equal(
      buildTimelineProjectHref("venue launch", {
        workspaceId: "workspace-1",
        planningPeriodId: "period-7",
      }),
      "/app/plan/venue%20launch?workspaceId=workspace-1&planningPeriodId=period-7",
    );
    assert.equal(
      buildTimelineProjectHref(null, {
        workspaceId: "workspace-1",
        planningPeriodId: "period-7",
      }),
      "/app/plan?workspaceId=workspace-1&planningPeriodId=period-7",
    );
  });

  it("does not carry an orphaned planning-period id", () => {
    assert.equal(
      buildTimelineProjectHref("spring", {
        planningPeriodId: "period-without-workspace",
      }),
      "/app/plan/spring",
    );
  });

  it("exposes projects from the authorised workspace only", () => {
    const options = toAuthorizedProjectOptions(
      [
        { workspaceSlug: "allowed", slug: "a", name: "Project A" },
        { workspaceSlug: "other", slug: "private", name: "Private project" },
        { workspaceSlug: "allowed", slug: "b", name: "Project B" },
      ],
      "allowed",
    );

    assert.deepEqual(options, [
      { slug: "a", name: "Project A" },
      { slug: "b", name: "Project B" },
    ]);
  });
});
