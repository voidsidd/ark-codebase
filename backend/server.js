const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ee = require('@google/earthengine');
const mongoose = require('mongoose');

const app = express();

// ==========================================
// 0. MONGODB CONNECTION
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://vanguard-admin:itsmesid@vanguard.f6u5i4v.mongodb.net/vanguard';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('[MongoDB] Connected to Atlas cluster.'))
    .catch(err => console.error('[MongoDB] Connection error:', err.message));

// Zone Schema
const zoneSchema = new mongoose.Schema({
    parkId:    { type: String, required: true, index: true },
    name:      { type: String, required: true },
    latitude:  { type: Number, required: true },
    longitude: { type: Number, required: true },
    radius:    { type: Number, required: true },
    status:    { type: String, enum: ['critical', 'warning', 'normal'], default: 'normal' },
    alerts:    { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});
const Zone = mongoose.model('Zone', zoneSchema);

// Default zones to seed if DB is empty for a park
const DEFAULT_ZONES = {
    nagarhole:   [
        { name: 'Alpha Core',  latitude: 11.9833 + 0.05, longitude: 76.1167 - 0.05, radius: 5000, status: 'critical', alerts: 2 },
        { name: 'Beta Sector', latitude: 11.9833 - 0.03, longitude: 76.1167 + 0.02, radius: 6000, status: 'warning',  alerts: 1 },
        { name: 'Gamma Ring',  latitude: 11.9833 + 0.02, longitude: 76.1167 + 0.06, radius: 5500, status: 'normal',   alerts: 0 },
        { name: 'Delta Post',  latitude: 11.9833 - 0.04, longitude: 76.1167 - 0.03, radius: 7000, status: 'critical', alerts: 3 },
    ],
    corbett:     [{ name: 'Core Zone', latitude: 29.53, longitude: 78.7747, radius: 8000, status: 'normal', alerts: 0 }],
    kaziranga:   [{ name: 'Rhino Reserve', latitude: 26.5775, longitude: 93.1711, radius: 7000, status: 'warning', alerts: 1 }],
    sundarbans:  [{ name: 'Tiger Delta', latitude: 21.9497, longitude: 88.9468, radius: 9000, status: 'critical', alerts: 2 }],
    'maasai-mara': [{ name: 'Migration Corridor', latitude: -1.4061, longitude: 35.1019, radius: 10000, status: 'normal', alerts: 0 }],
    kruger:      [{ name: 'Big Five Zone', latitude: -23.9884, longitude: 31.5547, radius: 12000, status: 'warning', alerts: 1 }],
};

// ==========================================
// 1. BASE CONFIGURATION & ASSETS
// ==========================================

// Earth Engine Authentication & Initialization
let eeReady = false;
let eeTileUrl = '';

try {
    // Support both: env var (Render/production) and local file (dev)
    let eeKey;
    if (process.env.GEE_SERVICE_ACCOUNT_KEY) {
        eeKey = JSON.parse(process.env.GEE_SERVICE_ACCOUNT_KEY);
        console.log('[EarthEngine] Using credentials from environment variable.');
    } else {
        eeKey = require('../earth-engine-491414-a2f63906e133.json');
        console.log('[EarthEngine] Using credentials from local JSON file.');
    }
    console.log('[EarthEngine] Authenticating with private key...');
    ee.data.authenticateViaPrivateKey(eeKey, () => {
        ee.initialize(null, null, () => {
            eeReady = true;
            console.log('[EarthEngine] Authenticated successfully.');
            
            // Create a dynamic high-res global satellite map tile service
            // Using Sentinel-2 harmonized SR + dynamic scaling
            const image = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                .filterDate('2023-01-01', '2023-12-31')
                .median()
                .visualize({bands: ['B4', 'B3', 'B2'], min: 0, max: 3000});
            
            image.getMap({}, ({urlFormat}) => {
                eeTileUrl = urlFormat;
                console.log(`[EarthEngine] Tile layer generated: ${urlFormat}`);
            });
        }, (err) => {
            console.error('[EarthEngine] Initialization error:', err);
        });
    }, (err) => {
        console.error('[EarthEngine] Auth error:', err);
    });
} catch (err) {
    console.warn('[EarthEngine] Warning: Key file not found or invalid.', err.message);
}

// Endpoint to fetch the EE satellite tile URL format for 3D Earth
app.get('/api/earthengine/tiles', (req, res) => {
    if (!eeReady || !eeTileUrl) {
        return res.status(503).json({ error: 'Earth Engine not initialized yet', fallback: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' });
    }
    res.json({ urlFormat: eeTileUrl });
});

// Endpoint to fetch high-res bounding box for a Vanguard park
app.get('/api/earthengine/park-bounds/:parkId', (req, res) => {
    const { parkId } = req.params;
    const PARK_COORDS = {
        'nagarhole':   { lat: 11.9833, lon: 76.1167, radius: 0.1 },
        'corbett':     { lat: 29.5300, lon: 78.7747, radius: 0.15 },
        'kaziranga':   { lat: 26.5775, lon: 93.1711, radius: 0.1 },
        'sundarbans':  { lat: 21.9497, lon: 88.9468, radius: 0.2 },
        'maasai-mara': { lat: -1.4061, lon: 35.1019, radius: 0.2 },
        'kruger':      { lat: -23.9884, lon: 31.5547, radius: 0.3 },
    };
    const c = PARK_COORDS[parkId];
    if (!c) return res.status(404).json({ error: 'Unknown park' });
    
    // Return GeoJSON polygon representing the exact border overlay for the globe
    const border = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [c.lon - c.radius, c.lat - c.radius],
                    [c.lon + c.radius, c.lat - c.radius],
                    [c.lon + c.radius, c.lat + c.radius],
                    [c.lon - c.radius, c.lat + c.radius],
                    [c.lon - c.radius, c.lat - c.radius]
                ]]
            },
            properties: { name: parkId, color: '#00ccff' }
        }]
    };
    res.json(border);
});

// ==========================================
// ZONES API — MongoDB backed
// ==========================================

