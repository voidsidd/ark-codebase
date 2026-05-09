import React, { useState, useEffect } from 'react';
import { X, Send, AlertTriangle, Image as ImageIcon, MapPin, Clock, Calendar } from 'lucide-react';
import { PARKS } from '../lib/parksData';

interface CommunityReportModalProps {
    onClose: () => void;
    parkId: string;
}

const CommunityReportModal: React.FC<CommunityReportModalProps> = ({ onClose, parkId }) => {
    const park = PARKS.find(p => p.id === parkId);
    const [description, setDescription] = useState('');
    const [subType, setSubType] = useState('SNARE_DETECTED');
    const [zone, setZone] = useState('Z1');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-collected fields
    const [currentTime, setCurrentTime] = useState(new Date());
    const [geoLocation, setGeoLocation] = useState<{ lat: number; lon: number } | null>(null);

    // Live clock tick
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Auto-detect location via browser Geolocation API
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setGeoLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                },
                () => {
                    // Fallback to park center coordinates
                    if (park) {
                        setGeoLocation({ lat: park.centerCoordinates[0], lon: park.centerCoordinates[1] });
                    }
                }
            );
        } else if (park) {
            setGeoLocation({ lat: park.centerCoordinates[0], lon: park.centerCoordinates[1] });
        }
    }, [parkId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;

        setIsSubmitting(true);
        setError(null);

        const payload = {
            parkId,
            zone,
            type: 'COMMUNITY',
            subType,
            description: `[${currentTime.toISOString()}] [${geoLocation ? `${geoLocation.lat.toFixed(4)},${geoLocation.lon.toFixed(4)}` : 'Unknown'}] ${description}`,
            location: geoLocation ? [geoLocation.lat, geoLocation.lon] : (park?.centerCoordinates || [0, 0])
        };

        try {
            const response = await fetch('/api/webhooks/community', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Failed to submit report. Ensure backend is running.');
            }

            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'An error occurred.');
            setIsSubmitting(false);
        }
    };

    if (!park) return null;

    const dateStr = currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    const timeStr = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-vanguard-bg border border-vanguard-border rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-vanguard-border bg-vanguard-panel">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="text-vanguard-camera w-5 h-5" />
                        <h2 className="font-syne font-bold tracking-widest text-white">COMMUNITY REPORT</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col gap-4">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                <Send className="text-green-400 w-8 h-8 ml-1" />
                            </div>
                            <h3 className="text-xl font-syne font-bold text-white mb-2">REPORT SUBMITTED</h3>
                            <p className="text-sm text-gray-400 font-mono">
                                Alert broadcasted to Vanguard correlation engine.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                            {/* Auto-collected: Date, Time, Location */}
                            <div className="grid grid-cols-3 gap-3 bg-[#0A0F1A] border border-vanguard-border rounded p-3">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-mono font-bold flex items-center gap-1">
                                        <Calendar size={9} /> DATE
                                    </span>
                                    <span className="text-xs font-mono text-green-400">{dateStr}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-mono font-bold flex items-center gap-1">
                                        <Clock size={9} /> TIME
                                    </span>
                                    <span className="text-xs font-mono text-green-400">{timeStr}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-mono font-bold flex items-center gap-1">
                                        <MapPin size={9} /> COORDS
                                    </span>
                                    <span className="text-xs font-mono text-green-400">
                                        {geoLocation
                                            ? `${geoLocation.lat.toFixed(3)}, ${geoLocation.lon.toFixed(3)}`
                                            : 'Acquiring...'}
                                    </span>
                                </div>
                            </div>

                            {/* Incident Type & Zone */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] uppercase tracking-widest text-gray-400 font-mono font-bold">
                                        INCIDENT TYPE
                                    </label>
                                    <select
                                        value={subType}
                                        onChange={(e) => setSubType(e.target.value)}
                                        className="bg-[#0A0F1A] border border-vanguard-border text-white text-sm p-2 rounded focus:border-vanguard-camera outline-none font-mono"
                                    >
                                        <option value="SNARE_DETECTED">SNARE WIRE</option>
                                        <option value="POACHER_CAMP">POACHER CAMP</option>
                                        <option value="INJURED_ANIMAL">INJURED ANIMAL</option>
                                        <option value="GUNSHOT_HEARD">GUNSHOT HEARD</option>
                                        <option value="SUSPICIOUS_VEHICLE">SUSPICIOUS VEHICLE</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] uppercase tracking-widest text-gray-400 font-mono font-bold flex items-center gap-1">
                                        <MapPin size={10} /> ZONE
                                    </label>
                                    <select
                                        value={zone}
                                        onChange={(e) => setZone(e.target.value)}
                                        className="bg-[#0A0F1A] border border-vanguard-border text-white text-sm p-2 rounded focus:border-vanguard-camera outline-none font-mono"
                                    >
                                        {Object.keys(park.zones).map(z => (
                                            <option key={z} value={z}>{z}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest text-gray-400 font-mono font-bold">
                                    FIELD OBSERVATION / DETAILS
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Enter descriptive details of the incident..."
                                    className="bg-[#0A0F1A] border border-vanguard-border text-white text-sm p-3 rounded focus:border-vanguard-camera outline-none font-mono min-h-[100px] resize-none"
                                    required
                                />
                            </div>

                            {/* Photo Upload Placeholder */}
                            <div className="border border-dashed border-vanguard-border rounded bg-[#0A0F1A] p-4 flex flex-col items-center justify-center text-center gap-2">
                                <ImageIcon className="text-gray-500 w-6 h-6" />
                                <span className="text-[10px] font-mono text-gray-400">ATTACH PHOTO EVIDENCE (OPTIONAL)</span>
                            </div>

                            {error && (
                                <div className="text-red-400 text-xs font-mono bg-red-500/10 p-2 rounded border border-red-500/20">
                                    {error}
                                </div>
                            )}

                            {/* Footer Actions */}
                            <div className="flex gap-3 justify-end mt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-xs font-bold font-mono text-gray-400 hover:text-white transition-colors"
                                >
                                    CANCEL
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !description.trim()}
                                    className="flex items-center gap-2 px-5 py-2 text-xs font-bold font-mono bg-vanguard-camera/20 text-vanguard-camera border border-vanguard-camera/50 rounded hover:bg-vanguard-camera hover:text-[#0A0F1A] transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? 'TRANSMITTING...' : 'SUBMIT REPORT'}
                                    {!isSubmitting && <Send size={14} />}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommunityReportModal;
