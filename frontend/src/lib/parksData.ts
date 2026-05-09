import { getRandomPointInZone, PARK_SHAPES } from './zoneGenerator';

export type EventType = 'ACOUSTIC' | 'CAMERA' | 'COMMUNITY' | 'CORRELATED' | 'ONE_HEALTH' | 'WILDLIFE_CORRELATION';
export type PriorityLevel = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' | 'PREDICTIVE';

export interface AlertEvent {
    id: string;
    type: EventType;
    subType: string;
    zone: string;
    timestamp: string;
    confidence?: number;
    description: string;
    priority: PriorityLevel;
    location: [number, number];
    isOneHealth?: boolean;
}

export interface Park {
    id: string;
    name: string;
    country: string;
    countryFlag: string;
    ecosystem: string;
    area: number;
    primarySpecies: string;
    activeSensors: number;
    centerCoordinates: [number, number];
    gradient: string;
    accentColor: string;
    zones: Record<string, [number, number][]>;
    mockAlerts: AlertEvent[];
}

function generateMockAlertsForPark(parkId: string, zones: Record<string, [number, number][]>): AlertEvent[] {
    // We want to generate a standard set of mock events but map them perfectly into this park's specific Z1-Z8 polygons.
    return [
        {
            id: `${parkId.toUpperCase()}-INC-9942`,
            type: 'CORRELATED',
            subType: 'CRITICAL INCIDENT',
            zone: 'Z4',
            timestamp: '11:21:45',
            description: 'Deploy ranger unit to Zone 4 immediately. Three correlated human presence signals detected within 90 minutes.',
            priority: 'CRITICAL',
            location: getRandomPointInZone(zones['Z4']),
        },
        {
            id: `${parkId.toUpperCase()}-OH-1102`,
            type: 'ONE_HEALTH',
            subType: 'RISK FLAG',
            zone: 'Z2',
            timestamp: '10:15:00',
            description: 'Unusual wildlife health pattern detected in Zone 2. Potential zoonotic risk. Recommend veterinary assessment and public health notification.',
            priority: 'HIGH',
            location: getRandomPointInZone(zones['Z2']),
            isOneHealth: true,
        },
        {
            id: `${parkId.toUpperCase()}-CAM-8821`,
            type: 'CAMERA',
            subType: 'HUMAN_PRESENCE',
            zone: 'Z4',
            timestamp: '11:20:15',
            confidence: 0.89,
            description: 'Human silhouette detected near stream bed.',
            priority: 'ELEVATED',
            location: getRandomPointInZone(zones['Z4']),
        },
        {
            id: `${parkId.toUpperCase()}-ACO-7731`,
            type: 'ACOUSTIC',
            subType: 'GUNSHOT',
            zone: 'Z4',
            timestamp: '11:18:00',
            confidence: 0.94,
            description: 'High-caliber rifle suspected.',
            priority: 'HIGH',
            location: getRandomPointInZone(zones['Z4']),
        },
        {
            id: `${parkId.toUpperCase()}-COM-5511`,
            type: 'COMMUNITY',
            subType: 'SUSPICIOUS_VEHICLE',
            zone: 'Z4',
            timestamp: '11:15:30',
            description: 'Unknown vehicle with no headlights seen entering forest road near checkpoint 7.',
            priority: 'NORMAL',
            location: getRandomPointInZone(zones['Z4']),
        },
        {
            id: `${parkId.toUpperCase()}-CAM-8820`,
            type: 'CAMERA',
            subType: 'SPECIES_DETECTED',
            zone: 'Z1',
            timestamp: '10:45:12',
            confidence: 0.97,
            description: 'Subject identified. Behavior normal.',
            priority: 'NORMAL',
            location: getRandomPointInZone(zones['Z1']),
        }
    ];
}

const NGH_ZONES = PARK_SHAPES.nagarhole(11.9833, 76.1167);
const COR_ZONES = PARK_SHAPES.corbett(29.5300, 78.7747);
const KAZ_ZONES = PARK_SHAPES.kaziranga(26.5775, 93.1711);
const SUN_ZONES = PARK_SHAPES.sundarbans(21.9497, 88.9468);
const MARA_ZONES = PARK_SHAPES.maasaimara(-1.4061, 35.1019);
const KRU_ZONES = PARK_SHAPES.kruger(-23.9884, 31.5547);

