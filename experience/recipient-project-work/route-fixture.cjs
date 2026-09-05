/* eslint-disable @typescript-eslint/no-require-imports -- Isolated request/RSC adapter, never imported by production. */
const { recipientFixture } = require('./fixture.cjs');

const routes = {
  '/app/tasks': 'src/app/app/tasks/page',
  '/app/my-tasks': 'src/app/app/my-tasks/page',
  '/app/archived': 'src/app/app/archived/page',
};

async function routeFixture() {
  const clientModules = new Set();
  const f = await recipientFixture({
    actualAuth: true,
    // No host environment, credential, shared database or provider configuration.
    process: { env: { NODE_ENV:'production', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'fixture-only', CLERK_SECRET_KEY:'fixture-only' } },
    clientReferences(file) {
      clientModules.add(file);
      return new Proxy({__esModule:true}, { get(target, name) {
        if (name === '__esModule') return true;
        return Object.assign(function ClientReference(){ throw Error('Client reference evaluated on server'); }, { fixtureClient: {file, name} });
      } });
    },
  });
  // Fixture prerequisites only: real account IDs, membership and task rows. No
  // route decision, capability, room brief, projection or component output seeded.
  await f.client.executeMultiple(`
    PRAGMA foreign_keys=OFF;
    UPDATE users SET id='user_' || id,clerk_id='user_' || id;
    UPDATE workspace_members SET user_id='user_' || user_id;
    UPDATE workspaces SET owner_user_id='user_' || owner_user_id;
    PRAGMA foreign_keys=ON;
    UPDATE users SET name='Alex Recipient' WHERE id='user_recipient';
    UPDATE users SET name='Blair Creator' WHERE id='user_creator';
    UPDATE workspaces SET name='Arrival project B', primary_date='2027-01-21',primary_date_label='B arrival' WHERE id='project-b';
    UPDATE workspaces SET name='Previous project A' WHERE id='project-a';
    INSERT INTO meta(key,value) VALUES ('room:project-a:purpose','ONLY A PURPOSE'),('room:project-b:purpose','Confirm B arrivals and share the final plan.');
    INSERT INTO meta(key,value) VALUES ('board:project-a:name','ONLY A BOARD'),('board:project-b:name','B arrival board');
    INSERT INTO tasks(id,workspace_id,title,lane,priority,assignees,due_at,archived_at) VALUES
      ('undated-b','project-b','Confirm the guest access list','todo','p2','["user_recipient"]',NULL,NULL),
      ('later-b','project-b','Check the final arrival plan','todo','p2','["user_recipient"]',unixepoch()+40*86400,NULL),
      ('soon-b','project-b','Confirm the arrival time','todo','p2','["user_recipient"]',unixepoch()+86400,NULL),
      ('unassigned-b','project-b','Prepare the shared checklist','todo','p2','[]',NULL,NULL),
      ('archive-b','project-b','Archived B arrival note','todo','p2','["user_recipient"]',NULL,1),
      ('archive-a','project-a','ONLY A ARCHIVED TASK','todo','p2','["user_recipient"]',NULL,1),
      ('private-c','project-c','PRIVATE C TASK','todo','p2','["user_outsider"]',NULL,1);
  `);
  f.state.actor='user_recipient';
  // Native local SQLite cannot wait asynchronously for a sibling immediate
  // transaction on this JS thread. Schedule real transactions serially; execute
  // every production provisioning statement. This is not a concurrency test.
  let transactionTail=Promise.resolve();
  const transaction=f.db.transaction.bind(f.db);
  f.db.transaction=(...args)=>{
    const result=transactionTail.then(()=>transaction(...args));
    transactionTail=result.catch(()=>{});
    return result;
  };
  f.boundary['@clerk/nextjs/server'] = {
    auth: async()=>({userId:f.state.actor}),
    currentUser: async()=> f.state.actor ? {id:f.state.actor,emailAddresses:[],firstName:null,lastName:null} : null,
  };
  f.boundary['@sentry/nextjs'] = {captureException(){},captureMessage(){}};
  f.boundary['next/headers'].headers=async()=>new Headers();
  const calls=[];
  async function serialize(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return null;
    if (typeof node==='string' || typeof node==='number') return node;
    if (node instanceof Date) return {$date:node.toISOString()};
    if (Array.isArray(node)) {const result=[];for(const child of node)result.push(await serialize(child));return result;}
    if (f.React.isValidElement(node)) {
      if (typeof node.type==='symbol') return serialize(node.props.children);
      if (node.type.fixtureClient) return {$component:node.type.fixtureClient, props:await serialize(node.props),key:node.key};
      if (typeof node.type==='function') {
        calls.push(node.type.name);
        return serialize(await node.type(node.props));
      }
      if(typeof node.type!=='string')throw Error('Unsupported server element '+String(node.type));
      return {$tag:node.type,props:await serialize(node.props),key:node.key};
    }
    if(typeof node==='object'){const result={};for(const [key,value] of Object.entries(node))result[key]=await serialize(value);return result;}
    throw Error('Nonserializable RSC prop: '+typeof node);
  }
  async function render(href) {
    calls.length=0;
    const url=new URL(href,'http://fixture.invalid'), focus=url.pathname.match(/^\/app\/task\/([^/]+)$/);
    const file=focus?'src/app/app/task/[id]/page':routes[url.pathname];
    if(!file)throw Error('Route outside bounded fixture: '+url.pathname);
    const sp={};for(const key of new Set(url.searchParams.keys())){const values=url.searchParams.getAll(key);sp[key]=values.length===1?values[0]:values;}
    try {
      const page=await f.load(file).default({searchParams:Promise.resolve(sp),params:Promise.resolve({id:focus?.[1]})});
      const {TasksRuntimeLayoutMount}=f.load('src/components/app/tasks-runtime-mount');
      const layout=f.load('src/app/app/layout').default;
      const tree=await serialize(layout({children:f.React.createElement(TasksRuntimeLayoutMount,null,page)}));
      return {tree,href:url.pathname+url.search,v3:f.state.v3,actor:f.state.actor,cookieWrites:[...f.state.cookieWrites],calls:[...calls]};
    } catch(error) { if(error.href)return {redirect:error.href};throw error; }
  }
  return {...f,render,clientModules,calls};
}
module.exports={routeFixture};
