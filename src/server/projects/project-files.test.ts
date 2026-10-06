import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { freshMemoryDb } from "../db/memory-test-db";
import { attachments, resources, tasks, users, workspaceMembers, workspaces } from "../db/schema";
import { readProjectFilesWith } from "./project-files";

/**
 * The Files read against the real schema, in a disposable in-memory database:
 * review mode never runs these selects, so this is where they are proved.
 * Nothing here touches a configured database.
 *
 * Run with: node --import tsx --import ./src/test/register-server-only.mjs --test src/server/projects/project-files.test.ts
 */

const at = (iso: string) => Math.floor(Date.parse(`${iso}T12:00:00Z`) / 1000);

async function seeded() {
  const local = await freshMemoryDb();
  const person = (id: string, name: string | null) =>
    local.db.insert(users).values({ id, clerkId: id, handle: id, name, email: `${id}@example.test`, initials: "FX", color: "fixture" });
  await person("orla", "Orla Byrne");
  await person("tom", null); // no name: shown by handle
  await person("former", "PRIVATE FORMER NAME");
  await person("outsider", "PRIVATE OUTSIDER NAME");

  for (const id of ["p-a", "p-b"]) await local.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: "orla" });
  await local.db.insert(workspaceMembers).values([
    { workspaceId: "p-a", userId: "orla", role: "owner" },
    { workspaceId: "p-a", userId: "tom", role: "member" },
    { workspaceId: "p-b", userId: "orla", role: "owner" },
    { workspaceId: "p-b", userId: "outsider", role: "member" },
  ]);

  const task = (id: string, workspaceId: string, title: string, archived = false) =>
    local.db.insert(tasks).values({ id, workspaceId, title, lane: "todo", priority: "p2", assignees: [], archivedAt: archived ? new Date("2026-09-01T00:00:00Z") : null });
  await task("a-live", "p-a", "Draft the seating plan");
  await task("a-archived", "p-a", "An old idea", true);
  await task("b-live", "p-b", "PRIVATE B TASK");

  const resource = (seed: Partial<typeof resources.$inferInsert> & { id: string; taskId: string; workspaceId: string; title: string; addedAt: number }) =>
    local.db.insert(resources).values({ kind: "link", provider: "url", storage: "signal", ...seed });
  await resource({ id: "r-link", workspaceId: "p-a", taskId: "a-live", title: "Supplier list", url: "https://suppliers.example/list", addedByUserId: "orla", addedAt: at("2026-10-04") });
  await resource({ id: "r-js", workspaceId: "p-a", taskId: "a-live", title: "Bad link", url: "javascript:alert(1)", addedByUserId: "tom", addedAt: at("2026-10-03") });
  await resource({ id: "r-creds", workspaceId: "p-a", taskId: "a-live", title: "Link with a password", url: "https://user:pass@example.test/x", addedByUserId: "tom", addedAt: at("2026-10-02") });
  await resource({ id: "r-former", workspaceId: "p-a", taskId: "a-live", title: "From someone who left", url: "https://example.test/old", addedByUserId: "former", addedAt: at("2026-10-01") });
  await resource({ id: "r-nobody", workspaceId: "p-a", taskId: "a-live", title: "No uploader recorded", url: "https://example.test/none", addedByUserId: null, addedAt: at("2026-09-30") });
  await resource({ id: "r-archived", workspaceId: "p-a", taskId: "a-archived", title: "On an archived task", url: "https://example.test/archived", addedByUserId: "orla", addedAt: at("2026-09-29") });
  await resource({ id: "res-att-mirrored", workspaceId: "p-a", taskId: "a-live", title: "Run sheet.pdf", kind: "upload", provider: "file", mimeType: "application/pdf", sizeBytes: 1200, addedByUserId: "orla", addedAt: at("2026-09-28") });
  await resource({ id: "res-att-pending", workspaceId: "p-a", taskId: "a-live", title: "Still uploading.pdf", kind: "upload", provider: "file", accessState: "pending", addedByUserId: "orla", addedAt: at("2026-09-27") });
  // A row filed under p-a whose task belongs to p-b must never surface in p-a.
  await resource({ id: "r-stale", workspaceId: "p-a", taskId: "b-live", title: "PRIVATE STALE ROW", url: "https://example.test/stale", addedByUserId: "outsider", addedAt: at("2026-10-05") });
  await resource({ id: "r-b", workspaceId: "p-b", taskId: "b-live", title: "PRIVATE B FILE", url: "https://example.test/b", addedByUserId: "outsider", addedAt: at("2026-10-05") });

  const attachment = (id: string, taskId: string, filename: string, uploaderUserId: string, iso: string, workspaceId: string | null = null) =>
    local.db.insert(attachments).values({ id, workspaceId, taskId, uploaderUserId, filename, storedPath: `x/${id}`, mimeType: "image/png", sizeBytes: 2048, createdAt: new Date(`${iso}T12:00:00Z`) });
  await attachment("att-mirrored", "a-live", "Run sheet.pdf", "orla", "2026-09-28");
  await attachment("att-own", "a-live", "Terrace.png", "tom", "2026-09-26");
  await attachment("att-archived", "a-archived", "Archived photo.png", "orla", "2026-09-25");
  await attachment("att-b", "b-live", "PRIVATE B PHOTO.png", "outsider", "2026-10-05", "p-b");
  return local;
}

