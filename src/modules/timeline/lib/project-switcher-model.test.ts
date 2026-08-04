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
      "/app/timeline/venue%20launch?workspaceId=workspace-1&planningPeriodId=period-7",
    );
    assert.equal(
      buildTimelineProjectHref(null, {
        workspaceId: "workspace-1",
        planningPeriodId: "period-7",
      }),
      "/app/timeline?workspaceId=workspace-1&planningPeriodId=period-7",
    );
  });

  it("does not carry an orphaned planning-period id", () => {
    assert.equal(
      buildTimelineProjectHref("spring", {
        planningPeriodId: "period-without-workspace",
      }),
      "/app/timeline/spring",
    );
  });

  it("keeps the owner's edit mode when switching projects", () => {
    assert.equal(
      buildTimelineProjectHref("spring", { mode: "edit" }),
      "/app/timeline/spring?mode=edit",
    );
    assert.equal(
      buildTimelineProjectHref("spring", {
        workspaceId: "workspace-1",
        mode: "edit",
      }),
      "/app/timeline/spring?workspaceId=workspace-1&mode=edit",
    );
    // View is the default register and stays out of the URL; the project
    // list (null slug) never carries a mode.
    assert.equal(buildTimelineProjectHref("spring", { mode: "view" }), "/app/timeline/spring");
    assert.equal(buildTimelineProjectHref(null, { mode: "edit" }), "/app/timeline");
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
