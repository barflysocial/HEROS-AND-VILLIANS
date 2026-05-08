let selectedSession = null;
let hostCodeBySession = JSON.parse(localStorage.getItem('std_host_codes') || '{}');
let hostPoll = null;

const els = {
  refreshBtn: document.getElementById('refreshBtn'),
  createForm: document.getElementById('createForm'),
  createMsg: document.getElementById('createMsg'),
  sessionList: document.getElementById('sessionList'),
  noSessionCard: document.getElementById('noSessionCard'),
  controlCard: document.getElementById('controlCard'),
  selectedVenue: document.getElementById('selectedVenue'),
  selectedName: document.getElementById('selectedName'),
  selectedCode: document.getElementById('selectedCode'),
  selectedStatus: document.getElementById('selectedStatus'),
  destructionValue: document.getElementById('destructionValue'),
  destructionFill: document.getElementById('destructionFill'),
  fatalitiesValue: document.getElementById('fatalitiesValue'),
  fatalitiesFill: document.getElementById('fatalitiesFill'),
  timerDisplay: document.getElementById('timerDisplay'),
  roundDisplay: document.getElementById('roundDisplay'),
  startBtn: document.getElementById('startBtn'),
  nextRoundBtn: document.getElementById('nextRoundBtn'),
  resetBtn: document.getElementById('resetBtn'),
  endBtn: document.getElementById('endBtn'),
  hostRoundKicker: document.getElementById('hostRoundKicker'),
  hostRoundTitle: document.getElementById('hostRoundTitle'),
  hostRoundStory: document.getElementById('hostRoundStory'),
  hostDangerList: document.getElementById('hostDangerList'),
  broadcastForm: document.getElementById('broadcastForm'),
  playerList: document.getElementById('playerList'),
  actionList: document.getElementById('actionList'),
  broadcastList: document.getElementById('broadcastList')
};

function persistHostCode(sessionId, hostCode) {
  hostCodeBySession[String(sessionId)] = hostCode;
  localStorage.setItem('std_host_codes', JSON.stringify(hostCodeBySession));
}

function getHostCode() {
  if (!selectedSession) return '';
  return hostCodeBySession[String(selectedSession.id)] || prompt('Enter host code for this session') || '';
}

function renderSessionRows(sessions = []) {
  if (!sessions.length) {
    els.sessionList.innerHTML = '<p class="muted">No live sessions.</p>';
    return;
  }
  els.sessionList.innerHTML = sessions.map(s => `
    <div class="session-row ${selectedSession?.id === s.id ? 'selected' : ''}" data-code="${escapeHtml(s.code)}">
      <div><strong>${escapeHtml(s.eventName)}</strong></div>
      <small>${escapeHtml(s.venue || 'No venue')} • ${statusLabel(s.status)}</small>
      <span class="code-box">${escapeHtml(s.code)}</span>
    </div>
  `).join('');

  document.querySelectorAll('.session-row').forEach(row => {
    row.addEventListener('click', () => selectByCode(row.dataset.code));
  });
}

async function loadSessions() {
  const { sessions } = await API.get('/api/sessions/active');
  renderSessionRows(sessions);
  return sessions;
}

async function selectByCode(code) {
  const state = await API.get(`/api/sessions/${encodeURIComponent(code)}/state`);
  selectedSession = state.session;
  renderControl(state);
  await loadSessions();
  startPolling();
}

