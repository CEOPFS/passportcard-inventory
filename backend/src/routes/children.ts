import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, execute } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

async function getUserHousehold(userId: string) {
  return queryOne<any>('SELECT * FROM households WHERE user_id = $1', [userId]);
}

// GET /children
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const children = await queryAll<any>('SELECT * FROM children WHERE household_id = $1 ORDER BY created_at', [household.id]);

    const enriched = await Promise.all(children.map(async child => {
      const schedules = await queryAll<any>('SELECT * FROM schedules WHERE child_id = $1 AND enabled = 1', [child.id]);
      const countRow = await queryOne<any>('SELECT COUNT(*) as count FROM wake_messages WHERE child_id = $1 AND is_active = 1', [child.id]);
      const messageCount = parseInt(countRow?.count ?? '0');
      const lastSession = await queryOne<any>('SELECT * FROM wake_sessions WHERE child_id = $1 ORDER BY created_at DESC LIMIT 1', [child.id]);

      return {
        ...child,
        schedules,
        message_count: messageCount,
        last_session: lastSession ? {
          ...lastSession,
          log_entries: JSON.parse(lastSession.log_entries || '[]'),
        } : null,
      };
    }));

    res.json({ children: enriched });
  } catch (err) {
    console.error('Get children error:', err);
    res.status(500).json({ error: 'Failed to fetch children' });
  }
});

// POST /children
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, age, room_name, wake_point_x = 50, wake_point_y = 50, safety_radius = 50 } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const id = uuidv4();

    await execute(
      'INSERT INTO children (id, household_id, name, age, room_name, wake_point_x, wake_point_y, safety_radius, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)',
      [id, household.id, name, age ?? null, room_name ?? null, wake_point_x, wake_point_y, safety_radius]
    );

    const child = await queryOne<any>('SELECT * FROM children WHERE id = $1', [id]);

    res.status(201).json({ child });
  } catch (err) {
    console.error('Create child error:', err);
    res.status(500).json({ error: 'Failed to create child' });
  }
});

// GET /children/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const child = await queryOne<any>('SELECT * FROM children WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const [schedules, messages, sessions] = await Promise.all([
      queryAll<any>('SELECT * FROM schedules WHERE child_id = $1 ORDER BY day_of_week, time_of_day', [child.id]),
      queryAll<any>('SELECT * FROM wake_messages WHERE child_id = $1 ORDER BY order_index', [child.id]),
      queryAll<any>('SELECT * FROM wake_sessions WHERE child_id = $1 ORDER BY created_at DESC LIMIT 10', [child.id]),
    ]);

    res.json({
      child,
      schedules: schedules.map(s => ({
        ...s,
        exceptions: JSON.parse(s.exceptions || '[]'),
      })),
      messages,
      sessions: sessions.map(s => ({
        ...s,
        log_entries: JSON.parse(s.log_entries || '[]'),
      })),
    });
  } catch (err) {
    console.error('Get child error:', err);
    res.status(500).json({ error: 'Failed to fetch child' });
  }
});

// PUT /children/:id
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const child = await queryOne<any>('SELECT * FROM children WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const { name, age, room_name, wake_point_x, wake_point_y, safety_radius, active, avatar_url } = req.body;

    await execute(`
      UPDATE children SET
        name = COALESCE($1, name),
        age = COALESCE($2, age),
        room_name = COALESCE($3, room_name),
        wake_point_x = COALESCE($4, wake_point_x),
        wake_point_y = COALESCE($5, wake_point_y),
        safety_radius = COALESCE($6, safety_radius),
        active = COALESCE($7, active),
        avatar_url = COALESCE($8, avatar_url)
      WHERE id = $9
    `, [
      name ?? null,
      age ?? null,
      room_name ?? null,
      wake_point_x ?? null,
      wake_point_y ?? null,
      safety_radius ?? null,
      active !== undefined ? (active ? 1 : 0) : null,
      avatar_url ?? null,
      req.params.id,
    ]);

    const updated = await queryOne<any>('SELECT * FROM children WHERE id = $1', [req.params.id]);
    res.json({ child: updated });
  } catch (err) {
    console.error('Update child error:', err);
    res.status(500).json({ error: 'Failed to update child' });
  }
});

// DELETE /children/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const child = await queryOne<any>('SELECT * FROM children WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    await execute('DELETE FROM children WHERE id = $1', [req.params.id]);
    res.json({ message: 'Child deleted successfully' });
  } catch (err) {
    console.error('Delete child error:', err);
    res.status(500).json({ error: 'Failed to delete child' });
  }
});

// PUT /children/:id/location
router.put('/:id/location', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const child = await queryOne<any>('SELECT * FROM children WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const { wake_point_x, wake_point_y, safety_radius, room_name } = req.body;

    await execute(`
      UPDATE children SET
        wake_point_x = COALESCE($1, wake_point_x),
        wake_point_y = COALESCE($2, wake_point_y),
        safety_radius = COALESCE($3, safety_radius),
        room_name = COALESCE($4, room_name)
      WHERE id = $5
    `, [wake_point_x ?? null, wake_point_y ?? null, safety_radius ?? null, room_name ?? null, req.params.id]);

    const updated = await queryOne<any>('SELECT * FROM children WHERE id = $1', [req.params.id]);
    res.json({ child: updated });
  } catch (err) {
    console.error('Update location error:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

export default router;
