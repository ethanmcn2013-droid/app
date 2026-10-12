"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import { opLog } from "@/server/operational-log";
import { authorizeStoredProject } from "@/server/actions/project-authz";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import {
  GuestListError,
  addGuestWith,
  addHouseholdWith,
  deleteGuestWith,
  deleteHouseholdWith,
  importHouseholdsWith,
  readWeddingProjectWith,
  setHouseholdRsvpWith,
  updateGuestWith,
  updateHouseholdWith,
  type GuestPatch,
  type HouseholdPatch,
} from "@/server/wedding/guests";
import { groupImport, parseGuestImport, type NewHouseholdInput, type Rsvp } from "@/lib/wedding/guests";

/**
 * Wedding tools: guest list writes (12 Oct 2026).
 *
 * Every action takes the Project id the page rendered and proves it inside
 * the writer transaction (ADR 0001 §9, object operation): membership, the
 * `createOrEditTasks` capability, an archived Project refused, a Project
 * being deleted refused, and the Project must be a wedding. Every statement
 * inside also carries the Project id, so an id from another Project matches
 * nothing. Demo and Review touch no database and answer `preview` first.
 */

export type WeddingGuestResult<T = undefined> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; reason: "preview" | "unavailable" | "invalid" | "not-found" | "limit"; message: string }>;

const UNAVAILABLE = "This guest list isn’t available.";
const PREVIEW = "This is a sample guest list, so changes aren’t saved.";

async function withGuestListWrite<T>(projectId: string, write: (workspaceId: string, actorUserId: string, tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>): Promise<WeddingGuestResult<T>> {
  if (isDemoMode()) return { ok: false, reason: "preview", message: PREVIEW };
  try {
    const actorUserId = await getCurrentUser();
    const value = await db.transaction(async (tx) => {
      const grant = await authorizeStoredProject({
        storedProjectId: projectId,
        capability: "createOrEditTasks",
        actorUserId,
        archivePolicy: "enforce",
        executor: tx,
      });
      if (!grant.ok) throw new GuestListError("not-found", UNAVAILABLE);
      await assertProjectNotDeleting(tx, grant.projectId);
      const project = await readWeddingProjectWith(tx, grant.projectId);
      if (!project.isWedding) throw new GuestListError("not-found", UNAVAILABLE);
      return write(grant.projectId, actorUserId, tx);
    }, { behavior: "immediate" });
    try {
      revalidatePath("/app/wedding/guests");
    } catch {
      // Outside a request (tests), there is no cache to refresh.
    }
    return { ok: true, value };
  } catch (error) {
    if (error instanceof GuestListError) {
      return { ok: false, reason: error.code === "not-found" ? "not-found" : error.code, message: error.message };
    }
    // The error's name only: a message can carry the names people typed.
    opLog("error", "wedding_list", "Write failed", { failureKind: error instanceof Error ? error.name : "unknown" });
    return { ok: false, reason: "unavailable", message: "That didn’t save. Nothing was changed. Try again." };
  }
}

export async function addHouseholdAction(projectId: string, input: NewHouseholdInput): Promise<WeddingGuestResult<string>> {
  return withGuestListWrite(projectId, (ws, actor, tx) => addHouseholdWith(tx, ws, actor, input));
}

export async function updateHouseholdAction(projectId: string, householdId: string, patch: HouseholdPatch): Promise<WeddingGuestResult> {
  return withGuestListWrite(projectId, async (ws, _actor, tx) => { await updateHouseholdWith(tx, ws, householdId, patch); return undefined; });
}

export async function deleteHouseholdAction(projectId: string, householdId: string): Promise<WeddingGuestResult> {
  return withGuestListWrite(projectId, async (ws, _actor, tx) => { await deleteHouseholdWith(tx, ws, householdId); return undefined; });
}

export async function setHouseholdRsvpAction(projectId: string, householdId: string, rsvp: Rsvp): Promise<WeddingGuestResult> {
  return withGuestListWrite(projectId, async (ws, _actor, tx) => { await setHouseholdRsvpWith(tx, ws, householdId, rsvp); return undefined; });
}

export async function addGuestAction(
  projectId: string,
  householdId: string,
  input: Readonly<{ firstName?: string | null; lastName?: string | null; isChild?: boolean; plusOneOf?: string | null }>,
): Promise<WeddingGuestResult<string>> {
  return withGuestListWrite(projectId, (ws, _actor, tx) => addGuestWith(tx, ws, householdId, input));
}

export async function updateGuestAction(projectId: string, guestId: string, patch: GuestPatch): Promise<WeddingGuestResult> {
  return withGuestListWrite(projectId, async (ws, _actor, tx) => { await updateGuestWith(tx, ws, guestId, patch); return undefined; });
}

export async function deleteGuestAction(projectId: string, guestId: string): Promise<WeddingGuestResult> {
  return withGuestListWrite(projectId, async (ws, _actor, tx) => { await deleteGuestWith(tx, ws, guestId); return undefined; });
}

/** The server re-reads the pasted text itself; a client's grouping is never trusted. */
export async function importGuestsAction(projectId: string, text: string): Promise<WeddingGuestResult<{ households: number; guests: number }>> {
  if (typeof text !== "string" || text.length > 200_000) {
    return { ok: false, reason: "invalid", message: "That list is too long to read in one go." };
  }
  const groups = groupImport(parseGuestImport(text).rows);
  return withGuestListWrite(projectId, (ws, actor, tx) => importHouseholdsWith(tx, ws, actor, groups));
}