test("one project's files only, newest first, with archived tasks left out", async () => {
  const local = await seeded();
  const read = await readProjectFilesWith(local.db, "p-a");
  assert.equal(read.truncated, false);
  assert.equal(read.includesArchived, false);
  assert.deepEqual(read.files.map((file) => file.title), [
    "Supplier list",
    "Bad link",
    "Link with a password",
    "From someone who left",
    "No uploader recorded",
    "Run sheet.pdf",
    "Still uploading.pdf",
    "Terrace.png",
  ]);
  assert.doesNotMatch(JSON.stringify(read), /PRIVATE/, "nothing of another project, and no name of someone outside this one");
  assert.equal(read.files.every((file) => file.taskTitle === "Draft the seating plan" && !file.taskArchived), true);
});

test("a person is named only while they are a member; anyone else is a former member", async () => {
  const local = await seeded();
  const { files } = await readProjectFilesWith(local.db, "p-a");
  const who = (title: string) => {
    const file = files.find((entry) => entry.title === title)!;
    return [file.addedByName, file.addedByFormer];
  };
  assert.deepEqual(who("Supplier list"), ["Orla Byrne", false]);
  assert.deepEqual(who("Terrace.png"), ["tom", false]);
  assert.deepEqual(who("From someone who left"), [null, true]);
  assert.deepEqual(who("No uploader recorded"), [null, false]);
});

test("hrefs keep their rules: uploads through the attachment route, links only when safe", async () => {
  const local = await seeded();
  const { files } = await readProjectFilesWith(local.db, "p-a");
  const href = (title: string) => files.find((file) => file.title === title)!.href;
  assert.equal(href("Supplier list"), "https://suppliers.example/list");
  assert.equal(href("Bad link"), null, "a script address is never a link");
  assert.equal(href("Link with a password"), null, "an address carrying credentials is never a link");
  assert.equal(href("Run sheet.pdf"), "/api/attachments/att-mirrored");
  assert.equal(href("Terrace.png"), "/api/attachments/att-own");
  assert.equal(href("Still uploading.pdf"), null, "a pending upload has nothing to open yet");
  // The mirrored upload appears once, from its resource row.
  assert.equal(files.filter((file) => file.title === "Run sheet.pdf").length, 1);
});

test("files on archived tasks come back only when asked for, and say so", async () => {
  const local = await seeded();
  const read = await readProjectFilesWith(local.db, "p-a", { includeArchived: true });
  assert.equal(read.includesArchived, true);
  assert.equal(read.files.length, 10);
  const archived = read.files.filter((file) => file.taskArchived).map((file) => file.title).sort();
  assert.deepEqual(archived, ["Archived photo.png", "On an archived task"]);
  assert.doesNotMatch(JSON.stringify(read), /PRIVATE/);
});

test("the read is bounded and says when it was cut short, with no gap in what it shows", async () => {
  const local = await seeded();
  const read = await readProjectFilesWith(local.db, "p-a", {}, 3);
  assert.equal(read.truncated, true);
  // Three newest resources; the attachments are all older than the last of
  // them, so none is shown rather than skipping the rows in between.
  assert.deepEqual(read.files.map((file) => file.title), ["Supplier list", "Bad link", "Link with a password"]);
  const whole = await readProjectFilesWith(local.db, "p-a", {}, 50);
  assert.equal(whole.truncated, false);
  assert.equal(whole.files.length, 8);
});

test("the read is read-only and scoped by the project it is given", () => {
  const source = readFileSync(fileURLToPath(new URL("./project-files.ts", import.meta.url)), "utf8");
  assert.match(source, /import "server-only";/);
  assert.doesNotMatch(source, /^["']use server["']/m, "not a Server Function");
  assert.doesNotMatch(source, /\.(insert|update|delete)\(/, "nothing here writes");
  assert.match(source, /eq\(resources\.workspaceId, workspaceId\), eq\(tasks\.workspaceId, workspaceId\)/);
  assert.match(source, /\.where\(and\(eq\(tasks\.workspaceId, workspaceId\), liveTask\)\)/);
  assert.match(source, /eq\(workspaceMembers\.workspaceId, workspaceId\)/, "names come from this project's members");
  assert.doesNotMatch(source, /inArray\(users\.id/, "people are no longer looked up by id alone");
});
