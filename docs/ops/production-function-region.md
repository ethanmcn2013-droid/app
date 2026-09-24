# Production function region

**Region: `dub1` (Dublin), set 24 September 2026.** It is a project setting (`resourceConfig.functionDefaultRegions`), not `vercel.json`. The release operator treats `vercel.json` as frozen.

## Why

The App's Turso databases sit in AWS `eu-west-1` (Ireland): the Studio and entitlements stores are documented there, in the same Turso org as the App's stores. Until this change the App's functions ran in `iad1` (Washington, DC). Every database round trip crossed the Atlantic twice, so query-heavy pages were slow. Warm server-render times measured on 24 Sep, before the change:

| Page | Time |
|---|---|
| Inbox | 11–12 s |
| Tasks | 8.4–8.9 s |
| Home | ~2.4 s |
| Notes | ~2.1 s |
| Projects | ~2.1 s |
| Timeline | ~1.2 s |

The Hobby plan runs functions in one region, so it should be the one next to the data.

## Rollback

1. Set the region back to `iad1`: `vercel api /v9/projects/<project>?teamId=<team> -X PATCH` with body `{"resourceConfig":{"functionDefaultRegions":["iad1"]}}`.
2. Promote the last `iad1` deployment (`dpl_EqEq1iAP9tYYuzB9FspJfPDaESn6`, App `64210b1e`) through the release operator.

A deployment keeps the region it was built with, so promotion alone restores the old behaviour for that build.

## Check after any region change

- Re-time the pages above as the signed-in founder.
- Confirm the scheduled jobs (`vercel crons run <path>`) still return 200 and ping Studio.
- Confirm production logs show no new 5xx.
