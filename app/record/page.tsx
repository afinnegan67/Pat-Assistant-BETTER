'use client';

import { useState } from 'react';
import VoiceRecorder from '@/components/VoiceRecorder';

export default function RecordPage() {
  const [result, setResult] = useState<{
    success: boolean;
    summary?: string;
    tasksCreated?: number;
    needsConfirmation?: boolean;
    error?: string;
  } | null>(null);

  const handleComplete = (data: {
    success: boolean;
    summary?: string;
    tasksCreated?: number;
    needsConfirmation?: boolean;
    error?: string;
  }) => {
    setResult(data);
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
    }}>
      <h1 style={{
        fontSize: '1.5rem',
        marginBottom: '2rem',
        color: '#ededed',
      }}>
        Voice Recording
      </h1>

      {!result ? (
        <VoiceRecorder onComplete={handleComplete} />
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          maxWidth: '400px',
          textAlign: 'center',
        }}>
          {result.success ? (
            <>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
              }}>
                ✓
              </div>

              <div>
                <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  {result.needsConfirmation ? 'Recording Saved' : 'Recording Processed'}
                </p>
                <p style={{ color: '#888' }}>
                  Processing in background...
                </p>
              </div>

              {result.summary && (
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  color: '#aaa',
                  whiteSpace: 'pre-wrap',
                  textAlign: 'left',
                  width: '100%',
                }}>
                  {result.summary}
                </div>
              )}

              {result.needsConfirmation && (
                <p style={{ color: '#f59e0b', fontSize: '0.875rem' }}>
                  Check Telegram to confirm or cancel
                </p>
              )}
            </>
          ) : (
            <>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
              }}>
                ✕
              </div>
              <p style={{ fontSize: '1.25rem' }}>Processing Failed</p>
              <p style={{ color: '#888', fontSize: '0.875rem' }}>
                {result.error || 'Your nephew Aidan failed to build me correctly. Blame him not me.'}
              </p>
            </>
          )}

          <button
            onClick={handleReset}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer',
              marginTop: '1rem',
            }}
          >
            Record Another
          </button>
        </div>
      )}

      <a
        href="/"
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          color: '#888',
          fontSize: '0.875rem',
        }}
      >
        ← Back
      </a>
    </main>
  );
}
