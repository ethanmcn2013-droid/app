import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';
import {createClient} from '@libsql/client';
import {defaultRoot, canonicalFileSha256, loadAndValidateLedger, sha256} from './migration-ledger.mjs';
import {migrationStatus, runMigrations} from './migrate.mjs';
import {candidateProvenance, loadReviewedCandidate, readRegularGitBlob, requireCandidatePullRequest,
  validateCandidateContext, validateCandidateManifest} from './prepare-reviewed-candidate.mjs';

const now = Date.parse('2026-10-09T12:00:00Z');
const repository = 'ethanmcn2013-droid/app';
const json = value => JSON.stringify(value,null,2) + '\n';
const baseContext = loadAndValidateLedger();

function fixture({failSecond = false} = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'reviewed-candidate-'));
  const root = path.join(temp,'trusted');
  const runnerTemp = path.join(temp,'private');
  fs.mkdirSync(root); fs.mkdirSync(runnerTemp);
  const files = new Set(['.gitattributes','drizzle/migration-ledger.json','drizzle/meta/_journal.json',
    ...baseContext.entries.flatMap(entry => [entry.file,entry.snapshot,
      path.relative(defaultRoot,entry.receipt.path).split(path.sep).join('/')].filter(Boolean))]);
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
    fs.copyFileSync(path.join(defaultRoot,file),path.join(root,file));
  }
  function git(args) { return execFileSync('git',['-C',root,'-c',`core.hooksPath=${path.join(temp,'hooks')}`,
    '-c','user.name=Synthetic reviewer','-c','user.email=synthetic@example.invalid',...args],
  {encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); }
  git(['init','--initial-branch=main']); git(['add','.']); git(['commit','-m','synthetic historical prefix']);
  const baseSha = git(['rev-parse','HEAD']);
  const ledger = JSON.parse(fs.readFileSync(path.join(root,'drizzle/migration-ledger.json'),'utf8'));
  const journal = JSON.parse(fs.readFileSync(path.join(root,'drizzle/meta/_journal.json'),'utf8'));
  const appended = [];
  for (let offset = 1; offset <= 2; offset++) {
    const ordinal = ledger.entries.length;
    const id = `${String(ordinal).padStart(4,'0')}_candidate_probe_${offset}`;
    const file = `drizzle/${id}.sql`;
    const receipt = `drizzle/receipts/candidate-probe-${offset}.json`;
    const sql = `CREATE TABLE candidate_probe_${offset} (id integer PRIMARY KEY);\n`;
    fs.writeFileSync(path.join(root,file),sql);
    const proofs = [{id:`probe-${offset}`,sql:`SELECT COUNT(*) AS value FROM sqlite_schema WHERE name='candidate_probe_${offset}'`,
      expected:failSecond && offset === 2 ? 999 : 1}];
    fs.writeFileSync(path.join(root,receipt),json({schemaVersion:'tasks-migration-receipt/1',id:`synthetic-probe-${offset}`,
      authorizedBy:'Synthetic fixture only',reviewedBy:'Synthetic fixture only',authorizationSource:'Synthetic fixture only',
      migrations:[{id,sha256:sha256(sql),reviewedAt:'2026-10-09T11:00:00Z',risk:'Synthetic fixture only',
        rollbackPlan:'Discard synthetic fixture',postconditions:['Synthetic table exists'],proofs}]}));
    const entry = {ordinal,id,file,when:ledger.entries.at(-1).when + 1,sha256:sha256(sql),policy:'forward',receipt,
      receiptSha256:canonicalFileSha256(path.join(root,receipt))};
    ledger.entries.push(entry); journal.entries.push({idx:ordinal,version:'6',when:entry.when,tag:id,breakpoints:true});
    appended.push(entry);
  }
  fs.writeFileSync(path.join(root,'drizzle/migration-ledger.json'),json(ledger));
  fs.writeFileSync(path.join(root,'drizzle/meta/_journal.json'),json(journal));
  // Deliberately hostile code outside the data allowlist must never execute or
  // enter the private data root. It is ordinary Git data in this test.
  fs.writeFileSync(path.join(root,'candidate-payload.mjs'),"throw new Error('candidate code executed');\n");
  git(['add','.']); git(['commit','-m','synthetic candidate with inert hostile payload']);
  const candidateSha = git(['rev-parse','HEAD']);
  const changed = ['drizzle/migration-ledger.json','drizzle/meta/_journal.json',...appended.flatMap(entry => [entry.file,entry.receipt])];
  const manifest = {schemaVersion:'tasks-reviewed-migration-candidate/1',id:'synthetic-candidate',repository,pullRequestNumber:123,
    candidateSourceRevision:candidateSha,candidateBaseRevision:baseSha,baseLedgerSha256:baseContext.ledgerSha256,
    candidateLedgerSha256:canonicalFileSha256(path.join(root,'drizzle/migration-ledger.json')),
    expectedLastMigrationId:baseContext.entries.at(-1).id,
    targetUrlSha256:'248b09a9d4560a8b66dd2d910e5d95c97b473eda4b656577d030592105a72eb0',
    databaseIdentitySha256:'a'.repeat(64),notBefore:'2026-10-09T11:00:00Z',expiresAt:'2026-10-10T11:00:00Z',
    authorization:{source:'Synthetic fixture only',authorizedBy:'Synthetic fixture only'},
    review:{verdict:'approved',sourceRevision:candidateSha,reviewedBy:'Synthetic fixture only',
      reference:'Synthetic fixture only',reviewedAt:'2026-10-09T11:00:00Z'},
    migrations:appended.map(entry => ({id:entry.id,sha256:entry.sha256,receiptSha256:entry.receiptSha256})),
    files:changed.map(file => ({path:file,sha256:canonicalFileSha256(path.join(root,file))}))};
  // In-memory immutable object reader keeps the behavioral suite cheap on
  // Windows. The separate mode test exercises the real Git blob reader.
  const candidateObjects = new Map([...files,...changed].map(file => [file,fs.readFileSync(path.join(root,file))]));
  git(['switch','--detach',baseSha]);
  fs.mkdirSync(path.join(root,'docs/ops/migration-candidates'),{recursive:true});
  fs.writeFileSync(path.join(root,'docs/ops/migration-candidates/synthetic.json'),json(manifest));
  git(['add','.']); git(['commit','-m','synthetic trusted main manifest']);
  const sourceRevision = git(['rev-parse','HEAD']);
  const mainObjects = new Map([...files,'docs/ops/migration-candidates/synthetic.json']
    .map(file => [file,fs.readFileSync(path.join(root,file))]));
  // Strict-main receiving: merge the approved immutable data B with newer
  // trusted main A that contains its manifest. Approval stays bound to B.
  git(['merge','--no-ff','--no-commit',candidateSha]);
  git(['rm','--force','candidate-payload.mjs']);
  git(['commit','-m','synthetic receiving merge of main and reviewed data']);
  const receivingSha = git(['rev-parse','HEAD']);
  git(['switch','--detach',sourceRevision]);
  git(['remote','add','origin',`https://github.com/${repository}.git`]);
  const pr = {number:123,state:'open',base:{ref:'main',repo:{full_name:repository}},
    head:{sha:receivingSha,repo:{full_name:repository}}};
  const options = {root,sourceRevision,manifestName:'synthetic.json',runnerTemp,now,
    getPullRequest:async () => pr,fetchRevision:() => {},readMainRevision:() => sourceRevision,
    readReceivingRevision:() => pr.head.sha,
    readBlob:(_root,revision,file) => {
      const bytes = ([candidateSha,receivingSha].includes(revision) ? candidateObjects : mainObjects).get(file);
      assert.ok(bytes,`synthetic immutable blob missing: ${file}`);
      return bytes;
    }};
  return {temp,root,runnerTemp,manifest,pr,options,git,
    clean:() => fs.rmSync(temp,{recursive:true,force:true})};
}

