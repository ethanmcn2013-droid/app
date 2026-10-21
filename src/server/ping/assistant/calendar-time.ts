/** Calendar day and clock time are local to the Project, never implicitly UTC. */
export function assistantLocalDayTime(instant:Date,timeZone:string):{day:string;time:string}{
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);
  const value=(kind:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===kind)!.value;
  return {day:`${value('year')}-${value('month')}-${value('day')}`,time:`${value('hour')}:${value('minute')}`};
}
/** Reject nonexistent/ambiguous daylight-saving clock times rather than silently changing a request. */
export function instantFromAssistantDayTime(day:string,time:string,timeZone:string):Date{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('assistant_invalid_time');
  const wall=Date.parse(`${day}T${time}:00Z`);
  if(!Number.isFinite(wall)||new Date(wall).toISOString().slice(0,10)!==day)throw Error('assistant_invalid_time');
  const offsets=new Set<number>();
  // Probe both sides of a transition; current offsets are minute-granular in the supported calendar range.
  for(const delta of [-86400000,0,86400000]){
    const candidate=new Date(wall+delta),local=assistantLocalDayTime(candidate,timeZone);
    offsets.add(Date.parse(`${local.day}T${local.time}:00Z`)-candidate.getTime());
  }
  const matches=[...offsets].map(offset=>new Date(wall-offset)).filter(candidate=>{
    const local=assistantLocalDayTime(candidate,timeZone);return local.day===day&&local.time===time;
  });
  if(matches.length!==1)throw Error('assistant_ambiguous_time');
  return matches[0];
}
