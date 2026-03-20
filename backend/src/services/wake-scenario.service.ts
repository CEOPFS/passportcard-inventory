import { getDb } from '../database/db';
import { MockAdapter } from '../adapters/mock.adapter';
import { v4 as uuidv4 } from 'uuid';

type WakeState = 'NAVIGATING' | 'ARRIVED' | 'PLAYING_MESSAGE' | 'OBSERVING' | 'AWAKE' | 'RETRY' | 'NOTIFY_PARENT' | 'COMPLETE';

interface ActiveSession {
  sessionId: string;
  childId: string;
  deviceId: string;
  userId: string;
  stopped: boolean;
  state: WakeState;
}

const activeSessions = new Map<string, ActiveSession>();

let ioInstance: any = null;

export function setSocketIO(io: any) {
  ioInstance = io;
}

function emitToUser(userId: string, event: string, data: any) {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit(event, data);
  }
}

function addLogEntry(sessionId: string, event: string, message: string) {
  const db = getDb();
  const session = db.prepare('SELECT log_entries FROM wake_sessions WHERE id = ?').get(sessionId) as any;
  if (!session) return;

  const logs = JSON.parse(session.log_entries || '[]');
  logs.push({
    timestamp: new Date().toISOString(),
    event,
    message,
  });

  db.prepare('UPDATE wake_sessions SET log_entries = ? WHERE id = ?').run(JSON.stringify(logs), sessionId);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class WakeScenarioService {
  static async executeWake(sessionId: string, childId: string, deviceId: string, userId: string): Promise<void> {
    const db = getDb();

    const session: ActiveSession = {
      sessionId,
      childId,
      deviceId,
      userId,
      stopped: false,
      state: 'NAVIGATING',
    };

    activeSessions.set(sessionId, session);

    try {
      const child = db.prepare('SELECT * FROM children WHERE id = ?').get(childId) as any;
      if (!child) throw new Error('Child not found');

      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any;
      if (!device) throw new Error('Device not found');

      // Update device status
      db.prepare("UPDATE devices SET status = 'navigating' WHERE id = ?").run(deviceId);
      addLogEntry(sessionId, 'navigating', `הרובוט מנווט לחדרו של ${child.name}`);

      emitToUser(userId, 'wake:update', {
        sessionId,
        state: 'NAVIGATING',
        message: `הרובוט מנווט לחדרו של ${child.name}`,
        childName: child.name,
      });

      // Simulate navigation time (15-30 seconds in real, 5 seconds for demo)
      await sleep(5000);

      if (session.stopped) {
        await this.finishSession(sessionId, deviceId, userId, 'stopped', 'הסשן הופסק');
        return;
      }

      // ARRIVED state
      session.state = 'ARRIVED';
      db.prepare("UPDATE devices SET status = 'playing_audio' WHERE id = ?").run(deviceId);
      addLogEntry(sessionId, 'arrived', `הרובוט הגיע לחדרו של ${child.name}`);

      emitToUser(userId, 'wake:update', {
        sessionId,
        state: 'ARRIVED',
        message: `הרובוט הגיע לחדרו של ${child.name}!`,
        childName: child.name,
      });

      // Get wake messages
      const messages = db.prepare(
        'SELECT * FROM wake_messages WHERE child_id = ? AND is_active = 1 ORDER BY order_index'
      ).all(childId) as any[];

      let attempts = 0;
      const maxAttempts = 3;
      let childAwake = false;

      while (attempts < maxAttempts && !session.stopped) {
        attempts++;
        session.state = 'PLAYING_MESSAGE';

        db.prepare('UPDATE wake_sessions SET attempts_count = ? WHERE id = ?').run(attempts, sessionId);

        if (messages.length > 0) {
          const message = messages[(attempts - 1) % messages.length];
          addLogEntry(sessionId, 'playing_audio', `מנגן הקלטה: ${message.label || 'הקלטה ' + attempts}`);

          emitToUser(userId, 'wake:update', {
            sessionId,
            state: 'PLAYING_MESSAGE',
            message: `מנגן הודעת השכמה מספר ${attempts}`,
            childName: child.name,
            attempt: attempts,
          });

          // Simulate audio playback
          await sleep(4000);
        } else {
          // No messages - play default beep
          addLogEntry(sessionId, 'playing_audio', 'מנגן צפצוף ברירת מחדל');
          emitToUser(userId, 'wake:update', {
            sessionId,
            state: 'PLAYING_MESSAGE',
            message: 'מנגן צפצוף התעוררות',
            childName: child.name,
            attempt: attempts,
          });
          await sleep(3000);
        }

        if (session.stopped) break;

        // OBSERVING state - check if child is awake
        session.state = 'OBSERVING';
        addLogEntry(sessionId, 'observing', 'בודק אם הילד התעורר');

        emitToUser(userId, 'wake:update', {
          sessionId,
          state: 'OBSERVING',
          message: 'בודק אם הילד התעורר...',
          childName: child.name,
        });

        await sleep(3000);

        // Simulate wake detection (increases chance with more attempts)
        const wakeDetection = MockAdapter.simulateWakeDetection();
        const wakeChance = 0.3 + (attempts * 0.25); // 30%, 55%, 80%

        if (wakeDetection.confidence > (1 - wakeChance)) {
          childAwake = true;
          session.state = 'AWAKE';

          db.prepare('UPDATE wake_sessions SET wake_confidence = ? WHERE id = ?').run(wakeDetection.confidence, sessionId);
          addLogEntry(sessionId, 'child_awake', `${child.name} התעורר! (ביטחון: ${Math.round(wakeDetection.confidence * 100)}%)`);

          emitToUser(userId, 'wake:update', {
            sessionId,
            state: 'AWAKE',
            message: `${child.name} התעורר בהצלחה!`,
            childName: child.name,
            confidence: wakeDetection.confidence,
          });

          break;
        } else if (attempts < maxAttempts) {
          session.state = 'RETRY';
          addLogEntry(sessionId, 'retry', `ניסיון ${attempts} נכשל, מנסה שוב...`);

          emitToUser(userId, 'wake:update', {
            sessionId,
            state: 'RETRY',
            message: `${child.name} עדיין ישן, מנסה שנית...`,
            childName: child.name,
            attempt: attempts,
          });

          await sleep(2000);
        }
      }

      if (!session.stopped) {
        if (childAwake) {
          await this.finishSession(sessionId, deviceId, userId, 'success', `${child.name} התעורר בהצלחה`);
        } else {
          // Notify parent
          session.state = 'NOTIFY_PARENT';
          addLogEntry(sessionId, 'notify_parent', 'לא הצלחנו להעיר את הילד, שולחים התראה להורה');

          emitToUser(userId, 'wake:update', {
            sessionId,
            state: 'NOTIFY_PARENT',
            message: `לא הצלחנו להעיר את ${child.name}, שולחים התראה`,
            childName: child.name,
          });

          // Create alert
          db.prepare(`
            INSERT INTO alerts (id, user_id, type, message, child_id, session_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            userId,
            'wake_failed',
            `לא הצלחנו להעיר את ${child.name} לאחר ${maxAttempts} ניסיונות. יתכן שנדרשת התערבות ידנית.`,
            childId,
            sessionId
          );

          emitToUser(userId, 'alert:new', {
            type: 'wake_failed',
            message: `לא הצלחנו להעיר את ${child.name}`,
            childId,
            sessionId,
          });

          await this.finishSession(sessionId, deviceId, userId, 'failed', 'ההשכמה נכשלה לאחר מספר ניסיונות');
        }
      }
    } catch (err) {
      console.error('Wake scenario error:', err);
      addLogEntry(sessionId, 'error', `שגיאה: ${err}`);
      await this.finishSession(sessionId, deviceId, userId, 'error', 'שגיאה בסשן ההשכמה');
    } finally {
      activeSessions.delete(sessionId);
    }
  }

  static async finishSession(sessionId: string, deviceId: string, userId: string, status: string, message: string): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE wake_sessions SET
        result_status = ?,
        completed_at = ?
      WHERE id = ?
    `).run(status, now, sessionId);

    db.prepare("UPDATE devices SET status = 'idle' WHERE id = ?").run(deviceId);
    addLogEntry(sessionId, 'session_complete', message);

    emitToUser(userId, 'wake:complete', {
      sessionId,
      status,
      message,
    });
  }

  static stopSession(sessionId: string): void {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.stopped = true;
    }
  }

  static getActiveSession(sessionId: string): ActiveSession | undefined {
    return activeSessions.get(sessionId);
  }
}
