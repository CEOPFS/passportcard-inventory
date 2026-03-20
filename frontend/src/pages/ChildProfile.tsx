import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Clock, Mic, Play, Edit3, Trash2, MapPin, ChevronLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/Layout/Header';
import { childrenApi, wakeApi } from '../services/api';
import { Child, Schedule, WakeMessage, WakeSession } from '../types';

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const statusConfig: Record<string, { label: string; color: string }> = {
  success: { label: 'הצלחה', color: 'text-green-600 bg-green-50' },
  failed: { label: 'נכשל', color: 'text-red-600 bg-red-50' },
  in_progress: { label: 'בתהליך', color: 'text-blue-600 bg-blue-50' },
  stopped: { label: 'הופסק', color: 'text-gray-600 bg-gray-50' },
  error: { label: 'שגיאה', color: 'text-orange-600 bg-orange-50' },
};

export default function ChildProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [child, setChild] = useState<Child | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [messages, setMessages] = useState<WakeMessage[]>([]);
  const [sessions, setSessions] = useState<WakeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingWake, setTestingWake] = useState(false);

  useEffect(() => {
    if (id) fetchChild();
  }, [id]);

  const fetchChild = async () => {
    setLoading(true);
    try {
      const res = await childrenApi.getById(id!);
      setChild(res.data.child);
      setSchedules(res.data.schedules);
      setMessages(res.data.messages);
      setSessions(res.data.sessions);
    } catch (err) {
      toast.error('שגיאה בטעינת פרופיל הילד');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWake = async () => {
    setTestingWake(true);
    try {
      const res = await wakeApi.test(id!);
      toast.success('בדיקת השכמה התחילה!');
      navigate(`/live/${res.data.sessionId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה בהפעלת בדיקה');
    } finally {
      setTestingWake(false);
    }
  };

  const handleToggleActive = async () => {
    if (!child) return;
    try {
      const res = await childrenApi.update(id!, { active: !child.active });
      setChild(res.data.child);
      toast.success(res.data.child.active ? 'ילד הופעל' : 'ילד הושהה');
    } catch (err) {
      toast.error('שגיאה בעדכון הסטטוס');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את ${child?.name}?`)) return;
    try {
      await childrenApi.delete(id!);
      toast.success('הילד נמחק בהצלחה');
      navigate('/children');
    } catch (err) {
      toast.error('שגיאה במחיקת הילד');
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="פרופיל ילד" showBack backPath="/children" />
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div>
        <Header title="פרופיל ילד" showBack backPath="/children" />
        <p className="text-center py-10 text-gray-500">הילד לא נמצא</p>
      </div>
    );
  }

  const isActive = child.active === 1 || child.active === true;

  return (
    <div>
      <Header
        title={child.name}
        subtitle={child.room_name || 'ללא חדר'}
        showBack
        backPath="/children"
      />

      <div className="p-4 space-y-4">
        {/* Profile Card */}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center">
              <User size={28} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-800">{child.name}</h2>
              {child.age && <p className="text-sm text-gray-500">גיל {child.age}</p>}
              {child.room_name && (
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  <MapPin size={12} />
                  {child.room_name}
                </div>
              )}
            </div>
            <button
              onClick={handleToggleActive}
              className={`p-2 rounded-xl transition-colors ${isActive ? 'text-green-500' : 'text-gray-400'}`}
            >
              {isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <div className="text-lg font-black text-primary-700">{schedules.length}</div>
              <div className="text-xs text-gray-500">זמנים</div>
            </div>
            <div className="text-center border-x border-gray-100">
              <div className="text-lg font-black text-primary-700">{messages.length}</div>
              <div className="text-xs text-gray-500">הקלטות</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black text-primary-700">{sessions.length}</div>
              <div className="text-xs text-gray-500">סשנים</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleTestWake}
            disabled={testingWake || !isActive}
            className="btn-accent py-3 text-sm flex items-center justify-center gap-2"
          >
            <Play size={16} />
            {testingWake ? 'מתחיל...' : 'בדיקת השכמה'}
          </button>
          <button
            onClick={() => navigate(`/children/${id}/schedule`)}
            className="btn-secondary py-3 text-sm flex items-center justify-center gap-2"
          >
            <Clock size={16} />
            לוח זמנים
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate(`/children/${id}/recordings`)}
            className="btn-secondary py-3 text-sm flex items-center justify-center gap-2"
          >
            <Mic size={16} />
            הקלטות
          </button>
          <button
            onClick={() => navigate('/map')}
            className="btn-secondary py-3 text-sm flex items-center justify-center gap-2"
          >
            <MapPin size={16} />
            מיקום במפה
          </button>
        </div>

        {/* Schedules */}
        {schedules.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="font-bold text-gray-600 text-sm">לוח זמנים</h3>
              <button
                onClick={() => navigate(`/children/${id}/schedule`)}
                className="text-xs text-primary-600"
              >
                ערוך
              </button>
            </div>
            <div className="card divide-y divide-gray-50 p-0 overflow-hidden">
              {schedules.map(s => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-700 w-14">
                      {DAYS_HE[s.day_of_week]}
                    </span>
                    <span className="font-mono font-bold text-primary-700">{s.time_of_day}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {s.enabled ? 'פעיל' : 'כבוי'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="font-bold text-gray-600 text-sm">סשנים אחרונים</h3>
              <button
                onClick={() => navigate('/history')}
                className="text-xs text-primary-600"
              >
                כל ההיסטוריה
              </button>
            </div>
            <div className="space-y-2">
              {sessions.slice(0, 3).map(session => {
                const config = statusConfig[session.result_status] || { label: session.result_status, color: 'text-gray-600 bg-gray-50' };
                return (
                  <div key={session.id} className="card flex items-center justify-between">
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
                        {config.label}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {session.created_at ? new Date(session.created_at).toLocaleString('he-IL') : ''}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-gray-500">{session.attempts_count} ניסיונות</p>
                      {session.wake_confidence > 0 && (
                        <p className="text-xs text-green-600 font-medium">{Math.round(session.wake_confidence * 100)}% ביטחון</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Danger zone */}
        <div className="mt-4 pt-4">
          <button
            onClick={handleDelete}
            className="w-full py-3 text-red-500 border border-red-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={16} />
            מחק ילד
          </button>
        </div>
      </div>
    </div>
  );
}
