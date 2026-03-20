import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import { Schedule } from '../../types';

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

interface WeeklyScheduleProps {
  schedules: Schedule[];
  onAdd: (dayOfWeek: number, timeOfDay: string) => void;
  onToggle: (schedule: Schedule) => void;
  onDelete: (scheduleId: string) => void;
}

export default function WeeklySchedule({ schedules, onAdd, onToggle, onDelete }: WeeklyScheduleProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [newTime, setNewTime] = useState('07:00');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    setShowAddForm(true);
  };

  const handleAdd = () => {
    if (selectedDay !== null && newTime) {
      onAdd(selectedDay, newTime);
      setShowAddForm(false);
      setSelectedDay(null);
    }
  };

  const getSchedulesForDay = (day: number) =>
    schedules.filter(s => s.day_of_week === day).sort((a, b) => a.time_of_day.localeCompare(b.time_of_day));

  return (
    <div className="space-y-3">
      {/* Day selector */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS_SHORT.map((day, idx) => {
          const daySchedules = getSchedulesForDay(idx);
          const hasSchedule = daySchedules.length > 0;
          const isSelected = selectedDay === idx;

          return (
            <button
              key={idx}
              onClick={() => handleDayClick(idx)}
              className={`flex flex-col items-center py-2 rounded-xl transition-all ${
                isSelected
                  ? 'bg-primary-700 text-white'
                  : hasSchedule
                  ? 'bg-accent-50 border border-accent-200 text-accent-700'
                  : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              <span className="text-xs font-bold">{day}</span>
              {hasSchedule && (
                <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-accent-500'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Add form */}
      {showAddForm && selectedDay !== null && (
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
          <p className="text-sm font-semibold text-primary-800 mb-3">
            הוסף השכמה ל{DAYS_HE[selectedDay]}
          </p>
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={newTime}
              onChange={e => setNewTime(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-primary-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 text-center font-mono text-lg"
            />
            <button
              onClick={handleAdd}
              className="w-10 h-10 rounded-full bg-primary-700 text-white flex items-center justify-center hover:bg-primary-800 transition-colors"
            >
              <Check size={18} />
            </button>
            <button
              onClick={() => { setShowAddForm(false); setSelectedDay(null); }}
              className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-300 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Schedule list */}
      <div className="space-y-2">
        {DAYS_HE.map((dayName, dayIdx) => {
          const daySchedules = getSchedulesForDay(dayIdx);
          if (daySchedules.length === 0) return null;

          return (
            <div key={dayIdx} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-600">{dayName}</span>
              </div>
              {daySchedules.map(schedule => (
                <div key={schedule.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold font-mono text-gray-800">{schedule.time_of_day}</span>
                    {schedule.exceptions && schedule.exceptions.length > 0 && (
                      <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                        {schedule.exceptions.length} חריגות
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Toggle */}
                    <button
                      onClick={() => onToggle(schedule)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        schedule.enabled ? 'bg-primary-700' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                          schedule.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => onDelete(schedule.id)}
                      className="w-8 h-8 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {schedules.length === 0 && !showAddForm && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">אין לוח זמנים מוגדר</p>
            <p className="text-xs mt-1">בחר יום להוספת השכמה</p>
          </div>
        )}
      </div>
    </div>
  );
}
