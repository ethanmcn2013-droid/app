import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url).pathname.replace(/^\//, "").replaceAll("/", "\\");
const read = (relative) => fs.readFileSync(`${root}${relative}`, "utf8");

test("destructive workspace mutations require the server-side owner boundary", () => {
  const settings = read("src\\server\\actions\\settings.ts");
  const seed = read("src\\server\\actions\\seed.ts");
  assert.match(settings, /updateWorkspaceAction[\s\S]*requireActiveWorkspaceOwner/);
  assert.match(seed, /clearAllTasksAction[\s\S]*requireActiveWorkspaceOwner/);
  assert.match(seed, /seedDomainAction[\s\S]*requireActiveWorkspaceOwner/);
});

test("pending invite listing is an owner-only safe projection", () => {
  const settings = read("src\\server\\actions\\settings.ts");
  const section = settings.slice(settings.indexOf("export type PendingInviteRead"), settings.indexOf("export async function revokePendingInviteAction"));
  assert.match(section, /requireActiveWorkspaceOwner/);
  assert.doesNotMatch(section, /token:\s*pendingInvites\.token/);
  assert.doesNotMatch(section, /token:\s*r\.token/);
});

test("production checkout fails closed when Stripe is unavailable", () => {
  const billing = read("src\\server\\actions\\billing.ts");
  assert.match(billing, /if \(process\.env\.NODE_ENV === "production"\)/);
  assert.match(billing, /Billing is unavailable until Stripe is configured/);
});

test("private calendar responses cannot be shared through a CDN", () => {
  const calendar = read("src\\app\\api\\calendar\\[workspaceId]\\route.ts");
  assert.match(calendar, /Cache-Control.*private, no-store/);
  assert.doesNotMatch(calendar, /Cache-Control.*public/);
});

test("operator roadmap feed uses the operator principal, not authentication alone", () => {
  const route = read("src\\app\\api\\roadmap.ics\\route.ts");
  assert.match(route, /requireAdmin/);
  assert.doesNotMatch(route, /getCurrentUserOrNull/);
});

test("share-card OG route does not enumerate private workspaces by ID", () => {
  const route = read("src\\app\\share-card\\[workspaceId]\\opengraph-image.tsx");
  assert.match(route, /Raw workspace IDs are not public authorization/);
  assert.match(route, /ws = undefined/);
});
