import { useState, useEffect } from 'react';
import { PARKS, AlertEvent, EventType, PriorityLevel, resolveParkId } from './parksData';
import { getRandomPointInZone } from './zoneGenerator';

let sharedAlerts: AlertEvent[] = [];
let listeners: ((alerts: AlertEvent[]) => void)[] = [];
let currentParkId: string | null = null;
let eventSource: EventSource | null = null;

export interface PredictiveState {
    lunarIllumination: number;
    threatMultiplier: number;
    recommendedPatrolZones: string[];
}

export interface EnvironmentData {
    temperature: number;
    windSpeed: number;
    precipitationProbability: number;
    weatherCode: number;
    weatherDescription: string;
    lunarIllumination: number;
    threatMultiplier: number;
    lastUpdated: string;
}

let sharedPredictiveState: PredictiveState | null = null;
let predictiveListeners: ((state: PredictiveState | null) => void)[] = [];

let sharedEnvironmentData: Record<string, EnvironmentData> = {};
let environmentListeners: ((data: EnvironmentData | null, parkId: string) => void)[] = [];

export function addAlert(alert: AlertEvent) {
    sharedAlerts = [alert, ...sharedAlerts].slice(0, 50);
    listeners.forEach(l => l(sharedAlerts));
}

// Safe timestamp — never returns "Invalid Date"
function formatTimestamp(raw: any): string {
    try {
        const now = new Date();
        if (!raw) return now.toLocaleTimeString();
        const d = new Date(raw);
        if (isNaN(d.getTime())) return now.toLocaleTimeString();
        const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `${date} · ${time}`;
    } catch {
        return new Date().toLocaleTimeString();
    }
}

function mapServerEventToAlert(data: any, park: any): AlertEvent | null {
    const payload = data.payload;
    if (!payload) return null;

    let type: EventType;
    let priority: PriorityLevel;

    switch (data.type) {
        case 'ACOUSTIC_ALERT':
            type = 'ACOUSTIC';
            priority = payload.confidence >= 0.92 ? 'CRITICAL' : 'HIGH';
            break;
        case 'CAMERA_ALERT':
            type = 'CAMERA';
            priority = 'HIGH';
            break;
        case 'COMMUNITY_ALERT':
            type = 'COMMUNITY';
            priority = 'ELEVATED';
            break;
        case 'CORRELATED_INCIDENT':
            type = 'CORRELATED';
            priority = (payload.priority as PriorityLevel) || 'CRITICAL';
            break;
        case 'ONE_HEALTH_FLAG':
            type = 'ONE_HEALTH';
            priority = 'HIGH';
            break;
        case 'NEW_ALERT':
            type = (payload.type as EventType) || 'ACOUSTIC';
            priority = (payload.priority as PriorityLevel) || 'HIGH';
            break;
        default:
            return null;
    }

    const zone = payload.zone || 'Z1';
    const zonePolygon = park?.zones?.[zone];
    const location: [number, number] = zonePolygon
        ? getRandomPointInZone(zonePolygon)
        : park?.centerCoordinates || [0, 0];

    return {
        id: payload.id || `EVT-${Date.now()}`,
        type,
        subType: payload.subType || payload.type || type,
        zone,
        location,
        confidence: payload.confidence ?? undefined,
        description: payload.description || payload.message || '',
        timestamp: formatTimestamp(payload.timestamp),
        priority,
    };
}

export function useLiveAlerts(parkId?: string | null) {
    const [alerts, setAlerts] = useState<AlertEvent[]>([]);
    const [predictiveState, setPredictiveState] = useState<PredictiveState | null>(null);
    const [environmentData, setEnvironmentData] = useState<EnvironmentData | null>(null);

    useEffect(() => {
        if (!parkId) {
            setAlerts([]);
            return;
        }

        if (currentParkId !== parkId) {
            currentParkId = parkId;
            const park = PARKS.find(p => p.id === resolveParkId(parkId));
            sharedAlerts = park ? [...park.mockAlerts] : [];

            if (eventSource) eventSource.close();

            eventSource = new EventSource('/api/events');

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const currentPark = PARKS.find(p => p.id === currentParkId);

                    // Full system clear
                    if (data.type === 'SYSTEM_CLEAR' || data.type === 'CLEAR_FEED') {
                        sharedAlerts = [];
                        listeners.forEach(l => l(sharedAlerts));
                        return;
                    }

                    // Selective purge — remove specific IDs
                    if (data.type === 'SELECTIVE_PURGE') {
                        const removedIds = new Set(data.payload?.ids || []);
                        sharedAlerts = sharedAlerts.filter(a => !removedIds.has(a.id));
                        listeners.forEach(l => l(sharedAlerts));
                        return;
                    }

                    if (data.type === 'ENVIRONMENT_UPDATE') {
                        const envParkId = data.payload?.parkId;
                        if (envParkId) {
                            sharedEnvironmentData[envParkId] = data.payload;
                            environmentListeners.forEach(l => l(data.payload, envParkId));
                        }
                        return;
                    }

                    if (data.type === 'SYSTEM_STATE' && data.payload?.feature === 'PREDICTIVE_THREAT') {
                        sharedPredictiveState = data.payload.data;
                        predictiveListeners.forEach(l => l(sharedPredictiveState));
                        return;
                    }

                    // Filter by park
                    const eventParkId = data.payload?.parkId;
                    if (eventParkId && eventParkId !== currentParkId) return;

                    const alert = mapServerEventToAlert(data, currentPark);
                    if (alert) addAlert(alert);

                } catch (err) {
                    console.warn('[liveStream] Failed to parse SSE event:', err);
                }
            };

            eventSource.onerror = () => {
                console.warn('[liveStream] SSE connection error — backend may be offline.');
            };
        }

        setAlerts([...sharedAlerts]);
        setPredictiveState(sharedPredictiveState);
        setEnvironmentData(sharedEnvironmentData[parkId] || null);

        const listener = (newAlerts: AlertEvent[]) => setAlerts([...newAlerts]);
        const predListener = (newState: PredictiveState | null) => setPredictiveState(newState);
        const envListener = (newData: EnvironmentData | null, envParkId: string) => {
            if (envParkId === parkId) setEnvironmentData(newData);
        };

        listeners.push(listener);
        predictiveListeners.push(predListener);
        environmentListeners.push(envListener);

        return () => {
            listeners = listeners.filter(l => l !== listener);
            predictiveListeners = predictiveListeners.filter(l => l !== predListener);
            environmentListeners = environmentListeners.filter(l => l !== envListener);
        };
    }, [parkId]);

    return { alerts, predictiveState, environmentData };
}
