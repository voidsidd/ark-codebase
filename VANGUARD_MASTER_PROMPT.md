# VANGUARD — COMPLETE SYSTEM ARCHITECTURE & IMPLEMENTATION PROMPT
## Master Context Document for AI Agent Handoff

---

## 0. PRIME DIRECTIVE

You are being handed a production-grade wildlife anti-poaching intelligence platform called **Vanguard**. This document is your complete source of truth. Every architectural decision, every data model, every UI pattern, every security constraint, every existing implementation detail is described here. You are expected to:

1. Understand the existing codebase without modifying anything that already works
2. Implement the features described in this document exactly as specified
3. Never break existing routing, interfaces, or data structures
4. Maintain the established aesthetic with zero deviation
5. Ask zero clarifying questions — all answers are in this document

Read every section completely before writing a single line of code.

---

## 1. PROJECT IDENTITY

**Vanguard** is an AI-powered wildlife anti-poaching intelligence platform. It is a SaaS product targeting estate owners — individuals, organisations, or landowners who manage protected land (wildlife reserves, sandalwood estates, forest conservancies, private game reserves). Every user is an "estate owner." There is no government/private split. There is no super-admin. Every account is equal in capability, differentiated only by what they choose to configure.

**Core value proposition:** Real-time threat detection through acoustic sensors, AI camera traps, community reporting, and One Health zoonotic monitoring — all converging into a single cinematic intelligence dashboard.

**Positioning:** "SMART with intelligence baked in" — SMART (Spatial Monitoring and Reporting Tool) is the world's leading conservation desktop tool. It is retrospective and manual. Vanguard is real-time, AI-native, and sensor-driven.

**Live deployment:** https://hackathon-demo-mark-4.onrender.com

---

## 2. FULL TECH STACK

### Frontend
- **Framework:** React 18 with TypeScript
- **Build tool:** Vite
- **Styling:** Tailwind CSS (utility classes only — no custom config beyond what exists)
- **Routing:** React Router v6 — all routes use the pattern `/park/:id` for existing dashboard
- **Map (existing):** Leaflet with react-leaflet for the 2D tactical map inside the park dashboard
- **Globe (existing, partially implemented):** Deck.gl — 3D WebGL globe, already initialised, needs the drawable polygon layer and fly-to animation completing
- **Icons:** lucide-react — unused imports cause TS6133 errors, always clean up
- **Fonts:** Syne (headings/body), IBM Plex Mono (monospace/data labels) — loaded via Google Fonts in component `<style>` tags
- **HTTP:** fetch API — no axios

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Real-time:** WebSocket (ws library) — live alert streaming to frontend
- **Database (current):** MongoDB Atlas — being migrated to Supabase
- **Database (target):** Supabase (PostgreSQL + PostGIS + Realtime + Auth + Storage)
- **Deployment:** Render

### Auth & Database (migration target)
- **Supabase Auth:** Email/password + Google OAuth + GitHub OAuth (all three must be supported)
- **Supabase Database:** PostgreSQL with PostGIS extension for geospatial polygon storage
- **Supabase Realtime:** Replaces WebSocket for live alert streaming
- **Supabase Row Level Security (RLS):** Every database query is gated by user identity — a user can only ever read/write their own estates and associated data
- **Supabase Storage:** For any uploaded assets (estate images, sensor photos)

---

## 3. ESTABLISHED DESIGN SYSTEM — NEVER DEVIATE

### Colour palette
```
Background:        #050608
Primary accent:    #10B981 (green)
Alert — Acoustic:  #EF4444 (red)
Alert — Camera:    #F59E0B (amber)
Alert — Community: #3B82F6 (blue)
Alert — Correlated:#EF4444 (red)
Alert — One Health:#8B5CF6 (purple)
Panel background:  rgba(255,255,255,0.025)
Panel border:      1px solid rgba(255,255,255,0.07)
Text primary:      #f0f4f0
Text muted:        rgba(240,244,240,0.45)
Dividers:          1px solid rgba(255,255,255,0.06)
```

### Typography rules
- **Syne 800** for all major headings — letter-spacing: -0.03em
- **Syne 400/500** for body text — minimum 15px, never smaller
- **IBM Plex Mono** for: timestamps, zone references, data labels, alert IDs, technical readouts, eyebrow labels
- **Playfair Display italic** for accent words within headlines (white, never green)
- Timestamp format: `1121HRS` — always military format
- Zone reference format: `GRID-DELTA-04` — always this pattern

### Component rules
- Cards: `rgba(255,255,255,0.025)` background, `1px solid rgba(255,255,255,0.07)` border, `border-radius: 16px` minimum
- No solid backgrounds on cards — always semi-transparent
- No box shadows — depth comes from borders and background tints only
- Buttons: primary = `#10B981` fill with `#050608` text; ghost = `rgba(255,255,255,0.05)` fill with `rgba(255,255,255,0.1)` border
- All hover transitions: `0.22s cubic-bezier(0.16,1,0.3,1)`
- Reveal animations: `opacity 0 → 1` + `translateY(28px → 0)` on scroll entry
- Right panel: `clamp(340px, 40%, 560px)` width — DO NOT CHANGE THIS VALUE EVER

