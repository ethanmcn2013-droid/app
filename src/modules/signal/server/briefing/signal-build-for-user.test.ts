import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  buildBriefingForUser,
  DEMO_BRIEFING_NOW,
} from "./signal-build-for-user";
import {
  REVIEW_MENU_MILESTONE,
  REVIEW_SUITE_FIXTURE,
} from "@/lib/review-suite-fixture";
import { ledgerFromLegacyBriefing } from "../../lib/analytics/ledger-adapters";
import { legacyLedgerTasksHref } from "../../lib/analytics/ledger-task-target";

/**
 * signal-build-for-user.test.ts — ported from
 * signal/src/server/briefing/build-for-user.test.ts.
 *
 * S8: ported copy; this test exercises the module's copy of
 * buildBriefingForUser, not the cron's copy in signal.git.
 *
 * Demo path: sets SIGNAL_ACCESS_MODE=demo so isDemoMode() returns true,
 * bypassing DB calls and using the fixed synthetic clock.
 */
test("demo briefing uses a fixed synthetic clock", async () => {
  const originalMode = process.env.SIGNAL_ACCESS_MODE;
  const originalPublicMode = process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalPeriodFlag = process.env.SIGNAL_PERIOD_SIGNAL_ENABLED;

  process.env.SIGNAL_ACCESS_MODE = "demo";
  delete process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE;
  delete process.env.VERCEL_ENV;
  delete process.env.SIGNAL_PERIOD_SIGNAL_ENABLED;

  try {
    const result = await buildBriefingForUser({
      clerkId: "demo-user",
      cadence: "daily",
    });
    assert.equal(result.kind, "ok");
    if (result.kind === "ok") {
      assert.equal(result.briefing.generatedAt, DEMO_BRIEFING_NOW);
      assert.deepEqual(result.authorizedScope.scope, {
        kind: "workspace",
        workspaceId: REVIEW_SUITE_FIXTURE.workspace.id,
      });
      assert.equal(
        result.authorizedScope.label,
        REVIEW_SUITE_FIXTURE.workspace.name,
      );
      assert.deepEqual(
        result.catalog.workspaces.map(({ id, name }) => ({ id, name })),
        [{
          id: REVIEW_SUITE_FIXTURE.workspace.id,
          name: REVIEW_SUITE_FIXTURE.workspace.name,
        }],
      );
      assert.ok(
        result.briefing.needsAttention.length +
          result.briefing.quietRisks.length >
          0,
      );
      assert.match(
        JSON.stringify([
          ...result.briefing.needsAttention,
          ...result.briefing.quietRisks,
        ]),
        /The Orchard, events.*Mara & Finn/,
      );

      const serverBriefItems = [
        ...result.briefing.needsAttention,
        ...result.briefing.quietRisks,
      ];
      assert.ok(
        serverBriefItems.some(
          (item) => item.id === REVIEW_MENU_MILESTONE.sourceId,
        ),
        "Signal must surface the exact menu-tasting object from the shared review journey",
      );

      const ledger = ledgerFromLegacyBriefing(result.briefing, {
        generatedAtLabel: "Thursday, 09:00",
        scopeLabel: result.authorizedScope.label,
        scopeKind: "workspace",
        allowedAppOrigin: "https://app.signalstudio.ie",
      });
      const serializedLedger = JSON.stringify(ledger);
      assert.ok(ledger.entries.length <= 3);
      assert.doesNotMatch(
        serializedLedger,
        new RegExp(REVIEW_MENU_MILESTONE.sourceId),
      );
      assert.ok(
        ledger.entries.some(
          (entry) =>
            legacyLedgerTasksHref(
              result.briefing,
              result.authorizedScope,
              entry.id,
              {
                planningPeriodId:
                  REVIEW_SUITE_FIXTURE.workspace.planningPeriodId,
                projectId: REVIEW_SUITE_FIXTURE.projects[0].id,
              },
            ) ===
            `/app/tasks?task=${REVIEW_MENU_MILESTONE.sourceId}&workspaceId=${REVIEW_SUITE_FIXTURE.workspace.id}&planningPeriodId=${REVIEW_SUITE_FIXTURE.workspace.planningPeriodId}&projectId=${REVIEW_SUITE_FIXTURE.projects[0].id}`,
        ),
        "the opaque menu-tasting ledger row must resolve to its authorized Tasks receipt",
      );
    }
  } finally {
    if (originalMode === undefined) delete process.env.SIGNAL_ACCESS_MODE;
    else process.env.SIGNAL_ACCESS_MODE = originalMode;
    if (originalPublicMode === undefined) {
      delete process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE;
    } else {
      process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = originalPublicMode;
    }
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    if (originalPeriodFlag === undefined) {
      delete process.env.SIGNAL_PERIOD_SIGNAL_ENABLED;
    } else {
      process.env.SIGNAL_PERIOD_SIGNAL_ENABLED = originalPeriodFlag;
    }
  }
});
