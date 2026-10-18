import { createHash } from 'node:crypto';
import { opLog } from '@/server/operational-log';
import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from './db/timeline-client';
import { projects, tasks, nodeOverlays, workspaces, timelineProjectPresentation, timelinePublicationPresentation, timelinePublications, timelinePublicationItems } from './db/timeline-schema';
import { validateMaster3ProjectSettings, type Master3ProjectSettings } from '../lib/master3-presentation';
/** No new-column selects before the additive migration; old releases remain readable. */
export function createMaster3SettingsStore(database: typeof db) {
    async function available() {
        const rows = (await database.run(sql `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('timeline_project_presentation','timeline_publication_presentation')`)).rows;
        return rows.length === 2;
    }
    async function project(workspaceSlug: string, projectSlug: string): Promise<Master3ProjectSettings | undefined> {
        if (!await available())
            return undefined;
        const [row] = await database
            .select()
            .from(timelineProjectPresentation)
            .where(and(eq(timelineProjectPresentation.workspaceSlug, workspaceSlug), eq(timelineProjectPresentation.projectSlug, projectSlug)))
            .limit(1);
        return row ? validateMaster3ProjectSettings(row.settingsJson) : undefined;
    }
    async function publication(publicationId: string): Promise<Master3ProjectSettings | undefined> {
        if (!await available())
            return undefined;
        const [row] = await database
            .select()
            .from(timelinePublicationPresentation)
            .where(eq(timelinePublicationPresentation.publicationId, publicationId))
            .limit(1);
        return row ? validateMaster3ProjectSettings(row.settingsJson) : undefined;
    }
    async function owner(actorId: string, workspaceSlug: string) {
        const [row] = await database
            .select({
            id: workspaces.slug
        })
            .from(workspaces)
            .where(and(eq(workspaces.slug, workspaceSlug), eq(workspaces.ownerUserId, actorId)))
            .limit(1);
        if (!row)
            throw new TypeError('Timeline not found');
    }
    async function saveProject(actorId: string, workspaceSlug: string, projectSlug: string, value: unknown) {
        await owner(actorId, workspaceSlug);
        if (!await available())
            throw new TypeError('Timeline settings are not available yet');
        const [p] = await database
            .select({
            slug: projects.slug
        })
            .from(projects)
            .where(and(eq(projects.workspaceSlug, workspaceSlug), eq(projects.slug, projectSlug)))
            .limit(1);
        if (!p)
            throw new TypeError('Timeline not found');
        const settings = validateMaster3ProjectSettings(value), now = new Date();
        const [milestones, overlays, workspaceProjects] = await Promise.all([
            database
            .select({
                id: tasks.id
            })
            .from(tasks)
            .where(and(eq(tasks.workspaceSlug, workspaceSlug), eq(tasks.projectSlug, projectSlug), eq(tasks.kind, 'milestone'))),
            database
            .select({
                id: nodeOverlays.nodeId, hidden: nodeOverlays.hidden, source: nodeOverlays.source
            })
            .from(nodeOverlays)
            .where(eq(nodeOverlays.workspaceSlug, workspaceSlug)),
            database
            .select({
                slug: projects.slug
            })
            .from(projects)
            .where(eq(projects.workspaceSlug, workspaceSlug))
            .orderBy(asc(projects.sortOrder)),
        ]);
        const hidden = new Set(overlays.filter(item => item.hidden).map(item => item.id));
        const allowed = new Set(milestones.filter(item => !hidden.has(item.id)).map(item => item.id));
        const fallback = workspaceProjects[0]?.slug ?? workspaceSlug;
        for (const item of overlays) {
            if (item.source !== 'manual' || item.hidden)
                continue;
            let slug = fallback;
            if (item.id.startsWith('manual:'))
                try {
                    slug = decodeURIComponent(item.id.slice(7).split(':', 1)[0]) || fallback;
                }
                catch { /* Existing effective-node fallback semantics. */ }
            if (slug === projectSlug)
                allowed.add(item.id);
        }
        if (Object.keys(settings.items ?? {}).some(id => !allowed.has(id)))
            throw new TypeError('A milestone is outside this timeline');
        await database.transaction(async (tx) => {
            const [current] = await tx
            .select({
                id: workspaces.slug
            })
            .from(workspaces)
            .where(and(eq(workspaces.slug, workspaceSlug), eq(workspaces.ownerUserId, actorId)))
            .limit(1);
            if (!current)
                throw new TypeError('Timeline not found');
            await tx.insert(timelineProjectPresentation)
            .values({
                workspaceSlug, projectSlug, settingsJson: settings, updatedAt: now
            })
            .onConflictDoUpdate({
                target: [
                    timelineProjectPresentation.workspaceSlug, timelineProjectPresentation.projectSlug
                ], set: {
                    settingsJson: settings, updatedAt: now
                }
            });
        }, {
            behavior: 'immediate'
        });
    }
    async function savePublication(actorId: string, workspaceSlug: string, publicationId: string, value: unknown) {
        await owner(actorId, workspaceSlug);
        if (!await available())
            throw new TypeError('Timeline settings are not available yet');
        const [p] = await database
            .select({
            id: timelinePublications.id
        })
            .from(timelinePublications)
            .where(and(eq(timelinePublications.workspaceSlug, workspaceSlug), eq(timelinePublications.id, publicationId)))
            .limit(1);
        if (!p)
            throw new TypeError('Timeline not found');
        const settings = validateMaster3ProjectSettings(value);
        const previous=await publication(publicationId);
        const ids = new Set((await database
            .select({
            id: timelinePublicationItems.publicId
        })
            .from(timelinePublicationItems)
            .where(eq(timelinePublicationItems.publicationId, publicationId))).map(x => x.id));
        if (Object.keys(settings.items ?? {}).some(id => !ids.has(id)))
            throw new TypeError('A milestone is outside this publication');
        const now = new Date();
        await database.transaction(async (tx) => {
            const [current] = await tx
            .select({
                id: workspaces.slug
            })
            .from(workspaces)
            .where(and(eq(workspaces.slug, workspaceSlug), eq(workspaces.ownerUserId, actorId)))
            .limit(1);
            if (!current)
                throw new TypeError('Timeline not found');
            await tx.insert(timelinePublicationPresentation)
            .values({
                publicationId, settingsJson: settings, updatedAt: now
            })
            .onConflictDoUpdate({
                target: timelinePublicationPresentation.publicationId, set: {
                    settingsJson: settings, updatedAt: now
                }
            });
            await tx.update(timelinePublications)
            .set({
                updatedAt: now, lastUpdatedAt: now, ...(settings.presentation?.timezone ? {
                    timezone: settings.presentation.timezone
                } : {})
            })
            .where(eq(timelinePublications.id, publicationId));
        });
        if(JSON.stringify(previous??{})!==JSON.stringify(settings)){
            const kind=settings.presentation?.photosUrl && previous?.presentation?.photosUrl!==settings.presentation.photosUrl?'photos':'update';
            const eventKey=createHash('sha256').update(JSON.stringify([settings,Math.floor(now.getTime()/1000)])).digest('hex');
            await queueMaster3PublishedUpdate(database,{publicationId,kind,eventKey,now});
        }
    }
    async function projectUpdatedAt(workspaceSlug: string, projectSlug: string) {
        if (!await available())
            return undefined;
        const [row] = await database
            .select({
            updatedAt: timelineProjectPresentation.updatedAt
        })
            .from(timelineProjectPresentation)
            .where(and(eq(timelineProjectPresentation.workspaceSlug, workspaceSlug), eq(timelineProjectPresentation.projectSlug, projectSlug)))
            .limit(1);
        return row?.updatedAt;
    }
    return {
        available, project, projectUpdatedAt, publication, saveProject, savePublication
    };
}
export const master3Settings = createMaster3SettingsStore(db);
/** Server-only schema readiness shared with guest capability composition. */
export async function master3SchemaAvailable(): Promise<boolean> {
    const result = await db.run(sql `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('timeline_project_presentation','timeline_publication_presentation','timeline_guest_subscriptions','timeline_guest_deliveries')`);
    return result.rows.length === 4;
}

/** Enqueue after the primary write committed. No external transport runs here. */
export async function queueMaster3PublishedUpdate(
    database: typeof db,
    input: {
        publicationId: string;
        kind: 'update' | 'date_change' | 'photos';
        eventKey: string;
        now?: Date;
    },
): Promise<boolean> {
    try {
        const tables = await database.run(sql`
            SELECT name FROM sqlite_master
            WHERE type='table'
            AND name IN ('timeline_guest_subscriptions','timeline_guest_deliveries')
        `);
        if (tables.rows.length !== 2) return false;
        const { enqueuePublishedGuestUpdate } = await import('./guest-notifications');
        await database.transaction(
            tx => enqueuePublishedGuestUpdate(tx, input),
            { behavior: 'immediate' },
        );
        return true;
    } catch {
        try {
            opLog('warn', 'timeline-guest-update', 'notification_queue_unavailable');
        } catch {
            // Diagnostics cannot alter a successful primary save.
        }
        return false;
    }
}
