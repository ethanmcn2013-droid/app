import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProjectFile } from "@/lib/projects/project-files";
import {
  dateGroups,
  describeSources,
  fileLabel,
  matchReason,
  matchesQuery,
  parseShelfSource,
  queryWords,
  shelfTypeOf,
  splitName,
  summarySentence,
  typeChips,
  typeCount,
  whereLong,
} from "./shelf-model";

/**
 * Every word the Sources + shelf page says about files, from fixed rows.
 *
 * Run with: node --import tsx --test src/components/app/files-shelf/shelf-model.test.ts
 */

const NOW = Math.floor(Date.parse("2026-10-21T12:00:00Z") / 1000);
const DAY = 86_400;

function file(over: Partial<ProjectFile> & Pick<ProjectFile, "id" | "title">): ProjectFile {
  return {
    kind: "document",
    storage: "signal",
    href: null,
    external: false,
    mimeType: null,
    sizeBytes: null,
    taskId: "t1",
    taskTitle: "Book the venue",
    taskArchived: false,
    addedByName: "Sam Ryan",
    addedByFormer: false,
    addedAt: NOW - DAY,
    ...over,
  };
}

const FILES: ProjectFile[] = [
  file({ id: "a", title: "Venue contract.pdf", sizeBytes: 2 * 1024 * 1024, addedAt: NOW - 3600 }),
  file({ id: "b", title: "Florist moodboard.png", kind: "image", sizeBytes: 512 * 1024, taskId: "t2", taskTitle: "Book florist", addedAt: NOW - 3 * DAY }),
  file({ id: "c", title: "Guest list", kind: "sheet", storage: "google_drive", href: "https://docs.google.com/x", external: true, taskId: "t3", taskTitle: "Guest list", addedByName: "Ethan", addedAt: NOW - 12 * DAY }),
  file({ id: "d", title: "Table settings board", kind: "link", storage: "link", href: "https://www.pinterest.com/b", external: true, addedByName: null, addedByFormer: true, addedAt: NOW - 40 * DAY }),
];

test("?source= accepts the three folders and nothing else", () => {
  assert.equal(parseShelfSource("signal"), "signal");
  assert.equal(parseShelfSource("drive"), "drive");
  assert.equal(parseShelfSource("links"), "links");
  assert.equal(parseShelfSource("upload"), null);
  assert.equal(parseShelfSource(["drive"]), null);
  assert.equal(parseShelfSource(undefined), null);
});

test("each source folder states one fact in one grammar, and Drive is where Drive files live", () => {
  const [signal, drive, links] = describeSources(FILES);
  assert.deepEqual(signal, { key: "signal", name: "In Signal", blurb: "Files uploaded to Signal.", fact: "On 2 tasks · 2.5 MB", count: 2 });
  assert.deepEqual(drive, { key: "drive", name: "Google Drive", blurb: "In Google Drive. Opens in Drive.", fact: "On 1 task", count: 1 });
  assert.equal(links?.fact, "On 1 task");
  assert.equal(describeSources([])[1]?.fact, "Nothing here yet");
  const words = JSON.stringify(describeSources(FILES)).toLowerCase();
  assert.doesNotMatch(words, /linked, not copied|not copied/);
});

test("the header is one plain sentence", () => {
  assert.equal(summarySentence(FILES, "Wedding hub", NOW), "4 files on 3 tasks in Wedding hub, 2 added in the last 7 days.");
  assert.equal(summarySentence([FILES[3]!], "Wedding hub", NOW), "1 file on 1 task in Wedding hub, none added in the last 7 days.");
  assert.equal(summarySentence([], "Wedding hub", NOW), "Nothing is attached to a task in Wedding hub yet.");
});

test("one placeholder per type, and chips only when two or more types exist", () => {
  assert.deepEqual(FILES.map(shelfTypeOf), ["document", "image", "sheet", "link"]);
  assert.equal(shelfTypeOf(file({ id: "s", title: "Deck", kind: "slides" })), "document");
  assert.equal(shelfTypeOf(file({ id: "f", title: "Figma", kind: "design", storage: "link" })), "link");
  assert.deepEqual(typeChips([FILES[0]!]), []);
  assert.deepEqual(typeChips(FILES.slice(0, 2)).map((chip) => `${chip.label} ${chip.count}`), ["Documents 1", "Images 1"]);
  assert.equal(typeCount("image", 3), "3 images");
  assert.equal(typeCount("document", 1), "1 document");
  assert.equal(typeCount(null, 2), "2 files");
});

test("search needs every word across name, task, person, kind or source, and says why it matched", () => {
  const words = queryWords("sam  CONTRACT");
  assert.deepEqual(words, ["sam", "contract"]);
  assert.deepEqual(FILES.filter((f) => matchesQuery(f, words)).map((f) => f.id), ["a"]);
  assert.deepEqual(matchReason(FILES[0]!, queryWords("contract")), { kind: "name", text: "Venue contract.pdf" });
  assert.deepEqual(matchReason(FILES[1]!, queryWords("florist book")), { kind: "task", text: "Book florist" });
  assert.deepEqual(matchReason(FILES[2]!, queryWords("ethan")), { kind: "person", text: "Ethan" });
  assert.deepEqual(matchReason(FILES[2]!, queryWords("drive")), { kind: "source", text: "Google Drive" });
  assert.deepEqual(matchReason(FILES[3]!, queryWords("pinterest")), { kind: "source", text: "pinterest.com" });
  assert.equal(matchReason(FILES[0]!, []), null);
  // The name holds "venue" (no reason needed there); "sam" is why it matched.
  assert.deepEqual(matchReason(FILES[0]!, queryWords("venue sam")), { kind: "person", text: "Sam Ryan" });
  assert.ok(FILES.filter((f) => matchesQuery(f, queryWords("former member"))).map((f) => f.id).includes("d"));
});

test("one accessible name per file, a former member never named", () => {
  assert.equal(
    fileLabel(FILES[2]!, matchReason(FILES[2]!, ["ethan"])),
    "Guest list. Sheet, in Google Drive. Task: Guest list. Added 9 Oct by Ethan. Matched person Ethan",
  );
  assert.match(fileLabel(FILES[3]!), /by a former member/);
  assert.match(fileLabel(file({ id: "z", title: "Old", taskArchived: true })), /Task: Book the venue \(archived\)/);
});

test("names keep their extension; where-it-lives reads as the shelf says it", () => {
  assert.deepEqual(splitName("Venue contract.pdf"), { base: "Venue contract", ext: ".pdf" });
  assert.deepEqual(splitName("Guest list"), { base: "Guest list", ext: "" });
  assert.equal(whereLong(FILES[2]!), "In Google Drive");
  assert.equal(whereLong(FILES[0]!), "Uploaded to Signal");
  assert.equal(whereLong(FILES[3]!), "A link to pinterest.com");
});

test("the list groups newest first by calendar date", () => {
  const groups = dateGroups(FILES, NOW);
  assert.deepEqual(groups.map((g) => [g.label, g.files.map((f) => f.id)]), [
    ["Today", ["a"]],
    ["Last 7 days", ["b"]],
    ["Earlier this month", ["c"]],
    ["Older", ["d"]],
  ]);
});