test('immutable candidate imports only reviewed data; trusted runner applies and reruns', async () => {
  const f = fixture();
  const client = createClient({url:':memory:'});
  try {
    const baseline = await runMigrations({client,context:loadAndValidateLedger({root:f.root})});
    assert.equal(baseline.applied.at(-1),baseContext.entries.at(-1).id);
    const c = await loadReviewedCandidate({...f.options,materialize:true});
    assert.equal(fs.existsSync(path.join(c.context.root,'candidate-payload.mjs')),false);
    assert.equal(candidateProvenance(c).candidateSourceRevision,f.manifest.candidateSourceRevision);
    assert.equal(candidateProvenance(c).receivingSourceRevision,f.pr.head.sha);
    assert.notEqual(f.pr.head.sha,f.manifest.candidateSourceRevision);
    const result = await runMigrations({client,context:c.context,releaseSha:f.manifest.candidateSourceRevision});
    assert.deepEqual(result.applied,f.manifest.migrations.map(entry => entry.id));
    const rows = await client.execute('SELECT release_sha FROM signal_schema_migrations ORDER BY applied_at,id');
    assert.equal(rows.rows.at(-1).release_sha,f.manifest.candidateSourceRevision);
    assert.equal((await migrationStatus({client,context:c.context})).state,'current');
    assert.equal((await runMigrations({client,context:c.context})).status,'no-op');
    await loadReviewedCandidate(f.options);
    // Old main cannot falsely claim current once the candidate has applied.
    await assert.rejects(migrationStatus({client,context:c.base}),/more rows than the source ledger/);
  } finally { client.close(); f.clean(); }
});

