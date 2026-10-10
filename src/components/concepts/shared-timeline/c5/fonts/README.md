# Newsreader for The Dispatch concept

These unchanged normal and italic variable TrueType files are from
[`google/fonts` at `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`](https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/newsreader).
The renamed local filenames retain the exact upstream bytes. `provenance.json`
pins Git blobs, sizes, SHA-256 hashes, source metadata and delivery settings.
`OFL.txt` contains the upstream copyright and SIL Open Font License 1.1.

C5 uses `next/font/local` to avoid generated Google font queries containing
unescaped ampersands. Both styles retain weights 400, 500 and 600, the
`--dp-serif-font` variable and `swap` display. The inherited optical axis is
explicitly 16, matching Google Fonts' registry default rather than these
variable files' internal default of 18. CSS font weights remain independent.

The two full fonts total 947,348 bytes. No converter was installed, and no
glyphs or variation axes were removed. This development/review concept remains
under the existing production registry exclusion.

Next's local Times New Roman fallback calculation differs from its precomputed
Google family metrics: normal defaults are ascent 73.61%, descent 26.54%,
line gap 0%, size adjust 99.84%, versus 69.68%, 25.12%, 0%, 105.48% previously.
These fallback values affect font-loading layout, not the requested family.
The local files, optical sizing, loading shift and all six faces need fresh
build and concept/browser qualification; pixel equality is not claimed.
