import React, { useState, useEffect, useCallback } from 'react';
import {
    Zap, ShieldAlert, Users, Trash2, Smartphone, MapPin, CheckCircle2,
    Scissors, Truck, Biohazard, Eye, ListX, ChevronDown, ChevronUp,
    Radio, Camera, Brain, Download, Loader2, AlertTriangle,
} from 'lucide-react';
import { PARKS, PARK_UUID_MAP } from './lib/parksData';
import { supabase } from './lib/supabaseClient';

// ── UUID map inverted so we can insert with the Supabase UUID ─────────────────
const SHORT_TO_UUID: Record<string, string> = Object.fromEntries(
    Object.entries(PARK_UUID_MAP).map(([uuid, short]) => [short, uuid])
);

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY_1 || import.meta.env.VITE_GROQ_API_KEY_2 || '';

interface TriggeredAlert {
    parkId: string;
    zone: string;
    type: string;
    subType: string;
    description: string;
    confidence?: number;
}

interface IntelBrief {
    threat_assessment: string;
    recommended_actions: string[];
    risk_window: string;
    classification: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MONITOR';
}

interface LiveAlert {
    id: string;
    parkId: string;
    zone: string;
    type: string;
    subType: string;
    description: string;
    timestamp: string;
    confidence?: number;
}

// ── Groq quick analysis ───────────────────────────────────────────────────────
async function quickIntel(a: TriggeredAlert): Promise<IntelBrief> {
    if (!GROQ_KEY) throw new Error('No key');
    const prompt = `You are VANGUARD, a wildlife protection AI. Generate a very brief tactical intelligence brief for:
Type: ${a.type}/${a.subType}, Zone: ${a.zone}, Confidence: ${a.confidence ? (a.confidence * 100).toFixed(0) : 'N/A'}%
Description: ${a.description}

Respond ONLY with JSON (no markdown):
{"threat_assessment":"2 sentences.","recommended_actions":["Action 1","Action 2","Action 3"],"risk_window":"e.g. Next 4 hours","classification":"CRITICAL|HIGH|ELEVATED|MONITOR"}`;
    const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: prompt }], max_tokens: 350, temperature: 0.4 }),
    });
    if (!res.ok) throw new Error('Groq error');
    const d = await res.json();
    return JSON.parse(d.choices[0].message.content.trim());
}

