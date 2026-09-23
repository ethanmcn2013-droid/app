import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import { observe } from "./evidence";

setup("validate the Clerk development target", async () => {
  // The runner's local, deployment and key-prefix guards all run before this
  // first provider request. Success proves only that Clerk issued a testing
  // token for the secret key; the browser session and verified-user readback
  // later establish that the configured frontend can consume the ticket.
  await clerkSetup({ dotenv: false });
  observe("testingTokenIssued");
});