### Alert type colour system
Every element on an alert card shares one colour token — the card's accent colour. Never mix colours within a single card.
```
ACOUSTIC    → #EF4444 (red)
CAMERA      → #F59E0B (amber)
COMMUNITY   → #3B82F6 (blue)
CORRELATED  → #EF4444 (red) + animate-pulse
ONE_HEALTH  → #8B5CF6 (purple)
```

---

## 4. EXISTING CODEBASE — COMPLETE FILE MAP

### Frontend (`frontend/src/`)

#### Marketing pages (public, no auth required)
- `MarketingHome.tsx` — full marketing homepage, Apple-quality, 10 sections, fully responsive
- `MarketingNav.tsx` — fixed nav, scroll-aware blur, `#10B981` CTA button
- `MarketingAbout.tsx` — about/mission page
- `MarketingPricing.tsx` — pricing page with hardware calculator slider

#### App shell
- `App.tsx` — root router, all route definitions live here, dashboard layout with collapsible right panel
- `main.tsx` — React entry point
- `index.css` — Tailwind directives + global animations (`particle-drift`, `load-bar`, scroll animations)
- `vite-env.d.ts` — Vite type declarations

#### Dashboard pages (auth required — will be gated post-migration)
- `LandingPage.tsx` — park selector grid with animated counters and particle effects (this becomes the Estate Dashboard in the new flow)
- `CameraFeedsPage.tsx` — camera feeds at `/park/:id/cameras`
- `SoundAnalysisPage.tsx` — sound analysis at `/park/:id/sound`
- `SpeciesIntelPage.tsx` — species intelligence page
- `RemoteController.tsx` — multi-estate command view with selective alert purge

#### Dashboard components (`frontend/src/components/`)
- `Header.tsx` — CSS grid layout (`grid-cols-[1fr_auto_1fr]`), no text overlap at 100% zoom
- `MapPanel.tsx` — Leaflet 2D tactical map, zone overlays, alert pins, Leaflet resize fix
- `AlertFeed.tsx` — real-time alert feed, DECODING animation, pulsing CRITICAL border glow, military timestamps
- `ZoneStatus.tsx` — zone status panel
- `QuickStats.tsx` — quick stats panel
- `EnvironmentPanel.tsx` — live weather/conditions per park
- `CommunityReportModal.tsx` — community incident reporting modal
- `CameraFeedsModal.tsx` — camera feeds modal (legacy, replaced by CameraFeedsPage)
- `SoundAnalysisModal.tsx` — sound analysis modal (legacy, replaced by SoundAnalysisPage)
- `VegetationPanel.tsx` — vegetation monitoring panel

#### Data & logic (`frontend/src/lib/`)
- `parksData.ts` — 6 parks with full zone polygon coordinates, gradients, accent colours, mock alerts — DO NOT MODIFY ZONE SHAPES OR ALERT INTERFACES
- `liveStream.ts` — WebSocket live alert streaming hook — will be replaced by Supabase Realtime
- `mockData.ts` — mock alert generation for demo/testing
- `zoneGenerator.ts` — generates zone polygon arrays per park using park centre coordinates

#### Backend (`backend/`)
- `server.js` — Express server, WebSocket, MongoDB Atlas connection, alert CRUD
- `data/audio.json` — audio classification training data
- `data/fauna.json` — species data
- `data/spottings.json` — sighting records

---

## 5. CRITICAL HARD RULES — NEVER VIOLATE

These rules exist because violations have broken the app in previous sessions. Treat them as inviolable constraints:

1. **NEVER modify zone polygon coordinates or the `AlertEvent` interface in `parksData.ts`** — these are the source of truth for all map rendering
2. **NEVER add `parkId` to the `AlertEvent` return object** — it is not part of the interface
3. **NEVER use `any` for TypeScript errors** — fix with `as import('./parksData').EventType` inline casts
4. **ALWAYS remove unused lucide-react imports** — they cause `TS6133` build errors that block compilation
5. **Leaflet ALWAYS needs `window.dispatchEvent(new Event('resize'))` via `requestAnimationFrame`** after any container resize — without this the map tiles do not redraw
6. **The right panel width `clamp(340px, 40%, 560px)` must never change** — the inner scroll container has `minWidth` set to prevent content squishing during transition
7. **RIGHT PANEL TRANSITION: `80ms ease-out`** — this is the tuned "premium snappy feel" duration, do not change it
8. **Alert cards use ONE colour token per card** — every element (icon, border, text accent, badge) uses the same colour as the alert type
9. **Military timestamps only** — format `1121HRS`, zone refs format `GRID-DELTA-04`
10. **Commit after every completed task** with a clear, descriptive message

### TypeScript patterns established
```typescript
// Correct cast for EventType
type: subType as import('./parksData').EventType

// Correct Leaflet resize trigger
const start = performance.now();
const duration = 80;
const tick = (now: number) => {
    window.dispatchEvent(new Event('resize'));
    if (now - start < duration) requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
```

