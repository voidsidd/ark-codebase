// Static Mock Data for Step 1
export const PARK_CENTER: [number, number] = [11.9833, 76.1167];

// Roughly drawing 8 zones around Nagarhole
export const ZONES = {
    Z1: [[12.01, 76.08], [12.01, 76.12], [11.98, 76.12], [11.98, 76.08]],
    Z2: [[12.01, 76.12], [12.01, 76.16], [11.98, 76.16], [11.98, 76.12]],
    Z3: [[11.98, 76.08], [11.98, 76.12], [11.95, 76.12], [11.95, 76.08]],
    Z4: [[11.98, 76.12], [11.98, 76.16], [11.95, 76.16], [11.95, 76.12]],
    Z5: [[11.95, 76.08], [11.95, 76.12], [11.92, 76.12], [11.92, 76.08]],
    Z6: [[11.95, 76.12], [11.95, 76.16], [11.92, 76.16], [11.92, 76.12]],
    Z7: [[11.92, 76.08], [11.92, 76.12], [11.89, 76.12], [11.89, 76.08]],
    Z8: [[11.92, 76.12], [11.92, 76.16], [11.89, 76.16], [11.89, 76.12]],
};

export type EventType = 'ACOUSTIC' | 'CAMERA' | 'COMMUNITY' | 'CORRELATED' | 'ONE_HEALTH';
export type PriorityLevel = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

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

export const MOCK_ALERTS: AlertEvent[] = [
    {
        id: 'INC-9942',
        type: 'CORRELATED',
        subType: 'CRITICAL INCIDENT',
        zone: 'Z4',
        timestamp: '11:21:45',
        description: 'Deploy ranger unit to Zone 4 immediately. Three correlated human presence signals detected within 90 minutes.',
        priority: 'CRITICAL',
        location: [11.9650, 76.1400],
    },
    {
        id: 'OH-1102',
        type: 'ONE_HEALTH',
        subType: 'RISK FLAG',
        zone: 'Z2',
        timestamp: '10:15:00',
        description: 'Unusual wildlife health pattern detected in Zone 2. Potential zoonotic risk. Recommend veterinary assessment and public health notification.',
        priority: 'HIGH',
        location: [11.9950, 76.1400],
        isOneHealth: true,
    },
    {
        id: 'CAM-8821',
        type: 'CAMERA',
        subType: 'HUMAN_PRESENCE',
        zone: 'Z4',
        timestamp: '11:20:15',
        confidence: 0.89,
        description: 'Human silhouette detected near stream bed.',
        priority: 'ELEVATED',
        location: [11.9701, 76.1523],
    },
    {
        id: 'ACO-7731',
        type: 'ACOUSTIC',
        subType: 'GUNSHOT',
        zone: 'Z4',
        timestamp: '11:18:00',
        confidence: 0.94,
        description: 'High-caliber rifle suspected.',
        priority: 'HIGH',
        location: [11.9654, 76.1387],
    },
    {
        id: 'COM-5511',
        type: 'COMMUNITY',
        subType: 'SUSPICIOUS_VEHICLE',
        zone: 'Z4',
        timestamp: '11:15:30',
        description: 'Unknown vehicle with no headlights seen entering forest road near checkpoint 7.',
        priority: 'NORMAL',
        location: [11.9600, 76.1450],
    },
    {
        id: 'CAM-8820',
        type: 'CAMERA',
        subType: 'SPECIES_DETECTED',
        zone: 'Z1',
        timestamp: '10:45:12',
        confidence: 0.97,
        description: 'Bengal Tiger identified (T-41). Behavior normal.',
        priority: 'NORMAL',
        location: [11.9900, 76.0900],
    }
];

export const MOCK_ZONES_STATUS = [
    { id: 'Z1', name: 'Zone 1', status: 'CLEAR' },
    { id: 'Z2', name: 'Zone 2', status: 'MONITORING' },
    { id: 'Z3', name: 'Zone 3', status: 'CLEAR' },
    { id: 'Z4', name: 'Zone 4', status: 'ACTIVE' },
    { id: 'Z5', name: 'Zone 5', status: 'CLEAR' },
    { id: 'Z6', name: 'Zone 6', status: 'CLEAR' },
    { id: 'Z7', name: 'Zone 7', status: 'CLEAR' },
    { id: 'Z8', name: 'Zone 8', status: 'CLEAR' },
];
