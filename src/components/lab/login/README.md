# Login lab

Sign-in directions for Signal Studio, built to be compared side by side before
one is chosen and taken into `/sign-in`.

Review-only. Nothing here mounts Clerk, posts anywhere, or reads a session. The
routes are `robots: noindex` and follow the same contract as `/lab/task-detail`.

## Routes

| Route                 | What it is                                        |
| --------------------- | ------------------------------------------------- |
| `/lab/login`          | The index: every direction and what each argues   |
| `/lab/login/spine-v2` | E · Spine v2, the panel-review rebuild of D       |
| `/lab/login/spine`    | D · Spine, kept as the before                     |
| `/lab/login/desk`     | A · Desk                                          |
| `/lab/login/line`     | B · Line                                          |
| `/lab/login/rail`     | C · Rail                                          |

On a direction: `1` to `5` to flip between them, `0` for the index, `d` for
light and dark, `n` for known/new device (Spine v2 responds; the others
ignore it), `h` to drop the review bar before a screenshot.

## Light and dark

The review bar writes `data-theme` on the document element, which is where
`src/ds/theme-overrides.css` keys the dark mapping. That file, not the
`[data-theme="dark"]` block in `tokens.css`, is the live contract: it is
imported afterwards and its `var()`-only overrides win.

Two things it deliberately does not remap, both of which will bite anything
built here:

- **`--accent-tint`** stays `--indigo-50`. Use `--accent-soft` for hover fills
  on a themed surface, since it is translucent indigo and composites over
  either background. The tint flashes near-white on a dark card.
- **`--paper` as a foreground.** It flips to near-black, so white-on-indigo
  becomes black-on-indigo. Use `--indigo-50` for text sitting on `--accent`.

Directions built on semantic tokens follow the theme for free. Anything painted
with an `--x-studio-*` chrome value does not, by design, and seeing which is
which is part of the review. D is the only direction designed for both from the
start; A and B would theme with small fixes, C is charcoal by intent.

The switch also sets `data-theme-switching` for one frame, which suppresses
transitions so the swap is atomic. Without it, every surface that transitions
`background` cross-fades while the rest snaps, and the theme arrives in two
stages. Production needs the same trick.

## The directions

**E · Spine v2.** D rebuilt to the 2026-07-28 panel review. The corners anchor
to the `--container` stage grid instead of the viewport edges, the stations
pull inward onto the stage, and the travelled segment of the line stays lit
behind the dot. Hierarchy inverted: "Continue as Ethan" is the accent-filled
primary, providers share one row, email folds away behind "Continue with
email", and the email submit stays ink so the accent is spent once. The
`signal` station sits exactly over the QR card's centre by construction
(shared CSS vars, see the geometry comment at the top of
`direction-spine-v2.module.css`), so the dot's journey ends at the product
that ends up in your pocket. The new-device preview moved out of the card and
into the review bar.

**D · Spine.** The fusion asked for at review: C's chrome and containment with
B's line. The line is no longer decoration, it carries the four products as
stations, and the indigo dot travels it once on arrival before settling on
Signal. The auth is a full card with weight on it rather than a column of text
in white space, which is what made B read as unfinished. Light and dark are
both first-class. The QR is 148px, the largest in the set.

**A · Desk.** Split canvas. Sign-in on the left on paper, a Signal briefing
assembling itself on the right, the four-product spine underneath. Argues that
the login screen is the last chance to say what the product is for.

**B · Line.** One centred column on a single hairline that crosses the viewport.
Opens with the account this device last used, so the common case is one button.
Providers and the email field fold away behind "Use a different account". The
indigo dot rides the line and moves when the flow moves.

**C · Rail.** The charcoal Studio Bar L-frame is on screen from the first frame,
the product tiles wake down the rail, and the auth card floats on paper in the
middle. Argues that you are already inside the workspace, not outside it.

The charcoal here is `--x-studio-chrome`, the shipped Studio Bar value, not a
dark theme. No product sets `data-theme="dark"` before launch and this does not
either.

## The QR mark

`signal-qr.tsx` draws the QR from a committed matrix rather than generating an
image, so it inherits the surface ink colour and costs no request.

- Target: `https://signalstudio.ie/ios`, the page that states the iPhone app is
  in build. When there is an App Store listing, change `TARGET` and regenerate.
- Error correction: level H, 30%. That headroom pays for the rounded modules,
  the drawn finder rings, and the indigo dot cleared out of the centre.
- Regenerate with `node scripts/lab/generate-login-qr.mjs` from the repo root.
  The output file is committed so the lab has no build-time dependency on the
  `qrcode` package.

Set `--qr-surface` on an ancestor when the card is not paper, so the centre
badge punches the right colour. `IosQrCard` already does this per tone.

## If a direction wins

The pieces that carry over to `/sign-in` are `signal-qr.tsx`, `shared.tsx`, and
the winning direction's component and stylesheet. The provider buttons are
presentational here; production wires them to Clerk's `signIn.authenticateWith`
and reads the enabled list from `src/lib/auth/social-providers.ts`, which today
resolves to Google only.
