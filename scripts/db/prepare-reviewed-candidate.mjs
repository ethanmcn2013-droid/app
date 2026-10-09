// Import reviewed migration DATA only. All imports, Git operations, dependencies
// and SQL execution machinery come from the checked-out main revision.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {canonicalText, loadAndValidateLedger, sha256} from './migration-ledger.mjs';

const repository = 'ethanmcn2013-droid/app';
const productionTarget = '248b09a9d4560a8b66dd2d910e5d95c97b473eda4b656577d030592105a72eb0';
const sha40 = /^[a-f0-9]{40}$/;
const sha64 = /^[a-f0-9]{64}$/;
const idPattern = /^[0-9]{4}[a-z]?_[a-z0-9_]+$/;
const requireValue = (condition, code) => {
  if (!condition) throw Object.assign(new Error(code), {code});
};
const nonempty = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;
const canonicalHash = bytes => sha256(canonicalText(bytes.toString('utf8')));
const git = (root, args) => execFileSync('git', ['-C', root, ...args],
  {stdio:['ignore','pipe','ignore'], maxBuffer:16 * 1024 * 1024,timeout:60000});

export function validateCandidateManifest(manifest, base, now = Date.now()) {
  requireValue(manifest?.schemaVersion === 'tasks-reviewed-migration-candidate/1', 'CANDIDATE_MANIFEST_INVALID');
  requireValue(/^[a-z0-9][a-z0-9-]{0,79}$/.test(manifest.id ?? '') &&
    manifest.repository === repository && Number.isSafeInteger(manifest.pullRequestNumber) &&
    manifest.pullRequestNumber > 0, 'CANDIDATE_REPOSITORY_INVALID');
  requireValue(sha40.test(manifest.candidateSourceRevision ?? '') &&
    sha40.test(manifest.candidateBaseRevision ?? '') &&
    manifest.candidateSourceRevision !== manifest.candidateBaseRevision, 'CANDIDATE_REVISION_INVALID');
  requireValue(manifest.baseLedgerSha256 === base.ledgerSha256 &&
    sha64.test(manifest.candidateLedgerSha256 ?? '') &&
    manifest.expectedLastMigrationId === base.ledger.entries.at(-1).id, 'CANDIDATE_BASE_CHANGED');
  requireValue(manifest.targetUrlSha256 === productionTarget &&
    sha64.test(manifest.databaseIdentitySha256 ?? ''), 'CANDIDATE_TARGET_INVALID');
  const begins = Date.parse(manifest.notBefore);
  const ends = Date.parse(manifest.expiresAt);
  requireValue(Number.isFinite(begins) && Number.isFinite(ends) && ends > begins &&
    ends - begins <= 24 * 60 * 60 * 1000 && now >= begins && now < ends, 'CANDIDATE_AUTHORIZATION_EXPIRED');
  requireValue(nonempty(manifest.authorization?.source) && nonempty(manifest.authorization?.authorizedBy) &&
    manifest.review?.verdict === 'approved' && nonempty(manifest.review?.reviewedBy) &&
    nonempty(manifest.review?.reference) && manifest.review?.sourceRevision === manifest.candidateSourceRevision &&
    Number.isFinite(Date.parse(manifest.review?.reviewedAt)) &&
    Date.parse(manifest.review.reviewedAt) <= now, 'CANDIDATE_REVIEW_MISSING');
  requireValue(Array.isArray(manifest.migrations) && manifest.migrations.length > 0 &&
    manifest.migrations.length <= 10 && manifest.migrations.every(entry => idPattern.test(entry?.id ?? '') &&
      sha64.test(entry.sha256 ?? '') && sha64.test(entry.receiptSha256 ?? '')) &&
    new Set(manifest.migrations.map(entry => entry.id)).size === manifest.migrations.length,
  'CANDIDATE_MIGRATIONS_INVALID');
  requireValue(Array.isArray(manifest.files) && manifest.files.length >= 4 && manifest.files.length <= 32 &&
    new Set(manifest.files.map(entry => entry?.path)).size === manifest.files.length &&
    manifest.files.every(entry => sha64.test(entry?.sha256 ?? '') &&
      (/^drizzle\/[0-9]{4}[a-z]?_[a-z0-9_]+\.sql$/.test(entry.path ?? '') ||
       /^drizzle\/receipts\/[a-z0-9][a-z0-9-]{0,100}\.json$/.test(entry.path ?? '') ||
       ['drizzle/migration-ledger.json','drizzle/meta/_journal.json'].includes(entry.path))),
  'CANDIDATE_PATH_INVALID');
  requireValue(manifest.files.find(entry => entry.path === 'drizzle/migration-ledger.json')?.sha256 ===
    manifest.candidateLedgerSha256 &&
    manifest.files.some(entry => entry.path === 'drizzle/meta/_journal.json'), 'CANDIDATE_LEDGER_MISSING');
  return manifest;
}

