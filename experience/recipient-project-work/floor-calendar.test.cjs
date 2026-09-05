/* eslint-disable @typescript-eslint/no-require-imports -- Execute the exported TSX date helper through the real component bundle. */
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
let model,scratch;
before(async()=>{
  scratch=await fs.mkdtemp(path.join(os.tmpdir(),'floor-calendar-'));
  model=(await (await import('./floor-calendar-browser.mjs')).buildFloorCalendarFixture(scratch)).model;
});
after(async()=>{if(scratch)await fs.rm(scratch,{recursive:true,force:true});});
const task=(schedule,extra={})=>({schedule,completed:false,...extra});
const frame=(today,timeZone='UTC')=>({today,timeZone});

for(const [date,kind,label,said] of [
  ['2026-07-15','overdue','15 Jul','1 day overdue, due 15 Jul'],
  ['2026-07-14','overdue','14 Jul','2 days overdue, due 14 Jul'],
  ['2026-07-16','today','Today','Due today'],
  ['2026-07-17','soon','Tomorrow','Due Tomorrow'],
  ['2026-07-18','soon','Sat','Due Sat'],
  ['2026-07-22','soon','Wed','Due Wed'],
  ['2026-07-23','soon','23 Jul','Due 23 Jul'],
])test(`date-only due ${date} retains the card grammar`,()=>{
  const actual=model.timeOf(task({kind:'due',dueOn:date}),false,frame('2026-07-16','Pacific/Kiritimati'));
  assert.deepEqual([actual.kind,actual.label,actual.said],[kind,label,said]);
});

test('ranges use their due day; milestones keep precedence even when behind',()=>{
  const calendar=frame('2026-07-16');
  assert.equal(model.timeOf(task({kind:'range',startOn:'2026-07-01',dueOn:'2026-07-17'}),false,calendar).label,'Tomorrow');
  for(const date of ['2026-07-15','2026-07-16','2026-07-17'])assert.equal(model.timeOf(task({kind:'milestone',on:date}),false,calendar).kind,'milestone');
});
test('unscheduled tasks and undated completion have no invented time fact',()=>{
  for(const value of [task({kind:'unscheduled'}),task({kind:'due',dueOn:'2026-07-01'},{completed:true})])assert.deepEqual(model.timeOf(value,false,frame('2026-07-16')),{kind:'none',label:'',said:'',spoken:''});
});
test('completion and configured done columns outrank due dates and milestones',()=>{
  for(const [completed,columnDone] of [[true,false],[false,true]])for(const schedule of [{kind:'due',dueOn:'2026-07-01'},{kind:'milestone',on:'2026-07-30'}]){
    const actual=model.timeOf(task(schedule,{completed,completedAt:'2026-07-16T12:00:00Z'}),columnDone,frame('2026-07-16'));
    assert.deepEqual(actual,{kind:'done',label:'Today',said:'Completed Today',spoken:'Completed '});
  }
});
for(const invalid of [undefined,'','not-a-timestamp','2026-99-99T00:00:00Z','2026-07-16T25:00:00Z'])test(`invalid/missing completion ${JSON.stringify(invalid)} withholds its fact`,()=>{
  assert.deepEqual(model.timeOf(task({kind:'milestone',on:'2026-07-16'},{completed:true,completedAt:invalid}),false,frame('2026-07-16')),{kind:'none',label:'',said:'',spoken:''});
});
for(const [timeZone,instant,today,label] of [
  ['Asia/Tokyo','2026-07-15T23:30:00Z','2026-07-16','Today'],
  ['America/Los_Angeles','2026-07-16T02:00:00Z','2026-07-15','Today'],
  ['Europe/Dublin','2026-07-15T22:30:00Z','2026-07-16','15 Jul'],
  ['America/New_York','2026-11-01T01:30:00-04:00','2026-11-01','Today'],
  ['America/New_York','2026-11-01T01:30:00-05:00','2026-11-01','Today'],
])test(`completion instant resolves in ${timeZone}: ${instant}`,()=>{
  assert.equal(model.timeOf(task({kind:'unscheduled'},{completed:true,completedAt:instant}),false,frame(today,timeZone)).label,label);
});
for(const [today,date,zone,label] of [
  ['2026-03-08','2026-03-09','America/New_York','Tomorrow'],
  ['2026-11-01','2026-11-02','America/New_York','Tomorrow'],
  ['2026-12-31','2027-01-01','Pacific/Kiritimati','Tomorrow'],
  ['2028-02-28','2028-02-29','Europe/Dublin','Tomorrow'],
  ['2028-02-29','2028-03-01','Europe/Dublin','Tomorrow'],
])test(`calendar-day arithmetic crosses ${today} without elapsed-hour drift`,()=>{
  assert.equal(model.timeOf(task({kind:'due',dueOn:date}),false,frame(today,zone)).label,label);
});
test('the real demo frame controls due labels without any live clock read',()=>{
  const NativeDate=globalThis.Date;
  globalThis.Date=class extends NativeDate {
    constructor(...args){assert.ok(args.length,'timeOf must not read the clock');super(...args);}
    static now(){throw Error('timeOf must not read Date.now');}
  };
  try {
    assert.equal(model.timeOf(task({kind:'due',dueOn:'2026-07-16'}),false,model.PINNED_REVIEW_CALENDAR_FRAME).label,'Today');
    assert.equal(model.timeOf(task({kind:'unscheduled'},{completed:true,completedAt:'2026-07-15T23:30:00Z'}),false,model.PINNED_REVIEW_CALENDAR_FRAME).label,'Today');
  }finally{globalThis.Date=NativeDate;}
});
