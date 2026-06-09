export interface Zone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  status: 'critical' | 'warning' | 'normal';
  alerts: number;
}

export interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  latitude: number;
  longitude: number;
  timestamp: string;
  zoneId?: string;
}

export interface GeoSearchResult {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}
