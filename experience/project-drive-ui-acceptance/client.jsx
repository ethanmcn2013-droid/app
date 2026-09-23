import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectionsSection } from '@/components/app/settings/sections/connections';
import { StorageSection } from '@/components/app/settings/sections/storage';
import { ResourcesSection } from '@/components/app/detail-panel/resources-section';
import { CurrentUserProvider } from '@/lib/auth-context';
import { ToastRoot } from '@/components/primitives/toast';
import { ConnectionsReview } from '@/components/app/settings/sections/connections-review';
import { DriveUploadReview } from '@/components/app/detail-panel/drive-upload-review';

const query = new URLSearchParams(location.search);
const scenario = query.get('state') || 'connected';
const surface = query.get('surface') || 'connections';
const calls = [];
const copy = value => structuredClone(value);
const people = [
  { name: 'Orla Synthetic Owner', email: 'orla@example.test', access: 'owner' },
  { name: 'Maeve Synthetic Member', email: 'maeve@example.test', access: 'writer' },
];
const status = { ownerName: 'Orla Synthetic Owner', folderUrl: null, setup: 'active', pendingRemovals: { currentFolder: 0, previousFolders: 0 }, ownConnection: { connected: true, needsReconnect: false, accountEmail: 'orla@example.test', affectedProjectCount: 2 }, access: { state: 'checked', checkedAt: '2026-09-05T10:00:00.000Z', people, otherPermissionCount: 0 } };
if (['not-connected', 'connected-no-folder'].includes(scenario)) {
  status.ownerName = null; status.setup = 'not_connected'; status.access = { state: 'not_connected', checkedAt: null, people: [], otherPermissionCount: 0 };
  if (scenario === 'not-connected') status.ownConnection = { connected: false, needsReconnect: false, accountEmail: null, affectedProjectCount: 0 };
}
if (scenario === 'reauth') { status.ownConnection.needsReconnect = true; status.setup = 'needs_attention'; status.access = { state: 'unavailable', checkedAt: null, people: [], otherPermissionCount: 0 }; }
if (scenario === 'access-gap') { status.access.people[1].access = 'unconfirmed'; status.access.people.push({ name: 'Long synthetic member name for narrow layouts', email: 'a.long.changed.member.address@example.test', access: 'reader' }); status.access.otherPermissionCount = 1; status.setup = 'fallback'; }
if (scenario === 'setting-up') status.setup = 'setting_up';
if (scenario === 'archived') status.setup = 'archived';
const handover = { state: status.setup === 'not_connected' ? 'not_connected' : scenario === 'archived' ? 'archived' : 'ready', choices: [{ userId: 'target-maeve', name: 'Maeve Synthetic Owner' }], continuation: null };
if (scenario === 'no-owner-choice') handover.choices = [];
if (scenario === 'handover-pending') { handover.state = 'in_progress'; handover.choices = []; handover.continuation = { userId: 'target-maeve', name: 'Maeve Synthetic Owner' }; }
if (scenario === 'handover-attention') { handover.state = 'needs_attention'; handover.choices = []; }
if (scenario === 'upload-blocks-handover') { handover.state = 'uploads_pending'; handover.choices = []; }
const resource = { id: 'saved-claim', taskId: 'drive-task', kind: 'upload', provider: 'drive', title: 'Synthetic supplier brief.pdf', url: null, mimeType: 'application/pdf', sizeBytes: 1048576, addedByUserId: scenario === 'pending-other' ? 'maeve' : 'david', addedAt: 1788602400, accessState: 'pending', storage: 'google_drive' };
const pending = scenario.startsWith('pending-');
const fixture = window.__drive = {
  scenario, calls, status, handover, rows: pending ? [resource] : [], statusFailure: scenario === 'load-failed', listFailure: scenario === 'list-failed', nativeFailure: false,
  record(name, args) { calls.push({ name, args: copy(args) }); },
  releaseStatus: null, releaseList: null, releaseUpload: null, releaseFinalize: null, releaseRecovery: null,
  async readStatus(projectId) { this.record('status', [projectId]); if (scenario === 'loading' && !this.releaseStatus) await new Promise(resolve => { this.releaseStatus = resolve; }); if (this.statusFailure) throw Error('Synthetic status failure'); return { kind: 'ready', status: copy(this.status) }; },
  async readHandover(projectId) { this.record('handover-read', [projectId]); return { kind: 'ready', handover: copy(this.handover) }; },
  async disconnect(projectId) { this.record('disconnect', [projectId]); this.status.ownConnection = { connected: false, needsReconnect: false, accountEmail: null, affectedProjectCount: 0 }; this.status.setup = 'needs_attention'; this.status.access = { state: 'unavailable', checkedAt: null, people: [], otherPermissionCount: 0 }; return { disconnected: true, affectedProjectCount: 2, revocationConfirmed: scenario !== 'disconnect-pending' }; },
  async changeOwner(projectId, target) { this.record('handover', [projectId, target]); this.handover = { state: 'in_progress', choices: [], continuation: { userId: target, name: 'Maeve Synthetic Owner' } }; return 'in_progress'; },
  async list(taskId) { this.record('list', [taskId]); if (scenario === 'list-loading' && !this.releaseList) await new Promise(resolve => { this.releaseList = resolve; }); if (this.listFailure) throw Error('Synthetic list failure'); return copy(this.rows); },
  async create(taskId, input) { this.record('create', [taskId, input]); this.uploadId = input.resourceId; if (scenario === 'quota-full') return { kind: 'signal-native', reason: 'quota-full' }; if (scenario === 'fallback') return { kind: 'signal-native', reason: 'no-current-storage' }; if (scenario === 'create-lost') throw Error('Synthetic lost create reply'); if (this.completedUpload) return { kind: 'complete', resourceId: input.resourceId }; return { kind: 'session', sessionUrl: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=SYNTHETIC_NOT_A_CAPABILITY', startOffset: this.progress || 0 }; },
  async upload(options) { this.record('upload', [{ startOffset: options.startOffset, bytes: options.file.size }]); options.onProgress(Math.floor(options.file.size / 2)); this.progress = Math.floor(options.file.size / 2); return new Promise(resolve => { this.releaseUpload = () => resolve({ kind: 'complete', fileId: 'synthetic-file' }); options.signal.addEventListener('abort', () => resolve({ kind: 'paused' }), { once: true }); }); },
  async finalize(id, fileId) { this.record('finalize', [id, fileId]); if (scenario === 'confirming') await new Promise(resolve => { this.releaseFinalize = resolve; }); this.completedUpload = true; this.rows = [{ ...resource, id, accessState: 'ok', url: 'https://drive.google.com/file/d/synthetic-file/view' }]; return { resourceId: id }; },
  async recover(taskId, id) { this.record('recover', [taskId, id]); if (scenario === 'pending-checking') await new Promise(resolve => { this.releaseRecovery = resolve; }); if (scenario === 'pending-complete') { this.rows = [{ ...resource, accessState: 'ok', url: 'https://drive.google.com/file/d/synthetic-file/view' }]; return 'complete'; } return scenario === 'pending-unavailable' ? 'unavailable' : 'pending'; },
  async native(taskId) { this.record('native', [taskId]); if (this.nativeFailure) throw Error('Synthetic native quota refusal'); this.rows = [{ ...resource, id: 'res-native-fixture', provider: 'file', storage: 'signal', accessState: 'ok' }]; return { warnThresholds: [] }; },
};
window.__driveFlag = scenario === 'flag-off' ? 'false' : 'true';
// A local response is the only native transport used. No storage URL is minted.
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (url.pathname === '/api/attachments/upload') { fixture.record('native-permit', [JSON.parse(init.body)]); return new Response(JSON.stringify({ error: 'Synthetic local action fallback' }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
  if (url.origin !== location.origin) throw Error('External request denied by fixture');
  return realFetch(input, init);
};
const task = { id: 'drive-task', title: 'Synthetic Drive task', updatedAt: new Date('2026-09-05T10:00:00Z') };
const tier = scenario === 'paid-quota' ? 'event' : 'free';
const usage = scenario === 'quota-critical' ? 100 * 1024 * 1024 : scenario === 'quota-warning' ? 85 * 1024 * 1024 : 10 * 1024 * 1024;
createRoot(document.getElementById('root')).render(<CurrentUserProvider user="david"><ToastRoot><main style={{ maxWidth: surface === 'resources' ? 600 : 820, margin: '0 auto', padding: '24px 16px' }}><p style={{ fontSize: 12, marginBottom: 24 }}>Synthetic local fixture. Actual Drive UI and controllers; identity, action results and transfer ports are isolated adapters.</p>{surface === 'resources' ? <ResourcesSection task={task} /> : surface === 'review' ? <><ConnectionsReview /><DriveUploadReview /></> : <><ConnectionsSection projectId="drive-project" canManage={scenario !== 'member'} /><div style={{ marginTop: 40 }}><StorageSection tier={tier} usageBytes={usage} driveEnabled={scenario !== 'flag-off'} /></div></>}</main></ToastRoot></CurrentUserProvider>);