---

## 6. DATA MODELS — SUPABASE SCHEMA (TARGET STATE)

This is the complete PostgreSQL schema that must be implemented in Supabase. Every table, column, relationship, and RLS policy is specified below.

### Enable required extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
```

### Table: `profiles`
Extends Supabase's built-in `auth.users` table. Created automatically on user signup via a database trigger.
```sql
CREATE TABLE profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email         TEXT NOT NULL,
    full_name     TEXT,
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Table: `estates`
One row per estate. Owned by one user. A user can have multiple estates.
```sql
CREATE TABLE estates (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    description      TEXT,
    -- PostGIS polygon for the drawn estate boundary
    boundary         GEOGRAPHY(POLYGON, 4326),
    -- Centre point for fly-to animation on Deck.gl
    center_lat       DOUBLE PRECISION,
    center_lng       DOUBLE PRECISION,
    -- Zoom level to fly to when this estate is selected
    default_zoom     INTEGER DEFAULT 12,
    -- User-defined accent colour for this estate (hex string)
    accent_color     TEXT DEFAULT '#10B981',
    -- Dashboard panel configuration — JSON object of panel visibility/order
    dashboard_config JSONB DEFAULT '{
        "panels": {
            "alertFeed":      {"visible": true,  "order": 1},
            "mapPanel":       {"visible": true,  "order": 2},
            "zoneStatus":     {"visible": true,  "order": 3},
            "quickStats":     {"visible": true,  "order": 4},
            "environmentPanel":{"visible": true, "order": 5},
            "speciesIntel":   {"visible": true,  "order": 6},
            "soundAnalysis":  {"visible": true,  "order": 7},
            "cameraFeeds":    {"visible": true,  "order": 8},
            "oneHealth":      {"visible": true,  "order": 9}
        }
    }'::jsonb,
    -- Feature flags — which modules are active for this estate
    features         JSONB DEFAULT '{
        "acousticDetection": true,
        "cameraTraps":       true,
        "communityReports":  true,
        "correlationEngine": true,
        "oneHealth":         true,
        "speciesIntel":      true,
        "soundAnalysis":     true,
        "environmentPanel":  true,
        "patrolDispatch":    false
    }'::jsonb,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS — users can only see and modify their own estates
ALTER TABLE estates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own estates"
    ON estates FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own estates"
    ON estates FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own estates"
    ON estates FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own estates"
    ON estates FOR DELETE USING (auth.uid() = owner_id);
```

### Table: `zones`
User-drawn zones within an estate. Each zone is a named polygon.
```sql
CREATE TABLE zones (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estate_id   UUID NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
    owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,                          -- e.g. "North Perimeter", "Watering Hole Alpha"
    description TEXT,
    boundary    GEOGRAPHY(POLYGON, 4326) NOT NULL,      -- PostGIS polygon
    color       TEXT DEFAULT '#10B981',                 -- zone accent colour
    zone_type   TEXT DEFAULT 'general',                 -- 'patrol', 'exclusion', 'sensor', 'general'
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own zones"
    ON zones FOR ALL USING (auth.uid() = owner_id);
```

### Table: `waypoints`
Named point markers placed on the estate map.
```sql
CREATE TABLE waypoints (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estate_id   UUID NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
    owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    -- elevation in metres, fetched from elevation API at point of creation
    elevation   DOUBLE PRECISION,
    -- coordinates string for display: "11.9833°N, 76.1167°E"
    coords_display TEXT,
    -- area of the zone this waypoint belongs to (optional FK)
    zone_id     UUID REFERENCES zones(id) ON DELETE SET NULL,
    marker_type TEXT DEFAULT 'general',   -- 'sensor', 'ranger_post', 'water', 'general'
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waypoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own waypoints"
    ON waypoints FOR ALL USING (auth.uid() = owner_id);
```

### Table: `sensors`
PHANTOM-X1 LITE hardware nodes registered to an estate.
```sql
CREATE TABLE sensors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estate_id       UUID NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
    owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    sensor_type     TEXT NOT NULL,    -- 'acoustic', 'camera', 'combined'
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    -- Webhook auth token — stored as bcrypt hash, never plain text
    token_hash      TEXT NOT NULL,
    -- Token status — 'active' | 'suspended' | 'revoked'
    token_status    TEXT DEFAULT 'active',
    -- Last heartbeat from the physical device
    last_seen       TIMESTAMPTZ,
    is_online       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sensors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sensors"
    ON sensors FOR ALL USING (auth.uid() = owner_id);
```

