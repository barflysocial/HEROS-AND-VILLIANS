let activeSessions = [];
let player = JSON.parse(localStorage.getItem('std_player') || 'null');
let sessionCode = localStorage.getItem('std_session_code') || '';
let playerPoll = null;
let latestSession = null;

const els = {
  comingSoon: document.getElementById('comingSoon'),
  sessionSelect: document.getElementById('sessionSelect'),
  sessionSelectInput: document.getElementById('sessionSelectInput'),
  rsvpForm: document.getElementById('rsvpForm'),
  playerMsg: document.getElementById('playerMsg'),
  rsvpConfirmed: document.getElementById('rsvpConfirmed'),
  confirmedTitle: document.getElementById('confirmedTitle'),
  checkinMsg: document.getElementById('checkinMsg'),
  checkinForm: document.getElementById('checkinForm'),
  backToSessions: document.getElementById('backToSessions'),
  waitingRoom: document.getElementById('waitingRoom'),
  gameScreen: document.getElementById('gameScreen'),
  playerRound: document.getElementById('playerRound'),
  playerTimer: document.getElementById('playerTimer'),
  playerDestructionValue: document.getElementById('playerDestructionValue'),
  playerDestructionFill: document.getElementById('playerDestructionFill'),
  playerFatalitiesValue: document.getElementById('playerFatalitiesValue'),
  playerFatalitiesFill: document.getElementById('playerFatalitiesFill'),
  playerBroadcastList: document.getElementById('playerBroadcastList'),
  powerGrid: document.getElementById('powerGrid'),
  targetInput: document.getElementById('targetInput'),
  actionMsg: document.getElementById('actionMsg'),
  sidekickTaskInput: document.getElementById('sidekickTaskInput'),
  sidekickBtn: document.getElementById('sidekickBtn'),
  sidekickMsg: document.getElementById('sidekickMsg'),
  refreshPlayerBtn: document.getElementById('refreshPlayerBtn')
};

function savePlayer(nextPlayer, nextSessionCode) {
  player = nextPlayer;
  sessionCode = nextSessionCode;
  localStorage.setItem('std_player', JSON.stringify(player));
  localStorage.setItem('std_session_code', sessionCode);
}

function clearPlayer() {
  player = null;
  sessionCode = '';
  localStorage.removeItem('std_player');
  localStorage.removeItem('std_session_code');
  stopPolling();
}

function showOnly(view) {
  show(els.comingSoon, view === 'comingSoon');
  show(els.sessionSelect, view === 'sessionSelect');
  show(els.rsvpConfirmed, view === 'rsvpConfirmed');
  show(els.waitingRoom, view === 'waitingRoom');
  show(els.gameScreen, view === 'gameScreen');
}

function renderPowerGrid() {
  els.powerGrid.innerHTML = POWERS.map(power => `
    <button class="power-button" type="button" data-power="${escapeHtml(power.name)}">
      <span class="power-icon">${escapeHtml(power.icon)}</span>
      ${escapeHtml(power.name)}
    </button>
  `).join('');

  document.querySelectorAll('[data-power]').forEach(button => {
    button.addEventListener('click', async () => {
      msg(els.actionMsg, '');
      try {
        const power = button.dataset.power;
        await API.post('/api/actions', {
          playerId: player.id,
          power,
          target: els.targetInput.value
        });
        msg(els.actionMsg, `${power} submitted to the host.`);
        els.targetInput.value = '';
      } catch (error) {
        msg(els.actionMsg, error.message, 'error');
      }
    });
  });
}

function updateSidekickUi(state) {
  if (!els.sidekickBtn || !player || !state?.session) return;
  const currentRound = Number(state.session.currentRound || 0);
  const cost = Number(state.session.sidekickTimeCostSeconds || 30);
  const used = (state.sidekickActions || []).find(action =>
    action.playerId === player.id && Number(action.roundNumber || 0) === currentRound
  );

  els.sidekickBtn.textContent = used
    ? 'Sidekick Used This Round'
    : `Use Sidekick (-${cost} sec)`;
  els.sidekickBtn.disabled = Boolean(used) || currentRound < 1 || state.session.status !== 'active';

  if (used) {
    msg(els.sidekickMsg, `Sidekick handled: ${used.task}.`);
  } else {
    msg(els.sidekickMsg, '');
  }
}

