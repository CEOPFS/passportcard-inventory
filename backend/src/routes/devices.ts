import { Router, Response } from 'express';
import { queryOne, queryAll, execute } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { MockAdapter } from '../adapters/mock.adapter';

const router = Router();

async function getUserDevices(userId: string) {
  const household = await queryOne<any>('SELECT * FROM households WHERE user_id = $1', [userId]);
  if (!household) return [];

  const devices = await queryAll<any>('SELECT * FROM devices WHERE household_id = $1', [household.id]);
  return devices.map(d => ({
    ...d,
    capabilities: JSON.parse(d.capabilities || '[]'),
    map_data: JSON.parse(d.map_data || '{}'),
  }));
}

// GET /devices
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const devices = await getUserDevices(req.user!.userId);
    res.json({ devices });
  } catch (err) {
    console.error('Get devices error:', err);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// GET /devices/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await queryOne<any>('SELECT * FROM households WHERE user_id = $1', [req.user!.userId]);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = await queryOne<any>('SELECT * FROM devices WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
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
router.get('/:id/map', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await queryOne<any>('SELECT * FROM households WHERE user_id = $1', [req.user!.userId]);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = await queryOne<any>('SELECT * FROM devices WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const mapData = JSON.parse(device.map_data || '{}');

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
    const { x, y } = req.body;
    const household = await queryOne<any>('SELECT * FROM households WHERE user_id = $1', [req.user!.userId]);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = await queryOne<any>('SELECT * FROM devices WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    await execute('UPDATE devices SET status = $1 WHERE id = $2', ['navigating', req.params.id]);

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
router.post('/:id/stop', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await queryOne<any>('SELECT * FROM households WHERE user_id = $1', [req.user!.userId]);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = await queryOne<any>('SELECT * FROM devices WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    await execute('UPDATE devices SET status = $1 WHERE id = $2', ['idle', req.params.id]);

    res.json({ message: 'Device stopped', status: 'idle' });
  } catch (err) {
    console.error('Stop error:', err);
    res.status(500).json({ error: 'Failed to stop device' });
  }
});

// POST /devices/:id/play-audio
router.post('/:id/play-audio', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { filePath, volume = 0.8 } = req.body;
    const household = await queryOne<any>('SELECT * FROM households WHERE user_id = $1', [req.user!.userId]);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = await queryOne<any>('SELECT * FROM devices WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
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
router.get('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const household = await queryOne<any>('SELECT * FROM households WHERE user_id = $1', [req.user!.userId]);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const device = await queryOne<any>('SELECT * FROM devices WHERE id = $1 AND household_id = $2', [req.params.id, household.id]);
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
