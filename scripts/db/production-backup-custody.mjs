// Production Tasks recovery custody. Only ciphertext and a sanitized receipt
// may enter the workflow artifact; plaintext stays under RUNNER_TEMP.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createClient} from '@libsql/client';
import {takeBackup} from './backup.mjs';
import {restoreInto, measure, compare, compareDdl} from './restore-verify.mjs';
import {canonicalFileSha256, loadAndValidateLedger, rawFileSha256, sha256} from './migration-ledger.mjs';
import {databaseIdentitySha256, migrationStatus, runMigrations, schemaFingerprintSha256} from './migrate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cipherDir = path.join(root, '.db-cipher');
const sha40 = /^[a-f0-9]{40}$/;
const sha64 = /^[a-f0-9]{64}$/;
const safeCode = error => /^[A-Z][A-Z0-9_]{0,47}$/.test(error?.code ?? '')
  ? error.code : 'verification_failed';
const requireValue = (condition, code) => {
  if (!condition) throw Object.assign(new Error(code), {code});
};

export function requireUploadAck(id, digest) {
  requireValue(/^[1-9][0-9]*$/.test(String(id ?? '')), 'UPLOAD_ID_MISSING');
  requireValue(sha64.test(String(digest ?? '')), 'UPLOAD_DIGEST_MISSING');
  return {artifactId:String(id), artifactDigest:String(digest)};
}

export function requireCipherArtifactContents(dir) {
  requireValue(fs.statSync(path.join(dir, 'backup.age')).size > 0, 'CIPHER_MISSING');
  requireValue(fs.readdirSync(dir).sort().join(',') === 'backup.age,receipt.json',
    'PLAINTEXT_ARTIFACT_REFUSED');
}

export function requireEncryptionPreflight(recipient, ageBinary, spawn = spawnSync) {
  requireValue(/^age1[a-z0-9]{40,}$/.test(String(recipient ?? '')), 'RECIPIENT_MISSING');
  requireValue(path.isAbsolute(ageBinary ?? '') && fs.existsSync(ageBinary), 'AGE_BINARY_MISSING');
  const probe = spawn(ageBinary, ['--version'], {stdio:'ignore'});
  requireValue(!probe.error && probe.status === 0, 'AGE_BINARY_INVALID');
}

export function encryptBackup(plainPath, cipherPath, recipient, ageBinary, spawn = spawnSync) {
  const result = spawn(ageBinary, ['-r', recipient, '-o', cipherPath, plainPath], {stdio:'ignore'});
  requireValue(!result.error && result.status === 0, 'ENCRYPTION_FAILED');
  requireValue(fs.existsSync(cipherPath) && fs.statSync(cipherPath).size > 0, 'CIPHER_MISSING');
  return rawFileSha256(cipherPath);
}

function sourceRevision() {
  const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'],
    {encoding:'utf8', stdio:['ignore','pipe','ignore']}).trim();
  requireValue(sha40.test(head), 'SOURCE_REVISION_INVALID');
  if (process.env.GITHUB_ACTIONS === 'true') {
    requireValue(process.env.GITHUB_REF === 'refs/heads/main', 'MAIN_REF_REQUIRED');
    requireValue(head === process.env.GITHUB_SHA, 'SOURCE_REVISION_MISMATCH');
  }
  return head;
}

function connection() {
  const url = process.env.TASKS_DATABASE_URL;
  const authToken = process.env.TASKS_AUTH_TOKEN;
  requireValue(url && authToken, 'PRODUCTION_BINDING_MISSING');
  const parsed = new URL(url);
  requireValue(parsed.protocol === 'libsql:' && !parsed.username && !parsed.password &&
    !parsed.search && !parsed.hash, 'REMOTE_TARGET_REQUIRED');
  return {url, authToken};
}

