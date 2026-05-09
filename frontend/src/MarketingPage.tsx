import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ChevronDown, Zap, Globe, Eye, Lock, Wifi, ArrowRight, Mail, Github, FileText, ShieldCheck, Users, Radar } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════
   Animated counter — easeOutExpo for that snappy "data incoming" feel
   ══════════════════════════════════════════════════════════════════ */
const useCounter = (end: number, duration = 2200, active = true) => {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!active) return;
        let start: number | null = null;
        const tick = (t: number) => {
            if (!start) start = t;
            const p = Math.min((t - start) / duration, 1);
            const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
            setVal(Math.floor(ease * end));
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [end, duration, active]);
    return val;
};

/* ══════════════════════════════════════════════════════════════════
   Intersection observer hook — triggers once when element enters view
   ══════════════════════════════════════════════════════════════════ */
const useInView = (threshold = 0.25) => {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return { ref, visible };
};

/* ══════════════════════════════════════════════════════════════════
   Stat card with animated counter
   ══════════════════════════════════════════════════════════════════ */
const StatCard = ({ value, suffix = '', label, active }: { value: number; suffix?: string; label: string; active: boolean }) => {
    const display = useCounter(value, 2200, active);
    return (
        <div className="flex flex-col items-center px-6">
            <span className="text-4xl lg:text-5xl font-mono font-bold text-white tracking-tight">
                {display.toLocaleString()}{suffix}
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-gray-500 mt-2 font-mono">{label}</span>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════════
   Floating particle field background
   ══════════════════════════════════════════════════════════════════ */
const Particles = () => {
    const dots = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2.5 + 0.5,
        dur: Math.random() * 30 + 25,
        delay: Math.random() * -30,
    }));
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {dots.map(d => (
                <div key={d.id} className="absolute rounded-full bg-white/[.08]"
                    style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.size, height: d.size, animation: `particle-drift ${d.dur}s linear infinite`, animationDelay: `${d.delay}s` }} />
            ))}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════════
   Grid-line background overlay
   ══════════════════════════════════════════════════════════════════ */
const GridBg = () => (
    <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
);

/* ══════════════════════════════════════════════════════════════════
   PARKS DATA (inline — no dependency on parksData.ts which is auth-gated)
   ══════════════════════════════════════════════════════════════════ */
const MONITORED_PARKS = [
    { name: 'Kruger National Park', country: 'South Africa', flag: '🇿🇦', area: '19,485 km²', species: 'Elephants, Rhinos', rangers: 147, accent: '#DC2626' },
    { name: 'Sundarbans', country: 'India / Bangladesh', flag: '🇮🇳', area: '10,000 km²', species: 'Bengal Tigers', rangers: 89, accent: '#F59E0B' },
    { name: 'Serengeti', country: 'Tanzania', flag: '🇹🇿', area: '14,750 km²', species: 'Wildebeest, Lions', rangers: 156, accent: '#10B981' },
    { name: 'Hwange National Park', country: 'Zimbabwe', flag: '🇿🇼', area: '14,651 km²', species: 'Elephants', rangers: 96, accent: '#8B5CF6' },
    { name: 'Masai Mara', country: 'Kenya', flag: '🇰🇪', area: '1,510 km²', species: 'Big Five', rangers: 67, accent: '#3B82F6' },
    { name: 'Okavango Delta', country: 'Botswana', flag: '🇧🇼', area: '15,000 km²', species: 'Diverse Megafauna', rangers: 112, accent: '#06B6D4' },
];