### Table: `alerts`
All alert events for all estates.
```sql
CREATE TABLE alerts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estate_id    UUID NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
    owner_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- Alert classification
    type         TEXT NOT NULL CHECK (type IN ('ACOUSTIC','CAMERA','COMMUNITY','CORRELATED','ONE_HEALTH')),
    sub_type     TEXT NOT NULL,
    priority     TEXT NOT NULL CHECK (priority IN ('NORMAL','ELEVATED','HIGH','CRITICAL')),
    zone_name    TEXT,
    description  TEXT NOT NULL,
    confidence   DOUBLE PRECISION CHECK (confidence BETWEEN 0 AND 1),
    lat          DOUBLE PRECISION,
    lng          DOUBLE PRECISION,
    -- Whether this is a seeded mock alert (excluded from auto-purge)
    is_mock      BOOLEAN DEFAULT FALSE,
    -- Whether this alert has been acknowledged by the dashboard operator
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    -- One Health specific
    is_one_health BOOLEAN DEFAULT FALSE,
    -- Timestamp in both formats
    occurred_at  TIMESTAMPTZ DEFAULT NOW(),
    -- Military format timestamp for display: '1121HRS'
    display_time TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own alerts"
    ON alerts FOR ALL USING (auth.uid() = owner_id);

-- Index for performance on the most common query pattern
CREATE INDEX idx_alerts_estate_created ON alerts(estate_id, created_at DESC);
CREATE INDEX idx_alerts_priority ON alerts(estate_id, priority);
```

### Table: `remote_tokens`
Secure shareable tokens for the per-estate Remote Controller.
```sql
CREATE TABLE remote_tokens (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estate_id     UUID NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
    owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- The actual token value — a cryptographically random 48-byte hex string
    -- This is stored as a bcrypt hash. The plain value is only shown ONCE at generation.
    token_hash    TEXT NOT NULL,
    -- Human-readable label for the token
    label         TEXT DEFAULT 'Remote Access Token',
    -- Optional expiry — null means never expires
    expires_at    TIMESTAMPTZ,
    -- Last used timestamp for audit
    last_used_at  TIMESTAMPTZ,
    -- Whether this token is currently active
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE remote_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own remote tokens"
    ON remote_tokens FOR ALL USING (auth.uid() = owner_id);
```

---

## 7. APPLICATION FLOW — COMPLETE USER JOURNEY

### 7.1 New User Flow (first-time signup)

```
Marketing Site (MarketingHome.tsx)
    ↓ clicks "Open Platform" or "Sign Up"
Auth Page (/auth)
    → Supabase Auth UI: email/password OR Google OAuth OR GitHub OAuth
    → On success: Supabase creates auth.users row → trigger creates profiles row
    ↓ redirected to
Estate Dashboard (/estates)
    → Empty state: large "Create Your First Estate" CTA with description
    → Background: subtle animated globe (Deck.gl, low opacity, non-interactive)
    ↓ clicks "Create New Estate"
Estate Creation Page (/estates/new)
    → 3-step wizard (see Section 7.3)
    → Minimum to proceed: name + boundary drawn + at least one zone marked
    → Optional: sensors, waypoints, features config, dashboard layout
    → On save: writes to estates table + zones table + waypoints table
    ↓ redirected to
Park Dashboard (/estates/:estateId/dashboard)
    → Full cinematic intelligence dashboard
    → Powered by Supabase Realtime for live alerts
    → All panels visible by default
```

### 7.2 Returning User Flow

```
Marketing Site OR direct URL
    ↓
Auth Page (/auth)
    → Already has session: auto-redirect to /estates
    ↓
Estate Dashboard (/estates)
    → Shows all user's estates as cards
    → Each card: estate name, zone count, sensor count, active alert count, last activity
    → "Create New Estate" button always visible top right
    ↓ clicks an estate card
Park Dashboard (/estates/:estateId/dashboard)
    ↓ clicks back / browser back
Estate Dashboard (/estates)
```

### 7.3 Estate Creation Wizard — Step by Step

The estate creation page is a 3-step wizard. Each step has a visible progress indicator. The user can go back to previous steps. They cannot skip estate creation entirely — it is a hard gate before the dashboard.

**Step 1 — Identity**
- Estate name (text input, required)
- Description (textarea, optional)
- Accent colour picker (preset swatches: green, red, amber, blue, purple, white)
- This step is complete when: name is filled

**Step 2 — Boundary & Zones (required — cannot proceed without this)**
- Full-screen Deck.gl globe
- Draw mode toolbar appears on left edge
- User draws the outer estate boundary first (polygon draw tool)
- After boundary is closed: globe auto-fits to the drawn boundary
- User then marks at least one zone inside the boundary (polygon draw tool, different colour)
- Each zone gets a name input that appears as a floating label above the polygon
- Optional: place waypoint markers (click to place, name prompt appears)
- Globe shows elevation data from Open-Elevation API for placed waypoints
- Coordinates (lat/lng) and calculated area display in a bottom HUD strip as user draws
- This step is complete when: boundary drawn AND at least one named zone exists

**Step 3 — Configuration (all optional — can be skipped and done later)**
- Feature toggles: each module (acoustic detection, camera traps, community reports, One Health, species intel, environment panel, patrol dispatch) can be toggled on/off
- Dashboard layout: drag-and-drop panel ordering preview
- Sensor registration: add PHANTOM-X1 LITE devices by entering their MAC address
- All of this is editable later from the dashboard settings