function paths() {
  const runnerTemp = process.env.RUNNER_TEMP;
  requireValue(runnerTemp && path.isAbsolute(runnerTemp), 'RUNNER_TEMP_REQUIRED');
  const relative = path.relative(root, runnerTemp);
  requireValue(relative === '..' || (relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)),
    'PRIVATE_OUTPUT_REQUIRED');
  const privateDir = path.join(runnerTemp, 'signal-production-backup');
  return {
    privateDir,
    backupPath:path.join(privateDir, 'backup.jsonl'),
    restorePath:path.join(privateDir, 'restored.db'),
    preparedPath:path.join(privateDir, 'prepared.json'),
    uploadAckPath:path.join(privateDir, 'upload-ack.json'),
    executionReceiptPath:path.join(privateDir, 'execution-receipt.json'),
    cipherPath:path.join(cipherDir, 'backup.age'),
    artifactReceiptPath:path.join(cipherDir, 'receipt.json'),
  };
}

async function ledgerRows(executor) {
  const present = await executor.execute(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'signal_schema_migrations'",
  );
  if (present.rows.length === 0) return [];
  const result = await executor.execute(
    'SELECT id, sha256 FROM signal_schema_migrations ORDER BY applied_at, id',
  );
  return result.rows.map(row => [String(row.id), String(row.sha256)]);
}

function pendingMigrations(context, rows) {
  if (rows.length === 0) return [context.baseline, ...context.forward];
  const applied = new Set(rows.map(row => row[0]));
  return context.forward.filter(entry => !applied.has(entry.id));
}

async function sourceSnapshot(client, url) {
  let tx;
  try {
    tx = await client.transaction('read');
    const backup = await takeBackup(tx, {label:'tasks-production', url});
    const rows = await ledgerRows(tx);
    const snapshot = {
      schemaFingerprintSha256:await schemaFingerprintSha256(tx),
      ledgerRowsSha256:sha256(JSON.stringify(rows)),
    };
    await tx.commit();
    tx = undefined;
    return {backup, snapshot, rows};
  } finally {
    if (tx) await tx.rollback().catch(() => undefined);
  }
}

async function verifyLocalRestore(backup, restorePath) {
  const {client} = await restoreInto(pathToFileURL(restorePath).href, backup.body);
  try {
    const names = backup.manifest.tables.map(table => table.name);
    requireValue(compare(backup.manifest, await measure(client, names)).ok, 'RESTORE_ROWS_MISMATCH');
    requireValue((await compareDdl(client, backup.manifest)).ok, 'RESTORE_DDL_MISMATCH');
    const integrity = await client.execute('PRAGMA integrity_check');
    requireValue(integrity.rows[0]?.integrity_check === 'ok', 'RESTORE_INTEGRITY_FAILED');
    const foreignKeys = await client.execute('PRAGMA foreign_key_check');
    requireValue(foreignKeys.rows.length === 0, 'RESTORE_FOREIGN_KEYS_FAILED');
  } finally {
    client.close();
  }
}

