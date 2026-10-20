import type { Master3ProjectSettings } from './master3-presentation';
import { validateMaster3ProjectSettings } from './master3-presentation';
export const MASTER3_TEXT_FIELDS = ['eyebrow', 'panelLabel', 'unitNoun', 'progressNoun', 'timezone', 'place', 'address', 'eventTitle', 'afterNote', 'onDayNote', 'venueNote', 'photosUrl', 'giftLead', 'giftName', 'giftUrl', 'ref', 'subject', 'pitch', 'newsVerb', 'ownerVerb'] as const;
export const MASTER3_FLAGS = ['locationConsent', 'socialDetails', 'calAll', 'afterFollow', 'referral'] as const;
export function master3SettingsFromForm(form: FormData, allowedItemIds: readonly string[]): Master3ProjectSettings {
    const presentation: Record<string, unknown> = {};
    for (const key of MASTER3_TEXT_FIELDS) {
        const v = form.get(`presentation.${key}`);
        if (typeof v === 'string' && v.trim())
            presentation[key] = v.trim();
    }
    for (const key of ['market', 'countTo']) {
        const v = form.get(`presentation.${key}`);
        if (typeof v === 'string' && v)
            presentation[key] = v;
    }
    for (const key of MASTER3_FLAGS)
        presentation[key] = form.get(`presentation.${key}`) === 'on';
    for (const key of ['after', 'during']) {
        const word = form.get(`presentation.${key}.word`);
        if (typeof word === 'string' && word.trim()) {
            const obj: Record<string, unknown> = { word: word.trim() };
            for (const line of ['l1', 'l2']) {
                const v = form.get(`presentation.${key}.${line}`);
                if (typeof v === 'string' && v.trim())
                    obj[line] = v.trim();
            }
            if (key === 'during')
                obj.days = Number(form.get('presentation.during.days'));
            presentation[key] = obj;
        }
    }
    const nextLabel = form.get('presentation.next.label'), nextUrl = form.get('presentation.next.url');
    if (nextLabel || nextUrl)
        presentation.next = { label: nextLabel, url: nextUrl };
    const items: Record<string, unknown> = {};
    const allowed = new Set(allowedItemIds);
    for (const key of form.keys())
        if (key.startsWith('item.')) {
            const id = key.slice(5, key.lastIndexOf('.'));
            if (!allowed.has(id))
                throw new TypeError('A milestone is outside this timeline');
        }
    for (const id of allowedItemIds) {
        const item: Record<string, unknown> = {};
        for (const k of ['short', 'note', 'time', 'rsvpUrl']) {
            const v = form.get(`item.${id}.${k}`);
            if (typeof v === 'string' && v.trim())
                item[k] = v.trim();
        }
        for (const k of ['final', 'forYou', 'key', 'shareCue'])
            if (form.get(`item.${id}.${k}`) === 'on')
                item[k] = true;
        if (Object.keys(item).length)
            items[id] = item;
    }
    return validateMaster3ProjectSettings({ presentation, items });
}
