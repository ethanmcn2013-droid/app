# Claude Design sync — operator runbook

How to get two-way sync between this repo's component library and a
claude.ai/design design-system project, and why it cannot be done
from a Claude Code web session.

Current state (audited 2026-08-17): **not set up**. No design
authorization has been granted, and no design-system project is
linked. The `DesignSync` tool is present in Claude Code sessions but
returns `needs design-system authorization` until the steps below are
run from a local terminal.

## 1 · It is not an MCP connector

Claude Design has no MCP server. Searching the connector registry
returns Figma, v0, Canva, Replit, Magic Patterns, Adobe and Webflow —
no Anthropic design entry. Adding one is not an available option, and
no amount of connector configuration will produce it.

Instead the integration ships inside the Claude Code binary itself as
a first-party tool, `DesignSync`, plus two commands:

| Command | What it does |
|---|---|
| `/design-login` | Authorize design-system access for `/design-sync` with your claude.ai account |
| `/design-sync` | Bundle the local component library and sync it against a Claude Design project |

Both are present in the shipped CLI as of **2.1.234**. They are absent
from the public changelog because the feature is in beta, not because
the version is too old. An older CLI answering `Unknown command` to
`/design-login` is the upgrade signal.

## 2 · Hard requirements

All four must hold. Each one is enforced by the tool with its own
error message, so a failure here is not subtle.

- **An interactive terminal.** `/design-login` opens a browser
  authorization flow. Claude Code on the web runs in a remote
  container with no interactive terminal, so the command cannot run
  there at all — this is the blocker, and it is a property of the
  environment rather than a missing setting.
- **claude.ai authentication on a paid plan.** Verbatim from the
  binary: *DesignSync is only available with claude.ai authentication.
  It is not supported through Bedrock, Vertex, or other third-party
  providers.* An `ANTHROPIC_API_KEY` setup will not work; the login
  must be a Claude subscription.
- **Nonessential network traffic enabled.** DesignSync is disabled
  when that traffic is switched off.
- **Write permission on the target project.** `list_projects` filters
  to writable projects only, so a read-only share will simply not
  appear.

## 3 · Local setup

Run these on your own machine, not in a web session. A visual
walkthrough of this section lives at
`docs/guides/connect-claude-design.html` (published as an artifact).

```powershell
# 1 · install or update the CLI (needs >= 2.1.234)
npm install -g @anthropic-ai/claude-code
claude --version
```

The clone already exists on the operator's machine: everything lives
under `%USERPROFILE%\signal-studio-workspace\` (path recorded in
`docs/wave/BASELINE.json`), which holds the product repo, the `studio`
repo, and `_wt-*` worktrees. Go into the product folder:

```powershell
cd $HOME\signal-studio-workspace\app
```

If the product folder still carries its pre-rename name, work in it as
is, or finish the rename with the bundled helper — run from the
workspace folder, never from inside the clone
(`scripts/finish-local-dir-rename.ps1`; safe to re-run, refuses
foreign folders). Only a genuinely fresh machine needs
`git clone https://github.com/ethanmcn2013-droid/app.git app`.

Then start Claude Code and authorize:

```
claude
/login          # claude.ai subscription, not an API key
/design-login   # grants the design-system scope
```

`/design-login` opens a browser and **times out after five minutes**.
If the browser cannot open — a headless box, an SSH session — run
`/design-login` again and take the manual flow it offers instead.

Verify before going further. Ask Claude to list your design-system
projects; a successful call returns names, owners and project IDs. An
empty list means the account has no writable design-system project
yet, which is a reason to create one, not a failure.

## 4 · What actually syncs from this repo

`/design-sync` runs a converter that bundles real component code
**from Storybook or a bare package**. This repo has neither: there is
no `.storybook` directory and no Storybook dependency, and the 184
components under `src/components/` are application components rather
than a published library.

So expect the bare-package path, and expect it to need help. The
pieces worth syncing first are the ones that are already
system-shaped:

| Source | Why it is a good first push |
|---|---|
| `src/ds/tokens.css` | Vendored design tokens — the foundation layer |
| `src/ds/theme-overrides.css` | Theme deltas that ride on the tokens |
| `src/components/primitives/` | The lowest-level shared elements |
| `src/components/ui/` | Composed controls built on the primitives |

Sync incrementally, one component at a time. The tool's own guidance
is explicit that this is never a wholesale replace, and the plan step
exists so the exact write and delete list is approved before anything
moves.

## 5 · The plan boundary

Writes are gated. The order is fixed and the tool rejects anything
out of sequence:

1. `list_projects` / `list_files` / `get_file` — read and diff
2. `finalize_plan` — lock the exact paths to write and delete, plus
   the local directory uploads may be read from; returns a `planId`
3. `write_files` / `delete_files` — every path must be in the plan

You see the structured path list and the source directory at step 2,
independent of anything Claude says about it. Read that list rather
than the narration around it.

## 6 · Troubleshooting

| Symptom | Cause |
|---|---|
| `needs design-system authorization` | `/design-login` never completed, or you are in a web session |
| `Unknown command: /design-login` | CLI older than the beta; upgrade to >= 2.1.234 |
| `only available with claude.ai authentication` | Logged in via API key, Bedrock or Vertex |
| Browser authorization timed out | Five-minute limit passed; rerun and use the manual flow |
| HTTP 403 on a design call | Token is missing the design scope, or the account lacks beta access |
| `list_projects` returns nothing | No design-system project you can write to; create one |

A project's type is immutable at creation. Pushing to a regular
project will never turn it into a design system, so confirm
`type: PROJECT_TYPE_DESIGN_SYSTEM` with `get_project` before planning
a push.

## 7 · Working from a web session anyway

Without local setup, two paths still reach a design surface from
claude.ai/code:

- **Send to Claude Code Web.** Claude Design's own handoff button
  seeds the project files into the workspace, where they can be read
  and edited as ordinary files. One-way in, but it needs no
  authorization.
- **`/design` skill.** Creates a design canvas published as an
  Artifact running Claude Design's canvas editor. Good for new
  mockups; it does not open existing design-system projects.

Neither writes back to a claude.ai/design project. Only the
locally-authorized `/design-sync` does that.

## 8 · Known doc drift

`CLAUDE.md` says tokens are regenerated via `scripts/ds-vendor.mjs`.
That file does not exist in the tree. The only design-system script
present is `scripts/ds/ds-check.mjs`, wired as `pnpm ds:check`, and it
validates rather than regenerates. Worth reconciling before anyone
follows the token half of this runbook.
