import cron from 'node-cron';
import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { WakeScenarioService } from './wake-scenario.service';

let schedulerStarted = false;

export function startScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Run every minute to check schedules
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const currentDay = now.getDay(); // 0=Sunday, 6=Saturday
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const db = getDb();

      // Get all enabled schedules matching current time and day
      const matchingSchedules = db.prepare(`
        SELECT s.*, c.id as child_id, c.household_id, c.name as child_name, c.active as child_active
        FROM schedules s
        JOIN children c ON s.child_id = c.id
        WHERE s.enabled = 1
          AND s.day_of_week = ?
          AND s.time_of_day = ?
          AND c.active = 1
      `).all(currentDay, currentTime) as any[];

      for (const schedule of matchingSchedules) {
        // Check for exceptions
        const exceptions = JSON.parse(schedule.exceptions || '[]');
        const todayStr = now.toISOString().split('T')[0];

        if (exceptions.includes(todayStr)) {
          console.log(`Skipping schedule for ${schedule.child_name} - exception date`);
          continue;
        }

        // Check if there's already an active session for this child
        const activeSession = db.prepare(
          "SELECT * FROM wake_sessions WHERE child_id = ? AND result_status = 'in_progress'"
        ).get(schedule.child_id) as any;

        if (activeSession) {
          console.log(`Skipping schedule for ${schedule.child_name} - session already active`);
          continue;
        }

        // Get device for household
        const device = db.prepare('SELECT * FROM devices WHERE household_id = ?').get(schedule.household_id) as any;
        if (!device) {
          console.log(`No device found for household ${schedule.household_id}`);
          continue;
        }

        // Get user for household
        const household = db.prepare('SELECT * FROM households WHERE id = ?').get(schedule.household_id) as any;
        if (!household) continue;

        console.log(`Triggering scheduled wake for ${schedule.child_name} at ${currentTime}`);

        // Create wake session
        const sessionId = uuidv4();
        const nowISO = now.toISOString();

        db.prepare(`
          INSERT INTO wake_sessions (id, child_id, device_id, scheduled_at, started_at, result_status, attempts_count, log_entries)
          VALUES (?, ?, ?, ?, ?, 'in_progress', 0, ?)
        `).run(sessionId, schedule.child_id, device.id, nowISO, nowISO, JSON.stringify([{
          timestamp: nowISO,
          event: 'scheduled_wake',
          message: `התחיל סשן השכמה מתוזמן ל-${schedule.child_name}`,
        }]));

        // Execute wake scenario
        WakeScenarioService.executeWake(sessionId, schedule.child_id, device.id, household.user_id)
          .catch(err => console.error('Scheduled wake error:', err));
      }
    } catch (err) {
      console.error('Scheduler error:', err);
    }
  });

  console.log('Wake scheduler started');
}