// GET /api/zones/:parkId — fetch all zones; auto-seed if empty
app.get('/api/zones/:parkId', async (req, res) => {
    try {
        const { parkId } = req.params;
        let zones = await Zone.find({ parkId });
        if (zones.length === 0 && DEFAULT_ZONES[parkId]) {
            const seeds = DEFAULT_ZONES[parkId].map(z => ({ ...z, parkId }));
            zones = await Zone.insertMany(seeds);
            console.log(`[MongoDB] Seeded ${zones.length} zones for ${parkId}`);
        }
        res.json(zones);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/zones — create a new zone
app.post('/api/zones', async (req, res) => {
    try {
        const zone = new Zone(req.body);
        await zone.save();
        res.status(201).json(zone);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH /api/zones/:id — update zone status/alerts
app.patch('/api/zones/:id', async (req, res) => {
    try {
        const zone = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!zone) return res.status(404).json({ error: 'Zone not found' });
        res.json(zone);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/zones/:id — remove a zone
app.delete('/api/zones/:id', async (req, res) => {
    try {
        await Zone.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Serve the production-built React frontend files
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' })); // Allow high-res camera frames

// In-memory store of connected SSE clients
let clients = [];

// ==========================================
// 2. LIVE DATA TRANSMISSION (SSE) 
// ==========================================
// This sits at the top to ensure critical alerts are prioritized
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    clients.push(res);
    console.log(`[SSE] New hardware connection established. Total active sinks: ${clients.length}`);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
        console.log(`[SSE] Client offline. Remaining pool: ${clients.length}`);
    });
});

function broadcastEvent(eventType, payload) {
    const data = JSON.stringify({ type: eventType, payload });
    clients.forEach(client => {
        client.write(`data: ${data}\n\n`);
    });
}

// In-memory store of recent alerts for correlation logic
let recentAlerts = [];

// Simple disk-backed store for fauna catalog and camera spottings
const DATA_DIR = path.join(__dirname, 'data');
const FAUNA_FILE = path.join(DATA_DIR, 'fauna.json');
const SPOTTINGS_FILE = path.join(DATA_DIR, 'spottings.json');
const AUDIO_FILE = path.join(DATA_DIR, 'audio.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readJsonSafe(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const raw = fs.readFileSync(filePath, 'utf8');
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeJsonSafe(filePath, value) {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

// Seed fauna catalog with rough, publicly available estimates (approximate, for demo only)
function seedFaunaIfEmpty() {
    const existing = readJsonSafe(FAUNA_FILE, null);
    if (existing) return existing;
    const seeded = {
        nagarhole: [
            {
                id: 'ngh-tiger',
                parkId: 'nagarhole',
                commonName: 'Bengal Tiger',
                scientificName: 'Panthera tigris tigris',
                estimatedCount: 150,
                status: 'EN',
                notes: 'High-density tiger landscape; estimate from Karnataka tiger census (NTCA/State Forest Dept).',
                citation: 'NTCA All India Tiger Estimation 2022; IUCN Red List 2024'
            },
            {
                id: 'ngh-elephant',
                parkId: 'nagarhole',
                commonName: 'Asian Elephant',
                scientificName: 'Elephas maximus indicus',
                estimatedCount: 800,
                status: 'EN',
                notes: 'Part of Nilgiri elephant landscape; pooled estimate (Project Elephant, MoEFCC).',
                citation: 'IUCN Red List 2024; Elephant Census India'
            },
            {
                id: 'ngh-leopard',
                parkId: 'nagarhole',
                commonName: 'Indian Leopard',
                scientificName: 'Panthera pardus fusca',
                estimatedCount: 120,
                status: 'VU',
                notes: 'Leopard density from camera trap studies overlapping tiger grids.',
                citation: 'IUCN Red List 2024'
            }
        ],
        corbett: [
            {
                id: 'cor-tiger',
                parkId: 'corbett',
                commonName: 'Bengal Tiger',
                scientificName: 'Panthera tigris tigris',
                estimatedCount: 250,
                status: 'EN',
                notes: 'Corbett holds one of India’s highest tiger populations (NTCA).',
                citation: 'NTCA 2022; IUCN 2024'
            },
            {
                id: 'cor-elephant',
                parkId: 'corbett',
                commonName: 'Asian Elephant',
                scientificName: 'Elephas maximus indicus',
                estimatedCount: 1000,
                status: 'EN',
                notes: 'Trans-Himalayan elephant population across Corbett–Rajaji corridor.',
                citation: 'Project Elephant; IUCN 2024'
            },
            {
                id: 'cor-gharial',
                parkId: 'corbett',
                commonName: 'Gharial',
                scientificName: 'Gavialis gangeticus',
                estimatedCount: 40,
                status: 'CR',
                notes: 'Critically endangered riverine crocodilian; reintroduced population.',
                citation: 'IUCN Red List 2024'
            }
        ],
        kaziranga: [
            {
                id: 'kaz-rhino',
                parkId: 'kaziranga',
                commonName: 'Indian One-horned Rhinoceros',
                scientificName: 'Rhinoceros unicornis',
                estimatedCount: 2600,
                status: 'VU',
                notes: 'World’s largest population; 2018 census ~2,613 (Assam Forest Dept).',
                citation: 'Kaziranga Census 2018; IUCN 2024'
            },
            {
                id: 'kaz-elephant',
                parkId: 'kaziranga',
                commonName: 'Asian Elephant',
                scientificName: 'Elephas maximus indicus',
                estimatedCount: 1200,
                status: 'EN',
                notes: 'Large breeding population across Kaziranga–Karbi Anglong complex.',
                citation: 'IUCN 2024'
            },
            {
                id: 'kaz-tiger',
                parkId: 'kaziranga',
                commonName: 'Bengal Tiger',
                scientificName: 'Panthera tigris tigris',
                estimatedCount: 120,
                status: 'EN',
                notes: 'High tiger density (NTCA).',
                citation: 'NTCA 2022; IUCN 2024'
            }
        ],
        sundarbans: [
            {
                id: 'sun-tiger',
                parkId: 'sundarbans',
                commonName: 'Sundarbans Bengal Tiger',
                scientificName: 'Panthera tigris tigris',
                estimatedCount: 100,
                status: 'EN',
                notes: 'Mangrove-adapted tiger population (Indian Sundarbans).',
                citation: 'NTCA/WII; IUCN 2024'
            },
            {
                id: 'sun-dolphin',
                parkId: 'sundarbans',
                commonName: 'Irrawaddy Dolphin',
                scientificName: 'Orcaella brevirostris',
                estimatedCount: 80,
                status: 'EN',
                notes: 'Estuarine population; estimates from survey reports.',
                citation: 'IUCN 2024'
            },
            {
                id: 'sun-crocodile',
                parkId: 'sundarbans',
                commonName: 'Estuarine Crocodile',
                scientificName: 'Crocodylus porosus',
                estimatedCount: 250,
                status: 'LC',
                notes: 'Apex predator; indicative estimate.',
                citation: 'IUCN 2024'
            }
        ],
        'maasai-mara': [
            {
                id: 'mara-lion',
                parkId: 'maasai-mara',
                commonName: 'African Lion',
                scientificName: 'Panthera leo melanochaita',
                estimatedCount: 850,
                status: 'VU',
                notes: 'Mara–Serengeti ecosystem; cross-border population.',
                citation: 'KWS/Mara Conservancy; IUCN 2024'
            },
            {
                id: 'mara-elephant',
                parkId: 'maasai-mara',
                commonName: 'African Savanna Elephant',
                scientificName: 'Loxodonta africana',
                estimatedCount: 2500,
                status: 'EN',
                notes: 'Mobile cross-border population (Kenya–Tanzania).',
                citation: 'IUCN 2024'
            },
            {
                id: 'mara-rhino',
                parkId: 'maasai-mara',
                commonName: 'Black Rhinoceros',
                scientificName: 'Diceros bicornis michaeli',
                estimatedCount: 40,
                status: 'CR',
                notes: 'Small remnant population under protection.',
                citation: 'IUCN Red List 2024'
            }
        ],
        kruger: [
            {
                id: 'kru-elephant',
                parkId: 'kruger',
                commonName: 'African Savanna Elephant',
                scientificName: 'Loxodonta africana',
                estimatedCount: 19500,
                status: 'EN',
                notes: 'SANParks census (~19–20k).',
                citation: 'SANParks; IUCN 2024'
            },
            {
                id: 'kru-white-rhino',
                parkId: 'kruger',
                commonName: 'Southern White Rhinoceros',
                scientificName: 'Ceratotherium simum simum',
                estimatedCount: 2500,
                status: 'NT',
                notes: 'Population under pressure; SANParks estimates.',
                citation: 'SANParks; IUCN 2024'
            },
            {
                id: 'kru-wild-dog',
                parkId: 'kruger',
                commonName: 'African Wild Dog',
                scientificName: 'Lycaon pictus',
                estimatedCount: 150,
                status: 'EN',
                notes: 'Meta-population within Greater Kruger.',
                citation: 'IUCN 2024'
            }
        ]
    };
    writeJsonSafe(FAUNA_FILE, seeded);
    return seeded;
}

function seedSpottingsIfEmpty() {
    const existing = readJsonSafe(SPOTTINGS_FILE, null);
    if (existing) return existing;
    const now = new Date();
    const iso = (offsetMinutes) => new Date(now.getTime() - offsetMinutes * 60000).toISOString();
    const seeded = {
        nagarhole: [
            {
                id: 'ngh-spot-1',
                parkId: 'nagarhole',
                speciesCommonName: 'Asian Elephant',
                scientificName: 'Elephas maximus indicus',
                zone: 'Z2',
                timestamp: iso(35),
                imageUrl: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=80&w=800&auto=format&fit=crop',
                visionMode: 'DAY'
            },
            {
                id: 'ngh-spot-2',
                parkId: 'nagarhole',
                speciesCommonName: 'Bengal Tiger',
                scientificName: 'Panthera tigris tigris',
                zone: 'Z4',
                timestamp: iso(120),
                imageUrl: 'https://images.unsplash.com/photo-1510936111840-65e151ad71bb?q=80&w=800&auto=format&fit=crop',
                visionMode: 'NIGHT'
            }
        ],
        corbett: [
            {
                id: 'cor-spot-1',
                parkId: 'corbett',
                speciesCommonName: 'Bengal Tiger',
                scientificName: 'Panthera tigris tigris',
                zone: 'Z3',
                timestamp: iso(90),
                imageUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=800&auto=format&fit=crop',
                visionMode: 'NIGHT'
            }
        ],
        kaziranga: [
            {
                id: 'kaz-spot-1',
                parkId: 'kaziranga',
                speciesCommonName: 'Indian One-horned Rhinoceros',
                scientificName: 'Rhinoceros unicornis',
                zone: 'Z1',
                timestamp: iso(45),
                imageUrl: 'https://images.unsplash.com/photo-1524135329990-07660cd5bf10?q=80&w=800&auto=format&fit=crop',
                visionMode: 'DAY'
            }
        ],
        sundarbans: [
            {
                id: 'sun-spot-1',
                parkId: 'sundarbans',
                speciesCommonName: 'Sundarbans Bengal Tiger',
                scientificName: 'Panthera tigris tigris',
                zone: 'Z5',
                timestamp: iso(15),
                imageUrl: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=80&w=800&auto=format&fit=crop',
                visionMode: 'NIGHT'
            }
        ],
        'maasai-mara': [
            {
                id: 'mara-spot-1',
                parkId: 'maasai-mara',
                speciesCommonName: 'African Lion',
                scientificName: 'Panthera leo melanochaita',
                zone: 'Z6',
                timestamp: iso(60),
                imageUrl: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=80&w=800&auto=format&fit=crop',
                visionMode: 'DAY'
            }
        ],
        kruger: [
            {
                id: 'kru-spot-1',
                parkId: 'kruger',
                speciesCommonName: 'African Wild Dog',
                scientificName: 'Lycaon pictus',
                zone: 'Z7',
                timestamp: iso(25),
                imageUrl: 'https://images.unsplash.com/photo-1601758493928-1993e6ec87cd?q=80&w=800&auto=format&fit=crop',
                visionMode: 'DAY'
            }
        ]
    };
    writeJsonSafe(SPOTTINGS_FILE, seeded);
    return seeded;
}

let faunaStore = seedFaunaIfEmpty();
let spottingsStore = seedSpottingsIfEmpty();
let audioStore = readJsonSafe(AUDIO_FILE, null);
if (!audioStore) {
    const now = new Date();
    const isoTime = (offsetMinutes) =>
        new Date(now.getTime() - offsetMinutes * 60000).toISOString().substring(11, 19);
    audioStore = {
        nagarhole: [
            {
                id: 'ngh-a1',
                parkId: 'nagarhole',
                zone: 'Z4',
                timestamp: isoTime(25),
                classification: 'Single Gunshot Pulse',
                threatLevel: 'THREAT',
                confidence: 0.94,
                sourceType: 'ACOUSTIC_SENSOR'
            },
            {
                id: 'ngh-a2',
                parkId: 'nagarhole',
                zone: 'Z2',
                timestamp: isoTime(80),
                classification: 'Elephant Trumpet Call',
                threatLevel: 'WILDLIFE',
                confidence: 0.88,
                sourceType: 'ACOUSTIC_SENSOR'
            }
        ],
        corbett: [
            {
                id: 'cor-a1',
                parkId: 'corbett',
                zone: 'Z3',
                timestamp: isoTime(60),
                classification: 'Chainsaw-Like Harmonic Pattern',
                threatLevel: 'THREAT',
                confidence: 0.92,
                sourceType: 'ACOUSTIC_SENSOR'
            }
        ],
        kaziranga: [
            {
                id: 'kaz-a1',
                parkId: 'kaziranga',
                zone: 'Z1',
                timestamp: isoTime(45),
                classification: 'Ambient Wetland Chorus',
                threatLevel: 'AMBIENT',
                confidence: 0.78,
                sourceType: 'ACOUSTIC_SENSOR'
            }
        ],
        sundarbans: [
            {
                id: 'sun-a1',
                parkId: 'sundarbans',
                zone: 'Z5',
                timestamp: isoTime(15),
                classification: 'Boat Engine / Low RPM',
                threatLevel: 'THREAT',
                confidence: 0.86,
                sourceType: 'ACOUSTIC_SENSOR'
            }
        ],
        'maasai-mara': [
            {
                id: 'mara-a1',
                parkId: 'maasai-mara',
                zone: 'Z6',
                timestamp: isoTime(50),
                classification: 'Lion Roar Sequence',
                threatLevel: 'WILDLIFE',
                confidence: 0.9,
                sourceType: 'ACOUSTIC_SENSOR'
            }
        ],
        kruger: [
            {
                id: 'kru-a1',
                parkId: 'kruger',
                zone: 'Z7',
                timestamp: isoTime(35),
                classification: 'Vehicle Convoy on Gravel',
                threatLevel: 'THREAT',
                confidence: 0.89,
                sourceType: 'ACOUSTIC_SENSOR'
            }
        ]
    };
    writeJsonSafe(AUDIO_FILE, audioStore);
}
// ==========================================
// 3. VANGUARD CORRELATION ENGINE (VCE) v2
// ==========================================
//
// Rules (evaluated in priority order):
//   Rule A — Triple Correlation: 3+ events in zone within 30 min, 2+ source types → CRITICAL correlated incident
//   Rule B — High-Confidence Acoustic: GUNSHOT/CHAINSAW > 0.92 confidence → HIGH priority
//   Rule C — Zone Correlation: 2+ events in zone within 30 min, ≥1 human-presence signal → ELEVATED incident

function processEvent(newEvent) {
    newEvent.timestampMs = Date.now();
    recentAlerts.push(newEvent);

    // 30-minute rolling window — wide enough for multi-source correlation
    const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
    recentAlerts = recentAlerts.filter(a => a.timestampMs > thirtyMinsAgo);

    // Gather all events in this zone for this park within the window
    const zoneAlerts = recentAlerts.filter(a =>
        a.parkId === newEvent.parkId &&
        a.zone === newEvent.zone
    );

    // Distinct source types present in this zone window (ACOUSTIC, CAMERA, COMMUNITY)
    const uniqueSourceTypes = new Set(zoneAlerts.map(a => a.type));

    // A human-presence signal means any CAMERA HUMAN_PRESENCE or any COMMUNITY report
    const hasHumanPresence = zoneAlerts.some(a =>
        a.subType === 'HUMAN_PRESENCE' || a.type === 'COMMUNITY'
    );

    // ── Rule A: Triple Correlation (highest priority — fires immediately) ──
    if (zoneAlerts.length >= 3 && uniqueSourceTypes.size >= 2) {
        console.log(`[VCE] CRITICAL: Triple correlation in ${newEvent.parkId} ${newEvent.zone}. Sources: ${[...uniqueSourceTypes].join(', ')}.`);
        const correlatedEvent = {
            id: `COR-${Date.now()}`,
            type: 'CORRELATED',
            subType: 'CONFIRMED_THREAT_EXTREME',
            zone: newEvent.zone,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            timestampMs: Date.now(),
            description: `TRIPLE CORRELATION: Computer Vision, Acoustic arrays, and Human Intelligence have triangulated to ${newEvent.zone}. Dispatching tactical units immediately.`,
            priority: 'CRITICAL',
            location: newEvent.location,
            parkId: newEvent.parkId
        };
        // Broadcast the triggering event first, then the correlated incident
        broadcastEvent('NEW_ALERT', newEvent);
        setTimeout(() => broadcastEvent('NEW_ALERT', correlatedEvent), 1500);
        return;
    }

    // ── Rule B: High-confidence acoustic (GUNSHOT or CHAINSAW) ──
    if (
        newEvent.type === 'ACOUSTIC' &&
        (newEvent.subType === 'GUNSHOT' || newEvent.subType === 'CHAINSAW') &&
        newEvent.confidence > 0.92
    ) {
        newEvent.priority = 'HIGH';
        console.log(`[VCE] HIGH: Confirmed ${newEvent.subType} at confidence ${newEvent.confidence} in ${newEvent.parkId} ${newEvent.zone}.`);
    }

    // ── Rule C: Zone correlation with human-presence signal ──
    if (
        zoneAlerts.length >= 2 &&
        hasHumanPresence &&
        newEvent.priority !== 'CRITICAL' &&
        newEvent.priority !== 'HIGH'
    ) {
        newEvent.priority = 'ELEVATED';
        newEvent.description = `[ZONE CORRELATION] Human-activity signal detected in sector. ` + newEvent.description;
        console.log(`[VCE] ELEVATED: Zone correlation + human presence in ${newEvent.parkId} ${newEvent.zone}.`);
    }

    broadcastEvent('NEW_ALERT', newEvent);
}

// ==========================================
// 4. WEBHOOK INGESTION (EDGE IOT)
// ==========================================

app.post('/api/webhooks/vision', (req, res) => {
    const { parkId, zone, type, subType, confidence, description, location } = req.body;
    console.log(`[Vision Ingest] Processing ${subType} in ${parkId} sector ${zone}`);
    processEvent({
        id: `CAM-${Date.now()}`,
        type: type || 'CAMERA',
        subType, zone, confidence, description, location, parkId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        priority: confidence > 0.8 ? 'HIGH' : 'ELEVATED'
    });
    res.status(200).json({ success: true, message: 'Ingest successful' });
});

app.post('/api/webhooks/acoustic', (req, res) => {
    const { parkId, zone, type, subType, confidence, description, location } = req.body;
    console.log(`[Acoustic Ingest] Processing ${subType} in ${parkId} sector ${zone}`);
    processEvent({
        id: `ACO-${Date.now()}`,
        type: type || 'ACOUSTIC',
        subType, zone, confidence, description, location, parkId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        priority: 'HIGH'
    });
    res.status(200).json({ success: true });
});

app.post('/api/webhooks/community', (req, res) => {
    const { parkId, zone, type, subType, description, location } = req.body;
    console.log(`[Community Ingest] Processing ${subType} in ${parkId} sector ${zone}`);
    processEvent({
        id: `COM-${Date.now()}`,
        type: type || 'COMMUNITY',
        subType, zone, description, location, parkId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        priority: 'ELEVATED'
    });
    res.status(200).json({ success: true });
});

app.post('/api/webhooks/clear', (req, res) => {
    console.log(`[Admin Command] Force clearing hardware state and correlation memory.`);
    recentAlerts = [];
    broadcastEvent('CLEAR_FEED', {});
    res.status(200).json({ success: true });
});

// ==========================================
// 5. FAUNA CATALOG & 24H SPOTTINGS (PERSISTENT)
// ==========================================

app.get('/api/fauna/:parkId', (req, res) => {
    const { parkId } = req.params;
    faunaStore = readJsonSafe(FAUNA_FILE, faunaStore || {});
    const list = faunaStore[parkId] || [];
    res.json(list);
});

app.post('/api/fauna/:parkId', (req, res) => {
    const { parkId } = req.params;
    const { commonName, scientificName, estimatedCount, status, notes, citation } = req.body || {};
    faunaStore = readJsonSafe(FAUNA_FILE, faunaStore || {});
    const entry = {
        id: `${parkId}-${Date.now()}`,
        parkId,
        commonName,
        scientificName,
        estimatedCount: Number(estimatedCount) || 0,
        status: status || '',
        notes: notes || '',
        citation: citation || ''
    };
    faunaStore[parkId] = [...(faunaStore[parkId] || []), entry];
    writeJsonSafe(FAUNA_FILE, faunaStore);
    res.status(201).json(entry);
});

app.put('/api/fauna/:parkId/:id', (req, res) => {
    const { parkId, id } = req.params;
    const { commonName, scientificName, estimatedCount, status, notes, citation } = req.body || {};
    faunaStore = readJsonSafe(FAUNA_FILE, faunaStore || {});
    const list = faunaStore[parkId] || [];
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) {
        return res.status(404).json({ error: 'Not found' });
    }
    const updated = {
        ...list[idx],
        commonName: commonName ?? list[idx].commonName,
        scientificName: scientificName ?? list[idx].scientificName,
        estimatedCount: estimatedCount != null ? Number(estimatedCount) || 0 : list[idx].estimatedCount,
        status: status ?? list[idx].status,
        notes: notes ?? list[idx].notes,
        citation: citation !== undefined ? citation : list[idx].citation
    };
    list[idx] = updated;
    faunaStore[parkId] = list;
    writeJsonSafe(FAUNA_FILE, faunaStore);
    res.json(updated);
});

app.delete('/api/fauna/:parkId/:id', (req, res) => {
    const { parkId, id } = req.params;
    faunaStore = readJsonSafe(FAUNA_FILE, faunaStore || {});
    const list = faunaStore[parkId] || [];
    const next = list.filter(e => e.id !== id);
    faunaStore[parkId] = next;
    writeJsonSafe(FAUNA_FILE, faunaStore);
    res.json({ success: true });
});

app.get('/api/spottings/:parkId', (req, res) => {
    const { parkId } = req.params;
    spottingsStore = readJsonSafe(SPOTTINGS_FILE, spottingsStore || {});
    const list = (spottingsStore[parkId] || []).filter(s => {
        const ts = new Date(s.timestamp).getTime();
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        return ts >= cutoff;
    });
    res.json(list);
});

app.get('/api/audio/:parkId', (req, res) => {
    const { parkId } = req.params;
    audioStore = readJsonSafe(AUDIO_FILE, audioStore || {});
    const list = audioStore[parkId] || [];
    res.json(list);
});

// Acoustic classification: deterministic by type, optional Open Router for recommended action
const ACOUSTIC_LABELS = {
    GUNSHOT: { label: 'Gunshot (High Confidence)', confidence: 0.96, threatLevel: 'THREAT' },
    CHAINSAW: { label: 'Chainsaw Detected', confidence: 0.93, threatLevel: 'THREAT' },
    VEHICLE: { label: 'Vehicle Engine', confidence: 0.88, threatLevel: 'THREAT' },
    TIGER_CALL: { label: 'Tiger Vocalization', confidence: 0.91, threatLevel: 'WILDLIFE' },
    ELEPHANT_CALL: { label: 'Elephant Call', confidence: 0.89, threatLevel: 'WILDLIFE' },
    AMBIENT: { label: 'Ambient Forest Soundscape', confidence: 0.82, threatLevel: 'AMBIENT' }
};
const ACOUSTIC_ACTIONS = {
    GUNSHOT: 'Treat as confirmed gunshot. Dispatch nearest ranger unit and cross-check camera traps in adjacent zones.',
    CHAINSAW: 'Possible illegal logging. Notify forestry staff and deploy patrol to triangulated coordinates.',
    VEHICLE: 'Unscheduled vehicle activity. Check authorized vehicle list and coordinate with gate staff.',
    TIGER_CALL: 'Predator vocalization detected. Log for behavior monitoring and avoid routing tourists into this sector.',
    ELEPHANT_CALL: 'Elephant herd presence likely. Caution heavy vehicles and maintain buffer from crop-field interfaces.',
    AMBIENT: 'No immediate threat. Use as calibration sample for sensor health checks.'
};

app.post('/api/analyze/audio', async (req, res) => {
    const { sampleId, sampleType, customLabel } = req.body || {};
    const type = sampleType || (sampleId && ACOUSTIC_LABELS[sampleId] ? sampleId : null) || 'AMBIENT';
    const meta = ACOUSTIC_LABELS[type] || ACOUSTIC_LABELS.AMBIENT;
    let recommendedAction = ACOUSTIC_ACTIONS[type] || ACOUSTIC_ACTIONS.AMBIENT;
    let source = 'fallback';

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + openRouterKey
                },
                body: JSON.stringify({
                    model: 'openai/gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You are a wildlife ranger acoustic analyst. Respond with exactly one short, actionable sentence: recommended action for the ranger given this sound classification. No preamble.'
                        },
                        {
                            role: 'user',
                            content: `Classified sound: ${meta.label}. Threat level: ${meta.threatLevel}. One sentence recommended action.`
                        }
                    ],
                    max_tokens: 80,
                    temperature: 0.3
                })
            });
            if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content?.trim();
                if (content) {
                    recommendedAction = content;
                    source = 'openrouter';
                }
            }
        } catch (err) {
            console.error('[Open Router] Audio recommendation error:', err);
        }
    }

    res.status(200).json({
        label: customLabel || meta.label,
        confidence: meta.confidence,
        threatLevel: meta.threatLevel,
        recommendedAction,
        source
    });
});

