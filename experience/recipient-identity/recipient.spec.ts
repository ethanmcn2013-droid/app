import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";
import { observe } from "./evidence";
import {
  PRIVATE_TASK_TITLE,
  RECIPIENT_PROJECT_ID,
  RECIPIENT_PROJECT_NAME,
  RECIPIENT_TASK_TITLE,
  readRecipientJourneyState,
  removeRecipientMembership,
  seedRecipientJourney,
} from "./fixture";

type ClerkIdentity = Readonly<{ clerkId: string; email: string; verified: boolean }>;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function ticketSignIn(page: Page, email: string): Promise<ClerkIdentity> {
  await page.goto("/sign-in");
  await clerk.loaded({ page });
  // Clerk's supported ticket helper creates a real development-instance
  // session. It intentionally bypasses credential entry, verification and MFA.
  await clerk.signIn({ page, emailAddress: email });
  await clerk.loaded({ page });
  const identity = await page.evaluate(() => {
    const user = window.Clerk.user;
    const primary = user?.emailAddresses.find((item) => item.id === user.primaryEmailAddressId);
    return {
      clerkId: user?.id ?? "",
      email: primary?.emailAddress ?? "",
      verified: primary?.verification?.status === "verified",
    };
  });
  expect(identity.clerkId).toMatch(/^user_/);
  expect(identity.email.toLowerCase()).toBe(email.toLowerCase());
  expect(identity.verified).toBe(true);
  return identity;
}

test("controlled recipient accepts B, completes assigned work, and loses B after removal", async ({ browser }) => {
  const creatorEmail = required("SIGNAL_RECIPIENT_CREATOR_EMAIL");
  const recipientEmail = required("SIGNAL_RECIPIENT_RECIPIENT_EMAIL");
  const creatorContext = await browser.newContext();
  const recipientContext = await browser.newContext();
  const creatorPage = await creatorContext.newPage();
  const recipientPage = await recipientContext.newPage();

  try {
    const creator = await ticketSignIn(creatorPage, creatorEmail);
    const recipient = await ticketSignIn(recipientPage, recipientEmail);
    observe("twoSessionsIssued");
    await clerk.signOut({ page: recipientPage });

    const token = await seedRecipientJourney(creator, recipient);
    const invitePath = `/invite/${token}`;

    await recipientPage.goto(invitePath);
    await expect(recipientPage.getByRole("heading", { name: new RegExp(`added you to ${RECIPIENT_PROJECT_NAME}`) })).toBeVisible();
    const signIn = recipientPage.getByRole("link", { name: "Sign in to accept" });
    const signInHref = await signIn.getAttribute("href");
    expect(signInHref).not.toBeNull();
    const signInUrl = new URL(signInHref!, recipientPage.url());
    expect(signInUrl.pathname).toBe("/sign-in");
    expect(signInUrl.searchParams.get("redirect_url")).toBe(invitePath);
    observe("signedOutInviteShown");

    await creatorPage.goto(invitePath);
    await expect(creatorPage.getByText(/Use the email address this invite was sent to/)).toBeVisible();
    await expect(creatorPage.getByRole("button", { name: "Accept invite" })).toHaveCount(0);
    await creatorPage.getByRole("button", { name: "Sign out and use the invited account" }).click();
    await expect(creatorPage).toHaveURL((url) =>
      url.pathname === "/sign-in" && url.searchParams.get("redirect_url") === invitePath,
    );
    const restoredCreator = await ticketSignIn(creatorPage, creatorEmail);
    expect(restoredCreator).toEqual(creator);
    observe("wrongAccountRefused");

    await signIn.click();
    await expect(recipientPage).toHaveURL((url) => url.pathname === "/sign-in" && url.searchParams.get("redirect_url") === invitePath);
    await clerk.loaded({ page: recipientPage });
    await clerk.signIn({ page: recipientPage, emailAddress: recipientEmail });
    // Do not force this navigation: the proof fails if the signed-out intent
    // is lost and Clerk does not return the real session to the exact invite.
    await expect(recipientPage).toHaveURL((url) => url.pathname === invitePath);
    await recipientPage.getByRole("button", { name: "Accept invite" }).click();
    await expect(recipientPage).toHaveURL(new RegExp(`/app/my-tasks\\?workspaceId=${RECIPIENT_PROJECT_ID}$`));
    await expect(recipientPage.getByText(RECIPIENT_TASK_TITLE, { exact: true })).toBeVisible();
    await expect(recipientPage.getByText(PRIVATE_TASK_TITLE, { exact: true })).toHaveCount(0);
    observe("inviteAccepted");

    await recipientPage.getByRole("button", { name: `Mark "${RECIPIENT_TASK_TITLE}" done` }).click();
    await expect(recipientPage.getByRole("button", { name: `Mark "${RECIPIENT_TASK_TITLE}" not done` })).toBeVisible();
    await expect.poll(async () => (await readRecipientJourneyState()).task?.lane).toBe("done");
    observe("recipientTaskCompleted");

    await recipientPage.getByRole("link", { name: "Home", exact: true }).first().click();
    await expect(recipientPage).toHaveURL(/\/app\/home(?:\?|$)/);
    observe("homeReturned");

    await creatorPage.goto(`/app/tasks?workspaceId=${RECIPIENT_PROJECT_ID}`);
    await expect(creatorPage.getByText(RECIPIENT_TASK_TITLE, { exact: true })).toBeVisible();
    await expect(creatorPage.getByRole("button", { name: `Mark "${RECIPIENT_TASK_TITLE}" not done` })).toBeVisible();
    observe("creatorReadback");

    const accepted = (await readRecipientJourneyState()).invite;
    expect(accepted?.accepted_at).not.toBeNull();
    await recipientPage.goto(invitePath);
    await expect(recipientPage.getByRole("heading", { name: "This invite has already been accepted." })).toBeVisible();
    expect((await readRecipientJourneyState()).invite).toEqual(accepted);
    observe("replayRefused");

    await removeRecipientMembership(recipient.clerkId);
    await recipientPage.goto(`/app/my-tasks?workspaceId=${RECIPIENT_PROJECT_ID}`);
    await expect(recipientPage.getByRole("heading", { name: "Project unavailable" })).toBeVisible();
    observe("removedMemberRefused");
  } finally {
    await recipientContext.close();
    await creatorContext.close();
  }
});
