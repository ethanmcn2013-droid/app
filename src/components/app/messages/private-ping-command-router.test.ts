import assert from "node:assert/strict";
import test from "node:test";
import { claimPrivatePingForwardOnce, parsePrivatePingCommand, privatePingForwardKey, routePrivatePingCommand } from "./private-ping-command-router";

test("only an exact leading @Ping token is routed as a private command",()=>{
  assert.deepEqual(parsePrivatePingCommand("@Ping create three tasks"),{text:"create three tasks"});
  assert.deepEqual(parsePrivatePingCommand("@Ping\nread this"),{text:"read this"});
  for(const ordinary of ["@Pingster create tasks","Hi @Ping create tasks","@PingCreate tasks"])assert.equal(parsePrivatePingCommand(ordinary),null,ordinary);
  for(const command of ['@ping create tasks',' @Ping create tasks','\n@PING create tasks'])assert.deepEqual(parsePrivatePingCommand(command),{text:'create tasks'});
  assert.deepEqual(parsePrivatePingCommand("@Ping"),{text:""});
});

test("the command boundary never shares Ping text and ordinary sends still use the original callback",()=>{
  let shared=0;const privateRequests:{text:string}[]=[];let blocked=0;
  const base={enabled:true,canOpen:true,sendShared:()=>{shared++;},openPrivate:(command:{text:string})=>privateRequests.push(command),blocked:()=>{blocked++;}};
  assert.equal(routePrivatePingCommand({...base,draft:"@Ping assign this to Aoife"}),"private");
  assert.equal(shared,0);assert.deepEqual(privateRequests,[{text:"assign this to Aoife"}]);
  assert.equal(routePrivatePingCommand({...base,draft:"Please @Ping tell me"}),"shared");
  assert.equal(shared,1);assert.equal(privateRequests.length,1);
  assert.equal(routePrivatePingCommand({...base,draft:"@Ping this chat is not readable",canOpen:false}),"blocked");
  assert.equal(shared,1);assert.equal(blocked,1);
});

test("forward request identity is claimed once without storing its text",()=>{
  const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
  const key=privatePingForwardKey("actor-a","ping_command_12345678");
  assert.equal(claimPrivatePingForwardOnce(storage,key),true);
  assert.equal(claimPrivatePingForwardOnce(storage,key),false);
  assert.deepEqual([...values],[[key,"1"]]);
});
