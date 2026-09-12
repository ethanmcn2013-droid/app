import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

type Stage =
  | "testingTokenIssued"
  | "twoSessionsIssued"
  | "signedOutInviteShown"
  | "wrongAccountRefused"
  | "inviteAccepted"
  | "recipientTaskCompleted"
  | "homeReturned"
  | "creatorReadback"
  | "replayRefused"
  | "removedMemberRefused";

export type WrongAccountDiagnostic = Readonly<{
  routeClass: "invite" | "sign-in" | "sign-up" | "app" | "other";
  rendered: Readonly<{
    serverState:
      | "signedOut"
      | "wrongVerified"
      | "wrongUnverified"
      | "matchingAccount"
      | "missing"
      | "expired"
      | "accepted"
      | "unclassified";
    genericError: boolean;
    clerkUi: boolean;
    wrongCopyVisible: boolean;
    unverifiedCopyVisible: boolean;
    switchVisible: boolean;
  }>;
  browserIdentity: Readonly<{
    clerkLoaded: boolean;
    signedIn: boolean;
    primaryVerified: boolean;
    expectedCreator: boolean;
  }>;
  errors: Readonly<{
    consoleCount: number;
    pageCount: number;
    pageClass:
      | "none"
      | "missingClerkProvider"
      | "multipleClerkProviders"
      | "hydration"
      | "other";
  }>;
}>;

function evidencePath(): string {
  const value = process.env.SIGNAL_RECIPIENT_EVIDENCE_PATH?.trim();
  if (!value) throw new Error("Missing sanitized evidence path.");
  return value;
}

export function observe(stage: Stage): void {
  const filePath = evidencePath();
  const current = existsSync(filePath)
    ? JSON.parse(readFileSync(filePath, "utf8")) as {
        stages?: Record<string, boolean>;
        wrongAccountDiagnostic?: WrongAccountDiagnostic;
      }
    : {};
  const next = {
    schemaVersion: 2,
    stages: { ...current.stages, [stage]: true },
    wrongAccountDiagnostic: current.wrongAccountDiagnostic,
  };
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  renameSync(temporary, filePath);
}

export function observeWrongAccountDiagnostic(
  diagnostic: WrongAccountDiagnostic,
): void {
  const filePath = evidencePath();
  const current = existsSync(filePath)
    ? JSON.parse(readFileSync(filePath, "utf8")) as { stages?: Record<string, boolean> }
    : {};
  const next = {
    schemaVersion: 2,
    stages: current.stages ?? {},
    wrongAccountDiagnostic: diagnostic,
  };
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  renameSync(temporary, filePath);
}
