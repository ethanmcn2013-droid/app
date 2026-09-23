/* eslint-disable @typescript-eslint/no-require-imports -- Actual room actions with disposable SQLite. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { recipientFixture } = require('./fixture.cjs');

async function fixture() {
  const f = await recipientFixture();
  await f.client.executeMultiple(`
    UPDATE users SET name='Owner A' WHERE id='recipient';
    UPDATE users SET name='Owner B' WHERE id='creator';
    UPDATE workspaces SET primary_date='2027-01-21',primary_date_label='Only B date' WHERE id='project-b';
    INSERT INTO meta(key,value) VALUES ('room:project-a:purpose','Only A purpose'),('room:project-b:purpose','Only B purpose');
  `);
  return f;
}
async function purposes(f) {
  return (await f.client.execute("SELECT key,value FROM meta WHERE key LIKE 'room:%:purpose' ORDER BY key")).rows.map(r => [r.key,r.value]);
}

test('actual room read and write use explicit B with A active under both flag states', async () => {
  const f = await fixture();
  try {
    const room = f.load('src/server/actions/room');
    for (const enabled of [true,false]) {
      f.state.v3 = enabled;
      const brief = await room.getRoomBriefData('project-b');
      assert.equal(brief.ownerName,'Owner B');
      assert.match(brief.dateWindow,/Only B date/);
      assert.doesNotMatch(JSON.stringify(brief),/Only A|Owner A/);
      await room.setWorkspacePurposeAction('project-b','  B replacement  ');
      assert.deepEqual(await purposes(f),[['room:project-a:purpose','Only A purpose'],['room:project-b:purpose','B replacement']]);
      assert.equal(f.state.cookieWrites.length,0);
    }
    const source = f.sourceText('src/components/app/tasks-runtime-shell.tsx');
    assert.match(source,/getRoomBriefData\(workspaceId\)/);
  } finally { f.close(); }
});

test('missing/malformed/foreign/missing-row project never falls back to A for either action', async () => {
  const f = await fixture();
  try {
    const room = f.load('src/server/actions/room'), before = await purposes(f);
    for (const enabled of [true,false]) {
      f.state.v3 = enabled;
      for (const candidate of [undefined,null,'',' bad ',{},42,['project-b'],'project-c','missing']) {
        await assert.rejects(room.getRoomBriefData(candidate),{message:'That project isn’t available.'});
        await assert.rejects(room.setWorkspacePurposeAction(candidate,'Wrong write'),{message:'That project isn’t available.'});
        assert.deepEqual(await purposes(f),before);
      }
    }
    assert.equal(f.state.cookieWrites.length,0);
  } finally { f.close(); }
});

test('both actions reauthorize the current account and removal rather than trusting earlier B proof', async () => {
  const f = await fixture();
  try {
    const room = f.load('src/server/actions/room'), before = await purposes(f);
    await room.getRoomBriefData('project-b');
    f.state.actor='outsider';
    await assert.rejects(room.getRoomBriefData('project-b'),/isn’t available/);
    await assert.rejects(room.setWorkspacePurposeAction('project-b','Wrong account'),/isn’t available/);
    f.state.actor='recipient';
    await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='project-b' AND user_id='recipient'");
    await assert.rejects(room.getRoomBriefData('project-b'),/isn’t available/);
    await assert.rejects(room.setWorkspacePurposeAction('project-b','Removed'),/isn’t available/);
    assert.deepEqual(await purposes(f),before);
  } finally { f.close(); }
});

test('active member task capability and 280 trim/clear are preserved', async () => {
  const f = await fixture();
  try {
    const room = f.load('src/server/actions/room');
    assert.deepEqual(await room.setWorkspacePurposeAction('project-b','  '+ 'x'.repeat(300) +'  '),{ok:true});
    assert.equal((await room.getRoomBriefData('project-b')).purpose,'x'.repeat(280));
    await room.setWorkspacePurposeAction('project-b','   ');
    assert.equal((await room.getRoomBriefData('project-b')).purpose,null);
    assert.equal((await purposes(f))[0][1],'Only A purpose');
  } finally { f.close(); }
});

// The previous test pinned a successful clear AFTER archive. ADR 0001 §5
// requires read-only Project content instead. Exercise all existing editor
// roles under both flags; fixture SQL supplies archive/restore lifecycle state,
// while the room action, membership proof, capability model and writes are real.
for (const role of ['member','co-owner','primary-owner']) {
  test(`archived purpose lifecycle refuses replacement/clear/create for ${role}, then permits edits after restore`, async () => {
    const f = await fixture();
    try {
      if (role === 'primary-owner') f.state.actor = 'creator';
      if (role === 'co-owner') await f.client.execute("UPDATE workspace_members SET role='owner' WHERE workspace_id='project-b' AND user_id='recipient'");
      const revalidations = [];
      f.boundary['next/cache'].revalidatePath = (...args) => revalidations.push(args);
      const room = f.load('src/server/actions/room');
      for (const enabled of [true,false]) {
        f.state.v3 = enabled;
        await room.setWorkspacePurposeAction('project-b','  Active B purpose  ');
        assert.equal((await room.getRoomBriefData('project-b')).purpose,'Active B purpose');
        await f.client.execute("UPDATE workspaces SET archived_at=1 WHERE id='project-b'");
        const before = (await f.client.execute("SELECT key,value,updated_at FROM meta ORDER BY key")).rows;
        const beforeRevalidations = revalidations.length;
        for (const purpose of ['Archived replacement','   ']) {
          await assert.rejects(room.setWorkspacePurposeAction('project-b',purpose),{message:'That project isn’t available.'});
          assert.deepEqual((await f.client.execute("SELECT key,value,updated_at FROM meta ORDER BY key")).rows,before);
        }
        assert.equal((await room.getRoomBriefData('project-b')).purpose,'Active B purpose','archive retains readable content');
        // No existing purpose row must not turn the same lifecycle refusal into
        // a permitted INSERT. Remove only test setup data to reach this branch.
        await f.client.execute("DELETE FROM meta WHERE key='room:project-b:purpose'");
        const absent = await purposes(f);
        await assert.rejects(room.setWorkspacePurposeAction('project-b','First archived purpose'),{message:'That project isn’t available.'});
        assert.deepEqual(await purposes(f),absent);
        assert.equal((await room.getRoomBriefData('project-b')).purpose,null);
        assert.equal(revalidations.length,beforeRevalidations,'refusal has no revalidation side effect');
        await f.client.execute("UPDATE workspaces SET archived_at=NULL WHERE id='project-b'");
        assert.deepEqual(await room.setWorkspacePurposeAction('project-b','  Restored B purpose  '),{ok:true});
        assert.deepEqual(await purposes(f),[['room:project-a:purpose','Only A purpose'],['room:project-b:purpose','Restored B purpose']]);
        await room.setWorkspacePurposeAction('project-b','   ');
        assert.equal((await room.getRoomBriefData('project-b')).purpose,null);
        assert.equal(f.state.cookieWrites.length,0);
      }
    } finally { f.close(); }
  });
}

test('demo read and no-op write require no identity or database, even with absent candidates', async () => {
  const f = await fixture();
  try {
    f.state.demo=true;
    f.overrides.set('src/server/db', {db:new Proxy({}, {get(){throw Error('Demo reached database');}})});
    f.overrides.set('src/server/actions/project-authz',{authorizeProjectCandidate(){throw Error('Demo reached authorization');}});
    const room = f.load('src/server/actions/room');
    const result = await room.getRoomBriefData(undefined);
    assert.equal(result.calendarFrame.source,'review');
    assert.deepEqual(await room.setWorkspacePurposeAction(undefined,undefined),{ok:true});
    assert.equal(f.state.authCalls,0);assert.equal(f.state.cookieWrites.length,0);
  } finally { f.close(); }
});
