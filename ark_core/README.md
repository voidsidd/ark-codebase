# Axon
Axon is a SOC intelligence layer for physical security operations.

It correlates SIEM-style text alerts from badge readers, door contacts, motion sensors, and camera metadata into pattern-aware incident reports using:
- Hindsight memory recall
- Cascadeflow model routing (Groq-backed)
- Real-time SSE streaming UI

## Features
- Live SIEM event queue
- Real-time streaming analysis updates (SSE)
- Memory correlation with recall graph visualization
- Severity-aware model routing for cost control
- Cost and latency sparklines
- Keyboard shortcuts + command palette

## Setup
1. Install dependencies:
   npm install
2. Create environment file:
   copy .env.example .env
3. Fill in API keys in `.env`
4. Start server:
   npm start
5. Open:
   http://localhost:3000

## Keyboard Shortcuts
- `R`: run next queued event
- `Shift + R`: run full queue
- `/`: open command palette
- `M`: focus memory graph

## API Endpoints
- `GET /api/events`
- `GET /api/stats`
- `GET /api/telemetry`
- `GET /api/reports`
- `GET /api/stream` (SSE)
- `POST /api/process` with `{ eventId }`
- `POST /api/process-all`
