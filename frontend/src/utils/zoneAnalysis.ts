import * as turf from '@turf/turf';
import type { Zone } from '../types/geo';

export function createZoneBuffer(lat: number, lon: number, radius: number) {
  return turf.buffer(turf.point([lon, lat]), radius, { units: 'meters' }) as any;
}

export function isPointInZone(lat: number, lon: number, zone: Zone): boolean {
  const point = turf.point([lon, lat]);
  const buffer = createZoneBuffer(zone.latitude, zone.longitude, zone.radius);
  return turf.booleanPointInPolygon(point, buffer);
}

export function findZonesForPoint(lat: number, lon: number, zones: Zone[]): Zone[] {
  return zones.filter((zone) => isPointInZone(lat, lon, zone));
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return turf.distance(turf.point([lon1, lat1]), turf.point([lon2, lat2]), { units: 'meters' });
}

export function findNearestZone(lat: number, lon: number, zones: Zone[], maxDist = 5000) {
  const point = turf.point([lon, lat]);
  let nearest: Zone | null = null;
  let minDist = Infinity;

  zones.forEach((zone) => {
    const dist = turf.distance(point, turf.point([zone.longitude, zone.latitude]), {
      units: 'meters',
    });
    if (dist < minDist && dist <= maxDist) {
      minDist = dist;
      nearest = zone;
    }
  });

  return nearest ? { zone: nearest, distance: minDist } : null;
}

export function calculateZoneStats(zone: Zone) {
  const buffer = createZoneBuffer(zone.latitude, zone.longitude, zone.radius);
  return {
    areaHectares: turf.area(buffer) / 10000,
    perimeterMeters: turf.length(turf.polygonToLine(buffer), { units: 'meters' }),
  };
}
