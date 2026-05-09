import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Shield, Activity, Fingerprint, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getParkById } from '../lib/parksData';

interface HeaderProps {
    onBack?: () => void;
    parkId?: string | null;
    onSpeciesIntel?: () => void;
    backLabel?: string;
}

const Header: React.FC<HeaderProps> = ({ onBack, parkId, onSpeciesIntel, backLabel = 'CHANGE PARK' }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const resolvedPark = parkId ? getParkById(parkId) : undefined;
    const parkDisplay = resolvedPark
        ? resolvedPark.name
        : (parkId ? parkId.replace(/-/g, ' ').toUpperCase() : 'NAGARHOLE NATIONAL PARK');

    return (
        <header className="h-16 shrink-0 z-50 relative"
            style={{ background: 'linear-gradient(180deg,#050810 0%,#0A0F1A 100%)', borderBottom: '1px solid #1F2937' }}>

            {/* Scan line */}
            <div className="absolute bottom-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg,transparent 0%,rgba(16,185,129,0.5) 35%,rgba(16,185,129,0.5) 65%,transparent 100%)' }} />

            {/* 3-column grid — center never overlaps left or right */}
            <div className="h-full grid items-center px-4 gap-2"
                style={{ gridTemplateColumns: '1fr auto 1fr' }}>

                {/* LEFT */}
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    {onBack && (
                        <button onClick={onBack}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono tracking-widest text-vanguard-species hover:text-white bg-vanguard-species/10 hover:bg-vanguard-species/20 border border-vanguard-species/25 rounded transition-all shrink-0">
                            <ArrowLeft className="w-3 h-3 shrink-0" />
                            {backLabel}
                        </button>
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                        <Shield className="text-vanguard-zoneClear w-5 h-5 shrink-0" />
                        <span className="text-base font-syne font-bold tracking-[0.18em] text-white uppercase truncate">
                            VANGUARD
                        </span>
                    </div>
                </div>

                {/* CENTER */}
                <div className="flex flex-col items-center justify-center shrink-0 px-4">
                    <h2 className="text-[13px] font-syne font-bold tracking-[0.22em] text-gray-100 uppercase whitespace-nowrap">
                        {parkDisplay.toUpperCase()}
                    </h2>
                    <span className="text-[9px] text-vanguard-camera font-mono tracking-[0.3em] mt-0.5 opacity-75 whitespace-nowrap">
                        ◈ PROTECTED AREA
                    </span>
                </div>

                {/* RIGHT */}
                <div className="flex items-center justify-end gap-3 min-w-0 overflow-hidden pr-2">
                    <button onClick={() => parkId && navigate(`/park/${parkId}/cameras`)}
                        title="Camera Feeds"
                        className="flex items-center gap-2 px-3.5 py-2 text-[11px] font-mono font-bold bg-vanguard-panel border border-vanguard-border rounded hover:border-vanguard-species/50 hover:text-vanguard-species transition-all shrink-0">
                        <Fingerprint className="w-4 h-4 text-vanguard-species" />
                        <span className="hidden xl:inline tracking-wider">CAMERA</span>
                    </button>
                    <button onClick={onSpeciesIntel ?? (() => parkId && navigate(`/park/${parkId}/species`))}
                        title="Species ID"
                        className="flex items-center gap-2 px-3.5 py-2 text-[11px] font-mono font-bold bg-vanguard-panel border border-vanguard-border rounded hover:border-vanguard-species/50 hover:text-vanguard-species transition-all shrink-0">
                        <span className="w-2 h-2 rounded-full bg-vanguard-species animate-pulse shrink-0" />
                        <span className="hidden xl:inline tracking-wider">SPECIES</span>
                    </button>
                    <button onClick={() => parkId && navigate(`/park/${parkId}/sound`)}
                        title="Sound Analysis"
                        className="flex items-center gap-2 px-3.5 py-2 text-[11px] font-mono font-bold bg-vanguard-panel border border-vanguard-border rounded hover:border-vanguard-community/50 hover:text-vanguard-community transition-all shrink-0">
                        <Activity className="w-4 h-4 text-vanguard-community" />
                        <span className="hidden xl:inline tracking-wider">SOUND</span>
                    </button>

                    <div className="h-6 w-px bg-vanguard-border mx-2 shrink-0" />

                    <div className="shrink-0 text-right whitespace-nowrap flex flex-col justify-center">
                        <div className="text-xs font-mono text-gray-400 leading-tight">
                            {format(currentTime, 'dd MMM yyyy')}
                        </div>
                        <div className="text-sm font-mono text-vanguard-species font-bold leading-tight">
                            {format(currentTime, 'HH:mm:ss')}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
