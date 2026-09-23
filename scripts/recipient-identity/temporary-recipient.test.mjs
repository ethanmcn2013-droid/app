import assert from "node:assert/strict";
import test from "node:test";
import {
  createTemporaryRecipient,
  deleteTemporaryRecipient,
  temporaryRecipientEmail,
} from "./temporary-recipient.mjs";

const email = "recipient+clerk_test_0123456789abcdef@example.test";
const secretKey = "sk_test_test-only";
const password = "long-disposable-password-for-test-only";

test("temporary recipient address is unique and stays in Clerk test mail", () => {
  assert.equal(temporaryRecipientEmail("Recipient+clerk_test@Example.test", "0123456789abcdef"), email);
  assert.throws(() => temporaryRecipientEmail("recipient@example.test", "0123456789abcdef"));
  assert.throws(() => temporaryRecipientEmail("recipient+clerk_test@example.test", "bad"));
});

test("create accepts only the exact verified newly created identity", async () => {
  const request = async (url, options) => {
    assert.equal(url, "https://api.clerk.com/v1/users");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { email_address: [email], password });
    return {
      ok: true,
      async json() {
        return {
          id: "user_Temporary123",
          primary_email_address_id: "id_1",
          email_addresses: [{ id: "id_1", email_address: email, verification: { status: "verified" } }],
        };
      },
    };
  };
  assert.deepEqual(await createTemporaryRecipient({ secretKey, email, password, request }), {
    id: "user_Temporary123", email,
  });
  await assert.rejects(() => createTemporaryRecipient({ secretKey, email, password, request: async () => ({
    ok: true,
    async json() {
      return { id: "user_Other", primary_email_address_id: "id_1", email_addresses: [
        { id: "id_1", email_address: "other+clerk_test@example.test", verification: { status: "verified" } },
      ] };
    },
  }) }), /mismatched/);
});

test("cleanup addresses only the created user and reports uncertain deletion", async () => {
  let calls = 0;
  await deleteTemporaryRecipient({ secretKey, userId: "user_Temporary123", request: async (url, options) => {
    calls += 1;
    assert.equal(url, "https://api.clerk.com/v1/users/user_Temporary123");
    assert.equal(options.method, "DELETE");
    return { ok: true, status: 200 };
  } });
  assert.equal(calls, 1);
  await assert.rejects(() => deleteTemporaryRecipient({ secretKey, userId: "user_Temporary123", request: async () => ({
    ok: false, status: 503,
  }) }), /cleanup failed: HTTP 503/);
});
