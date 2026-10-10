import assert from "node:assert/strict";
import test from "node:test";
import { conversationFailureCode } from "./failure-diagnostic";

test("diagnostics accept only allowlisted structured codes, including wrapped driver errors", () => {
  assert.equal(conversationFailureCode({ code: "SQLITE_BUSY", message: "secret SQL" }), "SQLITE_BUSY");
  assert.equal(conversationFailureCode({ cause: { code: "HRANA_CLOSED_ERROR" } }), "HRANA_CLOSED_ERROR");
  assert.equal(conversationFailureCode(new Error("SQLITE_BUSY secret SQL")), "unknown");
  assert.equal(conversationFailureCode({ code: "secret_sql_text" }), "unknown");
  assert.equal(conversationFailureCode({ code: "ETIMEDOUT", cause: { code: "SQLITE_BUSY" } }), "unknown");
  const cyclic: { cause?: unknown } = {}; cyclic.cause = cyclic;
  assert.equal(conversationFailureCode(cyclic), "unknown");
});
