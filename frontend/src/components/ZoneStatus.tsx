import { Activity } from 'lucide-react';
import { PARKS } from '../lib/parksData';
import { useLiveAlerts } from '../lib/liveStream';

interface ZoneStatusProps {
    parkId?: string | null;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'ACTIVE': return 'bg-vanguard-zoneActive text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]';
        case 'MONITORING': return 'bg-vanguard-zoneMonitor text-white';
        default: return 'bg-vanguard-panel text-gray-400';
    }
};

const ZoneStatus: React.FC<ZoneStatusProps> = ({ parkId }) => {
    const park = PARKS.find(p => p.id === parkId);
    const { alerts } = useLiveAlerts(parkId);

    if (!park) return null;

    // Dynamically compute the status of Z1-Z8 based on alerts
    const zonesStatus = Array.from({ length: 8 }, (_, i) => {
        const id = `Z${i + 1}`;
        const zoneAlerts = alerts.filter(a => a.zone === id);
        let status = 'CLEAR';
        if (zoneAlerts.some(a => a.priority === 'CRITICAL' || a.priority === 'HIGH')) {
            status = 'ACTIVE';
        } else if (zoneAlerts.length > 0) {
            status = 'MONITORING';
        }

        return { id, name: `Zone ${i + 1}`, status };
    });

    return (
        <div className="h-full flex flex-col p-4 bg-vanguard-bg">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-400 tracking-widest uppercase flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Zone Status
                </h3>
                <span className="text-xs font-mono text-gray-500">
                    UPDATED: LIVE
                </span>
            </div>

            <div className="grid grid-cols-4 gap-2 flex-1 relative">
                {zonesStatus.map((zone) => (
                    <div
                        key={zone.id}
                        className={`rounded flex flex-col items-center justify-center p-2 transition-all cursor-pointer hover:brightness-125 border border-vanguard-border ${getStatusColor(zone.status)}`}
                    >
                        <span className="text-lg font-bold font-mono mb-1">{zone.id}</span>
                        <span className="text-[9px] font-mono tracking-widest opacity-80">{zone.status}</span>
                    </div>
                ))}
            </div>

            {/* Minimalist Legend */}
            <div className="mt-3 flex justify-center gap-4 text-[10px] font-mono text-gray-500">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-vanguard-zoneClear border border-vanguard-border"></div> CLEAR</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-vanguard-zoneMonitor"></div> MONITORING</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-vanguard-zoneActive shadow-[0_0_5px_rgba(220,38,38,0.5)]"></div> ACTIVE</div>
            </div>
        </div>
    );
};

export default ZoneStatus;
