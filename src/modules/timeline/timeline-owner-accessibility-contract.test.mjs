import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const timelineRoot = path.join(
  process.cwd(),
  "src",
  "modules",
  "timeline",
);

function read(relativePath) {
  return fs.readFileSync(path.join(timelineRoot, relativePath), "utf8");
}

test("owner milestone ordering has focusable controls and polite confirmation", () => {
  const source = read(
    "app/plan/[projectSlug]/_components/curation-surface.tsx",
  );

  assert.match(source, /aria-label=\{`Move \$\{node\.title\} up`\}/);
  assert.match(source, /aria-label=\{`Move \$\{node\.title\} down`\}/);
  assert.match(source, /buildOwnerKeyboardReorder/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Position \$\{result\.position\} of \$\{result\.siblingCount\}/);
});

test("automatic Tasks sync failure remains visible and retryable", () => {
  const source = read(
    "app/plan/[projectSlug]/_components/curation-surface.tsx",
  );

  assert.match(source, /autoSyncState\.status === "error"/);
  assert.match(source, /Tasks milestones could not refresh automatically/);
  assert.match(source, /Retry sync/);
  assert.match(source, /onClick=\{\(\) => void runAutoSync\(\)\}/);
});

test("one-time audience link copy has an announced manual recovery path", () => {
  const source = read("app/audience/audience-manager.tsx");

  assert.match(source, /try \{/);
  assert.match(source, /catch \{/);
  assert.match(source, /Automatic copy was blocked/);
  assert.match(source, /Select link again/);
  assert.match(source, /role="status"/);
  assert.match(source, /requestAnimationFrame\(selectLink\)/);
});

test("Timeline loading boundaries announce progress without exposing skeletons", () => {
  for (const relativePath of [
    "app/loading.tsx",
    "app/plan/[projectSlug]/loading.tsx",
  ]) {
    const source = read(relativePath);
    assert.match(source, /role="status"/);
    assert.match(source, /aria-live="polite"/);
    assert.match(source, /aria-hidden/);
  }
});

test("owner controls meet the 44px mobile target and error copy stays factual", () => {
  const projectPage = read("app/plan/[projectSlug]/page.tsx");
  const audienceManager = read("app/audience/audience-manager.tsx");
  const errorBoundary = read("app/error.tsx");

  assert.equal(
    (projectPage.match(/min-h-11/g) ?? []).length >= 2,
    true,
    "both owner mode controls must be at least 44px high",
  );
  assert.match(
    audienceManager,
    /const primaryButton =\s*\n\s*"[^"]*\bmin-h-11\b/,
  );
  assert.doesNotMatch(errorBoundary, /Nothing was lost|your .* (?:is|are) saved/i);
  assert.match(errorBoundary, /could not finish loading/);
});

test("manual milestone add restores focus to its initiating control", () => {
  const source = read(
    "app/plan/[projectSlug]/_components/curation-surface.tsx",
  );

  assert.match(source, /manualAddTriggerRef/);
  assert.match(source, /requestAnimationFrame\(\(\) => \{/);
  assert.match(source, /manualAddTriggerRef\.current\?\.focus\(\)/);
  assert.match(source, /onClose\("complete"\)/);
  assert.match(source, /restoreFocusAfterNodeCount/);
  assert.equal(
    (source.match(/onClose=\{closeManualAdd\}/g) ?? []).length,
    2,
  );
});
