import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {createClient} from '@libsql/client';
import {takeBackup} from './backup.mjs';
import {sha256} from './migration-ledger.mjs';
import {
  encryptBackup, finalResult, makeBackupBundle, readBackupBundle,
  requireCipherArtifactContents, requireEncryptionPreflight, requireUploadAck,
  requireProductionTasksTarget, writeFinalResult,
} from './production-backup-custody.mjs';

const script = fileURLToPath(new URL('./production-backup-custody.mjs', import.meta.url));

test('prepare refuses missing encryption before provider access or artifact creation', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-custody-guard-'));
  try {
    const run = spawnSync(process.execPath, [script, 'prepare'], {
      encoding:'utf8', env:{...process.env, GITHUB_ACTIONS:'false', RUNNER_TEMP:temp,
        BACKUP_MODE:'backup',
        DB_BACKUP_AGE_RECIPIENT:'', AGE_BINARY:'',
        TASKS_DATABASE_URL:'libsql://unreachable.invalid', TASKS_AUTH_TOKEN:'synthetic'},
    });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /"errorCode":"RECIPIENT_MISSING"/);
    assert.equal(fs.existsSync(path.join(temp, 'signal-production-backup')), false);
  } finally {
    fs.rmSync(temp, {recursive:true, force:true});
  }
});

test('production target guard rejects a different store, port, or path before provider use', () => {
  assert.throws(() => requireProductionTasksTarget('libsql://other-store.turso.io'),
    /PRODUCTION_TARGET_MISMATCH/);
  assert.throws(() => requireProductionTasksTarget('libsql://other-store.turso.io:443'),
    /REMOTE_TARGET_REQUIRED/);
  assert.throws(() => requireProductionTasksTarget('libsql://other-store.turso.io/other'),
    /REMOTE_TARGET_REQUIRED/);
});

test('apply refuses absent upload acknowledgment before provider access', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-custody-fail-'));
  try {
    const finalDir = path.join(temp, 'final');
    const run = spawnSync(process.execPath, [script, 'apply'], {
      encoding:'utf8', env:{...process.env, GITHUB_ACTIONS:'false',
        CUSTODY_TEST_FINAL_DIR:finalDir,
        BACKUP_ARTIFACT_ID:'', BACKUP_ARTIFACT_DIGEST:'',
        TASKS_DATABASE_URL:'libsql://unreachable.invalid', TASKS_AUTH_TOKEN:'synthetic'},
    });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /"errorCode":"UPLOAD_ID_MISSING"/);
    assert.deepEqual(fs.readdirSync(finalDir), ['receipt.json']);
    const result = JSON.parse(fs.readFileSync(path.join(finalDir, 'receipt.json')));
    assert.equal(result.result, 'failed');
    assert.equal(result.errorCode, 'UPLOAD_ID_MISSING');
    assert.equal(result.mutationState, 'none_started');
    assert.equal(result.targetSha256, null);
    assert.throws(() => requireUploadAck('123', ''), /UPLOAD_DIGEST_MISSING/);
    assert.deepEqual(requireUploadAck('123', 'a'.repeat(64)), {
      artifactId:'123', artifactDigest:'a'.repeat(64),
    });
    assert.throws(() => requireUploadAck('123', `sha256:${'a'.repeat(64)}`),
      /UPLOAD_DIGEST_MISSING/);
  } finally {
    fs.rmSync(temp, {recursive:true, force:true});
  }
});

test('final result is allowlisted and marks attempted migration failure as unverified', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-custody-result-'));
  try {
    const input = {result:'failed', phase:'migration_attempted',
      sourceRevision:'a'.repeat(40), targetSha256:'b'.repeat(64),
      error:Object.assign(new Error('private row and token'), {code:'SQLITE_BUSY'}),
      authToken:'private-token', rawRows:[{secret:'private-row'}]};
    const receipt = finalResult(input);
    assert.equal(receipt.mutationState, 'partial_or_complete_unverified');
    assert.equal(receipt.errorCode, 'SQLITE_BUSY');
    assert.equal(receipt.appliedCount, null);
    assert.deepEqual(Object.keys(receipt).sort(), [
      'appliedCount', 'backupArtifactDigest', 'backupArtifactId', 'backupSha256',
      'cipherSha256', 'dryRunFingerprint', 'errorCode', 'executionReceiptSha256',
      'ledgerSha256', 'migrations', 'mutationState', 'phase', 'postApplyStatus',
      'result', 'schema', 'snapshotLedgerRowsSha256', 'snapshotSchemaSha256',
      'sourceRevision', 'targetSha256',
    ].sort());
    const dir = path.join(temp, 'result');
    writeFinalResult(dir, input);
    assert.deepEqual(fs.readdirSync(dir), ['receipt.json']);
    const disk = fs.readFileSync(path.join(dir, 'receipt.json'), 'utf8');
    assert.equal(disk.includes('private'), false);
    assert.deepEqual(JSON.parse(disk), receipt);
  } finally {
    fs.rmSync(temp, {recursive:true, force:true});
  }
});

