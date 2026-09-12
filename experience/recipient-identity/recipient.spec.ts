import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  observe,
  observeWrongAccountDiagnostic,
  type WrongAccountDiagnostic,
} from "./evidence";
import {
  anyMatchVisible,
  classifyPageError,
  type PageErrorClass,
} from "./diagnostic";
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

async function readVerifiedIdentity(page: Page, email: string): Promise<ClerkIdentity> {
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

async function ticketSignIn(page: Page, email: string): Promise<ClerkIdentity> {
  await page.goto("/sign-in");
  await clerk.loaded({ page });
  // Clerk's supported ticket helper creates a real development-instance
  // session. It intentionally bypasses credential entry, verification and MFA.
  await clerk.signIn({ page, emailAddress: email });
  return readVerifiedIdentity(page, email);
}

async function firstVisibleMatch(locator: Locator): Promise<Locator> {
  for (const match of await locator.all()) {
    if (await match.isVisible()) return match;
  }
  throw new Error("Expected one visible Clerk sign-in control.");
}

async function recipientEmailCodeSignIn(
  page: Page,
  email: string,
  invitePath: string,
): Promise<ClerkIdentity> {
  const expectedOrigin = new URL(page.url()).origin;
  const identifier = page.locator("input[name=identifier]");
  await expect(identifier).toBeVisible();
  await identifier.fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const digitOne = page.getByRole("textbox", {
    name: "Enter verification code. Digit 1",
  });
  const singleCode = page.getByLabel("Enter verification code", { exact: true });
  const useAnotherMethod = page.getByRole("link", { name: /use another method/i });
  const codeVisible = async () =>
    await anyMatchVisible(digitOne) || await anyMatchVisible(singleCode);

  await expect.poll(async () =>
    await codeVisible() || await anyMatchVisible(useAnotherMethod),
  ).toBe(true);

  if (!(await codeVisible())) {
    await (await firstVisibleMatch(useAnotherMethod)).click();
    const emailCodeMethod = page.getByRole("button", { name: /email code to/i });
    await expect.poll(async () => await anyMatchVisible(emailCodeMethod)).toBe(true);
    await (await firstVisibleMatch(emailCodeMethod)).click();
  }

  await expect.poll(codeVisible).toBe(true);
  if (await anyMatchVisible(digitOne)) {
    await (await firstVisibleMatch(digitOne)).click();
    await page.keyboard.type("424242", { delay: 100 });
  } else {
    await (await firstVisibleMatch(singleCode)).fill("424242");
  }

  // The mounted SignIn component must consume its forceRedirectUrl. No helper
  // navigation or forced page.goto is allowed across this proof boundary.
  await expect(page).toHaveURL((url) =>
    url.origin === expectedOrigin &&
    url.pathname === invitePath &&
    url.search === "" &&
    url.hash === "",
  );
  return readVerifiedIdentity(page, email);
}

async function wrongAccountDiagnostic(
  page: Page,
  invitePath: string,
  creatorEmail: string,
  errors: Readonly<{
    consoleCount: number;
    pageCount: number;
    pageClass: PageErrorClass;
  }>,
): Promise<WrongAccountDiagnostic> {
  const currentPath = new URL(page.url()).pathname;
  const routeClass = currentPath === invitePath
    ? "invite"
    : currentPath === "/sign-in"
      ? "sign-in"
      : currentPath === "/sign-up"
        ? "sign-up"
        : currentPath.startsWith("/app")
          ? "app"
          : "other";
  const browserIdentity = await page.evaluate((expectedEmail) => {
    const runtime = window.Clerk;
    const user = runtime?.user;
    const primary = user?.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    );
    return {
      clerkLoaded: Boolean(runtime?.loaded),
      signedIn: Boolean(user),
      primaryVerified: primary?.verification?.status === "verified",
      expectedCreator:
        primary?.emailAddress?.toLowerCase() === expectedEmail.toLowerCase(),
    };
  }, creatorEmail);
  const switchAccount = await page.getByRole("button", {
    name: "Sign out and use the invited account",
  });
  const switchAccountVisible = await anyMatchVisible(switchAccount);
  const wrongCopyVisible = await anyMatchVisible(
    page.getByText(/Use the email address this invite was sent to/),
  );
  const unverifiedCopyVisible = await anyMatchVisible(
    page.getByText(/Verify the invited email address before accepting/),
  );
  const branches = [
    {
      state: "signedOut" as const,
      visible: await anyMatchVisible(page.getByRole("link", { name: "Sign in to accept" })),
    },
    {
      state: "wrongVerified" as const,
      visible: switchAccountVisible && wrongCopyVisible,
    },
    {
      state: "wrongUnverified" as const,
      visible: switchAccountVisible && unverifiedCopyVisible,
    },
    {
      state: "matchingAccount" as const,
      visible: await anyMatchVisible(page.getByRole("button", { name: "Accept invite" })),
    },
    {
      state: "accepted" as const,
      visible: await anyMatchVisible(page.getByRole("heading", { name: "This invite has already been accepted." })),
    },
    {
      state: "expired" as const,
      visible: await anyMatchVisible(page.getByRole("heading", { name: "This invite has expired." })),
    },
    {
      state: "missing" as const,
      visible: await anyMatchVisible(page.getByRole("heading", { name: "This invite link doesn’t exist." })),
    },
  ];
  const visibleBranches = branches.filter((branch) => branch.visible);
  return {
    routeClass,
    rendered: {
      serverState: visibleBranches.length === 1
        ? visibleBranches[0]!.state
        : "unclassified",
      genericError: await anyMatchVisible(page.getByText(/Application error|Something went wrong/)),
      clerkUi: await anyMatchVisible(page.locator(".cl-rootBox")),
      wrongCopyVisible,
      unverifiedCopyVisible,
      switchVisible: switchAccountVisible,
    },
    browserIdentity,
    errors,
  };
}

