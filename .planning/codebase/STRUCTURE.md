# Structure

## Directory Layout
- `/` - Root workspace
  - `package.json` - Root package.json for monorepo-style task running
  - `start-all.bat`, `start-backend.bat`, `start-frontend.bat` - Execution scripts
  - `backend/` - Express server and APIs
    - `server.js` - Massive monolithic entry point managing all server routes, SSE, and correlation logic
    - `data/` - Static JSON files for database
  - `frontend/` - React Application
    - `src/`
      - `components/` - Reusable UI components (Modals, MapPanel, Feed, etc.)
      - `lib/` - Utilities and mocked data (`liveStream.ts`, `mockData.ts`, `zoneGenerator.ts`)
      - `App.tsx` - Main app layout routing
      - `*Page.tsx` - Main views/pages (LandingPage, SoundAnalysisPage, etc.)
    - `dist/` - Production build (served by backend)

## Key Locations
- `backend/server.js`: The heart of the backend logic.
- `frontend/src/lib/liveStream.ts`: Manages SSE event consumption on the client side.
- `frontend/src/components/MapPanel.tsx`: Core map rendering based on Leaflet.
