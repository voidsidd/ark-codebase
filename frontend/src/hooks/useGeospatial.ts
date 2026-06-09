import { useCallback } from 'react';
import {
  calculateDistance,
  isPointInZone,
  findZonesForPoint,
  findNearestZone,
  calculateZoneStats,
} from '../utils/zoneAnalysis';
import type { Zone } from '../types/geo';

export function useGeospatial() {
  const distance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number) =>
      calculateDistance(lat1, lon1, lat2, lon2),
    []
  );

  const inZone = useCallback(
    (lat: number, lon: number, zone: Zone) => isPointInZone(lat, lon, zone),
    []
  );

  const zonesForPoint = useCallback(
    (lat: number, lon: number, zones: Zone[]) => findZonesForPoint(lat, lon, zones),
    []
  );

  const nearestZone = useCallback(
    (lat: number, lon: number, zones: Zone[]) => findNearestZone(lat, lon, zones),
    []
  );

  const zoneStats = useCallback((zone: Zone) => calculateZoneStats(zone), []);

  return {
    distance,
    inZone,
    zonesForPoint,
    nearestZone,
    zoneStats,
  };
}
