import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { WakeScenarioService } from '../services/wake-scenario.service';

const router = Router();

function getUserHousehold(userId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM households WHERE user_id = ?').get(userId) as any;
}

// POST /wake/test/:childId
router.post('/test/:childId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND household_id = ?').get(req.params.childId, household.id) as any;
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const device = db.prepare('SELECT * FROM devices WHERE household_id = ?').get(household.id) as any;
    if (!device) return res.status(404).json({ error: 'No device found' });

    const sessionId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO wake_sessions (id, child_id, device_id, scheduled_at, started_at, result_status, attempts_count, log_entries)
      VALUES (?, ?, ?, ?, ?, 'in_progress', 0, ?)
    `).run(sessionId, req.params.childId, device.id, now, now, JSON.stringify([{
      timestamp: now,
      event: 'test_started',
      message: 'בדיקת השכמה הופעלה ידנית',
    }]));

    // Start wake scenario asynchronously
    WakeScenarioService.executeWake(sessionId, req.params.childId, device.id, req.user!.userId)
      .catch(err => console.error('Wake scenario error:', err));

    res.json({
      sessionId,
      message: 'בדיקת השכמה התחילה',
      status: 'in_progress',
    });
  } catch (err) {
    console.error('Test wake error:', err);
    res.status(500).json({ error: 'Failed to start wake test' });
  }
});

// POST /wake/start/:childId
router.post('/start/:childId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND household_id = ?').get(req.params.childId, household.id) as any;
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const device = db.prepare('SELECT * FROM devices WHERE household_id = ?').get(household.id) as any;
    if (!device) return res.status(404).json({ error: 'No device found' });

    // Check if there's already an active session
    const activeSession = db.prepare(
      "SELECT * FROM wake_sessions WHERE child_id = ? AND result_status = 'in_progress'"
    ).get(req.params.childId) as any;

    if (activeSession) {
      return res.status(409).json({ error: 'Wake session already in progress', sessionId: activeSession.id });
    }

    const sessionId = uuidv4();
    const now = new Date().toISOString();
    const { scheduledAt } = req.body;

    db.prepare(`
      INSERT INTO wake_sessions (id, child_id, device_id, scheduled_at, started_at, result_status, attempts_count, log_entries)
      VALUES (?, ?, ?, ?, ?, 'in_progress', 0, ?)
    `).run(sessionId, req.params.childId, device.id, scheduledAt || now, now, JSON.stringify([{
      timestamp: now,
      event: 'session_started',
      message: 'סשן השכמה התחיל',
    }]));

    // Start wake scenario asynchronously
    WakeScenarioService.executeWake(sessionId, req.params.childId, device.id, req.user!.userId)
      .catch(err => console.error('Wake scenario error:', err));

    res.json({
      sessionId,
      message: 'סשן השכמה התחיל',
      status: 'in_progress',
    });
  } catch (err) {
    console.error('Start wake error:', err);
    res.status(500).json({ error: 'Failed to start wake session' });
  }
});

// POST /wake/stop/:sessionId
router.post('/stop/:sessionId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const session = db.prepare(`
      SELECT ws.* FROM wake_sessions ws
      JOIN children c ON ws.child_id = c.id
      WHERE ws.id = ? AND c.household_id = ?
    `).get(req.params.sessionId, household.id) as any;

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const now = new Date().toISOString();
    const logs = JSON.parse(session.log_entries || '[]');
    logs.push({
      timestamp: now,
      event: 'session_stopped',
      message: 'הסשן הופסק ידנית על ידי ההורה',
    });

    db.prepare(`
      UPDATE wake_sessions SET
        result_status = 'stopped',
        completed_at = ?,
        log_entries = ?
      WHERE id = ?
    `).run(now, JSON.stringify(logs), req.params.sessionId);

    // Stop the device
    if (session.device_id) {
      db.prepare("UPDATE devices SET status = 'idle' WHERE id = ?").run(session.device_id);
    }

    WakeScenarioService.stopSession(req.params.sessionId);

    res.json({ message: 'סשן הופסק בהצלחה', status: 'stopped' });
  } catch (err) {
    console.error('Stop wake error:', err);
    res.status(500).json({ error: 'Failed to stop wake session' });
  }
});

// GET /wake/sessions
router.get('/sessions', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const { childId, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT ws.*, c.name as child_name, c.avatar_url
      FROM wake_sessions ws
      JOIN children c ON ws.child_id = c.id
      WHERE c.household_id = ?
    `;
    const params: any[] = [household.id];

    if (childId) {
      query += ' AND ws.child_id = ?';
      params.push(childId);
    }

    query += ' ORDER BY ws.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const sessions = db.prepare(query).all(...params) as any[];

    res.json({
      sessions: sessions.map(s => ({
        ...s,
        log_entries: JSON.parse(s.log_entries || '[]'),
      })),
    });
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /wake/sessions/:id
router.get('/sessions/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const session = db.prepare(`
      SELECT ws.*, c.name as child_name, c.avatar_url
      FROM wake_sessions ws
      JOIN children c ON ws.child_id = c.id
      WHERE ws.id = ? AND c.household_id = ?
    `).get(req.params.id, household.id) as any;

    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json({
      session: {
        ...session,
        log_entries: JSON.parse(session.log_entries || '[]'),
      },
    });
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

export default router;
