# Rebuild Guide: From Zero to Vanguard

Follow these steps to rebuild the entire Vanguard ecosystem if your local environment is completely lost.

## Phase 1: Environment Preparation

1. **Install Prerequisites:**
   - Node.js v20+
   - Git
   - A Supabase Project (free tier is fine)
   - A MongoDB Atlas Cluster (M0 tier is fine)

2. **Clone and Install:**
   ```bash
   git clone https://github.com/itsmesid44/vanguard-one.git
   cd vanguard-one
   cd frontend && npm install
   cd ../backend && npm install
   ```

## Phase 2: Database Setup

1. **Supabase:**
   - Go to the Supabase SQL Editor.
   - Run the scripts in `supabase/migrations/` in order:
     - `001_initial_schema.sql`
     - `002_departments_and_superadmin.sql`
     - `004_intelligence_layer.sql`
   - Ensure the `analyze_estate_polygon` RPC is created.

2. **MongoDB Atlas:**
   - Create a database named `vanguard`.
   - Obtain your `MONGODB_URI`.

## Phase 3: Configuration (Secrets)

Create a `.env` file in `backend/` and `frontend/`.

**`backend/.env`:**
```env
MONGODB_URI=your_atlas_connection_string
CLARIFAI_PAT=your_pat
HF_TOKEN=your_huggingface_token
OPENROUTER_API_KEY=your_key
GEE_SERVICE_ACCOUNT_KEY='{...json_content...}'
PORT=5000
```

**`frontend/.env`:**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_CESIUM_ION_TOKEN=your_cesium_token
VITE_API_URL=http://localhost:5000
```

## Phase 4: Launching

**Local Development:**
- Root directory: Run `start-all.bat` (Windows) or:
  - `cd backend && npm run dev`
  - `cd frontend && npm run dev`

**Production Build:**
- Build the frontend: `cd frontend && npm run build`.
- The backend is configured to serve `frontend/dist` automatically.

## Phase 5: Troubleshooting (The "Gilfoyle" Fixes)

If the build fails on Render due to "Unused Variables" (TS6133):
- Ensure you have purged all files in `frontend/src/components/alerts/`, `frontend/src/components/map/`, and `frontend/src/pages/private/` that were part of the corrupted restructuring.
- Check `frontend/src/App.tsx` and ensure it imports components from the flat `src/components/` directory.
- Verify `LoadingScreen` is imported from `./components/shared/LoadingScreen` (inside `src`), not reaching outside to `../`.

---

**You are now back online. Get back to protecting the forest.**
