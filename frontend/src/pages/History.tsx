import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, StopCircle, AlertCircle, Filter } from 'lucide-react';
import Header from '../components/Layout/Header';
import { wakeApi } from '../services/api';
import { WakeSession } from '../types';

const STATUS_CONFIG: Record<string, { icon: any; label: string; color: string; bgColor: string }> = {
  success: { icon: CheckCircle, label: 'הצלחה', color: 'text-green-600', bgColor: 'bg-green-50' },
  failed: { icon: XCircle, label: 'נכשל', color: 'text-red-600', bgColor: 'bg-red-50' },
  in_progress: { icon: Clock, label: 'בתהליך', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  stopped: { icon: StopCircle, label: 'הופסק', color: 'text-gray-600', bgColor: 'bg-gray-50' },
  error: { icon: AlertCircle, label: 'שגיאה', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  pending: { icon: Clock, label: 'ממתין', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
};

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<WakeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await wakeApi.getSessions({ limit: 50 });
      setSessions(res.data.sessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all'
    ? sessions
    : sessions.filter(s => s.result_status === filter);

  const stats = {
    total: sessions.length,
    success: sessions.filter(s => s.result_status === 'success').length,
    failed: sessions.filter(s => s.result_status === 'failed').length,
  };

  return (
    <div>
      <Header
        title="היסטוריה"
        subtitle={`${sessions.length} סשנים`}
      />

      <div className="p-4 space-y-4">
        {/* Stats */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center">
              <div className="text-2xl font-black text-primary-700">{stats.total}</div>
              <div className="text-xs text-gray-500">סה"כ</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-black text-green-600">{stats.success}</div>
              <div className="text-xs text-gray-500">הצלחות</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-black text-red-500">{stats.failed}</div>
              <div className="text-xs text-gray-500">כישלונות</div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['all', 'success', 'failed', 'in_progress', 'stopped'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                filter === f
                  ? 'bg-primary-700 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'הכל' :
               f === 'success' ? 'הצלחות' :
               f === 'failed' ? 'כישלונות' :
               f === 'in_progress' ? 'פעיל' : 'הופסק'}
            </button>
          ))}
        </div>

        {/* Sessions list */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Clock size={48} className="text-gray-200 mx-auto mb-3" />
            <h3 className="font-bold text-gray-500 mb-1">אין סשנים</h3>
            <p className="text-sm text-gray-400">ההיסטוריה ריקה</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(session => {
              const config = STATUS_CONFIG[session.result_status] || STATUS_CONFIG.pending;
              const Icon = config.icon;

              return (
                <div
                  key={session.id}
                  className="card flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow active:bg-gray-50"
                  onClick={() => navigate(`/live/${session.id}`)}
                >
                  <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className={config.color} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-gray-800 text-sm">
                        {session.child_name || 'ילד לא ידוע'}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {session.started_at ? new Date(session.started_at).toLocaleString('he-IL') : ''}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {session.attempts_count > 0 && (
                        <span className="text-xs text-gray-500">{session.attempts_count} ניסיונות</span>
                      )}
                      {session.wake_confidence > 0 && (
                        <span className="text-xs text-green-600 font-medium">
                          {Math.round(session.wake_confidence * 100)}% ביטחון
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
