/**
 * Stands in for `@clerk/nextjs/server` in the /app access-gate runtime test.
 *
 * The signed-in account is read from globalThis so one test process can put
 * several identities — founder, invited collaborator, stranger — through the
 * same real gate code. Shape matches the two fields the gates read:
 * `id`, and the primary address out of `emailAddresses`.
 */
module.exports.currentUser = async function currentUser() {
  return globalThis.__SIGNAL_TEST_CLERK_USER__ ?? null;
};
