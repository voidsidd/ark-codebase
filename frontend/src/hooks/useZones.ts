import { useState, useCallback } from 'react';
import type { Zone, Alert } from '../types/geo';

export function useZones(initialZones: Zone[] = []) {
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  const addZone = useCallback((zone: Omit<Zone, 'id'>) => {
    const newZone: Zone = {
      ...zone,
      id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    setZones((prev) => [...prev, newZone]);
  }, []);

  const updateZone = useCallback((id: string, updates: Partial<Zone>) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...updates } : z)));
  }, []);

  const deleteZone = useCallback(
    (id: string) => {
      setZones((prev) => prev.filter((z) => z.id !== id));
      setAlerts((prev) => prev.filter((a) => a.zoneId !== id));
      if (selectedZone?.id === id) setSelectedZone(null);
    },
    [selectedZone]
  );

  const addAlert = useCallback(
    (alert: Omit<Alert, 'id' | 'timestamp'>) => {
      const newAlert: Alert = {
        ...alert,
        id: `alert-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      setAlerts((prev) => [newAlert, ...prev].slice(0, 100));

      const zone = zones.find((z) => z.id === alert.zoneId);
      if (zone) {
        updateZone(zone.id, { alerts: (zone.alerts || 0) + 1 });
      }
    },
    [zones, updateZone]
  );

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setZones((prev) => prev.map((z) => ({ ...z, alerts: 0 })));
  }, []);

  return {
    zones,
    alerts,
    selectedZone,
    setSelectedZone,
    addZone,
    updateZone,
    deleteZone,
    addAlert,
    clearAlerts,
    totalAlerts: alerts.length,
    criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
  };
}