**On completion:**
- Saves estate + zones + waypoints to Supabase
- Shows a brief "Estate Created" success animation
- Auto-navigates to `/estates/:estateId/dashboard`

---

## 8. DECK.GL GLOBE — COMPLETE SPECIFICATION

### 8.1 What exists
The Deck.gl globe is already initialised in the codebase. A basic globe renders. The following needs to be implemented on top of it:

### 8.2 Globe layers to implement

**Layer 1: Base globe**
Already exists. Keep as-is.

**Layer 2: Estate boundary layer** (`PolygonLayer`)
```javascript
new PolygonLayer({
    id: 'estate-boundary',
    data: [estatePolygon],
    getPolygon: d => d.coordinates,
    getFillColor: [16, 185, 129, 20],      // #10B981 at 8% opacity
    getLineColor: [16, 185, 129, 200],     // #10B981 at 78% opacity
    getLineWidth: 3,
    lineWidthUnits: 'pixels',
    pickable: true,
})
```

**Layer 3: Zone layers** (`PolygonLayer` per zone)
Each zone is its own layer so it can be individually shown/hidden.
```javascript
new PolygonLayer({
    id: `zone-${zone.id}`,
    data: [zone],
    getPolygon: d => d.coordinates,
    getFillColor: hexToRGBA(zone.color, 30),
    getLineColor: hexToRGBA(zone.color, 180),
    getLineWidth: 2,
    lineWidthUnits: 'pixels',
    pickable: true,
    onClick: (info) => handleZoneClick(info.object),
})
```

**Layer 4: Waypoint markers** (`ScatterplotLayer`)
```javascript
new ScatterplotLayer({
    id: 'waypoints',
    data: waypoints,
    getPosition: d => [d.lng, d.lat, 0],
    getRadius: 8,
    radiusUnits: 'pixels',
    getFillColor: [16, 185, 129, 255],
    getLineColor: [5, 6, 8, 255],
    getLineWidth: 2,
    lineWidthUnits: 'pixels',
    pickable: true,
    onClick: (info) => handleWaypointClick(info.object),
})
```

**Layer 5: Alert pins** (`ScatterplotLayer`)
Pulsing dots for active alerts. Colour matches alert type.
```javascript
new ScatterplotLayer({
    id: 'alert-pins',
    data: activeAlerts,
    getPosition: d => [d.lng, d.lat, 0],
    getRadius: d => d.priority === 'CRITICAL' ? 14 : 10,
    radiusUnits: 'pixels',
    getFillColor: d => alertTypeToRGBA(d.type),
    pickable: true,
    onClick: (info) => handleAlertClick(info.object),
})
```

**Layer 6: Draw layer** (only active during estate creation)
Uses `@deck.gl/extensions` draw tools or a custom click-to-place polygon builder.

### 8.3 Fly-to animation
When a user selects an estate from the Estate Dashboard, the globe animates to that estate's boundary:
```javascript
// Use deck.gl's built-in viewState transition
setViewState({
    longitude: estate.center_lng,
    latitude: estate.center_lat,
    zoom: estate.default_zoom,
    pitch: 45,           // slight tilt for depth
    bearing: 0,
    transitionDuration: 2000,
    transitionInterpolator: new FlyToInterpolator({ speed: 1.5 }),
    transitionEasing: t => t * (2 - t),  // ease-out quad
});
```

### 8.4 Drawable polygon implementation
The draw tool during estate creation works as follows:

1. User clicks "Draw Boundary" button — draw mode activates
2. Each click on the globe places a vertex (rendered as a small dot)
3. Lines connect vertices in sequence (rendered as a `PathLayer`)
4. A double-click OR clicking the first vertex closes the polygon
5. On close: polygon is filled with `rgba(16,185,129,0.1)`, border `#10B981`
6. A floating input appears above the polygon: "Name this zone"
7. User types a name, hits Enter or clicks confirm
8. Zone is added to local state (not saved to Supabase until Step 3 "Save" is hit)
9. User can draw additional zones — each gets its own colour from the palette
10. User can click an existing polygon to select it → handles appear → drag to reshape
11. Undo/redo supported via a simple history stack in component state

### 8.5 Elevation and coordinate display
As the user draws or hovers over the globe, a HUD strip at the bottom of the globe shows:
```
LAT: 11.9833°N  ·  LNG: 76.1167°E  ·  ELEVATION: 847m  ·  AREA: 2,847 ha
```
- Lat/lng: from Deck.gl's `onHover` viewport unprojection
- Elevation: fetched from `https://api.open-elevation.com/api/v1/lookup?locations={lat},{lng}` — free, no API key
- Area: calculated from the polygon using the Shoelace formula adjusted for geographic coordinates (or use `@turf/area` from turf.js)

---

## 9. AUTH SYSTEM — COMPLETE SPECIFICATION

### 9.1 Supabase Auth configuration
Enable in Supabase dashboard:
- Email/password auth — enabled
- Google OAuth — enabled (requires Google Cloud Console OAuth 2.0 credentials)
- GitHub OAuth — enabled (requires GitHub OAuth App credentials)
- Email confirmation — enabled for new signups

