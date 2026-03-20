import { Router, Response } from 'express';
import { getDb } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /alerts
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const alerts = db.prepare(
      'SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(req.user!.userId) as any[];

    res.json({ alerts });
  } catch (err) {
    console.error('Get alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// PUT /alerts/:id/read
router.put('/:id/read', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as any;

    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    db.prepare('UPDATE alerts SET read = 1 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Alert marked as read' });
  } catch (err) {
    console.error('Mark alert read error:', err);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

// PUT /alerts/read-all
router.put('/read-all', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    db.prepare('UPDATE alerts SET read = 1 WHERE user_id = ?').run(req.user!.userId);
    res.json({ message: 'All alerts marked as read' });
  } catch (err) {
    console.error('Mark all alerts read error:', err);
    res.status(500).json({ error: 'Failed to mark alerts as read' });
  }
});

// DELETE /alerts/:id
router.delete('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as any;

    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    db.prepare('DELETE FROM alerts WHERE id = ?').run(req.params.id);
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    console.error('Delete alert error:', err);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;
