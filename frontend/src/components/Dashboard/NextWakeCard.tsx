import React from 'react';
import { Clock, User } from 'lucide-react';
import { Schedule, Child } from '../../types';

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

interface NextWakeCardProps {
  schedules: Array<Schedule & { child_name: string }>;
  children: Child[];
}

export default function NextWakeCard({ schedules, children }: NextWakeCardProps) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Find next upcoming schedule
  const findNext = () => {
    const enabled = schedules.filter(s => s.enabled);
    if (enabled.length === 0) return null;

    // Look for next 7 days
    for (let daysAhead = 0; daysAhead < 7; daysAhead++) {
      const checkDay = (currentDay + daysAhead) % 7;
      const daySchedules = enabled
        .filter(s => s.day_of_week === checkDay)
        .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day));

      for (const schedule of daySchedules) {
        if (daysAhead > 0 || schedule.time_of_day > currentTime) {
          const child = children.find(c => c.id === schedule.child_id);
          return {
            schedule,
            child,
            daysAhead,
            dayName: daysAhead === 0 ? 'היום' : daysAhead === 1 ? 'מחר' : `ב${DAYS_HE[checkDay]}`,
          };
        }
      }
    }
    return null;
  };

  const next = findNext();

  if (!next) {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <Clock size={20} className="text-gray-400" />
          </div>
          <div>
            <h3 className="font-bold text-gray-500 text-sm">לא נקבעה השכמה</h3>
            <p className="text-xs text-gray-400">הוסף לוח זמנים לילד</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-r-4 border-accent-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent-50 flex items-center justify-center">
            <Clock size={20} className="text-accent-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">ההשכמה הבאה</p>
            <h3 className="font-bold text-gray-800 text-base">
              {next.dayName} ב-{next.schedule.time_of_day}
            </h3>
          </div>
        </div>
        {next.child && (
          <div className="flex items-center gap-2 bg-primary-50 rounded-xl px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-primary-200 flex items-center justify-center">
              <User size={12} className="text-primary-700" />
            </div>
            <span className="text-sm font-semibold text-primary-700">{next.child.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
