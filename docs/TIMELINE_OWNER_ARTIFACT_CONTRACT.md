# Timeline owner artifact contract

Status: canonical  
Effective: 2026-07-26

## Product rule

`/app/timeline` resolves directly to an authorised project and opens its real
Timeline artifact. Timeline does not place a dashboard of project cards
between the owner and the timeline.

The owner workflow has three clear moves:

1. Switch project in the project control.
2. Use View to inspect the exact responsive artifact.
3. Use Edit to curate milestone labels, dates, order, lane, and visibility.

Preview and share remains a separate deliberate action. It creates and manages
a frozen, revocable audience copy. Publishing never exposes the live Tasks
workspace.

## Source of truth

The signed Timeline artifact component is the visual source of truth for:

- the authenticated owner preview;
- frozen bearer-link timelines;
- the Timeline proof inside product marketing.

Owner controls may frame the artifact, but they must not restyle or replace it
with a miniature rail, project card, Gantt chart, or dashboard.

## Data boundary

The owner preview and public artifact both render through
`AudienceTimelineDto`. The projection may contain only:

- audience kind and public label;
- optional owner attribution;
- optional primary date label and date;
- last-updated and calendar-day values;
- milestone public id, title, date, and public state.

Hidden milestones, source ids, workspace ids, membership, descriptions,
comments, notes, attachments, and private task metadata never enter the
artifact projection.

## Multi-project behaviour

The project switcher lists only projects from the authorised Timeline
workspace. It preserves validated workspace and planning-period context and
moves directly to the chosen project. A single-project workspace shows the
project name without a redundant menu.

## Empty state

When a project has no visible milestones, View explains the condition and
offers direct paths to Edit milestones and Tasks. It does not fabricate a
timeline or route the owner back through an all-project dashboard.
