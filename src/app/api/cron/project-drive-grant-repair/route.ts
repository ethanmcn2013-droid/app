import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { ProjectDriveGrantRepairResult } from "@/server/connections/project-drive-grant-repair";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type RepairRunner = () => Promise<ProjectDriveGrantRepairResult>;

function bearerMatches(provided: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(provided.padEnd(expected.length, "\0"));
  const right = encoder.encode(expected.padEnd(provided.length, "\0"));
  const width = Math.max(left.length, right.length);
  const paddedLeft = new Uint8Array(width);
  const paddedRight = new Uint8Array(width);
  paddedLeft.set(left);
  paddedRight.set(right);
  return timingSafeEqual(paddedLeft, paddedRight) && provided.length === expected.length;
}

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return bearerMatches(provided, expected);
}

async function defaultRepairRunner(): Promise<ProjectDriveGrantRepairResult> {
  const { repairPendingProjectDriveGrants } = await import(
    "@/server/connections/project-drive-grant-repair"
  );
  return repairPendingProjectDriveGrants();
}

export function createProjectDriveGrantRepairRoute(
  repair: RepairRunner = defaultRepairRunner,
) {
  return async function projectDriveGrantRepairRoute(request: Request) {
    if (!authorized(request)) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }
    if (process.env.SIGNAL_PROJECT_DRIVE_REVOKE_REPAIR_ENABLED !== "true") {
      return NextResponse.json({ ok: true, skipped: "flag-off" });
    }

    const result = await repair();
    return NextResponse.json({ ok: result.failed === 0, ...result });
  };
}

export const GET = createProjectDriveGrantRepairRoute();