// ==========================================
// 6. AI CLASSIFICATION (VISION ENGINE WITH ROBUST FALLBACK)
// ==========================================

function simpleImageHash(base64) {
    let hash = 0;
    for (let i = 0; i < base64.length; i += Math.max(1, Math.floor(base64.length / 5000))) {
        hash = (hash * 31 + base64.charCodeAt(i)) >>> 0;
    }
    return hash;
}

const FALLBACK_SPECIES = [
    {
        label: 'Asian Elephant',
        scientific: 'Elephas maximus indicus',
        endangered: true,
        statusLabel: 'EN',
        baseDirective:
            'Large-bodied herbivore detected near tree line. Maintain buffer distance and route patrols around herd.'
    },
    {
        label: 'Bengal Tiger',
        scientific: 'Panthera tigris tigris',
        endangered: true,
        statusLabel: 'EN',
        baseDirective:
            'Apex predator detected. Notify research teams and avoid unnecessary disturbance in this sector.'
    },
    {
        label: 'Indian One-horned Rhinoceros',
        scientific: 'Rhinoceros unicornis',
        endangered: true,
        statusLabel: 'VU',
        baseDirective: 'Rhino presence confirmed. Cross-check with rhino monitoring team for collar or ear-notch ID.'
    },
    {
        label: 'African Lion',
        scientific: 'Panthera leo melanochaita',
        endangered: true,
        statusLabel: 'VU',
        baseDirective:
            'Lion pride activity detected. Coordinate with tour operators to enforce distance protocols.'
    },
    {
        label: 'African Wild Dog',
        scientific: 'Lycaon pictus',
        endangered: true,
        statusLabel: 'EN',
        baseDirective:
            'Endangered pack species detected. Log sighting to long-term carnivore monitoring database.'
    },
    {
        label: 'Unknown Subject',
        scientific: 'Subject scan required',
        endangered: false,
        statusLabel: 'SCAN',
        baseDirective:
            'Pattern does not match pre-trained profiles. Flag for manual review by ranger or biologist.'
    }
];

