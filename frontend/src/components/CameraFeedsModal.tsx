import React from 'react';
import { X, Camera, Wifi, WifiOff, Link } from 'lucide-react';
import { PARKS } from '../lib/parksData';

interface CameraFeedsModalProps {
    onClose: () => void;
    parkId: string;
}

const CameraFeedsModal: React.FC<CameraFeedsModalProps> = ({ onClose, parkId }) => {
    const park = PARKS.find(p => p.id === parkId);

    // Mock cameras based on selected park zones
    const zones = park ? Object.keys(park.zones) : ['Z1', 'Z2', 'Z3', 'Z4'];
    
    const cameras = [
        { id: 'CAM-01', zone: zones[0] || 'Z1', status: 'ONLINE', model: 'TrailGuard AI v2', threat: 'NONE', image: 'https://images.unsplash.com/photo-1610419993549-74d1252119eb?q=80&w=800&auto=format&fit=crop' },
        { id: 'CAM-02', zone: zones[1] || 'Z2', status: 'ONLINE', model: 'TrailGuard AI v1', threat: 'DETECTED', image: 'https://images.unsplash.com/photo-1564750965-0ae4bf597cfa?q=80&w=800&auto=format&fit=crop' },
        { id: 'CAM-03', zone: zones[2] || 'Z3', status: 'OFFLINE', model: 'TrailGuard AI v2', threat: 'UNKNOWN', image: null },
        { id: 'CAM-04', zone: zones[3] || 'Z4', status: 'ONLINE', model: 'Standard IP Cam', threat: 'NONE', image: 'https://images.unsplash.com/photo-1549479366-cdca7d2d3aee?q=80&w=800&auto=format&fit=crop' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-vanguard-bg border border-vanguard-border rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-vanguard-border bg-vanguard-panel">
                    <div className="flex items-center gap-2">
                        <Camera className="text-vanguard-species w-5 h-5" />
                        <h2 className="font-syne font-bold tracking-widest text-white">CAMERA FEEDS & WEBHOOKS</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-[#0A0F1A]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cameras.map((cam) => (
                            <div key={cam.id} className="bg-vanguard-panel border border-vanguard-border rounded overflow-hidden flex flex-col">
                                {/* Camera Header */}
                                <div className="p-2 border-b border-vanguard-border flex items-center justify-between bg-black/40">
                                    <div className="flex items-center gap-2">
                                        <Camera size={14} className="text-gray-400" />
                                        <span className="text-xs font-mono font-bold text-gray-200">{cam.id}</span>
                                        <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                                            {cam.zone}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {cam.status === 'ONLINE' ? (
                                            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-green-400">
                                                <Wifi size={10} /> ONLINE
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-gray-500">
                                                <WifiOff size={10} /> OFFLINE
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Camera Viewfinder */}
                                <div className="h-48 bg-black relative flex items-center justify-center overflow-hidden">
                                    {cam.image ? (
                                        <>
                                            <img src={cam.image} alt="Camera Feed" className="w-full h-full object-cover opacity-60 mix-blend-luminosity hover:mix-blend-normal transition-all duration-500" />
                                            <div className="absolute inset-0 border-[2px] border-white/5 pointer-events-none">
                                                {/* Viewfinder crosshairs pattern */}
                                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/30 m-2"></div>
                                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white/30 m-2"></div>
                                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white/30 m-2"></div>
                                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/30 m-2"></div>
                                            </div>
                                            <div className="absolute bottom-2 left-2 flex flex-col">
                                                <span className="text-[9px] font-mono text-white/70 bg-black/50 px-1 rounded backdrop-blur">
                                                    {new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-gray-600">
                                            <WifiOff size={24} />
                                            <span className="text-xs font-mono tracking-widest">NO SIGNAL / POWER LOSS</span>
                                        </div>
                                    )}
                                </div>

                                {/* Camera Footer / Actions */}
                                <div className="p-3 bg-vanguard-bg border-t border-vanguard-border flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 font-mono tracking-widest">MODEL</span>
                                        <span className="text-xs text-gray-300 font-sans">{cam.model}</span>
                                    </div>
                                    <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold font-mono bg-vanguard-species/10 text-vanguard-species border border-vanguard-species/30 rounded hover:bg-vanguard-species hover:text-white transition-colors">
                                        <Link size={12} />
                                        CONNECT WEBHOOK
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CameraFeedsModal;
