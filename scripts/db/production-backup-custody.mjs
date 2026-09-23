// Production Tasks recovery custody. Only ciphertext and a sanitized receipt
// may enter the workflow artifact; plaintext stays under RUNNER_TEMP.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {createClient} from '@libsql/client';
import {takeBackup} from './backup.mjs';
import {restoreInto, measure, compare, compareDdl} from './restore-verify.mjs';
import {canonicalFileSha256, loadAndValidateLedger, rawFileSha256, sha256} from './migration-ledger.mjs';
import {databaseIdentitySha256, migrationStatus, runMigrations, schemaFingerprintSha256} from './migrate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cipherDir = path.join(root, '.db-cipher');
const finalDir = path.join(root, '.db-final');
const finalOutputDir = () => process.env.GITHUB_ACTIONS === 'true' ||
  !process.env.CUSTODY_TEST_FINAL_DIR ? finalDir : path.resolve(process.env.CUSTODY_TEST_FINAL_DIR);
const sha40 = /^[a-f0-9]{40}$/;
const sha64 = /^[a-f0-9]{64}$/;
// Independently observed production Tasks URL fingerprint. A credential
// accidentally bound to another module must fail before any provider request.
const productionTasksUrlSha256 = '248b09a9d4560a8b66dd2d910e5d95c97b473eda4b656577d030592105a72eb0';
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

export function makeBackupBundle(backup) {
  requireValue(typeof backup?.body === 'string' &&
    sha64.test(backup?.manifest?.backupSha256 ?? '') &&
    sha256(backup.body) === backup.manifest.backupSha256 &&
    Array.isArray(backup.manifest.tables) && backup.manifest.ddl,
  'BACKUP_BUNDLE_INVALID');
  return {schema:'tasks-encrypted-backup-bundle/1',
    body:backup.body, manifest:backup.manifest};
}

export function readBackupBundle(bundlePath, expectedBackupSha256) {
  requireValue(sha64.test(expectedBackupSha256 ?? ''), 'EXPECTED_BACKUP_DIGEST_MISSING');
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  requireValue(bundle.schema === 'tasks-encrypted-backup-bundle/1', 'BACKUP_BUNDLE_INVALID');
  makeBackupBundle(bundle);
  requireValue(bundle.manifest.backupSha256 === expectedBackupSha256,
    'BACKUP_DIGEST_MISMATCH');
  return bundle;
}

export function finalResult(input) {
  const result = input.result === 'applied' ? 'applied' : 'failed';
  const phase = ['preflight','before_mutation','migration_attempted','postcheck','complete']
    .includes(input.phase) ? input.phase : 'preflight';
  const validSha = value => sha64.test(value ?? '') ? value : null;
  const validSource = value => sha40.test(value ?? '') ? value : null;
  const validId = value => /^[1-9][0-9]*$/.test(String(value ?? '')) ? String(value) : null;
  const migrations = Array.isArray(input.migrations) && input.migrations.every(entry =>
    /^[a-zA-Z0-9_-]{1,80}$/.test(entry?.id ?? '') && sha64.test(entry?.sha256 ?? ''))
    ? input.migrations.map(entry => ({id:entry.id, sha256:entry.sha256})) : null;
  return {
    schema:'tasks-encrypted-migration-result/1', result, phase,
    mutationState:result === 'applied' ? 'verified_current' :
      ['migration_attempted','postcheck','complete'].includes(phase)
        ? 'partial_or_complete_unverified' : 'none_started',
    errorCode:result === 'failed' ? safeCode(input.error) : null,
    sourceRevision:validSource(input.sourceRevision),
    targetSha256:validSha(input.targetSha256),
    ledgerSha256:validSha(input.ledgerSha256),
    snapshotSchemaSha256:validSha(input.snapshotSchemaSha256),
    snapshotLedgerRowsSha256:validSha(input.snapshotLedgerRowsSha256),
    dryRunFingerprint:validSha(input.dryRunFingerprint),
    migrations,
    backupSha256:validSha(input.backupSha256),
    cipherSha256:validSha(input.cipherSha256),
    backupArtifactId:validId(input.artifactId),
    backupArtifactDigest:validSha(input.artifactDigest),
    executionReceiptSha256:validSha(input.executionReceiptSha256),
    postApplyStatus:result === 'applied' ? 'current' : null,
    appliedCount:result === 'applied' && Number.isSafeInteger(input.appliedCount)
      ? input.appliedCount : null,
  };
}

