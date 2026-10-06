import "server-only";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { createLocalConversationDatabaseAdapter, type ConversationSqlExecutor } from "@/server/conversations/database";
import { createPingCommandService } from "./command-service";
import { createPingProofFixture, PROOF_NOW, PROOF_FIXTURE_MARKER_KEY, PROOF_FIXTURE_MARKER_VALUE,
  proofCommand, proofContext, proofCount } from "./proof-fixture";

// Disposable process lifecycle proof, invoked only by the owning test. No ambient DB or providers.
const command = proofCommand(1, {}, 10), options = { now: () => PROOF_NOW };
async function verifiedRecoveryPath(input:string):Promise<string> {
  const candidate=resolve(input);
  if(basename(candidate)!=="synthetic.db"||!basename(dirname(candidate)).startsWith("signal-ping-proof-")) {
    throw new Error("invalid_ping_proof_fixture_path");
  }
  let actual:string,root:string;
  try { [actual,root]=await Promise.all([realpath(candidate),realpath(tmpdir())]); }
  catch {throw new Error("invalid_ping_proof_fixture_path");}
  const underRoot=relative(root,actual),segments=underRoot.split(sep);
  if(isAbsolute(underRoot)||underRoot.startsWith("..")||segments.length!==2||
    !segments[0].startsWith("signal-ping-proof-")||segments[1]!=="synthetic.db") {
    throw new Error("invalid_ping_proof_fixture_path");
  }
  return actual;
}
async function main() {
if (process.argv[2] === "contend") {
  const f = await createPingProofFixture();
  const second = createClient({ url: `file:${f.databasePath.replaceAll("\\", "/")}` });
  try {
    await second.execute("PRAGMA foreign_keys=ON"); await second.execute("PRAGMA busy_timeout=25");
    let release!: () => void, entered!: () => void, lastDriverCode = "";
    const held = new Promise<void>(resolve => { release=resolve; }), started = new Promise<void>(resolve => { entered=resolve; });
    const firstService=createPingCommandService(f.adapter,{ ...options, async afterWrite(seam,index) {
      if(seam==="task"&&index===1) { entered(); await held; }
    } });
    const observed: ConversationSqlExecutor = { async execute(statement) {
      try { return await second.execute(typeof statement === "string" ? statement : {sql:statement.sql,args:[...(statement.args??[])]}); }
      catch(error) { lastDriverCode=String((error as {code?:string}).code);throw error; }
    } };
    const contender=createPingCommandService(createLocalConversationDatabaseAdapter({client:observed}),options);
    const first=firstService.execute({command,context:proofContext(command)});
    await started;
    const blocked=await contender.execute({command,context:proofContext(command)});
    assert.deepEqual(blocked,{ok:false,reason:"temporarily_unavailable"}); assert.equal(lastDriverCode,"SQLITE_BUSY");
    release(); const committed=await first; assert.equal(committed.ok,true);
    const sameConnectionReplay=await contender.execute({command,context:proofContext(command)});
    if(sameConnectionReplay.ok) {
      assert.equal(sameConnectionReplay.replayed,true);
      if(committed.ok)assert.deepEqual(sameConnectionReplay.receipt,committed.receipt);
    } else assert.deepEqual(sameConnectionReplay,blocked);
    const newCommand=proofCommand(2,{},1);
    const sameConnectionNew=await contender.execute({command:newCommand,context:proofContext(newCommand)});
    if(!sameConnectionNew.ok)assert.deepEqual(sameConnectionNew,blocked);
    let newWriteCommitted=sameConnectionNew.ok;
    // Record actual safe platform behavior; recovery is allowed and the Windows defect is not required.
    second.close(); f.client.close();
    const fresh=createClient({url:`file:${f.databasePath.replaceAll("\\","/")}`});
    try {
      await fresh.execute("PRAGMA foreign_keys=ON");
      const restarted=createPingCommandService(createLocalConversationDatabaseAdapter({client:fresh}),options);
      const lookup=await restarted.getReceipt({actorId:"alice",commandId:command.commandId});
      if(lookup.ok) {
        assert.equal(lookup.state,"committed");
        if(lookup.state==="committed"&&committed.ok)assert.deepEqual(lookup.receipt,committed.receipt);
      } else assert.deepEqual(lookup,blocked);
      const replay=await restarted.execute({command,context:proofContext(command)});
      if(replay.ok) {
        assert.equal(replay.replayed,true);if(committed.ok)assert.deepEqual(replay.receipt,committed.receipt);
      } else assert.deepEqual(replay,blocked);
      const newWrite=await restarted.execute({command:newCommand,context:proofContext(newCommand)});
      if(newWrite.ok) {
        assert.equal(newWrite.replayed,newWriteCommitted);newWriteCommitted=true;
        if(sameConnectionNew.ok)assert.deepEqual(newWrite.receipt,sameConnectionNew.receipt);
      } else assert.deepEqual(newWrite,blocked);
      const expectedTaskCount=10+(newWriteCommitted?1:0),expectedReceiptCount=1+(newWriteCommitted?1:0);
      assert.equal(await proofCount(fresh,"tasks"),expectedTaskCount);assert.equal(await proofCount(fresh,"activities"),expectedTaskCount);
      assert.equal(await proofCount(fresh,"ping_command_receipts"),expectedReceiptCount);
      console.log(JSON.stringify({databasePath:f.databasePath,blocked:true,lastDriverCode,
        sameConnectionReplayRecovered:sameConnectionReplay.ok,sameConnectionNewWriteRecovered:sameConnectionNew.ok,
        sameProcessReopenReplayRecovered:replay.ok,sameProcessReopenWriteBlocked:!newWrite.ok,
        readRecovery:lookup.ok,newWriteCommitted,noDuplicateWrites:true}));
    } finally {fresh.close();}
  } finally {second.close();f.client.close();}
} else if(process.argv[2]==="recover" && process.argv[3]) {
  const verifiedPath=await verifiedRecoveryPath(process.argv[3]);
  const client=createClient({url:`file:${verifiedPath.replaceAll("\\","/")}`});
  try {
    const marker=(await client.execute({sql:"SELECT value FROM meta WHERE key=?",args:[PROOF_FIXTURE_MARKER_KEY]})).rows[0];
    if(marker?.value!==PROOF_FIXTURE_MARKER_VALUE)throw new Error("invalid_ping_proof_fixture_marker");
    await client.execute("PRAGMA foreign_keys=ON");
    const service=createPingCommandService(createLocalConversationDatabaseAdapter({client}),options);
    const lookup=await service.getReceipt({actorId:"alice",commandId:command.commandId});
    assert.equal(lookup.ok,true);if(lookup.ok)assert.equal(lookup.state,"committed");
    const replay=await service.execute({command,context:proofContext(command)});
    assert.equal(replay.ok,true,JSON.stringify(replay));if(replay.ok)assert.equal(replay.replayed,true);
    const newCommand=proofCommand(2,{},1);
    const priorNew=await service.getReceipt({actorId:"alice",commandId:newCommand.commandId});assert.equal(priorNew.ok,true);
    const previousNewWriteCommitted=priorNew.ok&&priorNew.state==="committed";
    assert.equal(await proofCount(client,"tasks"),10+(previousNewWriteCommitted?1:0));
    assert.equal(await proofCount(client,"activities"),10+(previousNewWriteCommitted?1:0));
    assert.equal(await proofCount(client,"ping_command_receipts"),1+(previousNewWriteCommitted?1:0));
    const newResult=await service.execute({command:newCommand,context:proofContext(newCommand)});assert.equal(newResult.ok,true);
    if(newResult.ok)assert.equal(newResult.replayed,previousNewWriteCommitted);
    assert.equal(await proofCount(client,"tasks"),11);assert.equal(await proofCount(client,"ping_command_receipts"),2);
    await client.execute("DELETE FROM workspace_members WHERE user_id='alice'");
    assert.deepEqual(await service.getReceipt({actorId:"alice",commandId:command.commandId}),{ok:false,reason:"unavailable"});
    console.log(JSON.stringify({freshProcessRecovered:true,originalIdentity:true,noDuplicateWrites:true,currentAuth:true,previousNewWriteCommitted}));
  } finally {client.close();}
} else {throw new Error("invalid_proof_mode");}
}
void main().catch(error => {
  const reason=error instanceof Error&&error.message.startsWith("invalid_ping_proof_fixture")?error.message:"ping_proof_worker_failed";
  console.error(reason);process.exitCode=1;
});
