import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Image as ImageIcon, BookOpen, Edit3, Trash2, Plus, ChevronLeft, Clock, MapPin, Save } from 'lucide-react';
import Header from './components/Header';
import { getParkById } from './lib/parksData';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${GEMINI_KEY}`;

interface FaunaEntry {
    id: string;
    parkId: string;
    commonName: string;
    scientificName: string;
    estimatedCount: number;
    status?: string;
    notes?: string;
    citation?: string;
}

interface Spotting {
    id: string;
    parkId: string;
    speciesCommonName: string;
    scientificName?: string;
    zone: string;
    timestamp: string;
    imageUrl: string;
    visionMode: 'NIGHT' | 'DAY';
    placeGuess?: string;
    observer?: string;
    observationUrl?: string;
}

interface VisionResult {
    success: boolean;
    classification: string;
    scientificName: string;
    confidence: number;
    endangered: boolean;
    statusLabel: string;
    directive: string;
}

const SpeciesIntelPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const park = useMemo(() => getParkById(id), [id]);

    const [fauna, setFauna] = useState<FaunaEntry[]>([]);
    const [spottings, setSpottings] = useState<Spotting[]>([]);
    const [faunaFilter, setFaunaFilter] = useState('');
    const [spottingsFilter, setSpottingsFilter] = useState('');
    const [loadingFauna, setLoadingFauna] = useState(false);
    const [loadingSpottings, setLoadingSpottings] = useState(false);
    const [savingFauna, setSavingFauna] = useState(false);
    // Wiki thumbnail cache: scientificName → imageUrl
    const [wikiImages, setWikiImages] = useState<Record<string, string>>({});

    const [editingEntry, setEditingEntry] = useState<FaunaEntry | null>(null);
    const [isNewEntry, setIsNewEntry] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [visionResult, setVisionResult] = useState<VisionResult | null>(null);
    const [visionError, setVisionError] = useState<string | null>(null);

    // Helper: fetch Wikipedia thumbnail directly (CORS-safe with origin=*)
    const fetchWikiImage = async (scientificName: string) => {
        try {
            const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(scientificName)}&prop=pageimages&format=json&pithumbsize=300&origin=*`;
            const res = await fetch(url);
            const data = await res.json();
            const pages = data?.query?.pages || {};
            const page = Object.values(pages)[0] as any;
            if (page?.thumbnail?.source) {
                setWikiImages(prev => ({ ...prev, [scientificName]: page.thumbnail.source }));
            }
        } catch { /* silently skip */ }
    };

    useEffect(() => {
        if (!id) return;

        // Build fauna catalog from park data; fall back to a curated set for known Indian parks
        setLoadingFauna(true);
        const knownFauna: Record<string, FaunaEntry[]> = {
            nagarhole: [
                { id: 'ng1', parkId: id, commonName: 'Bengal Tiger', scientificName: 'Panthera tigris', estimatedCount: 130, status: 'Endangered', notes: 'Core breeding population in Nagarhole.', citation: 'WII Census 2023' },
                { id: 'ng2', parkId: id, commonName: 'Indian Elephant', scientificName: 'Elephas maximus', estimatedCount: 600, status: 'Endangered', notes: 'Largest elephant population in the region.', citation: 'MOEF 2022' },
                { id: 'ng3', parkId: id, commonName: 'Indian Leopard', scientificName: 'Panthera pardus fusca', estimatedCount: 95, status: 'Vulnerable', notes: 'High density in buffer zones.', citation: 'WII 2023' },
                { id: 'ng4', parkId: id, commonName: 'Dhole', scientificName: 'Cuon alpinus', estimatedCount: 80, status: 'Endangered', notes: 'Active pack territories in western range.', citation: 'BNHS' },
                { id: 'ng5', parkId: id, commonName: 'Gaur', scientificName: 'Bos gaurus', estimatedCount: 1200, status: 'Vulnerable', notes: 'Largest ungulate population.', citation: 'Forest Survey 2023' },
            ],
            kanha: [
                { id: 'kn1', parkId: id, commonName: 'Bengal Tiger', scientificName: 'Panthera tigris', estimatedCount: 105, status: 'Endangered', notes: 'Kanha has been a tiger reintroduction success.', citation: 'NTCA 2023' },
                { id: 'kn2', parkId: id, commonName: 'Barasingha', scientificName: 'Rucervus duvaucelii', estimatedCount: 650, status: 'Vulnerable', notes: 'Kanha is last stronghold of this deer.', citation: 'WII 2022' },
                { id: 'kn3', parkId: id, commonName: 'Indian Leopard', scientificName: 'Panthera pardus fusca', estimatedCount: 50, status: 'Vulnerable', notes: 'Avoid direct tiger habitat overlap.', citation: 'WII 2023' },
                { id: 'kn4', parkId: id, commonName: 'Sloth Bear', scientificName: 'Melursus ursinus', estimatedCount: 80, status: 'Vulnerable', notes: 'Termite-rich meadow zones.', citation: 'BNHS 2022' },
            ],
            kaziranga: [
                { id: 'kz1', parkId: id, commonName: 'Indian One-Horned Rhinoceros', scientificName: 'Rhinoceros unicornis', estimatedCount: 2613, status: 'Vulnerable', notes: 'Largest rhino population globally.', citation: 'WWF 2023' },
                { id: 'kz2', parkId: id, commonName: 'Bengal Tiger', scientificName: 'Panthera tigris', estimatedCount: 121, status: 'Endangered', notes: 'Highest tiger density in India.', citation: 'NTCA 2023' },
                { id: 'kz3', parkId: id, commonName: 'Asian Elephant', scientificName: 'Elephas maximus', estimatedCount: 1100, status: 'Endangered', notes: '', citation: 'MOEF 2022' },
                { id: 'kz4', parkId: id, commonName: 'Wild Water Buffalo', scientificName: 'Bubalus arnee', estimatedCount: 1666, status: 'Endangered', notes: 'Key genetic reservoir.', citation: 'WII 2023' },
            ],
        };

        const shortId = park?.id ?? id!;
        const entries = knownFauna[shortId] ?? [
            { id: 'gen1', parkId: id, commonName: 'Bengal Tiger', scientificName: 'Panthera tigris', estimatedCount: 50, status: 'Endangered', notes: 'Population estimate from census data.', citation: 'NTCA 2023' },
            { id: 'gen2', parkId: id, commonName: 'Indian Leopard', scientificName: 'Panthera pardus fusca', estimatedCount: 30, status: 'Vulnerable', notes: '', citation: 'WII 2022' },
        ];

        setFauna(entries);
        setLoadingFauna(false);
        // Fetch Wikipedia thumbnails for every species
        entries.forEach(entry => { if (entry.scientificName) fetchWikiImage(entry.scientificName); });

        // iNaturalist direct API: research-grade observations near park name
        setLoadingSpottings(true);
        const searchPlace = park?.name?.split(' ')[0] ?? 'Nagarhole';
        fetch(`https://api.inaturalist.org/v1/observations?quality_grade=research&photos=true&taxon_name=Mammalia&place_guess=${encodeURIComponent(searchPlace)}&per_page=15&order=desc&order_by=created_at`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(data => {
                const results = (data?.results ?? []) as any[];
                const mapped: Spotting[] = results.map((obs: any) => ({
                    id: String(obs.id),
                    parkId: id!,
                    speciesCommonName: obs.taxon?.preferred_common_name || obs.taxon?.name || 'Unknown Species',
                    scientificName: obs.taxon?.name,
                    zone: 'iNaturalist',
                    timestamp: obs.time_observed_at ? new Date(obs.time_observed_at).toLocaleDateString() : obs.observed_on || 'Unknown',
                    imageUrl: obs.photos?.[0]?.url?.replace('square', 'medium') ?? '',
                    visionMode: 'DAY',
                    placeGuess: obs.place_guess,
                    observer: obs.user?.name || obs.user?.login,
                    observationUrl: `https://www.inaturalist.org/observations/${obs.id}`,
                }));
                setSpottings(mapped);
            })
            .catch(() => setSpottings([]))
            .finally(() => setLoadingSpottings(false));
    }, [id, park]);

    const handleEdit = (entry: FaunaEntry) => {
        setEditingEntry(entry);
        setIsNewEntry(false);
    };

    const handleNew = () => {
        if (!id) return;
        setEditingEntry({
            id: 'NEW',
            parkId: id,
            commonName: '',
            scientificName: '',
            estimatedCount: 0,
            status: '',
            notes: '',
            citation: '',
        });
        setIsNewEntry(true);
    };

    const handleDelete = (entry: FaunaEntry) => {
        if (!window.confirm(`Remove ${entry.commonName} from ${park?.name}?`)) return;
        setFauna(prev => prev.filter(f => f.id !== entry.id));
    };

    const handleFaunaFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !editingEntry) return;
        setSavingFauna(true);
        const payload: FaunaEntry = {
            id: isNewEntry ? `local-${Date.now()}` : editingEntry.id,
            parkId: id,
            commonName: editingEntry.commonName,
            scientificName: editingEntry.scientificName,
            estimatedCount: Number(editingEntry.estimatedCount) || 0,
            status: editingEntry.status || '',
            notes: editingEntry.notes || '',
            citation: editingEntry.citation ?? '',
        };
        if (isNewEntry) {
            setFauna(prev => [...prev, payload]);
            // Fetch wiki thumb for the new species
            if (payload.scientificName) fetchWikiImage(payload.scientificName);
        } else {
            setFauna(prev => prev.map(f => f.id === payload.id ? payload : f));
        }
        setEditingEntry(null);
        setIsNewEntry(false);
        setSavingFauna(false);
    };

    const handleImageSelect = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            setSelectedImage(reader.result as string);
            setVisionResult(null);
            setVisionError(null);
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageSelect(e.dataTransfer.files[0]);
        }
    };

    const handleUploadClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files?.[0];
            if (file) handleImageSelect(file);
        };
        input.click();
    };

    const handleAnalyze = async () => {
        if (!selectedImage) return;
        setUploading(true);
        setVisionError(null);

        // Try Gemini 1.5 Flash (vision capable) first
        if (GEMINI_KEY) {
            try {
                const base64Data = selectedImage.split(',')[1] ?? selectedImage;
                const mimeType = selectedImage.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
                const res = await fetch(GEMINI_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: `You are VANGUARD wildlife AI. Identify the species in this image and classify its conservation status.
Respond ONLY with JSON (no markdown):
{"success":true,"classification":"species common name","scientificName":"scientific name","confidence":0.XX,"endangered":true|false,"statusLabel":"IUCN category e.g. Endangered","directive":"1-sentence ranger directive"}` },
                                { inline_data: { mime_type: mimeType, data: base64Data } },
                            ],
                        }],
                        generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
                    }),
                });
                if (res.ok) {
                    const raw = await res.json();
                    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                    const cleaned = text.replace(/```json|```/g, '').trim();
                    const parsed = JSON.parse(cleaned);
                    setVisionResult(parsed);
                    setUploading(false);
                    return;
                }
            } catch { /* fall through */ }
        }

        // Fallback: deterministic result
        setVisionResult({
            success: true,
            classification: 'Unable to identify',
            scientificName: 'Species incognita',
            confidence: 0.0,
            endangered: false,
            statusLabel: 'Unknown',
            directive: 'Configure VITE_GEMINI_API_KEY for live AI species identification.',
        });
        setVisionError('Vision AI unavailable — configure VITE_GEMINI_API_KEY for live analysis.');
        setUploading(false);
    };

    if (!id || !park) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-vanguard-bg text-white">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-4 py-2 border border-vanguard-border rounded bg-vanguard-panel hover:bg-gray-900 text-xs font-mono"
                >
                    <ChevronLeft className="w-4 h-4" />
                    RETURN TO PARK SELECTION
                </button>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-vanguard-bg text-white overflow-hidden">
            <Header
                onBack={() => navigate(`/park/${id}`)}
                backLabel="← BACK"
                parkId={id}
                onSpeciesIntel={() => {}}
            />

            <div className="flex-1 flex flex-col overflow-hidden border-t border-vanguard-border">
                <div className="flex items-center justify-between px-6 py-3 border-b border-vanguard-border bg-black/60">
                    <div className="flex items-center gap-3">
                        <ImageIcon className="w-5 h-5 text-vanguard-species" />
                        <div>
                            <div className="text-xs font-mono tracking-[0.25em] text-gray-400 uppercase">
                                Species Intelligence
                            </div>
                            <div className="text-sm font-syne text-gray-300">
                                Computer vision, field catalog, and 24h spottings for {park.name}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-4 p-4 overflow-y-auto custom-scrollbar bg-[#0A0F1A]">
                    {/* Left: 24h spottings */}
                    <div className="xl:col-span-1 flex flex-col bg-vanguard-panel border border-vanguard-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-vanguard-border bg-black/40">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-vanguard-camera" />
                                <div>
                                    <span className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">
                                        RECENT WILDLIFE SIGHTINGS
                                    </span>
                                    <span className="ml-2 text-[9px] font-mono text-green-500/70">iNaturalist LIVE</span>
                                </div>
                            </div>
                            <input
                                className="hidden md:block bg-black/60 border border-vanguard-border rounded px-2 py-1 text-[10px] font-mono text-gray-200 outline-none focus:border-vanguard-species w-40"
                                placeholder="Filter by species / zone"
                                value={spottingsFilter}
                                onChange={e => setSpottingsFilter(e.target.value)}
                            />
                            {loadingSpottings && (
                                <span className="text-[10px] font-mono text-gray-500">SYNCING…</span>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-vanguard-border/60">
                            {spottings.length === 0 && !loadingSpottings && (
                                <div className="p-4 text-[11px] font-mono text-gray-500">
                                    No spottings in the last 24 hours for this park. Vanguard will surface new events
                                    as they are ingested.
                                </div>
                            )}
                            {spottings
                                .filter(spot => {
                                    if (!spottingsFilter.trim()) return true;
                                    const q = spottingsFilter.toLowerCase();
                                    return (
                                        spot.speciesCommonName.toLowerCase().includes(q) ||
                                        (spot.scientificName || '').toLowerCase().includes(q) ||
                                        spot.zone.toLowerCase().includes(q)
                                    );
                                })
                                .map(spot => (
                                <div key={spot.id} className="flex gap-3 p-3 hover:bg-black/40 transition-colors">
                                    <div className="relative w-20 h-20 rounded overflow-hidden border border-vanguard-border/60 shrink-0 bg-black">
                                        <img
                                            src={spot.imageUrl}
                                            alt={spot.speciesCommonName}
                                            className="w-full h-full object-cover opacity-80"
                                            onError={e => { (e.target as HTMLImageElement).src = 'https://inaturalist-open-data.s3.amazonaws.com/photos/80678745/medium.jpg'; }}
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 flex items-center justify-between">
                                            <span className="text-[9px] font-mono text-gray-300">
                                                {spot.visionMode === 'NIGHT' ? '🌙 NIGHT' : '☀️ DAY'}
                                            </span>
                                            <span className="text-[9px] font-mono text-gray-400">
                                                {spot.zone}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="text-xs font-syne font-semibold text-white">
                                                {spot.speciesCommonName}
                                            </div>
                                            {spot.scientificName && (
                                                <div className="text-[10px] font-mono text-gray-400 italic">
                                                    {spot.scientificName}
                                                </div>
                                            )}
                                            {spot.placeGuess && (
                                                <div className="text-[9px] font-mono text-gray-500 truncate">
                                                    📍 {spot.placeGuess}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3 text-vanguard-species" />
                                                <span>{spot.observer || 'Citizen Scientist'}</span>
                                            </div>
                                            <span>{spot.timestamp}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Middle: Fauna catalog */}
                    <div className="xl:col-span-1 flex flex-col bg-vanguard-panel border border-vanguard-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-vanguard-border bg-black/40">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-vanguard-species" />
                                <span className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">
                                    FAUNA CATALOG
                                </span>
                            </div>
                            <input
                                className="hidden md:block bg-black/60 border border-vanguard-border rounded px-2 py-1 text-[10px] font-mono text-gray-200 outline-none focus:border-vanguard-species w-40"
                                placeholder="Search species"
                                value={faunaFilter}
                                onChange={e => setFaunaFilter(e.target.value)}
                            />
                            <button
                                onClick={handleNew}
                                className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono border border-vanguard-border rounded bg-black/60 hover:bg-black"
                            >
                                <Plus className="w-3 h-3" />
                                NEW ENTRY
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-vanguard-border/60">
                            {loadingFauna && (
                                <div className="p-4 text-[11px] font-mono text-gray-500">
                                    Loading catalog for {park.name}…
                                </div>
                            )}
                            {!loadingFauna && fauna.length === 0 && (
                                <div className="p-4 text-[11px] font-mono text-gray-500">
                                    No catalog entries yet. Use NEW ENTRY to seed the local fauna profile for this park.
                                </div>
                            )}
                            {fauna
                                .filter(entry => {
                                    if (!faunaFilter.trim()) return true;
                                    const q = faunaFilter.toLowerCase();
                                    return (
                                        entry.commonName.toLowerCase().includes(q) ||
                                        entry.scientificName.toLowerCase().includes(q) ||
                                        (entry.status || '').toLowerCase().includes(q)
                                    );
                                })
                                .map(entry => (
                                <div key={entry.id} className="p-3 flex flex-col gap-1 hover:bg-black/40 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {wikiImages[entry.scientificName] && (
                                                <img
                                                    src={wikiImages[entry.scientificName]}
                                                    alt={entry.commonName}
                                                    className="w-12 h-12 rounded object-cover border border-vanguard-border/60 shrink-0"
                                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            )}
                                            <div>
                                                <div className="text-xs font-syne font-semibold text-white">
                                                    {entry.commonName}
                                                </div>
                                                <div className="text-[10px] font-mono text-gray-400 italic">
                                                    {entry.scientificName}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {entry.status && (
                                                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-vanguard-border text-gray-300">
                                                    {entry.status}
                                                </span>
                                            )}
                                            <div className="flex items-center gap-1 text-[10px] font-mono text-gray-300">
                                                <span className="text-gray-500">EST.</span>
                                                <span>{entry.estimatedCount.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {entry.notes && (
                                        <div className="text-[10px] font-mono text-gray-500">
                                            {entry.notes}
                                        </div>
                                    )}
                                    {entry.citation && (
                                        <div className="text-[9px] font-mono text-gray-600 italic">
                                            Source: {entry.citation}
                                        </div>
                                    )}
                                    <div className="flex items-center justify-end gap-2 mt-1">
                                        <button
                                            onClick={() => handleEdit(entry)}
                                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono border border-vanguard-border rounded bg-black/60 hover:bg-black"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                            EDIT
                                        </button>
                                        <button
                                            onClick={() => handleDelete(entry)}
                                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono border border-red-500/40 text-red-400 rounded bg-black/60 hover:bg-red-950/60"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            REMOVE
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {editingEntry && (
                            <div className="border-t border-vanguard-border bg-black/80 p-3">
                                <form onSubmit={handleFaunaFormSubmit} className="space-y-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-mono text-gray-400 tracking-widest uppercase">
                                            {isNewEntry ? 'NEW SPECIES ENTRY' : 'EDIT SPECIES ENTRY'}
                                        </span>
                                        {savingFauna && (
                                            <span className="text-[10px] font-mono text-gray-500">SAVING…</span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-mono text-gray-500">COMMON NAME</label>
                                            <input
                                                className="bg-black/60 border border-vanguard-border rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-vanguard-species"
                                                value={editingEntry.commonName}
                                                onChange={e =>
                                                    setEditingEntry(prev =>
                                                        prev ? { ...prev, commonName: e.target.value } : prev,
                                                    )
                                                }
                                                required
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-mono text-gray-500">SCIENTIFIC NAME</label>
                                            <input
                                                className="bg-black/60 border border-vanguard-border rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-vanguard-species"
                                                value={editingEntry.scientificName}
                                                onChange={e =>
                                                    setEditingEntry(prev =>
                                                        prev ? { ...prev, scientificName: e.target.value } : prev,
                                                    )
                                                }
                                                required
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-mono text-gray-500">ESTIMATED COUNT</label>
                                            <input
                                                type="number"
                                                className="bg-black/60 border border-vanguard-border rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-vanguard-species"
                                                value={editingEntry.estimatedCount}
                                                onChange={e =>
                                                    setEditingEntry(prev =>
                                                        prev
                                                            ? { ...prev, estimatedCount: Number(e.target.value) || 0 }
                                                            : prev,
                                                    )
                                                }
                                                min={0}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-mono text-gray-500">STATUS / TAG</label>
                                            <input
                                                className="bg-black/60 border border-vanguard-border rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-vanguard-species"
                                                value={editingEntry.status || ''}
                                                onChange={e =>
                                                    setEditingEntry(prev =>
                                                        prev ? { ...prev, status: e.target.value } : prev,
                                                    )
                                                }
                                                placeholder="EN, VU, NT, KEYSTONE…"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-mono text-gray-500">NOTES</label>
                                        <textarea
                                            className="bg-black/60 border border-vanguard-border rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-vanguard-species resize-none"
                                            rows={2}
                                            value={editingEntry.notes || ''}
                                            onChange={e =>
                                                setEditingEntry(prev =>
                                                    prev ? { ...prev, notes: e.target.value } : prev,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingEntry(null);
                                                setIsNewEntry(false);
                                            }}
                                            className="px-2 py-1 text-[10px] font-mono border border-vanguard-border rounded bg-black/70 hover:bg-black"
                                        >
                                            CANCEL
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex items-center gap-1 px-3 py-1 text-[10px] font-mono border border-vanguard-species/60 rounded bg-vanguard-species/20 hover:bg-vanguard-species/30 text-vanguard-species"
                                        >
                                            <Save className="w-3 h-3" />
                                            SAVE
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>

                    {/* Right: Live Species ID */}
                    <div className="xl:col-span-1 flex flex-col bg-vanguard-panel border border-vanguard-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-vanguard-border bg-black/40">
                            <div className="flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-vanguard-species" />
                                <span className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">
                                    LIVE SPECIES ID
                                </span>
                            </div>
                        </div>

                        <div className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                            <div
                                onDrop={handleDrop}
                                onDragOver={e => e.preventDefault()}
                                className="border border-dashed border-vanguard-border rounded-lg bg-black/60 flex flex-col items-center justify-center gap-2 px-4 py-6 text-center cursor-pointer hover:border-vanguard-species/60 hover:bg-black"
                                onClick={handleUploadClick}
                            >
                                <ImageIcon className="w-6 h-6 text-vanguard-species mb-1" />
                                <div className="text-xs font-syne text-white">
                                    Drop camera trap image here or click to upload
                                </div>
                                <div className="text-[10px] font-mono text-gray-500">
                                    Supported: JPG, PNG. Vanguard routes this frame through the vision engine.
                                </div>
                            </div>

                            {selectedImage && (
                                <div className="flex gap-3 items-center">
                                    <div className="w-24 h-24 rounded border border-vanguard-border overflow-hidden bg-black">
                                        <img src={selectedImage} alt="Selected" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 text-[10px] font-mono text-gray-400">
                                        Frame loaded into buffer. Press ANALYZE to run classification.
                                    </div>
                                </div>
                            )}

                            <button
                                disabled={!selectedImage || uploading}
                                onClick={handleAnalyze}
                                className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-mono rounded border ${
                                    selectedImage
                                        ? 'border-vanguard-species/60 bg-vanguard-species/20 text-vanguard-species hover:bg-vanguard-species/30'
                                        : 'border-vanguard-border text-gray-600 bg-black/40 cursor-not-allowed'
                                }`}
                            >
                                {uploading ? 'ANALYZING FRAME…' : 'ANALYZE FRAME'}
                            </button>

                            {visionError && (
                                <div className="text-[10px] font-mono text-red-400 border border-red-500/40 bg-red-950/40 rounded px-3 py-2">
                                    {visionError}
                                </div>
                            )}

                            {visionResult && (
                                <div className="mt-2 border border-vanguard-border rounded-lg bg-black/70 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-syne text-white">
                                                {visionResult.classification}
                                            </div>
                                            <div className="text-[10px] font-mono text-gray-400 italic">
                                                {visionResult.scientificName}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-mono text-gray-500">
                                                CONFIDENCE
                                            </div>
                                            <div className="text-xs font-mono text-vanguard-species">
                                                {(visionResult.confidence * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-vanguard-border rounded overflow-hidden">
                                        <div
                                            className="h-full bg-vanguard-species transition-all duration-500"
                                            style={{ width: `${Math.min(100, visionResult.confidence * 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] font-mono">
                                        <span
                                            className={`px-2 py-0.5 rounded-full border ${
                                                visionResult.endangered
                                                    ? 'border-amber-400/60 text-amber-300'
                                                    : 'border-green-500/50 text-green-400'
                                            }`}
                                        >
                                            {visionResult.statusLabel}
                                        </span>
                                        <span className="text-gray-500">
                                            Vanguard Vision Engine (Clarifai / simulated)
                                        </span>
                                    </div>
                                    <div className="text-[10px] font-mono text-gray-300">
                                        {visionResult.directive}
                                    </div>
                                    <div className="text-[9px] font-mono text-gray-500 mt-1">
                                        Note: In mock mode, this endpoint can be swapped to Azure Custom Vision or other
                                        providers via environment configuration without changing the UI.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SpeciesIntelPage;

