import { useState, lazy, Suspense, Component, useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Header from './components/Header';
import MapPanel from './components/MapPanel';
import AlertFeed from './components/AlertFeed';
import ZoneStatus from './components/ZoneStatus';
import QuickStats from './components/QuickStats';
import EnvironmentPanel from './components/EnvironmentPanel';
import SpeciesIntelPage from './SpeciesIntelPage';
import CameraFeedsPage from './CameraFeedsPage';
import SoundAnalysisPage from './SoundAnalysisPage';
import CommunityReportModal from './components/CommunityReportModal';
import RemoteController from './RemoteController';
import ZoneManager from './components/ZoneManager';
import WildlifeTrackerPanel from './components/WildlifeTrackerPanel';
import AuthPage from './AuthPage';
import DashboardPage from './DashboardPage';
import MarketingPage from './MarketingPage';
import LoadingScreen from './components/shared/LoadingScreen';
import EstateIntelPage from './EstateIntelPage';
import { supabase } from './lib/supabaseClient';

const CreateEstatePage = lazy(() => import('./CreateEstatePage'));

// ─── Error Boundary ───────────────────────────────────────────
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-vanguard-bg flex flex-col items-center justify-center gap-4">
          <div className="font-mono text-xs text-vanguard-critical tracking-widest">PAGE ERROR</div>
          <div className="font-mono text-[10px] text-white/30 max-w-sm text-center">{this.state.error}</div>
          <button
            onClick={() => { this.setState({ error: null }); window.history.back(); }}
            className="font-mono text-[10px] text-white/40 hover:text-white/70 tracking-widest mt-4 cursor-pointer"
          >
            ← GO BACK
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Auth guard ───────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth();
    if (!loading && !isAuthenticated) return <Navigate to="/auth" replace />;
    return (
        <>
            {!loading && isAuthenticated && children}
            <LoadingScreen isLoading={loading} />
        </>
    );
}

