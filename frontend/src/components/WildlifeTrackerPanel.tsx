import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchTrackedAnimals,
  fetchCorrelation,
  triggerAnimalSighting,
  TrackedAnimal,
  ZoneThreatCorrelation,
} from '../services/ecologyRiskEngine';

// ─── Paw print SVG icon ────────────────────────────────────────────────────────
function PawIcon({ size = 24, color = '#FF9500' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
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

// ─── Correlation risk bar ──────────────────────────────────────────────────────
function RiskBar({ pct }: { pct: number }) {
  const colour = pct > 70 ? '#FF4444' : pct >= 40 ? '#FF9500' : '#00C851';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '80px',
          height: '3px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(pct, 100)}%`,
            height: '100%',
            background: colour,
            borderRadius: '2px',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          color: colour,
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ─── Relative time string ─────────────────────────────────────────────────────
function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) {
    const diffM = Math.floor(diffMs / 60_000);
    return diffM < 1 ? 'Just now' : `${diffM}m ago`;
  }
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

// ─── Per-row state ─────────────────────────────────────────────────────────────
interface RowState {
  status: 'idle' | 'loading' | 'success' | 'no_alert' | 'error';
  message: string;
}

interface WildlifeTrackerPanelProps {
  onAlertGenerated?: () => void;
}

const WildlifeTrackerPanel: React.FC<WildlifeTrackerPanelProps> = ({ onAlertGenerated }) => {
  const [animals, setAnimals] = useState<TrackedAnimal[]>([]);
  const [correlations, setCorrelations] = useState<Record<string, ZoneThreatCorrelation | null>>(
    {}
  );
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const load = useCallback(async () => {
    const list = await fetchTrackedAnimals();
    setAnimals(list);

    // Fetch correlations for each animal's zone
    const corrMap: Record<string, ZoneThreatCorrelation | null> = {};
    await Promise.all(
      list.map(async (animal) => {
        const key = `${animal.animal_id}__${animal.zone_id}`;
        corrMap[key] = await fetchCorrelation(animal.zone_id, animal.species);
      })
    );
    setCorrelations(corrMap);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSimulate = useCallback(
    async (animal: TrackedAnimal) => {
      const key = animal.animal_id;

      setRowStates((prev) => ({
        ...prev,
        [key]: { status: 'loading', message: 'Querying threat correlations...' },
      }));

      // Simulate two-phase message for UX
      setTimeout(() => {
        setRowStates((prev) => {
          if (prev[key]?.status === 'loading') {
            return {
              ...prev,
              [key]: { status: 'loading', message: 'Generating predictive assessment...' },
            };
          }
          return prev;
        });
      }, 1000);

      try {
        const result = await triggerAnimalSighting(
          animal.animal_id,
          animal.species,
          animal.zone_id,
          'CT-DEMO-01'
        );

        if (result.created_alert) {
          setRowStates((prev) => ({
            ...prev,
            [key]: { status: 'success', message: '⚡ PREDICTIVE ALERT GENERATED' },
          }));
          onAlertGenerated?.();
          // Refresh animal list
          await load();
        } else {
          setRowStates((prev) => ({
            ...prev,
            [key]: { status: 'no_alert', message: result.reason ?? 'No alert needed' },
          }));
        }

        // Reset after 3 seconds
        setTimeout(() => {
          setRowStates((prev) => ({
            ...prev,
            [key]: { status: 'idle', message: '' },
          }));
        }, 3000);
      } catch (err) {
        setRowStates((prev) => ({
          ...prev,
          [key]: { status: 'error', message: 'Generation failed. Retry.' },
        }));
      }
    },
    [load, onAlertGenerated]
  );

  return (
    <>
      <style>{`
        .wildlife-btn:hover {
          background: rgba(255,149,0,0.2) !important;
        }
      `}</style>

      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '16px',
        }}
      >
        {/* Panel header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <PawIcon size={18} color="#FF9500" />
          <span
            style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: '12px',
              letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
            }}
          >
            Wildlife Intelligence
          </span>
        </div>

        {animals.length === 0 && (
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
            No tracked animals. Run the seed migration to add T-08.
          </p>
        )}

        {/* Animal rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {animals.map((animal) => {
            const corrKey = `${animal.animal_id}__${animal.zone_id}`;
            const corr = correlations[corrKey];
            const rstate = rowStates[animal.animal_id] ?? { status: 'idle', message: '' };
            const isLoading = rstate.status === 'loading';

            return (
              <div
                key={animal.animal_id}
                style={{
                  background: '#0A0F1A',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  padding: '12px 14px',
                }}
              >
                {/* Row header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    >
                      {animal.animal_id}
                    </div>
                    <div
                      style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}
                    >
                      {animal.species}
                    </div>
                  </div>

                  {/* Simulate Sighting button */}
                  <button
                    className="wildlife-btn"
                    disabled={isLoading}
                    onClick={() => handleSimulate(animal)}
                    style={{
                      background: 'rgba(255,149,0,0.1)',
                      border: '1px solid rgba(255,149,0,0.3)',
                      color: isLoading ? 'rgba(255,149,0,0.5)' : '#FF9500',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontFamily: 'monospace',
                      textTransform: 'uppercase',
                      transition: 'background 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isLoading ? 'Processing...' : 'Simulate Sighting'}
                  </button>
                </div>

                {/* Zone + last seen */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}
                >
                  <span
                    style={{
                      background: 'rgba(255,149,0,0.1)',
                      border: '1px solid rgba(255,149,0,0.25)',
                      color: '#FF9500',
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      padding: '2px 7px',
                      borderRadius: '3px',
                    }}
                  >
                    {animal.zone_id.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                    Last seen {relativeTime(animal.confirmed_at)}
                  </span>
                </div>

                {/* Correlation risk bar */}
                {corr && (
                  <div style={{ marginTop: '8px' }}>
                    <RiskBar pct={corr.correlation_pct} />
                  </div>
                )}

                {/* Status message */}
                {rstate.status !== 'idle' && (
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color:
                        rstate.status === 'success'
                          ? '#00C851'
                          : rstate.status === 'error'
                            ? '#FF4444'
                            : rstate.status === 'no_alert'
                              ? '#FF9500'
                              : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {rstate.message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default WildlifeTrackerPanel;
