'use client';
import { useActionState } from 'react';
import { saveMaster3SettingsAction } from '../../server/actions/audience-timeline';
import type { Master3ProjectSettings } from '../../lib/master3-presentation';
import { fieldClass, quietButton } from './share-controls';
const labels: Record<string, string> = {
    eyebrow: 'Introduction', panelLabel: 'Main date label', unitNoun: 'Countdown phrase', progressNoun: 'Progress label', timezone: 'Time zone', place: 'Venue or place', address: 'Full address', eventTitle: 'Calendar event title', afterNote: 'Your note afterwards', onDayNote: 'Your note for the day', venueNote: 'Venue note', photosUrl: 'Photo album link', giftLead: 'Venue credit introduction', giftName: 'Venue credit name', giftUrl: 'Venue website', ref: 'Referral tag', subject: 'Confirmation email subject', pitch: 'Follow invitation', newsVerb: 'Update phrase', ownerVerb: 'Owner update phrase'
};
const textFields = [
    'eyebrow', 'panelLabel', 'unitNoun', 'progressNoun', 'timezone', 'place', 'address', 'eventTitle', 'afterNote', 'onDayNote', 'venueNote', 'photosUrl', 'giftLead', 'giftName', 'giftUrl', 'ref', 'subject', 'pitch', 'newsVerb', 'ownerVerb'
] as const;
export function Master3SettingsForm({ workspaceSlug, projectSlug, publicationId, settings, items }: {
    workspaceSlug: string;
    projectSlug?: string;
    publicationId?: string;
    settings?: Master3ProjectSettings;
    items: readonly {
        id: string;
        title: string;
    }[];
}) {
    const [state, action, pending] = useActionState(saveMaster3SettingsAction, {});
    const p = settings?.presentation;
    return <details id='timeline-presentation-settings'>
        <summary>Timeline details</summary>
 <p>Choose what appears on this timeline. Private task descriptions stay private. {publicationId ? 'Saving changes updates this shared page.' : 'Saving these details does not publish your timeline. New shared pages copy these details; existing shared pages keep their own settings.'}</p>
 <form action={action}>
 <input type='hidden' name='workspaceSlug' value={workspaceSlug}/>{projectSlug ? <input type='hidden' name='projectSlug' value={projectSlug}/> : null}{publicationId ? <input type='hidden' name='publicationId' value={publicationId}/> : null}
 <fieldset disabled={pending}>
        <legend>Presentation</legend>
 <label>Timeline type<select className={fieldClass} name='presentation.market' defaultValue={p?.market ?? ''}>
        <option value=''>Use the current timeline type</option>{[
        'wedding', 'event', 'launch', 'school'
    ].map(v => <option key={v} value={v}>{v}</option>)}</select>
        </label>
 <label>Count down to<select className={fieldClass} name='presentation.countTo' defaultValue={p?.countTo ?? ''}>
        <option value=''>Use the current countdown</option>
        <option value='final'>The final milestone</option>
        <option value='next'>The next date</option>
        </select>
        </label>
 {textFields.map(k => <label key={k}>{labels[k]}<input className={fieldClass} name={`presentation.${k}`} defaultValue={p?.[k] ?? ''} maxLength={[
        'afterNote', 'onDayNote', 'venueNote'
    ].includes(k) ? 1000 : k.endsWith('Url') ? 2048 : 240}/>
        </label>)}
 <label>
        <input type='checkbox' name='presentation.locationConsent' defaultChecked={p?.locationConsent ?? false}/> I want this venue and address to appear on the shared timeline</label>
 <label>
        <input type='checkbox' name='presentation.socialDetails' defaultChecked={p?.socialDetails ?? false}/> Include the timeline name, date and venue in link previews</label>
 {([
        [
            'calAll', 'Include every date in the calendar'
        ], [
            'afterFollow', 'Offer one photo update after the event'
        ], [
            'referral', 'Show the venue referral link'
        ]
    ] as const).map(([k, label]) => <label key={k}>
        <input type='checkbox' name={`presentation.${k}`} defaultChecked={p?.[k] ?? false}/>{label}</label>)}
 {([
        'after', 'during'
    ] as const).map(k => <fieldset key={k}>
        <legend>{k === 'after' ? 'After the final date' : 'While the event is under way'}</legend>{[
        'word', 'l1', 'l2'
    ].map((f, i) => <label key={f}>{[
        'Heading', 'First line', 'Second line'
    ][i]}<input className={fieldClass} name={`presentation.${k}.${f}`} defaultValue={p?.[k]?.[f as 'word' | 'l1' | 'l2'] ?? ''} maxLength={i === 0 ? 80 : 160}/>
        </label>)}{k === 'during' ? <label>Number of days<input className={fieldClass} name='presentation.during.days' type='number' min={1} max={366} defaultValue={p?.during?.days}/>
        </label> : null}</fieldset>)}
 <label>Next timeline label<input className={fieldClass} name='presentation.next.label' defaultValue={p?.next?.label ?? ''} maxLength={160}/>
        </label>
        <label>Next timeline link<input className={fieldClass} name='presentation.next.url' defaultValue={p?.next?.url ?? ''} maxLength={2048}/>
        </label>
 </fieldset>
 <details>
        <summary>Milestone details</summary>
        <p>These notes are shared with guests. You can set details for up to 100 milestones.</p>{items.map(item => { const v = settings?.items?.[item.id]; return <fieldset key={item.id} disabled={pending}>
        <legend>{item.title}</legend>{([
        'short', 'note', 'time', 'rsvpUrl'
    ] as const).map(k => <label key={k}>{{
        short: 'Short label', note: 'Guest note', time: 'Start time (24-hour)', rsvpUrl: 'RSVP link'
    }[k]}<input className={fieldClass} name={`item.${item.id}.${k}`} defaultValue={v?.[k] ?? ''} maxLength={k === 'rsvpUrl' ? 2048 : 240} type={k === 'time' ? 'time' : 'text'}/>
        </label>)}{([
        [
            'final', 'Final milestone'
        ], [
            'forYou', 'Guests need to act'
        ], [
            'key', 'Key date'
        ], [
            'shareCue', 'Remind me to share the link'
        ]
    ] as const).map(([k, label]) => <label key={k}>
        <input type='checkbox' name={`item.${item.id}.${k}`} defaultChecked={v?.[k] ?? false}/>{label}</label>)}</fieldset>; })}</details>
 <button className={quietButton} disabled={pending} type='submit'>{pending ? 'Saving…' : 'Save timeline details'}</button>
 {state.error ? <p role='alert'>{state.error}</p> : state.saved ? <p role='status'>Timeline details saved.</p> : null}
 </form>
        </details>;
}
