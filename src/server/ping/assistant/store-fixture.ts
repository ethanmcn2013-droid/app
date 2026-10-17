import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createClient} from "@libsql/client";
import {drizzle} from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import {createAssistantStore} from "./store";
export async function assistantFixture() {
  const directory=await mkdtemp(path.join(tmpdir(),"assistant-store-")),url=pathToFileURL(path.join(directory,"test.db")).href;
  const client=createClient({url});
  await client.executeMultiple("PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('alice'),('bob'); CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at integer NOT NULL DEFAULT (unixepoch()));");
  await client.executeMultiple(await readFile(path.resolve('drizzle/0044_assistant_execution.sql'),'utf8'));
  const database=drizzle(client,{schema}),store=createAssistantStore(database);
  return {client,database,store,url,close:async()=>{client.close();await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(error=>{if(error.code!=='EBUSY'&&error.code!=='EPERM')throw error;});}};
}
