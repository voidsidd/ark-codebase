import axios from 'axios';

const ELEVATION_URL = 'https://api.open-elevation.com/api/v1/lookup';

export async function getElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const response = await axios.post(
      ELEVATION_URL,
      {
        locations: [{ latitude: lat, longitude: lon }],
      },
      { timeout: 5000 }
    );

    return response.data.results[0]?.elevation || null;
  } catch (error) {
    console.error('Elevation error:', error);
    return null;
  }
}
