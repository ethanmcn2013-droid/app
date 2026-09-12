import assert from "node:assert/strict";
import test from "node:test";
import { anyMatchVisible } from "./diagnostic";

test("diagnostic visibility tolerates duplicate matches and finds any visible one", async () => {
  const result = await anyMatchVisible({
    async all() {
      return [
        { async isVisible() { return false; } },
        { async isVisible() { return true; } },
      ];
    },
  });
  assert.equal(result, true);
});
