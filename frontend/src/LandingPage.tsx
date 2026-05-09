import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PARKS, Park } from './lib/parksData';
import { Shield, Github, FileText, Mail, ArrowRight, Radio } from 'lucide-react';

// Custom hook for animated counter
const useAnimatedCounter = (endValue: number, duration: number = 2000, suffix: string = '') => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            setCount(Math.floor(easeProgress * endValue));
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [endValue, duration]);

    return `${count}${suffix}`;
};

const NumberCounter = ({ value, suffix, label }: { value: number; suffix?: string; label: string }) => {
    const displayValue = useAnimatedCounter(value, 2000, suffix);
    return (
        <div className="flex flex-col items-center">
            <div className="text-4xl lg:text-5xl font-mono font-bold text-white mb-2">{displayValue}</div>
            <div className="text-xs uppercase tracking-widest text-gray-400 font-sans">{label}</div>
        </div>
    );
};

const Particles = () => {
    const particles = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 20 + 20,
        delay: Math.random() * -20,
    }));

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="absolute bg-white rounded-full opacity-20"
                    style={{
                        left: p.left,
                        top: p.top,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        animation: `particle-drift ${p.duration}s linear infinite`,
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}
        </div>
    );
};

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [transitionState, setTransitionState] = useState<'idle' | 'pulsing' | 'loading'>('idle');
    const [selectedPark, setSelectedPark] = useState<Park | null>(null);

    const handleParkClick = (park: Park) => {
        if (transitionState !== 'idle') return;

        setSelectedPark(park);
        setTransitionState('pulsing');

        setTimeout(() => {
            setTransitionState('loading');
            setTimeout(() => {
                navigate(`/park/${park.id}`);
            }, 1500);
        }, 200);
    };

    return (
        <div className="min-h-screen bg-[#0A0F1A] bg-topo text-white relative selection:bg-vanguard-species selection:text-white pb-24">

            <Particles />

            {/* Header Section */}
            <div className="relative z-10 pt-20 pb-16 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
                <div className="flex items-center gap-4 mb-4">
                    <Shield className="w-12 h-12 text-white" strokeWidth={1.5} />
                    <h1 className="text-5xl font-extrabold tracking-[0.2em] uppercase">Vanguard</h1>
                </div>
                <p className="text-xl text-gray-400 font-sans tracking-wide mb-16">
                    AI-Powered Wildlife Intelligence.
                </p>

                {/* Counters */}
                <div className="flex flex-wrap justify-center gap-12 lg:gap-24 w-full border-y border-white/10 py-10 bg-black/20 backdrop-blur-sm">
                    <NumberCounter value={99} suffix="%" label="Powered by Advanced CV" />
                    <div className="hidden lg:block w-px bg-white/10"></div>
                    <NumberCounter value={6} label="Protected Areas" />
                    <div className="hidden lg:block w-px bg-white/10"></div>
                    <NumberCounter value={24} suffix="/7" label="Real-Time Threat Detection" />
                </div>
            </div>

            {/* Grid Section */}
            <div className="relative z-10 px-6 max-w-7xl mx-auto pb-20">
                <h2 className="text-center text-sm font-bold tracking-[0.3em] text-vanguard-species mb-10">SELECT A PROTECTED AREA</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {PARKS.map((park) => (
                        <div
                            key={park.id}
                            onClick={() => handleParkClick(park)}
                            className={`group relative h-64 rounded bg-gradient-to-br ${park.gradient} border border-white/5 cursor-pointer overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between p-5`}
                            style={{
                                borderColor: selectedPark?.id === park.id && transitionState === 'pulsing' ? park.accentColor : undefined,
                                boxShadow: selectedPark?.id === park.id && transitionState === 'pulsing' ? `0 0 30px ${park.accentColor}` : undefined,
                            }}
                        >
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-300"></div>

                            <div className="relative z-10 flex justify-between items-start">
                                <span className="text-sm tracking-widest text-white/80 flex items-center gap-2">
                                    <span className="text-lg">{park.countryFlag}</span> {park.country.toUpperCase()}
                                </span>
                            </div>

                            <div className="relative z-10 mt-auto mb-4">
                                <h3 className="text-3xl font-bold font-sans tracking-wide mb-1 transition-transform duration-300 group-hover:translate-x-1">{park.name}</h3>
                                <p className="text-sm text-white/60 font-sans">{park.ecosystem}</p>
                            </div>

                            <div className="relative z-10 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-white/40 font-mono tracking-wider">AREA (HA)</span>
                                    <span className="text-xs font-mono font-semibold" style={{ color: park.accentColor }}>
                                        {park.area.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-white/40 font-mono tracking-wider truncate">SPECIES</span>
                                    <span className="text-xs font-mono font-semibold text-white/90 truncate" title={park.primarySpecies}>
                                        {park.primarySpecies.split(',')[0]}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-white/40 font-mono tracking-wider">SENSORS</span>
                                    <span className="text-xs font-mono font-semibold text-white/90">
                                        <Radio className="w-3 h-3 inline mr-1 opacity-70" />
                                        {park.activeSensors}
                                    </span>
                                </div>
                            </div>

                            <div className="absolute bottom-4 right-4 z-20 translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                                    style={{ backgroundColor: park.accentColor }}
                                >
                                    <ArrowRight className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="absolute inset-0 border-2 rounded border-transparent group-hover:border-white/20 transition-colors duration-300 pointer-events-none"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <footer className="absolute bottom-0 w-full border-t border-white/10 bg-black/50 backdrop-blur-md h-16 flex items-center justify-between px-6 text-xs text-white/50 font-sans z-10">
                <div className="hidden md:block">
                    Vanguard Wildlife Intelligence Platform — Built for Microsoft Hackathon 2026
                </div>
                <div className="flex items-center gap-6">
                    <Github className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
                    <FileText className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
                    <Mail className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
                </div>
                <div className="flex items-center gap-2">
                    Powered by Azure AI
                    <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center ml-1">
                        <span className="text-[8px] text-white font-bold">A</span>
                    </div>
                </div>
            </footer>

            {/* Transition Overlay */}
            {transitionState === 'loading' && selectedPark && (
                <div className="fixed inset-0 z-50 bg-[#0A0F1A] flex flex-col items-center justify-center animate-in fade-in duration-400">
                    <h2 className="text-4xl md:text-6xl font-bold font-sans tracking-wider mb-6 text-white text-center">
                        {selectedPark.name}
                    </h2>
                    <div className="text-sm font-mono tracking-widest text-vanguard-species mb-12">
                        INITIALIZING VANGUARD COMMAND CENTER
                    </div>
                    <div className="w-64 md:w-96 h-1 bg-white/10 rounded overflow-hidden">
                        <div
                            className="h-full"
                            style={{
                                backgroundColor: selectedPark.accentColor,
                                animation: 'load-bar 1.5s ease-in-out forwards',
                            }}
                        ></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;
