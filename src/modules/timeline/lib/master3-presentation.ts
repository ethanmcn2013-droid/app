/** Owner-entered public presentation only. Never populate from private task descriptions. */
export type Master3ItemPresentation = Readonly<{
  short?: string; final?: boolean; forYou?: boolean; key?: boolean; note?: string; shareCue?: boolean;
  time?: string; rsvpUrl?: string;
}>;
export type Master3Presentation = Readonly<{
  market?: 'wedding' | 'event' | 'launch' | 'school';
  countTo?: 'final' | 'next'; eyebrow?: string; panelLabel?: string; unitNoun?: string; progressNoun?: string;
  timezone?: string; place?: string; address?: string; locationConsent?: boolean; socialDetails?: boolean;
  eventTitle?: string; calAll?: boolean;
  after?: Readonly<{ word: string; l1?: string; l2?: string }>;
  during?: Readonly<{ days: number; word: string; l1?: string; l2?: string }>;
  afterNote?: string; onDayNote?: string; venueNote?: string;
  photosUrl?: string; afterFollow?: boolean;
  giftLead?: string; giftName?: string; giftUrl?: string; ref?: string; referral?: boolean;
  next?: Readonly<{ label: string; url: string }>;
  subject?: string; pitch?: string; newsVerb?: string; ownerVerb?: string;
}>;
/** Private settings key item presentation by effective node id; only values enter public DTO. */
export type Master3ProjectSettings = Readonly<{
  presentation?: Master3Presentation;
  items?: Readonly<Record<string, Master3ItemPresentation>>;
}>;
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const object = (v: unknown, keys: readonly string[], label: string) => {
  if (!record(v) || Object.keys(v).some(k => !keys.includes(k))) throw new TypeError(`${label} has unsupported fields`);
  return v;
};
const text = (v: unknown, max: number) => { if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) throw new TypeError('Invalid presentation text'); return v; };
const safeUrl = (v: unknown) => { const s=text(v,2048); const u=new URL(s); if(u.protocol!=='https:'||u.username||u.password)throw new TypeError('Presentation links require HTTPS');return s; };
const fields = (v: unknown, keys: readonly string[], strings: readonly string[], booleans: readonly string[], urls: readonly string[]) => {
 const input=object(v,keys,'presentation'),out:Record<string,unknown>={};
 for(const [k,value] of Object.entries(input)) { if(strings.includes(k))out[k]=text(value,['afterNote','onDayNote','venueNote'].includes(k)?1000:240);else if(booleans.includes(k)){if(typeof value!=='boolean')throw new TypeError('Invalid presentation flag');out[k]=value;}else if(urls.includes(k))out[k]=safeUrl(value); }
 return {input,out};
};
const ITEM_FIELDS=['short','final','forYou','key','note','shareCue','time','rsvpUrl'] as const;
export function validateMaster3ItemPresentation(value: unknown): Master3ItemPresentation {
 const {input,out}=fields(value,ITEM_FIELDS,['short','note','time'],['final','forYou','key','shareCue'],['rsvpUrl']);
 if(input.time!==undefined&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(input.time)))throw new TypeError('Invalid event time');
 return out as Master3ItemPresentation;
}
const PRESENTATION_FIELDS=['market','countTo','eyebrow','panelLabel','unitNoun','progressNoun','timezone','place','address','locationConsent','socialDetails','eventTitle','calAll','after','during','afterNote','onDayNote','venueNote','photosUrl','afterFollow','giftLead','giftName','giftUrl','ref','referral','next','subject','pitch','newsVerb','ownerVerb'] as const;
export function validateMaster3Presentation(value: unknown): Master3Presentation {
 const {input,out}=fields(value,PRESENTATION_FIELDS,['eyebrow','panelLabel','unitNoun','progressNoun','timezone','place','address','eventTitle','afterNote','onDayNote','venueNote','giftLead','giftName','ref','subject','pitch','newsVerb','ownerVerb'],['locationConsent','socialDetails','calAll','afterFollow','referral'],['photosUrl','giftUrl']);
 if(input.market!==undefined){if(!['wedding','event','launch','school'].includes(String(input.market)))throw new TypeError('Invalid market');out.market=input.market;}
 if(input.countTo!==undefined){if(!['final','next'].includes(String(input.countTo)))throw new TypeError('Invalid countdown');out.countTo=input.countTo;}
 if(input.timezone!==undefined)new Intl.DateTimeFormat('en',{timeZone:String(input.timezone)}).format();
 if((input.place||input.address)&&input.locationConsent!==true)throw new TypeError('Confirm that the location may be shared');
 for(const k of ['after','during'] as const)if(input[k]!==undefined){const v=object(input[k],k==='during'?['days','word','l1','l2']:['word','l1','l2'],k);const t:Record<string,unknown>={word:text(v.word,80)};for(const line of ['l1','l2'])if(v[line]!==undefined)t[line]=text(v[line],160);if(k==='during'){if(!Number.isInteger(v.days)||Number(v.days)<1||Number(v.days)>366)throw new TypeError('Invalid duration');t.days=v.days;}out[k]=t;}
 if(input.next!==undefined){const n=object(input.next,['label','url'],'next');out.next={label:text(n.label,160),url:safeUrl(n.url)};}
 return out as Master3Presentation;
}
export function validateMaster3ProjectSettings(value: unknown): Master3ProjectSettings {
 const v=object(value,['presentation','items'],'settings');const out:{presentation?:Master3Presentation;items?:Record<string,Master3ItemPresentation>}={};
 if(v.presentation!==undefined)out.presentation=validateMaster3Presentation(v.presentation);
 if(v.items!==undefined){if(!record(v.items)||Object.keys(v.items).length>100)throw new TypeError('Invalid item settings');out.items={};for(const [id,p]of Object.entries(v.items)){if(!/^[A-Za-z0-9_-]{1,160}$/.test(id)||['__proto__','constructor','prototype'].includes(id))throw new TypeError('Invalid item key');out.items[id]=validateMaster3ItemPresentation(p);}}
 return out;
}