async function prepare() {
  const source = sourceRevision();
  const mode = process.env.BACKUP_MODE;
  requireValue(mode === 'backup' || mode === 'execute', 'BACKUP_MODE_INVALID');
  const recipient = process.env.DB_BACKUP_AGE_RECIPIENT;
  const ageBinary = process.env.AGE_BINARY;
  requireEncryptionPreflight(recipient, ageBinary); // before any provider connection
  const {url, authToken} = connection();
  const p = paths();
  const context = loadAndValidateLedger({root});
  requireValue(!fs.existsSync(p.privateDir) && !fs.existsSync(cipherDir), 'OUTPUT_ALREADY_EXISTS');
  fs.mkdirSync(p.privateDir, {mode:0o700});
  fs.mkdirSync(cipherDir, {mode:0o700});

  let client;
  try {
    client = createClient({url, authToken});
    const {backup, snapshot, rows} = await sourceSnapshot(client, url);
    client.close();
    client = undefined;
    fs.writeFileSync(p.backupPath, backup.body, {flag:'wx', mode:0o600});
    await verifyLocalRestore(backup, p.restorePath);
    const pending = pendingMigrations(context, rows);
    let dryRunFingerprint = null;
    if (mode === 'execute') {
      requireValue(pending.length > 0, 'NO_PENDING_MIGRATIONS');
      const dryRun = spawnSync(process.execPath,
        [path.join(root, 'scripts/db/migrate.mjs'), 'migrate', '--database-url',
          pathToFileURL(p.restorePath).href], {stdio:'ignore'});
      requireValue(!dryRun.error && dryRun.status === 0, 'LOCAL_DRY_RUN_FAILED');
      const local = createClient({url:pathToFileURL(p.restorePath).href});
      try { dryRunFingerprint = await schemaFingerprintSha256(local); }
      finally { local.close(); }
    }
    const cipherSha256 = encryptBackup(p.backupPath, p.cipherPath, recipient, ageBinary);
    const prepared = {
      schema:'tasks-encrypted-backup-prepared/1', mode, sourceRevision:source,
      targetUrlSha256:sha256(url), databaseIdentitySha256:databaseIdentitySha256(url),
      ledgerSha256:context.ledgerSha256, snapshot, backupSha256:backup.manifest.backupSha256,
      cipherSha256, recipientSha256:sha256(recipient), dryRunFingerprint,
      migrations:pending.map(entry => ({id:entry.id, sha256:entry.sha256})),
      tableCount:backup.manifest.tableCount, totalRows:backup.manifest.totalRows,
      takenAt:backup.manifest.takenAt,
    };
    requireValue(rawFileSha256(p.backupPath) === prepared.backupSha256, 'BACKUP_DIGEST_MISMATCH');
    fs.writeFileSync(p.preparedPath, JSON.stringify(prepared, null, 2) + '\n', {flag:'wx', mode:0o600});
    const artifactReceipt = {
      schema:'tasks-encrypted-backup-artifact/1', result:'prepared',
      sourceRevision:source, targetSha256:prepared.targetUrlSha256,
      backupSha256:prepared.backupSha256, cipherSha256,
      tableCount:prepared.tableCount, totalRows:prepared.totalRows,
      rowsAndHashesMatch:true, ddlPresent:true, integrity:'ok', foreignKeyViolations:0,
      restoreTarget:'new_local_file', sourceTransaction:'read', sourceWrites:0,
      limitations:['per-store snapshot; writes after capture are not included',
        'artifact recoverability requires offline decryption and restore rehearsal'],
    };
    fs.writeFileSync(p.artifactReceiptPath, JSON.stringify(artifactReceipt, null, 2) + '\n',
      {flag:'wx', mode:0o600});
    requireCipherArtifactContents(cipherDir);
    console.log(JSON.stringify({result:'prepared', mode, tables:prepared.tableCount,
      rows:prepared.totalRows, backupSha256:prepared.backupSha256}));
  } finally {
    client?.close();
  }
}

