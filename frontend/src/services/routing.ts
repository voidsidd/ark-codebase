import axios from 'axios';
import type { RouteResult } from '../types/geo';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

export async function getRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<RouteResult | null> {
  try {
    const response = await axios.get(`${OSRM_URL}/${startLon},${startLat};${endLon},${endLat}`, {
      params: {
        overview: 'full',
        geometries: 'geojson',
      },
      timeout: 10000,
    });

    if (response.data.code === 'Ok' && response.data.routes[0]) {
      const route = response.data.routes[0];
      return {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
      };
    }
    return null;
  } catch (error) {
    console.error('Routing error:', error);
    return null;
  }
}
