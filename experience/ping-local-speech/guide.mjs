const root = document.querySelector('#guide-root');
const allowedCaseKeys = new Set(['id', 'goal', 'taskNames', 'modeInfo']);
const allowedPhases = new Set(['setup', 'ready', 'interacting', 'outcome', 'unresolved', 'paused', 'ended']);
let snapshot = null;
let pending = false;

root.innerHTML = `
  <div class="guide">
    <header class="guide-header">
      <div>
        <h1>Ping session guide</h1>
        <div class="save-state"><span class="save-dot" aria-hidden="true"></span><span id="save-copy">Checking saved session</span></div>
      </div>
    </header>
    <section class="guide-intro" id="intro-panel">
      <h2 id="intro-title">Work through Ping, one task at a time</h2>
      <p>Read a goal, choose the named tasks in Signal, then use the real Ping controls to enter and review your request. This guide never selects tasks or starts the microphone.</p>
    </section>
    <section class="case-panel" id="case-panel" aria-labelledby="case-goal" hidden>
      <div class="case-meta"><span id="case-label">Case</span><span id="case-mode"></span></div>
      <h2 id="case-goal"></h2>
      <ul class="task-list" id="task-list" hidden></ul>
      <p class="action-hint" id="action-hint"></p>
    </section>
    <ol class="steps" id="setup-steps">
      <li><div><strong>Start a case</strong>The guide prepares an invented task set in the isolated fixture.</div></li>
      <li><div><strong>Use Ping yourself</strong>Select the task names shown here. Speak or type in the mounted Tasks window.</div></li>
      <li><div><strong>Review before Apply</strong>Choose Apply or Cancel in Ping. The guide checks the saved result separately.</div></li>
    </ol>
    <section class="progress-block" aria-label="Session progress">
      <div class="progress-heading"><span>Session progress</span><strong id="planned-count">100 cases planned</strong></div>
      <div class="count-grid">
        <div class="count"><strong id="started-count">—</strong><span>Started</span></div>
        <div class="count"><strong id="input-count">—</strong><span>Ping inputs observed</span></div>
        <div class="count"><strong id="verified-count">—</strong><span>Automatically verified</span></div>
      </div>
    </section>
    <p class="status-line" id="status-copy" role="status" aria-live="polite">Preparing your saved session.</p>
    <div id="participant-reports" hidden>
      <section class="feedback" aria-labelledby="mode-heading">
        <h3 id="mode-heading">Input path, if it was not observed</h3>
        <div class="feedback-grid">
          <label for="mode-select">How did you use Ping for this case?
            <select id="mode-select"><option value="">Skip this</option><option value="typed">Typed</option><option value="genuine_microphone">Genuine microphone</option><option value="not_sure">Not sure</option></select>
          </label>
        </div>
        <button type="button" id="save-mode" style="margin-top:8px;width:100%">Save input path</button>
      </section>
      <section class="feedback" aria-labelledby="feedback-heading">
        <h3 id="feedback-heading">Optional experience response</h3>
        <div class="feedback-grid">
          <label for="clarity-select">Was the goal clear?
            <select id="clarity-select"><option value="">Skip</option><option value="clear">Clear</option><option value="unclear">Unclear</option></select>
          </label>
          <label for="ease-select">How did the task feel?
            <select id="ease-select"><option value="">Skip</option><option value="easy">Easy</option><option value="hard">Hard</option></select>
          </label>
          <label for="confidence-select">How sure are you about the result?
            <select id="confidence-select"><option value="">Skip</option><option value="1">Not sure</option><option value="2">A little sure</option><option value="3">Fairly sure</option><option value="4">Very sure</option></select>
          </label>
          <label for="preference-select">Which input would you prefer?
            <select id="preference-select"><option value="">Skip</option><option value="typed">Typed</option><option value="speech">Speech</option><option value="either">Either</option></select>
          </label>
        </div>
        <button type="button" id="save-feedback" style="margin-top:8px;width:100%">Save optional response</button>
      </section>
    </div>
    <p class="error" id="error-copy" role="alert" hidden></p>
    <footer class="guide-actions">
      <button type="button" class="primary" id="primary-action" data-action="start">Start a case</button>
      <button type="button" id="pause-action" data-action="pause">Pause</button>
      <button type="button" class="end-button" id="end-action" data-action="end">End session</button>
    </footer>
  </div>`;

const el = id => document.getElementById(id);
const primary = el('primary-action');
const pauseButton = el('pause-action');
const endButton = el('end-action');
const statusText = el('status-copy');

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? String(value) : '—';
}

function publicCase(value) {
  if (!value || typeof value !== 'object') return null;
  const keys = Object.keys(value);
  if (keys.some(key => !allowedCaseKeys.has(key))) throw new Error('The guide received an unexpected case field.');
  if (typeof value.id !== 'string' || typeof value.goal !== 'string' || !Array.isArray(value.taskNames) || typeof value.modeInfo !== 'string') {
    throw new Error('The guide received an incomplete case summary.');
  }
  return { id: value.id, goal: value.goal, taskNames: value.taskNames.filter(name => typeof name === 'string'), modeInfo: value.modeInfo };
}

