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

function evidencePath(): string {
  const value = process.env.SIGNAL_RECIPIENT_EVIDENCE_PATH?.trim();
  if (!value) throw new Error("Missing sanitized evidence path.");
  return value;
}

export function observe(stage: Stage): void {
  const filePath = evidencePath();
  const current = existsSync(filePath)
    ? JSON.parse(readFileSync(filePath, "utf8")) as { stages?: Record<string, boolean> }
    : {};
  const next = {
    schemaVersion: 1,
    stages: { ...current.stages, [stage]: true },
  };
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  renameSync(temporary, filePath);
}