test("controlled recipient accepts B, completes assigned work, and loses B after removal", async ({ browser }) => {
  const creatorEmail = required("SIGNAL_RECIPIENT_CREATOR_EMAIL");
  const recipientEmail = required("SIGNAL_RECIPIENT_RECIPIENT_EMAIL");
  const creatorContext = await browser.newContext();
  const recipientContext = await browser.newContext();
  const creatorPage = await creatorContext.newPage();
  const recipientPage = await recipientContext.newPage();
  const creatorErrors: {
    consoleCount: number;
    pageCount: number;
    pageClass: PageErrorClass;
  } = { consoleCount: 0, pageCount: 0, pageClass: "none" };
  creatorPage.on("console", (message) => {
    if (message.type() === "error") creatorErrors.consoleCount += 1;
  });
  creatorPage.on("pageerror", (error) => {
    creatorErrors.pageCount += 1;
    const nextClass = classifyPageError(error);
    creatorErrors.pageClass = creatorErrors.pageClass === "none" || creatorErrors.pageClass === nextClass
      ? nextClass
      : "other";
    // Actual runs redirect stdout/stderr to private custody. The sanitized
    // receipt retains only the fixed class and count below.
    console.error("recipient identity private page error", error);
  });

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
    try {
      await clerk.loaded({ page: creatorPage });
    } catch {
      // The fixed classifier below records that the client runtime did not load.
    }
    await expect.poll(async () => {
      const diagnostic = await wrongAccountDiagnostic(
        creatorPage,
        invitePath,
        creatorEmail,
        creatorErrors,
      );
      observeWrongAccountDiagnostic(diagnostic);
      return diagnostic;
    }).toMatchObject({
      routeClass: "invite",
      rendered: {
        serverState: "wrongVerified",
      },
      browserIdentity: {
        clerkLoaded: true,
        signedIn: true,
        primaryVerified: true,
        expectedCreator: true,
      },
      errors: {
        pageCount: 0,
        pageClass: "none",
      },
    });
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
    const uiRecipient = await recipientEmailCodeSignIn(
      recipientPage,
      recipientEmail,
      invitePath,
    );
    expect(uiRecipient).toEqual(recipient);
    observe("recipientUiSignInReturned");
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
