# Task detail panel materiality review — 8 October 2026

The demo Task detail host adds two explicit panel composition inputs while preserving the default record-first panel and the shared expanded page. The changed mapped source is `src/components/app/detail-panel/task-detail-panel.tsx` (`tasks.surface.task-detail-panel`). This review approves only its scoped materiality hash refresh.

The unchanged registered case, `tasks.surface.task-detail-panel / populated task`, ran against committed source `99314145c98441a36af3f9c667107f60eda55ff3` on the actual built App in synthetic demo/preview mode. Mobile, tablet, desktop and wide each passed. The native process exited 0; its report contains four expected passes, no unexpected, skipped or flaky cases, and no report errors. Source remained stable throughout that run. This case checks the populated default panel, accessibility, runtime failures, document overflow, and the registered keyboard and motion behavior; it does not perform the workshop editing journey.

Independent Sol source and rendered review verified the report, four PNG hashes and byte counts, inspected the actual mobile and desktop captures, and confirmed the current Task host, sheet and stylesheet hashes match the tested source. The reviewer approved the bounded refresh with the limits below. Subsequent qualification-only file relocation does not change those product files; the four-case evidence remains bound to its recorded tested commit, rather than claiming that the whole later commit was browser tested.

Reviewed product hashes:

| Source | SHA-256 |
| --- | --- |
| Task host | `0feacf8d589aa1efe739bf465f83f16bda364f3ce2a58bfecf4c6314263bba79` |
| Task sheet | `e3cd0758af434a0d3839a6867a042484687a5572614d21b2fd24e7a2c189e572` |
| Task stylesheet | `cb37a186bebcb9f63dd494582bf2617a2b226c25d191dc3640d9aff9a9e29c14` |

The report and captures are retained with the private programme evidence. Capture identities:

| Viewport | Bytes | SHA-256 |
| --- | ---: | --- |
| Mobile | 42,378 | `1c5dc992ada2e93ed60f5e2a70e72d1e41285479124ea08186f903e6c487b4ad` |
| Tablet | 85,598 | `073283c5c7cfeed1fb36dcc963f1a5e1cf29dd836e50b410fd60d778447ceea7` |
| Desktop | 154,447 | `3fcdf9c67be53a0f998d68966fc30e77482351085b6caa006aeca3377bf2099b` |
| Wide | 169,126 | `229f92b50e0f4d0578a72c0bd3f1ca164716d963217aaf7d3e4e48a2de36e71b` |

The mapped critical fixture uses the official `node scripts/experience/critical-fixtures.mjs --write` workflow. That command writes the complete registry. A full-object comparison verified its only change was this entry's `materialityHash`, from `d327af847dbbf718` to `0feacf8d589aa1ef`; every other field, entry and date remained unchanged. The fixture manifest and canonical Playwright configuration/specification are unchanged. The registry's historical `lastReviewedAt` remains `2026-07-26`, as required by the existing fixture manifest; this document records the actual review date. Fixture and registry validation both passed after the refresh.

This is a populated-default, four-case source/render review. It supplies no full 132-case attestation, authenticated or persisted proof, workshop editing acceptance, quality-council certification, taste score, founder preference, or release approval. Earlier failed workshop and canonical attempts remain preserved as failed history.
