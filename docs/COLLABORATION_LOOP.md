# Signal Tasks Collaboration Loop

Signal Tasks owns the execution layer of the Signal Studio collaboration loop.

Core question:

What needs doing, who owns it, when does it matter, and what is stuck?

## Role In The Ecosystem

Signal Tasks turns captured context into visible action.

It should make invited collaborators understand:

- what they own
- what is due soon
- what is waiting
- what changed
- what needs a reply or decision

## Growth Loop Responsibility

Tasks supports this loop:

Workspace created -> collaborators invited -> work becomes clearer -> shareable output created -> new creator discovered.

Tasks is responsible for the "work becomes clearer" moment. If a collaborator opens a workspace and cannot see what they own in under 60 seconds, the loop is weak.

## Shared Objects Tasks Should Respect

| Object | Tasks meaning |
| --- | --- |
| Workspace | The shared place where tasks belong. |
| Person | Owner, collaborator, guest, supplier, client, or partner. |
| Task | Owned action with status, date, blocker, and context. |
| Decision | Context that explains why a task exists or changed. |
| Risk | A blocker or pattern that may affect the work. |
| Update | A meaningful task change that can feed activity and briefings. |
| Shareable output | Checklist or status update that can travel outside the workspace. |

## Cycle 1 Product Work

Prioritise:

- collaborator first view
- ownership clarity
- plain-language blocker states
- task health states
- shareable checklist/status update
- events for task created, owner changed, date moved, status changed, blocker added, and task completed

Avoid:

- complex permissions
- custom workflow builders
- project-management jargon
- forcing collaborators to configure anything before seeing value

## Acceptance Test

For the wedding/events wedge, a couple or supplier should open a shared workspace and understand:

- what they need to do
- what the venue or planner owns
- what is waiting
- what happens next

## Cycle 2: Invite And First View

Tasks owns the "My work" section of the invited collaborator's first view.

Role defaults for Tasks:

- Creator can create, assign, edit, complete, and share task-based outputs.
- Collaborator can see shared workspace context and update assigned/shared tasks.
- Guest can only see selected task outputs, such as a checklist or follow-up.
- Client / supplier can see the tasks and questions relevant to them.
- Viewer can read a shared checklist or status update.

Cycle 2 implementation targets:

- assigned-task card for invited collaborators
- plain-language waiting states
- safe task visibility for guests
- task update events for the shared activity model
- checklist/status output that can be shared without exposing the whole workspace

Acceptance test:

A couple invited by a venue can see the follow-ups they own, what the venue owns, and what is waiting on a supplier without seeing private venue notes.
