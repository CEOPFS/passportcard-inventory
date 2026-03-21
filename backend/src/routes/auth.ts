import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
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

// POST /auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await queryOne<any>('SELECT id, name FROM users WHERE email = $1', [email]);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'אם האימייל קיים במערכת, ישלח קוד לאיפוס סיסמה' });
    }

    const token = crypto.randomBytes(6).toString('hex').toUpperCase();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await execute(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [token, expiry.toISOString(), user.id]
    );

    // Log to console (admin can see in Render logs)
    console.log(`[PASSWORD RESET] ${email} → token: ${token}`);

    res.json({ message: 'אם האימייל קיים במערכת, ישלח קוד לאיפוס סיסמה', debug_token: process.env.NODE_ENV !== 'production' ? token : undefined });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await queryOne<any>(
      'SELECT id FROM users WHERE email = $1 AND reset_token = $2 AND reset_token_expiry > NOW()',
      [email, token.toUpperCase()]
    );

    if (!user) {
      return res.status(400).json({ error: 'קוד שגוי או שפג תוקפו. בקש קוד חדש' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await execute(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    res.json({ message: 'הסיסמה עודכנה בהצלחה' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
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
