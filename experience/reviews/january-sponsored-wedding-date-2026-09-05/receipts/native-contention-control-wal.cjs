const {createRequire}=require('node:module');
const {pathToFileURL}=require('node:url');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const req=createRequire(join(process.argv[2],'package.json'));
const {createClient}=req('@libsql/client');
(async()=>{
  const url=pathToFileURL(join(__dirname,'native-contention-'+Date.now()+'.db')).href;
  const a=createClient({url}),b=createClient({url});
  try {
    await a.execute('CREATE TABLE control (id TEXT PRIMARY KEY)'); await a.execute('PRAGMA journal_mode=WAL');
    const held=await a.transaction();
    await assert.rejects(()=>b.transaction(),/SQLITE_BUSY/);
    await held.rollback();
    const retry=await b.transaction();
    let failure;
    try { await retry.execute('SELECT * FROM control'); await retry.commit(); }
    catch(error){failure=String(error); await retry.rollback();}
    assert.match(failure??'',/SQLITE_BUSY.*SQL statements in progress/);
    console.log(JSON.stringify({control:'bare libSQL, no App implementation imported',afterContention:failure}));
    await b.reconnect();
    const fresh=await b.transaction();await fresh.execute('SELECT * FROM control');await fresh.commit();
    console.log('isolated reconnect permits the same transaction');
  }finally{a.close();b.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