function phaseOf(value) {
  const phase = value?.phase;
  return allowedPhases.has(phase) ? phase : 'setup';
}

function phraseForPhase(phase) {
  return ({
    setup: 'Your session is prepared. Start whenever you are ready.',
    ready: 'Choose the case goal and task names shown here, then use Ping in the Tasks window.',
    interacting: 'Use Ping to enter your request. Review its proposal before choosing Apply or Cancel.',
    outcome: 'The saved result is being checked. Continue when the case is settled.',
    unresolved: 'The original result is still uncertain. Check its status before deciding what to do next.',
    paused: 'Your session is paused and saved. Resume when you are ready.',
    ended: 'This session has ended. Its recorded results remain available.',
  })[phase];
}

function render() {
  if (!snapshot) return;
  const phase = phaseOf(snapshot);
  const activeCase = publicCase(snapshot.currentCase ?? null);
  const counts = snapshot.counts ?? snapshot;
  el('save-copy').textContent = snapshot.saved === true ? 'Saved locally' : 'Session status';
  el('planned-count').textContent = `${count(snapshot.totalCount ?? snapshot.plannedCount ?? 100)} cases planned`;
  el('started-count').textContent = count(counts.startedCount ?? counts.participantStartedCount);
  el('input-count').textContent = count(counts.inputObservedCount ?? counts.productInputObservedCount);
  el('verified-count').textContent = count(counts.verifiedCount ?? counts.automaticallyVerifiedCount);
  statusText.textContent = typeof snapshot.message === 'string' && snapshot.message ? snapshot.message : phraseForPhase(phase);

  el('case-panel').hidden = !activeCase || phase === 'setup' || phase === 'ended';
  el('setup-steps').hidden = phase !== 'setup';
  el('intro-panel').hidden = Boolean(activeCase) && phase !== 'ended';
  el('case-label').textContent = `Case ${activeCase?.id ?? ''}`;
  el('case-mode').textContent = activeCase?.modeInfo ?? '';
  el('case-goal').textContent = activeCase?.goal ?? '';
  el('action-hint').textContent = activeCase?.taskNames.length
    ? 'Select these names in Tasks. Use Ping there, then review its full proposal before Apply or Cancel.'
    : 'This case starts from an empty selection. Use Ping in Tasks, then review its full proposal before Apply or Cancel.';
  const list = el('task-list');
  list.replaceChildren(...(activeCase?.taskNames ?? []).map(name => {
    const item = document.createElement('li');
    item.textContent = name;
    return item;
  }));
  list.hidden = !activeCase?.taskNames.length;

  const mainAction = {
    setup: ['start', 'Start a case'],
    ready: ['start', 'Start this case'],
    interacting: ['verify', 'Check saved result'],
    outcome: ['next', 'Continue to next case'],
    unresolved: ['verify', 'Check original result'],
    paused: ['resume', 'Resume session'],
    ended: ['start', 'Session ended'],
  }[phase];
  primary.dataset.action = mainAction[0];
  primary.textContent = mainAction[1];
  primary.hidden = phase === 'ended';
  primary.disabled = pending || phase === 'interacting' || phase === 'ended';
  pauseButton.hidden = !['ready', 'interacting', 'outcome', 'unresolved'].includes(phase);
  pauseButton.disabled = pending;
  endButton.hidden = phase === 'ended' || phase === 'setup';
  endButton.disabled = pending;
  el('participant-reports').hidden = !['outcome', 'unresolved'].includes(phase);
}

async function refresh() {
  try {
    const value = await window.pingGuide.getState();
    snapshot = value?.snapshot ?? value;
    render();
  } catch {
    statusText.textContent = 'The saved session could not be loaded. Keep this page open and ask the session owner to check the runner.';
    el('save-copy').textContent = 'Session unavailable';
  }
}

async function act(action, payload = undefined) {
  if (pending || !window.pingGuide || typeof window.pingGuide.action !== 'function') return;
  pending = true;
  el('error-copy').hidden = true;
  render();
  try {
    const value = await window.pingGuide.action(action, payload);
    snapshot = value?.snapshot ?? value;
    render();
  } catch (error) {
    el('error-copy').textContent = 'That guide action was not saved. Check the session status before trying again.';
    el('error-copy').hidden = false;
    if (snapshot) render();
  } finally {
    pending = false;
    if (snapshot) render();
  }
}

root.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  void act(button.dataset.action);
});
el('save-mode').addEventListener('click', () => {
  const mode = el('mode-select').value;
  if (mode) void act('mode', { mode, evidence: 'participant_reported' });
});
el('save-feedback').addEventListener('click', () => {
  const feedback = Object.fromEntries(['clarity', 'ease', 'confidence', 'preference']
    .map(key => [key, el(`${key}-select`).value]).filter(([, value]) => value !== ''));
  if (Object.keys(feedback).length) void act('feedback', feedback);
});

if (!window.pingGuide || typeof window.pingGuide.getState !== 'function' || typeof window.pingGuide.action !== 'function') {
  statusText.textContent = 'The guided session API is not connected yet.';
  el('save-copy').textContent = 'Session not connected';
} else {
  void refresh();
}
