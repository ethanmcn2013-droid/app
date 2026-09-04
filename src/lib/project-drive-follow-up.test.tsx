import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { driveReloadState } from "./project-drive-reload";
import { DriveReloadNotice } from "@/components/app/detail-panel/drive-reload-notice";
import { DriveHandoverView } from "@/components/app/settings/sections/drive-handover-view";
import type { DriveHandoverRead } from "./project-drive-handover-ui";

test("reloaded claims block new intake regardless of file metadata; refresh errors never mean empty", () => {
  const pending = [{ id: "original-claim", storage: "google_drive", accessState: "pending" }];
  assert.equal(driveReloadState(pending, false, []), "pending");
  assert.equal(driveReloadState(pending, false, ["different-claim"]), "pending");
  assert.equal(driveReloadState(pending, false, ["original-claim"]), null, "mounted attempt retains its original File");
  assert.equal(driveReloadState([], true, []), "unavailable");
  assert.equal(driveReloadState(null, false, []), "loading");
  assert.equal(driveReloadState([], false, []), null);
  assert.equal(driveReloadState([{ ...pending[0], accessState: "ok" }], false, []), null);
});

test("reload explanation offers only saved-state refresh, never reselect/resume/remove/native controls", () => {
  const html = renderToStaticMarkup(<DriveReloadNotice state="pending" onRefresh={() => { throw Error("render cannot fetch"); }} />);
  assert.match(html, /contact support to check the upload before trying again/);
  assert.match(html, /does not restart the upload/);
  assert.equal((html.match(/<button/g) || []).length, 1);
  assert.match(html, />Check for updates<\/button>/);
  assert.doesNotMatch(html, /<input|<a |sessionUrl|Use Signal Studio|Remove|Resume upload/);
});

test("handover blocked/error/empty states expose no executable target or misleading success", () => {
  for (const state of ["ready", "needs_attention", "uploads_pending", "not_connected", "archived", "unavailable"] as const) {
    const read: DriveHandoverRead = { state, choices: [], continuation: null };
    const html = renderToStaticMarkup(<DriveHandoverView read={read} busy={false} onSubmit={() => { throw Error("must not dispatch"); }} />);
    assert.doesNotMatch(html, /<button|<select|Confirm owner change|Storage owner changed/);
    assert.match(html, /Existing files stay with their original owner/);
  }
});

test("a choice is not preselected and a journal continuation still requires confirmation", () => {
  const ready = renderToStaticMarkup(<DriveHandoverView read={{ state: "ready", choices: [{ userId: "target", name: "Owner" }], continuation: null }} busy={false} onSubmit={() => {}} />);
  assert.match(ready, /Choose an owner/); assert.doesNotMatch(ready, /Confirm owner change|Review owner change/);
  const saved = renderToStaticMarkup(<DriveHandoverView read={{ state: "in_progress", choices: [], continuation: { userId: "target", name: "Owner" } }} busy={false} onSubmit={() => {}} />);
  assert.match(saved, /Continue saved change/); assert.doesNotMatch(saved, /<select|Confirm owner change/);
});
