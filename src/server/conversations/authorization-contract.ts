/**
 * Executable PC-01 policy oracle, NOT an authorization adapter.
 * Inputs must eventually be loaded from canonical rows in one primary transaction.
 * A caller-created snapshot, cached membership or client epoch is never a grant.
 */
import type { ConversationKind, PairState } from "../../lib/conversations/contracts";

export type AuthorizationSnapshot = Readonly<{
  actorId: string;
  requestedProjectId: string;
  storedProjectId: string | null;
  projectExists: boolean;
  actorActive: boolean;
  currentProjectMember: boolean;
  archived: boolean;
  kind: ConversationKind;
  audienceEpoch: number;
  expectedAudienceEpoch?: number;
  pairUserIds: readonly string[];
  pairState: PairState | null;
  bothPairMembersCurrent: boolean;
  actorRetainsHistory: boolean;
}>;
export type PolicyDecision = Readonly<{ allowed: true }> | Readonly<{
  allowed: false;
  reason: "unavailable" | "archived" | "audience_changed" | "consent_required" | "read_only";
}>;

export function conversationPolicy(snapshot: AuthorizationSnapshot, operation: "read" | "write"): PolicyDecision {
  const deny = (reason: Exclude<PolicyDecision, { allowed: true }> ["reason"]): PolicyDecision => ({ allowed: false, reason });
  if (!snapshot.actorId || !snapshot.projectExists || !snapshot.actorActive || !snapshot.currentProjectMember ||
      !snapshot.storedProjectId || snapshot.storedProjectId !== snapshot.requestedProjectId) return deny("unavailable");
  if (snapshot.kind === "dm") {
    if (snapshot.pairUserIds.length !== 2 || new Set(snapshot.pairUserIds).size !== 2 ||
        !snapshot.pairUserIds.includes(snapshot.actorId)) return deny("unavailable");
    if (snapshot.pairState === "pending" || snapshot.pairState === "declined") return deny("consent_required");
    if (!snapshot.actorRetainsHistory || snapshot.pairState === null) return deny("unavailable");
    if (operation === "write" && (snapshot.pairState !== "active" || !snapshot.bothPairMembersCurrent)) return deny("read_only");
  }
  if (operation === "write") {
    if (snapshot.archived) return deny("archived");
    if (!Number.isSafeInteger(snapshot.audienceEpoch) || snapshot.audienceEpoch < 1 ||
        !Number.isSafeInteger(snapshot.expectedAudienceEpoch) || snapshot.expectedAudienceEpoch !== snapshot.audienceEpoch) {
      return deny("audience_changed");
    }
  }
  return { allowed: true };
}
