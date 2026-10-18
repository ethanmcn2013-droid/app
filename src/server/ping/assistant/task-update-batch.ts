import "server-only";
import {and,eq,inArray} from "drizzle-orm";
import {activities,tasks} from "@/server/db/schema";
import {privateTaskDbWrite} from "@/server/actions/private-task-db-write";
import {AssistantActionRefusal,type AssistantActionTransaction} from "./context";

/** Caller supplies freshly authorized rows inside the existing fenced transaction.
 * Preserve every selected row's patch/activity semantics, including same-value commands. */
export async function updateAssistantTaskBatch(tx:AssistantActionTransaction,input:{
 projectId:string;patches:readonly {id:string;patch:Partial<typeof tasks.$inferInsert>}[];
 activityRows:readonly (typeof activities.$inferInsert)[];
}){
 if(input.patches.length>500||input.activityRows.length>2500)throw new AssistantActionRefusal("unsupported");
 const groups=new Map<string,{patch:Partial<typeof tasks.$inferInsert>;ids:string[]}>();
 for(const {id,patch} of input.patches){
  const key=JSON.stringify(patch),group=groups.get(key);
  if(group)group.ids.push(id);else groups.set(key,{patch,ids:[id]});
 }
 for(const {patch,ids} of groups.values())for(let offset=0;offset<ids.length;offset+=100){
  const chunk=ids.slice(offset,offset+100);
  const changed=await privateTaskDbWrite(()=>tx.update(tasks).set(patch)
   .where(and(eq(tasks.workspaceId,input.projectId),inArray(tasks.id,chunk))).returning({id:tasks.id}));
  if(changed.length!==chunk.length)throw new AssistantActionRefusal("stale");
 }
 // Seven bound columns per activity;100rows remains below conservative SQLite999 parameters.
 for(let offset=0;offset<input.activityRows.length;offset+=100)await tx.insert(activities).values(input.activityRows.slice(offset,offset+100));
}
