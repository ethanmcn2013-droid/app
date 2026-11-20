import React, { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FloorWorkspace } from '@/components/floor/floor-workspace';
import { LabStoreContext, LabStoreProvider, useLabStore } from '@/components/hybrid/store';
import { RoomBriefProvider } from '@/components/app/room/room-brief-context';
import { createCalendarFrame } from '@/lib/calendar-frame';
import type { LabTask } from '@/components/hybrid/types';

// Synthetic prerequisites only. The component, undo/place hooks, store reducer,
// column model, calendar model, fonts and CSS are the repository's own.
const description = 'Confirm the final arrival plan with the venue coordinator. ' +
  'Keep the accessible entrance clear and meet the first supplier at the loading door. ' +
  'If the arrival time changes, update the written plan before the briefing. ' +
  'Read this last sentence: the spare table plan is in the blue folder.';
const scene: LabTask[] = ['todo', 'doing', 'review', 'waiting', 'done'].flatMap(status =>
  Array.from({ length: status === 'todo' ? 16 : 3 }, (_, order) => ({
    id: `${status}-${order}`, title: `${status === 'todo' && order === 1 ? 'Confirm the arrival plan' : `Prepare ${status} item ${order + 1}`}`,
    description: status === 'todo' && order === 1 ? description : 'Agree the next step with the coordinator.',
    status, order, schedule: { kind: 'due', dueOn: '2027-01-21' }, priority: 'normal',
    assigneeIds: [], labelIds: [], subtasks: [], attachments: [], comments: [],
    blockedByIds: [], blockerIds: [], completed: status === 'done',
    completedAt: status === 'done' ? '2027-01-20T12:00:00Z' : undefined,
    workspaceId: 'floor-recovery-synthetic',
  } as LabTask)));
const calls: { method: string; args: unknown[] }[] = [];
function Surface() {
  const store = useLabStore();
  useLayoutEffect(() => {
    Object.assign(window, { readFloor: () => ({
      tasks: store.tasks.map(({ id, status, order, completed }) => ({ id, status, order, completed })),
      calls: structuredClone(calls), description,
    }) });
  }, [store]);
  const ports = { ...store,
    moveStatus: (...args: Parameters<typeof store.moveStatus>) => { calls.push({ method: 'moveStatus', args }); store.moveStatus(...args); },
    toggleComplete: (...args: Parameters<typeof store.toggleComplete>) => { calls.push({ method: 'toggleComplete', args }); store.toggleComplete(...args); },
  };
  return <LabStoreContext.Provider value={ports}><FloorWorkspace view="board" tasks={store.tasks}
    projectName="January arrival plan" initials="FR" onOpenPlanning={() => {}} /></LabStoreContext.Provider>;
}
const calendarFrame = createCalendarFrame({ now: new Date('2027-01-21T12:00:00Z'), timeZone: 'UTC', source: 'review' });
createRoot(document.getElementById('root')!).render(
  <RoomBriefProvider value={{ calendarFrame, periodName: null, dateWindow: null, ownerName: null, purpose: null }}>
    <LabStoreProvider initialTasks={scene} initialInspectedId={null} readOnly={false} onInspectedChange={() => {}}>
      <Surface />
    </LabStoreProvider>
  </RoomBriefProvider>,
);