app.post('/api/analyze/vision', async (req, res) => {
    const { image, isManualUpload } = req.body || {};
    const clarifaiPat = process.env.CLARIFAI_PAT;

    if (image && clarifaiPat) {
        try {
            console.log(`[Logic Engine] Transmitting frame to Clarifai for Neural Classification...`);
            const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
            const raw = JSON.stringify({
                user_app_id: { user_id: 'clarifai', app_id: 'main' },
                inputs: [{ data: { image: { base64: base64Data } } }]
            });

            const response = await fetch(
                'https://api.clarifai.com/v2/models/general-image-recognition/versions/aa7f35c01e0642fda5cf400f543e7c40/outputs',
                {
                method: 'POST',
                    headers: { Accept: 'application/json', Authorization: 'Key ' + clarifaiPat },
                body: raw
                }
            );
            const data = await response.json();
            
            if (data.status && data.status.code === 10000) {
                const concepts = data.outputs[0].data.concepts;
                let topPrediction = concepts[0];
                const genericExcludes = ['wildlife', 'animal', 'nature', 'mammal', 'outdoors', 'tree', 'field'];
                
                for (const concept of concepts) {
                    if (!genericExcludes.includes(concept.name.toLowerCase()) && concept.value > 0.8) {
                        topPrediction = concept;
                        break;
                    }
                }
                
                const pn = topPrediction.name;
                const end = ['elephant', 'rhino', 'tiger', 'lion', 'pangolin'].some(t =>
                    pn.toLowerCase().includes(t)
                );

                return res.status(200).json({
                    success: true,
                    classification: pn.charAt(0).toUpperCase() + pn.slice(1),
                    scientificName: 'Auto-detected via Vanguard Logic',
                    confidence: topPrediction.value,
                    endangered: end,
                    statusLabel: 'LIVE',
                    directive: `Machine Intelligence classified subject as ${pn} with ${(topPrediction.value * 100).toFixed(
                        1
                    )}% confidence.`
                });
            }
        } catch (err) {
            console.error('[Vision API] Clarifai error:', err);
        }
    }

    // Try Hugging Face image classification when HF_TOKEN is set (no Clarifai or Clarifai failed)
    const hfToken = process.env.HF_TOKEN;
    if (image && hfToken) {
        try {
            console.log('[Logic Engine] Trying Hugging Face image classification...');
            const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
            const response = await fetch(
                'https://api-inference.huggingface.co/models/google/vit-base-patch16-224',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + hfToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ inputs: base64Data })
                }
            );
            if (response.ok) {
                const data = await response.json();
                const top = Array.isArray(data) ? data[0] : data;
                if (top && (top.label || top.score !== undefined)) {
                    const label = top.label || (Array.isArray(top) ? top[0]?.label : null);
                    const score = typeof top.score === 'number' ? top.score : (top[0]?.score ?? 0.85);
                    const labelStr = (label && (typeof label === 'string' ? label : label.class || label.label)) || 'Wildlife';
                    const end = ['elephant', 'rhino', 'tiger', 'lion', 'dog', 'cat', 'animal'].some(t =>
                        String(labelStr).toLowerCase().includes(t)
                    );
                    return res.status(200).json({
                        success: true,
                        classification: String(labelStr).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        scientificName: 'Classified via Hugging Face Vision',
                        confidence: score,
                        endangered: end,
                        statusLabel: end ? 'EN' : 'LC',
                        directive: `Hugging Face model classified subject as ${labelStr} with ${(score * 100).toFixed(1)}% confidence.`
                    });
                }
            }
        } catch (err) {
            console.error('[Vision API] Hugging Face error:', err);
        }
    }

    if (image) {
        console.log('[Logic Engine] Using local heuristic fallback for classification. Set CLARIFAI_PAT or HF_TOKEN for live AI.');
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const h = simpleImageHash(base64Data);
        const bucket = h % (FALLBACK_SPECIES.length - 1);
        const species = isManualUpload ? FALLBACK_SPECIES[bucket] : FALLBACK_SPECIES[0];
        const confidence = isManualUpload ? 0.75 + (h % 20) / 100 : 0.95;

        return res.status(200).json({
            success: true,
            classification: species.label,
            scientificName: species.scientific,
            confidence,
            endangered: species.endangered,
            statusLabel: species.statusLabel,
            directive: `${species.baseDirective} Vanguard confidence ${(confidence * 100).toFixed(1)}%.`
        });
    }

    res.status(200).json({
        success: false,
        message: 'No image payload supplied.'
    });
});