export function requireCandidatePullRequest(pr, manifest) {
  requireValue(pr?.number === manifest.pullRequestNumber && pr.state === 'open' &&
    pr.base?.ref === 'main' && pr.base?.repo?.full_name === repository &&
    pr.head?.repo?.full_name === repository && sha40.test(pr.head?.sha ?? ''),
  'CANDIDATE_PR_CHANGED');
  return pr.head.sha;
}

async function readPullRequest(number) {
  // App is public. Public metadata needs no pull-requests token permission;
  // immutable objects and live refs use checkout's existing contents-read Git
  // credential. Never ask for another token scope or provider grant.
  const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${number}`, {
    headers:{Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'}, redirect:'error', signal:AbortSignal.timeout(15000),
  });
  requireValue(response.ok, 'CANDIDATE_PR_LOOKUP_FAILED');
  return response.json();
}

// Never checkout, extract an archive, run a hook, or import from this revision.
export function readRegularGitBlob(root, revision, file) {
  requireValue(sha40.test(revision) && !file.includes('..') && !file.includes('\\') &&
    !file.startsWith('/') && !file.includes('\0'), 'CANDIDATE_PATH_INVALID');
  const record = git(root, ['ls-tree','-z',revision,'--',file]).toString('utf8');
  const match = /^100644 blob ([a-f0-9]{40})\t([^\0]+)\0$/.exec(record);
  requireValue(match && match[2] === file, 'CANDIDATE_REGULAR_BLOB_REQUIRED');
  return git(root, ['cat-file','blob',match[1]]);
}

function readRegularGitBlobs(root, revision, files) {
  const tree = git(root,['ls-tree','-z',revision,'--',...files]).toString('utf8').split('\0').filter(Boolean);
  const objects = tree.map(record => {
    const match = /^100644 blob ([a-f0-9]{40})\t(.+)$/.exec(record);
    requireValue(match && files.includes(match[2]),'CANDIDATE_REGULAR_BLOB_REQUIRED');
    return {object:match[1],file:match[2]};
  });
  requireValue(objects.length === files.length,'CANDIDATE_REGULAR_BLOB_REQUIRED');
  const bytes = execFileSync('git',['-C',root,'cat-file','--batch'],
    {input:objects.map(item => item.object).join('\n') + '\n',stdio:['pipe','pipe','ignore'],maxBuffer:16 * 1024 * 1024});
  const result = new Map(); let position = 0;
  for (const item of objects) {
    const end = bytes.indexOf(10,position);
    const header = /^([a-f0-9]{40}) blob ([0-9]+)$/.exec(bytes.subarray(position,end).toString('utf8'));
    requireValue(header && header[1] === item.object,'CANDIDATE_REGULAR_BLOB_REQUIRED');
    const size = Number(header[2]); position = end + 1;
    requireValue(Number.isSafeInteger(size) && size >= 0 && position + size < bytes.length &&
      bytes[position + size] === 10,'CANDIDATE_BLOB_INVALID');
    result.set(item.file,bytes.subarray(position,position + size)); position += size + 1;
  }
  requireValue(position === bytes.length,'CANDIDATE_BLOB_INVALID');
  return result;
}

function privateDataRoot(root, runnerTemp) {
  requireValue(runnerTemp && path.isAbsolute(runnerTemp), 'RUNNER_TEMP_REQUIRED');
  const relative = path.relative(root, runnerTemp);
  requireValue(relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'PRIVATE_OUTPUT_REQUIRED');
  requireValue(!fs.lstatSync(runnerTemp).isSymbolicLink(), 'CANDIDATE_PATH_INVALID');
  return path.join(runnerTemp, 'signal-reviewed-migration-candidate');
}

function checkedWrite(dir, file, bytes) {
  const destination = path.join(dir, file);
  fs.mkdirSync(path.dirname(destination), {recursive:true, mode:0o700});
  fs.writeFileSync(destination, bytes, {flag:'wx', mode:0o600});
}

export function validateCandidateContext(base, candidate, manifest) {
  const baseHeader = {...base.ledger, entries:undefined};
  const candidateHeader = {...candidate.ledger, entries:undefined};
  requireValue(JSON.stringify(baseHeader) === JSON.stringify(candidateHeader) &&
    JSON.stringify(candidate.ledger.entries.slice(0, base.entries.length)) ===
      JSON.stringify(base.ledger.entries), 'CANDIDATE_HISTORY_CHANGED');
  // The general ledger loader validates journal scheduling fields, but an
  // append-only release must also preserve every historical journal field.
  const baseJournal = JSON.parse(fs.readFileSync(path.resolve(base.root,base.ledger.journal),'utf8'));
  const candidateJournal = JSON.parse(fs.readFileSync(path.resolve(candidate.root,candidate.ledger.journal),'utf8'));
  requireValue(isDeepStrictEqual({...baseJournal,entries:undefined},{...candidateJournal,entries:undefined}) &&
    isDeepStrictEqual(candidateJournal.entries.slice(0,baseJournal.entries.length),baseJournal.entries),
  'CANDIDATE_JOURNAL_HISTORY_CHANGED');
  const appended = candidate.entries.slice(base.entries.length);
  requireValue(appended.every(entry => entry.policy === 'forward') &&
    JSON.stringify(appended.map(entry => ({id:entry.id,sha256:entry.sha256,receiptSha256:entry.receiptSha256}))) ===
      JSON.stringify(manifest.migrations), 'CANDIDATE_PENDING_CHANGED');
  const expectedFiles = ['drizzle/migration-ledger.json','drizzle/meta/_journal.json',
    ...appended.flatMap(entry => [entry.file,entry.receipt.path &&
      path.relative(candidate.root,entry.receipt.path).split(path.sep).join('/')])].sort();
  requireValue(new Set(expectedFiles).size === expectedFiles.length &&
    JSON.stringify(expectedFiles) === JSON.stringify(manifest.files.map(entry => entry.path).sort()) &&
    candidate.ledgerSha256 === manifest.candidateLedgerSha256, 'CANDIDATE_FILE_SET_CHANGED');
}

export function candidateProvenance(candidate) {
  if (!candidate) return null;
  const m = candidate.manifest;
  return {candidateSourceRevision:m.candidateSourceRevision, candidateBaseRevision:m.candidateBaseRevision,
    receivingSourceRevision:candidate.receivingSourceRevision,
    candidateManifestId:m.id, candidateManifestSha256:candidate.manifestSha256,
    candidateExpiresAt:m.expiresAt, candidateDatabaseIdentitySha256:m.databaseIdentitySha256,
    candidateMigrations:m.migrations.map(entry => ({id:entry.id,sha256:entry.sha256,receiptSha256:entry.receiptSha256}))};
}

export async function loadReviewedCandidate({root, sourceRevision, manifestName, runnerTemp,
  materialize = false, now = undefined, getPullRequest = readPullRequest, readBlob = readRegularGitBlob,
  fetchRevision = (directory,revision) => git(directory,
    ['-c','core.hooksPath=/dev/null','fetch','--no-tags','--depth=100','origin',revision]),
  readMainRevision = directory => git(directory,['ls-remote','origin','refs/heads/main']).toString('utf8').split('\t')[0],
  readReceivingRevision = (directory,number) =>
    git(directory,['ls-remote','origin',`refs/pull/${number}/head`]).toString('utf8').split('\t')[0]}) {
  if (!manifestName) return null;
  requireValue(/^[a-z0-9][a-z0-9-]{0,79}\.json$/.test(manifestName), 'CANDIDATE_PATH_INVALID');
  const manifestPath = `docs/ops/migration-candidates/${manifestName}`;
  const bytes = readBlob(root, sourceRevision, manifestPath);
  const base = loadAndValidateLedger({root});
  const manifest = validateCandidateManifest(JSON.parse(bytes.toString('utf8')), base, now ?? Date.now());
  const remote = git(root,['remote','get-url','origin']).toString('utf8').trim();
  requireValue(remote === `https://github.com/${repository}.git`, 'CANDIDATE_REMOTE_INVALID');
  const receivingSourceRevision = requireCandidatePullRequest(await getPullRequest(manifest.pullRequestNumber), manifest);
  requireValue(readReceivingRevision(root,manifest.pullRequestNumber) === receivingSourceRevision,'CANDIDATE_PR_CHANGED');
  requireValue(readMainRevision(root) === sourceRevision,'CANDIDATE_MAIN_CHANGED');
  const dataRoot = privateDataRoot(root, runnerTemp);
  const selectionPath = path.join(runnerTemp,'signal-reviewed-migration-selection.json');
  const selection = {operatorSourceRevision:sourceRevision,candidateSourceRevision:manifest.candidateSourceRevision,
    manifestSha256:canonicalHash(bytes),receivingSourceRevision};
  if (!materialize) {
    requireValue(fs.existsSync(selectionPath) && fs.lstatSync(selectionPath).isFile() &&
      !fs.lstatSync(selectionPath).isSymbolicLink(),'CANDIDATE_CONTEXT_MISSING');
    requireValue(JSON.stringify(JSON.parse(fs.readFileSync(selectionPath,'utf8'))) === JSON.stringify(selection),
      'CANDIDATE_PR_CHANGED');
  }
  const trustedPaths = new Set(['.gitattributes', ...base.entries.flatMap(entry =>
    [entry.file,entry.receipt && path.relative(root,entry.receipt.path).split(path.sep).join('/'),entry.snapshot].filter(Boolean))]);
  const expectedPaths = new Set([...trustedPaths,...manifest.files.map(entry => entry.path)]);
  const nativeReader = readBlob === readRegularGitBlob;
  let trustedObjects;
  if (nativeReader) trustedObjects = readRegularGitBlobs(root,sourceRevision,[...trustedPaths]);
  const trustedBlob = file => nativeReader ? trustedObjects.get(file) : readBlob(root,sourceRevision,file);
  if (materialize) {
    requireValue(!fs.existsSync(dataRoot), 'CANDIDATE_OUTPUT_ALREADY_EXISTS');
    // Object-only fetch. No worktree operation or candidate code execution.
    for (const revision of [manifest.candidateBaseRevision,manifest.candidateSourceRevision,receivingSourceRevision]) {
      fetchRevision(root,revision);
    }
    const parents = git(root,['cat-file','-p',manifest.candidateSourceRevision]).toString('utf8')
      .split('\n').filter(line => line.startsWith('parent '));
    requireValue(parents.length === 1 && parents[0] === `parent ${manifest.candidateBaseRevision}`,
      'CANDIDATE_BASE_CHANGED');
    requireValue(canonicalHash(readBlob(root,manifest.candidateBaseRevision,'drizzle/migration-ledger.json')) ===
      base.ledgerSha256, 'CANDIDATE_BASE_CHANGED');
    fs.writeFileSync(selectionPath,JSON.stringify(selection) + '\n',{flag:'wx',mode:0o600});
  }
  // Receiving HEAD may merge the approved data commit with newer trusted main;
  // immutable data approval never grants permission for additional source edits.
  for (const ancestor of [sourceRevision,manifest.candidateSourceRevision]) {
    try { git(root,['merge-base','--is-ancestor',ancestor,receivingSourceRevision]); }
    catch { requireValue(false,'CANDIDATE_RECEIVING_ANCESTRY_INVALID'); }
  }
  const changed = git(root,['diff','--name-only','--no-renames',sourceRevision,
      receivingSourceRevision]).toString('utf8').trim().split('\n').filter(Boolean).sort();
    requireValue(JSON.stringify(changed) === JSON.stringify(manifest.files.map(entry => entry.path).sort()),
      'CANDIDATE_RECEIVING_FILE_SET_CHANGED');
  const receivingObjects = nativeReader ? readRegularGitBlobs(root,receivingSourceRevision,
    manifest.files.map(entry => entry.path)) : undefined;
  for (const entry of manifest.files) {
    const received = nativeReader ? receivingObjects.get(entry.path) : readBlob(root,receivingSourceRevision,entry.path);
    requireValue(canonicalHash(received) === entry.sha256,'CANDIDATE_RECEIVING_HASH_CHANGED');
  }
  if (materialize) {
    fs.mkdirSync(dataRoot,{mode:0o700});
    for (const file of trustedPaths) checkedWrite(dataRoot,file,trustedBlob(file));
    const candidateObjects = nativeReader ?
      readRegularGitBlobs(root,manifest.candidateSourceRevision,manifest.files.map(entry => entry.path)) : undefined;
    for (const entry of manifest.files) {
      const blob = nativeReader ? candidateObjects.get(entry.path) : readBlob(root,manifest.candidateSourceRevision,entry.path);
      requireValue(canonicalHash(blob) === entry.sha256, 'CANDIDATE_BLOB_HASH_CHANGED');
      checkedWrite(dataRoot,entry.path,blob);
    }
  }
  // Every later phase re-reads trusted manifest and checks ALL materialized bytes.
  requireValue(fs.existsSync(dataRoot) && !fs.lstatSync(dataRoot).isSymbolicLink(), 'CANDIDATE_CONTEXT_MISSING');
  const observed = [];
  function walk(dir, prefix = '') {
    for (const name of fs.readdirSync(dir)) {
      const file = prefix ? `${prefix}/${name}` : name;
      const stat = fs.lstatSync(path.join(dir,name));
      requireValue(!stat.isSymbolicLink(), 'CANDIDATE_REGULAR_BLOB_REQUIRED');
      if (stat.isDirectory()) walk(path.join(dir,name),file);
      else { requireValue(stat.isFile(), 'CANDIDATE_REGULAR_BLOB_REQUIRED'); observed.push(file); }
    }
  }
  walk(dataRoot);
  requireValue(JSON.stringify(observed.sort()) === JSON.stringify([...expectedPaths].sort()), 'CANDIDATE_FILE_SET_CHANGED');
  for (const file of expectedPaths) {
    const expected = manifest.files.find(entry => entry.path === file)?.sha256 ??
      canonicalHash(trustedBlob(file));
    requireValue(canonicalHash(fs.readFileSync(path.join(dataRoot,file))) === expected, 'CANDIDATE_BLOB_HASH_CHANGED');
  }
  const context = loadAndValidateLedger({root:dataRoot});
  validateCandidateContext(base,context,manifest);
  validateCandidateManifest(manifest,base,now ?? Date.now());
  return {context,base,manifest,manifestSha256:canonicalHash(bytes),receivingSourceRevision};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    requireValue(process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REF === 'refs/heads/main', 'MAIN_REF_REQUIRED');
    const sourceRevision = git(root,['rev-parse','HEAD']).toString('utf8').trim();
    requireValue(sourceRevision === process.env.GITHUB_SHA && sha40.test(sourceRevision), 'SOURCE_REVISION_MISMATCH');
    requireValue(process.env.BACKUP_MODE === 'execute', 'CANDIDATE_EXECUTE_ONLY');
    requireValue(process.env.CANDIDATE_MANIFEST, 'CANDIDATE_MANIFEST_MISSING');
    const candidate = await loadReviewedCandidate({root,sourceRevision,
      manifestName:process.env.CANDIDATE_MANIFEST,runnerTemp:process.env.RUNNER_TEMP,materialize:true});
    console.log(JSON.stringify({result:'candidate_data_verified',...candidateProvenance(candidate)}));
  } catch (error) {
    console.error(JSON.stringify({result:'failed',errorCode:/^[A-Z][A-Z0-9_]{0,47}$/.test(error?.code ?? '') ? error.code : 'verification_failed'}));
    process.exitCode = 1;
  }
}
