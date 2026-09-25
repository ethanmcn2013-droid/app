Copy everything below the line into a new Claude Code session, started in the folder `C:\Users\ethan\signal-studio-workspace`.

---

You're leading the **Signal Studio redesign sprint**. The product works end to end in production: backend, data, auth, files, messaging and scheduled jobs are all verified. It's also ugly and inconsistent. Your job is to make the Signal Studio suite beautiful and coherent, at the quality of the reference work I collected, without breaking any functionality.

**Start by reading the whole brief package on my Desktop:** `C:\Users\ethan\Desktop\Signal Studio Redesign Sprint\`
- `README.md`: the index.
- `01-reference-analysis.md`: what the references show, frame by frame.
- `02-design-direction.md`: the direction.
- `03-design-system.md`: proposed tokens and components.
- `04-information-architecture.md`: one persistent shell, route mapping.
- `05-priority-screens.md`: wave-1 screen briefs.
- `06-current-state-and-constraints.md`: codebase, known issues, which old rules to lift or keep, and how to ship to production.
- `07-sprint-plan.md`: proposed phases.
- `key-frames/`: the 26 best reference frames, named by screen. `frames/` holds every frame at 2 fps plus contact sheets. `reference-videos/` has the three source clips. `reference-images/` has three stills.

Open and look at the key frames and contact sheets yourself before forming a view. Don't rely on my descriptions alone.

**Founder authority, read this carefully:** you are **not** bound by any existing design contract, lock, canon, gate, panel score, AGENTS/CLAUDE.md design rule, or old design doc. If one restricts or blocks the redesign, update it, replace it, delete it or ignore it, and record that you did so on my authority (quote: "We are not under any circumstances to be locked in by any contracts, any restraints, any constraints… You have full founder authority and approval on this."). We can nuke the old UI.
- **The one exception:** keep the **Tasks Kanban board's** structure and behaviour, and refine only its styling.
- **Never relax** safety and data guarantees: tenant isolation and security tests, auth, privacy, migrations, backups, and the guarded production release chain.

**Priorities (wave 1), in order:**
1. A **persistent sidebar and app shell** used by every page (plus the ⌘K palette and account menu with Light/Dark/System).
2. **Home.**
3. **Tasks**: list, and the refined Kanban, New task modal and task detail.
4. **Projects**: grid and project page with tabs.
5. **Overview/analytics.**
6. **Messages**, our internal chat.
7. **Files**: a new storage page aggregating native and Drive files.
8. **Settings.**
9. **Inbox and notifications.**

Get these to a consistent standard first so the suite reads as one product. The hundreds of long-tail pages come after.

**Don't jump straight into code.** In this first session:
1. Do the Phase 0 research in `07-sprint-plan.md`: capture the current "before" state, inventory the components and data behind each wave-1 screen, and list the old contracts and checks the new shell will collide with.
2. Challenge and refine the proposed direction and design system where you see something better. The tokens are a starting point, not law.
3. Write the sprint plan with PR slices and a definition of done per screen.
4. Show me the plan as one clear page, then start Phase 1 (tokens, primitives, shell and a component gallery) without waiting for routine approval.

**Working style:**
- Show rendered results. Every screen gets desktop and mobile screenshots in light and dark, next to its reference frame.
- Keep functionality intact: click through each screen's main actions before merging.
- One design system, no one-offs.
- Small PRs with CI green.
- Production releases go through the guarded operator described in `06-…`; merging to main doesn't deploy.