// ==========================================
// 6b. OPEN ROUTER – AI RECOMMENDED ACTIONS (optional, set OPENROUTER_API_KEY)
// ==========================================

app.post('/api/recommend-action', async (req, res) => {
    const { alertType, zone, parkName, context } = req.body || {};
    const key = process.env.OPENROUTER_API_KEY;
    const park = (parkName || 'this park').toString();
    const z = (zone || 'unknown zone').toString();
    const ctx = (context || '').toString();

    if (key) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + key
                },
                body: JSON.stringify({
                    model: 'openai/gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You are a wildlife ranger operations advisor. Respond with exactly one short, actionable sentence: the recommended action for the ranger (e.g. deploy unit, notify patrol, check camera). No preamble or quotes.'
                        },
                        {
                            role: 'user',
                            content: `Alert type: ${alertType || 'unknown'}. Zone: ${z}. Park: ${park}. ${ctx ? 'Context: ' + ctx : ''}`
                        }
                    ],
                    max_tokens: 80,
                    temperature: 0.3
                })
            });
            if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content?.trim();
                if (content) {
                    return res.status(200).json({ action: content, source: 'openrouter' });
                }
            }
        } catch (err) {
            console.error('[Open Router] Error:', err);
        }
    }

    const fallbacks = {
        GUNSHOT: `Deploy nearest ranger unit to ${z} and cross-check camera traps in adjacent zones.`,
        CHAINSAW: `Treat as possible illegal logging. Notify forestry staff and deploy patrol to triangulated coordinates in ${z}.`,
        VEHICLE_ENGINE: `Verify vehicle against authorized list and coordinate with gate staff; consider patrol to ${z}.`,
        HUMAN_PRESENCE: `Dispatch ranger to ${z} to verify and document; maintain alert level until cleared.`,
        SUSPICIOUS_VEHICLE: `Coordinate with checkpoint and deploy unit to intercept and identify vehicle in ${z}.`
    };
    const fallback = fallbacks[alertType?.toUpperCase()] || `Review alert in ${z} and deploy patrol if threat is confirmed.`;
    res.status(200).json({ action: fallback, source: 'fallback' });
});

