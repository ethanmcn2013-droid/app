import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {
  encryptBackup, requireCipherArtifactContents, requireEncryptionPreflight, requireUploadAck,
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

test('apply refuses absent upload acknowledgment before provider access', () => {
  const run = spawnSync(process.execPath, [script, 'apply'], {
    encoding:'utf8', env:{...process.env, GITHUB_ACTIONS:'false',
      BACKUP_ARTIFACT_ID:'', BACKUP_ARTIFACT_DIGEST:'',
      TASKS_DATABASE_URL:'libsql://unreachable.invalid', TASKS_AUTH_TOKEN:'synthetic'},
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /"errorCode":"UPLOAD_ID_MISSING"/);
  assert.throws(() => requireUploadAck('123', ''), /UPLOAD_DIGEST_MISSING/);
  assert.deepEqual(requireUploadAck('123', 'a'.repeat(64)), {
    artifactId:'123', artifactDigest:'a'.repeat(64),
  });
  assert.throws(() => requireUploadAck('123', `sha256:${'a'.repeat(64)}`),
    /UPLOAD_DIGEST_MISSING/);
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
