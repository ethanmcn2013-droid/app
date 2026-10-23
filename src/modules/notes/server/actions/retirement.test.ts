import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const root = process.cwd();

test("actual archive query includes owner unpromoted archives and retained rows, refusing disabled reads", async () => {
  const client = createClient({ url: "file::memory:" });
  const host = globalThis as typeof globalThis & { retirementTestDb?: unknown; retirementTestEnabled?: boolean; retirementTestOwner?: string };
  try {
    await client.executeMultiple("CREATE TABLE notes (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER,updated_at INTEGER,extract_body TEXT,promoted_task_id TEXT,archived_at INTEGER,workspace_id TEXT,source TEXT);");
    for (const row of [["archived-unpromoted","owner-a",2], ["active","owner-a",null], ["other-owner","owner-b",3]]) {
      await client.execute({ sql: "INSERT INTO notes (id,user_id,body,created_at,updated_at,archived_at) VALUES (?,?,?,1,1,?)", args: [row[0],row[1],"Private fixture",row[2]] });
    }
    host.retirementTestDb = drizzle(client);
    host.retirementTestEnabled = true;
    host.retirementTestOwner = "owner-a";
    const build = await esbuild.build({ entryPoints: [path.join(root,"src/modules/notes/server/actions/retirement.ts")], bundle: true, write: false, format: "cjs", platform: "node", packages: "external", alias: { "@": path.join(root,"src") }, plugins: [{ name: "isolated-retirement-read", setup(builder: { onResolve: (options: { filter: RegExp }, callback: (args: { path: string }) => unknown) => void; onLoad: (options: { filter: RegExp; namespace: string }, callback: () => unknown) => void }) {
      builder.onResolve({ filter: /^@\/(modules\/notes\/(server\/(notes-auth|db\/notes-client|demo\/notes-demo)|lib\/notes-retirement)|lib\/access-mode)$/ }, () => ({ path: "mock", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export async function requireUser(){return globalThis.retirementTestOwner;} export const db=new Proxy({}, {get:(_,key)=>{const value=globalThis.retirementTestDb[key];return typeof value==='function'?value.bind(globalThis.retirementTestDb):value;}}); export function isDemoMode(){return false;} export function notesRetirementEnabled(){return globalThis.retirementTestEnabled;} export function demoNotes(){return [];} export function demoArchivedNotes(){return [];}" }));
    } }] });
    const compiledModule = { exports: {} as { listNotesForRetirement: () => Promise<{ id: string; archivedAt: number | null }[]> } };
    new Function("require","module","exports",build.outputFiles[0].text)(require,compiledModule,compiledModule.exports);
    const rows = await compiledModule.exports.listNotesForRetirement();
    assert.deepEqual(rows.map(row => row.id).sort(), ["active","archived-unpromoted"]);
    assert.equal(rows.find(row => row.id === "archived-unpromoted")?.archivedAt,2);
    assert.equal(rows.find(row => row.id === "active")?.archivedAt,null);
    host.retirementTestOwner = "owner-b";
    assert.deepEqual((await compiledModule.exports.listNotesForRetirement()).map(row => row.id),["other-owner"]);
    host.retirementTestEnabled = false;
    await assert.rejects(compiledModule.exports.listNotesForRetirement(), /not enabled/);
  } finally {
    delete host.retirementTestDb; delete host.retirementTestEnabled; delete host.retirementTestOwner;
    client.close();
  }
});

test("actual archive render keeps old note selection read-only and distinguishes active from archived", async () => {
  const rows = [{ id:"unpromoted", body:"Old private note\n<script>private</script>", createdAt:1, updatedAt:2, archivedAt:3, promotedTaskId:null, extractBody:null, workspaceId:null, source:null },
    { id:"active", body:"Still retained", createdAt:1, updatedAt:2, archivedAt:null, promotedTaskId:null, extractBody:null, workspaceId:null, source:null }];
  const build = await esbuild.build({ entryPoints:[path.join(root,"src/modules/notes/app/workspace/NotesRetirementArchive.tsx")],outdir:path.join(root,"ignored-render-output"),bundle:true,write:false,format:"cjs",platform:"node",packages:"external",alias:{"@":path.join(root,"src")},plugins:[{name:"isolated-archive-render",setup(builder: { onResolve: (options: { filter: RegExp }, callback: (args: { path: string }) => unknown) => void; onLoad: (options: { filter: RegExp; namespace: string }, callback: () => unknown) => void }) {
    builder.onResolve({filter:/^@\/modules\/notes\/server\/actions\/retirement$/},()=>({path:"rows",namespace:"fixture"}));
    builder.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:`export async function listNotesForRetirement(){return ${JSON.stringify(rows)};}`}));
    builder.onResolve({filter:/^next\/link$/},()=>({path:"link",namespace:"link-fixture"}));
    builder.onLoad({filter:/.*/,namespace:"link-fixture"},()=>({resolveDir:root,contents:"import React from 'react'; export default function Link({children,...props}){return React.createElement('a',props,children);}"}));
  }}]});
  const compiled = {exports:{} as { NotesRetirementArchive:(props:{requestedNoteId:string|null;workspaceId:null})=>Promise<ReactNode> }};
  new Function("require","module","exports",build.outputFiles.find((file:{path:string})=>file.path.endsWith(".js")).text)(require,compiled,compiled.exports);
  const html=renderToStaticMarkup(await compiled.exports.NotesRetirementArchive({requestedNoteId:"unpromoted",workspaceId:null}));
  assert.ok(html.includes("Archived"));assert.ok(html.includes("Retained · read-only"));
  assert.ok(html.includes("&lt;script&gt;private&lt;/script&gt;"));assert.equal(html.includes("<script>private"),false);
  assert.ok(html.includes("/api/account/export"));assert.ok(html.includes("note=unpromoted"));
  for(const tag of ["<textarea","<input","<button"])assert.equal(html.includes(tag),false);
  const unknown=renderToStaticMarkup(await compiled.exports.NotesRetirementArchive({requestedNoteId:"not-owned-id",workspaceId:null}));
  assert.ok(unknown.includes("This note isn’t available in your archive."));
  assert.equal(unknown.includes("&lt;script&gt;private"),false);
});
