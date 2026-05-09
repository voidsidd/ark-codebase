import React, { useEffect, useState, useCallback } from 'react';
import { AlertEvent } from '../lib/parksData';
import { generateNarrative, getCachedNarrative } from '../services/narrativeEngine';

interface NarrativePanelProps {
  alert: AlertEvent;
  recentAlerts: AlertEvent[];
  userRole?: 'government' | 'private';
  autoGenerate?: boolean; // caller controls auto-trigger instead of hardcoding CRITICAL
}

type PanelState = 'idle' | 'generating' | 'complete' | 'error';

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────
const Shimmer: React.FC<{ widths: string[] }> = ({ widths }) => (
  <div className="space-y-2.5 my-4">
    {widths.map((w, i) => (
      <div
        key={i}
        className="h-3 rounded narrative-shimmer"
        style={{ width: w }}
      />
    ))}
  </div>
);

// ─── Timestamp detector — wraps "HH:MM" prefixed lines in monospace span ─────
function renderWithTimestamps(text: string): React.ReactNode {
  return text.split('\n').map((line, i) => {
    const isTimestampLine = /^\d{2}:\d{2}/.test(line) || /^[−-]\d+\s*min/.test(line);
    return (
      <React.Fragment key={i}>
        {isTimestampLine ? (
          <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)' }}>
            {line}
          </span>
        ) : line}
        {'\n'}
      </React.Fragment>
    );
  });
}

const NarrativePanel: React.FC<NarrativePanelProps> = ({ alert, recentAlerts, userRole = 'government', autoGenerate }) => {
  const cached = getCachedNarrative(alert.id);
  const [state, setState] = useState<PanelState>(cached ? 'complete' : 'idle');
  const [narrative, setNarrative] = useState<string | null>(cached?.text ?? null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(cached?.generatedAt ?? null);
  const [error, setError] = useState<string | null>(null);

  const isCritical = alert.priority === 'CRITICAL';
  const isElevated = alert.priority === 'ELEVATED';
  const leftBorderColor = isCritical ? '#FF4444' : '#FF9500';

  const runGeneration = useCallback(async () => {
    setState('generating');
    setError(null);
    try {
      const text = await generateNarrative(alert, recentAlerts, userRole);
      const at = new Date().toISOString();
      setNarrative(text);
      setGeneratedAt(at);
      setState('complete');
    } catch (err) {
      console.error('[NarrativePanel] Generation failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  }, [alert, recentAlerts]);

  // Auto-trigger: use autoGenerate prop if provided, otherwise default to CRITICAL-only
  useEffect(() => {
    const shouldAuto = autoGenerate !== undefined ? autoGenerate : isCritical;
    if (shouldAuto && !cached) {
      runGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Format generatedAt as "HH:MM DD MMM"
  const formattedAt = generatedAt
    ? (() => {
        const d = new Date(generatedAt);
        const hh = d.getHours().toString().padStart(2, '0');
        const mm = d.getMinutes().toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        const mon = d.toLocaleString('en', { month: 'short' });
        return `${hh}:${mm} ${dd} ${mon}`;
      })()
    : null;

  return (
    <>
      {/* Inject CSS for shimmer + fade-in */}
      <style>{`
        @keyframes narrative-shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .narrative-shimmer {
          background: linear-gradient(90deg,
            rgba(255,255,255,0.06) 0%,
            rgba(255,255,255,0.12) 50%,
            rgba(255,255,255,0.06) 100%
          );
          background-size: 800px 100%;
          animation: narrative-shimmer 1.5s linear infinite;
        }
        @keyframes narrative-pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.7; }
        }
        .narrative-pulse-dot {
          animation: narrative-pulse-dot 1s ease-in-out infinite;
        }
        @keyframes narrative-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .narrative-fade-in {
          animation: narrative-fade-in 0.4s ease both;
        }
      `}</style>

      <div
        onClick={state === 'error' ? runGeneration : undefined}
        style={{
          background: '#0A0F1A',
          border: '1px solid rgba(255,255,255,0.08)',
          borderLeft: `3px solid ${leftBorderColor}`,
          borderRadius: '8px',
          padding: '20px 24px',
          width: '100%',
          cursor: state === 'error' ? 'pointer' : 'default',
          marginTop: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '11px',
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
          }}>
            Intelligence Brief
          </span>

          {/* Status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {state === 'generating' && (
              <>
                <div className="narrative-pulse-dot" style={{
                  width: '8px', height: '8px', borderRadius: '50%', background: '#FF9500'
                }} />
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#FF9500', letterSpacing: '0.1em' }}>
                  GENERATING
                </span>
              </>
            )}
            {state === 'complete' && (
              <>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00C851' }} />
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#00C851', letterSpacing: '0.1em' }}>
                  COMPLETE
                </span>
              </>
            )}
            {state === 'error' && (
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#FF4444', letterSpacing: '0.1em' }}>
                ERROR
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        {state === 'idle' && isElevated && (
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); runGeneration(); }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.6)',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.08em',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.5)';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)';
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              GENERATE BRIEF
            </button>
          </div>
        )}

        {state === 'generating' && (
          <Shimmer widths={['100%', '85%', '60%']} />
        )}

        {state === 'complete' && narrative && (
          <div className="narrative-fade-in" style={{
            marginTop: '14px',
            fontFamily: 'inherit',
            fontSize: '14px',
            lineHeight: '1.7',
            color: 'rgba(255,255,255,0.85)',
            whiteSpace: 'pre-wrap',
          }}>
            {renderWithTimestamps(narrative)}
          </div>
        )}

        {state === 'error' && (
          <p style={{ marginTop: '14px', color: '#FF4444', fontSize: '12px', lineHeight: 1.5 }}>
            {error ?? 'Brief generation failed.'} <span style={{ opacity: 0.6 }}>Tap to retry.</span>
          </p>
        )}

        {/* Footer */}
        {state === 'complete' && formattedAt && (
          <div style={{
            marginTop: '14px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.25)',
          }}>
            Generated by Vanguard AI · {formattedAt}
          </div>
        )}
      </div>
    </>
  );
};

export default NarrativePanel;
