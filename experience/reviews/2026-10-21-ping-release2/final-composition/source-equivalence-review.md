# Independent source-equivalence review — composed Ping Release 2

Reviewer: `/root/r2_independent_review`  
Date: 21 October 2026  
Scope: read-only comparison of the frozen model-evaluation source inventory at `5c7ba65dc5a5bc18cc798e96e9a9cbcafbd8b27c` against the current composed Git index for PR 308. This is not a new model run or overall release acceptance.

## Decision

**The existing 58/62 fresh-cohort result is applicable as runtime-code-equivalent evidence for the composed tree, with the original cohort identity and fingerprint retained.** The runner's `EVALUATION_SOURCE_FILES` array at both the pinned source and current index contains the same 42 ordered paths. Comparing the 42 exact Git index blobs with the pinned source yielded 41 identical blobs and one difference: `package.json`.

The only `package.json` change is one additive script, `test:files-sources-shelf:browser`, which points to the accepted Files Sources Shelf browser test. The lockfile blob is unchanged. No dependency/version/configuration change was found in the frozen evaluation boundary. Therefore the composed main-branch Files Sources Shelf addition does not alter the evaluated Ping runtime inputs.

## Evidence boundary

The fresh cohort remains exactly the existing run, pinned to `5c7ba65dc5a5bc18cc798e96e9a9cbcafbd8b27c`, with fingerprint `d25a2e678a1b3899874f04d64cd7bc34aa37ae4d40aae06e407fa8c0cd9e907b` and score **58/62**. I did not change or recompute that fingerprint, rescore the cohort, run providers, or modify product code.

This comparison supports reusing the cohort result as evidence about unchanged Ping runtime code in the composition. It does not claim a new evaluation on the merge tree, and it does not establish browser, required-CI, production, or overall release acceptance; those gates remain separately bound to the composed revision.

The repository-side machine-readable comparison is `experience/reviews/2026-10-21-ping-release2/final-composition/source-equivalence-5c-to-composed-index.json`. It records all 42 paths and their base/index blob IDs.