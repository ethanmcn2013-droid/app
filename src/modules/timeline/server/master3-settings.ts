import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db/timeline-client';
import { projects, workspaces, timelineProjectPresentation, timelinePublicationPresentation, timelinePublications, timelinePublicationItems } from './db/timeline-schema';
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
        const [row] = await database.select().from(timelineProjectPresentation).where(and(eq(timelineProjectPresentation.workspaceSlug, workspaceSlug), eq(timelineProjectPresentation.projectSlug, projectSlug))).limit(1);
        return row ? validateMaster3ProjectSettings(row.settingsJson) : undefined;
    }
    async function publication(publicationId: string): Promise<Master3ProjectSettings | undefined> {
        if (!await available())
            return undefined;
        const [row] = await database.select().from(timelinePublicationPresentation).where(eq(timelinePublicationPresentation.publicationId, publicationId)).limit(1);
        return row ? validateMaster3ProjectSettings(row.settingsJson) : undefined;
    }
    async function owner(actorId: string, workspaceSlug: string) { const [row] = await database.select({ id: workspaces.slug }).from(workspaces).where(and(eq(workspaces.slug, workspaceSlug), eq(workspaces.ownerUserId, actorId))).limit(1); if (!row)
        throw new TypeError('Timeline not found'); }
    async function saveProject(actorId: string, workspaceSlug: string, projectSlug: string, value: unknown) {
        await owner(actorId, workspaceSlug);
        if (!await available())
            throw new TypeError('Timeline settings are not available yet');
        const [p] = await database.select({ slug: projects.slug }).from(projects).where(and(eq(projects.workspaceSlug, workspaceSlug), eq(projects.slug, projectSlug))).limit(1);
        if (!p)
            throw new TypeError('Timeline not found');
        const settings = validateMaster3ProjectSettings(value), now = new Date();
        await database.insert(timelineProjectPresentation).values({ workspaceSlug, projectSlug, settingsJson: settings, updatedAt: now }).onConflictDoUpdate({ target: [timelineProjectPresentation.workspaceSlug, timelineProjectPresentation.projectSlug], set: { settingsJson: settings, updatedAt: now } });
    }
    async function savePublication(actorId: string, workspaceSlug: string, publicationId: string, value: unknown) {
        await owner(actorId, workspaceSlug);
        if (!await available())
            throw new TypeError('Timeline settings are not available yet');
        const [p] = await database.select({ id: timelinePublications.id }).from(timelinePublications).where(and(eq(timelinePublications.workspaceSlug, workspaceSlug), eq(timelinePublications.id, publicationId))).limit(1);
        if (!p)
            throw new TypeError('Timeline not found');
        const settings = validateMaster3ProjectSettings(value);
        const ids = new Set((await database.select({ id: timelinePublicationItems.publicId }).from(timelinePublicationItems).where(eq(timelinePublicationItems.publicationId, publicationId))).map(x => x.id));
        if (Object.keys(settings.items ?? {}).some(id => !ids.has(id)))
            throw new TypeError('A milestone is outside this publication');
        const now = new Date();
        await database.transaction(async (tx) => {
            await tx.insert(timelinePublicationPresentation).values({ publicationId, settingsJson: settings, updatedAt: now }).onConflictDoUpdate({ target: timelinePublicationPresentation.publicationId, set: { settingsJson: settings, updatedAt: now } });
            await tx.update(timelinePublications).set({ updatedAt: now, lastUpdatedAt: now }).where(eq(timelinePublications.id, publicationId));
        });
    }
    return { available, project, publication, saveProject, savePublication };
}
export const master3Settings = createMaster3SettingsStore(db);
/** Server-only schema readiness shared with guest capability composition. */
export async function master3SchemaAvailable():Promise<boolean>{ return master3Settings.available(); }