async function loadSessions() {
  const data = await API.get('/api/sessions/active');
  activeSessions = data.sessions || [];
  if (!activeSessions.length) {
    showOnly('comingSoon');
    return;
  }

  els.sessionSelectInput.innerHTML = activeSessions.map(session => `
    <option value="${escapeHtml(session.code)}">
      ${escapeHtml(session.eventName)}${session.venue ? ` — ${escapeHtml(session.venue)}` : ''}
    </option>
  `).join('');
  showOnly('sessionSelect');
}

async function restorePlayerIfPossible() {
  if (!player?.id || !sessionCode) return false;
  try {
    const current = await API.get(`/api/players/${encodeURIComponent(player.id)}`);
    player = current.player;
    sessionCode = current.sessionCode;
    savePlayer(player, sessionCode);
    await updatePlayerState();
    startPolling();
    return true;
  } catch (_) {
    clearPlayer();
    return false;
  }
}

function renderPlayerState(state) {
  const { session, broadcasts = [] } = state;
  latestSession = session;
  setMeter(els.playerDestructionFill, els.playerDestructionValue, session.destruction);
  setMeter(els.playerFatalitiesFill, els.playerFatalitiesValue, session.fatalities);
  els.playerRound.textContent = `Round ${session.currentRound || 0} of ${session.maxRounds || 5}`;
  els.playerTimer.textContent = formatTimeLeft(session.roundEndsAt);
  renderBroadcasts(els.playerBroadcastList, broadcasts);
  updateSidekickUi(state);

  if (player.status !== 'checked_in') {
    els.confirmedTitle.textContent = `${player.name}, you are on the list`;
    showOnly('rsvpConfirmed');
  } else if (session.status === 'active') {
    showOnly('gameScreen');
  } else {
    showOnly('waitingRoom');
  }
}

async function updatePlayerState() {
  if (!sessionCode || !player) return;
  const state = await API.get(`/api/sessions/${encodeURIComponent(sessionCode)}/state`);
  const matchingPlayer = state.players.find(p => p.id === player.id);
  if (matchingPlayer) {
    player = matchingPlayer;
    savePlayer(player, sessionCode);
  }
  renderPlayerState(state);
}

function startPolling() {
  stopPolling();
  playerPoll = setInterval(async () => {
    try { await updatePlayerState(); } catch (_) { /* quiet poll */ }
  }, 2500);
}

function stopPolling() {
  if (playerPoll) clearInterval(playerPoll);
  playerPoll = null;
}

els.rsvpForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  msg(els.playerMsg, '');
  const form = new FormData(els.rsvpForm);
  const body = Object.fromEntries(form.entries());
  try {
    const data = await API.post('/api/rsvp', body);
    savePlayer(data.player, data.session.code);
    await updatePlayerState();
    startPolling();
  } catch (error) {
    msg(els.playerMsg, error.message, 'error');
  }
});

els.checkinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  msg(els.checkinMsg, '');
  const form = new FormData(els.checkinForm);
  const body = Object.fromEntries(form.entries());
  try {
    const data = await API.post('/api/checkin', {
      playerId: player.id,
      hostCode: body.hostCode
    });
    savePlayer(data.player, data.sessionCode);
    await updatePlayerState();
    startPolling();
  } catch (error) {
    msg(els.checkinMsg, error.message, 'error');
  }
});

els.backToSessions.addEventListener('click', async () => {
  clearPlayer();
  await loadSessions();
});

els.sidekickBtn.addEventListener('click', async () => {
  msg(els.sidekickMsg, '');
  try {
    const task = els.sidekickTaskInput.value.trim();
    const data = await API.post('/api/sidekick', {
      playerId: player.id,
      task
    });
    latestSession = data.session;
    msg(els.sidekickMsg, `Sidekick assigned. ${data.session.sidekickTimeCostSeconds || 30} seconds removed from the round timer.`);
    els.sidekickTaskInput.value = '';
    await updatePlayerState();
  } catch (error) {
    msg(els.sidekickMsg, error.message, 'error');
  }
});

els.refreshPlayerBtn.addEventListener('click', loadSessions);

renderPowerGrid();
restorePlayerIfPossible().then(restored => {
  if (!restored) loadSessions();
});

setInterval(() => {
  if (latestSession) els.playerTimer.textContent = formatTimeLeft(latestSession.roundEndsAt);
}, 1000);
