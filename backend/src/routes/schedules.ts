import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

function getUserHousehold(userId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM households WHERE user_id = ?').get(userId) as any;
}

// POST /children/:id/schedules
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { day_of_week, time_of_day, enabled = true, exceptions = [] } = req.body;

    if (day_of_week === undefined || !time_of_day) {
      return res.status(400).json({ error: 'day_of_week and time_of_day are required' });
    }

    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const id = uuidv4();

    db.prepare(`
      INSERT INTO schedules (id, child_id, day_of_week, time_of_day, enabled, exceptions)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, day_of_week, time_of_day, enabled ? 1 : 0, JSON.stringify(exceptions));

    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as any;
    res.status(201).json({
      schedule: {
        ...schedule,
        exceptions: JSON.parse(schedule.exceptions || '[]'),
      },
    });
  } catch (err) {
    console.error('Create schedule error:', err);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// GET /children/:id/schedules
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const schedules = db.prepare('SELECT * FROM schedules WHERE child_id = ? ORDER BY day_of_week, time_of_day').all(req.params.id) as any[];
    res.json({
      schedules: schedules.map(s => ({
        ...s,
        exceptions: JSON.parse(s.exceptions || '[]'),
      })),
    });
  } catch (err) {
    console.error('Get schedules error:', err);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// PUT /schedules/:scheduleId
router.put('/:scheduleId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const schedule = db.prepare(`
      SELECT s.* FROM schedules s
      JOIN children c ON s.child_id = c.id
      WHERE s.id = ? AND c.household_id = ?
    `).get(req.params.scheduleId, household.id) as any;

    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const { day_of_week, time_of_day, enabled, exceptions } = req.body;

    db.prepare(`
      UPDATE schedules SET
        day_of_week = COALESCE(?, day_of_week),
        time_of_day = COALESCE(?, time_of_day),
        enabled = COALESCE(?, enabled),
        exceptions = COALESCE(?, exceptions)
      WHERE id = ?
    `).run(
      day_of_week,
      time_of_day,
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      exceptions !== undefined ? JSON.stringify(exceptions) : null,
      req.params.scheduleId
    );

    const updated = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.scheduleId) as any;
    res.json({
      schedule: {
        ...updated,
        exceptions: JSON.parse(updated.exceptions || '[]'),
      },
    });
  } catch (err) {
    console.error('Update schedule error:', err);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// DELETE /schedules/:scheduleId
router.delete('/:scheduleId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const schedule = db.prepare(`
      SELECT s.* FROM schedules s
      JOIN children c ON s.child_id = c.id
      WHERE s.id = ? AND c.household_id = ?
    `).get(req.params.scheduleId, household.id) as any;

    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.scheduleId);
    res.json({ message: 'Schedule deleted successfully' });
  } catch (err) {
    console.error('Delete schedule error:', err);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

export default router;
