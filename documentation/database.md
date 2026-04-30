# Database Schema & Data Integrity

Vanguard utilizes a hybrid storage strategy to balance high-integrity relational data (Supabase) with high-velocity telemetry data (MongoDB).

## 1. Supabase (PostgreSQL)

The primary ledger for users, estates, and structural park data.

### Core Tables:
- **`profiles`**: User metadata (ID, display_name, role). Roles: `government`, `private`.
- **`parks`**: Seeded government-protected areas. Contains `boundary` (GeoJSON).
- **`estates`**: Private user properties. Calculated fields: `area_ha`, `perimeter_km`.
- **`zones`**: Sub-sections of a Park or Estate where sensors are deployed.
- **`alerts`**: Historically logged incidents that require persistence.

### Key RPC Functions:
- **`analyze_estate_polygon`**: A PostGIS-powered function that computes area, perimeter, and centroids for GeoJSON polygons.
- **`handle_new_user`**: Triggered on Auth signup to auto-populate the profile.

## 2. MongoDB (Atlas)

The "hot" storage for dynamic zone state and real-time sensor mappings.

### Schema: `Zone`
```json
{
  "parkId": "string (index)",
  "name": "string",
  "latitude": "number",
  "longitude": "number",
  "radius": "number",
  "status": "enum: critical | warning | normal",
  "alerts": "number (count)",
  "createdAt": "date"
}
```

## 3. Local JSON Storage (The "Edge" Cache)

For the hackathon and high-speed demo performance, some static/mock data is stored locally in `backend/data/`:
- **`fauna.json`**: Biodiversity catalog with IUCN status and citations.
- **`spottings.json`**: Recent camera trap captures.
- **`audio.json`**: Recent acoustic detections.

---

### Critical Recovery Step:
If the Supabase instance is lost, you MUST run the SQL migrations located in `supabase/migrations/` in order (001 -> 002 -> 004). This will rebuild the entire relational structure and seed the initial park data.
