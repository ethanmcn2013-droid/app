# Signal Studio Files: design brief and Ethan's preferences

Living record of what Ethan has asked for in this redesign. Every review and every refinement round must respect it.

## Goal
- Redesign the Files section of Signal Studio. Production today is a single generic grey folder, a stat strip and a side panel. Ethan's view: "I hate how it looks."
- The screen must be **immediately intuitive** on first open. **World-class design and experience.**
- On first open, show **three or four very elegant, beautiful folders**.
- Work stays **local**. No production changes yet.

## Decisions so far (in order)
1. Four concepts explored: A Shelf (folders by file type), B By project, C Quiet list, D Sources (by where files live).
2. **Colour was rejected.** No folders in different colours. All folders share one finish: **white in light mode, dark/graphite in dark mode**. Stay with the existing Signal Studio palette from production.
3. **Remove the "fluff":** no colourful image or link thumbnails, no multicolour project dots in content, no decorative gradients. The folder design itself had to get better.
4. Chosen direction: **D Sources as the base, plus the storage footer from A Shelf.** Ethan likes the "Google Drive · Connected" status and the "In Signal" folder.
5. **Colour comes back only as source identity, restrained and tasteful:** the real Google Drive logo, the Signal ring mark for In Signal, and a single teal link mark for Links. Everything else stays monochrome; indigo is for primary actions and "new" counts.
6. **Locked in: Sources + shelf.** All other concepts are dropped (archived, not for review).
7. **Light mode keeps the dark sidebar and dark frame**, as in production. Only the main canvas turns white.

8. Answers after the five-specialist review (19 Oct 2026):
   - **Real previews in greyscale: yes.** Real content, not decoration.
   - **Each project gets its own folder: yes.** Sources stay the primary row, and projects sit beneath as their own folders.
   - **Uploads don't have to be attached to a task.** Attaching is optional, now or later.
   - **Keep the dashed Add files folder.**
   - **Remove New task from the Files page**, so Add files is the single primary action.

## Brand constraints (from the production screenshots)
- Signal indigo accent (about #5b4ff5 light, #7d72ff dark) for the primary button and selection.
- Dark frame and sidebar. White main canvas in light mode, near-black (#151517) in dark mode.
- Inter-style sans. Calm, plain copy ("Linked, not copied", "Files on archived tasks are hidden").

## Taste signals
- Prefers restraint over decoration; dislikes rainbow colour coding.
- Wants things to feel premium and obvious rather than clever.
- Responds to concrete trust cues (where a file lives, connection status, storage used).
