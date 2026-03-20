import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Pause, Trash2, GripVertical, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/Layout/Header';
import AudioRecorder from '../components/Recordings/AudioRecorder';
import { messagesApi, childrenApi } from '../services/api';
import { WakeMessage, Child } from '../types';

export default function Recordings() {
  const { id: childId } = useParams<{ id: string }>();

  const [child, setChild] = useState<Child | null>(null);
  const [messages, setMessages] = useState<WakeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    if (childId) fetchData();
  }, [childId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [childRes, msgRes] = await Promise.all([
        childrenApi.getById(childId!),
        messagesApi.getByChild(childId!),
      ]);
      setChild(childRes.data.child);
      setMessages(msgRes.data.messages);
    } catch (err) {
      toast.error('שגיאה בטעינת ההקלטות');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    toast.loading('מעלה הקלטה...');
    try {
      const formData = new FormData();
      formData.append('audio', blob, `recording-${Date.now()}.webm`);
      formData.append('duration', String(duration));
      formData.append('label', `הקלטה ${messages.length + 1}`);
      formData.append('volume', '0.8');

      const res = await messagesApi.upload(childId!, formData);
      setMessages(prev => [...prev, res.data.message]);
      toast.dismiss();
      toast.success('הקלטה נשמרה בהצלחה!');
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.response?.data?.error || 'שגיאה בשמירת ההקלטה');
    }
  };

  const togglePlay = (message: WakeMessage) => {
    const audioUrl = `/uploads/${message.file_path.split('/uploads/')[1] || message.file_path}`;

    if (playingId === message.id) {
      audioElements[message.id]?.pause();
      setPlayingId(null);
      return;
    }

    // Stop current
    if (playingId && audioElements[playingId]) {
      audioElements[playingId].pause();
    }

    let audio = audioElements[message.id];
    if (!audio) {
      audio = new Audio(message.file_path.startsWith('/') ? message.file_path : `/${message.file_path}`);
      audio.onended = () => setPlayingId(null);
      setAudioElements(prev => ({ ...prev, [message.id]: audio }));
    }

    audio.play().catch(err => {
      console.error('Playback error:', err);
      toast.error('שגיאה בהפעלת ההקלטה');
    });
    setPlayingId(message.id);
  };

  const handleDelete = async (message: WakeMessage) => {
    if (!window.confirm('האם למחוק את ההקלטה?')) return;
    try {
      await messagesApi.delete(message.id, childId!);
      setMessages(prev => prev.filter(m => m.id !== message.id));
      if (playingId === message.id) {
        audioElements[message.id]?.pause();
        setPlayingId(null);
      }
      toast.success('ההקלטה נמחקה');
    } catch (err) {
      toast.error('שגיאה במחיקת ההקלטה');
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div>
      <Header
        title={child ? `הקלטות - ${child.name}` : 'הקלטות'}
        subtitle={`${messages.length} הקלטות`}
        showBack
        backPath={`/children/${childId}`}
      />

      <div className="p-4 space-y-4">
        {/* Recorder */}
        <AudioRecorder onRecordingComplete={handleRecordingComplete} />

        {/* Messages list */}
        {messages.length > 0 && (
          <div>
            <h3 className="font-bold text-gray-600 text-sm mb-3 px-1">הקלטות שמורות</h3>
            <div className="space-y-2">
              {messages.map((message, index) => (
                <div key={message.id} className="card flex items-center gap-3">
                  <div className="text-gray-300 flex-shrink-0">
                    <GripVertical size={18} />
                  </div>

                  <button
                    onClick={() => togglePlay(message)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                      playingId === message.id
                        ? 'bg-accent-500 text-white'
                        : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                    }`}
                  >
                    {playingId === message.id ? <Pause size={18} /> : <Play size={18} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">
                      {message.label || `הקלטה ${index + 1}`}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {message.duration > 0 && (
                        <span className="text-xs text-gray-400">{formatDuration(message.duration)}</span>
                      )}
                      <div className="flex items-center gap-1">
                        <Volume2 size={10} className="text-gray-300" />
                        <span className="text-xs text-gray-400">{Math.round(message.volume * 100)}%</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${message.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {message.is_active ? 'פעיל' : 'כבוי'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(message)}
                    className="w-8 h-8 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
            <p className="text-4xl mb-3">🎙️</p>
            <h3 className="font-bold text-gray-600 mb-1">אין הקלטות עדיין</h3>
            <p className="text-sm text-gray-400">השתמש בהקלטן למעלה כדי להקליט הודעת השכמה</p>
          </div>
        )}
      </div>
    </div>
  );
}