### 9.2 Auth routes
```
/auth           → Login + Signup page (toggle between the two)
/auth/callback  → Supabase OAuth callback handler
/auth/reset     → Password reset page
```

### 9.3 Auth page design
The auth page maintains the Vanguard aesthetic exactly:
- Background: `#050608` with subtle radial `#10B981` glow
- Grid overlay: `rgba(255,255,255,0.02)` lines every 72px
- Three pulse rings in `rgba(16,185,129,0.12)` behind the form card
- Form card: `rgba(255,255,255,0.025)` background, `1px solid rgba(255,255,255,0.07)` border, `border-radius: 20px`
- Logo + "VANGUARD" wordmark above the form
- Toggle: "Sign In" / "Create Account" — smooth tab switch, no page reload
- Input fields: dark background, `#10B981` focus ring, IBM Plex Mono font for values
- Social buttons: Google + GitHub — icon + label, ghost style
- Divider: `— or continue with email —` in IBM Plex Mono muted
- Submit button: full-width, `#10B981` fill

### 9.4 Session management
```typescript
// Auth context — wraps entire app
const AuthContext = createContext<{
    user: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
}>(/* default */);

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;  // the Michelangelo hands loading screen
    if (!user) return <Navigate to="/auth" replace />;
    return <>{children}</>;
};
```

### 9.5 Route protection map
```
/                       → Public (MarketingHome)
/about                  → Public (MarketingAbout)
/pricing                → Public (MarketingPricing)
/auth                   → Public, redirect to /estates if already logged in
/auth/callback          → Public (OAuth handler)
/estates                → Protected (Estate Dashboard)
/estates/new            → Protected (Estate Creation)
/estates/:id/dashboard  → Protected (Park Dashboard)
/estates/:id/settings   → Protected (Estate Settings)
/remote/:token          → Public BUT token-gated (see Section 10)
/park/:id               → Legacy route — redirect to /estates/:id/dashboard
```

### 9.6 Loading screen
The loading screen (shown during auth checks and initial data loads) is the Michelangelo "Creation of Adam" image with an animated CSS spinner overlaid at the centre gap between the two fingertips:
```tsx
// Already implemented as LoadingScreen.tsx
// Image: /public/hands-loading.png
// Spinner: 28px, border 2.5px, white/0.9 top, white/0.15 rest, 0.9s linear infinite
```

---

## 10. REMOTE CONTROLLER — COMPLETE SECURITY SPECIFICATION

### 10.1 What it is
Every estate has a dedicated Remote Controller — a single-estate version of the existing `RemoteController.tsx`. It shows live alerts, zone status, quick stats, and allows alert acknowledgement and purge operations for that one estate only.

It is accessible via a secret URL that can be shared with rangers or field operators without giving them full dashboard access.

### 10.2 Security model — this is critical
The remote URL format is:
```
/remote/:token
```

Where `:token` is a **cryptographically random, 48-byte hex string** (96 characters). This means:
- 2^384 possible tokens
- Brute-forcing is computationally impossible
- Guessing by typing random letters is impossible
- The token is NOT the estate UUID — the estate UUID never appears in the URL

**Token generation:**
```javascript
// Node.js server-side
const crypto = require('crypto');
const plainToken = crypto.randomBytes(48).toString('hex');
// 96-character hex string — store hash, show plain once
const bcrypt = require('bcrypt');
const tokenHash = await bcrypt.hash(plainToken, 12);
// Store tokenHash in remote_tokens table
// Return plainToken to user — this is the only time they see it
```

**Token verification on route access:**
```javascript
// When /remote/:token is accessed:
// 1. Fetch all active remote_tokens from Supabase (no user auth needed for this endpoint)
// 2. For each token, bcrypt.compare(incomingToken, storedHash)
// 3. If match found: load the associated estate's data
// 4. If no match: return 404 (not 401 — never confirm the route exists)
// 5. Update last_used_at on the matched token
// 6. Check expires_at — if expired, return 404
```

**Additional security measures:**
- Rate limiting: max 10 requests per minute per IP on `/remote/*` routes
- The remote page has NO link back to the main dashboard
- The remote page shows NO user account information
- The remote page is read-mostly — acknowledgement is allowed but no configuration changes
- Token can be revoked by the estate owner at any time from dashboard settings
- Tokens can optionally have an expiry date set by the owner

### 10.3 Remote Controller UI spec
Maintains the exact same cinematic intelligence terminal aesthetic as the existing `RemoteController.tsx`:
- Background: `#050608`
- Header: estate name + "REMOTE ACCESS" label in IBM Plex Mono + pulsing green LIVE dot
- Left panel: live alert feed for this estate only (real-time via Supabase Realtime, no auth token needed — uses the remote token as the access credential via a dedicated Supabase function)
- Right panel: zone status grid + quick stats
- Bottom: alert acknowledgement controls + selective purge
- No settings, no configuration, no navigation to other pages
- Mobile-optimised — rangers use this on phones in the field

