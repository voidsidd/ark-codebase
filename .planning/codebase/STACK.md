# Tech Stack

## Core Technologies
- **Runtime**: Node.js (>= 18.0.0)
- **Language**: TypeScript (Frontend) / JavaScript (Backend)
- **Package Manager**: npm

## Frontend (`frontend/`)
- **Framework**: React 18.2.0
- **Build Tool**: Vite 5.1.6
- **Styling**: TailwindCSS 3.4.1 (with `autoprefixer`, `clsx`, `tailwind-merge`)
- **Routing**: React Router DOM 6.22.3
- **Mapping**: Leaflet 1.9.4 & React-Leaflet 4.2.1
- **Charting**: Recharts 2.12.2
- **Icons**: Lucide React
- **Date Utilities**: date-fns

## Backend (`backend/`)
- **Framework**: Express 5.2.1
- **Middleware**: CORS 2.8.6
- **Data Persistence**: Local JSON files (in `backend/data/`)

## Infrastructure & Configuration
- **Monorepo Structure**: Separate `frontend/` and `backend/` directories with a `package.json` at root to allow starting both via root scripts.
- **Node built-in `fetch`**: Used in backend for external API integrations (Node 18+ requirement).
- **Environment Variables**: Managed locally via `.env` or system environment variables for API keys.
