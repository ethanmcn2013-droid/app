/* eslint-disable @typescript-eslint/no-require-imports -- Execute the real TS date helper through an esbuild bundle. */
// Tasks time facts: the one grammar every card, row, chip and header fact
// reads (src/components/tasks/time.ts). Behaviour, not markup: date-only due
// dates stay calendar dates, completion instants resolve in the project's
// timezone, and nothing reads the wall clock.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createRequire}=require('node:module');

const root=path.resolve(__dirname,'../..');
let model,scratch;
before(async()=>{
  scratch=await fs.mkdtemp(path.join(os.tmpdir(),'tasks-time-'));
  const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
  const outfile=path.join(scratch,'time.cjs');
  await esbuild.build({
    stdin:{contents:"export {timeOf,dayLabel,shortDate} from '@/components/tasks/time';export {PINNED_REVIEW_CALENDAR_FRAME} from '@/lib/calendar-frame';",loader:'ts',resolveDir:root},
    bundle:true,platform:'node',format:'cjs',outfile,absWorkingDir:root,alias:{'@':path.join(root,'src')},logLevel:'silent',
  });
  model=require(outfile);
});
after(async()=>{if(scratch)await fs.rm(scratch,{recursive:true,force:true});});
const task=(schedule,extra={})=>({schedule,completed:false,...extra});
const frame=(today,timeZone='UTC')=>({today,timeZone});

for(const [date,kind,label] of [
  ['2026-07-15','overdue','15 Jul, 1 day late'],
  ['2026-07-14','overdue','14 Jul, 2 days late'],
  ['2026-07-16','today','Today'],
  ['2026-07-17','tomorrow','Tomorrow'],
  ['2026-07-18','soon','Sat'],
  ['2026-07-22','soon','Wed'],
  ['2026-07-23','later','23 Jul'],
])test(`date-only due ${date} reads as ${label}`,()=>{
  const actual=model.timeOf(task({kind:'due',dueOn:date}),false,frame('2026-07-16','Pacific/Kiritimati'));
  assert.deepEqual([actual.kind,actual.label],[kind,label]);
  assert.ok(actual.said.length>0,'every fact carries a sentence for assistive tech');
});

test('ranges use their due day; milestones keep precedence even when behind',()=>{
  const calendar=frame('2026-07-16');
  assert.equal(model.timeOf(task({kind:'range',startOn:'2026-07-01',dueOn:'2026-07-17'}),false,calendar).label,'Tomorrow');
  for(const date of ['2026-07-15','2026-07-16','2026-07-17'])assert.equal(model.timeOf(task({kind:'milestone',on:date}),false,calendar).kind,'milestone');
});
test('unscheduled tasks and undated completion have no invented time fact',()=>{
  for(const value of [task({kind:'unscheduled'}),task({kind:'due',dueOn:'2026-07-01'},{completed:true})])assert.deepEqual(model.timeOf(value,false,frame('2026-07-16')),{kind:'none',label:'',said:'',delta:null});
});
test('completion and configured done columns outrank due dates and milestones',()=>{
  for(const [completed,columnDone] of [[true,false],[false,true]])for(const schedule of [{kind:'due',dueOn:'2026-07-01'},{kind:'milestone',on:'2026-07-30'}]){
    const actual=model.timeOf(task(schedule,{completed,completedAt:'2026-07-16T12:00:00Z'}),columnDone,frame('2026-07-16'));
    assert.equal(actual.kind,'done');
    assert.equal(actual.label,'Done today');
  }
});
for(const invalid of [undefined,'','not-a-timestamp','2026-99-99T00:00:00Z','2026-07-16T25:00:00Z'])test(`invalid/missing completion ${JSON.stringify(invalid)} withholds its fact`,()=>{
  assert.equal(model.timeOf(task({kind:'milestone',on:'2026-07-16'},{completed:true,completedAt:invalid}),false,frame('2026-07-16')).kind,'none');
});
for(const [timeZone,instant,today,label] of [
  ['Asia/Tokyo','2026-07-15T23:30:00Z','2026-07-16','Done today'],
  ['America/Los_Angeles','2026-07-16T02:00:00Z','2026-07-15','Done today'],
  ['Europe/Dublin','2026-07-15T22:30:00Z','2026-07-16','Done yesterday'],
  ['America/New_York','2026-11-01T01:30:00-04:00','2026-11-01','Done today'],
  ['America/New_York','2026-11-01T01:30:00-05:00','2026-11-01','Done today'],
])test(`completion instant resolves in ${timeZone}: ${instant}`,()=>{
  assert.equal(model.timeOf(task({kind:'unscheduled'},{completed:true,completedAt:instant}),false,frame(today,timeZone)).label,label);
});
for(const [today,date,zone] of [
  ['2026-03-08','2026-03-09','America/New_York'],
  ['2026-11-01','2026-11-02','America/New_York'],
  ['2026-12-31','2027-01-01','Pacific/Kiritimati'],
  ['2028-02-28','2028-02-29','Europe/Dublin'],
  ['2028-02-29','2028-03-01','Europe/Dublin'],
])test(`calendar-day arithmetic crosses ${today} without elapsed-hour drift`,()=>{
  assert.equal(model.timeOf(task({kind:'due',dueOn:date}),false,frame(today,zone)).label,'Tomorrow');
});
test('the real demo frame controls due labels without any live clock read',()=>{
  const NativeDate=globalThis.Date;
  globalThis.Date=class extends NativeDate {
    constructor(...args){assert.ok(args.length,'timeOf must not read the clock');super(...args);}
    static now(){throw Error('timeOf must not read Date.now');}
  };
  try {
    assert.equal(model.timeOf(task({kind:'due',dueOn:'2026-07-16'}),false,model.PINNED_REVIEW_CALENDAR_FRAME).label,'Today');
    assert.equal(model.timeOf(task({kind:'unscheduled'},{completed:true,completedAt:'2026-07-15T23:30:00Z'}),false,model.PINNED_REVIEW_CALENDAR_FRAME).label,'Done today');
  }finally{globalThis.Date=NativeDate;}
});
