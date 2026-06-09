import { ESTATE_SHAPES } from './zoneGenerator';
import { MOCK_ALERTS, AlertEvent, EventType, PriorityLevel } from './mockData';

export type { AlertEvent, EventType, PriorityLevel };

export interface Estate {
  id: string;
  name: string;
  centerCoordinates: [number, number];
  zones: Record<string, [number, number][]>;
  gradient: string;
  accentColor: string;
  countryFlag: string;
  country: string;
  ecosystem: string;
  area: number;
  primarySpecies: string;
  activeSensors: number;
  mockAlerts: AlertEvent[];
}

export const ESTATES: Estate[] = [
  {
    id: 'nagarhole',
    name: 'Nagarhole National Park',
    centerCoordinates: [11.9833, 76.1167],
    zones: ESTATE_SHAPES.nagarhole(11.9833, 76.1167),
    gradient: 'from-amber-900/30 to-[#0A0F1A]',
    accentColor: '#F59E0B',
    countryFlag: '🇮🇳',
    country: 'India',
    ecosystem: 'Tropical deciduous forest, rich tiger territory',
    area: 64300,
    primarySpecies: 'Bengal Tiger, Asian Elephant, Gaur',
    activeSensors: 24,
    mockAlerts: MOCK_ALERTS,
  },
  {
    id: 'corbett',
    name: 'Jim Corbett National Park',
    centerCoordinates: [29.53, 78.7747],
    zones: ESTATE_SHAPES.corbett(29.53, 78.7747),
    gradient: 'from-violet-900/30 to-[#0A0F1A]',
    accentColor: '#8B5CF6',
    countryFlag: '🇮🇳',
    country: 'India',
    ecosystem: 'Himalayan foothills, riverine marshlands',
    area: 131800,
    primarySpecies: 'Bengal Tiger, Asiatic Elephant, Ghariyal',
    activeSensors: 32,
    mockAlerts: MOCK_ALERTS,
  },
  {
    id: 'kaziranga',
    name: 'Kaziranga National Park',
    centerCoordinates: [26.5775, 93.1711],
    zones: ESTATE_SHAPES.kaziranga(26.5775, 93.1711),
    gradient: 'from-emerald-900/30 to-[#0A0F1A]',
    accentColor: '#10B981',
    countryFlag: '🇮🇳',
    country: 'India',
    ecosystem: 'Brahmaputra floodplains, tall elephant grass',
    area: 43000,
    primarySpecies: 'Indian One-Horned Rhinoceros, Bengal Tiger, Wild Water Buffalo',
    activeSensors: 28,
    mockAlerts: MOCK_ALERTS,
  },
  {
    id: 'sundarbans',
    name: 'Sundarbans Tiger Reserve',
    centerCoordinates: [21.9497, 88.9468],
    zones: ESTATE_SHAPES.sundarbans(21.9497, 88.9468),
    gradient: 'from-cyan-900/30 to-[#0A0F1A]',
    accentColor: '#06B6D4',
    countryFlag: '🇮🇳',
    country: 'India',
    ecosystem: 'Halophytic mangrove forest matrix',
    area: 133000,
    primarySpecies: 'Bengal Tiger, Estuarine Crocodile, River Terrapin',
    activeSensors: 18,
    mockAlerts: MOCK_ALERTS,
  },
  {
    id: 'maasai-mara',
    name: 'Maasai Mara National Reserve',
    centerCoordinates: [-1.4061, 35.1019],
    zones: ESTATE_SHAPES.maasaimara(-1.4061, 35.1019),
    gradient: 'from-blue-900/30 to-[#0A0F1A]',
    accentColor: '#3B82F6',
    countryFlag: '🇰🇪',
    country: 'Kenya',
    ecosystem: 'Savannah grasslands and acacia woodlands',
    area: 151000,
    primarySpecies: 'Lions, Leopards, Cheetahs, Wildebeests',
    activeSensors: 40,
    mockAlerts: MOCK_ALERTS,
  },
  {
    id: 'kruger',
    name: 'Kruger National Park',
    centerCoordinates: [-23.9884, 31.5547],
    zones: ESTATE_SHAPES.kruger(-23.9884, 31.5547),
    gradient: 'from-red-900/30 to-[#0A0F1A]',
    accentColor: '#EF4444',
    countryFlag: '🇿🇦',
    country: 'South Africa',
    ecosystem: 'Dry scrub, bushveld, vast savannah plains',
    area: 1948500,
    primarySpecies: 'African Bush Elephant, Black Rhinoceros, Lion, Leopard',
    activeSensors: 64,
    mockAlerts: MOCK_ALERTS,
  },
];

export const ESTATE_UUID_MAP: Record<string, string> = {
  '11111111-1111-1111-1111-111111111111': 'nagarhole',
  '22222222-2222-2222-2222-222222222222': 'corbett',
  '33333333-3333-3333-3333-333333333333': 'kaziranga',
  '44444444-4444-4444-4444-444444444444': 'sundarbans',
  '55555555-5555-5555-5555-555555555555': 'maasai-mara',
  '66666666-6666-6666-6666-666666666666': 'kruger',
};

export function getEstateById(id: string | null | undefined): Estate {
  if (!id) return ESTATES[0];
  const resolved = resolveEstateId(id);
  return ESTATES.find((e) => e.id === resolved) || ESTATES[0];
}

export function resolveEstateId(id: string): string {
  if (!id) return 'nagarhole';

  // Check if UUID
  if (ESTATE_UUID_MAP[id]) {
    return ESTATE_UUID_MAP[id];
  }

  const idLower = id.toLowerCase();
  if (idLower.includes('nagarhole')) return 'nagarhole';
  if (idLower.includes('corbett')) return 'corbett';
  if (idLower.includes('kaziranga')) return 'kaziranga';
  if (idLower.includes('sundarbans')) return 'sundarbans';
  if (idLower.includes('mara')) return 'maasai-mara';
  if (idLower.includes('kruger')) return 'kruger';
  return 'nagarhole';
}
