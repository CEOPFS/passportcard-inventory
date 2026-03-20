import { Router, Response, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { uploadAudio } from '../middleware/upload';

const router = Router({ mergeParams: true });

function getUserHousehold(userId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM households WHERE user_id = ?').get(userId) as any;
}

// POST /children/:id/messages - Upload audio message
router.post('/', authenticateToken, uploadAudio.single('audio'), (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!child) {
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Child not found' });
    }

    const { label, volume = 0.8, duration = 0 } = req.body;

    // Get next order index
    const maxOrder = db.prepare('SELECT MAX(order_index) as max FROM wake_messages WHERE child_id = ?').get(req.params.id) as any;
    const orderIndex = (maxOrder?.max ?? -1) + 1;

    const messageId = uuidv4();
    const relativePath = path.relative(process.cwd(), req.file.path);

    db.prepare(`
      INSERT INTO wake_messages (id, child_id, file_path, duration, order_index, volume, is_active, label)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(messageId, req.params.id, req.file.path, parseFloat(duration) || 0, orderIndex, parseFloat(volume), label || `הקלטה ${orderIndex + 1}`);

    const message = db.prepare('SELECT * FROM wake_messages WHERE id = ?').get(messageId);
    res.status(201).json({ message });
  } catch (err) {
    console.error('Upload message error:', err);
    res.status(500).json({ error: 'Failed to upload audio message' });
  }
});

// GET /children/:id/messages
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const messages = db.prepare('SELECT * FROM wake_messages WHERE child_id = ? ORDER BY order_index').all(req.params.id) as any[];
    res.json({ messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// DELETE /messages/:messageId
router.delete('/:messageId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();

    // Check message belongs to user's child
    const message = db.prepare(`
      SELECT wm.* FROM wake_messages wm
      JOIN children c ON wm.child_id = c.id
      WHERE wm.id = ? AND c.household_id = ?
    `).get(req.params.messageId, household.id) as any;

    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Delete file
    if (fs.existsSync(message.file_path)) {
      fs.unlinkSync(message.file_path);
    }

    db.prepare('DELETE FROM wake_messages WHERE id = ?').run(req.params.messageId);
    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// PUT /messages/:messageId/order
router.put('/:messageId/order', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { order_index } = req.body;
    const household = getUserHousehold(req.user!.userId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const db = getDb();
    const message = db.prepare(`
      SELECT wm.* FROM wake_messages wm
      JOIN children c ON wm.child_id = c.id
      WHERE wm.id = ? AND c.household_id = ?
    `).get(req.params.messageId, household.id) as any;

    if (!message) return res.status(404).json({ error: 'Message not found' });

    db.prepare('UPDATE wake_messages SET order_index = ? WHERE id = ?').run(order_index, req.params.messageId);

    const updated = db.prepare('SELECT * FROM wake_messages WHERE id = ?').get(req.params.messageId);
    res.json({ message: updated });
  } catch (err) {
    console.error('Update message order error:', err);
    res.status(500).json({ error: 'Failed to update message order' });
  }
});

export default router;
