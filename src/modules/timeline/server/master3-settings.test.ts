import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createClient} from '@libsql/client';
import {drizzle} from 'drizzle-orm/libsql';
import * as schema from './db/timeline-schema';
process.env.TIMELINE_DATABASE_URL='file::memory:';

test('actual SQLite owner-scoped settings and publication snapshot stay independent; unmigrated reads safe',async()=>{
 const {createMaster3SettingsStore}=await import('./master3-settings'); const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timeline-master3-settings-'));const client=createClient({url:pathToFileURL(path.join(dir,'fixture.db')).href});try{
  const database=drizzle(client,{schema});const store=createMaster3SettingsStore(database);
  assert.equal(await store.available(),false);assert.equal(await store.project('owned','plan'),undefined);assert.equal(await store.publication('public'),undefined);
  await client.executeMultiple(fs.readFileSync('drizzle-timeline/0000_timeline_baseline.sql','utf8'));
  await assert.rejects(store.saveProject('owner','owned','plan',{}),/Timeline not found/);
  await client.execute("INSERT INTO workspaces(slug,name,owner_user_id) VALUES('owned','Synthetic','owner'),('foreign','Other','other')");
  await client.execute("INSERT INTO projects(workspace_slug,slug,name,one_liner,accent) VALUES('owned','plan','Plan','','blue'),('foreign','plan','Other','','blue')");
  await client.executeMultiple(fs.readFileSync('drizzle-timeline/0002_master3_presentation.sql','utf8').replace(/^\uFEFF/,''));
  await client.execute("INSERT INTO node_overlays(workspace_slug,node_id,source,manual_title) VALUES('owned','manual:plan:first','manual','First'),('owned','manual:elsewhere:foreign','manual','Foreign')");
  await store.saveProject('owner','owned','plan',{presentation:{onDayNote:'First'},items:{'manual:plan:first':{note:'Public note'}}});
  await assert.rejects(store.saveProject('owner','owned','plan',{items:{unknown:{note:'Wrong'}}}),/outside/);
  await assert.rejects(store.saveProject('owner','owned','plan',{items:{'manual:elsewhere:foreign':{note:'Wrong'}}}),/outside/);
  await assert.rejects(store.saveProject('other','owned','plan',{presentation:{onDayNote:'Forbidden'}}),/not found/);
  await client.execute("INSERT INTO timeline_publications(id,workspace_slug,source_workspace_id,source_digest,label,audience_kind,timezone) VALUES('public','owned','tasks','digest','Synthetic','module','Europe/Dublin')");
  await client.execute("INSERT INTO timeline_publication_items(public_id,publication_id,title,state,source_relation,source_digest) VALUES('public_item','public','Open','next','private_node','digest')");
  await store.savePublication('owner','owned','public',{presentation:{onDayNote:'Frozen'},items:{public_item:{note:'Only explicit note'}}});
  await store.saveProject('owner','owned','plan',{presentation:{onDayNote:'Changed current'}});
  assert.equal((await store.publication('public'))?.presentation?.onDayNote,'Frozen');
  assert.equal((await store.project('owned','plan'))?.presentation?.onDayNote,'Changed current');
  await assert.rejects(store.savePublication('owner','foreign','public',{}),/not found/);
  await assert.rejects(store.savePublication('owner','owned','public',{items:{private_node:{note:'Wrong id'}}}),/outside/);
  assert.deepEqual(Object.keys((await store.publication('public'))?.items??{}),['public_item']);
  assert.equal(Number((await client.execute('SELECT COUNT(*) AS n FROM timeline_guest_subscriptions')).rows[0].n),0);
  await client.execute("UPDATE timeline_publications SET state='published' WHERE id='public'");
  const tokenHash='a'.repeat(64);
  await client.execute({sql:"INSERT INTO audience_shares(id,publication_id,token_hash,state) VALUES('share','public',?,'active')",args:[tokenHash]});
  await client.execute({sql:"INSERT INTO timeline_guest_subscriptions(id,publication_id,share_token_hash,email,email_hash,state,delivery_state,confirmed_at) VALUES('sub','public',?,'synthetic@example.test',?,'confirmed','sent',unixepoch())",args:[tokenHash,'b'.repeat(64)]});
  await store.savePublication('owner','owned','public',{presentation:{onDayNote:'Published update'}});
  assert.equal(Number((await client.execute('SELECT COUNT(*) AS n FROM timeline_guest_deliveries')).rows[0].n),1);
  await store.savePublication('owner','owned','public',{presentation:{onDayNote:'Published update'}});
  assert.equal(Number((await client.execute('SELECT COUNT(*) AS n FROM timeline_guest_deliveries')).rows[0].n),1);
  await store.savePublication('owner','owned','public',{presentation:{onDayNote:'Published update',photosUrl:'https://example.test/album'}});
  assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM timeline_guest_deliveries WHERE kind='photos'")).rows[0].n),1);
  await client.execute("CREATE TRIGGER reject_queue BEFORE INSERT ON timeline_guest_deliveries BEGIN SELECT RAISE(ABORT,'synthetic queue failure'); END");
  await store.savePublication('owner','owned','public',{presentation:{onDayNote:'Primary save survives',photosUrl:'https://example.test/album'}});
  assert.equal((await store.publication('public'))?.presentation?.onDayNote,'Primary save survives');
  assert.equal(Number((await client.execute('SELECT COUNT(*) AS n FROM timeline_guest_deliveries')).rows[0].n),2);
  await store.saveProject('owner','owned','plan',{presentation:{onDayNote:'Private only'}});
  assert.equal(Number((await client.execute('SELECT COUNT(*) AS n FROM timeline_guest_deliveries')).rows[0].n),2);

 }finally{client.close();try{fs.rmSync(dir,{recursive:true,force:true});}catch{/* libSQL may retain the handle after close on Windows, matching test-temp-database.mjs. */}}
});
