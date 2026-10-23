// Offline Notes backup custody. Source dumps must be supplied separately via
// the approved read-only backup engine; this wrapper has no connection options.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { makeBackupBundle, encryptBackup, requireEncryptionPreflight, requireCipherArtifactContents } from './production-backup-custody.mjs';
import { restoreInto, measure, compare, compareDdl } from './restore-verify.mjs';
import { sha256 } from './backup.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHA = /^[a-f0-9]{64}$/;
const SOURCE = /^[a-f0-9]{40}$/;
const IDENTITY = /^[a-f0-9]{16}$/;
const REQUIRED_TABLES = ['calendar_connections','note_task_send_outbox','notes','spawned_calendar_events','user_preferences'];
const need = (value, code) => { if (!value) throw Object.assign(new Error(code), { code }); };
const localPath = value => typeof value === 'string' && value.length > 0 && !/^(\\\\|\/\/)/.test(value) &&
  (!/^[a-z][a-z0-9+.-]*:\//i.test(value) || /^[a-z]:[\\/]/i.test(value));
const fileSha = file => { need(localPath(file) && fs.lstatSync(file).isFile(), 'LOCAL_FILE_REQUIRED'); return sha256(fs.readFileSync(file)); };
const within = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });

export function requireNotesBackup(backup, expected) {
  need(SHA.test(expected.backupSha256 ?? '') && IDENTITY.test(expected.databaseIdentity ?? ''), 'TRUSTED_NOTES_BINDING_REQUIRED');
  makeBackupBundle(backup); // Approved body checksum and complete bundle validator.
  need(backup.manifest.schemaVersion === 'signal-db-backup/1' && backup.manifest.backupSha256 === expected.backupSha256 &&
    backup.manifest.databaseIdentity === expected.databaseIdentity, 'NOTES_BACKUP_BINDING_MISMATCH');
  const tables = backup.manifest.tables.map(table => table.name).sort();
  // Fail closed on another module, an incomplete dump, or unexpected schema.
  // Unknown live Notes tables require explicit reviewed support, not omission.
  need(JSON.stringify(tables) === JSON.stringify(REQUIRED_TABLES) && backup.manifest.tableCount === REQUIRED_TABLES.length &&
    JSON.stringify([...backup.manifest.ddl.tables].sort()) === JSON.stringify(REQUIRED_TABLES), 'NOTES_SCHEMA_NOT_SUPPORTED');
  const noteColumns = backup.manifest.tables.find(table => table.name === 'notes').columns;
  need(['id','user_id','body','created_at','updated_at','archived_at','promoted_task_id','workspace_id'].every(column => noteColumns.includes(column)), 'NOTES_COLUMNS_MISSING');
  const entries = backup.body.trim().split('\n').map(line => JSON.parse(line));
  const metadata = entries.filter(entry => entry.kind === 'meta');
  need(metadata.length === 1 && metadata[0].schemaVersion === 'signal-db-backup/1' &&
    JSON.stringify([...metadata[0].tables].sort()) === JSON.stringify(REQUIRED_TABLES), 'NOTES_BODY_SCHEMA_MISMATCH');
  need(entries.every(entry => ['meta','row','ddl'].includes(entry.kind)) && entries.filter(entry => entry.kind === 'row').every(entry => REQUIRED_TABLES.includes(entry.table)), 'NOTES_BODY_SCHEMA_MISMATCH');
  return { ...makeBackupBundle(backup), schema: 'notes-encrypted-backup-bundle/1' };
}

export function requireNotesPrivatePath(value) {
  need(localPath(value) && path.isAbsolute(value), 'PRIVATE_OUTPUT_REQUIRED');
  const target = path.resolve(value);
  need(!within(root, target) && !within(target, root) && !fs.existsSync(target), 'PRIVATE_OUTPUT_REQUIRED');
  need(fs.statSync(path.dirname(target)).isDirectory(), 'PRIVATE_PARENT_REQUIRED');
  return target;
}

function sourceRevision(expected) {
  need(SOURCE.test(expected ?? ''), 'SOURCE_REVISION_REQUIRED');
  const actual = execFileSync('git', ['-C',root,'rev-parse','HEAD'], { encoding: 'utf8' }).trim();
  need(actual === expected, 'SOURCE_REVISION_MISMATCH');
  need(execFileSync('git',['-C',root,'status','--porcelain'],{ encoding:'utf8' }).trim() === '', 'CLEAN_SOURCE_REQUIRED');
  return actual;
}