### 10.4 Token management UI
In the estate dashboard settings page:
- "Remote Access" section
- "Generate New Token" button — generates token, shows it ONCE in a modal with copy button and warning: "This token will not be shown again"
- List of existing tokens: label, created date, last used date, expiry, active/inactive toggle, revoke button
- "Share Link" button copies `https://vanguard.app/remote/{plainToken}` to clipboard

---

## 11. ESTATE DASHBOARD — COMPLETE SPECIFICATION

### 11.1 What it is
The Estate Dashboard (`/estates`) is the authenticated home screen. It is the first thing a returning user sees after login. It lists all their estates and provides the entry point to create new ones.

### 11.2 Layout
- Full-screen dark background `#050608`
- Background: subtle non-interactive Deck.gl globe at low opacity (the same globe, just decorative)
- Fixed nav bar: Vanguard logo left, user avatar/name right with dropdown (Profile, Sign Out)
- Main content area: centred, max-width 1200px

### 11.3 Empty state (new user, no estates yet)
- Large eyebrow text in IBM Plex Mono: `VANGUARD INTELLIGENCE NETWORK`
- Headline: "Your estates await." in Syne 800
- Subtext: "Create your first protected area to begin real-time monitoring."
- Single CTA: "Create New Estate" button in `#10B981`
- Decorative: faint pulse rings behind the CTA

### 11.4 Estate cards (returning user with estates)
Each estate is shown as a card:
```
┌─────────────────────────────────────────┐
│  ● LIVE   [estate name]          →      │
│                                         │
│  [accent color bar across top]          │
│                                         │
│  12 zones  ·  47 sensors  ·  3 alerts  │
│                                         │
│  Last active: 2 minutes ago             │
└─────────────────────────────────────────┘
```
- Card: `rgba(255,255,255,0.025)` background, `1px solid rgba(255,255,255,0.07)` border
- Accent colour bar: 3px top border in the estate's `accent_color`
- Estate name: Syne 700, 18px
- Stats: IBM Plex Mono, muted
- LIVE dot: pulsing green `#10B981`
- On hover: lift `translateY(-4px)`, border becomes `rgba(accentColor, 0.3)`
- On click: fly-to animation on background globe → navigate to dashboard

### 11.5 "Create New Estate" button
Always visible, top right of the content area, persistent across empty and populated states.

---

## 12. PARK DASHBOARD — CUSTOMISATION SYSTEM

### 12.1 Panel visibility and ordering
Every panel in the dashboard is independently:
- **Visible** or **hidden** (persisted in `estates.dashboard_config`)
- **Ordered** (drag-and-drop reordering, order persisted in `estates.dashboard_config`)
- **Removable** — removing a panel hides it but doesn't delete data; it can be re-added from a "+ Add Panel" drawer

The `dashboard_config` JSONB column stores the state. On dashboard load, the layout is read from Supabase and the panels render in the configured order.

### 12.2 Settings access
A gear icon in the Header opens an estate settings drawer (slides in from right, over the dashboard):
- **Estate Identity:** name, description, accent colour — all editable
- **Boundary & Zones:** opens the globe editor in edit mode — user can reshape boundary, add/rename/delete zones, add/delete waypoints
- **Features:** toggle each module on/off
- **Dashboard Layout:** drag-and-drop panel ordering
- **Sensors:** register/deregister PHANTOM-X1 devices
- **Remote Access:** token management (see Section 10.4)
- **Danger Zone:** delete estate (requires typing estate name to confirm)

### 12.3 Feature toggles effect
When a feature is toggled OFF:
- Its panel is hidden from the dashboard
- Its nav links (camera, sound, species) are hidden from the Header
- Its data is still collected in the background (sensors still stream)
- It can be re-enabled at any time — historical data is not lost

---

## 13. SUPABASE REALTIME — REPLACING WEBSOCKET

### 13.1 Current state
`liveStream.ts` uses a WebSocket connection to the Express backend to stream alerts. This will be replaced by Supabase Realtime, which listens directly to PostgreSQL changes.

### 13.2 Target implementation
```typescript
// In liveStream.ts — replace the WebSocket implementation with:
const channel = supabase
    .channel(`alerts:${estateId}`)
    .on(
        'postgres_changes',
        {
            event: 'INSERT',
            schema: 'public',
            table: 'alerts',
            filter: `estate_id=eq.${estateId}`,
        },
        (payload) => {
            const newAlert = payload.new as Alert;
            // Map Supabase row to AlertEvent interface
            const alertEvent: AlertEvent = {
                id: newAlert.id,
                type: newAlert.type as EventType,
                subType: newAlert.sub_type,
                zone: newAlert.zone_name || 'UNKNOWN',
                timestamp: newAlert.display_time || formatMilitary(newAlert.occurred_at),
                confidence: newAlert.confidence,
                description: newAlert.description,
                priority: newAlert.priority as PriorityLevel,
                location: [newAlert.lat || 0, newAlert.lng || 0],
                isOneHealth: newAlert.is_one_health,
            };
            onNewAlert(alertEvent);
        }
    )
    .subscribe();

return () => supabase.removeChannel(channel);
```

