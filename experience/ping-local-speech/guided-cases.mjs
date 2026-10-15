import { createHash } from 'node:crypto';

export const GUIDED_MANIFEST_SHA256 = 'c10012aa73205c8319af620e1e8af0f356b32669d139f4656386b85c088adf23';
export const GUIDED_FIXTURE_PROJECT_ID = 'synthetic-ping-project';
export const GUIDED_FIXTURE_ACTOR_ID = 'alice';
export const GUIDED_FIXTURE_CLERK_USER_ID = 'clerk_alice';

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const text = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be non-empty text`);
  return value.trim();
};
const positiveInteger = (value, label, { allowZero = false } = {}) => {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) throw new Error(`${label} must be a ${allowZero ? 'non-negative' : 'positive'} integer`);
  return value;
};
const safeId = (value, label) => {
  const id = text(value, label);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`${label} has an unsupported format`);
  return id;
};

export function sha256ManifestBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function checkedNames(value, expectedCount, label) {
  if (!Array.isArray(value) || value.length !== expectedCount) throw new Error(`${label} must contain exactly ${expectedCount} names`);
  return value.map((name, index) => text(name, `${label}[${index}]`));
}

function deriveModeInfo(scenario) {
  if (scenario.group === 'create') return 'Create a new task';
  if (scenario.group === 'negative_safety') return 'Check how Ping handles this request';
  return 'Update the selected tasks';
}

function buildMembers(scenario, caseId) {
  const members = scenario.fixture.current_project_members ?? [];
  const seeded = [];
  for (const [index, member] of members.entries()) {
    const sourceId = safeId(member.member_id, `scenario ${caseId} member ${index + 1} id`);
    const userId = `ping-guide-case-${caseId}-member-${sourceId}`;
    const fullName = text(member.full_name, `scenario ${caseId} member ${index + 1} name`);
    // Distinct IDs with the same full name are a deliberate collision fixture.
    seeded.push({ lookupKey: fullName.toLocaleLowerCase('en'), userId, name: fullName });
  }

  if (scenario.fixture.member_name && scenario.fixture.member_id) {
    const fullName = text(scenario.fixture.member_name, `scenario ${caseId} member name`);
    const sourceId = safeId(scenario.fixture.member_id, `scenario ${caseId} member id`);
    const userId = `ping-guide-case-${caseId}-member-${sourceId}`;
    const key = fullName.toLocaleLowerCase('en');
    if (seeded.some(member => member.lookupKey === key && member.userId !== userId)) throw new Error(`scenario ${caseId} contains an undeclared member-name collision`);
    if (!seeded.some(member => member.lookupKey === key && member.userId === userId)) seeded.push({ lookupKey: key, userId, name: fullName });
  }
  return seeded;
}

function buildOracle(scenario, taskIds, members) {
  const classification = scenario.classification;
  if (classification.startsWith('expected_')) {
    const stage = scenario.validation_stage ?? (classification === 'expected_prepare_refusal' ? 'Prepare' : 'Parse');
    return { kind: 'zero', taskIds, effects: {}, expectedStage: stage };
  }

  const effects = {};
  const apply = scenario.expected_outcome?.apply_effects ?? {};
  if (own(apply, 'add_assignee')) {
    const assignee = text(apply.add_assignee, `scenario ${scenario.scenario_id} assignee`);
    if (assignee === 'synthetic founder') {
      effects.selfAssignment = 'add';
    } else {
      const userId = members.find(member => member.lookupKey === assignee.toLocaleLowerCase('en'))?.userId;
      if (!userId) throw new Error(`scenario ${scenario.scenario_id} named assignee is not a seeded Project member`);
      effects.namedAssignment = { userId, name: assignee };
    }
  }
  if (own(apply, 'due_date')) effects.dueDate = apply.due_date == null || apply.due_date === '' ? null : text(apply.due_date, `scenario ${scenario.scenario_id} due date`);
  if (own(apply, 'status')) effects.statusColumnKey = text(apply.status, `scenario ${scenario.scenario_id} status`);

  if (classification === 'supported_single_task_creation') {
    return {
      kind: 'create', taskIds: [], effects, count: 1,
      title: text(scenario.expected_outcome.created_title ?? scenario.fixture.new_title, `scenario ${scenario.scenario_id} created title`),
    };
  }
  if (!['supported_compound_mutation', 'supported_replan_mutation', 'supported_status_mutation'].includes(classification)) {
    throw new Error(`scenario ${scenario.scenario_id} has an unsupported classification`);
  }
  if (!Object.keys(effects).length) throw new Error(`scenario ${scenario.scenario_id} edit oracle is empty`);
  return { kind: 'edit', taskIds, effects };
}

/**
 * Validate the private session plan and derive an immutable server-only fixture
 * record plus its deliberately narrow participant projection. Never serialize
 * the returned server records to the guide; call participantCase first.
 */
export function buildGuidedCases(manifest, manifestSha256 = GUIDED_MANIFEST_SHA256, options = {}) {
  const expectedHash = options.expectedManifestSha256 ?? GUIDED_MANIFEST_SHA256;
  if (manifestSha256 !== expectedHash) throw new Error('Guided scenario manifest hash does not match the pinned plan');
  const expectedCount = options.expectedCount ?? 100;
  const expectedPractice = options.expectedPractice ?? 60;
  const expectedHeldout = options.expectedHeldout ?? 40;
  positiveInteger(expectedCount, 'expectedCount');
  positiveInteger(expectedPractice, 'expectedPractice', { allowZero: true });
  positiveInteger(expectedHeldout, 'expectedHeldout', { allowZero: true });
  if (expectedPractice + expectedHeldout !== expectedCount) throw new Error('Practice and held-out counts must total the expected case count');
  if (!manifest || !Array.isArray(manifest.scenarios) || manifest.scenarios.length !== expectedCount) throw new Error(`Guided manifest must contain exactly ${expectedCount} scenarios`);

  const seenIds = new Set();
  const seenTaskNames = new Set();
  const seenMemberIds = new Set();
  const cases = manifest.scenarios.map((scenario, index) => {
    if (!scenario || typeof scenario !== 'object' || !scenario.fixture || typeof scenario.fixture !== 'object') throw new Error(`scenario ${index + 1} must be an object with a fixture`);
    const caseId = safeId(scenario.scenario_id, `scenario ${index + 1} id`);
    if (seenIds.has(caseId)) throw new Error(`duplicate scenario id ${caseId}`);
    seenIds.add(caseId);
    const expectedId = String(index + 1).padStart(2, '0');
    if (caseId !== expectedId) throw new Error(`scenario order must be sequential from ${expectedId}`);
    if (!['practice', 'heldout'].includes(options.modeForScenario?.(scenario) ?? (scenario.holdout ? 'heldout' : 'practice'))) throw new Error(`scenario ${caseId} has an invalid evaluation mode`);

    const goal = text(scenario.plain_language_goal, `scenario ${caseId} goal`);
    if (typeof scenario.holdout !== 'boolean') throw new Error(`scenario ${caseId} must declare practice/held-out membership`);
    if (!['handoff', 'self_pickup', 'review_completion', 'replan', 'create', 'negative_safety'].includes(scenario.group)) throw new Error(`scenario ${caseId} has an unsupported group`);
    if (!['supported_compound_mutation', 'supported_replan_mutation', 'supported_status_mutation', 'supported_single_task_creation', 'expected_clarification', 'expected_prepare_refusal', 'expected_refusal', 'expected_scope_refusal'].includes(scenario.classification)) throw new Error(`scenario ${caseId} has an unsupported classification`);
    const taskCount = positiveInteger(scenario.fixture?.selected_task_count, `scenario ${caseId} selected task count`, { allowZero: true });
    const names = checkedNames(scenario.fixture.task_names ?? scenario.fixture.selected_task_names ?? [], taskCount, `scenario ${caseId} task names`);
    const taskIds = names.map((_, taskIndex) => `ping-guide-case-${caseId}-task-${String(taskIndex + 1).padStart(2, '0')}`);
    for (const name of names) {
      const nameKey = name.toLocaleLowerCase('en');
      if (seenTaskNames.has(nameKey)) throw new Error(`duplicate synthetic task name ${name}`);
      seenTaskNames.add(nameKey);
    }
    const members = buildMembers(scenario, caseId);
    for (const member of members) {
      if (seenMemberIds.has(member.userId)) throw new Error(`duplicate synthetic Project member id ${member.userId}`);
      seenMemberIds.add(member.userId);
    }
    const caseMembers = members.map(({ userId }) => ({ userId }));
    const existingAssignees = (scenario.fixture.existing_assignees ?? []).map((name, memberIndex) => ({
      name: text(name, `scenario ${caseId} existing collaborator ${memberIndex + 1}`),
      userId: `ping-guide-case-${caseId}-collaborator-${String(memberIndex + 1).padStart(2, '0')}`,
    }));
    const seed = {
      projectId: GUIDED_FIXTURE_PROJECT_ID,
      actorId: GUIDED_FIXTURE_ACTOR_ID,
      clerkUserId: GUIDED_FIXTURE_CLERK_USER_ID,
      workspace: text(scenario.fixture.workspace, `scenario ${caseId} workspace`),
      taskIds,
      taskNames: names,
      selectedTaskCount: taskCount,
      existingAssignees,
      members: members.map(({ userId, name }) => ({ userId, name })),
      memberName: scenario.fixture.member_name ?? null,
      memberId: scenario.fixture.member_id ? `ping-guide-case-${caseId}-member-${safeId(scenario.fixture.member_id, `scenario ${caseId} member id`)}` : null,
      currentProjectMembers: members.map(({ userId, name }) => ({ userId, name })),
      containsMilestone: scenario.fixture.contains_milestone === true,
      newTitle: scenario.fixture.new_title ?? null,
      fixtureSeed: `ping-guide-case-${caseId}`,
    };
    return Object.freeze({
      id: caseId,
      scenarioId: caseId,
      manifestSha256,
      group: text(scenario.group, `scenario ${caseId} group`),
      holdout: scenario.holdout === true,
      goal,
      taskNames: Object.freeze([...names]),
      modeInfo: deriveModeInfo(scenario),
      classification: scenario.classification,
      seed: Object.freeze(seed),
      parserOutcome: scenario.parser_outcome ?? null,
      validationStage: scenario.validation_stage ?? null,
      oracle: Object.freeze(buildOracle(scenario, taskIds, members)),
    });
  });

  const practice = cases.filter(item => !item.holdout).length;
  const heldout = cases.filter(item => item.holdout).length;
  if (practice !== expectedPractice || heldout !== expectedHeldout) throw new Error(`Guided manifest must contain ${expectedPractice} practice and ${expectedHeldout} held-out cases`);
  return Object.freeze(cases);
}

/** Exact allowlist for data that can cross into participant-visible responses. */
export function participantCase(caseRecord) {
  if (!caseRecord || typeof caseRecord !== 'object') throw new Error('A server case record is required');
  return Object.freeze({
    id: caseRecord.id,
    goal: caseRecord.goal,
    taskNames: [...caseRecord.taskNames],
    modeInfo: caseRecord.modeInfo,
  });
}
