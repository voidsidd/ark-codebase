# Architecture

## System Design
- **Monolithic but Decoupled Frontend/Backend**: The architecture features a clear client-server separation but is deployed as a single monolithic service where the Node/Express backend serves the built React frontend from `/dist` while simultaneously handling API requests.
- **Data Flow**: Frontend communicates with the backend via REST APIs and Server-Sent Events (SSE) for real-time updates. The backend occasionally queries external APIs (OpenRouter, HuggingFace, Clarifai, Open-Meteo) for telemetry and AI completion data.

## Server-Sent Events (SSE)
- A critical part of the architecture is the SSE endpoint (`/api/events`), which broadcasts hardware-level alerts (cameras, acoustics, community reports) sequentially to the connected React clients in real time.

## Vanguard Correlation Engine (VCE)
- The backend contains a custom logic block called the Vanguard Correlation Engine. When webhooks push new events to the backend, VCE correlates them based on the `zone` and `parkId`. 
- Combinations of distinct event types (e.g. Vision + Acoustic) escalate the event `priority` from HIGH to CRITICAL, dispatching a correlated alert.

## Data Persistence
- Ephemeral/File-System Storage: The backend uses basic `.json` files inside `backend/data` (e.g. `fauna.json`, `spottings.json`, `audio.json`) to persist state across basic restarts.
