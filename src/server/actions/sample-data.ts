"use server";

/**
 * Sample data actions (operator only).
 *
 * Every action here is gated the same way, in the same order, on the server:
 *
 *  1. review/demo mode returns before anything is read or written;
 *  2. the caller is resolved from the session and must pass `callerIsAdmin`
 *     (`ADMIN_USER_IDS`), the gate the comp-code minter uses. The client is
 *     never trusted: hiding the section is a courtesy, this is the control.
 *
 * The set id is the only client input and is checked against the fixed list.
 * Everything written is owned by the caller; removal only ever reaches the
 * caller's own marked sample Projects (see `@/server/sample-data/seeder`).
 */

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { callerIsAdmin } from "@/server/admin";
import { emitTasksChanged } from "@/server/events";
import { deleteProject } from "@/server/projects/service";
import { isDemoMode } from "@/lib/access-mode";
import { isSampleSetId, type SampleSetId } from "@/lib/sample-data/model";
import {
  removeOutcome,
  sampleDataView,
  seedOutcome,
  type SampleDataView,
  type SampleOutcome,
} from "@/lib/sample-data/copy";
import {
  listSampleData,
  removeAllSampleData,
  removeSampleSet,
  seedSampleSet,
  type RemoveSampleResult,
  type SampleDataDependencies,
  type SampleSetStatus,
  type SeedSampleResult,
} from "@/server/sample-data/seeder";

const REFUSAL = "Unauthorized: operator-only action";

/** Resolve the caller and refuse anyone who is not an operator. */
async function operatorDependencies(): Promise<SampleDataDependencies> {
  const me = await getCurrentUser();
  if (!callerIsAdmin(me)) throw new Error(REFUSAL);
  return {
    database: db,
    actorUserId: me,
    deleteProject: (input) => deleteProject({ actorUserId: input.actorUserId, projectId: input.projectId }),
  };
}

function requireSetId(value: unknown): SampleSetId {
  if (!isSampleSetId(value)) throw new Error("Unknown sample set.");
  return value;
}

/**
 * What the Settings section shows. Null means "there is no such section for
 * this caller": review/demo mode and every non-operator get the same answer.
 */
export async function getSampleDataStatusAction(): Promise<SampleSetStatus[] | null> {
  if (isDemoMode()) return null;
  const me = await getCurrentUser();
  if (!callerIsAdmin(me)) return null;
  return listSampleData({ database: db, actorUserId: me });
}

export type SeedSampleActionResult = SeedSampleResult | Readonly<{ ok: false; reason: "demo" }>;
export type RemoveSampleActionResult = RemoveSampleResult | Readonly<{ ok: false; reason: "demo" }>;

/**
 * The Settings section, ready to render. Null means "there is no such section
 * for this caller": review/demo mode and every non-operator.
 */
export async function getSampleDataViewAction(): Promise<SampleDataView | null> {
  const status = await getSampleDataStatusAction();
  return status === null ? null : sampleDataView(status);
}

/** What the section shows after an action: the outcome and the fresh view. */
export type SampleDataRun = Readonly<{ outcome: SampleOutcome; view: SampleDataView | null }>;

export async function runSeedSampleSetAction(setId: SampleSetId): Promise<SampleDataRun> {
  const result = await seedSampleSetAction(setId);
  return { outcome: seedOutcome(result), view: await getSampleDataViewAction() };
}

export async function runRemoveSampleSetAction(setId: SampleSetId): Promise<SampleDataRun> {
  const result = await removeSampleSetAction(setId);
  return { outcome: removeOutcome([result]), view: await getSampleDataViewAction() };
}

export async function runRemoveAllSampleDataAction(): Promise<SampleDataRun> {
  const results = await removeAllSampleDataAction();
  return { outcome: removeOutcome(Array.isArray(results) ? results : [results]), view: await getSampleDataViewAction() };
}

/** Add one sample set to the calling operator's account. Safe to run again. */
export async function seedSampleSetAction(setId: SampleSetId): Promise<SeedSampleActionResult> {
  if (isDemoMode()) return { ok: false, reason: "demo" };
  const deps = await operatorDependencies();
  const result = await seedSampleSet(deps, requireSetId(setId));
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "seed" });
  return result;
}

/** Remove one sample set: the caller's marked sample Projects, nothing else. */
export async function removeSampleSetAction(setId: SampleSetId): Promise<RemoveSampleActionResult> {
  if (isDemoMode()) return { ok: false, reason: "demo" };
  const deps = await operatorDependencies();
  const result = await removeSampleSet(deps, requireSetId(setId));
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "seed" });
  return result;
}

/** Remove every sample set the calling operator has added. */
export async function removeAllSampleDataAction(): Promise<
  RemoveSampleResult[] | Readonly<{ ok: false; reason: "demo" }>
> {
  if (isDemoMode()) return { ok: false, reason: "demo" };
  const deps = await operatorDependencies();
  const results = await removeAllSampleData(deps);
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "seed" });
  return results;
}
