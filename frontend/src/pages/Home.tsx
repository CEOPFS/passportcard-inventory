import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, PauseCircle, Bell, RefreshCw, ChevronLeft, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/Layout/Header';
import DeviceCard from '../components/Dashboard/DeviceCard';
import NextWakeCard from '../components/Dashboard/NextWakeCard';
import AlertCard from '../components/Dashboard/AlertCard';
import { useAppStore } from '../store';
import { deviceApi, childrenApi, alertsApi, wakeApi, schedulesApi } from '../services/api';
import { Schedule } from '../types';

export default function Home() {
  const navigate = useNavigate();
  const {
    user,
    devices,
    setDevices,
    children,
    setChildren,
    alerts,
    setAlerts,
    unreadAlertCount,
    activeSessions,
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [allSchedules, setAllSchedules] = useState<(Schedule & { child_name: string })[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [devicesRes, childrenRes, alertsRes] = await Promise.all([
        deviceApi.getAll(),
        childrenApi.getAll(),
        alertsApi.getAll(),
      ]);

      setDevices(devicesRes.data.devices);
      setChildren(childrenRes.data.children);
      setAlerts(alertsRes.data.alerts);

      // Gather all schedules
      const schedules: (Schedule & { child_name: string })[] = [];
      for (const child of childrenRes.data.children) {
        if (child.schedules) {
          child.schedules.forEach((s: Schedule) => {
            schedules.push({ ...s, child_name: child.name });
          });
        }
      }
      setAllSchedules(schedules);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestWake = async () => {
    if (children.length === 0) {
      toast.error('אין ילדים מוגדרים. הוסף ילד תחילה.');
      return;
    }
    const child = children[0];
    try {
      const res = await wakeApi.test(child.id);
      toast.success(`בדיקת השכמה התחילה עבור ${child.name}`);
      navigate(`/live/${res.data.sessionId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה בהפעלת בדיקה');
    }
  };

  const activeSessionList = Object.entries(activeSessions);

  return (
    <div>
      <Header
        title={`שלום, ${user?.name?.split(' ')[0] || 'שלום'} 👋`}
        subtitle="מערכת WakeBot פעילה"
        rightAction={
          <button onClick={fetchData} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <RefreshCw size={18} className="text-white" />
          </button>
        }
      />

      <div className="p-4 space-y-4">
        {/* Active session banner */}
        {activeSessionList.length > 0 && (
          <div className="bg-accent-500 rounded-2xl p-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap size={18} className="animate-pulse" />
                <span className="font-bold text-sm">השכמה פעילה</span>
              </div>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {activeSessionList.length} פעיל
              </span>
            </div>
            {activeSessionList.map(([sessionId, session]) => (
              <div
                key={sessionId}
                className="bg-white/10 rounded-xl p-3 mt-2 cursor-pointer active:bg-white/20"
                onClick={() => navigate(`/live/${sessionId}`)}
              >
                <p className="font-semibold text-sm">{session.childName}</p>
                <p className="text-xs text-white/80 mt-0.5">{session.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleTestWake}
            className="bg-primary-700 text-white rounded-2xl p-4 flex flex-col items-center gap-2 hover:bg-primary-800 active:bg-primary-900 transition-colors shadow-sm"
          >
            <Play size={24} />
            <span className="text-sm font-bold">בדיקת השכמה</span>
          </button>
          <button
            onClick={() => navigate('/children')}
            className="bg-white text-primary-700 border border-primary-100 rounded-2xl p-4 flex flex-col items-center gap-2 hover:bg-primary-50 active:bg-primary-100 transition-colors shadow-sm"
          >
            <PauseCircle size={24} />
            <span className="text-sm font-bold">ניהול ילדים</span>
          </button>
        </div>

        {/* Next wake */}
        <div>
          <h2 className="text-sm font-bold text-gray-500 mb-2 px-1">ההשכמה הבאה</h2>
          <NextWakeCard schedules={allSchedules} children={children} />
        </div>

        {/* Devices */}
        {devices.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-500 mb-2 px-1">מכשירים</h2>
            <div className="space-y-3">
              {devices.map(device => (
                <DeviceCard key={device.id} device={device} />
              ))}
            </div>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-sm font-bold text-gray-500 flex items-center gap-1.5">
                <Bell size={14} />
                התראות
                {unreadAlertCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {unreadAlertCount}
                  </span>
                )}
              </h2>
            </div>
            <div className="space-y-2">
              {alerts.slice(0, 5).map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-primary-700 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400 mt-3">טוען נתונים...</p>
          </div>
        )}

        {!loading && children.length === 0 && (
          <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
            <p className="text-4xl mb-3">👨‍👩‍👧‍👦</p>
            <h3 className="font-bold text-gray-700 mb-1">ברוכים הבאים ל-WakeBot!</h3>
            <p className="text-sm text-gray-500 mb-4">הוסף ילדים כדי להתחיל</p>
            <button
              onClick={() => navigate('/children')}
              className="btn-primary px-6 py-2.5"
            >
              הוסף ילד ראשון
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
