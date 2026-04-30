# API Reference & Integrations

Vanguard is an orchestrator. It consumes data from a variety of first-class APIs to provide a unified intelligence layer.

## 1. AI & Machine Learning

### Vision Classification
- **Clarifai:** Primary vision API for species ID. Requires `CLARIFAI_PAT`.
- **HuggingFace Inference:** Fallback vision API using `google/vit-base-patch16-224`. Requires `HF_TOKEN`.

### Intelligence & Recommendations
- **OpenRouter:** Used for generating high-context ranger recommendations based on alert patterns.
- **Google Gemini:** Integrated into the "Species Intel" and "Estate Intel" pages for vision analysis of captured frames and biodiversity insights.

## 2. Environmental & Geospatial

### Satellite Overlays
- **Google Earth Engine (GEE):** Dynamically generates Sentinel-2 satellite tiles. Authenticated via service account key (JSON).
- **Cesium Ion:** Provides the base global 3D tileset and terrain. Requires `VITE_CESIUM_ION_TOKEN`.

### Live Telemetry
- **Open-Meteo:** Live weather and environmental data (Humidity, Wind Speed). No key required.
- **NASA EONET:** Real-time tracking of satellite-detected fire and thermal events near park coordinates.
- **GBIF (Global Biodiversity Information Facility):** Fetches real species occurrence data near park centroids.

## 3. Communication

### Webhooks
Vanguard provides open ingestion endpoints for hardware:
- `POST /api/webhooks/vision`: Camera trap triggers.
- `POST /api/webhooks/acoustic`: Acoustic sensor signals.
- `POST /api/webhooks/community`: Mobile community reports.

### Real-Time Transmission
- **SSE (Server-Sent Events):** `GET /api/events`. The frontend maintains a persistent connection to this stream for instantaneous alert updates without polling.
