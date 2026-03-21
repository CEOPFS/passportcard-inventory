import { Router, Response, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { queryOne, queryAll, execute } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { uploadAudio } from '../middleware/upload';

const router = Router({ mergeParams: true });

async function getUserHousehold(userId: string) {
  return queryOne<any>('SELECT * FROM households WHERE user_id = $1', [userId]);
}

// POST /children/:id/messages - Upload audio message
router.post('/', authenticateToken, uploadAudio.single('audio'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const child = await queryOne<any>('SELECT * FROM children WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
    if (!child) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Child not found' });
    }

    const { label, volume = 0.8, duration = 0 } = req.body;

    const maxRow = await queryOne<any>('SELECT MAX(order_index) as max FROM wake_messages WHERE child_id = $1', [req.params.id]);
    const orderIndex = (maxRow?.max ?? -1) + 1;

    const messageId = uuidv4();

    await execute(
      'INSERT INTO wake_messages (id, child_id, file_path, duration, order_index, volume, is_active, label) VALUES ($1, $2, $3, $4, $5, $6, 1, $7)',
      [messageId, req.params.id, req.file.path, parseFloat(duration) || 0, orderIndex, parseFloat(volume), label || `הקלטה ${orderIndex + 1}`]
    );

    const message = await queryOne<any>('SELECT * FROM wake_messages WHERE id = $1', [messageId]);
    res.status(201).json({ message });
  } catch (err) {
    console.error('Upload message error:', err);
    res.status(500).json({ error: 'Failed to upload audio message' });
  }
});

// GET /children/:id/messages
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const child = await queryOne<any>('SELECT * FROM children WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const messages = await queryAll<any>('SELECT * FROM wake_messages WHERE child_id = $1 ORDER BY order_index', [req.params.id]);
    res.json({ messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// DELETE /messages/:messageId
router.delete('/:messageId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const message = await queryOne<any>(`
      SELECT wm.* FROM wake_messages wm
      JOIN children c ON wm.child_id = c.id
      WHERE wm.id = $1 AND c.household_id = $2
    `, [req.params.messageId, household.id]);

    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (fs.existsSync(message.file_path)) {
      fs.unlinkSync(message.file_path);
    }

    await execute('DELETE FROM wake_messages WHERE id = $1', [req.params.messageId]);
    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// PUT /messages/:messageId/order
router.put('/:messageId/order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { order_index } = req.body;
    const household = await getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const message = await queryOne<any>(`
      SELECT wm.* FROM wake_messages wm
      JOIN children c ON wm.child_id = c.id
      WHERE wm.id = $1 AND c.household_id = $2
    `, [req.params.messageId, household.id]);

    if (!message) return res.status(404).json({ error: 'Message not found' });

    await execute('UPDATE wake_messages SET order_index = $1 WHERE id = $2', [order_index, req.params.messageId]);

    const updated = await queryOne<any>('SELECT * FROM wake_messages WHERE id = $1', [req.params.messageId]);
    res.json({ message: updated });
  } catch (err) {
    console.error('Update message order error:', err);
    res.status(500).json({ error: 'Failed to update message order' });
  }
});

export default router;
