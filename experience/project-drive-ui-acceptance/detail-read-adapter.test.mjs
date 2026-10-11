import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { detailReadFetchAdapter } from './detail-read-adapter.mjs';

function fixture() {
  const reads=[],delegated=[];
  const window={fetch:async(...args)=>{delegated.push(args);return new Response(null,{status:204});},
    __drive:{async list(id){reads.push(id);return [{id:'synthetic-resource'}];}}};
  runInNewContext(detailReadFetchAdapter,{window,location:{origin:'http://127.0.0.1:4414',href:'http://127.0.0.1:4414/'},URL,Headers,Response});
  return {window,reads,delegated};
}
const input={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({section:'resources',taskId:'drive-task'})};
test('actual HTTP read transport port preserves rows, failures and private headers',async()=>{
  const f=fixture(), response=await f.window.fetch('/api/tasks/detail-read',input);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{value:[{id:'synthetic-resource'}]});
  assert.deepEqual(f.reads,['drive-task']);assert.equal(response.headers.get('vary'),'Cookie');
  assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
  f.window.__drive.list=async()=>{throw Error('synthetic failed read');};
  assert.equal((await f.window.fetch('/api/tasks/detail-read',input)).status,500);
});
test('only exact same-origin POST/resources/task body qualifies',async()=>{
  for(const altered of [{...input,method:'GET'},{...input,headers:{}},{...input,body:'{}'},
    {...input,body:JSON.stringify({section:'resources',taskId:'foreign'})},
    {...input,body:JSON.stringify({section:'notes',taskId:'drive-task'})},
    {...input,body:JSON.stringify({section:'resources',taskId:'drive-task',extra:true})}]) {
    const f=fixture();await assert.rejects(()=>f.window.fetch('/api/tasks/detail-read',altered));assert.equal(f.reads.length,0);
  }
  const f=fixture();await assert.rejects(()=>f.window.fetch('/api/tasks/detail-read?foreign=1',input));
  await f.window.fetch('/unrelated',input);assert.equal(f.delegated.length,1);assert.equal(f.reads.length,0);
});
