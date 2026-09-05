"use server";

import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/lib/access-mode";
import type { WeddingDateResult, WeddingDateUpdate } from "@/lib/sponsored-wedding-date";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { updateSponsoredWeddingDate } from "@/server/db/sponsored-wedding-date";

export async function saveSponsoredWeddingDate(input: WeddingDateUpdate): Promise<WeddingDateResult> {
  if (isDemoMode()) return { ok: false, reason: "preview" };
  let result: WeddingDateResult;
  try {
    const actorUserId = await getCurrentUser();
    result = await updateSponsoredWeddingDate(db, { ...input, actorUserId });
  } catch {
    return { ok: false, reason: "failed" };
  }
  // A cache failure after commit must not report the durable save as failed.
  if (result.ok) {
    try { revalidatePath("/app", "layout"); } catch { /* next read uses durable state */ }
  }
  return result;
}
