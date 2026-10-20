import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createClient} from '@libsql/client';
import {drizzle} from 'drizzle-orm/libsql';
import * as schema from './db/timeline-schema';
import {createOwnerGuestSummaryStore,saveOwnerReferralPreference} from './owner-guest-summary';

async function fixture(){const directory=mkdtempSync(join(tmpdir(),'timeline-owner-summary-')),client=createClient({url:pathToFileURL(join(directory,'fixture.sqlite')).href});await client.executeMultiple(readFileSync('drizzle-timeline/0000_timeline_baseline.sql','utf8'));await client.execute("INSERT INTO workspaces(slug,name,owner_user_id) VALUES('owned','Synthetic','owner'),('other','Other','other')");await client.execute("INSERT INTO timeline_publications(id,workspace_slug,source_workspace_id,source_digest,label,audience_kind,timezone,state) VALUES('public','owned','tasks','digest','Synthetic','couple','Europe/Dublin','published'),('foreign','other','tasks-other','digest-other','Other','couple','Europe/Dublin','published')");const database=drizzle(client,{schema});return {client,database,store:createOwnerGuestSummaryStore(database),migrate:()=>client.executeMultiple(readFileSync('drizzle-timeline/0002_master3_presentation.sql','utf8'))};}

test('owner aggregate fails safely before0002 and denies other actors/workspaces/publications',async()=>{const f=await fixture();try{assert.deepEqual(await f.store.read('owner','owned','public'),{});await assert.rejects(f.store.read('other','owned','public'),/not found/);await assert.rejects(f.store.read('owner','other','foreign'),/not found/);await assert.rejects(f.store.read('owner','owned','foreign'),/not found/);}finally{f.client.close();}});

test('actual confirmed unique follower count excludes pending, unsubscribed, unknown, expired, revoked, cross-publication and unpublished',async()=>{const f=await fixture();try{await f.migrate();const now=new Date('2026-11-01Z');for(const [id,state,expiry,pub] of [['active','active',null,'public'],['second','active',null,'public'],['expired','active',1,'public'],['revoked','revoked',null,'public'],['foreign','active',null,'foreign']] as const)await f.client.execute({sql:'INSERT INTO audience_shares(id,publication_id,token_hash,state,expires_at) VALUES(?,?,?,?,?)',args:[id,pub,id+'-hash',state,expiry]});
 const cases=[['confirmed','active','one','confirmed','sent','public'],['duplicate','second','one','confirmed','sent','public'],['second-person','active','two','confirmed','sent','public'],['pending','active','three','pending','sent','public'],['unsubscribed','active','four','unsubscribed','sent','public'],['unknown','active','five','confirmed','unknown','public'],['expired','expired','six','confirmed','sent','public'],['revoked','revoked','seven','confirmed','sent','public'],['foreign','foreign','eight','confirmed','sent','foreign'],['wrong-publication','foreign','nine','confirmed','sent','public']] as const;
 for(const [id,share,emailHash,state,delivery,pub] of cases)await f.client.execute({sql:'INSERT INTO timeline_guest_subscriptions(id,publication_id,share_token_hash,email,email_hash,state,delivery_state,confirmed_at) VALUES(?,?,?,?,?,?,?,?)',args:[id,pub,share+'-hash',id+'@example.invalid',emailHash,state,delivery,state==='confirmed'?1:null]});
 assert.deepEqual(await f.store.read('owner','owned','public',now),{followerCount:2});await f.client.execute("UPDATE audience_shares SET state='revoked' WHERE id='active'");assert.deepEqual(await f.store.read('owner','owned','public',now),{followerCount:1});await f.client.execute("UPDATE timeline_publications SET state='unpublished' WHERE id='public'");assert.deepEqual(await f.store.read('owner','owned','public',now),{followerCount:0});
 }finally{f.client.close();}});

test('referral sends only the requested field to the atomic action and surfaces fresh authority failures',async()=>{
 let saves=0;const ports={authorize:async()=>true,save:async(form:FormData)=>{saves++;assert.deepEqual([...form.entries()],[['workspaceSlug','owned'],['publicationId','public'],['referral','false']]);return {saved:true};}};
 await saveOwnerReferralPreference(ports,{workspaceSlug:'owned',publicationId:'public'},false);assert.equal(saves,1);
 await assert.rejects(saveOwnerReferralPreference({...ports,authorize:async()=>false},{workspaceSlug:'owned',publicationId:'public'},true),/not found/);assert.equal(saves,1);
 await assert.rejects(saveOwnerReferralPreference({...ports,save:async()=>({error:'Current authority denied'})},{workspaceSlug:'owned',publicationId:'public'},true),/Current authority denied/);
});
