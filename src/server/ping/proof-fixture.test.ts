import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPingProofFixture, PROOF_PROJECT, PROOF_NOW, proofCommand, proofContext, type PingProofFixtureOptions } from "./proof-fixture";
import { createPingCommandService } from "./command-service";

test("explicit fixture reopen preserves original receipt and rejects identity/schema/marker drift without reseeding", async () => {
  const scratchDirectory = await mkdtemp(join(tmpdir(), "ping-fixture-reopen-"));
  const options: PingProofFixtureOptions = { scratchDirectory, databasePath: join(scratchDirectory,"synthetic.db"), mode:"create",
    binding:{sessionId:"synthetic-reopen",sourceRevision:"a".repeat(40),manifestSha256:"b".repeat(64),actorId:"alice",projectId:PROOF_PROJECT} };
  const fixture = await createPingProofFixture(options);
  const command=proofCommand(777);
  const service=createPingCommandService(fixture.adapter,{now:()=>PROOF_NOW});
  const result=await service.execute({command,context:proofContext(command)});
  assert.equal(result.ok,true);
  const before=(await fixture.client.execute("SELECT * FROM tasks ORDER BY id")).rows;
  fixture.client.close();
  await assert.rejects(createPingProofFixture(options),/EEXIST/);
  await assert.rejects(createPingProofFixture({...options,mode:"reopen",binding:{...options.binding,sessionId:"wrong-session"}}),/identity/);
  const reopened=await createPingProofFixture({...options,mode:"reopen"});
  try {
    assert.equal(reopened.reopened,true);assert.deepEqual((await reopened.client.execute("SELECT * FROM tasks ORDER BY id")).rows,before);
    const recovered=await createPingCommandService(reopened.adapter,{now:()=>PROOF_NOW}).getReceipt({actorId:"alice",commandId:command.commandId});
    assert.equal(recovered.ok,true);assert.deepEqual(recovered.ok&&recovered.state==='committed'?recovered.receipt:null,result.ok?result.receipt:null);
    await reopened.client.execute("CREATE TABLE unexpected_fixture_drift(id TEXT)");
  } finally {reopened.client.close();}
  const bytesBefore=await readFile(options.databasePath);
  await assert.rejects(createPingProofFixture({...options,mode:"reopen"}),/schema/);
  assert.deepEqual(await readFile(options.databasePath),bytesBefore);
});

test("explicit fixture cannot escape its admitted scratch root", async () => {
  const scratchDirectory=await mkdtemp(join(tmpdir(),"ping-fixture-boundary-"));
  await assert.rejects(createPingProofFixture({scratchDirectory,databasePath:join(scratchDirectory,"..","outside.db"),mode:"create",
    binding:{sessionId:"outside",sourceRevision:"a".repeat(40),manifestSha256:"b".repeat(64),actorId:"alice",projectId:PROOF_PROJECT}}),/inside/);
});
