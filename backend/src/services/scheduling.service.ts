import cron from 'node-cron';
import { queryOne, queryAll, execute } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { WakeScenarioService } from './wake-scenario.service';

let schedulerStarted = false;

export function startScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const matchingSchedules = await queryAll<any>(`
        SELECT s.*, c.id as child_id, c.household_id, c.name as child_name, c.active as child_active
        FROM schedules s
        JOIN children c ON s.child_id = c.id
        WHERE s.enabled = 1
          AND s.day_of_week = $1
          AND s.time_of_day = $2
          AND c.active = 1
      `, [currentDay, currentTime]);

      for (const schedule of matchingSchedules) {
        const exceptions = JSON.parse(schedule.exceptions || '[]');
        const todayStr = now.toISOString().split('T')[0];

        if (exceptions.includes(todayStr)) {
          console.log(`Skipping schedule for ${schedule.child_name} - exception date`);
          continue;
        }

        const activeSession = await queryOne<any>(
          "SELECT * FROM wake_sessions WHERE child_id = $1 AND result_status = 'in_progress'",
          [schedule.child_id]
        );

        if (activeSession) {
          console.log(`Skipping schedule for ${schedule.child_name} - session already active`);
          continue;
        }

        const device = await queryOne<any>('SELECT * FROM devices WHERE household_id = $1', [schedule.household_id]);
        if (!device) {
          console.log(`No device found for household ${schedule.household_id}`);
          continue;
        }

        const household = await queryOne<any>('SELECT * FROM households WHERE id = $1', [schedule.household_id]);
        if (!household) continue;

        console.log(`Triggering scheduled wake for ${schedule.child_name} at ${currentTime}`);

        const sessionId = uuidv4();
        const nowISO = now.toISOString();

        await execute(`
          INSERT INTO wake_sessions (id, child_id, device_id, scheduled_at, started_at, result_status, attempts_count, log_entries)
          VALUES ($1, $2, $3, $4, $5, 'in_progress', 0, $6)
        `, [sessionId, schedule.child_id, device.id, nowISO, nowISO, JSON.stringify([{
          timestamp: nowISO,
          event: 'scheduled_wake',
          message: `התחיל סשן השכמה מתוזמן ל-${schedule.child_name}`,
        }])]);

        WakeScenarioService.executeWake(sessionId, schedule.child_id, device.id, household.user_id)
          .catch(err => console.error('Scheduled wake error:', err));
      }
    } catch (err) {
      console.error('Scheduler error:', err);
    }
  });

  console.log('Wake scheduler started');
}
