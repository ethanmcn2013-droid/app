import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNotesWritable, notesRetirementEnabled } from "./notes-retirement";

test("retirement is off by default and only enabled by explicit server configuration", () => {
  for (const value of [undefined, "", "0", "false", "TRUE", "yes"]) {
    assert.equal(notesRetirementEnabled({ NOTES_RETIREMENT_ARCHIVE_ENABLED: value }), false);
    assert.doesNotThrow(() => assertNotesWritable({ NOTES_RETIREMENT_ARCHIVE_ENABLED: value }));
  }
  for (const value of ["1", "true"]) {
    assert.equal(notesRetirementEnabled({ NOTES_RETIREMENT_ARCHIVE_ENABLED: value }), true);
    assert.throws(() => assertNotesWritable({ NOTES_RETIREMENT_ARCHIVE_ENABLED: value }), /read-only/);
  }
});
