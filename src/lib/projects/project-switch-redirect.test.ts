import { test } from "node:test";
import assert from "node:assert/strict";
import { isExpectedProjectSwitchRedirect } from "./project-switch-redirect";

const destination = "/app/home?workspaceId=project-b";

test("the selected Project's Next redirect awaits route verification", () => {
  const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
    digest: `NEXT_REDIRECT;push;${destination};303;`,
  });
  assert.equal(isExpectedProjectSwitchRedirect(redirect, destination), true);
});

test("an unrelated redirect or ordinary error cannot settle a Project switch", () => {
  const otherProject = Object.assign(new Error("NEXT_REDIRECT"), {
    digest: "NEXT_REDIRECT;push;/app/home?workspaceId=project-a;303;",
  });
  assert.equal(isExpectedProjectSwitchRedirect(otherProject, destination), false);
  assert.equal(isExpectedProjectSwitchRedirect(new Error("network failure"), destination), false);
  assert.equal(isExpectedProjectSwitchRedirect({ digest: `NEXT_REDIRECT;push;${destination};invalid;` }, destination), false);
});
