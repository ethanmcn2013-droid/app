# Correction to the 50918cdc observation list

2026-09-05, principal source reconciliation. The archive and original manifest
remain unchanged to preserve provenance.

The observation calling `tasks.signalstudio.ie/p/...` a retired public URL was
incorrect. `docs/SUITE_URL_AND_NAMING_CONTRACT.md`, section “Narrow public and
service hosts”, explicitly reserves that host for published Tasks workspaces and
other existing public/service paths. `src/lib/product-urls.ts` deliberately exports
`TASKS_PUBLIC_DOMAIN`, which the workspace settings copy uses. This is an intended
public artifact boundary, not a new global product or a navigation-contract defect.
No URL/source repair is warranted on that observation. Public-link behavior still
belongs to its existing verification matrix.

The separate observed demo-clock difference and account-settings shell transition
remain observations for the next coherence investigation, not established defects
in authenticated production. This correction changes no passing test, source hash,
archive byte, privacy finding or release gate.
