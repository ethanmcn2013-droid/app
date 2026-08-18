# Installing the elevate skill

The skill is self-contained in this directory. It works from any of three
homes; the scripts always run relative to their own location, so no
configuration changes between them.

## Where it can live

1. **This repo (already live).** `.claude/skills/elevate/` — Claude Code
   sessions in this repository, local or remote, pick it up automatically.
2. **Your machine, across every repo.** Copy to `~/.claude/skills/elevate`:

   ```powershell
   # Windows (PowerShell)
   robocopy .claude\skills\elevate $env:USERPROFILE\.claude\skills\elevate /MIR
   ```
   ```bash
   # macOS / Linux
   rsync -a --delete .claude/skills/elevate/ ~/.claude/skills/elevate/
   ```
3. **Another repo** (e.g. the studio repo as canonical source): copy the
   directory in, commit, and re-run the sync above when it changes. Keep
   ONE home as canonical and treat the others as installs — this repo is
   canonical until you decide otherwise.

## Runtime requirements

- Node 20+.
- `@playwright/test` resolvable from the lab you run in (any ancestor
  `node_modules`): `npm i --no-save @playwright/test` in the repo is
  enough. Browsers: `npx playwright install chromium` once per machine
  (Claude Code remote containers already have Chromium preinstalled).
- The panel's preferred execution uses the Workflow tool; without it the
  generator's `--mode=prompts` output runs on subagents or sequentially
  (see the degradation ladder in SKILL.md).

## Launching an engagement session

Start the session so the loop cannot stall on approval prompts —
`claude --dangerously-skip-permissions` (or `--permission-mode acceptEdits`
at minimum), per the operator guide this lesson came from. Then:

```
/elevate <what you want elevated>
```

or invoke conversationally: "elevate the pricing page to world class".
