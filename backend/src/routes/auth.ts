import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute } from '../database/db';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, locale = 'he', timezone = 'Asia/Jerusalem' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const householdId = uuidv4();

    await execute(
      'INSERT INTO users (id, name, email, password_hash, locale, timezone) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, name, email, passwordHash, locale, timezone]
    );

    await execute(
      'INSERT INTO households (id, user_id, home_name) VALUES ($1, $2, $3)',
      [householdId, userId, `הבית של ${name}`]
    );

    const deviceId = uuidv4();
    await execute(
      'INSERT INTO devices (id, household_id, vendor, model, capabilities, battery_level, firmware_version, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [deviceId, householdId, 'mock', 'WakeBot Pro', JSON.stringify(['navigate', 'audio', 'camera', 'obstacle_detection']), 87, '2.1.4', 'idle']
    );

    const token = generateToken(userId, email);

    res.status(201).json({
      token,
      user: { id: userId, name, email, locale, timezone },
      household: { id: householdId, home_name: `הבית של ${name}` },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await queryOne<any>('SELECT * FROM users WHERE email = $1', [email]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const household = await queryOne<any>('SELECT * FROM households WHERE user_id = $1', [user.id]);
    const token = generateToken(user.id, user.email);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        locale: user.locale,
        timezone: user.timezone,
      },
      household,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await queryOne<any>(
      'SELECT id, name, email, locale, timezone, notification_prefs, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const household = await queryOne<any>('SELECT * FROM households WHERE user_id = $1', [user.id]);

    res.json({
      user: {
        ...user,
        notification_prefs: JSON.parse(user.notification_prefs || '{}'),
      },
      household,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
