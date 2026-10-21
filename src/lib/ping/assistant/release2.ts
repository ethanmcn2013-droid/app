import type { AssistantAction, AssistantTaskFields } from './contract';

/** Server-owned source identity. Only its opaque ref and readable content reach the model. */
export type AssistantSource = Readonly<{
  ref: string; kind: 'conversation' | 'task_discussion' | 'task'; projectId: string; scopeId: string;
  itemId: string; revision: number; audienceEpoch: number; body: string; authorName: string;
  createdAt: string; href: string; rootId?:string; timeZone?:string;
}>;
export type AssistantSourceScope = Readonly<{kind:'conversation';conversationId:string;rootId?:string}> |
  Readonly<{kind:'task_discussion';taskId:string}>;
export type AssistantCitation = Readonly<{ref:string;quote:string}>;
export type AssistantVisibleCitation = AssistantCitation & Readonly<{href:string;authorName:string}>;
export type AssistantPlanEdit = Readonly<{kind:'drop';stepId:string;taskTitle?:string}> |
  Readonly<{kind:'task_fields';stepId:string;taskTitle?:string;changes:AssistantTaskFields}>;
export type AssistantMemoryTurn = Readonly<{user:string;reply?:string;status?:string;actions?:readonly AssistantAction[]}>;
/** JSON-safe snapshots stay on the server; the browser receives only Undo availability. */
export type AssistantTaskSnapshot = Readonly<Record<string, unknown>>;
export type AssistantReversal = Readonly<{kind:'tasks';projectId:string;rows:readonly Readonly<{
  id:string;before:AssistantTaskSnapshot|null;after:AssistantTaskSnapshot;
}>[]}> | Readonly<{kind:'messages';projectId:string;items:readonly Readonly<{
  kind:'conversation'|'task_discussion';scopeId:string;itemId:string;revision:number;audienceEpoch:number;
}>[]}>;
export type AssistantUndoResult = Readonly<{status:'reverted'|'conflict'|'unavailable';summary:string;affectedCount:number}>;
