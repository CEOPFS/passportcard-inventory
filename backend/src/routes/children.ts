import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

function getUserHousehold(userId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM households WHERE user_id = ?').get(userId) as any;
}

// GET /children
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const children = db.prepare('SELECT * FROM children WHERE household_id = ? ORDER BY created_at').all(household.id) as any[];

    const enriched = children.map(child => {
      const schedules = db.prepare('SELECT * FROM schedules WHERE child_id = ? AND enabled = 1').all(child.id) as any[];
      const messageCount = (db.prepare('SELECT COUNT(*) as count FROM wake_messages WHERE child_id = ? AND is_active = 1').get(child.id) as any).count;
      const lastSession = db.prepare('SELECT * FROM wake_sessions WHERE child_id = ? ORDER BY created_at DESC LIMIT 1').get(child.id) as any;

      return {
        ...child,
        schedules,
        message_count: messageCount,
        last_session: lastSession ? {
          ...lastSession,
          log_entries: JSON.parse(lastSession.log_entries || '[]'),
        } : null,
      };
    });

    res.json({ children: enriched });
  } catch (err) {
    console.error('Get children error:', err);
    res.status(500).json({ error: 'Failed to fetch children' });
  }
});

// POST /children
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { name, age, room_name, wake_point_x = 50, wake_point_y = 50, safety_radius = 50 } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO children (id, household_id, name, age, room_name, wake_point_x, wake_point_y, safety_radius, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, household.id, name, age || null, room_name || null, wake_point_x, wake_point_y, safety_radius);

    const child = db.prepare('SELECT * FROM children WHERE id = ?').get(id) as any;

    res.status(201).json({ child });
  } catch (err) {
    console.error('Create child error:', err);
    res.status(500).json({ error: 'Failed to create child' });
  }
});

// GET /children/:id
router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const schedules = db.prepare('SELECT * FROM schedules WHERE child_id = ? ORDER BY day_of_week, time_of_day').all(child.id) as any[];
    const messages = db.prepare('SELECT * FROM wake_messages WHERE child_id = ? ORDER BY order_index').all(child.id) as any[];
    const sessions = db.prepare('SELECT * FROM wake_sessions WHERE child_id = ? ORDER BY created_at DESC LIMIT 10').all(child.id) as any[];

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
router.put('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const { name, age, room_name, wake_point_x, wake_point_y, safety_radius, active, avatar_url } = req.body;

    db.prepare(`
      UPDATE children SET
        name = COALESCE(?, name),
        age = COALESCE(?, age),
        room_name = COALESCE(?, room_name),
        wake_point_x = COALESCE(?, wake_point_x),
        wake_point_y = COALESCE(?, wake_point_y),
        safety_radius = COALESCE(?, safety_radius),
        active = COALESCE(?, active),
        avatar_url = COALESCE(?, avatar_url)
      WHERE id = ?
    `).run(name, age, room_name, wake_point_x, wake_point_y, safety_radius, active !== undefined ? (active ? 1 : 0) : null, avatar_url, req.params.id);

    const updated = db.prepare('SELECT * FROM children WHERE id = ?').get(req.params.id);
    res.json({ child: updated });
  } catch (err) {
    console.error('Update child error:', err);
    res.status(500).json({ error: 'Failed to update child' });
  }
});

// DELETE /children/:id
router.delete('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!child) return res.status(404).json({ error: 'Child not found' });

    db.prepare('DELETE FROM children WHERE id = ?').run(req.params.id);
    res.json({ message: 'Child deleted successfully' });
  } catch (err) {
    console.error('Delete child error:', err);
    res.status(500).json({ error: 'Failed to delete child' });
  }
});

// PUT /children/:id/location
router.put('/:id/location', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const { wake_point_x, wake_point_y, safety_radius, room_name } = req.body;

    db.prepare(`
      UPDATE children SET
        wake_point_x = COALESCE(?, wake_point_x),
        wake_point_y = COALESCE(?, wake_point_y),
        safety_radius = COALESCE(?, safety_radius),
        room_name = COALESCE(?, room_name)
      WHERE id = ?
    `).run(wake_point_x, wake_point_y, safety_radius, room_name, req.params.id);

    const updated = db.prepare('SELECT * FROM children WHERE id = ?').get(req.params.id);
    res.json({ child: updated });
  } catch (err) {
    console.error('Update location error:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

export default router;
