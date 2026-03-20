import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
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

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const householdId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, locale, timezone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, name, email, passwordHash, locale, timezone);

    db.prepare(`
      INSERT INTO households (id, user_id, home_name)
      VALUES (?, ?, ?)
    `).run(householdId, userId, `הבית של ${name}`);

    // Create a mock device for the household
    const deviceId = uuidv4();
    db.prepare(`
      INSERT INTO devices (id, household_id, vendor, model, capabilities, battery_level, firmware_version, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      deviceId,
      householdId,
      'mock',
      'WakeBot Pro',
      JSON.stringify(['navigate', 'audio', 'camera', 'obstacle_detection']),
      87,
      '2.1.4',
      'idle'
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

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const household = db.prepare('SELECT * FROM households WHERE user_id = ?').get(user.id) as any;
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
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, locale, timezone, notification_prefs, created_at FROM users WHERE id = ?').get(req.user!.userId) as any;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const household = db.prepare('SELECT * FROM households WHERE user_id = ?').get(user.id) as any;

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
