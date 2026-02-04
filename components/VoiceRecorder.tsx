'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface VoiceRecorderProps {
  onComplete: (data: {
    success: boolean;
    summary?: string;
    tasksCreated?: number;
    needsConfirmation?: boolean;
    error?: string;
  }) => void;
}

type RecordingState = 'idle' | 'recording' | 'processing';

export default function VoiceRecorder({ onComplete }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const updateAudioLevel = useCallback(() => {
    if (analyzerRef.current && state === 'recording') {
      const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
      analyzerRef.current.getByteFrequencyData(dataArray);

      // Calculate average level
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);

      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [state]);

  useEffect(() => {
    if (state === 'recording') {
      updateAudioLevel();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state, updateAudioLevel]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (state === 'recording') {
      interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio context for visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      source.connect(analyzerRef.current);

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Clean up audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Process the recording
        setState('processing');
        await processRecording();
      };

      // Start recording
      startTimeRef.current = Date.now();
      setDuration(0);
      mediaRecorder.start(1000); // Collect data every second
      setState('recording');

    } catch (error) {
      console.error('Failed to start recording:', error);
      onComplete({ success: false });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const processRecording = async () => {
    try {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('duration', duration.toString());

      console.log('Sending recording to API, blob size:', audioBlob.size);
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('API response:', response.status, data);

      if (response.ok) {
        onComplete({
          success: true,
          summary: data.message || 'Recording saved. Check Telegram for processing results.',
          needsConfirmation: true,
        });
      } else {
        onComplete({ success: false, error: data.details || data.error || 'Unknown error' });
      }
    } catch (error) {
      console.error('Failed to process recording:', error);
      onComplete({ success: false, error: (error as Error).message });
    }
  };

  const handleClick = () => {
    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  };

  // Calculate button size based on audio level
  const buttonScale = state === 'recording' ? 1 + audioLevel * 0.3 : 1;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2rem',
    }}>
      {/* Recording indicator */}
      {state === 'recording' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: '#ef4444',
        }}>
          <span style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            animation: 'pulse 1s infinite',
          }} />
          <span>Recording</span>
        </div>
      )}

      {/* Main button */}
      <button
        onClick={handleClick}
        disabled={state === 'processing'}
        style={{
          width: '160px',
          height: '160px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: state === 'recording' ? '#ef4444' : '#2563eb',
          color: 'white',
          fontSize: '3rem',
          cursor: state === 'processing' ? 'wait' : 'pointer',
          transform: `scale(${buttonScale})`,
          transition: 'transform 0.1s ease-out, background-color 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: state === 'recording'
            ? `0 0 ${30 + audioLevel * 50}px rgba(239, 68, 68, ${0.3 + audioLevel * 0.4})`
            : '0 4px 20px rgba(37, 99, 235, 0.3)',
        }}
      >
        {state === 'idle' && '🎤'}
        {state === 'recording' && '⏹'}
        {state === 'processing' && (
          <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
        )}
      </button>

      {/* Duration */}
      <div style={{
        fontSize: '2rem',
        fontFamily: 'monospace',
        color: state === 'recording' ? '#ededed' : '#666',
      }}>
        {formatTime(duration)}
      </div>

      {/* Instructions */}
      <p style={{
        color: '#888',
        fontSize: '0.875rem',
        textAlign: 'center',
      }}>
        {state === 'idle' && 'Tap to start recording'}
        {state === 'recording' && 'Tap to stop'}
        {state === 'processing' && 'Processing...'}
      </p>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
