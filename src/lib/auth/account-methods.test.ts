import assert from "node:assert/strict";
import test from "node:test";
import { accountSocialProviders, connectedSocialMethods, primaryAccountPhone } from "./account-methods";

test("disabled Facebook remains visible when linked, without offering a new connection", () => {
  const accounts = [{ provider: "facebook", emailAddress: "member@example.test", verification: { status: "verified" } }];
  assert.deepEqual(accountSocialProviders(accounts, "oauth_google").map(({ id, canConnect }) => ({ id, canConnect })), [
    { id: "oauth_google", canConnect: true }, { id: "oauth_facebook", canConnect: false },
  ]);
  assert.deepEqual(connectedSocialMethods(accounts), [{ kind: "facebook", label: "Facebook", identifier: "member@example.test", verified: true, connected: true }]);
  assert.deepEqual(connectedSocialMethods([{ provider: "unknown" }]), []);
});

test("only configured providers offer Connect and unlinked providers are not reported as connected", () => {
  assert.deepEqual(accountSocialProviders([], "oauth_facebook").map(({ id, canConnect }) => ({ id, canConnect })), [{ id: "oauth_facebook", canConnect: true }]);
  assert.deepEqual(connectedSocialMethods([]), []);
  assert.equal(connectedSocialMethods([{ provider: "facebook" }])[0].verified, false);
});

test("phone projection matches the primary identifier and never invents sign-in capability", () => {
  const phoneNumbers = [{ id: "phone-a", phoneNumber: "+353000000001", verification: { status: "verified" } }, { id: "phone-b", phoneNumber: "+353000000002", verification: null }];
  assert.equal(primaryAccountPhone({ phoneNumbers }), null);
  assert.equal(primaryAccountPhone({ primaryPhoneNumberId: "missing", phoneNumbers }), null);
  assert.deepEqual(primaryAccountPhone({ primaryPhoneNumberId: "phone-a", phoneNumbers }), { number: "+353000000001", verified: true });
  assert.deepEqual(primaryAccountPhone({ primaryPhoneNumberId: "phone-b", phoneNumbers }), { number: "+353000000002", verified: false });
});

test("Clerk's null verification status stays unverified for linked accounts and phone identifiers", () => {
  const accounts = [{ provider: "facebook", verification: { status: null } }];
  assert.equal(connectedSocialMethods(accounts)[0].verified, false);
  assert.equal(accountSocialProviders(accounts, "oauth_google").find((provider) => provider.id === "oauth_facebook")?.canConnect, false);
  assert.deepEqual(primaryAccountPhone({
    primaryPhoneNumberId: "phone-null",
    phoneNumbers: [{ id: "phone-null", phoneNumber: "+353000000003", verification: { status: null } }],
  }), { number: "+353000000003", verified: false });
});
