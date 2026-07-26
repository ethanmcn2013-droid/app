import "server-only";

import { APP_ORIGIN } from "@/lib/product-urls";
import type { BriefingResponse } from "../../lib/analytics/contracts";
import {
  ledgerFromLegacyBriefing,
  ledgerFromProgressiveBriefing,
  type LegacyLedgerOptions,
  type ProgressiveLedgerOptions,
} from "../../lib/analytics/ledger-adapters";
import type { SignalLedgerDTO } from "../../lib/analytics/ledger-contract";
import type { Briefing } from "../../lib/briefing/types";

export function buildLegacyLedgerDTO(
  briefing: Briefing,
  options: Omit<LegacyLedgerOptions, "allowedAppOrigin">,
): SignalLedgerDTO {
  return ledgerFromLegacyBriefing(briefing, {
    ...options,
    allowedAppOrigin: APP_ORIGIN,
  });
}

export function buildProgressiveLedgerDTO(
  briefing: BriefingResponse,
  options: Omit<ProgressiveLedgerOptions, "allowedAppOrigin">,
): SignalLedgerDTO {
  return ledgerFromProgressiveBriefing(briefing, {
    ...options,
    allowedAppOrigin: APP_ORIGIN,
  });
}