// ==========================================
// 7. EXTERNAL ENVIRONMENTAL INTEGRATIONS (NASA/GBIF)
// ==========================================

function getLunarIllumination(lon = 0) {
    const timezoneOffsetMs = (lon / 15) * 3600 * 1000;
    const localNow = new Date(Date.now() + timezoneOffsetMs);
    const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime();
    const phase = ((localNow.getTime() - KNOWN_NEW_MOON) % (29.53059 * 24 * 60 * 60 * 1000)) / (29.53059 * 24 * 60 * 60 * 1000);
    return parseFloat(((1 - Math.cos(2 * Math.PI * phase)) / 2).toFixed(4));
}

function describeWeatherCode(code) {
    if (code === 0) return 'Clear sky';
    if (code <= 3) return 'Partly cloudy';
    if (code <= 49) return 'Foggy';
    if (code <= 67) return 'Rainy';
    if (code <= 99) return 'Thunderstorm';
    return 'Unknown';
}

function computeThreatMultiplier(lunar, wind, rain) {
    const darkness = 1 + (1 - lunar) * 0.8;
    const windM = wind > 30 ? 1.3 : wind > 15 ? 1.1 : 1.0;
    const rainM = rain > 70 ? 1.25 : rain > 40 ? 1.1 : 1.0;
    return parseFloat((darkness * windM * rainM).toFixed(2));
}