export function writeFinalResult(dir, input) {
  requireValue(!fs.existsSync(dir), 'FINAL_RESULT_ALREADY_EXISTS');
  fs.mkdirSync(dir, {mode:0o700});
  fs.writeFileSync(path.join(dir, 'receipt.json'),
    JSON.stringify(finalResult(input), null, 2) + '\n', {flag:'wx', mode:0o600});
  requireValue(fs.readdirSync(dir).join(',') === 'receipt.json', 'FINAL_RESULT_NOT_ALLOWLISTED');
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

export function requireProductionTasksTarget(url) {
  requireValue(url, 'PRODUCTION_BINDING_MISSING');
  const parsed = new URL(url);
  requireValue(parsed.protocol === 'libsql:' && !parsed.username && !parsed.password &&
    !parsed.port && (parsed.pathname === '' || parsed.pathname === '/') &&
    !parsed.search && !parsed.hash, 'REMOTE_TARGET_REQUIRED');
  requireValue(sha256(url) === productionTasksUrlSha256, 'PRODUCTION_TARGET_MISMATCH');
}

function connection() {
  const url = process.env.TASKS_DATABASE_URL;
  const authToken = process.env.TASKS_AUTH_TOKEN;
  requireValue(url && authToken, 'PRODUCTION_BINDING_MISSING');
  requireProductionTasksTarget(url);
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
    bundlePath:path.join(privateDir, 'backup.bundle.json'),
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
    fs.writeFileSync(p.bundlePath, JSON.stringify(makeBackupBundle(backup)) + '\n',
      {flag:'wx', mode:0o600});
    const cipherSha256 = encryptBackup(p.bundlePath, p.cipherPath, recipient, ageBinary);
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
      rows:prepared.totalRows, backupSha256:prepared.backupSha256, cipherSha256}));
  } finally {
    client?.close();
  }
}

async function apply(progress) {
  const source = sourceRevision();
  progress.sourceRevision = source;
  const ack = requireUploadAck(process.env.BACKUP_ARTIFACT_ID, process.env.BACKUP_ARTIFACT_DIGEST);
  const p = paths();
  const acknowledged = JSON.parse(fs.readFileSync(p.uploadAckPath, 'utf8'));
  requireValue(acknowledged.sourceRevision === source &&
    acknowledged.artifactId === ack.artifactId &&
    acknowledged.artifactDigest === ack.artifactDigest, 'UPLOAD_ACK_CHANGED');
  progress.artifactId = ack.artifactId;
  progress.artifactDigest = ack.artifactDigest;
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
  progress.targetSha256 = prepared.targetUrlSha256;
  progress.backupSha256 = prepared.backupSha256;
  progress.cipherSha256 = prepared.cipherSha256;
  progress.ledgerSha256 = prepared.ledgerSha256;
  progress.snapshotSchemaSha256 = prepared.snapshot.schemaFingerprintSha256;
  progress.snapshotLedgerRowsSha256 = prepared.snapshot.ledgerRowsSha256;
  progress.dryRunFingerprint = prepared.dryRunFingerprint;
  requireCipherArtifactContents(cipherDir);
  const context = loadAndValidateLedger({root});
  requireValue(context.ledgerSha256 === prepared.ledgerSha256, 'SOURCE_LEDGER_CHANGED');
  const pending = prepared.migrations;
  requireValue(Array.isArray(pending) && pending.length > 0 &&
    pending.every(entry => sha64.test(entry.sha256 ?? '')), 'PENDING_MIGRATIONS_MISSING');
  progress.migrations = pending;

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
    progress.phase = 'before_mutation';

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
    progress.executionReceiptSha256 = canonicalFileSha256(p.executionReceiptPath);
    progress.phase = 'migration_attempted';
    const result = await runMigrations({client, context, environment:'production', databaseUrl:url,
      executionReceiptPath:p.executionReceiptPath, releaseSha:source});
    progress.phase = 'postcheck';
    const status = await migrationStatus({client, context});
    requireValue(status.state === 'current', 'POST_APPLY_STATUS_FAILED');
    progress.phase = 'complete';
    progress.appliedCount = result.applied?.length ?? 0;
    console.log(JSON.stringify({result:'applied', applied:result.applied?.length ?? 0,
      artifactId:ack.artifactId, executionReceiptSha256:progress.executionReceiptSha256}));
  } finally {
    if (tx) await tx.rollback().catch(() => undefined);
    client?.close();
  }
}

