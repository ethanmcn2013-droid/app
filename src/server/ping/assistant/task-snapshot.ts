import 'server-only';
import type {tasks} from '@/server/db/schema';
import {assistantPayloadHash} from './store';
import type {AssistantActionResult} from '@/lib/ping/assistant/contract';
import type {AssistantSource} from '@/lib/ping/assistant/release2';
import {assistantTasksByIds,type AssistantActionTransaction} from './context';

/** One canonical JSON post-image for approval checks and Undo receipts. Never sent to the model or browser. */
export function taskSnapshot(row:typeof tasks.$inferSelect):Record<string,unknown>{
  return { id: row.id, workspaceId: row.workspaceId, seq: row.seq, title: row.title, description: row.description,
    lane: row.lane, priority: row.priority, assignees: row.assignees, due: row.due, dueAt: row.dueAt?.toISOString() ?? null,
    estimate: row.estimate, tags: row.tags, idleDays: row.idleDays, blockedBy: row.blockedBy, recurrence: row.recurrence,
    startDay: row.startDay, durationDays: row.durationDays, position: row.position, parentTaskId: row.parentTaskId,
    externalContactName: row.externalContactName, externalContactEmail: row.externalContactEmail, cents: row.cents,
    sourceNoteId: row.sourceNoteId, sourceNoteExtractBody: row.sourceNoteExtractBody, sourceNoteExtractSha256: row.sourceNoteExtractSha256,
    boardColumnKey: row.boardColumnKey, completedAt: row.completedAt?.toISOString() ?? null, isMilestone: row.isMilestone,
    archivedAt: row.archivedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export const taskSnapshotHash=(row:typeof tasks.$inferSelect)=>assistantPayloadHash(taskSnapshot(row));

/** Sources changed by our own earlier steps must still match those exact committed post-images. */
export async function validateAssistantTaskPostImages(tx:AssistantActionTransaction,actorId:string,sources:readonly AssistantSource[],resultsInPlanOrder:readonly AssistantActionResult[]):Promise<boolean>{
  const sourceIds=new Set(sources.filter(source=>source.kind==='task').map(source=>`${source.projectId}:${source.itemId}`));
  const expected=new Map<string,Map<string,string>>();
  for(const result of resultsInPlanOrder){
    if(result.status!=='completed'||result.reversal?.kind!=='tasks')continue;
    const reversal=result.reversal;
    for(const row of reversal.rows){
      if(!sourceIds.has(`${reversal.projectId}:${row.id}`))continue;
      if(result.undoResult?.status==='reverted')return false;
      let group=expected.get(reversal.projectId);if(!group){group=new Map();expected.set(reversal.projectId,group);}
      group.set(row.id,assistantPayloadHash(row.after));
    }
  }
  for(const [projectId,hashes] of expected){
    const rows=await assistantTasksByIds(tx,actorId,projectId,[...hashes.keys()],false);
    if(rows.some(row=>taskSnapshotHash(row)!==hashes.get(row.id)))return false;
  }
  return true;
}
