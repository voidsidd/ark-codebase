import React, { useEffect, useState } from 'react';
import { Thermometer, Wind, CloudRain, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { ESTATES } from '../lib/estatesData';
import { useLiveAlerts, EnvironmentData } from '../lib/liveStream';

interface EnvironmentPanelProps {
  estateId?: string | null;
  coords?: [number, number] | null; // [lat, lon] override for estate mode
}

function getMoonEmoji(illumination: number): string {
  if (illumination < 0.1) return '🌑';
  if (illumination < 0.25) return '🌒';
  if (illumination < 0.5) return '🌓';
  if (illumination < 0.75) return '🌔';
  if (illumination < 0.9) return '🌕';
  return '🌕';
}

function getThreatColor(multiplier: number): string {
  if (multiplier >= 1.8) return 'text-red-500';
  if (multiplier >= 1.4) return 'text-orange-400';
  if (multiplier >= 1.1) return 'text-amber-400';
  return 'text-green-400';
}

function getThreatBg(multiplier: number): string {
  if (multiplier >= 1.8) return 'bg-red-500/10 border-red-500/30';
  if (multiplier >= 1.4) return 'bg-orange-500/10 border-orange-500/30';
  if (multiplier >= 1.1) return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-green-500/10 border-green-500/30';
}

const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({ estateId, coords }) => {
  const estate = ESTATES.find((p) => p.id === estateId);
  const { environmentData: liveEnv } = useLiveAlerts(estateId);
  const [localEnv, setLocalEnv] = useState<EnvironmentData | null>(null);
  const [loading, setLoading] = useState(false);

  // Determine which coordinates to use: explicit coords override > estate center
  const fetchCoords: [number, number] | null = coords ?? (estate ? estate.centerCoordinates : null);

  // Fetch environment data on mount and when coords / estate changes
  useEffect(() => {
    if (!fetchCoords) return;
    const [lat, lon] = fetchCoords;
    setLoading(true);
    fetch(`/api/environment/${lat}/${lon}`)
      .then((r) => r.json())
      .then((data) => setLocalEnv(data))
      .catch(() => setLocalEnv(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId, coords?.join(',')]);

  // Prefer SSE-pushed data (liveEnv) over locally fetched data
  const env = liveEnv || localEnv;

  // For estate mode without a estateId match, we still want to render once coords are available
  if (!estate && !coords) return null;

  return (
    <div className="flex flex-col gap-2 p-3 bg-vanguard-panel border border-vanguard-border rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
          Environment
        </span>
        <div className="flex items-center gap-1.5">
          {env ? (
            <span className="text-[10px] font-mono text-green-500 flex items-center gap-1">
              <Wifi size={10} />{' '}
              {(env as { dataSource?: string }).dataSource === 'open-meteo'
                ? 'LIVE (Open-Meteo)'
                : 'OFFLINE'}
            </span>
          ) : loading ? (
            <span className="text-[10px] font-mono text-gray-500">FETCHING...</span>
          ) : (
            <span className="text-[10px] font-mono text-gray-600 flex items-center gap-1">
              <WifiOff size={10} /> OFFLINE
            </span>
          )}
        </div>
      </div>

      {env ? (
        <div className="grid grid-cols-2 gap-2">
          {/* Temperature */}
          <div className="flex items-center gap-2">
            <Thermometer size={13} className="text-orange-400 shrink-0" />
            <div>
              <div className="text-white text-sm font-mono font-bold">
                {env.temperature != null ? `${env.temperature}°C` : '—'}
              </div>
              <div className="text-[9px] text-gray-500 font-mono">TEMP</div>
            </div>
          </div>

          {/* Wind */}
          <div className="flex items-center gap-2">
            <Wind size={13} className="text-cyan-400 shrink-0" />
            <div>
              <div className="text-white text-sm font-mono font-bold">
                {env.windSpeed != null ? `${env.windSpeed} km/h` : '—'}
              </div>
              <div className="text-[9px] text-gray-500 font-mono">WIND</div>
            </div>
          </div>

          {/* Precipitation */}
          <div className="flex items-center gap-2">
            <CloudRain size={13} className="text-blue-400 shrink-0" />
            <div>
              <div className="text-white text-sm font-mono font-bold">
                {env.precipitationProbability != null ? `${env.precipitationProbability}%` : '—'}
              </div>
              <div className="text-[9px] text-gray-500 font-mono">PRECIP</div>
            </div>
          </div>

          {/* Lunar */}
          <div className="flex items-center gap-2">
            <span className="text-sm shrink-0">{getMoonEmoji(env.lunarIllumination)}</span>
            <div>
              <div className="text-white text-sm font-mono font-bold">
                {(env.lunarIllumination * 100).toFixed(0)}%
              </div>
              <div className="text-[9px] text-gray-500 font-mono">LUNAR</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-[10px] font-mono text-gray-600 text-center py-2">
          {loading ? 'Connecting to Open-Meteo...' : 'Environment data unavailable'}
        </div>
      )}

      {/* Threat Multiplier Bar */}
      {env && (
        <div
          className={`mt-1 p-2 rounded border ${getThreatBg(env.threatMultiplier)} flex items-center justify-between`}
        >
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={11} className={getThreatColor(env.threatMultiplier)} />
            <span className="text-[10px] font-mono text-gray-400">THREAT MATRIX</span>
          </div>
          <span className={`text-sm font-mono font-bold ${getThreatColor(env.threatMultiplier)}`}>
            {env.threatMultiplier}x
          </span>
        </div>
      )}

      {/* Weather description */}
      {env?.weatherDescription && env.weatherDescription !== 'Data unavailable' && (
        <div className="text-[10px] font-mono text-gray-600 text-center">
          {env.weatherDescription}
        </div>
      )}
    </div>
  );
};

export default EnvironmentPanel;
