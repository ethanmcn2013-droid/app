import assert from "node:assert/strict";
import test from "node:test";
import { createAssistantMailDispatcher } from "./dispatch";
const intent = { key: "intent", kind: "invite" as const, projectId: "project-a", email: "invented@example.invalid", inviteToken: "synthetic-token" };
test("dispatch sends one exact authorized address and propagates idempotency; acceptance is explicit", async () => {
  let sends = 0;
  const dispatch = createAssistantMailDispatcher({ enabled: () => true, from: "Synthetic <noreply@example.invalid>", describe: async () => ({ projectName: "Test <project>", inviterName: "Teammate" }), send: async (message, key) => { sends++; assert.equal(message.to, intent.email); assert.equal(key, "receipt-key"); assert.match(message.html, /&lt;project&gt;/); assert.match(message.text, /\/invite\/synthetic-token/); return { id: "provider-accepted" }; } });
  assert.deepEqual(await dispatch(intent, { idempotencyKey: "receipt-key", signal: new AbortController().signal }), { outcome: "accepted", providerId: "provider-accepted" });
  assert.equal(sends, 1);
});
test("disabled or pre-aborted delivery sends nothing; ambiguous reply never means delivered", async () => {
  let sends = 0; const controller = new AbortController(); controller.abort();
  const base = { enabled: () => false, from: "Synthetic", describe: async () => ({ projectName: "Test", inviterName: "Teammate" }), send: async () => { sends++; return {}; } };
  assert.deepEqual(await createAssistantMailDispatcher(base)(intent, { idempotencyKey: "id", signal: new AbortController().signal }), { outcome: "suppressed" });
  assert.deepEqual(await createAssistantMailDispatcher({ ...base, enabled: () => true })(intent, { idempotencyKey: "id", signal: controller.signal }), { outcome: "suppressed" });
  assert.equal(sends, 0);
  assert.deepEqual(await createAssistantMailDispatcher({ ...base, enabled: () => true })(intent, { idempotencyKey: "id", signal: new AbortController().signal }), { outcome: "unknown" });
});
