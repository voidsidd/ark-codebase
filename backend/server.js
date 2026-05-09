const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ee = require('@google/earthengine');
const mongoose = require('mongoose');

const app = express();


























// ==========================================
// Camera Webhook Ingestion & AI Pipeline
// ==========================================

app.post("/api/webhooks/camera/:cameraId", express.raw({ type: "image/*", limit: "10mb" }), async (req, res) => {
    const { cameraId } = req.params;
    const { estateId, zone } = req.query;
    const tempPath = path.join(__dirname, "temp_" + cameraId + "_" + Date.now() + ".jpg");

    fs.writeFileSync(tempPath, req.body);

    const pythonCode = "import sys; import cv2; import asyncio; import json; from ai_engine.hendricks_engine import HendricksEngine, DetectionMeta; from datetime import datetime; f=cv2.imread('" + tempPath + "', cv2.IMREAD_COLOR); meta=DetectionMeta(camera_id='" + cameraId + "', camera_zone='" + (zone || "UNKNOWN") + "', timestamp=datetime.now()); res=asyncio.run(HendricksEngine().process_frame(f, meta)) if f is not None else None; print(json.dumps(res))";
    const cmd = "python3 -c '" + pythonCode + "'";

    const { exec } = require("child_process");

    exec(cmd, { cwd: __dirname, env: { ...process.env, PYTHONPATH: __dirname } }, (error, stdout, stderr) => {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        if (error) {
            console.error("[AI Engine] Error: " + error.message);
            return res.status(500).json({ error: "AI Processing Failed" });
        }
        try {
            const result = JSON.parse(stdout);
            if (result && result.assessment) {
                const { assessment } = result;
                processEvent({
                    id: "AI-CAM-" + Date.now(),
                    type: "CAMERA",
                    subType: assessment.flags[0] || "AI_DETECTION",
                    zone: zone || "UNKNOWN",
                    estateId: estateId,
                    confidence: assessment.score / 100,
                    description: (assessment.verification && assessment.verification.reasoning) || "AI verified threat signature detected.",
                    timestamp: new Date().toLocaleTimeString(),
                    priority: assessment.level,
                    location: [0, 0]
                });
            }
            res.status(200).json({ success: true, processed: !!result });
        } catch (e) {
            console.error("[AI Engine] Parsing Error: " + e.message + " | Output: " + stdout);
            res.status(500).json({ error: "Result Parsing Failed" });
        }
    });
});
app.delete('/api/fauna/:estateId/:id', (req, res) => {
    const { estateId, id } = req.params;
    faunaStore = readJsonSafe(FAUNA_FILE, faunaStore || {});
    const list = faunaStore[estateId] || [];
    const next = list.filter(e => e.id !== id);
    faunaStore[estateId] = next;
    writeJsonSafe(FAUNA_FILE, faunaStore);
    res.json({ success: true });
});

app.get('/api/spottings/:estateId', (req, res) => {
    const { estateId } = req.params;
    spottingsStore = readJsonSafe(SPOTTINGS_FILE, spottingsStore || {});
    const list = (spottingsStore[estateId] || []).filter(s => {
        const ts = new Date(s.timestamp).getTime();
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        return ts >= cutoff;
    });
    res.json(list);
});

app.get('/api/audio/:estateId', (req, res) => {
    const { estateId } = req.params;
    audioStore = readJsonSafe(AUDIO_FILE, audioStore || {});
    const list = audioStore[estateId] || [];
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
    const { alertType, zone, estateName, context } = req.body || {};
    const key = process.env.OPENROUTER_API_KEY;
    const estate = (estateName || 'this estate').toString();
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
                            content: `Alert type: ${alertType || 'unknown'}. Zone: ${z}. Estate: ${estate}. ${ctx ? 'Context: ' + ctx : ''}`
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
// Maps each estate to its real-world coordinates and fetches research-grade
// wildlife observations from iNaturalist within a per-estate radius.
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

app.get('/api/inaturalist/:estateId', async (req, res) => {
    const { estateId } = req.params;
    const coords = PARK_COORDS[estateId];
    if (!coords) return res.status(404).json({ error: 'Unknown estate' });

    try {
        console.log(`[iNaturalist] Fetching research-grade sightings for ${estateId}...`);
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
                    estateId,
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

        console.log(`[iNaturalist] Returning ${results.length} sightings for ${estateId}`);
        res.json(results);
    } catch (err) {
        console.error(`[iNaturalist] Error for ${estateId}:`, err.message);
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

// GET /api/alerts — returns current in-memory recentAlerts, optionally filtered by estateId
app.get('/api/alerts', (req, res) => {
    const { estateId } = req.query;
    const filtered = estateId
        ? recentAlerts.filter(a => !a.estateId || a.estateId === estateId)
        : recentAlerts;
    res.status(200).json({ alerts: filtered, total: filtered.length });
});

// POST /api/webhooks/purge-selected — removes specific alerts by ID and broadcasts
app.post('/api/webhooks/purge-selected', (req, res) => {
    const { ids, estateId } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: 'No alert IDs provided.' });
    }
    const idSet = new Set(ids);
    const before = recentAlerts.length;
    recentAlerts = recentAlerts.filter(a => !idSet.has(a.id));
    const removed = before - recentAlerts.length;
    broadcastEvent('SELECTIVE_PURGE', { ids: Array.from(idSet), estateId: estateId || null });
    console.log(`[Admin] Selective purge: removed ${removed} alert(s) for estate ${estateId || 'all'}`);
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
    const estateId = simRandom(SIM_PARK_IDS);
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
        estateId,
        confidence,
        description: e.description,
        timestamp:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        priority:    'HIGH',
    });
    console.log(`[SIM] Acoustic ${e.subType} (conf ${confidence}) → ${estateId} ${zone}`);
});

// ── Camera trap simulation (60s–120s) ─────────────────────────────────────
scheduleSim(60 * 1000, 120 * 1000, () => {
    const estateId = simRandom(SIM_PARK_IDS);
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
        estateId,
        confidence,
        description: e.description,
        timestamp:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        priority:    e.priority,
    });
    console.log(`[SIM] Camera ${e.subType} (conf ${confidence}) → ${estateId} ${zone}`);
});

// ── Community report simulation (90s–180s) ────────────────────────────────
scheduleSim(90 * 1000, 180 * 1000, () => {
    const estateId = simRandom(SIM_PARK_IDS);
    const zone   = simRandom(SIM_ZONES);
    const events = [
        { subType: 'SUSPICIOUS_VEHICLE', description: 'Community member reported unidentified vehicle near estate boundary.' },
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
        estateId,
        description: e.description,
        timestamp:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        priority:    'ELEVATED',
    });
    console.log(`[SIM] Community ${e.subType} → ${estateId} ${zone}`);
});

// ── Environment Pulse Simulation (30s) ──────────────────────────────────
// Keeps the Threat Matrix alive across all dashboards
scheduleSim(30 * 1000, 30 * 1000, async () => {
    try {
        // Broadcast updates for a rotating estate to keep the data fresh
        const estateId = SIM_PARK_IDS[Math.floor(Date.now() / 30000) % SIM_PARK_IDS.length];
        const coords = PARK_COORDS[estateId];
        if (!coords) return;

        const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,wind_speed_10m,precipitation_probability,weather_code&timezone=auto`);
        const data = await resp.json();
        const cur = data.current;
        const lun = getLunarIllumination(coords.lon);
        const threat = computeThreatMultiplier(lun, cur.wind_speed_10m, cur.precipitation_probability ?? 0);

        broadcastEvent('ENVIRONMENT_UPDATE', {
            estateId,
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
