# Independent review: archived project task counts

Date: 2026-10-21
Reviewer: `/root/r2_independent_review`
Base: `ab0650d2dbbd7a72db4482cc208298b18c931c5e`

## Verdict

**No code or authorization blocker found in the scoped count correction.** Both project-catalog and exact-project resolver count queries now require `counted.archived_at IS NULL`, alongside the existing same-workspace, top-level-only, non-Done conditions. This aligns “open task” counts with the board's archive semantics.

The project catalog still obtains rows through the actor's `workspaceMembers` membership join and filters `workspaceMembers.userId = actorUserId`. The exact resolver likewise joins membership and filters by both actor and requested workspace ID before returning a row. The added correlated count is scoped to that authorized workspace. The patch changes no membership, task, project, or Ping authorization behavior; it only changes the count projection.

The two tests add an archived, non-Done root task and assert it is excluded, while existing assertions continue to exclude Done roots and child tasks. The root reports 32/32 focused tests and scoped lint passing; I reviewed the code and test diff, but did not rerun tests. A fresh fixture capture and normal CI remain required because the two edited implementation files and two edited test files change four source pins; no hash-only waiver is appropriate.

The actual shared worktree diff currently contains seven files, not the five initially described: `catalog.ts`, `catalog.test.ts`, `resolve.ts`, `resolve.test.ts`, `CHANGELOG.md`, `experience/critical-fixtures.json`, and `.github/workflows/experience-candidate-capture.yml`. The latter two are narrowly related validation support: the fixture manifest updates hashes for the four changed files, and the capture workflow adds this feature branch to its existing same-repository allowlist. No production secret or deployment permissions are added.

I checked the frozen Release 2 model input list: all 42 paths remain unchanged. None of the seven files in this diff overlaps the 42 inputs; the saved model-source report also records 42/42 identical inputs against the previously qualified tree. The 58/62 evaluation score is not changed or regraded by this fix.

## Evidence boundary

This is a read-only source review of the working diff against the merged Release 2 base. It is not test execution, hosted CI, production deployment, or a receiving result. Keep the production sidebar counter defect open until the fresh capture and required CI pass; then verify the repaired live count behavior if it is included in the release canary.

No code, Git, deployment, provider, or production changes were made by this reviewer.