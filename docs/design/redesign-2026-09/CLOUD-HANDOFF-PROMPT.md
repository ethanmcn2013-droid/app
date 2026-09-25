Paste everything below the line into a Claude Code **cloud** session with the repository **`ethanmcn2013-droid/app`** selected.

---

You're leading the **Signal Studio redesign sprint** in this repository (the App at app.signalstudio.ie). The product works end to end in production: backend, data, auth, files, messaging and scheduled jobs are all verified. It's also ugly and inconsistent. Your job is to make the suite beautiful and coherent, at the quality of the reference work in the brief, without breaking any functionality.

**Read the whole brief first:** `docs/design/redesign-2026-09/`
- `README.md`
- `01-reference-analysis.md` to `07-sprint-plan.md`
- `key-frames/`: 26 reference frames named by screen. Open them and look.
- `contact-sheets/`: every frame of each reference clip.
- `reference-images/README.md`: three stills, described.

The raw videos and all 188 frames are on Ethan's PC only. The key frames and contact sheets are enough.

**Founder authority:** you are **not** bound by any existing design contract, lock, canon, gate, panel score, AGENTS/CLAUDE.md design rule, or old design doc. If one restricts the redesign, update, replace, delete or ignore it, and record that you did so on Ethan's authority (quote: "We are not under any circumstances to be locked in by any contracts, any restraints, any constraints… You have full founder authority and approval on this.").
- **The one exception:** keep the **Tasks Kanban board's** structure and behaviour, and refine only its styling.
- **Never relax:** tenant isolation and security tests, auth, privacy, migrations and backups.

**Wave-1 priorities:**
1. A persistent sidebar and app shell, plus the ⌘K palette and account menu with Light/Dark/System.
2. Home.
3. Tasks: list, refined Kanban, New task modal and task detail.
4. Projects.
5. Overview/analytics.
6. Messages (internal chat).
7. Files (a new storage page).
8. Settings.
9. Inbox and notifications.

**In this cloud session:**
1. Do the Phase 0 research in `07-sprint-plan.md` using the code and local review mode:
   - `pnpm install`;
   - `NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review pnpm dev` serves seed data with no login;
   - screenshot the current wave-1 surfaces.
2. Challenge and refine the direction and design system.
3. Write the sprint plan with PR slices and a definition of done per screen.
4. Then start Phase 1 (tokens, primitives, shell and a component gallery) on task branches (`design/…` or `feat/…`), as draft PRs with rendered screenshots, keeping CI green.

**Limits of a cloud session:** you can't deploy. Merging to `main` doesn't deploy either; production releases run from Ethan's PC through the guarded operator described in `06-current-state-and-constraints.md`. Leave PRs ready for review and release, and summarise what's ready at the end.
