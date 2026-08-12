# Current-product evidence

Captured from the running product, not from reading. Local review-mode server
(`NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review`) on port 3212, which binds a synthetic demo user to
in-memory seed data and **never queries a real database**. Base `78021c5`.

30 captures: 10 routes × 3 viewports (`desktop-1440` 1440×960, `mobile-390` 390×844,
`narrow-320` 320×568), each with a full-page PNG, an ARIA snapshot (`.aria.txt`) and a
structural audit row in `structural-audit.json`.

Regenerate: `node scripts/home-layer/capture-current-product.mjs --base http://localhost:3212`

## What the capture establishes

### The structure that is already sound

Every surface that renders has exactly **one `main`, one `h1`, zero nested interactive
controls inside a wrapping link, and no horizontal overflow at 320px** — including Home,
the Full Briefing, Notes, Timeline and Profile. The Home layer inherits a decent baseline and
must not regress it. `settings-profile` carries one unnamed region at every viewport.

### `/app/your-work` is broken in review mode

`main=0`, `h1=0` at all three viewports, with a console error:

```
Failed query: select "id", "name", "context_type", COALESCE("start_date", date("created_at", 'unixepoch')) …
```

The page throws, so it renders no landmark and no heading. This is the surface the brief warns
must **never** be redirected to personal My work — and it is currently the hardcoded redirect
target of `/api/suite-context` in both branches (`src/app/api/suite-context/route.ts:23`, `:54`).

### Exactly the Tasks-runtime routes never reach network idle

| Route | Network idle | Navigations at 1440 |
|---|---|---|
| `/app/home` | yes | 2 |
| `/app/home/briefing` | yes | 2 |
| `/app/notes` | yes | 3 |
| `/app/timeline` | yes | 3 |
| `/settings/profile` | yes | 2 |
| `/app/your-work` | yes | 1 |
| **`/app/inbox`** | **no — holds an open connection** | **6** |
| **`/app/my-tasks`** | **no** | **6** |
| **`/app/project`** | **no** | **5** |
| **`/app/tasks`** | **no** | **7** |

The four that never settle are exactly the four wrapped in `TasksRuntimeShell`. This is runtime
corroboration of the audit finding that Inbox and My work cannot be relocated under
`/app/home/**` — they would drag an always-open connection and three to five extra navigation
landmarks into Home. It also sharpens `R-H01`: Home currently pays 2 navigations and settles;
the Tasks runtime is not free.

## Honest limits

- Review mode, seed data, Chromium only, light theme.
- Full-page PNGs, not per-state captures. No hover, focus, open-detail or error states.
- No Axe run, no contrast measurement, no real zoom, no screen reader.
- This is Wave 0 orientation evidence. It certifies nothing.
