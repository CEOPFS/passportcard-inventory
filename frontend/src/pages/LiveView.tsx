import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Square, Volume2, RefreshCw, CheckCircle, AlertCircle, Clock, Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/Layout/Header';
import { wakeApi } from '../services/api';
import { useAppStore } from '../store';
import { WakeSession } from '../types';

const STATE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  NAVIGATING: { label: 'מנווט לחדר', icon: '🤖', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  ARRIVED: { label: 'הגיע לחדר', icon: '📍', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  PLAYING_MESSAGE: { label: 'מנגן הודעה', icon: '🔊', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  OBSERVING: { label: 'בודק התעוררות', icon: '👁️', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  AWAKE: { label: 'ילד ער!', icon: '✅', color: 'bg-green-50 border-green-200 text-green-700' },
  RETRY: { label: 'מנסה שנית', icon: '🔄', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  NOTIFY_PARENT: { label: 'שולח התראה', icon: '🔔', color: 'bg-red-50 border-red-200 text-red-700' },
};

// Simulate camera frames
const CAMERA_FRAMES = [
  '░░░░░░░░░░░░░░░░',
  '▒▒░░░░░░░░░░▒▒▒',
  '░░▒▒░░░░░░▒▒░░░',
];

export default function LiveView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const { activeSessions, removeActiveSession } = useAppStore();
  const activeSession = sessionId ? activeSessions[sessionId] : null;

  const [session, setSession] = useState<WakeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [cameraFrame, setCameraFrame] = useState(0);

  useEffect(() => {
    if (sessionId) fetchSession();
  }, [sessionId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCameraFrame(prev => (prev + 1) % CAMERA_FRAMES.length);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeSession && session?.result_status === 'in_progress') {
      fetchSession();
    }
  }, [activeSession]);

  const fetchSession = async () => {
    setLoading(true);
    try {
      const res = await wakeApi.getSession(sessionId!);
      setSession(res.data.session);
    } catch (err) {
      toast.error('שגיאה בטעינת הסשן');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await wakeApi.stop(sessionId!);
      removeActiveSession(sessionId!);
      toast.success('הסשן הופסק');
      await fetchSession();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה בהפסקת הסשן');
    } finally {
      setStopping(false);
    }
  };

  const currentState = activeSession?.state || session?.result_status?.toUpperCase();
  const stateConfig = currentState ? STATE_LABELS[currentState] : null;

  const isActive = session?.result_status === 'in_progress' || activeSession;

  return (
    <div>
      <Header
        title="צפייה חיה"
        subtitle={activeSession?.childName || session?.child_name || ''}
        showBack
        backPath="/"
        rightAction={
          <button onClick={fetchSession} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <RefreshCw size={18} className="text-white" />
          </button>
        }
      />

      <div className="p-4 space-y-4">
        {/* Camera simulation */}
        <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-video flex items-center justify-center relative">
          <div className="text-center">
            <Bot size={48} className="text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">פיד מצלמה סימולציה</p>
            {isActive && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-xs font-bold">LIVE</span>
              </div>
            )}
          </div>

          {/* Simulated noise overlay */}
          {isActive && (
            <div className="absolute inset-0 pointer-events-none opacity-5">
              <div className="w-full h-full grid grid-cols-8 grid-rows-6 gap-px">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div key={i} className={`${Math.random() > 0.5 ? 'bg-white' : 'bg-black'}`} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* State indicator */}
        {activeSession && stateConfig && (
          <div className={`rounded-2xl border p-4 ${stateConfig.color}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{stateConfig.icon}</span>
              <div>
                <p className="font-bold text-base">{stateConfig.label}</p>
                <p className="text-sm opacity-80 mt-0.5">{activeSession.message}</p>
              </div>
            </div>
            {activeSession.attempt && (
              <p className="text-xs opacity-70 mt-2">ניסיון {activeSession.attempt}</p>
            )}
            {activeSession.confidence && (
              <div className="mt-2">
                <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-current rounded-full transition-all duration-500"
                    style={{ width: `${activeSession.confidence * 100}%` }}
                  />
                </div>
                <p className="text-xs opacity-70 mt-1">ביטחון: {Math.round(activeSession.confidence * 100)}%</p>
              </div>
            )}
          </div>
        )}

        {/* Session status */}
        {session && !activeSession && (
          <div className={`rounded-2xl border p-4 ${
            session.result_status === 'success'
              ? 'bg-green-50 border-green-200'
              : session.result_status === 'failed'
              ? 'bg-red-50 border-red-200'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              {session.result_status === 'success' ? (
                <CheckCircle size={24} className="text-green-600" />
              ) : session.result_status === 'failed' ? (
                <AlertCircle size={24} className="text-red-600" />
              ) : (
                <Clock size={24} className="text-gray-500" />
              )}
              <div>
                <p className="font-bold text-gray-800">
                  {session.result_status === 'success' ? 'הסשן הסתיים בהצלחה!' :
                   session.result_status === 'failed' ? 'הסשן נכשל' :
                   session.result_status === 'stopped' ? 'הסשן הופסק' :
                   'הסשן הסתיים'}
                </p>
                {session.wake_confidence > 0 && (
                  <p className="text-sm text-gray-600 mt-0.5">
                    ביטחון התעוררות: {Math.round(session.wake_confidence * 100)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        {isActive && (
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled
              title="תכונה זו תהיה זמינה בקרוב"
              className="btn-secondary py-3 flex items-center justify-center gap-2 text-sm opacity-40 cursor-not-allowed"
            >
              <Volume2 size={18} />
              שוחח עם הילד
            </button>
            <button
              onClick={handleStop}
              disabled={stopping}
              className="btn-danger py-3 flex items-center justify-center gap-2 text-sm"
            >
              <Square size={18} />
              {stopping ? 'מפסיק...' : 'עצור סשן'}
            </button>
          </div>
        )}

        {/* Log entries */}
        {session?.log_entries && session.log_entries.length > 0 && (
          <div>
            <h3 className="font-bold text-gray-600 text-sm mb-2 px-1">יומן פעילות</h3>
            <div className="bg-gray-900 rounded-xl p-3 space-y-1.5 max-h-48 overflow-y-auto">
              {[...session.log_entries].reverse().map((entry, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-gray-500 text-xs font-mono flex-shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString('he-IL')}
                  </span>
                  <span className="text-green-400 text-xs">{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isActive && session && (
          <button
            onClick={() => navigate('/')}
            className="btn-primary w-full py-3"
          >
            חזור לדף הבית
          </button>
        )}
      </div>
    </div>
  );
}