### 13.3 Remote Controller realtime (no auth)
For the `/remote/:token` page, alerts stream via a Supabase Edge Function that validates the token and returns a channel subscription — the remote client never has a Supabase auth session.

---

## 14. BACKEND MIGRATION — MONGODB → SUPABASE

### 14.1 What moves
| Current (MongoDB) | Target (Supabase) |
|---|---|
| alerts collection | alerts table |
| Park config (hardcoded in parksData.ts) | estates + zones tables |
| WebSocket server | Supabase Realtime |
| Manual auth (if any) | Supabase Auth |
| Sensor webhook tokens (plain text) | sensors.token_hash (bcrypt) |

### 14.2 What stays in Express backend
The Express backend (`server.js`) is kept for:
- Sensor webhook ingestion endpoint: `POST /api/sensor/event` — receives data from PHANTOM-X1 devices, validates token hash, inserts to Supabase `alerts` table
- Any CPU-intensive processing that shouldn't run client-side
- CORS configuration

### 14.3 Sensor webhook flow
```
PHANTOM-X1 device
    → POST /api/sensor/event
    → Headers: { Authorization: "Bearer {plainToken}" }
    → Body: { sensorId, type, subType, confidence, lat, lng, description }
    ↓
Express server:
    1. Extract token from Authorization header
    2. Query sensors table: SELECT token_hash, estate_id, token_status WHERE id = sensorId
    3. bcrypt.compare(incomingToken, storedHash)
    4. If status = 'suspended': return 403
    5. If hash mismatch: return 401
    6. Insert new alert into Supabase alerts table
    7. Supabase Realtime propagates to all connected dashboards automatically
    8. Update sensors.last_seen and sensors.is_online
    ↓
All connected dashboard clients receive the alert via Supabase Realtime channel
```

---

## 15. IMPLEMENTATION PRIORITY ORDER

Execute in this exact sequence. Do not start the next item until the current one is complete and committed.

1. **Supabase project setup** — create project, enable PostGIS, run schema migrations, configure RLS policies
2. **Auth system** — Supabase Auth integration, auth page UI, session management, protected routes, loading screen
3. **Estate Dashboard** — `/estates` page, empty state, estate cards, navigation
4. **Estate Creation Wizard** — 3-step wizard, Deck.gl draw tools, save to Supabase
5. **Deck.gl layers** — estate boundary, zones, waypoints, alert pins, fly-to animation, elevation HUD
6. **Park Dashboard migration** — replace hardcoded park data with dynamic estate data from Supabase, panel config system
7. **Supabase Realtime** — replace WebSocket with Realtime channels
8. **Dashboard customisation** — panel show/hide/reorder, feature toggles, settings drawer
9. **Remote Controller** — token generation, `/remote/:token` route, token validation, remote UI, Realtime without auth
10. **Backend migration** — sensor webhook endpoint with bcrypt token validation, MongoDB decommission
11. **Estate settings** — full settings drawer, zone editing on globe, sensor management, token management
12. **Polish** — loading states, error states, empty states, transitions, mobile responsiveness

---

## 16. WHAT YOU MUST NEVER DO

1. Do not change the visual design, colour tokens, or typography — any deviation from Section 3 is a failure
2. Do not modify `parksData.ts` zone coordinates or the `AlertEvent` interface shape
3. Do not add `parkId` to `AlertEvent` return objects
4. Do not use `any` in TypeScript — use proper casts
5. Do not leave unused lucide-react imports — they break the build
6. Do not call `window.dispatchEvent(new Event('resize'))` outside of a `requestAnimationFrame` loop with the 80ms duration
7. Do not change the right panel width from `clamp(340px, 40%, 560px)`
8. Do not store sensor tokens or remote access tokens in plain text — always bcrypt hash before persisting
9. Do not expose the estate UUID in the remote controller URL
10. Do not return 401 on invalid remote tokens — always return 404 to avoid confirming route existence
11. Do not break existing routes `/park/:id` — they must continue working (redirect to `/estates/:id/dashboard`)
12. Do not remove the mock alert system — it is used for demo/training mode
13. Do not commit without a clear descriptive commit message
14. Do not start item N+1 before item N is complete, committed, and verified working

---

## 17. ENVIRONMENT VARIABLES REQUIRED

```env
# Frontend (.env in /frontend)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend (.env in /backend)
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key  # never expose client-side
BCRYPT_ROUNDS=12
PORT=3001
```

---

## 18. FINAL INSTRUCTION

You now have complete knowledge of this system. You understand the existing codebase, the target architecture, every data model, every security constraint, every UI pattern, every hard rule, and the exact sequence in which to implement everything.

Begin with item 1 in Section 15. Read the relevant sections for that item before writing any code. Commit when done. Then proceed to item 2.

The standard is Apple-level quality. Every interaction should feel intentional, smooth, and premium. Every edge case should be handled. Every error state should be designed. Every loading state should be the Michelangelo hands screen.

Do not deviate. Do not improvise on design. Do not skip steps. Ship it.
