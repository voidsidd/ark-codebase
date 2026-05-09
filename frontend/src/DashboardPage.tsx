import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabaseClient';

interface ParkCard {
  id: string;
  name: string;
  country: string;
  department: string | null;
  zone_count: number;
}

interface EstateCard {
  id: string;
  name: string;
  area_ha: number | null;
}

export default function DashboardPage() {
  const { profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [parks, setParks] = useState<ParkCard[]>([]);
  const [estates, setEstates] = useState<EstateCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !profile) return;

    const load = async () => {
      setLoading(true);

      if (profile.role === 'super_admin') {
        // Super admin sees ALL parks
        const { data } = await supabase
          .from('parks')
          .select('id, name, country, department, zone_count')
          .order('country');
        setParks(data || []);
      } else if (profile.role === 'government') {
        // Government sees parks for their department only
        // RLS handles filtering, but we also filter client-side for safety
        const query = supabase
          .from('parks')
          .select('id, name, country, department, zone_count');

        if (profile.department) {
          query.eq('department', profile.department);
        }

        const { data } = await query.order('name');
        setParks(data || []);
      } else {
        // Private users see their own estates
        const { data } = await supabase
          .from('estates')
          .select('id, name, area_ha')
          .order('created_at', { ascending: false });
        setEstates(data || []);
      }

      setLoading(false);
    };
    load();
  }, [profile?.id, profile?.role, profile?.department, authLoading]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleDeleteEstate = async (id: string) => {
    // Optimistic removal
    setEstates(prev => prev.filter(e => e.id !== id));
    await supabase.from('estates').delete().eq('id', id);
  };

  if (authLoading || !profile) {
    return <div className="min-h-screen bg-vanguard-bg" />;
  }

  // Role badge config
  const roleBadge = {
    super_admin: { label: 'SUPER ADMIN', bg: 'bg-vanguard-camera/15', text: 'text-vanguard-camera', border: 'border-vanguard-camera/30' },
    government: { label: 'GOVERNMENT', bg: 'bg-vanguard-community/15', text: 'text-vanguard-community', border: 'border-vanguard-community/30' },
    private: { label: 'PRIVATE', bg: 'bg-vanguard-species/15', text: 'text-vanguard-species', border: 'border-vanguard-species/30' },
  }[profile.role];

  // Section title
  const sectionTitle = {
    super_admin: 'ALL PROTECTED AREAS',
    government: `${(profile.department || 'your').toUpperCase()} DEPARTMENT`,
    private: 'YOUR ESTATES',
  }[profile.role];

  const sectionSubtitle = {
    super_admin: 'System-wide overview across all departments',
    government: `National parks under ${profile.department || 'your'} jurisdiction`,
    private: 'Your private conservation estates',
  }[profile.role];

  return (
    <div className="min-h-screen bg-vanguard-bg text-white flex flex-col">
      {/* ─── Top Bar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-vanguard-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-vanguard-species animate-pulse" />
          <span className="font-sans font-bold text-sm tracking-[0.3em] text-white/80 uppercase">
            Vanguard
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-white/60">{profile.display_name}</span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-widest uppercase ${roleBadge.bg} ${roleBadge.text} border ${roleBadge.border}`}>
              {roleBadge.label}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="font-mono text-[10px] text-white/30 hover:text-vanguard-critical/80 tracking-widest transition-colors uppercase cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center px-6 py-12">
        <h2 className="font-sans text-2xl font-bold tracking-wider text-white/90 mb-2">
          {sectionTitle}
        </h2>
        <p className="font-mono text-xs text-white/30 tracking-wide mb-10">
          {sectionSubtitle}
        </p>

        {loading ? (
          <div className="flex flex-col items-center gap-3 mt-20">
            <div className="w-2.5 h-2.5 rounded-full bg-vanguard-species animate-pulse" />
            <span className="font-mono text-[10px] text-white/20 tracking-widest">LOADING AREAS</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl">

            {/* ─── Park cards (super_admin + government) ──── */}
            {(profile.role === 'super_admin' || profile.role === 'government') &&
              parks.map(park => (
                <ParkAreaCard
                  key={park.id}
                  name={park.name}
                  country={park.country}
                  department={park.department}
                  zoneCount={park.zone_count}
                  showDepartment={profile.role === 'super_admin'}
                  onClick={() => navigate(`/park/${park.id}`)}
                />
              ))
            }

            {/* ─── Estate cards (private) ─────────────────── */}
            {profile.role === 'private' && estates.map(estate => (
              <EstateAreaCard
                key={estate.id}
                id={estate.id}
                name={estate.name}
                areaHa={estate.area_ha}
                onClick={() => navigate(`/estate/${estate.id}`)}
                onEdit={() => navigate(`/estate/new?edit=${estate.id}`)}
                onDelete={() => handleDeleteEstate(estate.id)}
              />
            ))}

            {/* ─── Create New Estate (private only) ─────── */}
            {profile.role === 'private' && (
              <button
                onClick={() => navigate('/estate/new')}
                className="group flex flex-col items-center justify-center min-h-[180px] rounded border-2 border-dashed border-vanguard-border hover:border-vanguard-species/40 bg-transparent transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full border border-vanguard-border group-hover:border-vanguard-species/50 flex items-center justify-center mb-3 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30 group-hover:text-vanguard-species/70 transition-colors">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <span className="font-mono text-[10px] text-white/30 group-hover:text-vanguard-species/60 tracking-widest uppercase transition-colors">
                  Create New Estate
                </span>
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Park Card ─────────────────────────────────────────────────

interface ParkAreaCardProps {
  name: string;
  country: string;
  department: string | null;
  zoneCount: number;
  showDepartment: boolean;
  onClick: () => void;
}

function ParkAreaCard({ name, country, department, zoneCount, showDepartment, onClick }: ParkAreaCardProps) {
  return (
    <button
      onClick={onClick}
      className="group text-left p-5 rounded border border-vanguard-border hover:border-vanguard-species/30 bg-vanguard-panel/50 hover:bg-vanguard-panel transition-all cursor-pointer"
    >
      {/* Status dot + department badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-vanguard-species animate-pulse" />
          <span className="font-mono text-[9px] text-vanguard-species/70 tracking-widest uppercase">Live</span>
        </div>
        {showDepartment && department && (
          <span className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded bg-vanguard-community/10 text-vanguard-community/60 border border-vanguard-community/20">
            {department}
          </span>
        )}
      </div>

      <h3 className="font-sans text-base font-bold text-white/90 group-hover:text-white mb-1 tracking-wide transition-colors">
        {name}
      </h3>
      <p className="font-mono text-[10px] text-white/35 tracking-wide mb-4">{country}</p>
      <p className="font-mono text-[10px] text-white/20 tracking-wide">{zoneCount} zones</p>
    </button>
  );
}

// ─── Estate Card ───────────────────────────────────────────────

interface EstateAreaCardProps {
  id: string;
  name: string;
  areaHa: number | null;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function EstateAreaCard({ name, areaHa, onClick, onEdit, onDelete }: EstateAreaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className="w-full text-left p-5 rounded border border-vanguard-border hover:border-vanguard-species/30 bg-vanguard-panel/50 hover:bg-vanguard-panel transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-vanguard-species animate-pulse" />
          <span className="font-mono text-[9px] text-vanguard-species/70 tracking-widest uppercase">Live</span>
        </div>

        <h3 className="font-sans text-base font-bold text-white/90 group-hover:text-white mb-1 tracking-wide transition-colors">
          {name}
        </h3>
        <p className="font-mono text-[10px] text-white/35 tracking-wide mb-4">Private Estate</p>
        <p className="font-mono text-[10px] text-white/20 tracking-wide">
          {areaHa ? `${Math.round(areaHa)} ha` : 'No boundary'}
        </p>
      </button>

      {/* Three-dot menu */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
          onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
          className="w-7 h-7 flex items-center justify-center rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
          title="Options"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-[#1e2330] border border-vanguard-border rounded shadow-2xl z-50 overflow-hidden">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-mono text-white/70 hover:bg-vanguard-species/10 hover:text-vanguard-species transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Boundary
            </button>
            <div className="h-px bg-vanguard-border" />
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-mono text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              Delete Estate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