// ── PDF print helper ──────────────────────────────────────────────────────────
function printPDF(a: TriggeredAlert, b: IntelBrief) {
    const c = { CRITICAL: '#FF4444', HIGH: '#FF6400', ELEVATED: '#FF9500', MONITOR: '#60A5FA' };
    const col = c[b.classification] || '#FF9500';
    const win = window.open('', '_blank', 'width=700,height=860');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>VANGUARD INTEL BRIEF</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;background:#fff;color:#111;padding:36px}
.hdr{border-bottom:3px solid ${col};padding-bottom:16px;margin-bottom:20px}
.badge{display:inline-block;background:${col}22;color:${col};border:1px solid ${col}88;font-size:10px;font-weight:700;letter-spacing:.15em;padding:3px 10px;border-radius:4px}
.t{font-size:20px;font-weight:700;margin:8px 0 3px;letter-spacing:.04em;text-transform:uppercase}
.sub{font-size:10px;color:#888;letter-spacing:.12em;text-transform:uppercase}
.sec{margin-bottom:18px}.sec-lbl{font-size:9px;font-weight:700;letter-spacing:.2em;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;margin-bottom:8px}
.body{font-size:13px;line-height:1.7;color:#222}
.acts{list-style:none}.acts li{padding:5px 0;border-bottom:1px solid #f0f0f0;font-size:13px;padding-left:14px;position:relative}
.acts li::before{content:"▸";position:absolute;left:0;color:${col}}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cell{background:#f9f9f9;border:1px solid #eee;border-radius:4px;padding:10px}
.cell-lbl{font-size:9px;color:#999;letter-spacing:.15em;text-transform:uppercase;margin-bottom:3px}.cell-val{font-size:13px;font-weight:600}
.ftr{margin-top:32px;padding-top:10px;border-top:1px solid #eee;font-size:9px;color:#aaa;display:flex;justify-content:space-between}
@media print{body{padding:24px}}
</style></head><body>
<div class="hdr"><div class="badge">${b.classification} — REMOTE TRIGGERED</div>
<div class="t">Alert Intelligence Brief</div>
<div class="sub">Vanguard Remote Controller · ${a.type} · Zone ${a.zone} · ${new Date().toUTCString()}</div></div>
<div class="sec"><div class="sec-lbl">Threat Assessment</div><div class="body">${b.threat_assessment}</div></div>
<div class="sec"><div class="sec-lbl">Alert Details</div>
<div class="grid">
<div class="cell"><div class="cell-lbl">Type</div><div class="cell-val">${a.type}</div></div>
<div class="cell"><div class="cell-lbl">Sub-Type</div><div class="cell-val">${a.subType.replace(/_/g, ' ')}</div></div>
<div class="cell"><div class="cell-lbl">Zone</div><div class="cell-val">${a.zone}</div></div>
<div class="cell"><div class="cell-lbl">Confidence</div><div class="cell-val">${a.confidence ? (a.confidence * 100).toFixed(0) + '%' : 'N/A'}</div></div>
</div></div>
<div class="sec"><div class="sec-lbl">Description</div><div class="body">${a.description}</div></div>
<div class="sec"><div class="sec-lbl">Recommended Actions</div><ul class="acts">${b.recommended_actions.map(x => `<li>${x}</li>`).join('')}</ul></div>
<div class="sec"><div class="sec-lbl">Risk Window</div><div class="body" style="color:${col};font-weight:600">${b.risk_window}</div></div>
<div class="ftr"><span>VANGUARD INTELLIGENCE PLATFORM — GOVERNMENT USE ONLY</span><span>${new Date().toISOString()}</span></div>
<script>window.print();window.onafterprint=()=>window.close();</script>
</body></html>`);
    win.document.close();
}

const RemoteController: React.FC = () => {
    const [selectedPark, setSelectedPark] = useState(PARKS[0].id);
    const [selectedZone, setSelectedZone] = useState('Z3');
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
    const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
    const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());
    const [selectivePurgeOpen, setSelectivePurgeOpen] = useState(false);
    const [loadingAlerts, setLoadingAlerts] = useState(false);

    // Intelligence brief panel
    const [lastTriggered, setLastTriggered] = useState<TriggeredAlert | null>(null);
    const [intelBrief, setIntelBrief] = useState<IntelBrief | null>(null);
    const [intelLoading, setIntelLoading] = useState(false);
    const [intelError, setIntelError] = useState<string | null>(null);
    const [showIntel, setShowIntel] = useState(false);

    const triggerHaptic = (pattern: number | number[] = 50) => {
        if ('vibrate' in navigator) navigator.vibrate(pattern);
    };

    // ── Core trigger: Supabase insert first, webhook fallback ─────────────────
    const triggerAlert = useCallback(async (payload: TriggeredAlert) => {
        triggerHaptic(60);
        setStatus({ type: null, message: '' });
        setLastTriggered(payload);
        setIntelBrief(null);
        setIntelError(null);
        setShowIntel(false);

        // 1. Try Supabase direct insert (government parks have UUIDs)
        const parkUUID = SHORT_TO_UUID[payload.parkId];
        let supabaseOk = false;

        if (parkUUID) {
            const { error } = await supabase
                .from('alerts')
                .insert([{
                    park_id: parkUUID,
                    zone_id: payload.zone,
                    type: payload.type,
                    sub_type: payload.subType,
                    description: payload.description,
                    priority: payload.confidence && payload.confidence >= 0.9 ? 'CRITICAL' :
                               payload.confidence && payload.confidence >= 0.8 ? 'HIGH' : 'ELEVATED',
                    confidence: payload.confidence ?? 0.8,
                    triggered_by: 'remote_controller',
                }]);
            supabaseOk = !error;
        }

        // 2. Try legacy webhook
        if (!supabaseOk) {
            try {
                const endpoint = payload.type.toLowerCase();
                await fetch(`/api/webhooks/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                supabaseOk = true;
            } catch { /* offline */ }
        }

        // 3. Always show confirmation + open intel panel
        setStatus({ type: 'success', message: `${payload.subType.replace(/_/g,' ')} TRANSMITTED` });
        setShowIntel(true);
        setTimeout(() => setStatus({ type: null, message: '' }), 3000);

        // 4. Auto-generate intel brief
        setIntelLoading(true);
        try {
            const brief = await quickIntel(payload);
            setIntelBrief(brief);
        } catch {
            setIntelError('AI offline — using local assessment');
            setIntelBrief({
                threat_assessment: `A ${payload.type} event (${payload.subType.replace(/_/g,' ')}) has been recorded in Zone ${payload.zone}. ${payload.description}`,
                recommended_actions: ['Dispatch nearest ranger unit.', 'Cross-reference adjacent sensor feeds.', 'Log in Daily Intelligence Report.'],
                risk_window: (payload.confidence ?? 0) >= 0.9 ? 'Immediate — next 2 hours' : 'Next 6–12 hours',
                classification: (payload.confidence ?? 0) >= 0.9 ? 'CRITICAL' : (payload.confidence ?? 0) >= 0.8 ? 'HIGH' : 'ELEVATED',
            });
        } finally {
            setIntelLoading(false);
        }
    }, []);

    const fetchAlerts = async () => {
        setLoadingAlerts(true);
        try {
            const res = await fetch(`/api/alerts?parkId=${selectedPark}`);
            const data = await res.json();
            setLiveAlerts(data.alerts || []);
            setSelectedAlertIds(new Set());
        } catch {
            setLiveAlerts([]);
        } finally {
            setLoadingAlerts(false);
        }
    };

    useEffect(() => {
        if (selectivePurgeOpen) fetchAlerts();
    }, [selectivePurgeOpen, selectedPark]);

    const toggleAlertSelection = (id: string) => {
        setSelectedAlertIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedAlertIds.size === liveAlerts.length) {
            setSelectedAlertIds(new Set());
        } else {
            setSelectedAlertIds(new Set(liveAlerts.map(a => a.id)));
        }
    };

    const purgeSelected = async () => {
        if (selectedAlertIds.size === 0) return;
        triggerHaptic([40, 60, 40]);
        setStatus({ type: null, message: '' });
        try {
            const res = await fetch('/api/webhooks/purge-selected', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedAlertIds), parkId: selectedPark })
            });
            if (res.ok) {
                setStatus({ type: 'success', message: `${selectedAlertIds.size} ALERT(S) PURGED` });
                setTimeout(() => setStatus({ type: null, message: '' }), 2000);
                fetchAlerts();
            } else {
                setStatus({ type: 'error', message: 'PURGE FAILED' });
            }
        } catch {
            setStatus({ type: 'error', message: 'OFFLINE / SERVER ERROR' });
        }
    };

    const getAlertTypeIcon = (type: string) => {
        switch (type) {
            case 'ACOUSTIC':  return <Radio size={12} className="text-red-400" />;
            case 'CAMERA':    return <Camera size={12} className="text-amber-400" />;
            case 'COMMUNITY': return <Users size={12} className="text-blue-400" />;
            default:          return <ShieldAlert size={12} className="text-gray-400" />;
        }
    };

    const getAlertBorderColor = (type: string) => {
        switch (type) {
            case 'ACOUSTIC':  return 'border-red-500/30';
            case 'CAMERA':    return 'border-amber-500/30';
            case 'COMMUNITY': return 'border-blue-500/30';
            default:          return 'border-white/10';
        }
    };

    const park = PARKS.find(p => p.id === selectedPark);
    const zones = park ? Object.keys(park.zones) : ['Z1','Z2','Z3','Z4','Z5','Z6','Z7','Z8'];

    const acousticButtons = [
        { label: 'GUNSHOT',  color: 'red',    icon: <Zap size={22} />,      payload: { parkId: selectedPark, zone: selectedZone, type: 'ACOUSTIC', subType: 'GUNSHOT',        confidence: 0.95, description: 'High-caliber rifle discharge detected in sector.' } },
        { label: 'CHAINSAW', color: 'orange', icon: <Scissors size={22} />, payload: { parkId: selectedPark, zone: selectedZone, type: 'ACOUSTIC', subType: 'CHAINSAW',       confidence: 0.92, description: 'Motorized cutting signature — possible illegal logging.' } },
        { label: 'VEHICLE',  color: 'orange', icon: <Truck size={22} />,    payload: { parkId: selectedPark, zone: selectedZone, type: 'ACOUSTIC', subType: 'VEHICLE_ENGINE', confidence: 0.87, description: 'Unscheduled vehicle engine detected in restricted zone.' } },
    ];

    const visionButtons = [
        { label: 'HUMAN',   color: 'amber', icon: <ShieldAlert size={22} />, payload: { parkId: selectedPark, zone: selectedZone, type: 'CAMERA', subType: 'HUMAN_PRESENCE',     confidence: 0.88, description: 'Unauthorized individual detected by camera trap.' } },
        { label: 'VEHICLE', color: 'amber', icon: <MapPin size={22} />,      payload: { parkId: selectedPark, zone: selectedZone, type: 'CAMERA', subType: 'VEHICLE_DETECTED',   confidence: 0.85, description: 'Suspicious motor vehicle detected on camera.' } },
        { label: 'ANOMALY', color: 'amber', icon: <Eye size={22} />,         payload: { parkId: selectedPark, zone: selectedZone, type: 'CAMERA', subType: 'BEHAVIORAL_ANOMALY', confidence: 0.82, description: 'Unusual animal behavioral pattern — possible stress or injury.' } },
    ];

    const communityButtons = [
        { label: 'SNARE LINE',  color: 'teal', icon: <Users size={22} />,        payload: { parkId: selectedPark, zone: selectedZone, type: 'COMMUNITY', subType: 'SNARE_DETECTED', confidence: 0.78, description: 'Active wire snare line reported by community member.' } },
        { label: 'CAMP FOUND',  color: 'teal', icon: <CheckCircle2 size={22} />, payload: { parkId: selectedPark, zone: selectedZone, type: 'COMMUNITY', subType: 'POACHER_CAMP',  confidence: 0.80, description: 'Evidence of recent illegal encampment discovered.' } },
        { label: 'DEAD ANIMAL', color: 'teal', icon: <Biohazard size={22} />,    payload: { parkId: selectedPark, zone: selectedZone, type: 'COMMUNITY', subType: 'DEAD_ANIMAL',   confidence: 0.72, description: 'Dead wildlife reported — possible poaching or disease.' } },
    ];

    const colorMap: Record<string, { border: string, bg: string, text: string }> = {
        red:    { border: 'border-red-500/30',    bg: 'bg-red-500/10',    text: 'text-red-500' },
        orange: { border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-500' },
        amber:  { border: 'border-amber-500/30',  bg: 'bg-amber-500/10',  text: 'text-amber-500' },
        teal:   { border: 'border-teal-400/30',   bg: 'bg-teal-400/10',   text: 'text-teal-400' },
    };

    const intelClColors: Record<string, string> = {
        CRITICAL: '#FF4444', HIGH: '#FF6400', ELEVATED: '#FF9500', MONITOR: '#60A5FA',
    };

    const renderButton = (btn: any) => {
        const c = colorMap[btn.color];
        return (
            <button
                key={btn.label}
                onClick={() => triggerAlert(btn.payload)}
                className={`p-4 bg-[#0A0F1A] border ${c.border} rounded-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform group`}
            >
                <div className={`p-2.5 ${c.bg} rounded-full ${c.text} transition-colors`}>{btn.icon}</div>
                <span className={`text-[9px] font-mono font-bold tracking-widest ${c.text}`}>{btn.label}</span>
            </button>
        );
    };

    return (
        <div className="min-h-screen bg-[#05080F] text-gray-200 font-sans p-4 flex flex-col select-none overflow-x-hidden">

            {/* Header */}
            <div className="flex items-center justify-between mb-5 pt-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded bg-vanguard-primary/20 border border-vanguard-primary/40">
                        <Smartphone className="text-vanguard-primary w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-syne font-bold tracking-tighter text-white">VANGUARD REMOTE</h1>
                        <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Mission Control Interface</p>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full border transition-all duration-300 flex items-center gap-1.5 ${
                    status.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                    status.type === 'error'   ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                                               'bg-white/5 border-white/10 text-gray-500'
                }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${status.type === 'success' ? 'bg-green-500 animate-pulse' : 'bg-current opacity-30'}`} />
                    <span className="text-[9px] font-mono font-bold tracking-widest leading-none">
                        {status.message || 'SYSTEM READY'}
                    </span>
                </div>
            </div>

            {/* Park Selector */}
            <div className="mb-4">
                <label className="block text-[10px] font-mono text-gray-500 mb-2 tracking-widest font-bold">TARGET BATTLEGROUND</label>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {PARKS.map(p => (
                        <button key={p.id} onClick={() => { triggerHaptic(20); setSelectedPark(p.id); }}
                            className={`whitespace-nowrap px-3 py-2 rounded text-[10px] font-mono font-bold transition-all border ${
                                selectedPark === p.id
                                    ? 'bg-vanguard-primary/20 border-vanguard-primary text-vanguard-primary shadow-[0_0_15px_rgba(37,244,238,0.2)]'
                                    : 'bg-white/5 border-white/10 text-gray-500'
                            }`}>
                            {p.name.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Zone Selector */}
            <div className="mb-5">
                <label className="block text-[10px] font-mono text-gray-500 mb-2 tracking-widest font-bold">SECTOR / ZONE</label>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {zones.map(z => (
                        <button key={z} onClick={() => { triggerHaptic(20); setSelectedZone(z); }}
                            className={`min-w-[44px] px-3 py-2 rounded text-xs font-mono font-bold transition-all border ${
                                selectedZone === z ? 'bg-white/20 border-white text-white' : 'bg-white/5 border-white/10 text-gray-500'
                            }`}>
                            {z}
                        </button>
                    ))}
                </div>
            </div>

            {/* Acoustic */}
            <div className="mb-4">
                <label className="block text-[10px] font-mono text-gray-500 mb-2 tracking-widest font-bold">ACOUSTIC SENSORS</label>
                <div className="grid grid-cols-3 gap-2">{acousticButtons.map(btn => renderButton(btn))}</div>
            </div>

            {/* Vision */}
            <div className="mb-4">
                <label className="block text-[10px] font-mono text-gray-500 mb-2 tracking-widest font-bold">CAMERA TRAPS</label>
                <div className="grid grid-cols-3 gap-2">{visionButtons.map(btn => renderButton(btn))}</div>
            </div>

            {/* Community */}
            <div className="mb-5">
                <label className="block text-[10px] font-mono text-gray-500 mb-2 tracking-widest font-bold">COMMUNITY REPORTS</label>
                <div className="grid grid-cols-3 gap-2">{communityButtons.map(btn => renderButton(btn))}</div>
            </div>

            {/* ── INTELLIGENCE BRIEF PANEL (appears after trigger) ─────────── */}
            {showIntel && lastTriggered && (
                <div className="mb-5 border border-vanguard-primary/20 rounded-xl overflow-hidden bg-vanguard-primary/4">
                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-vanguard-primary/10 border-b border-vanguard-primary/15">
                        <div className="flex items-center gap-2">
                            <Brain size={15} className="text-vanguard-primary" />
                            <span className="text-[10px] font-mono font-bold tracking-widest text-vanguard-primary">ALERT INTELLIGENCE</span>
                        </div>
                        <div className="flex gap-2 items-center">
                            {intelBrief && (
                                <button
                                    onClick={() => printPDF(lastTriggered, intelBrief)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-vanguard-primary/15 border border-vanguard-primary/35 rounded-md text-vanguard-primary text-[9px] font-mono font-bold tracking-widest hover:bg-vanguard-primary/25 transition-colors"
                                >
                                    <Download size={11} /> PDF BRIEF
                                </button>
                            )}
                            <button onClick={() => setShowIntel(false)} className="text-gray-500 hover:text-white text-xs leading-none w-5 h-5 flex items-center justify-center">✕</button>
                        </div>
                    </div>

                    <div className="p-4">
                        {/* Triggered context */}
                        <div className="flex gap-2 mb-3 flex-wrap">
                            <span className="text-[9px] font-mono bg-white/5 border border-white/10 text-gray-400 px-2 py-1 rounded">{lastTriggered.type}</span>
                            <span className="text-[9px] font-mono bg-white/5 border border-white/10 text-gray-400 px-2 py-1 rounded">{lastTriggered.subType.replace(/_/g,' ')}</span>
                            <span className="text-[9px] font-mono bg-white/5 border border-white/10 text-gray-400 px-2 py-1 rounded">ZONE {lastTriggered.zone}</span>
                            <span className="text-[9px] font-mono bg-white/5 border border-white/10 text-gray-400 px-2 py-1 rounded">{park?.name}</span>
                        </div>

                        {intelLoading && (
                            <div className="flex items-center gap-2 py-2">
                                <Loader2 size={14} className="text-vanguard-primary animate-spin" />
                                <span className="text-[11px] font-mono text-vanguard-primary/70">VANGUARD AI ANALYZING THREAT VECTOR...</span>
                            </div>
                        )}

                        {intelError && (
                            <div className="flex items-center gap-1.5 mb-2">
                                <AlertTriangle size={11} className="text-amber-400" />
                                <span className="text-[9px] font-mono text-amber-400">{intelError}</span>
                            </div>
                        )}

                        {intelBrief && (
                            <div className="space-y-3">
                                {/* classification + risk window */}
                                <div className="flex gap-2 items-center">
                                    <span style={{
                                        background: `${intelClColors[intelBrief.classification]}22`,
                                        border: `1px solid ${intelClColors[intelBrief.classification]}55`,
                                        color: intelClColors[intelBrief.classification],
                                        fontSize: '10px', fontFamily: 'monospace', fontWeight: 700,
                                        letterSpacing: '0.12em', padding: '2px 8px', borderRadius: '4px',
                                    }}>
                                        {intelBrief.classification}
                                    </span>
                                    <span className="text-[10px] font-mono text-gray-500">{intelBrief.risk_window}</span>
                                </div>

                                {/* Threat assessment */}
                                <p className="text-[12px] text-gray-300 leading-relaxed">{intelBrief.threat_assessment}</p>

                                {/* Actions */}
                                <div>
                                    <div className="text-[9px] font-mono text-gray-500 tracking-widest uppercase mb-1.5">Recommended Actions</div>
                                    <ul className="space-y-1">
                                        {intelBrief.recommended_actions.map((a, i) => (
                                            <li key={i} className="flex gap-2 text-[11px] text-gray-400">
                                                <span className="text-vanguard-primary shrink-0">▸</span>{a}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Selective Purge */}
            <div className="mb-3 border border-white/10 rounded-lg overflow-hidden">
                <button
                    onClick={() => setSelectivePurgeOpen(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <ListX size={16} className="text-orange-400" />
                        <span className="text-xs font-mono font-bold tracking-widest text-orange-400">SELECTIVE ALERT PURGE</span>
                    </div>
                    {selectivePurgeOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </button>

                {selectivePurgeOpen && (
                    <div className="p-3 bg-[#080D18] border-t border-white/10">
                        <div className="text-[9px] font-mono text-gray-500 mb-3 tracking-widest">
                            SHOWING ALERTS FOR: <span className="text-orange-400">{park?.name?.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center justify-between mb-3 gap-2">
                            <button onClick={toggleSelectAll} className="text-[10px] font-mono text-gray-400 border border-white/10 px-3 py-1.5 rounded hover:bg-white/10 transition-colors">
                                {selectedAlertIds.size === liveAlerts.length && liveAlerts.length > 0 ? 'DESELECT ALL' : 'SELECT ALL'}
                            </button>
                            <button onClick={fetchAlerts} className="text-[10px] font-mono text-gray-400 border border-white/10 px-3 py-1.5 rounded hover:bg-white/10 transition-colors">
                                ↻ REFRESH
                            </button>
                            <button
                                onClick={purgeSelected}
                                disabled={selectedAlertIds.size === 0}
                                className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded border transition-colors ${
                                    selectedAlertIds.size > 0
                                        ? 'border-orange-500/60 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                        : 'border-white/10 text-gray-600 cursor-not-allowed'
                                }`}
                            >
                                PURGE {selectedAlertIds.size > 0 ? `(${selectedAlertIds.size})` : ''}
                            </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-1.5 no-scrollbar">
                            {loadingAlerts && <div className="text-[10px] font-mono text-gray-500 text-center py-4">LOADING ALERTS…</div>}
                            {!loadingAlerts && liveAlerts.length === 0 && <div className="text-[10px] font-mono text-gray-600 text-center py-4">NO ACTIVE ALERTS FOR THIS PARK</div>}
                            {!loadingAlerts && liveAlerts.map(alert => {
                                const isSelected = selectedAlertIds.has(alert.id);
                                return (
                                    <div key={alert.id} onClick={() => toggleAlertSelection(alert.id)}
                                        className={`flex items-start gap-3 p-2.5 rounded border cursor-pointer transition-all ${
                                            isSelected ? 'border-orange-500/50 bg-orange-500/10' : `${getAlertBorderColor(alert.type)} bg-black/30 hover:bg-white/5`
                                        }`}>
                                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                            isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-600 bg-transparent'
                                        }`}>
                                            {isSelected && <span className="text-black text-[10px] font-bold">✓</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                {getAlertTypeIcon(alert.type)}
                                                <span className="text-[11px] font-mono font-bold text-white truncate">{alert.subType?.replace(/_/g, ' ')}</span>
                                                <span className="text-[9px] font-mono text-gray-500 ml-auto shrink-0">{alert.zone}</span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 leading-tight line-clamp-1">{alert.description}</p>
                                            <div className="text-[9px] font-mono text-gray-600 mt-0.5">{alert.timestamp}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Full System Purge */}
            <div className="mt-auto pb-4">
                <button
                    onClick={() => { triggerHaptic([50, 100, 50]); fetch('/api/webhooks/clear', { method: 'POST' }).catch(() => {}); setStatus({ type: 'success', message: 'SYSTEM PURGE SENT' }); setTimeout(() => setStatus({ type: null, message: '' }), 2000); }}
                    className="w-full py-4 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center gap-3 active:bg-red-500/20 active:border-red-500 transition-colors group"
                >
                    <Trash2 size={18} className="text-gray-500 group-active:text-red-500" />
                    <span className="text-xs font-mono font-bold tracking-[0.2em] text-gray-400 group-active:text-red-400">PURGE ENTIRE SYSTEM FEED</span>
                </button>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default RemoteController;
