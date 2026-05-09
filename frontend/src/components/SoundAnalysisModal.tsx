import React, { useEffect, useMemo, useState } from 'react';
import { X, Activity, Play, Pause, AlertTriangle, Volume2, MapPin, Clock } from 'lucide-react';
import { PARKS } from '../lib/parksData';

interface SoundAnalysisModalProps {
    onClose: () => void;
    parkId: string;
}

type ThreatLevel = 'THREAT' | 'WILDLIFE' | 'AMBIENT';

interface SampleClip {
    id: string;
    name: string;
    duration: string;
    type: 'GUNSHOT' | 'CHAINSAW' | 'VEHICLE' | 'TIGER_CALL' | 'ELEPHANT_CALL' | 'AMBIENT';
}

interface AudioEvent {
    id: string;
    parkId: string;
    zone: string;
    timestamp: string;
    classification: string;
    threatLevel: ThreatLevel;
    confidence: number;
    sourceType: 'ACOUSTIC_SENSOR' | 'COMMUNITY';
}

interface AnalysisResult {
    label: string;
    confidence: number;
    threatLevel: ThreatLevel;
    recommendedAction: string;
}

const SAMPLES: SampleClip[] = [
    { id: 'forest-gunshot', name: 'Forest Gunshot', duration: '0:07', type: 'GUNSHOT' },
    { id: 'chainsaw', name: 'Chainsaw', duration: '0:12', type: 'CHAINSAW' },
    { id: 'vehicle-engine', name: 'Vehicle Engine', duration: '0:09', type: 'VEHICLE' },
    { id: 'tiger-call', name: 'Tiger Call', duration: '0:11', type: 'TIGER_CALL' },
    { id: 'elephant-call', name: 'Elephant Call', duration: '0:08', type: 'ELEPHANT_CALL' },
    { id: 'ambient-forest', name: 'Ambient Forest', duration: '0:20', type: 'AMBIENT' }
];

const threatColors: Record<ThreatLevel, string> = {
    THREAT: 'bg-red-500/10 border-red-500/40 text-red-400',
    WILDLIFE: 'bg-amber-500/10 border-amber-500/40 text-amber-300',
    AMBIENT: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
};

const threatLabelText: Record<ThreatLevel, string> = {
    THREAT: 'THREAT DETECTED',
    WILDLIFE: 'WILDLIFE',
    AMBIENT: 'AMBIENT'
};

