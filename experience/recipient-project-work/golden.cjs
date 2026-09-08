/* eslint-disable @typescript-eslint/no-require-imports -- Continuous source-loader proof with local SQLite and request/provider adapters. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { recipientFixture } = require('./fixture.cjs');
const root = path.resolve(__dirname, '../..'), dep = createRequire(path.join(root,'package.json'));
const { createClient } = dep('@libsql/client'), { drizzle } = dep('drizzle-orm/libsql');
const { renderToStaticMarkup } = dep('react-dom/server');

async function runGoldenStory() {
  const f = await recipientFixture(), clients = [], checks = [], requests = [], sent = [];
  const output = path.resolve(process.env.RECIPIENT_OUTPUT ?? path.join(root,'experience/output/recipient-project-work/golden'));
  fs.mkdirSync(output,{recursive:true});
  const check = (name, evidence = {}) => { checks.push({name,...evidence}); console.log('PASS '+name); };
  const sql = async (query,args=[]) => (await f.client.execute({sql:query,args})).rows;
  const form = values => { const data=new FormData(); for(const [key,value] of Object.entries(values)) for(const item of Array.isArray(value)?value:[value]) data.append(key,item); return data; };
  const initialEnv = {...process.env};
  const urls = { app: pathToFileURL(path.join(f.directory,'app.db')).href };
  async function store(kind, schemaPath, folder) {
    const url=pathToFileURL(path.join(f.directory,kind+'.db')).href;urls[kind]=url;
    const client=createClient({url});clients.push(client);
    for(const file of fs.readdirSync(path.join(root,folder)).filter(x=>/^\d{4}.*\.sql$/.test(x)).sort()) await client.executeMultiple(f.sourceText(folder+'/'+file));
    const schema=f.load(schemaPath);return {client,db:drizzle(client,{schema}),schema};
  }
  let failure;
  try {
    // Explicit prerequisites only: existing accounts and initialized projects.
    // No notes, tasks, invite, member acceptance, Timeline, publication or Home
    // row is seeded. Those are produced below by the actual application.
    await f.client.executeMultiple("UPDATE users SET clerk_id=id,email=id||'@example.test',name=id; DELETE FROM workspace_members WHERE workspace_id='project-b' AND user_id='recipient';");
    assert.equal((await sql('SELECT count(*) n FROM tasks'))[0].n,0);
    const notes=await store('notes','src/modules/notes/server/db/notes-schema','drizzle-notes');
    const timeline=await store('timeline','src/modules/timeline/server/db/timeline-schema','drizzle-timeline');
    const signal=await store('signal','src/modules/signal/server/db/signal-analytics-schema','drizzle-signal');
    f.overrides.set('src/modules/notes/server/db/notes-client',{db:notes.db});
    f.overrides.set('src/modules/timeline/server/db/timeline-client',{db:timeline.db,schema:timeline.schema});
    f.overrides.set('src/modules/signal/server/db/signal-analytics-client',{signalAnalyticsDb:signal.db});
    f.boundary['@libsql/client']={...dep('@libsql/client'),createClient: options=>{
      assert.ok(Object.values(urls).includes(options.url),'only this fixture’s exact SQLite stores are reachable');
      const client=createClient(options);clients.push(client);return client;
    }};
    f.boundary['@clerk/nextjs/server']={
      auth:async()=>({userId:f.state.actor}),
      currentUser:async()=>({id:f.state.actor,primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',emailAddress:f.state.actor+'@example.test',verification:{status:'verified'}}]}),
      clerkClient:async()=>{throw Error('Unexpected provider user lookup')},
    };
    // This continuous writer run uses the real request clock. The Stage 1
    // visual fixtures use January dates; mixing that frame with September
    // commits would legitimately hide completion older than seven days.
    f.ui['src/components/app/room/room-brief-context'].useCalendarFrame=()=>({nowIso:new Date().toISOString(),timeZone:'UTC',locale:'en-GB'});
    // Email is the sole provider transport reached by invite creation. Capture
    // its payload locally; success here attests only the app's delivery branch.
    f.overrides.set('src/server/email',{
      inviteEmailHtml: input=>JSON.stringify(input),
      sendEmail:async input=>{sent.push(input);return {ok:true}},
    });
    process.env.SIGNAL_ACCESS_MODE='production';process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE='production';
    process.env.TASKS_DATABASE_URL=urls.app;process.env.TASKS_AUTH_TOKEN='synthetic-local-read-token';
    process.env.NOTES_DATABASE_URL=urls.notes;process.env.TIMELINE_DATABASE_URL=urls.timeline;process.env.SIGNAL_DATABASE_URL=urls.signal;
    process.env.TASKS_API_URL='https://fixture.invalid';process.env.NEXT_PUBLIC_SITE_URL='https://fixture.invalid';
    process.env.NOTES_TO_TASKS_SECRET='synthetic-golden-story-not-a-production-secret';
    process.env.SIGNAL_AUDIENCE_TIMELINE_ENABLED='true';
    process.env.SPONSOR_USAGE_EVENTS='1';process.env.SPONSOR_USAGE_HASH_SALT='synthetic-golden-story-salt';
    for(const key of ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','ENTITLEMENTS_DATABASE_URL','ENTITLEMENTS_AUTH_TOKEN','CLERK_SECRET_KEY','NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'])delete process.env[key];
    f.state.fetch=async(url,init)=>{
      const request=new Request(url,init), parsed=new URL(request.url);
      assert.equal(parsed.origin,'https://fixture.invalid');
      let response;
      if(parsed.pathname==='/api/internal/workspaces')response=await f.load('src/app/api/internal/workspaces/route').GET(request);
      else if(parsed.pathname==='/api/notes-extract/v2')response=await f.load('src/app/api/notes-extract/v2/route').POST(request);
      else throw Error('Unexpected local request '+parsed.pathname);
      requests.push({method:request.method,path:parsed.pathname,status:response.status});
      return response;
    };
    const noteActions=f.load('src/modules/notes/server/actions/notes');
    const actions=f.load('src/server/actions/tasks');
    const settings=f.load('src/server/actions/settings');
    const taskFocus=f.load('src/app/app/task/[id]/page').default;
    const myWork=f.load('src/app/app/my-tasks/page').default;
    const urlsModule=f.load('src/lib/product-urls');
    const scope=f.load('src/modules/notes/server/notes-recovery-actor').notesRecoveryActorScope;
    f.state.actor='creator';f.cookies('project-b');
    const privateBody='Private planning: budget EUR 12345 and private@example.test.\nConfirm the ceremony arrival time.';
    const approved='Confirm the ceremony arrival time';
    const note=await noteActions.createNoteIdempotent({id:'n_'+'1'.repeat(32),body:privateBody,workspaceId:'project-b',expectedActorScope:scope('creator')});
    assert.equal(note.body,privateBody);assert.equal(note.workspaceId,'project-b');
    const sendInput={noteId:note.id,sourceSelection:'Confirm the ceremony arrival time.',approvedBody:approved,workspaceId:'project-b',expectedUpdatedAt:note.updatedAt};
    const promoted=await noteActions.sendApprovedExtractToTasks(sendInput);
    assert.equal(promoted.status,'sent');
    const taskId=promoted.result.taskId;
    assert.equal(promoted.note.promotedTaskId,taskId);
    let task=(await sql('SELECT * FROM tasks WHERE id=?',[taskId]))[0];
    assert.equal(task.title,approved);assert.equal(task.workspace_id,'project-b');
    assert.equal(task.source_note_extract_body,approved);
    assert.equal((await notes.client.execute('SELECT body FROM notes')).rows[0].body,privateBody);
    assert.equal((await sql('SELECT count(*) n FROM tasks'))[0].n,1);
    const networkBeforeReplay=requests.length;
    const replay=await noteActions.sendApprovedExtractToTasks(sendInput);
    assert.equal(replay.result.taskId,taskId);assert.equal(requests.length,networkBeforeReplay);
    assert.equal((await sql('SELECT count(*) n FROM tasks'))[0].n,1);
    check('creator private capture → real signed catalog → exact approved extract POST → one persisted Tasks row; receipt replay makes no second send',{taskId,requests:requests.slice()});
    const noteLink=urlsModule.taskFocusPath(taskId);
    assert.equal(noteLink,`/app/task/${encodeURIComponent(taskId)}`);
    f.cookies('project-a');
    let canonical;
    await assert.rejects(taskFocus({params:Promise.resolve({id:taskId})}),error=>{canonical=error.href;return Boolean(canonical)});
    const target=new URL(canonical,'https://fixture.invalid');
    assert.equal(target.searchParams.get('workspaceId'),'project-b');assert.equal(target.searchParams.get('task'),taskId);
    check('actual Notes task-focus link resolves the stored B task despite A preference',{noteLink,canonical});

    // Deliberate creator task authorship and invite. The membership being
    // claimed next does not exist before the actual acceptance transaction.
    await settings.inviteMemberByEmailAction('recipient@example.test','member','project-b');
    assert.equal(sent.length,1);
    const pending=(await sql("SELECT token FROM pending_invites WHERE workspace_id='project-b'"))[0];
    assert.ok(pending?.token);
    assert.equal((await sql("SELECT * FROM workspace_members WHERE workspace_id='project-b' AND user_id='recipient'")).length,0);
    await actions.updateTaskAction(taskId,{assignees:['recipient']});
    await actions.addTaskAction({id:'creator-unselected',projectId:'project-b',title:'Private vendor budget discussion',assignees:['creator']});
    assert.equal((await sql('SELECT count(*) n FROM tasks'))[0].n,2);
    f.state.actor='recipient';f.cookies('project-a');
    const accepted=await settings.acceptInviteAction(pending.token);
    assert.equal(accepted.redirectTo,'/app/my-tasks?workspaceId=project-b');
    assert.equal((await sql("SELECT role FROM workspace_members WHERE workspace_id='project-b' AND user_id='recipient'"))[0].role,'member');
    assert.equal(f.state.cookies.get('signal_active_project'),'project-b');assert.equal(f.state.cookies.get('tasks_active_ws'),'project-b');
    assert.equal((await sql("SELECT count(*) n FROM workspace_events WHERE kind='inviteAccepted'"))[0].n,1);
    await assert.rejects(settings.acceptInviteAction(pending.token),/already been accepted/);
    check('actual invitation and acceptance commit one member/audit and canonical My work B, replacing both A preferences',{redirect:accepted.redirectTo,provider:'local email transport capture only'});

    f.cookies('project-a'); // Another tab changes the preference after acceptance.
    const page=await myWork({searchParams:Promise.resolve({workspaceId:'project-b'})});
    const myWorkElement=page.props.children[1];
    assert.equal(myWorkElement.props.canSetUpProject,false);
    await f.reload('project-b');
    const arrivalHtml=renderToStaticMarkup(myWorkElement);
    assert.ok(arrivalHtml.includes(approved));assert.match(arrivalHtml,/Without a date/);
    assert.doesNotMatch(arrivalHtml,/Private vendor budget discussion|starter pack|Add your first task/);
    fs.writeFileSync(path.join(output,'recipient-first-view.html'),arrivalHtml);
    const activityCount=(await sql("SELECT count(*) n FROM activities WHERE task_id=? AND workspace_id='project-b' AND kind='toggleComplete'",[taskId]))[0].n;
    await actions.toggleCompleteAction(taskId);
    const after=(await f.reload('project-b')).find(t=>t.id===taskId);
    assert.equal(after.lane,'done');assert.ok(after.completedAt);
    const completionActivity=await sql("SELECT user_id,payload FROM activities WHERE task_id=? AND workspace_id='project-b' AND kind='toggleComplete'",[taskId]);
    assert.equal(completionActivity.length,activityCount+1);
    assert.equal(completionActivity.at(-1).user_id,'recipient');
    assert.deepEqual(JSON.parse(completionActivity.at(-1).payload),{kind:'toggleComplete',to:'done'});
    const reloadedPage=await myWork({searchParams:Promise.resolve({workspaceId:'project-b'})});
    const doneHtml=renderToStaticMarkup(reloadedPage.props.children[1]);
    assert.match(doneHtml,/Done this week/);assert.ok(doneHtml.includes(approved));
    check('recipient actual My work shows undated assignment → real completion/action activity → fresh SQL and page reload retains done',{taskId,lane:after.lane});

    // Reopen and supply a real forthcoming date so Home has a genuine signal.
    await actions.toggleCompleteAction(taskId);
    const dueAt=new Date(Date.now()+2*86400000);
    await actions.updateTaskAction(taskId,{dueAt,due:'in two days'});
    await actions.setTaskMilestoneAction(taskId,true);
    assert.equal((await sql('SELECT is_milestone FROM tasks WHERE id=?',[taskId]))[0].is_milestone,1);
    const contextReader=f.load('src/modules/timeline/server/sync/tasks-workspace-context');
    const provision=f.load('src/modules/timeline/server/provision-workspace');
    const memberProof=await contextReader.getCurrentTasksWorkspaceContext('recipient','project-b');
    assert.equal(memberProof.kind,'member');
    const memberProvision=await provision.resolveCanonicalTimeline('recipient','project-b',memberProof.context);
    assert.equal(memberProvision.kind,'owner-reconciliation-required');
    assert.equal((await timeline.client.execute('SELECT count(*) n FROM workspaces')).rows[0].n,0);
    check('member may mark a Task milestone but cannot initialize the creator’s Timeline',{outcome:memberProvision.kind});

    f.state.actor='creator';
    await actions.setTaskMilestoneAction('creator-unselected',true);
    const creatorProof=await contextReader.getCurrentTasksWorkspaceContext('creator','project-b');
    assert.equal(creatorProof.kind,'member');
    const initialized=await provision.resolveCanonicalTimeline('creator','project-b',creatorProof.context);
    assert.equal(initialized.kind,'provisioned');
    const workspace=initialized.workspace;
    const timelineQueries=f.load('src/modules/timeline/server/db/timeline-queries');
    const projects=await timelineQueries.getProjectsForWorkspace(workspace.slug);
    assert.equal(projects.length,1);assert.equal(projects[0].sourceTasksWorkspaceId,'project-b');
    const sync=f.load('src/modules/timeline/server/actions/workspaces').syncMilestonesAction;
    const synced=await sync(workspace.slug,projects[0].slug);
    assert.equal(synced.ok,true);assert.equal(synced.complete,true);assert.equal(synced.count,2);
    const nodes=await timelineQueries.getEffectiveNodesForWorkspace(workspace.slug);
    assert.equal(nodes.length,2);
    const selected=nodes.find(n=>n.title===approved);assert.ok(selected);
    check('creator initializes exact B Timeline and actual authorized source/lease/transaction sync creates two milestones',{workspace:workspace.slug,project:projects[0].slug,selectedId:selected.id,synced});

    const audience=f.load('src/modules/timeline/server/actions/audience-timeline');
    const draft=await audience.createAudiencePublicationAction({status:'idle'},form({workspaceSlug:workspace.slug,projectSlug:projects[0].slug,audienceKind:'couple',label:'Arrival plan',ownerDisplayLabel:'Mara and Finn',timezone:'Europe/Dublin',sourceId:[selected.id]}));
    assert.equal(draft.status,'success',JSON.stringify(draft));
    const published=await audience.publishAudiencePublicationAction({status:'idle'},form({workspaceSlug:workspace.slug,publicationId:draft.publicationId}));
    assert.equal(published.status,'success',JSON.stringify(published));
    const token=new URL(published.shareUrl).pathname.split('/').pop();
    const resolver=f.load('src/modules/timeline/server/audience-timeline').resolveAudienceTimeline;
    f.state.actor='outsider';
    const publicView=await resolver(token);assert.equal(publicView.kind,'ok');
    const publicJson=JSON.stringify(publicView.dto);
    assert.ok(publicJson.includes(approved));
    for(const secret of [privateBody,'12345','private@example.test','Private vendor budget discussion',note.id,taskId,'sourceRelation','workspaceId','creator@example.test'])assert.ok(!publicJson.includes(secret),'redacted '+secret);
    fs.writeFileSync(path.join(output,'public-dto.json'),JSON.stringify(publicView.dto,null,2));
    f.state.actor='creator';await actions.updateTaskAction(taskId,{title:'Changed private working title'});
    assert.equal((await sync(workspace.slug,projects[0].slug)).ok,true);
    f.state.actor='outsider';assert.deepEqual((await resolver(token)).dto,publicView.dto);
    check('actual narrow publication freezes one selected milestone; outsider DTO excludes private note, omitted milestone and internal relations; later sync cannot change it');
    f.state.actor='creator';
    const revoked=await audience.revokeAudienceShareAction({status:'idle'},form({workspaceSlug:workspace.slug,publicationId:draft.publicationId}));
    assert.equal(revoked.status,'success');f.state.actor='outsider';
    assert.equal((await resolver(token)).kind,'revoked');
    check('actual creator revoke makes the outsider token unusable');

    f.state.actor='recipient';
    const home=f.load('src/app/app/home/home-data');
    const briefing=await home.loadHomeData({clerkId:'recipient',scope:{kind:'workspace',workspaceId:'project-b'}});
    const identity={clerkId:'recipient',email:null};
    const homeBoundary={legacy:await f.load('src/modules/signal/lib/data/source').dataSource.listForUser(identity),catalog:await f.load('src/modules/signal/lib/planning-periods/scope').listPlanningCatalogForUser(identity),briefing};
    fs.writeFileSync(path.join(output,'home-boundary.json'),JSON.stringify(homeBoundary,null,2));
    // Preserve the Home failure, but still exercise removal fences afterwards.
    // The final assertion is unconditional: later negatives cannot turn a
    // broken positive journey into a green run.
    if(briefing.kind==='ok') {
      const links=[...briefing.signalRows,...briefing.comingUp,...briefing.needsReview];
      const exact=links.find(row=>row.href===urlsModule.taskFocusPath(taskId));assert.ok(exact,JSON.stringify(briefing));
      assert.ok(JSON.stringify(briefing).includes('Changed private working title'));
      f.cookies('project-a');
      await assert.rejects(taskFocus({params:Promise.resolve({id:taskId})}),e=>{
        const url=new URL(e.href,'https://fixture.invalid');return url.searchParams.get('task')===taskId&&url.searchParams.get('workspaceId')==='project-b';
      });
      fs.writeFileSync(path.join(output,'home.json'),JSON.stringify(briefing,null,2));
      check('Home actual scope/catalog/SQLite source/ranking exposes the persisted task’s exact link, which reopens B with stale A',{href:exact.href});
    }
    await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='project-b' AND user_id='recipient'");
    const before=JSON.stringify(await sql('SELECT title,lane FROM tasks WHERE id=?',[taskId]));
    await actions.updateTaskAction(taskId,{title:'Must not persist'});
    assert.equal(JSON.stringify(await sql('SELECT title,lane FROM tasks WHERE id=?',[taskId])),before);
    const unavailable=await myWork({searchParams:Promise.resolve({workspaceId:'project-b'})});
    assert.match(renderToStaticMarkup(unavailable),/Project unavailable/);
    assert.equal((await home.loadHomeData({clerkId:'recipient',scope:{kind:'workspace',workspaceId:'project-b'}})).kind,'new-user');
    assert.equal((await sql('SELECT count(*) n FROM sponsored_use_intents'))[0].n,0);
    assert.equal((await sql('SELECT count(*) n FROM entitlements'))[0].n,0);
    check('membership removal denies fresh page, action and Home; no grant or sponsored intent is fabricated for this free collaborator story');
    assert.equal(briefing.kind,'ok','Home must retain the authorized project even without a planning period');
    return {checks,requests};
  } catch(error) {failure=error;throw error}
  finally {
    for(const file of ['experience/recipient-project-work/golden.cjs','experience/recipient-project-work/fixture.cjs','package.json','pnpm-lock.yaml'])f.sourceText(file);
    fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),checks,requests,failed:failure?String(failure):null,sourceInputs:f.sourceInputs,adapters:['App request identity/cookies/cache and UI contexts','Clerk request identity; email payload captured locally','configured DB handles replaced with fresh real SQLite; read clients constrained to exact fixture paths','local Request fetch dispatch to actual signed HTTP handlers'],limits:['No external provider/auth roundtrip','Actual source functions and SQLite, not a continuous full-Next browser session','No human comprehension or strategy-only collaborator roles claim','No sponsored grant in this story; owner-grant/member isolation remains the separately registered S5 regression'],stores:urls},null,2));
    for(const client of clients)client.close();f.close();
    for(const key of Object.keys(process.env))if(!(key in initialEnv))delete process.env[key];Object.assign(process.env,initialEnv);
  }
}
module.exports={runGoldenStory};
if(require.main===module)runGoldenStory().catch(error=>{console.error(error);process.exitCode=1});
