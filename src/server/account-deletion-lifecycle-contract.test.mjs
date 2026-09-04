import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("the in-app route fences identity before product and Clerk deletion", () => {
  const source = read("src/app/api/account/delete/route.ts");
  const begin = source.indexOf("await beginAccountDeletion(userId)");
  const products = source.indexOf("await deleteAccountForUser(userId)");
  const clerk = source.indexOf("await client.users.deleteUser(userId)");

  assert.ok(begin >= 0, "the durable identity tombstone must be installed");
  assert.ok(products > begin, "product erasure must follow the tombstone");
  assert.ok(clerk > products, "Clerk deletion must remain last");
});

test("fallback provisioning checks the tombstone in its writer transaction", () => {
  const source = read("src/server/db/ensure-user.ts");
  const transaction = source.indexOf("return database.transaction");
  const fence = source.indexOf("hasAccountDeletionStartedWith(tx, clerkUserId)");
  const userInsert = source.indexOf("INSERT OR IGNORE INTO users");

  assert.ok(transaction >= 0);
  assert.ok(fence > transaction);
  assert.ok(userInsert > fence);
  assert.match(source, /\{ behavior: "immediate" \}/);
});

test("Clerk creation and deletion share the same durable lifecycle", () => {
  const source = read("src/app/api/webhooks/clerk/route.ts");
  const createHandler = source.slice(
    source.indexOf("async function handleUserCreated"),
    source.indexOf("function isEduEmail"),
  );
  const deleteHandler = source.slice(
    source.indexOf("async function handleUserDeleted"),
  );

  assert.ok(
    createHandler.indexOf("hasAccountDeletionStartedWith(tx, userId)") <
      createHandler.indexOf("INSERT INTO users"),
  );
  assert.match(createHandler, /\{ behavior: "immediate" \}/);
  assert.ok(
    deleteHandler.indexOf("await beginAccountDeletion(u.id)") <
      deleteHandler.indexOf("await deleteAccountForUser(u.id)"),
  );
  assert.doesNotMatch(deleteHandler, /db\.delete\(users\)/);
});
