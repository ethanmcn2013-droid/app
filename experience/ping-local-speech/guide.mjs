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
        <div class="count"><strong id="unresolved-count">—</strong><span>Unresolved</span></div>
        <div class="count"><strong id="skipped-count">—</strong><span>Skipped before start</span></div>
      </div>
      <p class="remaining-line" id="remaining-count">— cases remaining</p>
    </section>
    <p class="status-line" id="status-copy" role="status" aria-live="polite">Preparing your saved session.</p>
    <section class="feedback" id="input-mode-panel" aria-labelledby="mode-heading" hidden>
      <h3 id="mode-heading">Input path for this case</h3>
      <p class="report-note">Choose before using Ping. The guide records the input path; this setting does not start the microphone.</p>
      <div class="feedback-grid">
        <label for="mode-select">How will you use Ping?
          <select id="mode-select"><option value="">Skip this</option><option value="typed">Typed</option><option value="genuine-microphone">Genuine microphone</option></select>
        </label>
      </div>
      <p class="report-note" id="mode-evidence"></p>
    </section>
    <div id="participant-reports" hidden>
      <section class="feedback" aria-labelledby="feedback-heading">
        <h3 id="feedback-heading">Optional experience response</h3>
        <p class="report-note">These answers are stored separately from automatic result checks.</p>
        <div class="feedback-grid">
          <label for="clarity-select">How clear was the goal?
            <select id="clarity-select"><option value="">Skip</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
          </label>
          <label for="ease-select">How easy did the case feel?
            <select id="ease-select"><option value="">Skip</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
          </label>
          <label for="confidence-select">How sure are you about the result?
            <select id="confidence-select"><option value="">Skip</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
          </label>
          <label for="correction-select">Did you correct or repeat your request?
            <select id="correction-select"><option value="">Skip</option><option value="false">No</option><option value="true">Yes</option></select>
          </label>
        </div>
        <button type="button" id="save-feedback" style="margin-top:8px;width:100%">Save optional response</button>
      </section>
    </div>
    <div class="export-links" id="export-links" hidden><a href="/guide/export.json" download="results.json">Download JSON</a><a href="/guide/export.csv" download="results.csv">Download CSV</a></div>
    <p class="error" id="error-copy" role="alert" hidden></p>
    <footer class="guide-actions">
      <button type="button" class="primary" id="primary-action" data-action="start">Start a case</button>
      <button type="button" id="skip-action" data-action="skip" hidden>Skip before start</button>
      <button type="button" id="retire-action" data-action="retire" hidden>Retire unsubmitted original</button>
      <button type="button" id="pause-action" data-action="pause">Pause</button>
      <button type="button" class="end-button" id="end-action" data-action="end">End session</button>
    </footer>
  </div>`;

const el = id => document.getElementById(id);
const primary = el('primary-action');
const pauseButton = el('pause-action');
const endButton = el('end-action');
const statusText = el('status-copy');
const modeSelect = el('mode-select');

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
  el('unresolved-count').textContent = count(counts.unresolvedCount);
  el('skipped-count').textContent = count(counts.skippedCount);
  el('remaining-count').textContent = `${count(counts.remainingCount)} cases remaining`;
  statusText.textContent = typeof snapshot.message === 'string' && snapshot.message ? snapshot.message : phraseForPhase(phase);

  el('case-panel').hidden = !activeCase || phase === 'setup' || phase === 'ended';
  el('setup-steps').hidden = phase !== 'setup';
  el('intro-panel').hidden = Boolean(activeCase) && phase !== 'ended';
  el('intro-title').textContent = phase === 'ended' ? 'Session ended' : 'Work through Ping, one task at a time';
  if (phase === 'ended') el('intro-panel').querySelector('p').textContent = 'Review the session counts above and download the recorded results below.';
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

  const mainAction = ({
    setup: ['start', 'Start a case', Boolean(snapshot.canStart)],
    ready: ['start', 'Start this case', Boolean(snapshot.canStart)],
    interacting: ['verify', snapshot.canVerify ? 'Check Ping result' : 'Waiting for Ping input', Boolean(snapshot.canVerify)],
    outcome: ['next', 'Continue to next case', Boolean(snapshot.canNext)],
    unresolved: ['verify', 'Check original result', Boolean(snapshot.canVerify)],
    paused: ['resume', 'Resume session', true],
    ended: ['end', 'Session ended', false],
  })[phase];
  primary.dataset.action = mainAction[0];
  primary.textContent = mainAction[1];
  primary.hidden = phase === 'ended';
  primary.disabled = pending || !mainAction[2];
  pauseButton.hidden = !['ready', 'interacting', 'outcome', 'unresolved'].includes(phase);
  pauseButton.disabled = pending;
  endButton.hidden = phase === 'ended' || phase === 'setup';
  endButton.disabled = pending;
  const canReportMode = phase === 'ready' && Boolean(snapshot.canStart)
    || phase === 'interacting' && counts.startedCount > counts.inputObservedCount;
  el('input-mode-panel').hidden = !canReportMode;
  if (document.activeElement !== modeSelect && typeof snapshot.inputMode === 'string') modeSelect.value = snapshot.inputMode;
  el('mode-evidence').textContent = snapshot.inputModeEvidence === 'observed'
    ? 'The runner observed this input path.'
    : snapshot.inputModeEvidence === 'participant_reported'
      ? 'Input path recorded as participant-reported.'
      : '';
  el('participant-reports').hidden = !['outcome', 'unresolved'].includes(phase);
  el('skip-action').hidden = !snapshot.canSkip;
  el('skip-action').disabled = pending || !snapshot.canSkip;
  el('retire-action').hidden = !snapshot.canRetirePrepared;
  el('retire-action').disabled = pending || !snapshot.canRetirePrepared;
  el('export-links').hidden = phase !== 'ended';
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
el('save-feedback').addEventListener('click', () => {
  const feedback = Object.fromEntries(['clarity', 'ease', 'confidence']
    .map(key => [key, el(`${key}-select`).value]).filter(([, value]) => value !== ''));
  const correction = el('correction-select').value;
  if (correction !== '') feedback.correction = correction === 'true';
  if (Object.keys(feedback).length) void act('feedback', feedback);
});

modeSelect.addEventListener('change', () => {
  if (modeSelect.value) void act('mode', { mode: modeSelect.value });
});

if (!window.pingGuide || typeof window.pingGuide.getState !== 'function' || typeof window.pingGuide.action !== 'function') {
  statusText.textContent = 'The guided session API is not connected yet.';
  el('save-copy').textContent = 'Session not connected';
} else {
  void refresh();
}
