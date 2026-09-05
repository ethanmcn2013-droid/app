# Sponsored date implementation evidence

The report and archive preserve the scoped candidate at `2d1d7783`, before the
separate legacy creation-path retirement. “Shipped” in that original report
means locally implemented; no production deployment occurred. Final composition,
independent review and receiving acceptance are separate programme gates.

`checkpoint-2d1d7783.zip` preserves all **189 files** from the packet composed
at `097d3b32`, with original paths and byte-for-byte contents. Its SHA-256 is
`e0244f2c606a49c1b2758906542badf7e62b869f481fdef29d4bd2e518e0a509`. The adjacent JSON lists every file size and hash;
ZIP integrity and every member were verified before packaging was adopted.

The scripts are historical reproductions with explicit task-local paths, not
current package commands. Extract into a fresh scratch directory to inspect
them; read the report's failed-provider and fixture limits before any reuse.
The earlier unarchived packet remains in Git `097d3b32` and original task output.
Current product regression tests remain under `src/` in the standard test gate.

Packaging followed a full lint failure caused solely by the archived CommonJS
scripts. No lint rule, production file or historical receipt was rewritten.
The failed lint log remains in the principal's `app-097d-composition-gates`
receipt. This archive does not establish a new passing gate or close RC-3/Atlas.
