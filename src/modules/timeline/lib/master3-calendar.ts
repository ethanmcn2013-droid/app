import type { AudienceTimelineDto } from './audience-timeline';
export type Master3CalendarTimeline = AudienceTimelineDto;
export type Master3CalendarEvent = Readonly<{ uid:string; title:string; date:string; start?:Date; end?:Date; location?:string; description?:string; cancelled:boolean; publicId:string }>;
export type GuestCalendarLinks = Readonly<{icsHref:string;feedHref:string;googleHref?:string;copyText:string;label:string;fileName:string}>;
export type GuestTimelineServices = Readonly<{available:true;followAvailable:boolean;followStatus?:{state:'pending'|'confirmed'|'unsubscribed';emailHint:string};calendar:GuestCalendarLinks|null}>;
const validDate=(value:string)=>{try{return /^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}catch{return false;}};
const dateParts=(instant:Date,zone:string)=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
/** Reject nonexistent and ambiguous wall times rather than silently moving an event. */
export function master3WallTime(date:string,time:string,zone:string):Date {
 if(!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new TypeError('Invalid calendar date or time');
 new Intl.DateTimeFormat('en',{timeZone:zone}).format();
 const target=Date.parse(date+'T'+time+':00Z'),offsets=new Set<number>();
 for(let h=-36;h<=36;h+=6){const sample=new Date(target+h*3600000),p=dateParts(sample,zone);offsets.add(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-sample.getTime());}
 const expected=date+'T'+time;const matches=[...offsets].map(offset=>new Date(target-offset)).filter(d=>{const p=dateParts(d,zone);return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}T${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`===expected;});
 if(matches.length!==1)throw new TypeError('Calendar time is ambiguous or does not exist in this timezone');return matches[0];
}
export function buildMaster3CalendarEvents(dto:Master3CalendarTimeline):Master3CalendarEvent[]{
 const p=dto.presentation,items=dto.sections.flatMap(s=>s.items),final=items.find(i=>i.presentation?.final&&i.date&&validDate(i.date));
 const primary=!final&&dto.primaryDate&&validDate(dto.primaryDate.date)?dto.primaryDate:undefined;
 const anchor=final??(primary?{publicId:'__calendar_primary__',title:primary.label,date:primary.date,state:'next' as const,presentation:{final:true}}:undefined);
 const finalDate=anchor?.date,zone=p?.timezone;
 if(final?.presentation?.time&&!zone)throw new TypeError('A timezone is required for timed calendar events');
 const finalStart=final?.presentation?.time&&zone?master3WallTime(final.date!,final.presentation.time,zone):undefined;
 const candidates=p?.calAll?items:anchor?[anchor,...items.filter(item=>item!==anchor)].filter(item=>item===anchor||(item.date&&finalDate&&(item.date>finalDate||(item.date===finalDate&&item.presentation?.time&&finalStart&&zone&&master3WallTime(item.date,item.presentation.time,zone)>finalStart)))):[];
 return candidates.filter(i=>i.date&&validDate(i.date)&&i.date>=dto.today).map(item=>{
  const date=item.date!,time=item.presentation?.time,isFinal=item===anchor;
  if(time&&!zone)throw new TypeError('A timezone is required for timed calendar events');
  const start=time&&zone?master3WallTime(date,time,zone):undefined;
  const afterFinal=finalDate&&(date>finalDate||(start&&finalStart&&start>finalStart));
  const hours=isFinal?6:afterFinal?3:undefined;
  const end=start&&hours?new Date(Math.min(start.getTime()+hours*3600000,master3WallTime(date,'23:59',zone!).getTime())):undefined;
  const location=p?.locationConsent&&(dto.audienceKind!=='couple'||isFinal)?[p.place,p.address].filter(Boolean).join(', '):undefined;
  return {uid:`${encodeURIComponent(dto.publicationId)}.${encodeURIComponent(item.publicId)}@timeline.signalstudio.ie`,publicId:item.publicId,title:isFinal&&!primary&&p?.eventTitle?p.eventTitle:item.title,date,...(start?{start,...(end?{end}:{})}:{}),...(location?{location}:{}),...(item.presentation?.note?{description:item.presentation.note}:{}),cancelled:item.state==='cancelled'};
 });
}
export const escapeIcsText=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
/** RFC5545 folds by UTF8 octets, never splitting a Unicode code point. */
export function foldIcsLine(line:string):string{let out='',current='',bytes=0;for(const ch of line){const size=new TextEncoder().encode(ch).length;if(bytes+size>75){out+=current+'\r\n';current=' ';bytes=1;}current+=ch;bytes+=size;}return out+current;}
const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const day=(s:string)=>s.replace(/-/g,'');
export function renderMaster3Ics(dto:Master3CalendarTimeline,now=new Date()):string{
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Signal Studio//Timeline//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',`X-WR-CALNAME:${escapeIcsText(dto.label)}`];
 if(dto.presentation?.timezone)lines.push(`X-WR-TIMEZONE:${escapeIcsText(dto.presentation.timezone)}`);
 for(const e of buildMaster3CalendarEvents(dto)){lines.push('BEGIN:VEVENT',`UID:${e.uid}`,`DTSTAMP:${stamp(now)}`,`SUMMARY:${escapeIcsText(e.title)}`);if(e.start){lines.push(`DTSTART:${stamp(e.start)}`);if(e.end)lines.push(`DTEND:${stamp(e.end)}`);}else{lines.push(`DTSTART;VALUE=DATE:${day(e.date)}`,`DTEND;VALUE=DATE:${stamp(new Date(Date.parse(e.date+'T00:00:00Z')+86400000)).slice(0,8)}`);}if(e.description)lines.push('DESCRIPTION:'+escapeIcsText(e.description));if(e.location)lines.push(`LOCATION:${escapeIcsText(e.location)}`);lines.push(`STATUS:${e.cancelled?'CANCELLED':'CONFIRMED'}`,'END:VEVENT');}
 lines.push('END:VCALENDAR');return lines.map(foldIcsLine).join('\r\n')+'\r\n';
}
export function master3GoogleHref(e:Master3CalendarEvent):string{
 const q=new URLSearchParams({action:'TEMPLATE',text:e.title,dates:e.start?`${stamp(e.start)}/${stamp(e.end??e.start)}`:`${day(e.date)}/${stamp(new Date(Date.parse(e.date+'T00:00:00Z')+86400000)).slice(0,8)}`});if(e.location)q.set('location',e.location);if(e.description)q.set('details',e.description);return 'https://calendar.google.com/calendar/render?'+q;
}
export function master3CalendarLinks(dto:Master3CalendarTimeline,shareToken:string):GuestCalendarLinks|null{
 if(!/^[A-Za-z0-9_-]{43}$/.test(shareToken))return null;const events=buildMaster3CalendarEvents(dto).filter(e=>!e.cancelled);if(!events.length)return null;const selected=events.find(e=>dto.sections.some(s=>s.items.some(i=>i.publicId===e.publicId&&i.presentation?.final)))??events[0];const base='/api/timeline/share/'+encodeURIComponent(shareToken);return {icsHref:base+'/calendar.ics',feedHref:base+'/feed.ics',googleHref:master3GoogleHref(selected),copyText:`${selected.title} - ${selected.date}`,label:dto.label,fileName:'timeline.ics'};
}
