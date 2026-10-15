import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGuidedCases,
  GUIDED_FIXTURE_ACTOR_ID,
  GUIDED_FIXTURE_PROJECT_ID,
  GUIDED_MANIFEST_SHA256,
  participantCase,
} from './guided-cases.mjs';

function scenario(id, { group = 'handoff', holdout = false, classification = 'supported_compound_mutation', fixture = {}, expected = {}, stage } = {}) {
  return {
    scenario_id: String(id).padStart(2, '0'),
    group,
    holdout,
    classification,
    plain_language_goal: `Update the invented tasks in case ${id}.`,
    fixture: {
      workspace: 'Invented Project',
      selected_task_count: fixture.selected_task_count ?? 1,
      task_names: fixture.task_names ?? [`Synthetic task ${id}`],
      ...fixture,
    },
    expected_outcome: expected,
    ...(stage ? { validation_stage: stage } : {}),
  };
}

function smallManifest() {
  return {
    scenarios: [
      scenario(1, { fixture: { selected_task_count: 1, task_names: ['Synthetic one'], member_name: 'Maya Chen', member_id: 'member-1', existing_assignees: ['Existing collaborator'] }, expected: { apply_effects: { add_assignee: 'Maya Chen', due_date: '2026-10-20', status: 'doing' } } }),
      scenario(2, { fixture: { selected_task_count: 0, task_names: [], new_title: 'Synthetic follow-up' }, group: 'create', classification: 'supported_single_task_creation', expected: { created_title: 'Synthetic follow-up', apply_effects: { add_assignee: 'synthetic founder', status: 'todo' } } }),
      scenario(3, { fixture: { selected_task_count: 1, task_names: ['Synthetic three'] }, classification: 'expected_refusal' }),
      scenario(4, { fixture: { selected_task_count: 2, task_names: ['Synthetic four a', 'Synthetic four b'], current_project_members: [{ member_id: 'collision-a', full_name: 'Riley Quinn' }, { member_id: 'collision-b', full_name: 'Riley Quinn' }] }, holdout: true, classification: 'expected_prepare_refusal', stage: 'Prepare named-member identity resolution' }),
    ],
  };
}

const buildSmall = (manifest = smallManifest()) => buildGuidedCases(manifest, 'test-manifest-hash', {
  expectedManifestSha256: 'test-manifest-hash', expectedCount: 4, expectedPractice: 3, expectedHeldout: 1,
});

test('derives unique fixture IDs, exact private oracles, and the narrow participant projection', () => {
  const cases = buildSmall();
  assert.equal(cases.length, 4);
  assert.equal(new Set(cases.flatMap(item => item.seed.taskIds)).size, 4);
  assert.equal(new Set(cases.flatMap(item => item.seed.members.map(member => member.userId))).size, 3);
  assert.equal(cases[0].seed.projectId, GUIDED_FIXTURE_PROJECT_ID);
  assert.equal(cases[0].seed.actorId, GUIDED_FIXTURE_ACTOR_ID);
  assert.match(cases[0].seed.fixtureSeed, /case-01$/);
  assert.deepEqual(cases[0].oracle, {
    kind: 'edit', taskIds: ['ping-guide-case-01-task-01'],
    effects: { namedAssignment: { userId: 'ping-guide-case-01-member-member-1', name: 'Maya Chen' }, dueDate: '2026-10-20', statusColumnKey: 'doing' },
  });
  assert.deepEqual(cases[1].oracle, { kind: 'create', taskIds: [], effects: { selfAssignment: 'add', statusColumnKey: 'todo' }, count: 1, title: 'Synthetic follow-up' });
  assert.deepEqual(cases[2].oracle, { kind: 'zero', taskIds: ['ping-guide-case-03-task-01'], effects: {}, expectedStage: 'parse' });
  assert.deepEqual(cases[3].oracle, { kind: 'zero', taskIds: ['ping-guide-case-04-task-01', 'ping-guide-case-04-task-02'], effects: {}, expectedStage: 'prepare' });
  assert.equal(cases[3].seed.currentProjectMembers[0].userId === cases[3].seed.currentProjectMembers[1].userId, false);
  assert.deepEqual(participantCase(cases[0]), {
    id: '01', goal: 'Update the invented tasks in case 1.', taskNames: ['Synthetic one'], modeInfo: 'Update the selected tasks',
  });
  assert.deepEqual(Object.keys(participantCase(cases[3])).sort(), ['goal', 'id', 'modeInfo', 'taskNames']);
  const publicJson = JSON.stringify(cases.map(participantCase));
  for (const forbidden of ['oracle', 'holdout', 'classification', 'expectedStage', 'supported_input_example', 'expected_outcome', 'validation_stage', 'taskIds', 'memberId']) {
    assert.equal(publicJson.includes(forbidden), false, `participant projection leaked ${forbidden}`);
  }
  assert.equal(JSON.stringify(cases.map(participantCase)).includes('Synthetic follow-up'), false, 'created title stays outside taskNames');
});

