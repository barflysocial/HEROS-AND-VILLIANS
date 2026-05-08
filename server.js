import express from 'express';
import pg from 'pg';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ROUND_SECONDS = 180;
const MAX_ROUNDS = 5;
const SIDEKICK_TIME_COST_SECONDS = 30;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

function cleanText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, 500);
}

function publicSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    eventName: row.event_name,
    venue: row.venue,
    status: row.status,
    currentRound: Number(row.current_round || 0),
    maxRounds: Number(row.max_rounds || MAX_ROUNDS),
    destruction: Number(row.destruction || 0),
    fatalities: Number(row.fatalities || 0),
    roundEndsAt: row.round_ends_at,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    sidekickTimeCostSeconds: SIDEKICK_TIME_COST_SECONDS
  };
}

function publicPlayer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    sessionId: row.session_id,
    createdAt: row.created_at,
    checkedInAt: row.checked_in_at
  };
}

async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result;
}

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.error('\nMissing DATABASE_URL. Add a PostgreSQL connection string before starting the app.\n');
    process.exit(1);
  }

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      host_code TEXT NOT NULL,
      event_name TEXT NOT NULL DEFAULT 'Save the Day: Power Chest',
      venue TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'rsvp',
      current_round INTEGER NOT NULL DEFAULT 0,
      max_rounds INTEGER NOT NULL DEFAULT 5,
      destruction INTEGER NOT NULL DEFAULT 0,
      fatalities INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      round_started_at TIMESTAMPTZ,
      round_ends_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'rsvped',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checked_in_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS broadcasts (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS player_actions (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL DEFAULT 0,
      power TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sidekick_actions (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL DEFAULT 0,
      task TEXT NOT NULL DEFAULT '',
      time_cost_seconds INTEGER NOT NULL DEFAULT 30,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, player_id, round_number)
    );
  `);
}

async function requireHostCode(sessionId, hostCode) {
  const code = cleanText(hostCode);
  const sessionResult = await query('SELECT * FROM sessions WHERE id=$1', [sessionId]);
  const session = sessionResult.rows[0];
  if (!session) {
    const error = new Error('Session not found.');
    error.status = 404;
    throw error;
  }
  if (session.host_code !== code) {
    const error = new Error('Incorrect host code.');
    error.status = 403;
    throw error;
  }
  return session;
}

function sendError(res, error) {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || 'Something went wrong.' });
}

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/host', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

app.get('/player', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

app.get('/api/health', async (_req, res) => {
  const now = await query('SELECT NOW() AS now');
  res.json({ ok: true, dbTime: now.rows[0].now });
});

app.get('/api/sessions/active', async (_req, res) => {
  try {
    const result = await query(`
      SELECT * FROM sessions
      WHERE status <> 'ended'
      ORDER BY created_at DESC
      LIMIT 25
    `);
    res.json({ sessions: result.rows.map(publicSession) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const eventName = cleanText(req.body.eventName, 'Save the Day: Power Chest') || 'Save the Day: Power Chest';
    const venue = cleanText(req.body.venue, '');
    const hostCode = cleanText(req.body.hostCode, '');
    if (hostCode.length < 3) {
      return res.status(400).json({ error: 'Host code must be at least 3 characters.' });
    }

    let session;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = nanoid(6).toUpperCase().replace(/[-_]/g, 'X');
      try {
        const result = await query(`
          INSERT INTO sessions (code, host_code, event_name, venue)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [code, hostCode, eventName, venue]);
        session = result.rows[0];
        break;
      } catch (error) {
        if (error.code !== '23505') throw error;
      }
    }

    if (!session) throw new Error('Could not create a unique session code.');
    await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, 0, $2, 'info')
    `, [session.id, 'RSVP is open. Check in after RSVP using the host code.']);

    res.status(201).json({ session: publicSession(session) });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/sessions/:code/state', async (req, res) => {
  try {
    const code = cleanText(req.params.code).toUpperCase();
    const sessionResult = await query('SELECT * FROM sessions WHERE code=$1', [code]);
    const session = sessionResult.rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const [players, broadcasts, actions, sidekickActions] = await Promise.all([
      query('SELECT * FROM players WHERE session_id=$1 ORDER BY created_at ASC', [session.id]),
      query('SELECT * FROM broadcasts WHERE session_id=$1 ORDER BY created_at DESC LIMIT 8', [session.id]),
      query(`
        SELECT pa.*, p.name AS player_name
        FROM player_actions pa
        JOIN players p ON p.id = pa.player_id
        WHERE pa.session_id=$1
        ORDER BY pa.created_at DESC
        LIMIT 25
      `, [session.id]),
      query(`
        SELECT sa.*, p.name AS player_name
        FROM sidekick_actions sa
        JOIN players p ON p.id = sa.player_id
        WHERE sa.session_id=$1
        ORDER BY sa.created_at DESC
        LIMIT 25
      `, [session.id])
    ]);

    res.json({
      session: publicSession(session),
      players: players.rows.map(publicPlayer),
      broadcasts: broadcasts.rows.map(row => ({
        id: row.id,
        roundNumber: row.round_number,
        message: row.message,
        severity: row.severity,
        createdAt: row.created_at
      })),
      actions: actions.rows.map(row => ({
        id: row.id,
        playerId: row.player_id,
        playerName: row.player_name,
        roundNumber: row.round_number,
        power: row.power,
        target: row.target,
        createdAt: row.created_at
      })),
      sidekickActions: sidekickActions.rows.map(row => ({
        id: row.id,
        playerId: row.player_id,
        playerName: row.player_name,
        roundNumber: row.round_number,
        task: row.task,
        timeCostSeconds: row.time_cost_seconds,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/rsvp', async (req, res) => {
  try {
    const sessionCode = cleanText(req.body.sessionCode).toUpperCase();
    const name = cleanText(req.body.name);
    if (!sessionCode) return res.status(400).json({ error: 'Choose a session first.' });
    if (name.length < 2) return res.status(400).json({ error: 'Enter a player name.' });

    const sessionResult = await query(`
      SELECT * FROM sessions
      WHERE code=$1 AND status <> 'ended'
    `, [sessionCode]);
    const session = sessionResult.rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found or already ended.' });

    const playerId = nanoid(18);
    const playerResult = await query(`
      INSERT INTO players (id, session_id, name)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [playerId, session.id, name]);

    res.status(201).json({
      player: publicPlayer(playerResult.rows[0]),
      session: publicSession(session)
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/players/:id', async (req, res) => {
  try {
    const playerId = cleanText(req.params.id);
    const playerResult = await query(`
      SELECT p.*, s.code AS session_code
      FROM players p
      JOIN sessions s ON s.id = p.session_id
      WHERE p.id=$1
    `, [playerId]);
    const row = playerResult.rows[0];
    if (!row) return res.status(404).json({ error: 'Player not found.' });
    res.json({
      player: publicPlayer(row),
      sessionCode: row.session_code
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/checkin', async (req, res) => {
  try {
    const playerId = cleanText(req.body.playerId);
    const hostCode = cleanText(req.body.hostCode);
    const playerResult = await query(`
      SELECT p.*, s.host_code, s.status AS session_status, s.code AS session_code, s.id AS sid
      FROM players p
      JOIN sessions s ON s.id = p.session_id
      WHERE p.id=$1 AND s.status <> 'ended'
    `, [playerId]);
    const row = playerResult.rows[0];
    if (!row) return res.status(404).json({ error: 'RSVP not found or session ended.' });
    if (row.host_code !== hostCode) return res.status(403).json({ error: 'Incorrect host code.' });

    const updated = await query(`
      UPDATE players
      SET status='checked_in', checked_in_at=COALESCE(checked_in_at, NOW())
      WHERE id=$1
      RETURNING *
    `, [playerId]);

    res.json({
      player: publicPlayer(updated.rows[0]),
      sessionCode: row.session_code,
      sessionStatus: row.session_status
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/start', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    const roundEndsAtSql = `NOW() + INTERVAL '${ROUND_SECONDS} seconds'`;
    const result = await query(`
      UPDATE sessions
      SET status='active', current_round=1, started_at=COALESCE(started_at, NOW()),
          round_started_at=NOW(), round_ends_at=${roundEndsAtSql}
      WHERE id=$1
      RETURNING *
    `, [session.id]);

    await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, 1, 'Round 1 has started. Prioritize the biggest danger first.', 'danger')
    `, [session.id]);

    res.json({ session: publicSession(result.rows[0]) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/next-round', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    if (session.status !== 'active') return res.status(400).json({ error: 'Start the game first.' });
    if (session.current_round >= session.max_rounds) {
      return res.status(400).json({ error: 'Round 5 is the final round. End the game when ready.' });
    }
    const nextRound = Number(session.current_round) + 1;
    const result = await query(`
      UPDATE sessions
      SET current_round=$2, round_started_at=NOW(), round_ends_at=NOW() + INTERVAL '${ROUND_SECONDS} seconds'
      WHERE id=$1
      RETURNING *
    `, [session.id, nextRound]);

    await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, $2, $3, 'danger')
    `, [session.id, nextRound, `Round ${nextRound} has started. Multiple dangers are now linked together.`]);

    res.json({ session: publicSession(result.rows[0]) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/end', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    const result = await query(`
      UPDATE sessions
      SET status='ended', ended_at=NOW(), round_ends_at=NULL
      WHERE id=$1
      RETURNING *
    `, [session.id]);
    await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, $2, 'Game ended. Prepare final hero result.', 'info')
    `, [session.id, session.current_round || 0]);
    res.json({ session: publicSession(result.rows[0]) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/reset', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    const result = await query(`
      UPDATE sessions
      SET status='rsvp', current_round=0, destruction=0, fatalities=0,
          started_at=NULL, round_started_at=NULL, round_ends_at=NULL, ended_at=NULL
      WHERE id=$1
      RETURNING *
    `, [session.id]);
    await query('UPDATE players SET status=$2, checked_in_at=NULL WHERE session_id=$1', [session.id, 'rsvped']);
    await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, 0, 'Session reset. RSVP is open again.', 'info')
    `, [session.id]);
    res.json({ session: publicSession(result.rows[0]) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/broadcast', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    const message = cleanText(req.body.message);
    const severity = ['info', 'better', 'danger', 'critical'].includes(req.body.severity) ? req.body.severity : 'info';
    if (message.length < 3) return res.status(400).json({ error: 'Broadcast message is too short.' });
    const result = await query(`
      INSERT INTO broadcasts (session_id, round_number, message, severity)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [session.id, session.current_round || 0, message, severity]);
    res.status(201).json({ broadcast: result.rows[0] });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/sessions/:id/meters', async (req, res) => {
  try {
    const session = await requireHostCode(req.params.id, req.body.hostCode);
    const destructionDelta = Number(req.body.destructionDelta || 0);
    const fatalitiesDelta = Number(req.body.fatalitiesDelta || 0);
    const destructionSet = req.body.destruction;
    const fatalitiesSet = req.body.fatalities;

    const nextDestruction = Number.isFinite(Number(destructionSet))
      ? Number(destructionSet)
      : Number(session.destruction) + destructionDelta;
    const nextFatalities = Number.isFinite(Number(fatalitiesSet))
      ? Number(fatalitiesSet)
      : Number(session.fatalities) + fatalitiesDelta;

    const result = await query(`
      UPDATE sessions
      SET destruction=GREATEST(0, LEAST(100, $2)),
          fatalities=GREATEST(0, LEAST(100, $3))
      WHERE id=$1
      RETURNING *
    `, [session.id, nextDestruction, nextFatalities]);

    res.json({ session: publicSession(result.rows[0]) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/actions', async (req, res) => {
  try {
    const playerId = cleanText(req.body.playerId);
    const power = cleanText(req.body.power);
    const target = cleanText(req.body.target, '');
    if (!power) return res.status(400).json({ error: 'Choose a power first.' });

    const playerResult = await query(`
      SELECT p.*, s.status AS session_status, s.current_round
      FROM players p
      JOIN sessions s ON s.id = p.session_id
      WHERE p.id=$1 AND s.status <> 'ended'
    `, [playerId]);
    const player = playerResult.rows[0];
    if (!player) return res.status(404).json({ error: 'Player/session not found.' });
    if (player.status !== 'checked_in') return res.status(403).json({ error: 'Check in before using powers.' });
    if (player.session_status !== 'active') return res.status(400).json({ error: 'Wait for the host to start the game.' });

    const result = await query(`
      INSERT INTO player_actions (session_id, player_id, round_number, power, target)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [player.session_id, playerId, player.current_round, power, target]);

    res.status(201).json({ action: result.rows[0] });
  } catch (error) {
    sendError(res, error);
  }
});


app.post('/api/sidekick', async (req, res) => {
  try {
    const playerId = cleanText(req.body.playerId);
    const task = cleanText(req.body.task, 'Handle one urgent task');
    if (task.length < 3) return res.status(400).json({ error: 'Enter the task for your sidekick.' });

    const playerResult = await query(`
      SELECT p.*, s.status AS session_status, s.current_round, s.round_ends_at
      FROM players p
      JOIN sessions s ON s.id = p.session_id
      WHERE p.id=$1 AND s.status <> 'ended'
    `, [playerId]);
    const player = playerResult.rows[0];
    if (!player) return res.status(404).json({ error: 'Player/session not found.' });
    if (player.status !== 'checked_in') return res.status(403).json({ error: 'Check in before calling the sidekick.' });
    if (player.session_status !== 'active') return res.status(400).json({ error: 'Wait for the host to start the game.' });
    if (!player.current_round || player.current_round < 1) return res.status(400).json({ error: 'Sidekick can only be used during a live round.' });

    try {
      const actionResult = await query(`
        INSERT INTO sidekick_actions (session_id, player_id, round_number, task, time_cost_seconds)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [player.session_id, playerId, player.current_round, task, SIDEKICK_TIME_COST_SECONDS]);

      const sessionResult = await query(`
        UPDATE sessions
        SET round_ends_at = CASE
          WHEN round_ends_at IS NULL THEN NULL
          ELSE GREATEST(NOW(), round_ends_at - ($2::int * INTERVAL '1 second'))
        END
        WHERE id=$1
        RETURNING *
      `, [player.session_id, SIDEKICK_TIME_COST_SECONDS]);

      await query(`
        INSERT INTO broadcasts (session_id, round_number, message, severity)
        VALUES ($1, $2, $3, 'danger')
      `, [player.session_id, player.current_round, `Sidekick used: ${task}. Time cost: ${SIDEKICK_TIME_COST_SECONDS} seconds.`]);

      res.status(201).json({
        sidekickAction: actionResult.rows[0],
        session: publicSession(sessionResult.rows[0])
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Sidekick already used this round. You get one sidekick call per round.' });
      }
      throw error;
    }
  } catch (error) {
    sendError(res, error);
  }
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Save the Day app running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
