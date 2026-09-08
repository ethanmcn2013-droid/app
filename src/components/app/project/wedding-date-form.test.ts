import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { SponsoredWeddingDate } from "@/lib/sponsored-wedding-date";
import type { ProjectOverviewData } from "@/server/actions/project-overview";
let Form: typeof import("./wedding-date-form").WeddingDateForm;
let Overview: typeof import("./project-overview").ProjectOverview;
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  Form = (await import("./wedding-date-form")).WeddingDateForm;
  Overview = (await import("./project-overview")).ProjectOverview;
});
const router = { back() {}, forward() {}, push() {}, replace() {}, refresh() {}, hmrRefresh() {}, prefetch: async () => {} };
const initial: SponsoredWeddingDate = { projectId: "a", weddingDate: null, revision: 1, canManage: true, access: { status: "active", expiresAt: "2028-03-06T12:00:00Z" } };
const overview: ProjectOverviewData = { workspaceId: "a", slug: "a", displayName: "Our wedding", purpose: null, createdAt: null, ownerUserId: "owner", isOwner: true, members: [], taskStats: { total: 0, complete: 0, overdue: 0, undated: 0, progressPct: 0 }, milestones: [], recentEvents: [], declaredStatus: null, targetDate: "2028-12-12", program: null, sponsoredWeddingDate: initial };
function render(element: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, element));
}
test("missing canonical date stays blank with explicit fallback; old target is a separate non-editable historical value", () => {
  const html = render(createElement(Overview, { data: overview }));
  assert.match(html, /548 days from redemption/);
  assert.match(html, /type="date"[^>]*value=""/);
  assert.match(html, /Previous project target:/);
  assert.match(html, /separate from your wedding date and is not used for sponsored access/);
  assert.doesNotMatch(html, /Set target date/);
  assert.match(html, /Existing task dates stay as you set them/);
});
test("earlier dates and unknown dates do not promise shorter access; recipients see their own term", () => {
  const html = render(createElement(Form, { initial, previousTarget: null }));
  assert.match(html, /Moving the date earlier or clearing it does not shorten access already granted/);
  assert.match(html, /Your sponsored access is available until 6 March 2028/);
});
test("expired, revoked and another member's access have distinct truthful copy", () => {
  for (const status of ["expired", "revoked", "none"] as const) {
    const html = render(createElement(Form, { initial: { ...initial, access: { status, expiresAt: status === "expired" ? "2021-07-02T00:00:00Z" : null } }, previousTarget: null }));
    assert.doesNotMatch(html, /Your sponsored access is available until/);
    if (status === "expired") assert.match(html, /Saving a later wedding date may extend it/);
    if (status === "revoked") assert.match(html, /Changing the wedding date will not restore it/);
    if (status === "none") assert.match(html, /No sponsored access is recorded for your account in this project/);
  }
});
test("ordinary editors and archived projects have a read-only date with manager wording", () => {
  const html = render(createElement(Form, { initial: { ...initial, canManage: false }, previousTarget: null }));
  assert.doesNotMatch(html, /<input|<form|Save wedding date/);
  assert.match(html, /Someone who can manage this project/);
});
test("non-sponsored overview retains its existing generic target control", () => {
  const html = render(createElement(Overview, { data: { ...overview, sponsoredWeddingDate: null } }));
  assert.doesNotMatch(html, /Your wedding date|548 days/);
  assert.match(html, /12 Dec 2028/);
});
