# Current state — the Signal Studio application

Last updated 2026-07-29.

This repository is the unified Signal Studio application. It holds Notes, Tasks,
Timeline, and Signal as four modules behind
`app.signalstudio.ie/app/{notes,tasks,timeline,signal}`. The repository name is
historical and does not mean this is the Tasks product alone.

Latest dispatch: **T·108**, the Notes continuity release. `CHANGELOG.md` is
the authority for what shipped and when.

## Where current truth lives

| Question | Read |
|---|---|
| What shipped, and when | `CHANGELOG.md` in this repo |
| What may be claimed publicly | `studio/docs/shipped-state.md` |
| What the founder is blocking | `studio/content/hq/operator-todos/**` |
| Product and operating decisions | `studio/content/hq/decisions/**` |
| URL and naming rules | `docs/SUITE_URL_AND_NAMING_CONTRACT.md` |

This file previously carried a running narrative of cycles T-1 through T·66. It
stopped being updated in May 2026 while the dispatch record ran on to T·104, so
for two months it described a product that no longer existed. A state file that
drifts is worse than no state file. It now points at the records that are kept
current instead of restating them.
