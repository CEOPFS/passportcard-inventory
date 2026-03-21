import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { DreameAdapter } from '../adapters/dreame.adapter';

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
    authType: 'credentials',
  },
];

// GET /vendors/supported
router.get('/supported', (req: AuthRequest, res: Response) => {
  res.json({ vendors: SUPPORTED_VENDORS });
});

// POST /vendors/connect
router.post('/connect', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { vendor, apiKey, username, password, model } = req.body;

    if (!vendor || !model) {
      return res.status(400).json({ error: 'Vendor and model are required' });
    }

    const vendorInfo = SUPPORTED_VENDORS.find(v => v.id === vendor);
    if (!vendorInfo) {
      return res.status(400).json({ error: 'Unsupported vendor' });
    }

    if ((vendorInfo as any).comingSoon) {
      return res.status(400).json({ error: 'This vendor integration is coming soon' });
    }

    // Validate Dreame credentials by actually logging in
    let dreameDid: string | null = null;
    if (vendor === 'dreame') {
      if (!username || !password) {
        return res.status(400).json({ error: 'יש לספק אימייל וסיסמה של DreameHome' });
      }
      try {
        const dreameSession = await DreameAdapter.login(username, password);
        const devices = await DreameAdapter.getDevices(dreameSession.accessToken);
        if (devices.length > 0) {
          dreameDid = devices[0].did;
          console.log('[Dreame] Found device did at connect time:', dreameDid);
        } else {
          console.warn('[Dreame] Login succeeded but no devices found — allowing connection anyway');
        }
      } catch (err: any) {
        return res.status(401).json({ error: `חיבור ל-Dreame נכשל: ${err.message}` });
      }
    }

    const household = await queryOne<any>('SELECT * FROM households WHERE user_id = $1', [req.user!.userId]);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    const existingDevice = await queryOne<any>('SELECT * FROM devices WHERE household_id = $1 AND vendor = $2', [household.id, vendor]);

    const credentialsToStore = vendor === 'dreame'
      ? JSON.stringify({ username, password, ...(dreameDid ? { did: dreameDid } : {}) })
      : (apiKey || 'mock-key');

    await execute('UPDATE households SET vendor_account_id = $1 WHERE id = $2', [credentialsToStore, household.id]);

    if (existingDevice) {
      await execute(
        "UPDATE devices SET model = $1, status = 'idle', battery_level = 100 WHERE id = $2",
        [model, existingDevice.id]
      );
      const updated = await queryOne<any>('SELECT * FROM devices WHERE id = $1', [existingDevice.id]);

      // Fire-and-forget: beep the robot to confirm connection
      if (dreameDid) {
        (async () => {
          try {
            const beepSession = await DreameAdapter.getSession(username, password);
            await DreameAdapter.playConnectedBeep(beepSession.accessToken, dreameDid);
            console.log('[Dreame] Connected beep sent');
          } catch (err) {
            console.error('[Dreame] Connected beep failed:', err);
          }
        })();
      }

      return res.json({
        message: 'Device updated successfully',
        justConnected: true,
        device: {
          ...updated,
          capabilities: JSON.parse(updated.capabilities || '[]'),
          did: dreameDid || null,
        },
      });
    }

    const deviceId = uuidv4();
    await execute(
      'INSERT INTO devices (id, household_id, vendor, model, capabilities, battery_level, firmware_version, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [deviceId, household.id, vendor, model, JSON.stringify(vendorInfo.capabilities), 100, '2.1.4', 'idle']
    );

    const device = await queryOne<any>('SELECT * FROM devices WHERE id = $1', [deviceId]);

    // Fire-and-forget: beep the robot to confirm connection
    if (dreameDid) {
      (async () => {
        try {
          const beepSession = await DreameAdapter.getSession(username, password);
          await DreameAdapter.playConnectedBeep(beepSession.accessToken, dreameDid);
          console.log('[Dreame] Connected beep sent');
        } catch (err) {
          console.error('[Dreame] Connected beep failed:', err);
        }
      })();
    }

    res.status(201).json({
      message: 'Device connected successfully',
      justConnected: true,
      device: {
        ...device,
        capabilities: JSON.parse(device.capabilities || '[]'),
        did: dreameDid || null,
      },
    });
  } catch (err) {
    console.error('Connect vendor error:', err);
    res.status(500).json({ error: 'Failed to connect vendor' });
  }
});

export default router;
