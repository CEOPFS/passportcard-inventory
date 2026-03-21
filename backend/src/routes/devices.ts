import { Router, Response } from 'express';
import { queryOne, queryAll, execute } from '../database/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { MockAdapter } from '../adapters/mock.adapter';
import { DreameAdapter } from '../adapters/dreame.adapter';

const router = Router();

const ROOM_COLORS = ['#B3D9FF','#FFD6B3','#B3FFD9','#FFB3D9','#D9B3FF','#FFFAB3','#B3FFF0'];
const ROOM_NAMES_HE: Record<string, string> = {
  bedroom: 'חדר שינה', living: 'סלון', kitchen: 'מטבח',
  bathroom: 'חדר אמבטיה', hallway: 'מסדרון', room: 'חדר', office: 'חדר עבודה',
};

function parseDreameMap(raw: any): any | null {
  try {
    const d = raw?.data;
    if (!d) return null;

    // Shape 1: data.mapInfo with rooms array
    const roomsRaw: any[] = d.mapInfo?.rooms || d.rooms || d.roomInfo || d.segmentList || [];
    // Shape 2: data.mapUrl — real rendered map image from Dreame cloud
    const mapImageUrl: string | undefined = d.mapUrl || d.map_url || d.imageUrl || undefined;

    if (roomsRaw.length === 0 && !mapImageUrl) return null;

    const W = 800, H = 600;
    const rooms = roomsRaw.map((r: any, i: number) => {
      const nameLower = (r.name || r.roomName || r.customName || 'room').toLowerCase();
      const heKey = Object.keys(ROOM_NAMES_HE).find(k => nameLower.includes(k)) || 'room';
      const nameHe = ROOM_NAMES_HE[heKey] + (roomsRaw.length > 1 ? ` ${i + 1}` : '');
      // Use coordinates if available, otherwise lay them out in a grid
      const col = i % 3, row = Math.floor(i / 3);
      return {
        id: String(r.id || r.roomId || i),
        name: r.name || r.roomName || `Room ${i + 1}`,
        nameHe,
        x: r.x ?? (col * 250 + 50),
        y: r.y ?? (row * 200 + 50),
        width: r.width ?? 200,
        height: r.height ?? 150,
        color: ROOM_COLORS[i % ROOM_COLORS.length],
      };
    });

    return {
      width: d.width || W,
      height: d.height || H,
      rooms,
      robotPosition: d.robotPosition || { x: W / 2, y: H / 2 },
      forbiddenZones: d.forbiddenZones || [],
      chargingStation: d.chargingStation || d.chargeStation || { x: 50, y: 50 },
      ...(mapImageUrl ? { mapImageUrl } : {}),
    };
  } catch (err) {
    console.error('[Dreame] parseDreameMap error:', err);
    return null;
  }
}

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

    // Try to fetch real map from Dreame
    if (device.vendor === 'dreame' && household.vendor_account_id) {
      try {
        const creds = JSON.parse(household.vendor_account_id);
        if (creds.username && creds.password && creds.did) {
          const session = await DreameAdapter.getSession(creds.username, creds.password);
          const mapResult = await DreameAdapter.getMap(session.accessToken, creds.did);
          if (mapResult) {
            const parsedMap = parseDreameMap(mapResult);
            if (parsedMap) {
              await execute('UPDATE devices SET map_data = $1 WHERE id = $2', [JSON.stringify(parsedMap), device.id]);
              return res.json({ map: parsedMap, source: 'dreame' });
            }
          }
        }
      } catch (err) {
        console.error('[Dreame] getMap error:', err);
      }
    }

    const mapData = JSON.parse(device.map_data || '{}');
    if (mapData.rooms) {
      return res.json({ map: mapData, source: 'cached' });
    }

    const mockMap = MockAdapter.generateMockMap();
    res.json({ map: mockMap, source: 'mock' });
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