test('a failed second migration preserves truthful first commit and rejects complete receiving', async () => {
  const f = fixture({failSecond:true});
  const client = createClient({url:':memory:'});
  try {
    await runMigrations({client,context:loadAndValidateLedger({root:f.root})});
    const c = await loadReviewedCandidate({...f.options,materialize:true});
    await assert.rejects(runMigrations({client,context:c.context}),/failed atomically/);
    const status = await migrationStatus({client,context:c.context});
    assert.equal(status.state,'pending');
    assert.deepEqual(status.pending,[f.manifest.migrations[1].id]);
    const table = await client.execute("SELECT COUNT(*) AS value FROM sqlite_schema WHERE name='candidate_probe_2'");
    assert.equal(Number(table.rows[0].value),0);
    await assert.rejects(migrationStatus({client,context:c.base}),/more rows than the source ledger/);
  } finally { client.close(); f.clean(); }
});

test('expiry, missing review, wrong repository/target/base/hash/path fail closed', () => {
  const f = fixture();
  try {
    const base = loadAndValidateLedger({root:f.root});
    const cases = [
      [{expiresAt:'2026-10-09T11:59:59Z'},/EXPIRED/],
      [{expiresAt:'2026-10-11T11:00:00Z'},/EXPIRED/],
      [{notBefore:'2026-10-09T13:00:00Z'},/EXPIRED/],
      [{review:{...f.manifest.review,verdict:'pending'}},/REVIEW/],
      [{repository:'attacker/app'},/REPOSITORY/],
      [{targetUrlSha256:'b'.repeat(64)},/TARGET/],
      [{baseLedgerSha256:'b'.repeat(64)},/BASE/],
      [{candidateSourceRevision:'main'},/REVISION/],
      [{files:[...f.manifest.files,{path:'drizzle/../payload.mjs',sha256:'b'.repeat(64)}]},/PATH/],
      [{files:[...f.manifest.files,{path:'scripts/payload.mjs',sha256:'b'.repeat(64)}]},/PATH/],
    ];
    for (const [change,error] of cases) assert.throws(() => validateCandidateManifest({...f.manifest,...change},base,now),error);
    assert.throws(() => requireCandidatePullRequest({...f.pr,head:{...f.pr.head,sha:'main'}},f.manifest),/PR_CHANGED/);
    assert.throws(() => requireCandidatePullRequest({...f.pr,head:{...f.pr.head,repo:{full_name:'attacker/app'}}},f.manifest),/PR_CHANGED/);
  } finally { f.clean(); }
});

test('PR movement or invalid basename refuses import before fetch or materialization', async () => {
  const f = fixture(); let fetched = 0;
  try {
    const options = {...f.options,materialize:true,fetchRevision:() => { fetched++; }};
    await assert.rejects(loadReviewedCandidate({...options,manifestName:'../synthetic.json'}),/PATH/);
    await assert.rejects(loadReviewedCandidate({...options,
      getPullRequest:async () => ({...f.pr,state:'closed'})}),/PR_CHANGED/);
    assert.equal(fetched,0);
    assert.equal(fs.existsSync(path.join(f.runnerTemp,'signal-reviewed-migration-candidate')),false);
    let lookedUp = 0;
    f.git(['remote','set-url','origin','https://github.com/attacker/app.git']);
    await assert.rejects(loadReviewedCandidate({...options,
      getPullRequest:async () => { lookedUp++; return f.pr; }}),/REMOTE_INVALID/);
    assert.equal(lookedUp,0);
  } finally { f.clean(); }
});