test('rejects a manifest with a different pinned hash or a wrong practice/held-out split', () => {
  const manifest = smallManifest();
  assert.throws(() => buildGuidedCases(manifest, 'wrong-hash', { expectedCount: 4, expectedPractice: 3, expectedHeldout: 1 }), /hash/);
  assert.throws(() => buildGuidedCases(manifest, 'test-manifest-hash', { expectedManifestSha256: 'test-manifest-hash', expectedCount: 4, expectedPractice: 2, expectedHeldout: 2 }), /2 practice and 2 held-out/);
  assert.equal(GUIDED_MANIFEST_SHA256.length, 64);
});

test('rejects duplicate or reordered IDs, duplicate task names, missing names, and unknown named assignees', () => {
  const duplicateId = smallManifest();
  duplicateId.scenarios[1].scenario_id = '01';
  assert.throws(() => buildSmall(duplicateId), /duplicate scenario id/);

  const reordered = smallManifest();
  [reordered.scenarios[0], reordered.scenarios[1]] = [reordered.scenarios[1], reordered.scenarios[0]];
  assert.throws(() => buildSmall(reordered), /order must be sequential/);

  const duplicateNames = smallManifest();
  duplicateNames.scenarios[1].fixture.task_names = ['Synthetic one'];
  duplicateNames.scenarios[1].fixture.selected_task_count = 1;
  assert.throws(() => buildSmall(duplicateNames), /duplicate synthetic task name/);

  const missingName = smallManifest();
  missingName.scenarios[0].fixture.task_names = [];
  assert.throws(() => buildSmall(missingName), /exactly 1 names/);

  const unknownMember = smallManifest();
  unknownMember.scenarios[0].expected_outcome.apply_effects.add_assignee = 'Unknown Member';
  assert.throws(() => buildSmall(unknownMember), /not a seeded Project member/);
});

test('supports an empty-task create case without inventing selected task IDs', () => {
  const createCase = buildSmall()[1];
  assert.deepEqual(createCase.seed.taskIds, []);
  assert.equal(createCase.seed.selectedTaskCount, 0);
  assert.deepEqual(createCase.oracle.taskIds, []);
});

test('normalizes negative scenarios 97–100 to the parser or Prepare stage without guessing answers', () => {
  const scenarios = [
    scenario(1, { group: 'negative_safety', classification: 'expected_prepare_refusal', fixture: { selected_task_count: 2, task_names: ['Synthetic identity a', 'Synthetic identity b'] }, stage: 'Prepare named-member identity resolution' }),
    scenario(2, { group: 'negative_safety', classification: 'expected_scope_refusal', fixture: { selected_task_count: 3, task_names: ['Synthetic milestone a', 'Synthetic milestone b', 'Synthetic milestone c'] }, stage: 'Prepare captured-selection eligibility' }),
    scenario(3, { group: 'negative_safety', classification: 'expected_scope_refusal', fixture: { selected_task_count: 11, task_names: Array.from({ length: 11 }, (_, index) => `Synthetic max task ${index + 1}`) }, stage: 'Prepare captured-selection eligibility' }),
    scenario(4, { group: 'negative_safety', classification: 'expected_refusal', fixture: { selected_task_count: 2, task_names: ['Synthetic punctuation a', 'Synthetic punctuation b'] }, holdout: true }),
  ];
  const manifest = { scenarios };
  const cases = buildGuidedCases(manifest, 'test-manifest-hash', {
    expectedManifestSha256: 'test-manifest-hash', expectedCount: 4, expectedPractice: 3, expectedHeldout: 1,
  });
  assert.deepEqual(cases.map(item => item.oracle.expectedStage), ['prepare', 'prepare', 'prepare', 'parse']);
  assert.equal(cases[0].validationStage, 'Prepare named-member identity resolution');
  assert.equal(cases[1].parserOutcome, null);
});