const METHODOLOGY = [
    { step: '01', title: 'INSTALLATION', desc: 'Acoustic sensors, camera traps, and motion detectors deployed across the protected zone.', icon: Wifi },
    { step: '02', title: 'DETECTION', desc: 'AI processes gunshots, chainsaw signatures, and anomalous movement in real-time.', icon: Radar },
    { step: '03', title: 'INTERPRETATION', desc: 'Contextual threat analysis distinguishes poaching activity from natural events.', icon: Eye },
    { step: '04', title: 'THREAT SIGNALING', desc: 'Encrypted alerts with GPS coordinates dispatched to ranger units within milliseconds.', icon: Zap },
];

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
const MarketingPage: React.FC = () => {
    const navigate = useNavigate();
    const [scrollY, setScrollY] = useState(0);

    // Track scroll for parallax hero
    useEffect(() => {
        const onScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // InView hooks for scroll-triggered animations
    const statsSection = useInView(0.3);
    const crisisSection = useInView(0.3);
    const aboutSection = useInView(0.2);
    const methodSection = useInView(0.2);
    const parksSection = useInView(0.15);
    const tiersSection = useInView(0.2);
    const ctaSection = useInView(0.3);

    const heroOpacity = Math.max(0, 1 - scrollY / 600);

    return (
        <div className="min-h-screen bg-[#050A14] text-white selection:bg-vanguard-species/30 selection:text-white overflow-x-hidden">

            {/* ═══ NAVBAR ═══════════════════════════════════════════════ */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/[.06] backdrop-blur-xl bg-[#050A14]/80">
                <div className="max-w-7xl mx-auto h-16 px-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-white" strokeWidth={1.8} />
                        <span className="font-sans text-sm font-bold tracking-[0.3em] uppercase">Vanguard</span>
                    </div>
                    <div className="hidden md:flex items-center gap-10 text-[11px] font-mono tracking-[0.2em] text-gray-400">
                        <a href="#about" className="hover:text-white transition-colors">ABOUT</a>
                        <a href="#parks" className="hover:text-white transition-colors">PARKS</a>
                        <a href="#impact" className="hover:text-white transition-colors">IMPACT</a>
                        <a href="#tiers" className="hover:text-white transition-colors">DEPLOYMENT</a>
                        <a href="#contact" className="hover:text-white transition-colors">CONTACT</a>
                    </div>
                    <button
                        onClick={() => navigate('/auth')}
                        className="h-9 px-5 text-[11px] font-mono tracking-[0.15em] bg-white text-black rounded hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                        GET STARTED
                    </button>
                </div>
            </nav>

            {/* ═══ HERO ═══════════════════════════════════════════════ */}
            <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden">
                <Particles />
                <GridBg />

                {/* Radial glow behind title */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-gradient-radial from-purple-900/20 via-transparent to-transparent blur-3xl pointer-events-none" />

                <div style={{ opacity: heroOpacity, transform: `translateY(${scrollY * 0.15}px)` }} className="relative z-10 flex flex-col items-center">
                    {/* Overline */}
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-px bg-vanguard-species" />
                        <span className="text-[10px] font-mono tracking-[0.4em] text-vanguard-species uppercase">Wildlife Protection Reimagined</span>
                        <div className="w-8 h-px bg-vanguard-species" />
                    </div>

                    {/* Title */}
                    <h1 className="text-6xl md:text-8xl lg:text-9xl font-sans font-black tracking-tight uppercase leading-[0.9] mb-6">
                        <span className="block">VANGUARD</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="max-w-2xl text-lg md:text-xl text-gray-400 font-sans leading-relaxed mb-10">
                        AI-powered real-time threat detection for endangered species.
                        <br className="hidden md:block" />
                        Command the front lines of conservation.
                    </p>

                    {/* CTA buttons */}
                    <div className="flex flex-wrap gap-4 items-center justify-center">
                        <button
                            onClick={() => navigate('/auth')}
                            className="group h-12 px-8 text-sm font-mono tracking-[0.15em] bg-white text-black rounded hover:bg-gray-200 transition-all flex items-center gap-3 cursor-pointer"
                        >
                            GET STARTED
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <a
                            href="#about"
                            className="h-12 px-8 text-sm font-mono tracking-[0.15em] border border-white/20 rounded hover:border-white/40 transition-colors flex items-center gap-2 text-gray-300 hover:text-white"
                        >
                            LEARN MORE
                        </a>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-10" style={{ opacity: heroOpacity }}>
                    <span className="text-[9px] font-mono tracking-[0.3em] text-gray-600">SCROLL</span>
                    <ChevronDown className="w-4 h-4 text-gray-600 animate-bounce" />
                </div>
            </section>

            {/* ═══ CRISIS CONTEXT ════════════════════════════════════ */}
            <section ref={crisisSection.ref} className="relative py-32 px-6">
                <div className="max-w-5xl mx-auto text-center">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="w-10 h-px bg-vanguard-critical/50" />
                        <span className="text-[10px] font-mono tracking-[0.4em] text-vanguard-critical/80 uppercase">Conservation Crisis</span>
                        <div className="w-10 h-px bg-vanguard-critical/50" />
                    </div>
                    <h2 className={`text-4xl md:text-5xl font-sans font-bold mb-6 transition-all duration-1000 ${crisisSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        The Silent War in Our<br />
                        <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">Last Wild Spaces</span>
                    </h2>
                    <p className={`text-gray-400 max-w-xl mx-auto mb-16 leading-relaxed transition-all duration-1000 delay-200 ${crisisSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        Every year, thousands of endangered animals are killed by sophisticated poaching networks.
                        Traditional patrols can't cover the vast, remote territories that need protection.
                    </p>

                    <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 transition-all duration-1000 delay-400 ${crisisSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        {[
                            { val: '38,000+', label: 'Elephants poached annually', color: 'text-red-400' },
                            { val: '<3,900', label: 'Wild tigers remaining', color: 'text-orange-400' },
                            { val: '$23B', label: 'Illegal wildlife trade per year', color: 'text-yellow-400' },
                        ].map((s, i) => (
                            <div key={i} className="bg-white/[.03] border border-white/[.06] rounded-lg p-8">
                                <div className={`text-3xl md:text-4xl font-mono font-bold mb-2 ${s.color}`}>{s.val}</div>
                                <div className="text-xs font-mono text-gray-500 tracking-wider uppercase">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ ABOUT VANGUARD ═══════════════════════════════════ */}
            <section id="about" ref={aboutSection.ref} className="relative py-32 px-6 bg-gradient-to-b from-transparent via-purple-900/[.04] to-transparent">
                <GridBg />
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-px bg-vanguard-species" />
                        <span className="text-[10px] font-mono tracking-[0.4em] text-vanguard-species uppercase">About Vanguard</span>
                    </div>
                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center transition-all duration-1000 ${aboutSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div>
                            <h2 className="text-4xl md:text-5xl font-sans font-bold mb-6 leading-tight">
                                Protecting Wildlife Through
                                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"> Advanced AI</span>
                            </h2>
                            <p className="text-gray-400 leading-relaxed mb-8">
                                Vanguard is an autonomous shield that monitors critical habitats at the millisecond scale — bridging the gap between passive observation and active tactical intervention. Our AI processes acoustic, visual, and thermal data streams in real-time to detect, verify, and neutralize threats before damage is done.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[
                                    { icon: Zap, title: 'Real-Time', desc: 'Sub-second threat detection and response' },
                                    { icon: Globe, title: '31 Countries', desc: 'Global coverage across 6 continents' },
                                    { icon: Users, title: '147 Units', desc: 'Direct ranger force integration' },
                                ].map((f, i) => (
                                    <div key={i} className="bg-white/[.03] border border-white/[.06] rounded-lg p-4">
                                        <f.icon className="w-5 h-5 text-vanguard-species mb-2" />
                                        <div className="text-sm font-bold mb-1">{f.title}</div>
                                        <div className="text-[11px] text-gray-500">{f.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Mock dashboard preview */}
                        <div className="relative rounded-xl border border-white/[.08] bg-white/[.02] overflow-hidden aspect-video">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-emerald-900/10" />
                            <div className="absolute top-4 left-4 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] font-mono tracking-widest text-emerald-500/80">LIVE MONITORING</span>
                            </div>
                            {/* Simulated globe/map */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="relative">
                                    <Globe className="w-32 h-32 text-white/[.06]" strokeWidth={0.5} />
                                    {/* Dots on globe */}
                                    {[
                                        { top: '20%', left: '55%', color: '#DC2626' },
                                        { top: '40%', left: '45%', color: '#10B981' },
                                        { top: '60%', left: '60%', color: '#F59E0B' },
                                        { top: '35%', left: '70%', color: '#8B5CF6' },
                                    ].map((dot, i) => (
                                        <div key={i} className="absolute" style={{ top: dot.top, left: dot.left }}>
                                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: dot.color, boxShadow: `0 0 8px ${dot.color}` }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Mock alert feed overlay */}
                            <div className="absolute bottom-4 right-4 w-48 space-y-2">
                                {['CRITICAL', 'WARNING', 'INFO'].map((lvl, i) => (
                                    <div key={i} className="bg-black/60 backdrop-blur border border-white/10 rounded px-3 py-2 flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${lvl === 'CRITICAL' ? 'bg-red-500' : lvl === 'WARNING' ? 'bg-yellow-500' : 'bg-emerald-500'}`} />
                                        <span className="text-[9px] font-mono text-gray-400 tracking-wider">{lvl}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ METHODOLOGY ═══════════════════════════════════════ */}
            <section ref={methodSection.ref} className="relative py-32 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-px bg-white/30" />
                        <span className="text-[10px] font-mono tracking-[0.4em] text-gray-400 uppercase">Methodology</span>
                    </div>
                    <h2 className={`text-4xl md:text-5xl font-sans font-bold mb-16 transition-all duration-1000 ${methodSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        How <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Vanguard</span> Works
                    </h2>
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 transition-all duration-1000 delay-300 ${methodSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                        {METHODOLOGY.map((m, i) => (
                            <div key={i} className="group relative bg-white/[.02] border border-white/[.06] rounded-xl p-6 hover:border-white/[.12] hover:bg-white/[.04] transition-all duration-300">
                                <div className="text-[10px] font-mono text-vanguard-species/60 tracking-[0.3em] mb-4">STEP {m.step}</div>
                                <m.icon className="w-8 h-8 text-white/20 mb-4 group-hover:text-vanguard-species/50 transition-colors" />
                                <h3 className="text-sm font-bold tracking-[0.15em] mb-3">{m.title}</h3>
                                <p className="text-xs text-gray-500 leading-relaxed">{m.desc}</p>
                                {/* Connector line */}
                                {i < 3 && <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px bg-white/10" />}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ IMPACT STATS ══════════════════════════════════════ */}
            <section id="impact" ref={statsSection.ref} className="relative py-28 px-6 bg-gradient-to-b from-transparent via-emerald-900/[.04] to-transparent border-y border-white/[.04]">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <div className="flex items-center justify-center gap-3 mb-6">
                            <div className="w-10 h-px bg-vanguard-species/50" />
                            <span className="text-[10px] font-mono tracking-[0.4em] text-vanguard-species/80 uppercase">Our Impact</span>
                            <div className="w-10 h-px bg-vanguard-species/50" />
                        </div>
                        <h2 className="text-4xl md:text-5xl font-sans font-bold">
                            Measurable <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Conservation Results</span>
                        </h2>
                    </div>
                    <div className="flex flex-wrap justify-center gap-8 lg:gap-0 lg:divide-x lg:divide-white/10">
                        <StatCard value={2400000} suffix="" label="Hectares Monitored" active={statsSection.visible} />
                        <StatCard value={147} label="Ranger Units" active={statsSection.visible} />
                        <StatCard value={97} suffix="%" label="Detection Accuracy" active={statsSection.visible} />
                        <StatCard value={800} suffix="ms" label="Avg Alert Time" active={statsSection.visible} />
                        <StatCard value={31} label="Countries" active={statsSection.visible} />
                    </div>
                </div>
            </section>

            {/* ═══ MONITORED PARKS ═══════════════════════════════════ */}
            <section id="parks" ref={parksSection.ref} className="relative py-32 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-px bg-vanguard-species" />
                        <span className="text-[10px] font-mono tracking-[0.4em] text-vanguard-species uppercase">Monitored Parks</span>
                    </div>
                    <h2 className={`text-4xl md:text-5xl font-sans font-bold mb-16 transition-all duration-1000 ${parksSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        Protected Zones Under
                        <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Vanguard Watch</span>
                    </h2>
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 transition-all duration-1000 delay-200 ${parksSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                        {MONITORED_PARKS.map((park, i) => (
                            <div key={i} className="group relative bg-white/[.02] border border-white/[.06] rounded-xl p-6 hover:border-white/[.12] hover:bg-white/[.04] transition-all duration-300 overflow-hidden">
                                {/* Accent glow */}
                                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-500" style={{ backgroundColor: park.accent }} />

                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <span className="text-lg mr-2">{park.flag}</span>
                                        <span className="text-[10px] font-mono text-gray-500 tracking-wider">{park.country.toUpperCase()}</span>
                                    </div>
                                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: park.accent, boxShadow: `0 0 6px ${park.accent}` }} />
                                </div>
                                <h3 className="text-base font-bold mb-1">{park.name}</h3>
                                <p className="text-xs text-gray-500 mb-4">{park.species}</p>
                                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/[.06]">
                                    <div>
                                        <div className="text-[9px] font-mono text-gray-600 tracking-wider">AREA</div>
                                        <div className="text-xs font-mono" style={{ color: park.accent }}>{park.area}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-mono text-gray-600 tracking-wider">RANGERS</div>
                                        <div className="text-xs font-mono text-white/80">{park.rangers}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-mono text-gray-600 tracking-wider">STATUS</div>
                                        <div className="text-xs font-mono text-emerald-500">ACTIVE</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ DEPLOYMENT TIERS ══════════════════════════════════ */}
            <section id="tiers" ref={tiersSection.ref} className="relative py-32 px-6 bg-gradient-to-b from-transparent via-purple-900/[.04] to-transparent">
                <GridBg />
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <div className="flex items-center justify-center gap-3 mb-6">
                            <div className="w-10 h-px bg-white/20" />
                            <span className="text-[10px] font-mono tracking-[0.4em] text-gray-400 uppercase">Strategic Deployment</span>
                            <div className="w-10 h-px bg-white/20" />
                        </div>
                        <h2 className={`text-4xl md:text-5xl font-sans font-bold transition-all duration-1000 ${tiersSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                            Two Tiers.<br />
                            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">One Mission.</span>
                        </h2>
                    </div>

                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 transition-all duration-1000 delay-300 ${tiersSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                        {/* Government Tier */}
                        <div className="group relative bg-white/[.02] border border-white/[.06] rounded-2xl p-8 hover:border-emerald-500/20 transition-all duration-500 overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-emerald-500/50 via-transparent to-transparent" />
                            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-emerald-500/[.04] blur-3xl" />

                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold">National Park Edition</div>
                                    <div className="text-[10px] font-mono text-emerald-500/80 tracking-wider">GOVERNMENT LEVEL</div>
                                </div>
                            </div>

                            <p className="text-sm text-gray-400 leading-relaxed mb-6">
                                Scale and security for continental-level protection. Direct uplink to national military and law enforcement command centers with sovereign data handling.
                            </p>

                            <div className="space-y-3">
                                {[
                                    'Multi-park jurisdiction management',
                                    'Ranger force GPS integration',
                                    'AI noise filtration & thermal vectoring',
                                    'Cross-border satellite handoff',
                                    'Government-grade encryption',
                                    'Sovereign data residency compliance',
                                ].map((f, i) => (
                                    <div key={i} className="flex items-center gap-3 text-xs text-gray-300">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                        {f}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Private Tier */}
                        <div className="group relative bg-white/[.02] border border-white/[.06] rounded-2xl p-8 hover:border-purple-500/20 transition-all duration-500 overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-purple-500/50 via-transparent to-transparent" />
                            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-purple-500/[.04] blur-3xl" />

                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                    <Lock className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold">Private Estate Edition</div>
                                    <div className="text-[10px] font-mono text-purple-500/80 tracking-wider">HIGH-PRIORITY ASSETS</div>
                                </div>
                            </div>

                            <p className="text-sm text-gray-400 leading-relaxed mb-6">
                                Tailored monitoring for private reserves. Absolute discretion, zero-latency alerts, and bespoke security parameters for unique estate boundaries.
                            </p>

                            <div className="space-y-3">
                                {[
                                    'Custom estate boundary mapping',
                                    'Species & asset inventory tracking',
                                    'Environmental intelligence feeds',
                                    'Bespoke alert thresholds',
                                    'Private reporting & PDF generation',
                                    'Zero-latency encrypted communications',
                                ].map((f, i) => (
                                    <div key={i} className="flex items-center gap-3 text-xs text-gray-300">
                                        <div className="w-1 h-1 rounded-full bg-purple-500" />
                                        {f}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ CTA ═══════════════════════════════════════════════ */}
            <section id="contact" ref={ctaSection.ref} className="relative py-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <div className={`transition-all duration-1000 ${ctaSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <p className="text-lg text-gray-500 font-sans italic mb-8">
                            "The future of conservation is prevention, not reaction."
                        </p>
                        <h2 className="text-5xl md:text-7xl font-sans font-black tracking-tight uppercase leading-[0.95] mb-10">
                            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">Stand With</span>
                            <br />Vanguard
                        </h2>

                        <div className="flex flex-wrap gap-4 items-center justify-center mb-16">
                            <button
                                onClick={() => navigate('/auth')}
                                className="group h-14 px-10 text-sm font-mono tracking-[0.15em] bg-white text-black rounded-lg hover:bg-gray-200 transition-all flex items-center gap-3 cursor-pointer"
                            >
                                BECOME A PARTNER
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>

                        {/* Contact card */}
                        <div className="inline-block bg-white/[.03] border border-white/[.06] rounded-xl px-8 py-6">
                            <div className="text-[10px] font-mono tracking-[0.3em] text-vanguard-species/80 uppercase mb-3">Contact Vanguard</div>
                            <p className="text-xs text-gray-400 mb-3">Reach out for partnerships, deployments, or inquiries</p>
                            <a href="mailto:contact@vanguard.ai" className="inline-flex items-center gap-2 text-sm text-vanguard-species hover:text-emerald-300 transition-colors">
                                <Mail className="w-4 h-4" />
                                contact@vanguard.ai
                            </a>
                            <div className="text-[10px] text-gray-600 mt-2 font-mono">Response time: Within 24 hours</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ FOOTER ════════════════════════════════════════════ */}
            <footer className="border-t border-white/[.06] py-8 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-white/30" />
                        <span className="text-xs text-gray-600 font-mono">© 2026 VANGUARD. All rights reserved.</span>
                    </div>
                    <div className="flex items-center gap-6">
                        {[
                            { icon: Github, label: 'GitHub' },
                            { icon: FileText, label: 'Docs' },
                            { icon: Mail, label: 'Email' },
                        ].map((s, i) => (
                            <s.icon key={i} className="w-4 h-4 text-gray-600 hover:text-white cursor-pointer transition-colors" />
                        ))}
                    </div>
                    <div className="flex items-center gap-6 text-[10px] font-mono text-gray-600 tracking-wider">
                        <span className="hover:text-white cursor-pointer transition-colors">PRIVACY</span>
                        <span className="hover:text-white cursor-pointer transition-colors">TERMS</span>
                        <span className="hover:text-white cursor-pointer transition-colors">CONTACT</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default MarketingPage;
