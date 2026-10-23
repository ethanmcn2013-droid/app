import assert from 'node:assert/strict';
import test from 'node:test';
import {createClient} from '@libsql/client';
import {loadAndValidateLedger} from './migration-ledger.mjs';
import {runMigrations} from './migrate.mjs';

test('0046 additive subfolder custody rehearses from prior head, constrains receipts, and replays idempotently', async()=>{
  const client=createClient({url:'file::memory:'});
  try {
    const prior=loadAndValidateLedger(); prior.forward=prior.forward.filter(e=>e.ordinal<46);
    await runMigrations({client,context:prior,releaseSha:'synthetic-before-subfolders'});
    await client.execute("INSERT INTO users(id,color,initials) VALUES('actor','#111','AA')");
    await client.execute("INSERT INTO workspaces(id,slug,name,owner_user_id) VALUES('project','project','Project','actor')");
    const result=await runMigrations({client,releaseSha:'synthetic-subfolders'});
    assert.deepEqual(result.applied,['0046_project_drive_subfolders']);
    assert.equal((await client.execute("SELECT count(*) AS n FROM users WHERE id='actor'")).rows[0].n,1);
    await client.execute("INSERT INTO provider_connections(id,user_id,provider,provider_account_id,root_folder_id,refresh_token_cipher,scopes,connected_at) VALUES('connection','actor','google_drive','account','root','synthetic','[]',1)");
    await client.execute("INSERT INTO workspace_storage(id,workspace_id,connection_id,folder_id,folder_web_view_link) VALUES('generation','project','connection','parent','https://drive.google.com/drive/folders/parent')");
    const insert=(id,status,name='Contracts')=>client.execute({sql:"INSERT INTO project_drive_subfolders(id,workspace_id,actor_user_id,storage_generation_id,connection_id,provider_account_id,parent_id,folder_name,status,created_at) VALUES(?,'project','actor','generation','connection','account','parent',?,?,1)",args:[id,name,status]});
    await insert('one','pending');
    await assert.rejects(insert('two','pending'));
    await assert.rejects(insert('three','complete','Other'));
    await assert.rejects(insert('four','invented','Other'));
    await assert.rejects(client.execute("UPDATE project_drive_subfolders SET provider_diagnostics='{}'"));
    await client.execute('PRAGMA foreign_keys=ON');
    await assert.rejects(client.execute("DELETE FROM workspace_storage WHERE id='generation'"));
    const replay=await runMigrations({client,releaseSha:'synthetic-subfolders-replay'});
    assert.deepEqual(replay.applied,[]);
    assert.equal((await client.execute('PRAGMA integrity_check')).rows[0].integrity_check,'ok');
    assert.equal((await client.execute('PRAGMA foreign_key_check')).rows.length,0);
  } finally {client.close();}
});