async function apply() {
  const source = sourceRevision();
  const ack = requireUploadAck(process.env.BACKUP_ARTIFACT_ID, process.env.BACKUP_ARTIFACT_DIGEST);
  const p = paths();
  const acknowledged = JSON.parse(fs.readFileSync(p.uploadAckPath, 'utf8'));
  requireValue(acknowledged.sourceRevision === source &&
    acknowledged.artifactId === ack.artifactId &&
    acknowledged.artifactDigest === ack.artifactDigest, 'UPLOAD_ACK_CHANGED');
  const {url, authToken} = connection();
  const prepared = JSON.parse(fs.readFileSync(p.preparedPath, 'utf8'));
  requireValue(prepared.schema === 'tasks-encrypted-backup-prepared/1' &&
    prepared.mode === 'execute', 'EXECUTION_PREPARE_MISSING');
  requireValue(prepared.sourceRevision === source && prepared.targetUrlSha256 === sha256(url) &&
    prepared.databaseIdentitySha256 === databaseIdentitySha256(url), 'PREPARED_TARGET_CHANGED');
  requireValue(prepared.recipientSha256 === sha256(process.env.DB_BACKUP_AGE_RECIPIENT ?? ''),
    'RECIPIENT_CHANGED');
  requireValue(sha64.test(prepared.backupSha256) && rawFileSha256(p.backupPath) === prepared.backupSha256 &&
    rawFileSha256(p.cipherPath) === prepared.cipherSha256 &&
    acknowledged.cipherSha256 === prepared.cipherSha256, 'PREPARED_DIGEST_CHANGED');
  requireCipherArtifactContents(cipherDir);
  const context = loadAndValidateLedger({root});
  requireValue(context.ledgerSha256 === prepared.ledgerSha256, 'SOURCE_LEDGER_CHANGED');
  const pending = prepared.migrations;
  requireValue(Array.isArray(pending) && pending.length > 0 &&
    pending.every(entry => sha64.test(entry.sha256 ?? '')), 'PENDING_MIGRATIONS_MISSING');

  let client;
  let tx;
  try {
    client = createClient({url, authToken});
    tx = await client.transaction('read');
    const currentRows = await ledgerRows(tx);
    const currentSnapshot = {
      schemaFingerprintSha256:await schemaFingerprintSha256(tx),
      ledgerRowsSha256:sha256(JSON.stringify(currentRows)),
    };
    await tx.commit();
    tx = undefined;
    requireValue(currentSnapshot.schemaFingerprintSha256 === prepared.snapshot.schemaFingerprintSha256 &&
      currentSnapshot.ledgerRowsSha256 === prepared.snapshot.ledgerRowsSha256,
    'PRODUCTION_SCHEMA_OR_LEDGER_DRIFT');
    const currentPending = pendingMigrations(context, currentRows)
      .map(entry => ({id:entry.id, sha256:entry.sha256}));
    requireValue(JSON.stringify(pending) === JSON.stringify(currentPending), 'PENDING_MIGRATIONS_CHANGED');

    const receipt = {
      schemaVersion:'tasks-migration-execution/1', id:`tasks-encrypted-execution-${process.env.GITHUB_RUN_ID ?? Date.now()}`,
      environment:'production', databaseIdentitySha256:prepared.databaseIdentitySha256,
      ledgerSha256:prepared.ledgerSha256, backupSha256:prepared.backupSha256,
      backupRows:prepared.totalRows, dryRun:{status:'passed', databaseSha256:prepared.dryRunFingerprint},
      migrations:pending, sourceRevision:source, snapshot:prepared.snapshot,
      encryptedBackup:{cipherSha256:prepared.cipherSha256, ...ack},
    };
    fs.writeFileSync(p.executionReceiptPath, JSON.stringify(receipt, null, 2) + '\n',
      {flag:'wx', mode:0o600});
    const result = await runMigrations({client, context, environment:'production', databaseUrl:url,
      executionReceiptPath:p.executionReceiptPath, releaseSha:source});
    const status = await migrationStatus({client, context});
    requireValue(status.state === 'current', 'POST_APPLY_STATUS_FAILED');
    console.log(JSON.stringify({result:'applied', applied:result.applied?.length ?? 0,
      artifactId:ack.artifactId, executionReceiptSha256:canonicalFileSha256(p.executionReceiptPath)}));
  } finally {
    if (tx) await tx.rollback().catch(() => undefined);
    client?.close();
  }
}

function acknowledge() {
  const source = sourceRevision();
  const ack = requireUploadAck(process.env.BACKUP_ARTIFACT_ID, process.env.BACKUP_ARTIFACT_DIGEST);
  const p = paths();
  const prepared = JSON.parse(fs.readFileSync(p.preparedPath, 'utf8'));
  requireValue(prepared.sourceRevision === source &&
    rawFileSha256(p.cipherPath) === prepared.cipherSha256, 'PREPARED_DIGEST_CHANGED');
  requireCipherArtifactContents(cipherDir);
  fs.writeFileSync(p.uploadAckPath, JSON.stringify({
    schema:'tasks-encrypted-backup-upload/1', sourceRevision:source,
    cipherSha256:prepared.cipherSha256, ...ack,
  }, null, 2) + '\n', {flag:'wx', mode:0o600});
  console.log(JSON.stringify({result:'uploaded', artifactId:ack.artifactId}));
}

let stage = 'guard';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  try {
    requireValue(['prepare','acknowledge','apply'].includes(command), 'COMMAND_INVALID');
    stage = command;
    if (command === 'prepare') await prepare();
    if (command === 'acknowledge') acknowledge();
    if (command === 'apply') await apply();
  } catch (error) {
    console.error(JSON.stringify({result:'failed', stage, errorCode:safeCode(error)}));
    process.exitCode = 1;
  }
}
