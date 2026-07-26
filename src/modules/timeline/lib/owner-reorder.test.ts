import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOwnerKeyboardReorder,
  type OwnerReorderItem,
} from "./owner-reorder";

const ITEMS: readonly OwnerReorderItem[] = [
  {
    id: "next-a",
    title: "Confirm menu",
    audienceState: "next",
    hidden: false,
  },
  {
    id: "covered-a",
    title: "Book venue",
    audienceState: "covered",
    hidden: false,
  },
  {
    id: "next-b",
    title: "Send invitations",
    audienceState: "next",
    hidden: false,
  },
  {
    id: "hidden-next",
    title: "Private checkpoint",
    audienceState: "next",
    hidden: true,
  },
];

test("keyboard reorder moves a milestone within its visible public-state group", () => {
  const result = buildOwnerKeyboardReorder(ITEMS, "next-b", "up");

  assert.deepEqual(result, {
    orderedIds: ["next-b", "covered-a", "next-a", "hidden-next"],
    title: "Send invitations",
    direction: "up",
    position: 1,
    siblingCount: 2,
  });
});

test("keyboard reorder does not cross a visible group boundary", () => {
  assert.equal(buildOwnerKeyboardReorder(ITEMS, "next-a", "up"), null);
  assert.equal(buildOwnerKeyboardReorder(ITEMS, "next-b", "down"), null);
  assert.equal(buildOwnerKeyboardReorder(ITEMS, "covered-a", "down"), null);
});

test("hidden and unknown milestones cannot be keyboard-reordered", () => {
  assert.equal(
    buildOwnerKeyboardReorder(ITEMS, "hidden-next", "up"),
    null,
  );
  assert.equal(buildOwnerKeyboardReorder(ITEMS, "missing", "down"), null);
});