function verifyAge(binary, expectedSha256, spawn) {
  need(path.isAbsolute(binary ?? '') && SHA.test(expectedSha256 ?? '') && fs.statSync(binary).isFile(), 'AGE_BINARY_REQUIRED');
  need(fileSha(binary) === expectedSha256, 'AGE_BINARY_CHECKSUM_MISMATCH');
  const probe = spawn(binary, ['--version'], { stdio: 'ignore' });
  need(!probe.error && probe.status === 0, 'AGE_BINARY_INVALID');
}

export async function verifyNotesRestore(backup, target) {
  need(localPath(target) && path.isAbsolute(target) && !within(root,path.resolve(target)), 'PRIVATE_OUTPUT_REQUIRED');
  need(!fs.existsSync(target), 'RESTORE_TARGET_EXISTS');
  const { client } = await restoreInto(pathToFileURL(path.resolve(target)).href, backup.body);
  try {
    need(compare(backup.manifest, await measure(client, REQUIRED_TABLES)).ok, 'RESTORE_ROWS_MISMATCH');
    need((await compareDdl(client, backup.manifest)).ok, 'RESTORE_DDL_MISMATCH');
    need((await client.execute('PRAGMA integrity_check')).rows[0]?.integrity_check === 'ok', 'RESTORE_INTEGRITY_FAILED');
    need((await client.execute('PRAGMA foreign_key_check')).rows.length === 0, 'RESTORE_FOREIGN_KEYS_FAILED');
    return { rows: 'verified', ddl: 'verified', integrity: 'ok', foreignKeys: 'ok' };
  } finally { client.close(); }
}

/** No DB credentials, network target, mutation, migration or archive parameter. */
export async function prepareNotesBackup(options, spawn = spawnSync) {
  const source = sourceRevision(options.sourceRevision);
  need(localPath(options.backup) && localPath(options.manifest) && !within(root,path.resolve(options.backup)) && !within(root,path.resolve(options.manifest)), 'PRIVATE_INPUT_REQUIRED');
  need(SHA.test(options.manifestSha256 ?? '') && fileSha(options.manifest) === options.manifestSha256, 'MANIFEST_CHECKSUM_MISMATCH');
  need(fileSha(options.backup) === options.backupSha256, 'BACKUP_CHECKSUM_MISMATCH');
  const backup = { body: fs.readFileSync(options.backup,'utf8'), manifest: JSON.parse(fs.readFileSync(options.manifest,'utf8')) };
  const bundle = requireNotesBackup(backup, options);
  verifyAge(options.ageBinary, options.ageSha256, spawn);
  requireEncryptionPreflight(options.recipient, options.ageBinary, spawn);
  const privateDir = requireNotesPrivatePath(options.privateDir);
  const cipherDir = requireNotesPrivatePath(options.cipherDir);
  need(!within(privateDir,cipherDir) && !within(cipherDir,privateDir), 'OUTPUT_PATHS_OVERLAP');
  fs.mkdirSync(privateDir,{ mode: 0o700 });
  fs.mkdirSync(cipherDir,{ mode: 0o700 });
  const restored = path.join(privateDir,'restored.db');
  const restore = await verifyNotesRestore(backup, restored);
  const bundlePath = path.join(privateDir,'backup.bundle.json');
  write(bundlePath,bundle);
  // Recheck executable bytes immediately before invoking the approved cipher engine.
  verifyAge(options.ageBinary,options.ageSha256,spawn);
  const cipherSha256 = encryptBackup(bundlePath,path.join(cipherDir,'backup.age'),options.recipient,options.ageBinary,spawn);
  const receipt = { schema: 'notes-encrypted-backup-receipt/1', sourceRevision: source,
    databaseIdentity: backup.manifest.databaseIdentity, manifestSha256: options.manifestSha256,
    manifestCanonicalSha256: sha256(JSON.stringify(backup.manifest)), sourceConsistency: 'unverified-supplied-dump',
    backupSha256: backup.manifest.backupSha256, cipherSha256,
    recipientSha256: sha256(options.recipient), ageBinarySha256: options.ageSha256,
    restore, artifactUpload: 'not-performed', productionMutation: 'none',
    limitations: ['Supplied source snapshot; no live source identity or freshness observation.', 'Independent ciphertext/decryption custody and a fresh quiescent cutover snapshot are still required.'] };
  write(path.join(cipherDir,'receipt.json'),receipt);
  requireCipherArtifactContents(cipherDir);
  // This path was explicitly named, newly created by this call and checked
  // outside the repository. Recheck its resolved identity before recursive cleanup.
  need(fs.realpathSync(privateDir) === privateDir, 'PRIVATE_PATH_CHANGED');
  fs.rmSync(privateDir,{ recursive: true, force: false });
  return receipt;
}