async function recover(argv) {
  const {values} = parseArgs({args:argv, options:{
    cipher:{type:'string'}, identity:{type:'string'},
    'age-binary':{type:'string'}, 'output-dir':{type:'string'},
    'expected-cipher-sha256':{type:'string'},
    'expected-backup-sha256':{type:'string'},
  }});
  const cipher = path.resolve(values.cipher ?? '');
  const identity = path.resolve(values.identity ?? '');
  const ageBinary = path.resolve(values['age-binary'] ?? '');
  const outputDir = path.resolve(values['output-dir'] ?? '');
  requireValue(values.cipher && values.identity && values['age-binary'] &&
    values['output-dir'], 'RECOVERY_INPUT_MISSING');
  requireValue(sha64.test(values['expected-cipher-sha256'] ?? '') &&
    sha64.test(values['expected-backup-sha256'] ?? ''), 'EXPECTED_DIGEST_MISSING');
  requireValue(fs.existsSync(cipher) && fs.existsSync(identity) &&
    fs.existsSync(ageBinary), 'RECOVERY_INPUT_MISSING');
  requireValue(rawFileSha256(cipher) === values['expected-cipher-sha256'],
    'CIPHER_DIGEST_MISMATCH');
  const relative = path.relative(root, outputDir);
  requireValue(relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) &&
    !fs.existsSync(outputDir), 'PRIVATE_OUTPUT_REQUIRED');
  fs.mkdirSync(outputDir, {mode:0o700});
  const bundlePath = path.join(outputDir, 'backup.bundle.json');
  const decrypted = spawnSync(ageBinary,
    ['-d','-i',identity,'-o',bundlePath,cipher], {stdio:'ignore'});
  requireValue(!decrypted.error && decrypted.status === 0, 'DECRYPTION_FAILED');
  const bundle = readBackupBundle(bundlePath, values['expected-backup-sha256']);
  const backupPath = path.join(outputDir, 'backup.jsonl');
  const manifestPath = path.join(outputDir, 'backup.manifest.json');
  fs.writeFileSync(backupPath, bundle.body, {flag:'wx', mode:0o600});
  fs.writeFileSync(manifestPath, JSON.stringify(bundle.manifest, null, 2) + '\n',
    {flag:'wx', mode:0o600});
  requireValue(rawFileSha256(backupPath) === values['expected-backup-sha256'],
    'BACKUP_DIGEST_MISMATCH');
  await verifyLocalRestore(bundle, path.join(outputDir, 'restored.db'));
  console.log(JSON.stringify({result:'recovered',
    backupSha256:values['expected-backup-sha256'],
    cipherSha256:values['expected-cipher-sha256'],
    tables:bundle.manifest.tableCount, rows:bundle.manifest.totalRows,
    restore:'fresh_local_verified'}));
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
  const progress = {phase:'preflight'};
  try {
    requireValue(['prepare','acknowledge','apply','recover'].includes(command), 'COMMAND_INVALID');
    stage = command;
    if (command === 'prepare') await prepare();
    if (command === 'acknowledge') acknowledge();
    if (command === 'apply') {
      await apply(progress);
      writeFinalResult(finalOutputDir(), {...progress, result:'applied'});
    }
    if (command === 'recover') await recover(process.argv.slice(3));
  } catch (error) {
    if (command === 'apply') {
      try { writeFinalResult(finalOutputDir(), {...progress, result:'failed', error}); }
      catch { /* upload step fails closed if no final receipt exists */ }
    }
    console.error(JSON.stringify({result:'failed', stage, errorCode:safeCode(error)}));
    process.exitCode = 1;
  }
}
