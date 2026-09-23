import assert from "node:assert/strict";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const source = await fs.readFile(path.join(root, "src/components/app/detail-panel/conversation-feed.tsx"), "utf8");
assert.match(source, /onDraftChange\(withTaskCommentMention\(person\.id\)\)/,
  "The production composer must use the tested queued mention updater.");
assert.match(source, /onDraftChange\(withTaskCommentBody\(value\)\)/,
  "The production composer must use the tested queued body updater.");

const entry = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MentionField} from '@/components/ui/mention-field';
import {emptyTaskCommentDraft,withTaskCommentBody,withTaskCommentMention} from '@/lib/conversations/task-comment-draft';
const people=[{id:'member-a',name:'Alex',handle:'alex'},{id:'member-b',name:'Blair',handle:'blair'}];
window.sent=[];window.beforeSend=null;
function App(){
  const [draft,setDraft]=useState(emptyTaskCommentDraft);
  return <main>
    <MentionField aria-label="Task comment" value={draft.body} people={people}
      onMention={person=>setDraft(withTaskCommentMention(person.id))}
      onChange={body=>setDraft(withTaskCommentBody(body))}/>
    <output data-state>{JSON.stringify(draft)}</output>
    <button onClick={()=>{window.sent.push(draft);window.beforeSend=draft;setDraft(emptyTaskCommentDraft)}}>Send</button>
    <button onClick={()=>setDraft(window.beforeSend)}>Restore draft</button>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;
const bundle = await esbuild.build({ bundle: true, write: false, platform: "browser", jsx: "automatic",
  absWorkingDir: root, alias: { "@": path.join(root, "src") },
  define: { "process.env.NODE_ENV": '"production"' },
  stdin: { contents: entry, loader: "jsx", resolveDir: root } });
const bytes = bundle.outputFiles[0].contents;
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/bundle.js" ? "text/javascript" : "text/html");
  response.end(request.url === "/bundle.js"
    ? bytes : '<!doctype html><div id="root"></div><script src="/bundle.js"></script>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  await page.goto(origin);
  const field = page.getByRole("textbox", { name: "Task comment" });
  await field.fill("Hi @");
  await page.getByRole("listbox", { name: "People to mention" }).getByRole("option", { name: /Alex/ }).click();
  const read = () => page.locator("[data-state]").evaluate(node => JSON.parse(node.textContent));
  let draft = await read();
  assert.deepEqual(draft.mentionUserIds, ["member-a"], "one synchronous selection retains its ID");
  assert.match(draft.body, /@Alex/);
  await field.fill(`${draft.body} second @`);
  await page.getByRole("listbox", { name: "People to mention" }).getByRole("option", { name: /Blair/ }).click();
  await field.fill(`${await field.inputValue()} revised`);
  draft = await read();
  assert.deepEqual(draft.mentionUserIds, ["member-a", "member-b"], "second selection and rapid body edit retain both IDs");
  assert.match(draft.body, /@Alex.*@Blair.*revised/);
  await page.getByRole("button", { name: "Send" }).click();
  const sent = await page.evaluate(() => window.sent);
  assert.deepEqual(sent[0].mentionUserIds, ["member-a", "member-b"], "send payload names both recipients");
  assert.deepEqual((await read()).mentionUserIds, [], "accepted send clears selected mentions");
  await page.getByRole("button", { name: "Restore draft" }).click();
  assert.deepEqual(await read(), draft, "restored draft retains body and selected IDs");
  assert.deepEqual(errors, []);
  console.log("PASS actual React MentionField selection, batching, send, clear, and restore");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
