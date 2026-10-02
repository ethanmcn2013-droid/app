/* eslint-disable @typescript-eslint/no-require-imports -- RC-3 actual action/hook/provider/reducer regressions with isolated SQLite. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {realtimeFixture,deferred,until}=require('./realtime-fixture.cjs');
const ids=tasks=>tasks.map(task=>task.id);
const options=(f,more={})=>({projectId:'project-b',actorId:'recipient',onDirty:f.onDirty,onChange:f.onChange,...more});
// The provider may add nonvisual contexts. Select by contract, not wrapper depth.
function providerValue(tree,accept){
  for(let node=tree;node?.props;node=node.props.children){if(accept(node.props.value))return node.props.value;}
  throw Error('Expected TasksProvider context was not rendered');
}
const taskDispatchers=tree=>providerValue(tree,value=>typeof value?.moveTaskToColumn==='function');
const taskState=tree=>providerValue(tree,value=>Array.isArray(value?.tasks));
async function mountReadyProvider(f,props){
  f.host.render(f.provider,props);
  await until(()=>f.reads.length===1); // Initial browser epoch is absent: Provider reads before writing.
  await new Promise(resolve=>setImmediate(resolve));
  f.host.render();
  f.reads.length=0;
}

test('scoped action reauthorizes explicit B; missing/malformed/foreign/removed/wrong-account targets never substitute A',async()=>{
  const f=await realtimeFixture();
  try {
    for(const enabled of [true,false]){
      f.state.v3=enabled;
      assert.deepEqual(ids(await f.actions.getTasksAction('project-b')),['b-live']);
      assert.deepEqual(ids(await f.actions.getTasksAction('project-a')),['a-live']);
      for(const target of [undefined,null,'',' bad ',{},7,['project-b'],'project-c','missing'])assert.deepEqual(await f.actions.getTasksAction(target),[]);
    }
    f.state.actor='outsider';assert.deepEqual(await f.actions.getTasksAction('project-b'),[]);
    f.state.actor='recipient';await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='project-b' AND user_id='recipient'");
    assert.deepEqual(await f.actions.getTasksAction('project-b'),[]);
    f.state.actor='creator';assert.deepEqual(ids(await f.actions.getTasksAction('project-b')),['b-live']);
    await f.client.execute("UPDATE workspaces SET archived_at=1 WHERE id='project-b'");
    assert.deepEqual(ids(await f.actions.getTasksAction('project-b')),['b-live']);
    assert.equal(f.state.cookieWrites.length,0);
  } finally {await f.close();}
});

test('RC-3: peer dirty signal followed by an explicit scoped action/reducer read keeps B while A remains preferred',async()=>{
  const f=await realtimeFixture();
  try {
    f.resetState(await f.load('src/server/db/queries').getTasks('project-b'));
    f.host.render(f.hook,options(f));
    await f.client.execute("UPDATE tasks SET title='B peer edit' WHERE id='b-live'");
    f.streams[0].emit();
    if(process.env.RECIPIENT_REALTIME_BASELINE==='24417b35'){
      // Keep the historical red control on its original callback boundary.
      await until(()=>f.changes.length===1);
    } else {
      assert.equal(f.dirty.length,1);
      assert.equal(f.reads.length,0); // The current hook signals; Provider owns the read scheduler.
      f.onChange(await f.facade.getTasksAction('project-b'));
    }
    assert.deepEqual(ids(f.reducerState.tasks),['b-live']);
    assert.equal(f.reducerState.tasks[0].title,'B peer edit');
    assert.deepEqual(f.reads,[['project-b']]);
    assert.equal(f.state.cookies.get('tasks_active_ws'),'project-a');assert.equal(f.state.cookieWrites.length,0);
  } finally {await f.close();}
});

test('peer events remain dirty signals; hook does not perform Provider reads or own cooldown timers',async()=>{
  const f=await realtimeFixture();
  try {
    f.host.render(f.hook,options(f));const stream=f.streams[0];
    stream.emit();stream.emit();stream.emit();
    await f.client.execute("UPDATE tasks SET title='B queued edit' WHERE id='b-live'");
    assert.equal(f.dirty.length,3);
    assert.equal(f.reads.length,0);assert.equal(f.timers.size,0);
    f.onChange(await f.facade.getTasksAction('project-b'));
    assert.equal(f.reducerState.tasks[0].title,'B queued edit');
  } finally {await f.close();}
});

test('project change closes B subscription before A receives new dirty signals and scoped reads',async()=>{
  const f=await realtimeFixture();
  try {
    f.host.render(f.hook,options(f));const old=f.streams[0];old.emit();
    assert.equal(f.dirty.length,1);
    f.resetState(await f.load('src/server/db/queries').getTasks('project-a'));
    f.host.render(f.hook,options(f,{projectId:'project-a'}));
    assert.equal(old.closed,true);assert.equal(old.listeners.size,0);
    old.emit();assert.equal(f.dirty.length,1);
    f.streams[1].emit();assert.equal(f.dirty.length,2);
    f.onChange(await f.facade.getTasksAction('project-a'));
    assert.deepEqual(f.reads,[['project-a']]);assert.deepEqual(ids(f.reducerState.tasks),['a-live']);
  } finally {await f.close();}
});

test('account change replaces the subscription and a scoped read freshly authorizes the replacement account',async()=>{
  const f=await realtimeFixture();
  try {
    f.host.render(f.hook,options(f));const old=f.streams[0];old.emit();
    assert.equal(f.dirty.length,1);
    f.state.actor='outsider';f.host.render(f.hook,options(f,{actorId:'outsider'}));
    old.emit();assert.equal(f.dirty.length,1);
    f.streams[1].emit();assert.equal(f.dirty.length,2);
    f.onChange(await f.facade.getTasksAction('project-b'));
    assert.deepEqual(f.reducerState.tasks,[]);assert.equal(old.closed,true);
  } finally {await f.close();}
});

test('unmount detaches dirty callbacks without starting reads or cooldown timers',async()=>{
  const f=await realtimeFixture();
  try {
    f.host.render(f.hook,options(f));const stream=f.streams[0];stream.emit();
    assert.equal(f.dirty.length,1);
    f.host.unmount();stream.emit();f.clock.tick();
    assert.equal(f.dirty.length,1);assert.equal(f.reads.length,0);assert.equal(f.timers.size,0);
  } finally {await f.close();}
  const second=await realtimeFixture();
  try {
    second.host.render(second.hook,options(second));second.streams[0].emit();
    assert.equal(second.dirty.length,1);
    second.host.unmount();assert.equal(second.streams[0].closed,true);
    assert.equal(second.timers.size,0);assert.equal(second.reads.length,0);
  } finally {await second.close();}
});

test('closed/disabled stream stops while transient connection errors preserve the supported subscription',async()=>{
  const f=await realtimeFixture();
  try {
    f.host.render(f.hook,options(f,{clientId:'this-tab'}));const stream=f.streams[0];
    assert.equal(stream.url,'/api/events?cid=this-tab');
    stream.readyState=0;stream.emit('error');assert.equal(stream.closed,false);
    stream.readyState=1;stream.emit();assert.equal(f.dirty.length,1);
    stream.emit();stream.readyState=2;stream.emit('error');
    assert.equal(stream.closed,true);assert.equal(stream.listeners.size,0);assert.equal(f.timers.size,0);
    f.clock.tick();stream.emit();assert.equal(f.dirty.length,2);assert.equal(f.reads.length,0);
  } finally {await f.close();}
});

test('actual event endpoint keeps disabled204 and enabled global kind/clientId/ts frames unchanged',async()=>{
  const f=await realtimeFixture(),abort=new AbortController();
  try {
    const events=f.compile('src/server/events.ts');
    const disabled=f.compile('src/app/api/events/route.ts',{'@/server/events':events},{REALTIME_ENABLED:'false'});
    assert.equal((await disabled.GET(new Request('http://fixture.invalid/api/events'))).status,204);
    const enabled=f.compile('src/app/api/events/route.ts',{'@/server/events':events},{REALTIME_ENABLED:'true'});
    const response=await enabled.GET(new Request('http://fixture.invalid/api/events',{signal:abort.signal}));
    assert.equal(response.status,200);const reader=response.body.getReader();await reader.read();
    events.emitTasksChanged({kind:'peer',clientId:'other'});
    const frame=new TextDecoder().decode((await reader.read()).value);
    assert.match(frame,/event: tasks-changed/);
    assert.deepEqual(Object.keys(JSON.parse(frame.split('data: ')[1].trim())).sort(),['clientId','kind','ts']);
    abort.abort();assert.equal(events.tasksEvents.listenerCount('tasks-changed'),0);
  } finally {abort.abort();await f.close();}
});

test('demo does not open a stream or read identity/database; custom-column optimism remains in memory',async()=>{
  const f=await realtimeFixture();
  try {
    f.state.demo=true;const before=f.state.authCalls;
    assert.ok((await f.actions.getTasksAction(undefined)).length>0);
    f.host.render(f.provider,{projectId:'demo',actorId:'demo',initialTasks:[{id:'demo-card',title:'Demo',lane:'todo',priority:'p2',assignees:[]}]});
    const tree=f.host.render();taskDispatchers(tree).moveTaskToColumn('demo-card','col-extra');
    assert.equal(taskState(f.host.render()).tasks[0].boardColumnKey,'col-extra');
    assert.equal(f.host.transitions.length,0);assert.equal(f.streams.length,0);assert.equal(f.reads.length,0);assert.equal(f.state.authCalls,before);
  } finally {await f.close();}
});

test('demo with an existing or changed browser epoch never schedules a scoped server read',async()=>{
  const f=await realtimeFixture(),originalDocument=globalThis.document;
  try {
    f.state.demo=true;
    const before=f.state.authCalls;
    globalThis.document={cookie:`signal_task_snapshot_epoch=${'a'.repeat(32)}`};
    const initialTasks=[{id:'demo-card',title:'Demo',lane:'todo',priority:'p2',assignees:[]}];
    f.host.render(f.provider,{projectId:'demo',actorId:'demo',initialTasks});
    globalThis.document.cookie=`signal_task_snapshot_epoch=${'b'.repeat(32)}`;
    f.host.render();
    assert.equal(f.reads.length,0);assert.equal(f.streams.length,0);
    assert.equal(f.state.authCalls,before);
    assert.deepEqual(ids(taskState(f.host.render()).tasks),['demo-card']);
  } finally {
    await f.close();
    if(originalDocument===undefined)delete globalThis.document;
    else globalThis.document=originalDocument;
  }
});

test('custom-column actual write rereads displayed B rather than A and reconciles the persisted copy',async()=>{
  const f=await realtimeFixture();
  try {
    const initialTasks=await f.load('src/server/db/queries').getTasks('project-b');
    await mountReadyProvider(f,{projectId:'project-b',actorId:'recipient',initialTasks});
    f.afterMove=()=>f.client.execute("UPDATE tasks SET title='B canonical post-write' WHERE id='b-live'");
    taskDispatchers(f.host.render()).moveTaskToColumn('b-live','col-extra');
    await until(()=>taskState(f.host.render()).tasks[0].title==='B canonical post-write');
    assert.deepEqual(f.reads,[['project-b']]);const result=taskState(f.host.render()).tasks;
    assert.deepEqual(ids(result),['b-live']);assert.equal(result[0].title,'B canonical post-write');assert.equal(result[0].boardColumnKey,'col-extra');
    const a=(await f.client.execute("SELECT title,board_column_key FROM tasks WHERE id='a-live'")).rows[0];assert.equal(a.title,'Only A');assert.equal(a.board_column_key,null);
  } finally {await f.close();}
});

test('custom-column response after unmount skips its reread; an in-flight reread cannot hydrate the disposed provider',async()=>{
  for(const phase of ['write','read']){
    const f=await realtimeFixture(),hold=deferred();let waiting=false;
    try {
      const initialTasks=await f.load('src/server/db/queries').getTasks('project-b');
      await mountReadyProvider(f,{projectId:'project-b',actorId:'recipient',initialTasks});
      const delay=async()=>{waiting=true;await hold.promise;};
      f.afterMove=async()=>{await f.client.execute("UPDATE tasks SET title='B server change' WHERE id='b-live'");if(phase==='write')await delay();};
      if(phase==='read')f.afterRead=delay;
      taskDispatchers(f.host.render()).moveTaskToColumn('b-live','col-extra');await until(()=>waiting);
      f.host.unmount();hold.resolve();await new Promise(resolve=>setImmediate(resolve));
      assert.equal(f.reads.length,phase==='write'?0:1);
      assert.equal(taskState(f.host.render()).tasks[0].title,'Only B');
    } finally {hold.resolve();await f.close();}
  }
});

test('actual runtime emits distinct provider keys for verified actor/project and supplies both identities',async()=>{
  const f=await require('./route-fixture.cjs').routeFixture();
  const find=node=>{if(!node||typeof node!=='object')return null;if(node.$component?.name==='TasksProvider')return node;for(const value of Object.values(node)){const result=find(value);if(result)return result;}return null;};
  try {
    const b=find((await f.render('/app/my-tasks?workspaceId=project-b')).tree);
    const a=find((await f.render('/app/my-tasks?workspaceId=project-a')).tree);
    f.state.actor='user_creator';const other=find((await f.render('/app/my-tasks?workspaceId=project-b')).tree);
    assert.equal(b.props.projectId,'project-b');assert.equal(b.props.actorId,'user_recipient');
    assert.equal(b.key,JSON.stringify(['user_recipient','project-b']));
    assert.notEqual(b.key,a.key);assert.notEqual(b.key,other.key);
  } finally {await f.close();}
});
