import React from 'react';

interface PredictiveAlertBadgeProps {
  correlationPct: number;
}

function PawIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="#FF9500"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="6" cy="5.5" rx="2" ry="2.5" />
      <ellipse cx="10" cy="3.5" rx="1.8" ry="2.2" />
      <ellipse cx="14" cy="3.5" rx="1.8" ry="2.2" />
      <ellipse cx="18" cy="5.5" rx="2" ry="2.5" />
      <path d="M12 8C8.5 8 5 10.5 5 14c0 2.5 1.5 4.5 4 5.5l3 1 3-1c2.5-1 4-3 4-5.5 0-3.5-3.5-6-7-6z" />
    </svg>
  );
}

const PredictiveAlertBadge: React.FC<PredictiveAlertBadgeProps> = ({ correlationPct }) => {
  return (
    <span
      title={`Predictive threat — ${correlationPct}% historical correlation`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(255,149,0,0.1)',
        border: '1px solid rgba(255,149,0,0.25)',
        borderRadius: '4px',
        padding: '3px 8px',
      }}
    >
      <PawIcon />
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#FF9500',
          letterSpacing: '0.1em',
          fontWeight: 600,
        }}
      >
        PREDICTIVE
      </span>
    </span>
  );
};

export default PredictiveAlertBadge;
