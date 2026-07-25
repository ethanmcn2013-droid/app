import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enabledSocialProviders } from "./social-providers";

describe("enabledSocialProviders", () => {
  it("offers only the provider enabled in the production baseline", () => {
    assert.deepEqual(enabledSocialProviders(null), [
      { id: "oauth_google", label: "Google" },
    ]);
  });

  it("accepts an explicit Clerk-aligned provider list", () => {
    assert.deepEqual(
      enabledSocialProviders("oauth_google,oauth_github,oauth_apple"),
      [
        { id: "oauth_google", label: "Google" },
        { id: "oauth_github", label: "GitHub" },
        { id: "oauth_apple", label: "Apple" },
      ],
    );
  });

  it("ignores unsupported and duplicate strategies", () => {
    assert.deepEqual(
      enabledSocialProviders(
        "oauth_github,oauth_unknown,oauth_github",
      ),
      [{ id: "oauth_github", label: "GitHub" }],
    );
  });
});
