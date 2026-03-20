import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../components/Layout/Header';
import WeeklySchedule from '../components/Schedule/WeeklySchedule';
import { schedulesApi, childrenApi } from '../services/api';
import { Schedule as ScheduleType, Child } from '../types';

export default function Schedule() {
  const { id: childId } = useParams<{ id: string }>();

  const [child, setChild] = useState<Child | null>(null);
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (childId) fetchData();
  }, [childId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [childRes, schedRes] = await Promise.all([
        childrenApi.getById(childId!),
        schedulesApi.getByChild(childId!),
      ]);
      setChild(childRes.data.child);
      setSchedules(schedRes.data.schedules);
    } catch (err) {
      toast.error('שגיאה בטעינת לוח הזמנים');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (dayOfWeek: number, timeOfDay: string) => {
    try {
      const res = await schedulesApi.create(childId!, {
        day_of_week: dayOfWeek,
        time_of_day: timeOfDay,
        enabled: true,
      });
      setSchedules(prev => [...prev, res.data.schedule]);
      toast.success('זמן השכמה נוסף');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה בהוספת זמן');
    }
  };

  const handleToggle = async (schedule: ScheduleType) => {
    try {
      const enabled = !(schedule.enabled === 1 || schedule.enabled === true);
      const res = await schedulesApi.update(schedule.id, childId!, { enabled });
      setSchedules(prev => prev.map(s => s.id === schedule.id ? res.data.schedule : s));
      toast.success(enabled ? 'הזמן הופעל' : 'הזמן הושהה');
    } catch (err) {
      toast.error('שגיאה בעדכון הזמן');
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      await schedulesApi.delete(scheduleId, childId!);
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      toast.success('זמן ההשכמה נמחק');
    } catch (err) {
      toast.error('שגיאה במחיקת הזמן');
    }
  };

  return (
    <div>
      <Header
        title={child ? `לוח זמנים - ${child.name}` : 'לוח זמנים'}
        subtitle="הגדר זמני השכמה שבועיים"
        showBack
        backPath={`/children/${childId}`}
      />

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <WeeklySchedule
            schedules={schedules}
            onAdd={handleAdd}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}
