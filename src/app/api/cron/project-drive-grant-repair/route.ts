import "server-only";

import { withStudioHeartbeat } from "@/lib/ops/ping-studio";
import { createProjectDriveGrantRepairRoute } from "./route-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export const GET = withStudioHeartbeat(
  "app_drive_grant_repair",
  createProjectDriveGrantRepairRoute(),
);
