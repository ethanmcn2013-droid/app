import assert from "node:assert/strict";
import test from "node:test";
import { anyMatchVisible, classifyPageError } from "./diagnostic";

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

test("page errors map to fixed receipt-safe classes", () => {
  assert.equal(
    classifyPageError(new Error("SignOutButton can only be used within the <ClerkProvider /> component")),
    "missingClerkProvider",
  );
  assert.equal(
    classifyPageError(new Error("You've added multiple <ClerkProvider> components")),
    "multipleClerkProviders",
  );
  assert.equal(classifyPageError(new Error("hydration failed")), "hydration");
  assert.equal(classifyPageError(new Error("private runtime value")), "other");
});