test('modified import, extra file, historical proof weakening, or different pending set is refused', async () => {
  const f = fixture();
  try {
    const c = await loadReviewedCandidate({...f.options,materialize:true});
    const sqlPath = path.join(c.context.root,f.manifest.files.find(entry => entry.path.endsWith('.sql')).path);
    fs.appendFileSync(sqlPath,'\n-- tamper\n');
    await assert.rejects(loadReviewedCandidate(f.options),/BLOB_HASH_CHANGED/);
    fs.writeFileSync(sqlPath,readRegularGitBlob(f.root,f.manifest.candidateSourceRevision,
      f.manifest.files.find(entry => entry.path.endsWith('.sql')).path));
    const extra = path.join(c.context.root,'unreviewed.json'); fs.writeFileSync(extra,'{}');
    await assert.rejects(loadReviewedCandidate(f.options),/FILE_SET_CHANGED/); fs.unlinkSync(extra);
    await assert.rejects(loadReviewedCandidate({...f.options,now:Date.parse(f.manifest.expiresAt)}),/EXPIRED/);
    const altered = {...c.context,ledger:structuredClone(c.context.ledger)};
    altered.ledger.entries[0].policy = 'forward';
    assert.throws(() => validateCandidateContext(c.base,altered,f.manifest),/HISTORY_CHANGED/);
    assert.throws(() => validateCandidateContext(c.base,c.context,
      {...f.manifest,migrations:f.manifest.migrations.slice(0,1)}),/PENDING_CHANGED/);
  } finally { f.clean(); }
});

test('manifest-approved journal changes cannot alter any historical header or entry field', async () => {
  const f = fixture();
  try {
    const c = await loadReviewedCandidate({...f.options,materialize:true});
    const journalPath = path.resolve(c.context.root,c.context.ledger.journal);
    const original = JSON.parse(fs.readFileSync(journalPath,'utf8'));
    for (const alter of [
      journal => { journal.entries[0].version = 'changed'; },
      journal => { journal.entries[0].extra = {unreviewed:true}; },
      journal => { journal.extra = {unreviewed:true}; },
    ]) {
      const journal = structuredClone(original); alter(journal);
      fs.writeFileSync(journalPath,json(journal));
      // General parity validation accepts these fields. Even approval of the
      // resulting journal hash must not authorize rewriting the old prefix.
      const candidate = loadAndValidateLedger({root:c.context.root});
      const manifest = {...f.manifest,files:f.manifest.files.map(entry =>
        entry.path === c.context.ledger.journal ? {...entry,sha256:canonicalFileSha256(journalPath)} : entry)};
      assert.throws(() => validateCandidateContext(c.base,candidate,manifest),/JOURNAL_HISTORY_CHANGED/);
    }
    fs.writeFileSync(journalPath,json(original));
    assert.doesNotThrow(() => validateCandidateContext(c.base,loadAndValidateLedger({root:c.context.root}),f.manifest));
  } finally { f.clean(); }
});

test('Git reader refuses executable blobs, symlinks, missing files and traversal', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.root,'executable'),'inert');
    f.git(['add','executable']); f.git(['update-index','--chmod=+x','executable']);
    const blob = f.git(['hash-object','-w','--stdin']);
    // Empty symlink target as object is enough to test mode rejection, without
    // needing Windows symlink privileges or following a real filesystem link.
    f.git(['update-index','--add','--cacheinfo',`120000,${blob},symlink`]);
    f.git(['update-index','--add','--cacheinfo',`160000,${f.manifest.candidateBaseRevision},submodule`]);
    f.git(['commit','-m','synthetic invalid modes']);
    const sha = f.git(['rev-parse','HEAD']);
    assert.throws(() => readRegularGitBlob(f.root,sha,'executable'),/REGULAR_BLOB/);
    assert.throws(() => readRegularGitBlob(f.root,sha,'symlink'),/REGULAR_BLOB/);
    assert.throws(() => readRegularGitBlob(f.root,sha,'submodule'),/REGULAR_BLOB/);
    assert.throws(() => readRegularGitBlob(f.root,sha,'missing'),/REGULAR_BLOB/);
    assert.throws(() => readRegularGitBlob(f.root,sha,'../outside'),/PATH/);
  } finally { f.clean(); }
});

