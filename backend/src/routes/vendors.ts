import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const SUPPORTED_VENDORS = [
  {
    id: 'mock',
    name: 'WakeBot Pro (Demo)',
    logo: '/images/wakebot-logo.png',
    models: ['WakeBot Pro', 'WakeBot Mini', 'WakeBot Ultra'],
    capabilities: ['navigate', 'audio', 'camera', 'obstacle_detection'],
    authType: 'api_key',
  },
  {
    id: 'roomba',
    name: 'iRobot Roomba',
    logo: '/images/roomba-logo.png',
    models: ['Roomba j7+', 'Roomba j9+', 'Roomba Combo j9+'],
    capabilities: ['navigate', 'obstacle_detection'],
    authType: 'oauth2',
    comingSoon: true,
  },
  {
    id: 'roborock',
    name: 'Roborock',
    logo: '/images/roborock-logo.png',
    models: ['S8 Pro Ultra', 'S7 MaxV Ultra', 'Q8 Max'],
    capabilities: ['navigate', 'audio', 'camera', 'obstacle_detection'],
    authType: 'oauth2',
    comingSoon: true,
  },
  {
    id: 'dreame',
    name: 'Dreame',
    logo: '/images/dreame-logo.png',
    models: ['X40 Ultra', 'L20 Ultra', 'X30 Ultra', 'L10 Ultra'],
    capabilities: ['navigate', 'audio', 'camera', 'obstacle_detection'],
    authType: 'api_key',
  },
];

// GET /vendors/supported
router.get('/supported', (req: AuthRequest, res: Response) => {
  res.json({ vendors: SUPPORTED_VENDORS });
});

// POST /vendors/connect
router.post('/connect', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { vendor, apiKey, model } = req.body;

    if (!vendor || !model) {
      return res.status(400).json({ error: 'Vendor and model are required' });
    }

    const vendorInfo = SUPPORTED_VENDORS.find(v => v.id === vendor);
    if (!vendorInfo) {
      return res.status(400).json({ error: 'Unsupported vendor' });
    }

    if (vendorInfo.comingSoon) {
      return res.status(400).json({ error: 'This vendor integration is coming soon' });
    }

    const household = await queryOne<any>('SELECT * FROM households WHERE user_id = $1', [req.user!.userId]);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const existingDevice = await queryOne<any>('SELECT * FROM devices WHERE household_id = $1 AND vendor = $2', [household.id, vendor]);

    if (existingDevice) {
      await execute(
        "UPDATE devices SET model = $1, status = 'idle', battery_level = 100 WHERE id = $2",
        [model, existingDevice.id]
      );

      return res.json({
        message: 'Device updated successfully',
        device: { ...existingDevice, model, status: 'idle' },
      });
    }

    const deviceId = uuidv4();
    await execute(
      'INSERT INTO devices (id, household_id, vendor, model, capabilities, battery_level, firmware_version, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [deviceId, household.id, vendor, model, JSON.stringify(vendorInfo.capabilities), 100, '2.1.4', 'idle']
    );

    await execute('UPDATE households SET vendor_account_id = $1 WHERE id = $2', [apiKey || 'mock-key', household.id]);

    const device = await queryOne<any>('SELECT * FROM devices WHERE id = $1', [deviceId]);

    res.status(201).json({
      message: 'Device connected successfully',
      device: {
        ...device,
        capabilities: JSON.parse(device.capabilities || '[]'),
      },
    });
  } catch (err) {
    console.error('Connect vendor error:', err);
    res.status(500).json({ error: 'Failed to connect vendor' });
  }
});

export default router;