test('real age encryption preserves exact binary bytes with a synthetic identity',
  {skip: !process.env.AGE_TEST_BINARY}, () => {
    const binary = process.env.AGE_TEST_BINARY;
    const keygen = path.join(path.dirname(binary),
      process.platform === 'win32' ? 'age-keygen.exe' : 'age-keygen');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-custody-age-'));
    try {
      const identity = path.join(temp, 'identity.txt');
      const plain = path.join(temp, 'source.bin');
      const cipher = path.join(temp, 'source.age');
      const restored = path.join(temp, 'restored.bin');
      const generated = spawnSync(keygen, ['-o', identity], {stdio:'ignore'});
      assert.equal(generated.status, 0);
      const recipient = fs.readFileSync(identity, 'utf8')
        .match(/^# public key: (age1[a-z0-9]+)$/m)?.[1];
      assert.ok(recipient);
      const bytes = Buffer.from([0, 11, 22, 33, 255, 0, 128]);
      fs.writeFileSync(plain, bytes);
      requireEncryptionPreflight(recipient, binary);
      assert.match(encryptBackup(plain, cipher, recipient, binary), /^[a-f0-9]{64}$/);
      const decrypted = spawnSync(binary,
        ['-d', '-i', identity, '-o', restored, cipher], {stdio:'ignore'});
      assert.equal(decrypted.status, 0);
      assert.deepEqual(fs.readFileSync(restored), bytes);
    } finally {
      const relative = path.relative(os.tmpdir(), temp);
      assert.ok(relative.startsWith('signal-custody-age-') &&
        !relative.includes(path.sep));
      fs.rmSync(temp, {recursive:true, force:true});
    }
  });

test('encrypted bundle includes full manifest and recovers through shipped verifier',
  {skip: !process.env.AGE_TEST_BINARY}, async () => {
    const binary = process.env.AGE_TEST_BINARY;
    const keygen = path.join(path.dirname(binary),
      process.platform === 'win32' ? 'age-keygen.exe' : 'age-keygen');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-custody-bundle-'));
    try {
      const client = createClient({url:':memory:'});
      try {
        await client.execute('CREATE TABLE sample (id INTEGER PRIMARY KEY, payload BLOB NOT NULL)');
        await client.execute('CREATE INDEX sample_payload_idx ON sample(payload)');
        await client.execute({sql:'INSERT INTO sample (id, payload) VALUES (?, ?)',
          args:[1, Buffer.from([0, 11, 22, 33, 255])]});
        const backup = await takeBackup(client, {label:'synthetic', url:':memory:'});
        const bundle = makeBackupBundle(backup);
        assert.equal(bundle.manifest.ddl.indexes.includes('sample_payload_idx'), true);
        const bundlePath = path.join(temp, 'backup.bundle.json');
        fs.writeFileSync(bundlePath, JSON.stringify(bundle) + '\n');
        const identity = path.join(temp, 'identity.txt');
        assert.equal(spawnSync(keygen, ['-o', identity], {stdio:'ignore'}).status, 0);
        const recipient = fs.readFileSync(identity, 'utf8')
          .match(/^# public key: (age1[a-z0-9]+)$/m)?.[1];
        assert.ok(recipient);
        const cipher = path.join(temp, 'backup.age');
        const cipherSha = encryptBackup(bundlePath, cipher, recipient, binary);
        const rejectedOutput = path.join(temp, 'rejected');
        const rejected = spawnSync(process.execPath, [script, 'recover',
          `--cipher=${cipher}`, `--identity=${identity}`, `--age-binary=${binary}`,
          `--expected-cipher-sha256=${'a'.repeat(64)}`,
          `--expected-backup-sha256=${backup.manifest.backupSha256}`,
          `--output-dir=${rejectedOutput}`], {encoding:'utf8'});
        assert.equal(rejected.status, 1);
        assert.match(rejected.stderr, /CIPHER_DIGEST_MISMATCH/);
        assert.equal(fs.existsSync(rejectedOutput), false);
        const wrongPlainOutput = path.join(temp, 'wrong-plain');
        const wrongPlain = spawnSync(process.execPath, [script, 'recover',
          `--cipher=${cipher}`, `--identity=${identity}`, `--age-binary=${binary}`,
          `--expected-cipher-sha256=${cipherSha}`,
          `--expected-backup-sha256=${'a'.repeat(64)}`,
          `--output-dir=${wrongPlainOutput}`], {encoding:'utf8'});
        assert.equal(wrongPlain.status, 1);
        assert.match(wrongPlain.stderr, /BACKUP_DIGEST_MISMATCH/);
        assert.equal(fs.existsSync(path.join(wrongPlainOutput, 'backup.jsonl')), false);
        const output = path.join(temp, 'recovered');
        const run = spawnSync(process.execPath, [script, 'recover',
          `--cipher=${cipher}`, `--identity=${identity}`, `--age-binary=${binary}`,
          `--expected-cipher-sha256=${cipherSha}`,
          `--expected-backup-sha256=${backup.manifest.backupSha256}`,
          `--output-dir=${output}`], {encoding:'utf8'});
        assert.equal(run.status, 0, run.stderr);
        assert.equal(JSON.parse(run.stdout).result, 'recovered');
        assert.equal(fs.readFileSync(path.join(output, 'backup.jsonl'), 'utf8'), backup.body);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'backup.manifest.json'))),
          backup.manifest);
        assert.equal(readBackupBundle(path.join(output, 'backup.bundle.json'),
          sha256(backup.body)).body, backup.body);
        const verifier = spawnSync(process.execPath,
          [fileURLToPath(new URL('./restore-verify.mjs', import.meta.url)),
            `--backup=${path.join(output, 'backup.jsonl')}`,
            `--manifest=${path.join(output, 'backup.manifest.json')}`, '--keep'],
          {encoding:'utf8', env:{...process.env, TEMP:temp, TMP:temp, TMPDIR:temp}});
        assert.equal(verifier.status, 0, verifier.stderr);
        assert.match(verifier.stdout, /restore-verify: PASSED/);
      } finally { client.close(); }
    } finally {
      const relative = path.relative(os.tmpdir(), temp);
      assert.ok(relative.startsWith('signal-custody-bundle-') &&
        !relative.includes(path.sep));
      fs.rmSync(temp, {recursive:true, force:true});
    }
  });