// Live Weather & Environmental Pulse
app.get('/api/environment/:lat/:lon', async (req, res) => {
    const { lat, lon } = req.params;
    try {
        const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,precipitation_probability,weather_code&timezone=auto`);
        const data = await resp.json();
        const cur = data.current;
        const lun = getLunarIllumination(parseFloat(lon));
        const threat = computeThreatMultiplier(lun, cur.wind_speed_10m, cur.precipitation_probability ?? 0);

        res.json({
            temperature: cur.temperature_2m,
            windSpeed: cur.wind_speed_10m,
            precipitationProbability: cur.precipitation_probability ?? 0,
            weatherDescription: describeWeatherCode(cur.weather_code),
            lunarIllumination: lun,
            threatMultiplier: threat,
            lastUpdated: new Date().toISOString(),
            dataSource: 'open-meteo'
        });
    } catch (err) {
        const lun = getLunarIllumination(parseFloat(lon));
        res.json({ 
            weatherDescription: 'Open-Meteo Offline',
            lunarIllumination: lun, 
            threatMultiplier: computeThreatMultiplier(lun, 0, 0), 
            fallback: true,
            dataSource: 'fallback'
        });
    }
});

// NASA Satellite Data Pull
app.get('/api/eonet/:lat/:lon', async (req, res) => {
    const { lat, lon } = req.params;
    try {
        console.log(`[NASA Pulse] Scraping satellite data for lat=${lat}, lon=${lon}`);
        const response = await fetch(`https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30`);
        const data = await response.json();
        const nearby = (data.events || []).filter(e => {
            const coords = e.geometry?.[0]?.coordinates;
            return coords && Math.abs(coords[1] - parseFloat(lat)) < 5 && Math.abs(coords[0] - parseFloat(lon)) < 5;
        });
        res.json({ total: nearby.length, events: nearby });
    } catch (err) { res.json({ total: 0, error: err.message }); }
});

// GBIF Biodiversity Scan
app.get('/api/gbif/:lat/:lon', async (req, res) => {
    const { lat, lon } = req.params;
    try {
        console.log(`[GBIF Pulse] Identifying local species presence near coordinates...`);
        const response = await fetch(`https://api.gbif.org/v1/occurrence/search?decimalLatitude=${parseFloat(lat)-0.5},${parseFloat(lat)+0.5}&decimalLongitude=${parseFloat(lon)-0.5},${parseFloat(lon)+0.5}&limit=5&hasCoordinate=true&basisOfRecord=HUMAN_OBSERVATION&year=2024,2025&kingdomKey=1`);
        const data = await response.json();
        const occurrences = (data.results || []).map(occ => ({ species: occ.species }));
        res.json({ occurrences, total: data.count || 0 });
    } catch (err) { res.json({ total: 0, error: err.message }); }
});

// ==========================================
// iNaturalist Live Sightings Proxy
// ==========================================
// Maps each park to its real-world coordinates and fetches research-grade
// wildlife observations from iNaturalist within a per-park radius.
// Returns data normalized to the Spotting interface used by SpeciesIntelPage
// and CameraFeedsPage. Proxied server-side to avoid browser CORS issues.

const PARK_COORDS = {
    'nagarhole':   { lat: 11.9833, lon: 76.1167, radius: 35 },
    'corbett':     { lat: 29.5300, lon: 78.7747, radius: 45 },
    'kaziranga':   { lat: 26.5775, lon: 93.1711, radius: 30 },
    'sundarbans':  { lat: 21.9497, lon: 88.9468, radius: 40 },
    'maasai-mara': { lat: -1.4061, lon: 35.1019, radius: 50 },
    'kruger':      { lat: -23.9884, lon: 31.5547, radius: 80 },
};

const ZONES = ['Z1','Z2','Z3','Z4','Z5','Z6','Z7','Z8'];

app.get('/api/inaturalist/:parkId', async (req, res) => {
    const { parkId } = req.params;
    const coords = PARK_COORDS[parkId];
    if (!coords) return res.status(404).json({ error: 'Unknown park' });

    try {
        console.log(`[iNaturalist] Fetching research-grade sightings for ${parkId}...`);
        // taxon_id=1 = Animalia (all animals). quality_grade=research = community-verified.
        const url = `https://api.inaturalist.org/v1/observations?lat=${coords.lat}&lng=${coords.lon}&radius=${coords.radius}&quality_grade=research&per_page=20&order=desc&order_by=observed_on&taxon_id=1`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'VanguardConservationPlatform/1.0 (conservation-research)' }
        });
        if (!response.ok) throw new Error(`iNaturalist returned ${response.status}`);
        const data = await response.json();

        const results = (data.results || [])
            .filter(obs => obs.taxon && obs.photos && obs.photos.length > 0)
            .slice(0, 12)
            .map((obs, i) => {
                const photo = obs.photos[0];
                // Replace "square" with "medium" for larger image (up to 500px)
                const imageUrl = (photo.url || '').replace('/square', '/medium').replace('square.', 'medium.');
                const commonName = obs.taxon.preferred_common_name || obs.taxon.name || 'Unknown Species';
                const scientificName = obs.taxon.name || '';
                const zone = ZONES[i % ZONES.length];
                // Determine day/night from observed_on time if available
                const hour = obs.time_observed_at
                    ? new Date(obs.time_observed_at).getHours()
                    : new Date(obs.observed_on).getHours();
                const visionMode = (hour >= 19 || hour < 6) ? 'NIGHT' : 'DAY';
                const timestamp = obs.observed_on
                    ? new Date(obs.observed_on).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : obs.created_at_details?.date || 'Unknown';
                const placeGuess = obs.place_guess || '';
                return {
                    id: `inat-${obs.id}`,
                    parkId,
                    speciesCommonName: commonName,
                    scientificName,
                    zone,
                    timestamp,
                    imageUrl,
                    visionMode,
                    placeGuess,
                    observationUrl: obs.uri,
                    observer: obs.user?.name || obs.user?.login || 'Citizen Scientist',
                };
            });

        console.log(`[iNaturalist] Returning ${results.length} sightings for ${parkId}`);
        res.json(results);
    } catch (err) {
        console.error(`[iNaturalist] Error for ${parkId}:`, err.message);
        res.status(503).json({ error: err.message, results: [] });
    }
});

// ==========================================
// Wikipedia Species Image Proxy
// ==========================================
// Uses the MediaWiki Action API (prop=pageimages) to get the lead
// thumbnail for a species article. Server-side proxy avoids CORS issues.
// /api/wiki-image/:species  → { imageUrl, pageTitle }