function renderControl(state) {
  const { session, players = [], broadcasts = [], actions = [], sidekickActions = [] } = state;
  selectedSession = session;
  show(els.noSessionCard, false);
  show(els.controlCard, true);
  els.selectedVenue.textContent = session.venue || 'Session';
  els.selectedName.textContent = session.eventName;
  els.selectedCode.textContent = session.code;
  els.selectedStatus.textContent = statusLabel(session.status);
  els.selectedStatus.className = `status-pill ${session.status}`;
  setMeter(els.destructionFill, els.destructionValue, session.destruction);
  setMeter(els.fatalitiesFill, els.fatalitiesValue, session.fatalities);
  els.timerDisplay.textContent = formatTimeLeft(session.roundEndsAt);
  els.roundDisplay.textContent = `Round ${session.currentRound || 0} of ${session.maxRounds || 5}`;

  if (els.hostRoundTitle) {
    els.hostRoundKicker.textContent = state.roundInfo ? `Round ${state.roundInfo.round} Story` : 'Round Story';
    els.hostRoundTitle.textContent = state.roundInfo ? state.roundInfo.title : 'Auto-Populated Dangers';
    els.hostRoundStory.textContent = state.roundInfo ? `${state.roundInfo.story} Objective: ${state.roundInfo.objective}` : 'Start the game to load the round storyline and timed dangers.';
    renderDangers(els.hostDangerList, state.activeDangers || []);
  }

  els.startBtn.disabled = session.status === 'active';
  els.nextRoundBtn.disabled = session.status !== 'active' || Number(session.currentRound) >= Number(session.maxRounds);

  els.playerList.innerHTML = players.length ? players.map(p => `
    <div class="player">
      <strong>${escapeHtml(p.name)}</strong>
      <div><small>${escapeHtml(p.status)}</small></div>
    </div>
  `).join('') : '<p class="muted">No players yet.</p>';

  const combinedActions = [
    ...actions.map(a => ({
      type: 'power',
      createdAt: a.createdAt,
      html: `
        <div class="action-log">
          <strong>${escapeHtml(a.playerName)}</strong> chose <strong>${escapeHtml(a.power)}</strong>
          ${a.target ? `<div><small>Target: ${escapeHtml(a.target)}</small></div>` : ''}
          <small>Round ${Number(a.roundNumber || 0)}</small>
        </div>`
    })),
    ...sidekickActions.map(a => ({
      type: 'sidekick',
      createdAt: a.createdAt,
      html: `
        <div class="action-log sidekick-log">
          <strong>${escapeHtml(a.playerName)}</strong> called <strong>Sidekick</strong>
          <div><small>Task: ${escapeHtml(a.task)}</small></div>
          <small>Round ${Number(a.roundNumber || 0)} • -${Number(a.timeCostSeconds || 30)} sec</small>
        </div>`
    }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  els.actionList.innerHTML = combinedActions.length
    ? combinedActions.map(item => item.html).join('')
    : '<p class="muted">No power choices or sidekick calls yet.</p>';

  renderBroadcasts(els.broadcastList, broadcasts);
}

async function refreshSelected() {
  if (!selectedSession) return;
  const state = await API.get(`/api/sessions/${encodeURIComponent(selectedSession.code)}/state`);
  renderControl(state);
}

function startPolling() {
  if (hostPoll) clearInterval(hostPoll);
  hostPoll = setInterval(async () => {
    try { await refreshSelected(); } catch (_) { /* keep UI quiet while polling */ }
  }, 2500);
}

async function hostAction(path, body = {}) {
  const hostCode = getHostCode();
  if (!hostCode) throw new Error('Host code is required.');
  const result = await API.post(path, { ...body, hostCode });
  await refreshSelected();
  return result;
}

els.createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  msg(els.createMsg, '');
  const form = new FormData(els.createForm);
  const body = Object.fromEntries(form.entries());
  try {
    const { session } = await API.post('/api/sessions', body);
    persistHostCode(session.id, body.hostCode);
    msg(els.createMsg, `Session created. RSVP code: ${session.code}`);
    els.createForm.reset();
    els.createForm.eventName.value = 'Heroes & Villains';
    await selectByCode(session.code);
  } catch (error) {
    msg(els.createMsg, error.message, 'error');
  }
});

els.refreshBtn.addEventListener('click', async () => {
  await loadSessions();
  if (selectedSession) await refreshSelected();
});

els.startBtn.addEventListener('click', async () => {
  if (!selectedSession) return;
  await hostAction(`/api/sessions/${selectedSession.id}/start`);
});

els.nextRoundBtn.addEventListener('click', async () => {
  if (!selectedSession) return;
  await hostAction(`/api/sessions/${selectedSession.id}/next-round`);
});

els.resetBtn.addEventListener('click', async () => {
  if (!selectedSession) return;
  await hostAction(`/api/sessions/${selectedSession.id}/reset`);
});

els.endBtn.addEventListener('click', async () => {
  if (!selectedSession) return;
  await hostAction(`/api/sessions/${selectedSession.id}/end`);
  selectedSession = null;
  show(els.controlCard, false);
  show(els.noSessionCard, true);
  await loadSessions();
});

document.querySelectorAll('[data-meter]').forEach(button => {
  button.addEventListener('click', async () => {
    if (!selectedSession) return;
    const meter = button.dataset.meter;
    const delta = Number(button.dataset.delta || 0);
    const body = meter === 'destruction' ? { destructionDelta: delta } : { fatalitiesDelta: delta };
    await hostAction(`/api/sessions/${selectedSession.id}/meters`, body);
  });
});

els.broadcastForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedSession) return;
  const form = new FormData(els.broadcastForm);
  const body = Object.fromEntries(form.entries());
  await hostAction(`/api/sessions/${selectedSession.id}/broadcast`, body);
  els.broadcastForm.reset();
  els.broadcastForm.severity.value = 'danger';
});

loadSessions().catch(error => {
  els.sessionList.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
});

setInterval(() => {
  if (selectedSession) els.timerDisplay.textContent = formatTimeLeft(selectedSession.roundEndsAt);
}, 1000);
