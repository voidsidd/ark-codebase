import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Wifi, WifiOff, Link, ExternalLink } from 'lucide-react';
import Header from './components/Header';
import { ESTATES } from './lib/estatesData';

interface InatPhoto {
    imageUrl: string;
    speciesCommonName: string;
    scientificName: string;
    observer: string;
    observationUrl: string;
}

const BASE_CAMERAS = [
    { id: 'CAM-01', zoneIdx: 0, status: 'ONLINE',  model: 'TrailGuard AI v2',   threat: 'NONE'     },
    { id: 'CAM-02', zoneIdx: 1, status: 'ONLINE',  model: 'TrailGuard AI v1',   threat: 'DETECTED' },
    { id: 'CAM-03', zoneIdx: 2, status: 'OFFLINE', model: 'TrailGuard AI v2',   threat: 'UNKNOWN'  },
    { id: 'CAM-04', zoneIdx: 3, status: 'ONLINE',  model: 'Standard IP Cam',    threat: 'NONE'     },
    { id: 'CAM-05', zoneIdx: 4, status: 'ONLINE',  model: 'TrailGuard AI v2',   threat: 'NONE'     },
    { id: 'CAM-06', zoneIdx: 5, status: 'ONLINE',  model: 'Standard IP Cam',    threat: 'NONE'     },
    { id: 'CAM-07', zoneIdx: 6, status: 'OFFLINE', model: 'TrailGuard AI v1',   threat: 'UNKNOWN'  },
    { id: 'CAM-08', zoneIdx: 7, status: 'ONLINE',  model: 'TrailGuard AI v2',   threat: 'NONE'     },
];

const CameraFeedsPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const estate = ESTATES.find(p => p.id === id);
    const zones = estate ? Object.keys(estate.zones) : ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8'];

    const [inatPhotos, setInatPhotos] = useState<InatPhoto[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);

    useEffect(() => {
        if (!id) return;
        setLoadingPhotos(true);
        fetch(`/api/inaturalist/${id}`)
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                const photos: InatPhoto[] = (Array.isArray(data) ? data : []).map((obs: {
                    imageUrl: string;
                    speciesCommonName: string;
                    scientificName: string;
                    observer: string;
                    observationUrl: string;
                }) => ({
                    imageUrl: obs.imageUrl,
                    speciesCommonName: obs.speciesCommonName,
                    scientificName: obs.scientificName,
                    observer: obs.observer,
                    observationUrl: obs.observationUrl,
                }));
                setInatPhotos(photos);
            })
            .catch(() => setInatPhotos([]))
            .finally(() => setLoadingPhotos(false));
    }, [id]);

    const cameras = BASE_CAMERAS.map((cam, i) => ({
        ...cam,
        zone: zones[cam.zoneIdx] || `Z${cam.zoneIdx + 1}`,
        photo: cam.status === 'ONLINE' ? (inatPhotos[i] || null) : null,
    }));

    const onlineCount = cameras.filter(c => c.status === 'ONLINE').length;

    if (!id) return null;

    return (
        <div className="h-screen w-screen flex flex-col bg-vanguard-bg text-white overflow-hidden">
            <Header
                onBack={() => navigate(`/estate/${id}`)}
                backLabel="← BACK"
                estateId={id}
                onSpeciesIntel={() => navigate(`/estate/${id}/species`)}
            />

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Page Header */}
                <div className="px-6 pt-5 pb-4 border-b border-vanguard-border bg-vanguard-panel flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Camera className="w-5 h-5 text-vanguard-species" />
                        <h1 className="text-sm font-syne font-bold tracking-widest text-white uppercase">
                            Camera Feeds &amp; Webhooks
                        </h1>
                        {loadingPhotos && (
                            <span className="text-[9px] font-mono text-green-500/60 animate-pulse">SYNCING iNaturalist…</span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono">
                        <span className="text-green-400">{onlineCount} ONLINE</span>
                        <span className="text-gray-500">{cameras.length - onlineCount} OFFLINE</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-400">{estate?.name?.toUpperCase()}</span>
                    </div>
                </div>

                {/* Camera Grid */}
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {cameras.map((cam) => (
                            <div key={cam.id} className="bg-vanguard-panel border border-vanguard-border rounded-lg overflow-hidden flex flex-col">
                                {/* Camera Header */}
                                <div className="p-2.5 border-b border-vanguard-border flex items-center justify-between bg-black/40">
                                    <div className="flex items-center gap-2">
                                        <Camera size={13} className="text-gray-400" />
                                        <span className="text-xs font-mono font-bold text-gray-200">{cam.id}</span>
                                        <span className="text-[9px] font-mono text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                                            {cam.zone}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {cam.status === 'ONLINE' ? (
                                            <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-green-400">
                                                <Wifi size={9} /> ONLINE
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-gray-500">
                                                <WifiOff size={9} /> OFFLINE
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Viewfinder */}
                                <div className="h-44 bg-black relative flex items-center justify-center overflow-hidden">
                                    {cam.status === 'OFFLINE' ? (
                                        <div className="flex flex-col items-center gap-2 text-gray-600">
                                            <WifiOff size={22} />
                                            <span className="text-[10px] font-mono tracking-widest">NO SIGNAL</span>
                                        </div>
                                    ) : cam.photo ? (
                                        <>
                                            <img
                                                src={cam.photo.imageUrl}
                                                alt={cam.photo.speciesCommonName}
                                                className="w-full h-full object-cover opacity-70 mix-blend-luminosity hover:mix-blend-normal hover:opacity-90 transition-all duration-500"
                                                onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                                            />
                                            {/* Viewfinder corners */}
                                            <div className="absolute inset-0 pointer-events-none">
                                                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/30" />
                                                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/30" />
                                                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/30" />
                                                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/30" />
                                            </div>
                                            {cam.threat === 'DETECTED' && (
                                                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-500/90 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded animate-pulse">
                                                    THREAT DETECTED
                                                </div>
                                            )}
                                            {/* Species name overlay */}
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 pt-4 pb-1.5">
                                                <div className="text-[10px] font-syne font-semibold text-white leading-tight truncate">
                                                    {cam.photo.speciesCommonName}
                                                </div>
                                                <div className="text-[8px] font-mono text-gray-400 italic truncate">
                                                    {cam.photo.scientificName}
                                                </div>
                                                <div className="text-[8px] font-mono text-gray-500 truncate">
                                                    📷 {cam.photo.observer}
                                                </div>
                                            </div>
                                        </>
                                    ) : loadingPhotos ? (
                                        <span className="text-[10px] font-mono text-gray-600 animate-pulse">SYNCING…</span>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-gray-600">
                                            <Camera size={22} />
                                            <span className="text-[10px] font-mono tracking-widest">AWAITING FEED</span>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="p-3 bg-vanguard-bg border-t border-vanguard-border flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-500 font-mono tracking-widest">MODEL</span>
                                        <span className="text-[10px] text-gray-300">{cam.model}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {cam.photo?.observationUrl && (
                                            <a
                                                href={cam.photo.observationUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono text-gray-400 border border-vanguard-border/60 rounded hover:text-white hover:border-gray-400 transition-colors"
                                                title="View on iNaturalist"
                                            >
                                                <ExternalLink size={9} /> iNat
                                            </a>
                                        )}
                                        <button onClick={() => navigator.clipboard.writeText(window.location.origin + '/api/webhooks/camera/' + cam.id + '?estateId=' + id + '&zone=' + cam.zone)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-bold font-mono bg-vanguard-species/10 text-vanguard-species border border-vanguard-species/30 rounded hover:bg-vanguard-species hover:text-white transition-colors">
                                            <Link size={10} /> CONNECT WEBHOOK
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CameraFeedsPage;
