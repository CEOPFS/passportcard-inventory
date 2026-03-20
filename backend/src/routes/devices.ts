import { Router, Response } from 'express';
import { getDb } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { MockAdapter } from '../adapters/mock.adapter';

const router = Router();

function getUserDevices(userId: string) {
  const db = getDb();
  const household = db.prepare('SELECT * FROM households WHERE user_id = ?').get(userId) as any;
  if (!household) return [];

  const devices = db.prepare('SELECT * FROM devices WHERE household_id = ?').all(household.id) as any[];
  return devices.map(d => ({
    ...d,
    capabilities: JSON.parse(d.capabilities || '[]'),
    map_data: JSON.parse(d.map_data || '{}'),
  }));
}

// GET /devices
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const devices = getUserDevices(req.user!.userId);
    res.json({ devices });
  } catch (err) {
    console.error('Get devices error:', err);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// GET /devices/:id
router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const household = db.prepare('SELECT * FROM households WHERE user_id = ?').get(req.user!.userId) as any;
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = db.prepare('SELECT * FROM devices WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!device) return res.status(404).json({ error: 'Device not found' });

    res.json({
      device: {
        ...device,
        capabilities: JSON.parse(device.capabilities || '[]'),
        map_data: JSON.parse(device.map_data || '{}'),
      },
    });
  } catch (err) {
    console.error('Get device error:', err);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// GET /devices/:id/map
router.get('/:id/map', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const household = db.prepare('SELECT * FROM households WHERE user_id = ?').get(req.user!.userId) as any;
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = db.prepare('SELECT * FROM devices WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const mapData = JSON.parse(device.map_data || '{}');

    // Return mock map if empty
    if (!mapData.rooms) {
      const mockMap = MockAdapter.generateMockMap();
      res.json({ map: mockMap });
    } else {
      res.json({ map: mapData });
    }
  } catch (err) {
    console.error('Get map error:', err);
    res.status(500).json({ error: 'Failed to fetch map' });
  }
});

// POST /devices/:id/navigate
router.post('/:id/navigate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { x, y, childId } = req.body;
    const db = getDb();
    const household = db.prepare('SELECT * FROM households WHERE user_id = ?').get(req.user!.userId) as any;
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = db.prepare('SELECT * FROM devices WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!device) return res.status(404).json({ error: 'Device not found' });

    db.prepare('UPDATE devices SET status = ? WHERE id = ?').run('navigating', req.params.id);

    res.json({
      message: 'Navigation started',
      status: 'navigating',
      target: { x, y },
      estimatedTime: Math.floor(Math.random() * 30) + 15,
    });
  } catch (err) {
    console.error('Navigate error:', err);
    res.status(500).json({ error: 'Failed to start navigation' });
  }
});

// POST /devices/:id/stop
router.post('/:id/stop', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const household = db.prepare('SELECT * FROM households WHERE user_id = ?').get(req.user!.userId) as any;
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = db.prepare('SELECT * FROM devices WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!device) return res.status(404).json({ error: 'Device not found' });

    db.prepare('UPDATE devices SET status = ? WHERE id = ?').run('idle', req.params.id);

    res.json({ message: 'Device stopped', status: 'idle' });
  } catch (err) {
    console.error('Stop error:', err);
    res.status(500).json({ error: 'Failed to stop device' });
  }
});

// POST /devices/:id/play-audio
router.post('/:id/play-audio', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { filePath, volume = 0.8 } = req.body;
    const db = getDb();
    const household = db.prepare('SELECT * FROM households WHERE user_id = ?').get(req.user!.userId) as any;
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = db.prepare('SELECT * FROM devices WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!device) return res.status(404).json({ error: 'Device not found' });

    res.json({
      message: 'Audio playback started',
      filePath,
      volume,
      duration: Math.floor(Math.random() * 10) + 3,
    });
  } catch (err) {
    console.error('Play audio error:', err);
    res.status(500).json({ error: 'Failed to play audio' });
  }
});

// GET /devices/:id/status
router.get('/:id/status', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const household = db.prepare('SELECT * FROM households WHERE user_id = ?').get(req.user!.userId) as any;
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = db.prepare('SELECT * FROM devices WHERE id = ? AND household_id = ?').get(req.params.id, household.id) as any;
    if (!device) return res.status(404).json({ error: 'Device not found' });

    res.json({
      status: device.status,
      battery_level: device.battery_level,
      position: {
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Device status error:', err);
    res.status(500).json({ error: 'Failed to fetch device status' });
  }
});

export default router;
