import { useRef, useEffect, useState, lazy, Suspense } from 'react';
import { getParkById, resolveParkId } from '../lib/parksData';
import { useLiveAlerts } from '../lib/liveStream';

// Dynamically import GlobeViewer to code-split Cesium and avoid 2500+ dev network requests
const GlobeViewer = lazy(() => import('./GlobeViewer'));

interface EstateBoundaryData {
  name: string;
  boundary: { type: string; coordinates: [number, number][][] } | null;
  centroid_lat: number | null;
  centroid_lon: number | null;
}

export interface ZonePolygon {
  id: string;
  coords: [number, number][]; // [lat, lon] pairs matching parksData format
  status: 'critical' | 'warning' | 'normal';
}

export default function ZoneManager({
  parkId,
  estateBoundary,
}: {
  parkId: string | null;
  estateBoundary?: EstateBoundaryData | null;
}) {
  const globeRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  // Defer rendering until DOM is fully painted — avoids Cesium mount race
  useEffect(() => { setMounted(true); }, []);

  // Resolve any Supabase UUID → short park ID ('corbett', 'nagarhole', etc.)
  const resolvedId = parkId ? resolveParkId(parkId) : null;
  const park = resolvedId ? getParkById(resolvedId) : null;

  // Subscribe to live alerts to colour globe zones in real-time
  const { alerts } = useLiveAlerts(resolvedId);

  // Derive per-zone status from live alert priorities
  const zonePolygons: ZonePolygon[] = park
    ? Object.entries(park.zones).map(([zoneId, coords]) => {
        const zoneAlerts = alerts.filter(a => a.zone === zoneId);
        let status: 'critical' | 'warning' | 'normal' = 'normal';
        if (zoneAlerts.some(a => a.priority === 'CRITICAL' || a.priority === 'HIGH')) {
          status = 'critical';
        } else if (zoneAlerts.length > 0) {
          status = 'warning';
        }
        return { id: zoneId, coords, status };
      })
    : [];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {mounted && (
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-[#0a0f1a] text-vanguard-camera text-sm tracking-widest font-mono">
              INITIALIZING CESIUM ENGINE...
            </div>
          }
        >
          <GlobeViewer
            ref={globeRef}
            zones={[]}
            zonePolygons={zonePolygons}
            parkId={resolvedId ?? 'estate'}
            estateBoundary={estateBoundary}
          />
        </Suspense>
      )}
    </div>
  );
}