app.get('/api/wiki-image/:species', async (req, res) => {
    const { species } = req.params;
    const title = decodeURIComponent(species).replace(/ /g, '_');
    try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=400&format=json&origin=*`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'VanguardConservationPlatform/1.0' }
        });
        const data = await response.json();
        const pages = data?.query?.pages || {};
        const page = Object.values(pages)[0];
        const imageUrl = page?.thumbnail?.source || null;
        const pageTitle = page?.title || title;
        if (!imageUrl) return res.status(404).json({ imageUrl: null });
        res.json({ imageUrl, pageTitle });
    } catch (err) {
        res.status(503).json({ imageUrl: null, error: err.message });
    }
});

// ==========================================
// 7b. SELECTIVE ALERT MANAGEMENT
// ==========================================

// GET /api/alerts — returns current in-memory recentAlerts, optionally filtered by parkId
app.get('/api/alerts', (req, res) => {
    const { parkId } = req.query;
    const filtered = parkId
        ? recentAlerts.filter(a => !a.parkId || a.parkId === parkId)
        : recentAlerts;
    res.status(200).json({ alerts: filtered, total: filtered.length });
});

// POST /api/webhooks/purge-selected — removes specific alerts by ID and broadcasts
app.post('/api/webhooks/purge-selected', (req, res) => {
    const { ids, parkId } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: 'No alert IDs provided.' });
    }
    const idSet = new Set(ids);
    const before = recentAlerts.length;
    recentAlerts = recentAlerts.filter(a => !idSet.has(a.id));
    const removed = before - recentAlerts.length;
    broadcastEvent('SELECTIVE_PURGE', { ids: Array.from(idSet), parkId: parkId || null });
    console.log(`[Admin] Selective purge: removed ${removed} alert(s) for park ${parkId || 'all'}`);
    res.status(200).json({ success: true, removed, remaining: recentAlerts.length });
});

// ==========================================
// 7c. SENSOR SIMULATION ENGINE
// ==========================================
// Generates realistic sensor events in the background so the dashboard is
// always live even without physical hardware connected.
//
// Timings:  Acoustic   3–8 min  |  Camera   5–12 min  |  Community  8–15 min

const SIM_PARK_IDS = ['nagarhole', 'corbett', 'kaziranga', 'sundarbans', 'maasai-mara', 'kruger'];
const SIM_ZONES    = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8'];

function simRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function simBetween(minMs, maxMs) {
    return minMs + Math.random() * (maxMs - minMs);
}

/** Schedule a generator function to run repeatedly at random intervals. */
function scheduleSim(minMs, maxMs, generator) {
    const delay = simBetween(minMs, maxMs);
    setTimeout(() => {
        try { generator(); } catch (e) { console.error('[SIM] Error in simulation generator:', e); }
        scheduleSim(minMs, maxMs, generator);
    }, delay);
}

// ── Acoustic simulation (45s–90s) ──────────────────────────────────────────
scheduleSim(45 * 1000, 90 * 1000, () => {
    const parkId = simRandom(SIM_PARK_IDS);
    const zone   = simRandom(SIM_ZONES);
    const events = [
        { subType: 'GUNSHOT',        confidence: 0.87 + Math.random() * 0.12, description: 'Acoustic sensor detected high-caliber discharge pattern in restricted sector.' },
        { subType: 'CHAINSAW',       confidence: 0.84 + Math.random() * 0.12, description: 'Motorized cutting signature detected — possible illegal logging activity.' },
        { subType: 'VEHICLE_ENGINE', confidence: 0.80 + Math.random() * 0.12, description: 'Unscheduled vehicle engine signature recorded in restricted zone.' },
    ];
    const e = simRandom(events);
    const confidence = parseFloat(e.confidence.toFixed(2));
    processEvent({
        id:          `SIM-ACO-${Date.now()}`,
        type:        'ACOUSTIC',
        subType:     e.subType,
        zone,
        parkId,
        confidence,
        description: e.description,
        timestamp:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        priority:    'HIGH',
    });
    console.log(`[SIM] Acoustic ${e.subType} (conf ${confidence}) → ${parkId} ${zone}`);
});

// ── Camera trap simulation (60s–120s) ─────────────────────────────────────
scheduleSim(60 * 1000, 120 * 1000, () => {
    const parkId = simRandom(SIM_PARK_IDS);
    const zone   = simRandom(SIM_ZONES);
    const events = [
        { subType: 'SPECIES_DETECTED',   confidence: 0.80 + Math.random() * 0.18, description: 'Camera trap identified animal presence in patrol sector.',                                   priority: 'ELEVATED' },
        { subType: 'HUMAN_PRESENCE',     confidence: 0.82 + Math.random() * 0.14, description: 'Unidentified human figure detected by camera trap in restricted area.',                   priority: 'HIGH'     },
        { subType: 'BEHAVIORAL_ANOMALY', confidence: 0.74 + Math.random() * 0.16, description: 'Unusual animal behavioral pattern detected — possible stress or external disturbance.',   priority: 'ELEVATED' },
    ];
    const e = simRandom(events);
    const confidence = parseFloat(e.confidence.toFixed(2));
    processEvent({
        id:          `SIM-CAM-${Date.now()}`,
        type:        'CAMERA',
        subType:     e.subType,
        zone,
        parkId,
        confidence,
        description: e.description,
        timestamp:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        priority:    e.priority,
    });
    console.log(`[SIM] Camera ${e.subType} (conf ${confidence}) → ${parkId} ${zone}`);
});

// ── Community report simulation (90s–180s) ────────────────────────────────
scheduleSim(90 * 1000, 180 * 1000, () => {
    const parkId = simRandom(SIM_PARK_IDS);
    const zone   = simRandom(SIM_ZONES);
    const events = [
        { subType: 'SUSPICIOUS_VEHICLE', description: 'Community member reported unidentified vehicle near park boundary.' },
        { subType: 'SNARE_DETECTED',     description: 'Active wire snare line reported by local community patrol member.' },
        { subType: 'DEAD_ANIMAL',        description: 'Animal carcass discovered — possible poaching or disease event.' },
        { subType: 'POACHER_CAMP',       description: 'Evidence of recent illegal encampment found by community scout.' },
    ];
    const e = simRandom(events);
    processEvent({
        id:          `SIM-COM-${Date.now()}`,
        type:        'COMMUNITY',
        subType:     e.subType,
        zone,
        parkId,
        description: e.description,
        timestamp:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        priority:    'ELEVATED',
    });
    console.log(`[SIM] Community ${e.subType} → ${parkId} ${zone}`);
});

// ── Environment Pulse Simulation (30s) ──────────────────────────────────
// Keeps the Threat Matrix alive across all dashboards
scheduleSim(30 * 1000, 30 * 1000, async () => {
    try {
        // Broadcast updates for a rotating park to keep the data fresh
        const parkId = SIM_PARK_IDS[Math.floor(Date.now() / 30000) % SIM_PARK_IDS.length];
        const coords = PARK_COORDS[parkId];
        if (!coords) return;

        const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,wind_speed_10m,precipitation_probability,weather_code&timezone=auto`);
        const data = await resp.json();
        const cur = data.current;
        const lun = getLunarIllumination(coords.lon);
        const threat = computeThreatMultiplier(lun, cur.wind_speed_10m, cur.precipitation_probability ?? 0);

        broadcastEvent('ENVIRONMENT_UPDATE', {
            parkId,
            temperature: cur.temperature_2m,
            windSpeed: cur.wind_speed_10m,
            precipitationProbability: cur.precipitation_probability ?? 0,
            weatherDescription: describeWeatherCode(cur.weather_code),
            lunarIllumination: lun,
            threatMultiplier: threat,
            lastUpdated: new Date().toISOString(),
            dataSource: 'open-meteo'
        });
    } catch (e) {}
});

console.log('[SIM] Sensor simulation engine armed — FAST MODE (45s-180s intervals)');

// ==========================================
// 8. CRITICAL HOUSING & ROUTING LOGIC (DO NOT MODIFY)
// ==========================================

// SPA Fallback: Must be below all API routes
// Uses Middleware mode to avoid Node 22 Path Errors
app.use((req, res, next) => {
    // Skip API routes so we don't accidentally serve HTML for Data
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Single Unified Port Ingress
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`VANGUARD PLATFORM SERVICE: ONLINE`);
    console.log(`ENVIRONMENT: CLOUD PRODUCTION`);
    console.log(`PORT: ${PORT}`);
    console.log(`========================================\n`);
});