// ─── Redirect authenticated users away from /auth ─────────────
function RedirectIfAuth({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth();
    if (!loading && isAuthenticated) return <Navigate to="/dashboard" replace />;
    return (
        <>
            {!loading && children}
            <LoadingScreen isLoading={loading} />
        </>
    );
}

const DashboardView = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { isGovernment } = useAuth();
    const [communityModalOpen, setCommunityModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
    const [panelCollapsed, setPanelCollapsed] = useState(false);

    const isEstate = location.pathname.startsWith('/estate/');

    const [estateBoundary, setEstateBoundary] = useState<{
        name: string;
        boundary: { type: string; coordinates: [number, number][][] } | null;
        centroid_lat: number | null;
        centroid_lon: number | null;
    } | null>(null);

    useEffect(() => {
        if (!isEstate || !id) return;
        supabase
            .from('estates')
            .select('name, boundary, centroid_lat, centroid_lon')
            .eq('id', id)
            .single()
            .then(({ data }) => {
                if (data) setEstateBoundary(data as any);
            });
    }, [id, isEstate]);

    if (!id) return <Navigate to="/dashboard" />;

    return (
        <div className="h-screen w-screen flex flex-col bg-vanguard-bg text-white overflow-hidden">
            <Header
                onBack={() => navigate('/dashboard')}
                parkId={isEstate ? (estateBoundary?.name ?? 'Estate') : id}
                onSpeciesIntel={() => {
                    if (isEstate) navigate(`/estate/${id}/species`);
                    else navigate(`/park/${id}/species`);
                }}
            />

            <div className="flex-1 flex flex-row overflow-hidden border-t border-vanguard-border">
                <div
                    className="h-full border-r border-vanguard-border flex flex-col relative bg-black transition-all duration-300"
                    style={{ width: panelCollapsed ? '100%' : '60%' }}
                >
                    <div className="absolute top-4 right-4 z-[1000] flex gap-2">
                        <button
                            onClick={() => setViewMode('2d')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                viewMode === '2d'
                                    ? 'bg-vanguard-camera text-[#0A0F1A]'
                                    : 'bg-black/50 text-white/70 hover:bg-black/70'
                            }`}
                        >
                            2D Map
                        </button>
                        <button
                            onClick={() => setViewMode('3d')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                viewMode === '3d'
                                    ? 'bg-vanguard-camera text-[#0A0F1A]'
                                    : 'bg-black/50 text-white/70 hover:bg-black/70'
                            }`}
                        >
                            3D Globe
                        </button>
                    </div>

                    {viewMode === '2d' ? (
                        <MapPanel parkId={isEstate ? null : id} estateBoundary={isEstate ? estateBoundary : null} />
                    ) : (
                        <ZoneManager parkId={isEstate ? null : id} estateBoundary={isEstate ? estateBoundary : null} />
                    )}

                    <div className="absolute bottom-6 left-6 z-[1000]">
                        <button
                            onClick={() => setCommunityModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-3 bg-vanguard-camera/90 border border-vanguard-camera shadow-xl shadow-vanguard-camera/20 hover:bg-vanguard-camera backdrop-blur text-[#0A0F1A] rounded-full font-bold font-syne tracking-widest text-xs transition-all hover:scale-105"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            SUBMIT COMMUNITY REPORT
                        </button>
                    </div>

                    <button
                        onClick={() => setPanelCollapsed(c => !c)}
                        title={panelCollapsed ? 'Expand Panel' : 'Collapse Panel'}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-[1100] w-5 h-12 flex items-center justify-center bg-vanguard-panel/80 border border-vanguard-border rounded-l hover:bg-vanguard-panel transition-colors"
                        style={{ transform: 'translateY(-50%)' }}
                    >
                        <svg
                            width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="rgba(255,255,255,0.4)" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: panelCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}
                        >
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                </div>

                <div
                    className="h-full flex flex-col bg-vanguard-bg overflow-y-auto custom-scrollbar transition-all duration-300 overflow-hidden"
                    style={{
                        width: panelCollapsed ? '0' : '40%',
                        minWidth: panelCollapsed ? '0' : undefined,
                        opacity: panelCollapsed ? 0 : 1,
                    }}
                >
                    <div className="flex flex-col min-h-max min-w-[320px]">
                        <div className="border-b border-vanguard-border">
                            <AlertFeed parkId={isEstate ? null : id} isEstate={isEstate} estateId={isEstate ? id : undefined} />
                        </div>
                        <div className="border-b border-vanguard-border">
                            <ZoneStatus parkId={id} />
                        </div>
                        <div className="bg-vanguard-bg border-t border-vanguard-border flex flex-col">
                            <div className="p-3 border-b border-vanguard-border shrink-0">
                                <EnvironmentPanel parkId={id} />
                            </div>
                            <div className="flex-1">
                                <QuickStats parkId={id} />
                            </div>
                            {isGovernment && <WildlifeTrackerPanel />}
                        </div>
                    </div>
                </div>
            </div>

            {communityModalOpen && (
                <CommunityReportModal parkId={id} onClose={() => setCommunityModalOpen(false)} />
            )}
        </div>
    );
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public marketing page — logged-in users skip to dashboard */}
                <Route path="/" element={
                    <RedirectIfAuth><MarketingPage /></RedirectIfAuth>
                } />

                {/* Auth */}
                <Route path="/auth" element={
                    <RedirectIfAuth><AuthPage /></RedirectIfAuth>
                } />

                {/* Protected routes */}
                <Route path="/dashboard" element={
                    <RequireAuth><DashboardPage /></RequireAuth>
                } />
                <Route path="/park/:id" element={
                    <RequireAuth><DashboardView /></RequireAuth>
                } />
                <Route path="/park/:id/species" element={
                    <RequireAuth><SpeciesIntelPage /></RequireAuth>
                } />
                <Route path="/estate/:id/species" element={
                    <RequireAuth><EstateIntelPage /></RequireAuth>
                } />
                <Route path="/park/:id/cameras" element={
                    <RequireAuth><CameraFeedsPage /></RequireAuth>
                } />
                <Route path="/park/:id/sound" element={
                    <RequireAuth><SoundAnalysisPage /></RequireAuth>
                } />
                <Route path="/remote/:token" element={
                    <RequireAuth><RemoteController /></RequireAuth>
                } />
                <Route path="/estate/new" element={
                    <RequireAuth>
                        <PageErrorBoundary>
                            <Suspense fallback={
                                <div className="min-h-screen bg-vanguard-bg flex items-center justify-center">
                                    <div className="font-mono text-[10px] text-white/30 tracking-widest animate-pulse">LOADING MAP ENGINE...</div>
                                </div>
                            }>
                                <CreateEstatePage />
                            </Suspense>
                        </PageErrorBoundary>
                    </RequireAuth>
                } />
                <Route path="/estate/:id" element={
                    <RequireAuth><DashboardView /></RequireAuth>
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
