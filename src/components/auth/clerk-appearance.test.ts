import assert from "node:assert/strict";
import test from "node:test";
import { signalAuthPageAppearance, signalClerkAppearance } from "./clerk-appearance";

test("ordinary alternate-method actions remain visible while stage-owned header and footer stay hidden", () => {
  const base = signalClerkAppearance.elements as Record<string, unknown>;
  const page = signalAuthPageAppearance.elements as Record<string, unknown>;
  const merged = { ...base, ...page };
  // Clerk also renders Card.Action outside Card.Footer for factor selection.
  // Hiding the footer itself must not hide these independent normal controls.
  for (const key of ["footerAction", "footerActionLink", "footerActionLink__useAnotherMethod"]) {
    const value = merged[key];
    assert.notEqual(typeof value === "object" && value !== null ? (value as Record<string, unknown>).display : undefined, "none");
    assert.notEqual(typeof value === "object" && value !== null ? (value as Record<string, unknown>).visibility : undefined, "hidden");
    assert.notEqual(typeof value === "object" && value !== null ? (value as Record<string, unknown>).opacity : undefined, 0);
    assert(!/\b(hidden|invisible)\b/.test(typeof value === "string" ? value : ""));
  }
  assert.deepEqual(page.header, { display: "none" });
  assert.deepEqual(page.footer, { display: "none" });
  assert.deepEqual(page.cardBox, { width: "100%", boxShadow: "none", border: "none", borderRadius: "0", backgroundColor: "transparent" });
  assert.deepEqual(page.card, { width: "100%", boxShadow: "none", border: "none", borderRadius: "0", backgroundColor: "transparent", padding: "0", gap: "var(--space-4)" });
});