// ── Supabase UUID ↔ short-ID mapping ──────────────────────────────────────────
// Parks in Supabase use repeating-digit UUIDs for easy identification.
export const PARK_UUID_MAP: Record<string, string> = {
    '11111111-1111-1111-1111-111111111111': 'nagarhole',
    '22222222-2222-2222-2222-222222222222': 'corbett',
    '33333333-3333-3333-3333-333333333333': 'kaziranga',
    '44444444-4444-4444-4444-444444444444': 'sundarbans',
    '55555555-5555-5555-5555-555555555555': 'maasai-mara',
    '66666666-6666-6666-6666-666666666666': 'kruger',
};

/** Resolve any park ID (UUID or short string) to the short string used in PARKS[] */
export function resolveParkId(id: string | null | undefined): string {
    if (!id) return 'nagarhole';
    return PARK_UUID_MAP[id] ?? id;
}

/** Lookup a Park by any ID format (UUID or short). Returns undefined if not found. */
export function getParkById(id: string | null | undefined): Park | undefined {
    return PARKS.find(p => p.id === resolveParkId(id));
}

export const PARKS: Park[] = [
    {
        id: 'nagarhole',
        name: 'Nagarhole National Park',
        country: 'India',
        countryFlag: '🇮🇳',
        ecosystem: 'Tropical Dry Deciduous Forest',
        area: 64300,
        primarySpecies: 'Bengal Tiger, Indian Elephant, Indian Leopard',
        activeSensors: 47,
        centerCoordinates: [11.9833, 76.1167],
        gradient: 'from-[#0A2E0A] to-[#1A4A1A]',
        accentColor: '#10B981',
        zones: NGH_ZONES,
        mockAlerts: generateMockAlertsForPark('nagarhole', NGH_ZONES)
    },
    {
        id: 'corbett',
        name: 'Jim Corbett National Park',
        country: 'India',
        countryFlag: '🇮🇳',
        ecosystem: 'Sub-Himalayan Bhabar Grassland',
        area: 131800,
        primarySpecies: 'Bengal Tiger, Asian Elephant, Gharial',
        activeSensors: 63,
        centerCoordinates: [29.5300, 78.7747],
        gradient: 'from-[#2E1A0A] to-[#4A3010]',
        accentColor: '#F59E0B',
        zones: COR_ZONES,
        mockAlerts: generateMockAlertsForPark('corbett', COR_ZONES)
    },
    {
        id: 'kaziranga',
        name: 'Kaziranga National Park',
        country: 'India',
        countryFlag: '🇮🇳',
        ecosystem: 'Brahmaputra Floodplain Wetland',
        area: 43000,
        primarySpecies: 'One-Horned Rhinoceros, Asian Elephant, Tiger',
        activeSensors: 38,
        centerCoordinates: [26.5775, 93.1711],
        gradient: 'from-[#0A1E2E] to-[#0F3040]',
        accentColor: '#06B6D4',
        zones: KAZ_ZONES,
        mockAlerts: generateMockAlertsForPark('kaziranga', KAZ_ZONES)
    },
    {
        id: 'sundarbans',
        name: 'Sundarbans National Park',
        country: 'India',
        countryFlag: '🇮🇳',
        ecosystem: 'Mangrove Delta and Tidal Forest',
        area: 133000,
        primarySpecies: 'Bengal Tiger, Irrawaddy Dolphin, Crocodile',
        activeSensors: 52,
        centerCoordinates: [21.9497, 88.9468],
        gradient: 'from-[#0A1E1A] to-[#0F2E28]',
        accentColor: '#14B8A6',
        zones: SUN_ZONES,
        mockAlerts: generateMockAlertsForPark('sundarbans', SUN_ZONES)
    },
    {
        id: 'maasai-mara',
        name: 'Maasai Mara National Reserve',
        country: 'Kenya',
        countryFlag: '🇰🇪',
        ecosystem: 'East African Savanna Grassland',
        area: 151000,
        primarySpecies: 'African Lion, African Elephant, Black Rhino',
        activeSensors: 71,
        centerCoordinates: [-1.4061, 35.1019],
        gradient: 'from-[#2E1E0A] to-[#4A3210]',
        accentColor: '#F97316',
        zones: MARA_ZONES,
        mockAlerts: generateMockAlertsForPark('maasai-mara', MARA_ZONES)
    },
    {
        id: 'kruger',
        name: 'Kruger National Park',
        country: 'South Africa',
        countryFlag: '🇿🇦',
        ecosystem: 'Mixed Bushveld and Savanna',
        area: 1948500,
        primarySpecies: 'African Elephant, White Rhino, Wild Dog',
        activeSensors: 94,
        centerCoordinates: [-23.9884, 31.5547],
        gradient: 'from-[#1E1A0A] to-[#302810]',
        accentColor: '#84CC16',
        zones: KRU_ZONES,
        mockAlerts: generateMockAlertsForPark('kruger', KRU_ZONES)
    }
];
