import { queryOne, queryAll, execute } from '../database/db';
import { MockAdapter } from '../adapters/mock.adapter';
import { DreameAdapter } from '../adapters/dreame.adapter';
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

async function addLogEntry(sessionId: string, event: string, message: string) {
  const session = await queryOne<any>('SELECT log_entries FROM wake_sessions WHERE id = $1', [sessionId]);
  if (!session) return;

  const logs = JSON.parse(session.log_entries || '[]');
  logs.push({
    timestamp: new Date().toISOString(),
    event,
    message,
  });

  await execute('UPDATE wake_sessions SET log_entries = $1 WHERE id = $2', [JSON.stringify(logs), sessionId]);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class WakeScenarioService {
  static async executeWake(sessionId: string, childId: string, deviceId: string, userId: string): Promise<void> {
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
      const child = await queryOne<any>('SELECT * FROM children WHERE id = $1', [childId]);
      if (!child) throw new Error('Child not found');

      const device = await queryOne<any>('SELECT * FROM devices WHERE id = $1', [deviceId]);
      if (!device) throw new Error('Device not found');

      const household = await queryOne<any>('SELECT * FROM households WHERE id = $1', [device.household_id]);
      let dreameSession: { accessToken: string; did: string } | null = null;

      if (device.vendor === 'dreame' && household?.vendor_account_id) {
        try {
          const creds = JSON.parse(household.vendor_account_id);
          const session = await DreameAdapter.getSession(creds.username, creds.password);
          const devices = await DreameAdapter.getDevices(session.accessToken);
          const dreameDevice = devices[0]; // use first device
          if (dreameDevice) {
            dreameSession = { accessToken: session.accessToken, did: dreameDevice.did };
          }
        } catch (err) {
          console.error('Dreame session error:', err);
          // fall through to mock behavior
        }
      }

      await execute("UPDATE devices SET status = 'navigating' WHERE id = $1", [deviceId]);
      await addLogEntry(sessionId, 'navigating', `הרובוט מנווט לחדרו של ${child.name}`);

      emitToUser(userId, 'wake:update', {
        sessionId,
        state: 'NAVIGATING',
        message: `הרובוט מנווט לחדרו של ${child.name}`,
        childName: child.name,
      });

      // Send real navigation command if Dreame device
      if (dreameSession) {
        try {
          const roomX = child.wake_point_x ?? 400;
          const roomY = child.wake_point_y ?? 300;
          await DreameAdapter.navigateTo(dreameSession.accessToken, dreameSession.did, roomX, roomY);
        } catch (err) {
          console.error('Dreame navigate error:', err);
        }
      }

      await sleep(5000);

      if (session.stopped) {
        if (dreameSession) {
          await DreameAdapter.stop(dreameSession.accessToken, dreameSession.did).catch(() => {});
        }
        await this.finishSession(sessionId, deviceId, userId, 'stopped', 'הסשן הופסק');
        return;
      }

      session.state = 'ARRIVED';
      await execute("UPDATE devices SET status = 'playing_audio' WHERE id = $1", [deviceId]);
      await addLogEntry(sessionId, 'arrived', `הרובוט הגיע לחדרו של ${child.name}`);

      emitToUser(userId, 'wake:update', {
        sessionId,
        state: 'ARRIVED',
        message: `הרובוט הגיע לחדרו של ${child.name}!`,
        childName: child.name,
      });

      const messagesList = await queryAll<any>(
        'SELECT * FROM wake_messages WHERE child_id = $1 AND is_active = 1 ORDER BY order_index',
        [childId]
      );

      let attempts = 0;
      const maxAttempts = 3;
      let childAwake = false;

      while (attempts < maxAttempts && !session.stopped) {
        attempts++;
        session.state = 'PLAYING_MESSAGE';

        await execute('UPDATE wake_sessions SET attempts_count = $1 WHERE id = $2', [attempts, sessionId]);

        if (messagesList.length > 0) {
          const msg = messagesList[(attempts - 1) % messagesList.length];
          await addLogEntry(sessionId, 'playing_audio', `מנגן הקלטה: ${msg.label || 'הקלטה ' + attempts}`);

          emitToUser(userId, 'wake:update', {
            sessionId,
            state: 'PLAYING_MESSAGE',
            message: `מנגן הודעת השכמה מספר ${attempts}`,
            childName: child.name,
            attempt: attempts,
          });

          // Play audio on real Dreame device
          if (dreameSession) {
            await DreameAdapter.playAudio(dreameSession.accessToken, dreameSession.did).catch(() => {});
          }

          await sleep(4000);
        } else {
          await addLogEntry(sessionId, 'playing_audio', 'מנגן צפצוף ברירת מחדל');
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

        session.state = 'OBSERVING';
        await addLogEntry(sessionId, 'observing', 'בודק אם הילד התעורר');

        emitToUser(userId, 'wake:update', {
          sessionId,
          state: 'OBSERVING',
          message: 'בודק אם הילד התעורר...',
          childName: child.name,
        });

        await sleep(3000);

        const wakeDetection = MockAdapter.simulateWakeDetection();
        const wakeChance = 0.3 + (attempts * 0.25);

        if (wakeDetection.confidence > (1 - wakeChance)) {
          childAwake = true;
          session.state = 'AWAKE';

          await execute('UPDATE wake_sessions SET wake_confidence = $1 WHERE id = $2', [wakeDetection.confidence, sessionId]);
          await addLogEntry(sessionId, 'child_awake', `${child.name} התעורר! (ביטחון: ${Math.round(wakeDetection.confidence * 100)}%)`);

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
          await addLogEntry(sessionId, 'retry', `ניסיון ${attempts} נכשל, מנסה שוב...`);

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
          session.state = 'NOTIFY_PARENT';
          await addLogEntry(sessionId, 'notify_parent', 'לא הצלחנו להעיר את הילד, שולחים התראה להורה');

          emitToUser(userId, 'wake:update', {
            sessionId,
            state: 'NOTIFY_PARENT',
            message: `לא הצלחנו להעיר את ${child.name}, שולחים התראה`,
            childName: child.name,
          });

          await execute(
            'INSERT INTO alerts (id, user_id, type, message, child_id, session_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [uuidv4(), userId, 'wake_failed', `לא הצלחנו להעיר את ${child.name} לאחר ${maxAttempts} ניסיונות. יתכן שנדרשת התערבות ידנית.`, childId, sessionId]
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
      await addLogEntry(sessionId, 'error', `שגיאה: ${err}`);
      await this.finishSession(sessionId, deviceId, userId, 'error', 'שגיאה בסשן ההשכמה');
    } finally {
      activeSessions.delete(sessionId);
    }
  }

  static async finishSession(sessionId: string, deviceId: string, userId: string, status: string, message: string): Promise<void> {
    const now = new Date().toISOString();

    await execute(
      'UPDATE wake_sessions SET result_status = $1, completed_at = $2 WHERE id = $3',
      [status, now, sessionId]
    );

    await execute("UPDATE devices SET status = 'idle' WHERE id = $1", [deviceId]);
    await addLogEntry(sessionId, 'session_complete', message);

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