export async function recoverNotesBackup(options, spawn = spawnSync) {
  sourceRevision(options.sourceRevision);
  need(SHA.test(options.cipherSha256 ?? '') && fileSha(options.cipher) === options.cipherSha256, 'CIPHER_CHECKSUM_MISMATCH');
  need(SHA.test(options.backupSha256 ?? '') && SHA.test(options.manifestSha256 ?? '') && SHA.test(options.manifestSha256Canonical ?? '') && IDENTITY.test(options.databaseIdentity ?? ''), 'TRUSTED_NOTES_BINDING_REQUIRED');
  verifyAge(options.ageBinary,options.ageSha256,spawn);
  need(localPath(options.identity) && !within(root,path.resolve(options.identity)) && fs.lstatSync(options.identity).isFile(), 'RECOVERY_IDENTITY_REQUIRED');
  const output = requireNotesPrivatePath(options.privateDir);
  fs.mkdirSync(output,{ mode: 0o700 });
  const bundlePath = path.join(output,'backup.bundle.json');
  const result = spawn(options.ageBinary,['-d','-i',options.identity,'-o',bundlePath,options.cipher],{ stdio: 'ignore' });
  need(!result.error && result.status === 0, 'DECRYPTION_FAILED');
  const bundle = JSON.parse(fs.readFileSync(bundlePath,'utf8'));
  need(bundle.schema === 'notes-encrypted-backup-bundle/1', 'NOTES_BUNDLE_REQUIRED');
  requireNotesBackup(bundle,options);
  need(sha256(JSON.stringify(bundle.manifest)) === options.manifestSha256Canonical, 'RECOVERED_MANIFEST_CHECKSUM_MISMATCH');
  const restore = await verifyNotesRestore(bundle,path.join(output,'restored.db'));
  fs.writeFileSync(path.join(output,'backup.jsonl'),bundle.body,{ flag: 'wx', mode: 0o600 });
  write(path.join(output,'backup.manifest.json'),bundle.manifest);
  return { schema: 'notes-recovery-verification/1', backupSha256: options.backupSha256, cipherSha256: options.cipherSha256, restore, productionMutation: 'none', plaintextRetainedInExplicitPrivateDirectory: true };
}

export async function main(argv) {
  const command = argv[0];
  need(['prepare','recover'].includes(command),'COMMAND_INVALID');
  const fields = ['backup','manifest','expected-backup-sha256','expected-manifest-sha256','expected-database-identity','expected-source-revision','age-binary','expected-age-sha256','recipient','private-dir','cipher-dir','cipher','identity','expected-cipher-sha256','expected-canonical-manifest-sha256'];
  const { values } = parseArgs({ args: argv.slice(1), options: Object.fromEntries(fields.map(key=>[key,{ type:'string' }])), allowPositionals: false });
  const options = { backup:values.backup, manifest:values.manifest, backupSha256:values['expected-backup-sha256'], manifestSha256:values['expected-manifest-sha256'], databaseIdentity:values['expected-database-identity'], sourceRevision:values['expected-source-revision'], ageBinary:values['age-binary'], ageSha256:values['expected-age-sha256'], recipient:values.recipient, privateDir:values['private-dir'], cipherDir:values['cipher-dir'], cipher:values.cipher, identity:values.identity, cipherSha256:values['expected-cipher-sha256'], manifestSha256Canonical:values['expected-canonical-manifest-sha256'] };
  return command === 'prepare' ? prepareNotesBackup(options) : recoverNotesBackup(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await main(process.argv.slice(2)))); }
  catch (error) { console.error(JSON.stringify({ ok:false, code:/^[A-Z_]+$/.test(error?.code ?? '')?error.code:'NOTES_CUSTODY_FAILED', productionMutation:'none', privateStateMayExist:true })); process.exitCode=1; }
}
