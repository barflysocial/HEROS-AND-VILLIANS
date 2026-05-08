const API = {
  async get(path) {
    const res = await fetch(path);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
  },
  async post(path, body = {}) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }
};

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function show(el, shouldShow = true) {
  if (!el) return;
  el.classList.toggle('hidden', !shouldShow);
}

function msg(el, text = '', type = 'notice') {
  if (!el) return;
  if (!text) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `<div class="${type}">${escapeHtml(text)}</div>`;
}

function setMeter(fillEl, valueEl, value) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  if (fillEl) fillEl.style.width = `${safe}%`;
  if (valueEl) valueEl.textContent = `${safe}%`;
}

function formatTimeLeft(roundEndsAt) {
  if (!roundEndsAt) return '3:00';
  const diff = Math.max(0, new Date(roundEndsAt).getTime() - Date.now());
  const total = Math.ceil(diff / 1000);
  const min = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function statusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'ended') return 'Ended';
  return 'RSVP Open';
}

function renderBroadcasts(el, broadcasts = []) {
  if (!el) return;
  if (!broadcasts.length) {
    el.innerHTML = '<p class="muted">No broadcasts yet.</p>';
    return;
  }
  el.innerHTML = broadcasts.map(b => `
    <div class="broadcast ${escapeHtml(b.severity || 'info')}">
      <strong>${escapeHtml((b.severity || 'info').toUpperCase())}</strong>
      <div>${escapeHtml(b.message)}</div>
      <small>Round ${Number(b.roundNumber || 0)}</small>
    </div>
  `).join('');
}

const POWERS = [
  { name: 'Super Strength', icon: '✊' },
  { name: 'Flight', icon: '🪽' },
  { name: 'Speed Burst', icon: '⚡' },
  { name: 'Ice Blast', icon: '❄️' },
  { name: 'Heat Vision', icon: '👁️' },
  { name: 'Force Field', icon: '🛡️' },
  { name: 'Healing Touch', icon: '➕' },
  { name: 'X-Ray Vision', icon: '🩻' },
  { name: 'Teleportation', icon: '🌀' },
  { name: 'Invisibility', icon: '👤' },
  { name: 'Mind Calm', icon: '🧘' },
  { name: 'Energy Absorb', icon: '☀️' }
];
