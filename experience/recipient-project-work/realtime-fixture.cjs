/* eslint-disable @typescript-eslint/no-require-imports -- Actual source under deterministic hook/effect and transport boundaries. */
const path=require('node:path'),{createRequire}=require('node:module'),{execFileSync}=require('node:child_process');
const {recipientFixture}=require('./fixture.cjs');
const dep=createRequire(path.resolve(__dirname,'../../package.json')),ts=dep('typescript');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}throw Error('Fixture condition did not settle');}

// A controlled React hook host, not a replacement implementation of the hook
// or reducer. Dependency changes run old cleanups before new effect setup.
function hookHost(React) {
  const slots=[],pending=[],transitions=[];let cursor=0,fn,props,output;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
  const memo=(make,deps)=>{const index=cursor++,old=slots[index];if(!old||!same(old.deps,deps))slots[index]={deps,value:make()};return slots[index].value;};
  const react={...React,
    useRef(value){const index=cursor++;return slots[index]??(slots[index]={current:value});},
    useMemo:memo,useCallback:(callback,deps)=>memo(()=>callback,deps),
    useEffect(effect,deps){const index=cursor++,old=slots[index];if(!old||!same(old.deps,deps)){pending.push({index,effect,old});slots[index]={deps};}},
    useReducer(reduce,initial){const index=cursor++;if(!slots[index])slots[index]={value:initial,dispatch:action=>{slots[index].value=reduce(slots[index].value,action);}};return [slots[index].value,slots[index].dispatch];},
    startTransition(callback){const promise=Promise.resolve(callback());transitions.push(promise);},
  };
  return {react,transitions,
    render(nextFn=fn,nextProps=props){fn=nextFn;props=nextProps;cursor=0;output=fn(props);const effects=pending.splice(0);for(const item of effects)item.old?.cleanup?.();for(const item of effects)slots[item.index].cleanup=item.effect();return output;},
    unmount(){for(const slot of slots)slot?.cleanup?.();},
  };
}

async function realtimeFixture() {
  const f=await recipientFixture(),streams=[],timers=new Map(),reads=[],changes=[],warnings=[];
  await f.client.executeMultiple("INSERT INTO tasks(id,workspace_id,title,lane,priority) VALUES ('a-live','project-a','Only A','todo','p2'),('b-live','project-b','Only B','todo','p2')");
  const host=hookHost(f.React);let timerId=0;
  const clock={setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},tick(){const callbacks=[...timers.values()];timers.clear();for(const callback of callbacks)callback();}};
  class Stream {
    static CLOSED=2;
    constructor(url){this.url=url;this.listeners=new Map();this.readyState=1;this.closed=false;streams.push(this);}
    addEventListener(name,callback){this.listeners.set(name,callback);}
    removeEventListener(name,callback){if(this.listeners.get(name)===callback)this.listeners.delete(name);}
    emit(name='tasks-changed'){this.listeners.get(name)?.({data:JSON.stringify({kind:'peer',clientId:'other',ts:1})});}
    close(){this.closed=true;this.readyState=2;}
  }
  function source(file){
    // Explicit immutable red control. Never alter a checkout or old receipt.
    if(process.env.RECIPIENT_REALTIME_BASELINE==='24417b35'&&['src/server/actions/tasks.ts','src/lib/tasks/use-realtime-sync.ts','src/lib/tasks/tasks-context.tsx'].includes(file))return execFileSync('git',['show','24417b35:'+file],{cwd:f.root,encoding:'utf8'});
    return f.sourceText(file);
  }
  function compile(file,overrides={},environment={}){
    const js=ts.transpileModule(source(file),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    const mod={exports:{}};
    const requireSource=spec=>{
      if(Object.hasOwn(overrides,spec))return overrides[spec];
      if(spec==='react')return host.react;
      if(Object.hasOwn(f.boundary,spec))return f.boundary[spec];
      if(spec.startsWith('@/'))return f.load('src/'+spec.slice(2));
      if(spec.startsWith('.'))return f.load(path.posix.normalize(path.posix.join(path.posix.dirname(file),spec)));
      return dep(spec);
    };
    new Function('require','module','exports','window','EventSource','setTimeout','clearTimeout','process','fetch','console',js)(requireSource,mod,mod.exports,{},Stream,clock.setTimeout,clock.clearTimeout,{env:{NODE_ENV:'production',...environment}},()=>{throw Error('Provider network forbidden');},{...console,warn:(...args)=>warnings.push(args)});
    return mod.exports;
  }
  const actions=compile('src/server/actions/tasks.ts');
  const facade={...actions,getTasksAction:async(...args)=>{
    reads.push(args);const result=await actions.getTasksAction(...args);
    if(f.afterRead)await f.afterRead(result,args);return result;
  }};
  const hook=compile('src/lib/tasks/use-realtime-sync.ts',{'@/server/actions/tasks':facade}).useRealtimeSync;
  const board=f.load('src/server/actions/board');
  const provider=compile('src/lib/tasks/tasks-context.tsx',{
    '@/server/actions/tasks':facade,'./use-realtime-sync':{useRealtimeSync:hook},
    '@/server/actions/board':{...board,moveTaskToColumnAction:async(...args)=>{const result=await board.moveTaskToColumnAction(...args);if(f.afterMove)await f.afterMove();return result;}},
    '@/lib/tasks/delight-events':{beginTaskSync:()=>()=>{}},
    '@/components/app/done-dopamine/first-completion-moment':{maybeFireFirstCompletion(){}},
  }).TasksProvider;
  const {tasksReducer,initialTasksState}=f.load('src/lib/tasks/tasks-reducer');
  let state=initialTasksState(await actions.getTasksAction('project-b'));
  const onChange=fresh=>{changes.push(fresh);state=tasksReducer(state,{type:'hydrate',tasks:fresh});};
  return {...f,host,clock,streams,timers,reads,changes,warnings,actions,facade,hook,provider,compile,board,onChange,
    set afterRead(callback){f.afterRead=callback;},
    set afterMove(callback){f.afterMove=callback;},
    get reducerState(){return state;},
    resetState(tasks){state=initialTasksState(tasks);},
    close(){host.unmount();f.close();},
  };
}
module.exports={realtimeFixture,deferred,until};