test('native Git import validates strict-main receiving and refuses changed heads, ancestry, SQL or extra code', async () => {
  const f = fixture();
  try {
    const native = {...f.options,readBlob:readRegularGitBlob};
    const accepted = await loadReviewedCandidate({...native,materialize:true});
    assert.equal(accepted.receivingSourceRevision,f.pr.head.sha);
    f.pr.head.sha = f.manifest.candidateSourceRevision;
    await assert.rejects(loadReviewedCandidate(native),/PR_CHANGED/);
    f.pr.head.sha = accepted.receivingSourceRevision;
    await assert.rejects(loadReviewedCandidate({...native,readMainRevision:() => 'f'.repeat(40)}),/MAIN_CHANGED/);
    const freshOptions = () => ({...native,materialize:true,
      runnerTemp:fs.mkdtempSync(path.join(f.temp,'receiving-check-'))});
    for (const head of [f.options.sourceRevision,f.manifest.candidateSourceRevision,'d'.repeat(40)]) {
      f.pr.head.sha = head;
      await assert.rejects(loadReviewedCandidate(freshOptions()),/RECEIVING_ANCESTRY_INVALID/);
    }
    f.pr.head.sha = accepted.receivingSourceRevision;
    f.git(['switch','--detach',f.pr.head.sha]);
    const sql = f.manifest.files.find(entry => entry.path.endsWith('.sql')).path;
    fs.appendFileSync(path.join(f.root,sql),'\n-- changed receiving SQL\n');
    f.git(['add',sql]); f.git(['commit','-m','synthetic forbidden SQL change']);
    f.pr.head.sha = f.git(['rev-parse','HEAD']);
    f.git(['switch','--detach',f.options.sourceRevision]);
    await assert.rejects(loadReviewedCandidate(freshOptions()),/RECEIVING_HASH_CHANGED/);
    f.git(['switch','--detach',f.pr.head.sha]);
    fs.writeFileSync(path.join(f.root,'extra-executable.mjs'),"throw new Error('must not execute');\n");
    f.git(['add','extra-executable.mjs']); f.git(['commit','-m','synthetic forbidden non-data change']);
    f.pr.head.sha = f.git(['rev-parse','HEAD']);
    f.git(['switch','--detach',f.options.sourceRevision]);
    await assert.rejects(loadReviewedCandidate(freshOptions()),/RECEIVING_FILE_SET_CHANGED/);
  } finally { f.clean(); }
});

test('native Git origin accepts canonical checkout HTTPS with or without dotgit and rejects every other remote before lookup', async () => {
  const f = fixture();
  try {
    const canonical = `https://github.com/${repository}`;
    for (const remote of [canonical,`${canonical}.git`]) {
      f.git(['remote','set-url','origin',remote]);
      const candidate = await loadReviewedCandidate({...f.options,materialize:true,readBlob:readRegularGitBlob,
        runnerTemp:fs.mkdtempSync(path.join(f.temp,'canonical-origin-'))});
      assert.equal(candidate.receivingSourceRevision,f.pr.head.sha);
      assert.equal(candidate.context.ledgerSha256,f.manifest.candidateLedgerSha256);
      assert.equal(fs.existsSync(path.join(candidate.context.root,'candidate-payload.mjs')),false);
    }
    const forbidden = [
      'https://github.com/attacker/app',`https://github.com/${repository}-other.git`,
      `https://github.com.evil.invalid/${repository}`,`https://www.github.com/${repository}`,
      `https://synthetic-user:synthetic-password@github.com/${repository}`,
      `https://synthetic-user@github.com/${repository}`,`https://github.com@evil.invalid/${repository}`,
      `http://github.com/${repository}`,`ssh://git@github.com/${repository}.git`,
      `git@github.com:${repository}.git`,`git://github.com/${repository}.git`,
      'file:///synthetic/app','../synthetic/app',
      `${canonical}?synthetic=1`,`${canonical}.git?synthetic=1`,`${canonical}#synthetic`,`${canonical}.git#synthetic`,
      `${canonical}/`,`${canonical}.git/`,`${canonical}.git.git`,`${canonical}.GIT`,
      `https://github.com:443/${repository}`,`https://GITHUB.COM/${repository}`,
      'https://github.com/ethanmcn2013-droid/%61pp',`https://github.com//${repository}`,
    ];
    let lookedUp = 0; let fetched = 0;
    const options = {...f.options,materialize:true,readBlob:readRegularGitBlob,
      runnerTemp:fs.mkdtempSync(path.join(f.temp,'forbidden-origin-')),
      getPullRequest:async () => { lookedUp++; return f.pr; },fetchRevision:() => { fetched++; }};
    for (const remote of forbidden) {
      f.git(['remote','set-url','origin',remote]);
      await assert.rejects(loadReviewedCandidate(options),/CANDIDATE_REMOTE_INVALID/);
    }
    assert.equal(lookedUp,0); assert.equal(fetched,0);
    assert.equal(fs.existsSync(path.join(options.runnerTemp,'signal-reviewed-migration-candidate')),false);
    assert.equal(fs.existsSync(path.join(options.runnerTemp,'signal-reviewed-migration-selection.json')),false);
  } finally { f.clean(); }
});
