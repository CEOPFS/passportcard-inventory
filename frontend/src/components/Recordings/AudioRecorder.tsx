import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Play, Pause, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
}

export default function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>(Array(40).fill(0));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const durationRef = useRef(0);

  const startWaveformAnimation = (analyser: AnalyserNode) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      analyser.getByteFrequencyData(dataArray);
      const bars = Array.from({ length: 40 }, (_, i) => {
        const idx = Math.floor(i * dataArray.length / 40);
        return dataArray[idx] / 255;
      });
      setWaveformData(bars);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup audio analyser for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setWaveformData(Array(40).fill(0));
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      durationRef.current = 0;

      startWaveformAnimation(analyser);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          durationRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      toast.error('לא ניתן לגשת למיקרופון. אנא בדוק הרשאות.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const togglePlay = () => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const discardRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setRecordingTime(0);
  };

  const handleSave = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob, durationRef.current);
      discardRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-800 mb-4 text-center">הקלטת הודעת השכמה</h3>

      {/* Waveform */}
      <div className="flex items-center justify-center gap-0.5 h-16 mb-4 bg-gray-50 rounded-xl px-4">
        {waveformData.map((value, i) => (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-all duration-75 ${isRecording ? 'bg-red-500' : 'bg-primary-400'}`}
            style={{ height: `${Math.max(4, value * 48)}px` }}
          />
        ))}
      </div>

      {/* Timer */}
      <div className={`text-center text-3xl font-mono font-bold mb-4 ${isRecording ? 'text-red-500' : 'text-gray-700'}`}>
        {formatTime(recordingTime)}
        {isRecording && <span className="text-sm font-sans font-normal text-red-400 mr-2">● מקליט</span>}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!audioBlob && !isRecording && (
          <button
            onClick={startRecording}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center text-white shadow-lg transition-all transform hover:scale-105"
          >
            <Mic size={28} />
          </button>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            className="w-16 h-16 rounded-full bg-gray-700 hover:bg-gray-800 flex items-center justify-center text-white shadow-lg transition-all animate-pulse"
          >
            <Square size={24} />
          </button>
        )}

        {audioBlob && !isRecording && (
          <div className="flex items-center gap-4">
            <button
              onClick={discardRecording}
              className="w-12 h-12 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-500 transition-colors"
            >
              <Trash2 size={20} />
            </button>

            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-primary-700 hover:bg-primary-800 flex items-center justify-center text-white shadow-md transition-colors"
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} />}
            </button>

            <button
              onClick={handleSave}
              className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-md transition-colors"
            >
              <Upload size={20} />
            </button>
          </div>
        )}
      </div>

      {audioBlob && (
        <p className="text-center text-xs text-gray-500 mt-3">
          לחץ על ▶ להאזנה, או על ↑ לשמירה
        </p>
      )}

      {!audioBlob && !isRecording && (
        <p className="text-center text-xs text-gray-500 mt-3">
          לחץ על המיקרופון כדי להתחיל הקלטה
        </p>
      )}
    </div>
  );
}
