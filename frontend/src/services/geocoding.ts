import axios from 'axios';
import type { GeoSearchResult } from '../types/geo';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export async function searchLocation(query: string): Promise<GeoSearchResult[]> {
  if (!query.trim()) return [];

  try {
    const response = await axios.get(NOMINATIM_URL, {
      params: {
        q: query,
        format: 'json',
        limit: 5,
      },
      headers: {
        'User-Agent': 'GlobeIntelligence/1.0',
      },
      timeout: 5000,
    });

    return response.data.map((item: any) => ({
      name: item.display_name.split(',')[0],
      displayName: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    }));
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}
