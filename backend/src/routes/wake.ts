import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, execute } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { WakeScenarioService } from '../services/wake-scenario.service';

const router = Router();

async function getUserHousehold(userId: string) {
  return queryOne<any>('SELECT * FROM households WHERE user_id = $1', [userId]);
}

// POST /wake/test/:childId
router.post('/test/:childId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const child = await queryOne<any>('SELECT * FROM children WHERE id = $1 AND household_id = $2', [req.params.childId, household.id]);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const device = await queryOne<any>('SELECT * FROM devices WHERE household_id = $1', [household.id]);
    if (!device) return res.status(404).json({ error: 'No device found' });

    const sessionId = uuidv4();
    const now = new Date().toISOString();

    await execute(
      "INSERT INTO wake_sessions (id, child_id, device_id, scheduled_at, started_at, result_status, attempts_count, log_entries) VALUES ($1, $2, $3, $4, $5, 'in_progress', 0, $6)",
      [sessionId, req.params.childId, device.id, now, now, JSON.stringify([{
        timestamp: now,
        event: 'test_started',
        message: 'בדיקת השכמה הופעלה ידנית',
      }])]
    );

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
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const child = await queryOne<any>('SELECT * FROM children WHERE id = $1 AND household_id = $2', [req.params.childId, household.id]);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const device = await queryOne<any>('SELECT * FROM devices WHERE household_id = $1', [household.id]);
    if (!device) return res.status(404).json({ error: 'No device found' });

    const activeSession = await queryOne<any>(
      "SELECT * FROM wake_sessions WHERE child_id = $1 AND result_status = 'in_progress'",
      [req.params.childId]
    );

    if (activeSession) {
      return res.status(409).json({ error: 'Wake session already in progress', sessionId: activeSession.id });
    }

    const sessionId = uuidv4();
    const now = new Date().toISOString();
    const { scheduledAt } = req.body;

    await execute(
      "INSERT INTO wake_sessions (id, child_id, device_id, scheduled_at, started_at, result_status, attempts_count, log_entries) VALUES ($1, $2, $3, $4, $5, 'in_progress', 0, $6)",
      [sessionId, req.params.childId, device.id, scheduledAt || now, now, JSON.stringify([{
        timestamp: now,
        event: 'session_started',
        message: 'סשן השכמה התחיל',
      }])]
    );

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
router.post('/stop/:sessionId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const session = await queryOne<any>(`
      SELECT ws.* FROM wake_sessions ws
      JOIN children c ON ws.child_id = c.id
      WHERE ws.id = $1 AND c.household_id = $2
    `, [req.params.sessionId, household.id]);

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const now = new Date().toISOString();
    const logs = JSON.parse(session.log_entries || '[]');
    logs.push({
      timestamp: now,
      event: 'session_stopped',
      message: 'הסשן הופסק ידנית על ידי ההורה',
    });

    await execute(`
      UPDATE wake_sessions SET
        result_status = 'stopped',
        completed_at = $1,
        log_entries = $2
      WHERE id = $3
    `, [now, JSON.stringify(logs), req.params.sessionId]);

    if (session.device_id) {
      await execute("UPDATE devices SET status = 'idle' WHERE id = $1", [session.device_id]);
    }

    WakeScenarioService.stopSession(req.params.sessionId);

    res.json({ message: 'סשן הופסק בהצלחה', status: 'stopped' });
  } catch (err) {
    console.error('Stop wake error:', err);
    res.status(500).json({ error: 'Failed to stop wake session' });
  }
});

// GET /wake/sessions
router.get('/sessions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const { childId, limit = 20, offset = 0 } = req.query;

    const params: any[] = [household.id];
    let paramIndex = 2;
    let whereExtra = '';

    if (childId) {
      whereExtra = ` AND ws.child_id = $${paramIndex++}`;
      params.push(childId);
    }

    params.push(parseInt(limit as string), parseInt(offset as string));

    const sessions = await queryAll<any>(`
      SELECT ws.*, c.name as child_name, c.avatar_url
      FROM wake_sessions ws
      JOIN children c ON ws.child_id = c.id
      WHERE c.household_id = $1${whereExtra}
      ORDER BY ws.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);

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
router.get('/sessions/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const session = await queryOne<any>(`
      SELECT ws.*, c.name as child_name, c.avatar_url
      FROM wake_sessions ws
      JOIN children c ON ws.child_id = c.id
      WHERE ws.id = $1 AND c.household_id = $2
    `, [req.params.id, household.id]);

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
