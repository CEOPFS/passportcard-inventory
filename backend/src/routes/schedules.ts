import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, execute } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

async function getUserHousehold(userId: string) {
  return queryOne<any>('SELECT * FROM households WHERE user_id = $1', [userId]);
}

// POST /children/:id/schedules
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { day_of_week, time_of_day, enabled = true, exceptions = [] } = req.body;

    if (day_of_week === undefined || !time_of_day) {
      return res.status(400).json({ error: 'day_of_week and time_of_day are required' });
    }

    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const child = await queryOne<any>('SELECT * FROM children WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const id = uuidv4();

    await execute(
      'INSERT INTO schedules (id, child_id, day_of_week, time_of_day, enabled, exceptions) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.params.id, day_of_week, time_of_day, enabled ? 1 : 0, JSON.stringify(exceptions)]
    );

    const schedule = await queryOne<any>('SELECT * FROM schedules WHERE id = $1', [id]);
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
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const child = await queryOne<any>('SELECT * FROM children WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const schedules = await queryAll<any>('SELECT * FROM schedules WHERE child_id = $1 ORDER BY day_of_week, time_of_day', [req.params.id]);
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
router.put('/:scheduleId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const schedule = await queryOne<any>(`
      SELECT s.* FROM schedules s
      JOIN children c ON s.child_id = c.id
      WHERE s.id = $1 AND c.household_id = $2
    `, [req.params.scheduleId, household.id]);

    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const { day_of_week, time_of_day, enabled, exceptions } = req.body;

    await execute(`
      UPDATE schedules SET
        day_of_week = COALESCE($1, day_of_week),
        time_of_day = COALESCE($2, time_of_day),
        enabled = COALESCE($3, enabled),
        exceptions = COALESCE($4, exceptions)
      WHERE id = $5
    `, [
      day_of_week ?? null,
      time_of_day ?? null,
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      exceptions !== undefined ? JSON.stringify(exceptions) : null,
      req.params.scheduleId,
    ]);

    const updated = await queryOne<any>('SELECT * FROM schedules WHERE id = $1', [req.params.scheduleId]);
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
router.delete('/:scheduleId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const schedule = await queryOne<any>(`
      SELECT s.* FROM schedules s
      JOIN children c ON s.child_id = c.id
      WHERE s.id = $1 AND c.household_id = $2
    `, [req.params.scheduleId, household.id]);

    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    await execute('DELETE FROM schedules WHERE id = $1', [req.params.scheduleId]);
    res.json({ message: 'Schedule deleted successfully' });
  } catch (err) {
    console.error('Delete schedule error:', err);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

export default router;
