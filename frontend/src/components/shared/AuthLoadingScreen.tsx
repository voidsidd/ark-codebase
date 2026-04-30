/**
 * AuthLoadingScreen
 * Displays the Creation of Adam painting as a full-screen loading backdrop
 * with an animated glowing ring centered between the two fingertips.
 */
import React from 'react';

interface AuthLoadingScreenProps {
  /** Optional label shown below the spinner. Defaults to "AUTHENTICATING" */
  label?: string;
}

const AuthLoadingScreen: React.FC<AuthLoadingScreenProps> = ({
  label = 'AUTHENTICATING',
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {/* ── Painting ────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '900px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src="/assets/creation-of-adam.png"
          alt="Creation of Adam"
          style={{
            width: '100%',
            height: 'auto',
            objectFit: 'cover',
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
        />

        {/* ── Animated ring: centered between the fingertips ─────────────── */}
        {/*
          The painting is landscape ~5:2. The gap between fingertips is
          very close to horizontal center, slightly above vertical center.
          We position the ring at ~50% left, ~48% top.
        */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '48%',
            transform: 'translate(-50%, -50%)',
            width: '52px',
            height: '52px',
          }}
        >
          {/* Outer glow pulse */}
          <div
            style={{
              position: 'absolute',
              inset: '-6px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,220,160,0.18) 0%, transparent 70%)',
              animation: 'adamPulse 2s ease-in-out infinite',
            }}
          />

          {/* Spinning ring — conic-gradient arc */}
          <svg
            viewBox="0 0 52 52"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              animation: 'adamSpin 1.1s linear infinite',
            }}
          >
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke="rgba(255,220,160,0.15)"
              strokeWidth="2.5"
            />
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke="url(#adamGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="100 40"
              strokeDashoffset="0"
            />
            <defs>
              <linearGradient id="adamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,220,160,0)" />
                <stop offset="60%" stopColor="rgba(255,210,140,0.9)" />
                <stop offset="100%" stopColor="rgba(255,240,200,1)" />
              </linearGradient>
            </defs>
          </svg>

          {/* Centre spark */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: 'rgba(255,230,170,0.85)',
              boxShadow: '0 0 8px 3px rgba(255,210,120,0.5)',
              animation: 'adamPulse 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* ── Label ────────────────────────────────────────────────────────────── */}
      <p
        style={{
          marginTop: '28px',
          fontFamily: 'monospace',
          fontSize: '10px',
          letterSpacing: '0.35em',
          color: 'rgba(255,220,160,0.45)',
          textTransform: 'uppercase',
          animation: 'adamFade 2s ease-in-out infinite',
          userSelect: 'none',
        }}
      >
        {label}
      </p>

      {/* ── Keyframes injected once ───────────────────────────────────────────── */}
      <style>{`
        @keyframes adamSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes adamPulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes adamFade {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default AuthLoadingScreen;
