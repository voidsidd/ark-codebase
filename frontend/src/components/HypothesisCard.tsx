import React from 'react';
import { HypothesisResult } from '../services/hypothesisEngine';

interface HypothesisCardProps {
  hypothesis: HypothesisResult | null;
  isLoading: boolean;
  onReassess?: () => void;
}

// ─── Confidence colours ────────────────────────────────────────────────────────
function getConfidenceStyle(confidence: number): { bg: string; border: string; text: string } {
  if (confidence >= 70)
    return {
      bg: 'rgba(0,200,81,0.15)',
      border: 'rgba(0,200,81,0.4)',
      text: '#00C851',
    };
  if (confidence >= 40)
    return {
      bg: 'rgba(255,149,0,0.15)',
      border: 'rgba(255,149,0,0.4)',
      text: '#FF9500',
    };
  return {
    bg: 'rgba(255,68,68,0.15)',
    border: 'rgba(255,68,68,0.4)',
    text: '#FF4444',
  };
}

const HypothesisCard: React.FC<HypothesisCardProps> = ({ hypothesis, isLoading, onReassess }) => {
  const confidence = hypothesis?.confidence ?? 0;
  const confStyle = getConfidenceStyle(confidence);
  const hasHighConfidence = confidence >= 70;

  const formattedAt = hypothesis?.assessed_at
    ? (() => {
        const d = new Date(hypothesis.assessed_at);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      })()
    : null;

  return (
    <>
      <style>{`
        @keyframes hyp-shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .hyp-shimmer {
          background: linear-gradient(90deg,
            rgba(255,255,255,0.06) 0%,
            rgba(255,255,255,0.12) 50%,
            rgba(255,255,255,0.06) 100%
          );
          background-size: 800px 100%;
          animation: hyp-shimmer 1.5s linear infinite;
          border-radius: 4px;
          height: 12px;
        }
        @keyframes hyp-pulse-dot {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.35); }
        }
        .hyp-pulse-dot {
          animation: hyp-pulse-dot 1s ease-in-out infinite;
        }
        @keyframes hyp-border-rotate {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .hyp-gradient-wrapper {
          position: relative;
          border-radius: 9px;
          padding: 1px;
          background: linear-gradient(90deg,
            rgba(99,102,241,0.6),
            rgba(59,130,246,0.6),
            rgba(99,102,241,0.6)
          );
          background-size: 200% 100%;
          animation: hyp-border-rotate 3s linear infinite;
        }
        .hyp-inner {
          background: #080D18;
          border-radius: 8px;
          overflow: hidden;
        }
      `}</style>

      {/* Animated gradient border wrapper — only for high confidence */}
      <div
        style={{ marginTop: '16px' }}
        className={hasHighConfidence ? 'hyp-gradient-wrapper' : ''}
      >
        <div
          className={hasHighConfidence ? 'hyp-inner' : ''}
          style={
            hasHighConfidence
              ? {}
              : {
                  background: '#080D18',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  marginTop: '16px',
                }
          }
        >
          <div style={{ padding: '20px 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: '11px',
                  letterSpacing: '0.15em',
                  color: 'rgba(255,255,255,0.35)',
                  textTransform: 'uppercase',
                }}
              >
                Intelligence Assessment
              </span>

              {!isLoading && hypothesis && (
                <span
                  style={{
                    background: confStyle.bg,
                    border: `1px solid ${confStyle.border}`,
                    color: confStyle.text,
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: '4px',
                    letterSpacing: '0.06em',
                  }}
                >
                  {confidence}% CONFIDENCE
                </span>
              )}

              {isLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div
                    className="hyp-pulse-dot"
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#FF9500',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      color: '#FF9500',
                      letterSpacing: '0.1em',
                    }}
                  >
                    ASSESSING...
                  </span>
                </div>
              )}
            </div>

            {/* Loading skeleton */}
            {isLoading && (
              <div
                style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                <div className="hyp-shimmer" style={{ width: '40%' }} />
                <div className="hyp-shimmer" style={{ width: '100%', height: '16px' }} />
                <div className="hyp-shimmer" style={{ width: '75%' }} />
              </div>
            )}

            {/* Null state */}
            {!isLoading && !hypothesis && (
              <p
                style={{
                  marginTop: '16px',
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                No hypothesis data available for this alert.
              </p>
            )}

            {/* Populated state */}
            {!isLoading && hypothesis && (
              <>
                {/* Hypothesis text */}
                <p
                  style={{
                    marginTop: '16px',
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    lineHeight: 1.5,
                  }}
                >
                  {hypothesis.hypothesis}
                </p>

                {/* Divider */}
                <div
                  style={{
                    height: '1px',
                    background: 'rgba(255,255,255,0.06)',
                    margin: '16px 0',
                  }}
                />

                {/* Supporting evidence */}
                <div>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.3)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                    }}
                  >
                    Supporting Evidence
                  </div>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.65)',
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {hypothesis.supporting_evidence}
                  </p>
                </div>

                {/* Recommended action */}
                <div
                  style={{
                    marginTop: '12px',
                    background: 'rgba(255,149,0,0.08)',
                    border: '1px solid rgba(255,149,0,0.2)',
                    borderRadius: '6px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <span
                    style={{ color: '#FF9500', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}
                  >
                    ›
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: '#FF9500',
                      fontWeight: 500,
                      lineHeight: 1.5,
                    }}
                  >
                    {hypothesis.recommended_action}
                  </p>
                </div>

                {/* Footer row */}
                <div
                  style={{
                    marginTop: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  {formattedAt && (
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>
                      Assessed at {formattedAt}
                    </span>
                  )}
                  {onReassess && (
                    <button
                      onClick={onReassess}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.25)',
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        letterSpacing: '0.1em',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        textTransform: 'uppercase',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                    >
                      RE-ASSESS
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default HypothesisCard;