test('encryption failure cannot create an uploadable artifact', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-custody-encrypt-'));
  try {
    const plain = path.join(temp, 'backup.jsonl');
    const cipher = path.join(temp, 'backup.age');
    fs.writeFileSync(plain, Buffer.from([0, 11, 22, 33, 255]));
    assert.throws(() => encryptBackup(plain, cipher, 'age1synthetic', 'age',
      () => ({status:1})), /ENCRYPTION_FAILED/);
    assert.equal(fs.existsSync(cipher), false);
    assert.throws(() => requireEncryptionPreflight('', 'missing',
      () => { throw new Error('must not invoke age'); }), /RECIPIENT_MISSING/);
  } finally {
    fs.rmSync(temp, {recursive:true, force:true});
  }
});

test('artifact directory refuses plaintext even when ciphertext exists', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-custody-artifact-'));
  try {
    fs.writeFileSync(path.join(temp, 'backup.age'), 'ciphertext');
    fs.writeFileSync(path.join(temp, 'receipt.json'), '{}');
    assert.doesNotThrow(() => requireCipherArtifactContents(temp));
    fs.writeFileSync(path.join(temp, 'backup.jsonl'), 'sensitive row');
    assert.throws(() => requireCipherArtifactContents(temp), /PLAINTEXT_ARTIFACT_REFUSED/);
  } finally {
    fs.rmSync(temp, {recursive:true, force:true});
  }
});
