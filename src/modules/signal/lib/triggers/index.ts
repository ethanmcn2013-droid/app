/**
 * triggers/index.ts, Registry of all triggers.
 *
 * Cycle 6.4 populated this with the 10 v1 triggers. Order doesn't
 * matter, the orchestrator runs all of them and compression handles
 * ranking + capping. Adding a trigger is a code change with a code
 * review (PRODUCT.md §5.1).
 */

import type { Trigger } from "./types";
import { blocked } from "./blocked";
import { overdue } from "./overdue";
import { overload } from "./overload";
import { dependencyStall } from "./dependency-stall";
import { momentumPositive } from "./momentum-positive";
import { streak } from "./streak";
import { inactiveProject } from "./inactive-project";
import { singlePointOfFailure } from "./single-point-of-failure";
import { slowBurnDeadline } from "./slow-burn-deadline";
import { unresolvedRecurringBlock } from "./unresolved-recurring-block";

export const TRIGGERS: Trigger[] = [
  blocked,
  overdue,
  overload,
  dependencyStall,
  momentumPositive,
  streak,
  inactiveProject,
  singlePointOfFailure,
  slowBurnDeadline,
  unresolvedRecurringBlock,
];
