import "server-only";

import { isDemoMode } from "@/lib/access-mode";
import { db } from "@/modules/timeline/server/db/timeline-client";
import type { QualifiedViewPayload } from "@/modules/timeline/lib/qualified-view";
import {
  recordQualifiedViewWith,
  type QualifiedViewWriteResult,
} from "@/modules/timeline/server/qualified-view-store";

export async function recordQualifiedAudienceView(
  rawToken: string,
  payload: QualifiedViewPayload,
): Promise<QualifiedViewWriteResult | "demo"> {
  if (isDemoMode()) return "demo";
  return recordQualifiedViewWith(db, rawToken, payload);
}