const SoundAnalysisModal: React.FC<SoundAnalysisModalProps> = ({ onClose, parkId }) => {
    const park = useMemo(() => PARKS.find(p => p.id === parkId), [parkId]);
    const [selectedSample, setSelectedSample] = useState<SampleClip | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [customAudioName, setCustomAudioName] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [events, setEvents] = useState<AudioEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);

    useEffect(() => {
        if (!parkId) return;
        setLoadingEvents(true);
        fetch(`/api/audio/${parkId}`)
            .then(r => r.json())
            .then(data => setEvents(data || []))
            .catch(() => setEvents([]))
            .finally(() => setLoadingEvents(false));
    }, [parkId]);

    const handleSelectSample = (sample: SampleClip) => {
        setSelectedSample(sample);
        setCustomAudioName(null);
        setAnalysisResult(null);
        setIsPlaying(true);
        // In mock mode, we just toggle a playing state and animate waveform
    };

    const handleUploadAudio = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = () => {
            const file = input.files?.[0];
            if (file) {
                setSelectedSample(null);
                setCustomAudioName(file.name);
                setAnalysisResult(null);
                setIsPlaying(true);
            }
        };
        input.click();
    };

    const canAnalyze = !!selectedSample || !!customAudioName;

    const deriveAnalysisForSample = (sample: SampleClip): AnalysisResult => {
        switch (sample.type) {
            case 'GUNSHOT':
                return {
                    label: 'Gunshot (High Confidence)',
                    confidence: 0.96,
                    threatLevel: 'THREAT',
                    recommendedAction:
                        'Treat as confirmed gunshot. Dispatch nearest ranger unit and cross-check camera traps in adjacent zones.'
                };
            case 'CHAINSAW':
                return {
                    label: 'Chainsaw Detected',
                    confidence: 0.93,
                    threatLevel: 'THREAT',
                    recommendedAction:
                        'Possible illegal logging activity. Notify forestry staff and deploy patrol to triangulated coordinates.'
                };
            case 'VEHICLE':
                return {
                    label: 'Vehicle Engine',
                    confidence: 0.88,
                    threatLevel: 'THREAT',
                    recommendedAction:
                        'Unscheduled vehicle activity. Check authorized vehicle list and coordinate with gate staff.'
                };
            case 'TIGER_CALL':
                return {
                    label: 'Tiger Vocalization',
                    confidence: 0.91,
                    threatLevel: 'WILDLIFE',
                    recommendedAction:
                        'Predator vocalization detected. Log for behavior monitoring and avoid routing tourists into this sector.'
                };
            case 'ELEPHANT_CALL':
                return {
                    label: 'Elephant Call',
                    confidence: 0.89,
                    threatLevel: 'WILDLIFE',
                    recommendedAction:
                        'Elephant herd presence likely. Caution heavy vehicles and maintain buffer from crop-field interfaces.'
                };
            case 'AMBIENT':
            default:
                return {
                    label: 'Ambient Forest Soundscape',
                    confidence: 0.82,
                    threatLevel: 'AMBIENT',
                    recommendedAction:
                        'No immediate threat detected. Use as calibration sample for sensor health checks.'
                };
        }
    };

    const deriveAnalysisForCustom = (name: string): AnalysisResult => {
        const lower = name.toLowerCase();
        if (lower.includes('shot') || lower.includes('gun')) {
            return {
                label: 'Likely Gunshot',
                confidence: 0.9,
                threatLevel: 'THREAT',
                recommendedAction:
                    'Treat as potential gunshot. Cross-validate with nearby acoustic nodes and alert patrol units.'
            };
        }
        if (lower.includes('saw') || lower.includes('chain')) {
            return {
                label: 'Likely Chainsaw',
                confidence: 0.88,
                threatLevel: 'THREAT',
                recommendedAction:
                    'Chainsaw-like spectral pattern detected. Notify enforcement team and log as possible illegal logging.'
            };
        }
        if (lower.includes('vehicle') || lower.includes('truck') || lower.includes('jeep')) {
            return {
                label: 'Vehicle / Engine Noise',
                confidence: 0.84,
                threatLevel: 'THREAT',
                recommendedAction:
                    'Engine-like harmonics detected away from designated roads. Verify against authorized patrol routes.'
            };
        }
        if (lower.includes('elephant') || lower.includes('trumpet')) {
            return {
                label: 'Elephant Vocalization',
                confidence: 0.86,
                threatLevel: 'WILDLIFE',
                recommendedAction:
                    'Elephant distress/communication call signature. Notify human-wildlife conflict response cell if near villages.'
            };
        }
        if (lower.includes('tiger') || lower.includes('roar')) {
            return {
                label: 'Big Cat Vocalization',
                confidence: 0.87,
                threatLevel: 'WILDLIFE',
                recommendedAction:
                    'Large carnivore vocal pattern. Flag for research team and avoid routing night patrols directly through this zone.'
            };
        }
        return {
            label: 'Unstructured Ambient / Unknown',
            confidence: 0.7,
            threatLevel: 'AMBIENT',
            recommendedAction:
                'No strong threat signature. If rangers reported concern, schedule manual review of waveform and spectrogram.'
        };
    };

    const [analysisSource, setAnalysisSource] = useState<'live' | 'demo' | null>(null);

    const handleAnalyze = async () => {
        if (!canAnalyze) return;
        setAnalyzing(true);
        setAnalysisSource(null);
        try {
            const payload: { sampleType?: string; customLabel?: string } = {};
            if (selectedSample) payload.sampleType = selectedSample.type;
            if (customAudioName) payload.customLabel = `Custom: ${customAudioName}`;
            const res = await fetch('/api/analyze/audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const data = await res.json();
                setAnalysisResult({
                    label: data.label,
                    confidence: data.confidence,
                    threatLevel: data.threatLevel,
                    recommendedAction: data.recommendedAction
                });
                setAnalysisSource(data.source === 'openrouter' ? 'live' : 'demo');
                setAnalyzing(false);
                return;
            }
        } catch {
            // fall through to local
        }
        if (selectedSample) {
            setAnalysisResult(deriveAnalysisForSample(selectedSample));
        } else if (customAudioName) {
            setAnalysisResult(deriveAnalysisForCustom(customAudioName));
        }
        setAnalysisSource('demo');
        setAnalyzing(false);
    };

    const threatPillClass =
        analysisResult && threatColors[analysisResult.threatLevel]
            ? threatColors[analysisResult.threatLevel]
            : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-vanguard-bg border border-vanguard-border rounded-lg shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-3 border-b border-vanguard-border bg-black/80">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-vanguard-community" />
                        <div className="flex flex-col">
                            <h2 className="font-syne font-bold tracking-widest text-xs text-white uppercase">
                                ACOUSTIC INTELLIGENCE
                            </h2>
                            <span className="text-[10px] font-mono text-gray-500">
                                Real-time sound classification and 24h acoustic log for{' '}
                                {park ? park.name : 'Active Park'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors rounded-full p-1"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-y-auto custom-scrollbar bg-[#0A0F1A]">
                    {/* Left: Waveform + sample library */}
                    <div className="flex flex-col gap-3 lg:col-span-1">
                        {/* Waveform visualizer */}
                        <div className="bg-vanguard-panel border border-vanguard-border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-vanguard-community" />
                                    <span className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">
                                        LIVE WAVEFORM
                                    </span>
                                </div>
                                {isPlaying && (
                                    <span className="text-[10px] font-mono text-vanguard-community flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-vanguard-community animate-pulse" />
                                        PLAYING
                                    </span>
                                )}
                            </div>
                            <div className="relative h-24 bg-black/80 border border-vanguard-border/60 rounded overflow-hidden flex items-center justify-center">
                                <div className="absolute inset-0 opacity-40">
                                    <div className="absolute left-0 right-0 top-1/2 h-px bg-vanguard-border/40" />
                                </div>
                                <div className="flex gap-1 w-full h-16 px-3 items-center justify-center">
                                    {Array.from({ length: 40 }).map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`w-0.5 bg-vanguard-community/70 rounded-full origin-bottom ${
                                                isPlaying ? 'animate-[pulse_1.2s_ease-in-out_infinite]' : ''
                                            }`}
                                            style={{
                                                height: `${20 + ((idx * 7) % 60)}%`,
                                                animationDelay: `${(idx * 20) % 600}ms`
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-gray-500">
                                <span>
                                    {selectedSample
                                        ? selectedSample.name
                                        : customAudioName || 'No sample selected'}
                                </span>
                                <button
                                    className="flex items-center gap-1 text-gray-400 hover:text-white"
                                    onClick={() => setIsPlaying(p => !p)}
                                >
                                    {isPlaying ? (
                                        <>
                                            <Pause className="w-3 h-3" /> PAUSE
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-3 h-3" /> PREVIEW
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Sample library */}
                        <div className="bg-vanguard-panel border border-vanguard-border rounded-lg p-3 flex-1">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Volume2 className="w-4 h-4 text-vanguard-community" />
                                    <span className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">
                                        SAMPLE LIBRARY
                                    </span>
                                </div>
                                <button
                                    onClick={handleUploadAudio}
                                    className="text-[10px] font-mono px-2 py-1 border border-vanguard-border rounded bg-black/60 hover:bg-black text-gray-300"
                                >
                                    UPLOAD AUDIO
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {SAMPLES.map(sample => {
                                    const isSelected = selectedSample?.id === sample.id;
                                    return (
                                        <button
                                            key={sample.id}
                                            type="button"
                                            onClick={() => handleSelectSample(sample)}
                                            className={`flex items-center justify-between px-2.5 py-2 rounded border text-left transition-colors ${
                                                isSelected
                                                    ? 'border-vanguard-community bg-vanguard-community/15'
                                                    : 'border-vanguard-border bg-black/60 hover:bg-black'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full border border-vanguard-border flex items-center justify-center bg-black/60">
                                                    <Play className="w-3 h-3 text-vanguard-community" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-syne text-white">
                                                        {sample.name}
                                                    </span>
                                                    <span className="text-[9px] font-mono text-gray-500">
                                                        {sample.duration} •{' '}
                                                        {sample.type === 'AMBIENT'
                                                            ? 'Ambient'
                                                            : sample.type.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-mono text-gray-500">
                                                {isSelected ? 'SELECTED' : 'PLAY'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Middle: Analysis controls + result */}
                    <div className="flex flex-col gap-3 lg:col-span-1">
                        <div className="bg-vanguard-panel border border-vanguard-border rounded-lg p-3 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">
                                    ACOUSTIC CLASSIFICATION
                                </span>
                            </div>
                            <button
                                onClick={handleAnalyze}
                                disabled={!canAnalyze || analyzing}
                                className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-mono rounded border ${
                                    canAnalyze
                                        ? 'border-vanguard-community/60 bg-vanguard-community/20 text-vanguard-community hover:bg-vanguard-community/30'
                                        : 'border-vanguard-border text-gray-600 bg-black/40 cursor-not-allowed'
                                }`}
                            >
                                {analyzing ? 'ANALYZING WAVEFORM…' : 'ANALYZE AUDIO'}
                            </button>

                            {analysisResult && (
                                <div className="mt-1 border border-vanguard-border rounded-lg bg-black/70 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-syne text-white">
                                                {analysisResult.label}
                                            </span>
                                            <span className="text-[10px] font-mono text-gray-500">
                                                Confidence{' '}
                                                <span className="text-vanguard-community">
                                                    {(analysisResult.confidence * 100).toFixed(1)}%
                                                </span>
                                            </span>
                                        </div>
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${threatPillClass}`}
                                        >
                                            {threatLabelText[analysisResult.threatLevel]}
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-vanguard-border rounded overflow-hidden">
                                        <div
                                            className={`h-full ${
                                                analysisResult.threatLevel === 'THREAT'
                                                    ? 'bg-red-500'
                                                    : analysisResult.threatLevel === 'WILDLIFE'
                                                    ? 'bg-amber-400'
                                                    : 'bg-emerald-400'
                                            } transition-all duration-500`}
                                            style={{
                                                width: `${Math.min(
                                                    100,
                                                    analysisResult.confidence * 100 + 5
                                                )}%`
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-start gap-2 text-[10px] font-mono text-gray-300">
                                        <AlertTriangle className="w-3 h-3 mt-0.5 text-amber-400 shrink-0" />
                                        <span>{analysisResult.recommendedAction}</span>
                                    </div>
                                    <div className="text-[9px] font-mono text-gray-500 mt-1">
                                        {analysisSource === 'live'
                                            ? 'Recommendation generated by Open Router (live AI).'
                                            : 'Classification is deterministic for demo. Set OPENROUTER_API_KEY for AI-generated recommendations.'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: 24h acoustic log */}
                    <div className="flex flex-col gap-3 lg:col-span-1">
                        <div className="bg-vanguard-panel border border-vanguard-border rounded-lg p-3 flex-1 min-h-0">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-vanguard-community" />
                                    <span className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">
                                        24h ACOUSTIC EVENTS
                                    </span>
                                </div>
                                {loadingEvents && (
                                    <span className="text-[10px] font-mono text-gray-500">STREAMING…</span>
                                )}
                            </div>
                            <div className="h-[260px] overflow-y-auto custom-scrollbar divide-y divide-vanguard-border/60">
                                {!loadingEvents && events.length === 0 && (
                                    <div className="p-3 text-[10px] font-mono text-gray-500">
                                        No acoustic events logged in the last 24 hours for this park. Vanguard will
                                        populate this view as sensors report in.
                                    </div>
                                )}
                                {events.map(event => {
                                    const level: ThreatLevel = event.threatLevel;
                                    const levelClass = threatColors[level];
                                    return (
                                        <div key={event.id} className="flex flex-col gap-1 p-2.5 hover:bg-black/40">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-syne text-white">
                                                    {event.classification}
                                                </span>
                                                <span
                                                    className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${levelClass}`}
                                                >
                                                    {threatLabelText[level]}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-500">
                                                        {(event.confidence * 100).toFixed(0)}%
                                                    </span>
                                                    <div className="w-16 h-1 bg-vanguard-border rounded overflow-hidden">
                                                        <div
                                                            className={`h-full ${
                                                                level === 'THREAT'
                                                                    ? 'bg-red-500'
                                                                    : level === 'WILDLIFE'
                                                                    ? 'bg-amber-400'
                                                                    : 'bg-emerald-400'
                                                            }`}
                                                            style={{
                                                                width: `${Math.min(
                                                                    100,
                                                                    event.confidence * 100 + 5
                                                                )}%`
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 text-vanguard-community" />
                                                        <span>{event.zone}</span>
                                                    </div>
                                                    <span>{event.timestamp}</span>
                                                </div>
                                            </div>
                                            <div className="text-[9px] font-mono text-gray-600">
                                                {event.sourceType === 'ACOUSTIC_SENSOR'
                                                    ? 'ACOUSTIC SENSOR'
                                                    : 'COMMUNITY REPORT'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SoundAnalysisModal;

