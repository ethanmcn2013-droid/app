import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMorePreferences } from "./more-preferences-model";
test("corrupt or obsolete appearance records use defaults; unknown IDs confer no access", () => {
  const known = ["teacher", "wedding", "development"];
  const defaults = ["development"];
  for (const raw of ["invalid", "null", '{"version":2,"hidden":[]}', "x".repeat(8_001)]) {
    assert.deepEqual(cleanMorePreferences(raw, known, defaults), defaults);
  }
  assert.deepEqual(cleanMorePreferences('{"version":1,"hidden":["teacher","teacher","foreign",42]}', known, defaults), ["teacher"]);
  assert.deepEqual(cleanMorePreferences('{"version":1,"hidden":[]}', known, defaults), []);
});
