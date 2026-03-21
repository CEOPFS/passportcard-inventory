import { Router, Response } from 'express';
import { queryOne, queryAll, execute } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /alerts
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const alerts = await queryAll<any>(
      'SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user!.userId]
    );

    res.json({ alerts });
  } catch (err) {
    console.error('Get alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// PUT /alerts/:id/read
router.put('/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const alert = await queryOne<any>('SELECT * FROM alerts WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);

    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    await execute('UPDATE alerts SET read = 1 WHERE id = $1', [req.params.id]);
    res.json({ message: 'Alert marked as read' });
  } catch (err) {
    console.error('Mark alert read error:', err);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

// PUT /alerts/read-all
router.put('/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await execute('UPDATE alerts SET read = 1 WHERE user_id = $1', [req.user!.userId]);
    res.json({ message: 'All alerts marked as read' });
  } catch (err) {
    console.error('Mark all alerts read error:', err);
    res.status(500).json({ error: 'Failed to mark alerts as read' });
  }
});

// DELETE /alerts/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const alert = await queryOne<any>('SELECT * FROM alerts WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);

    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    await execute('DELETE FROM alerts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    console.error('Delete alert error:', err);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;
