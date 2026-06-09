import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabaseClient';

interface EstateCard {
  id: string;
  name: string;
  area_ha: number | null;
}

export default function DashboardPage() {
  const { profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [estates, setEstates] = useState<EstateCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !profile) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('estates')
        .select('id, name, area_ha')
        .order('created_at', { ascending: false });
      setEstates(data || []);
      setLoading(false);
    };
    load();
  }, [profile?.id, authLoading]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleDeleteEstate = async (id: string) => {
    setEstates((prev) => prev.filter((e) => e.id !== id));
    await supabase.from('estates').delete().eq('id', id);
  };

  if (authLoading || !profile || loading) {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center">
        <span className="font-mono text-xs text-white/30 tracking-widest animate-pulse">
          LOADING SYSTEM COMMAND...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050608] text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-sans font-bold text-sm tracking-[0.3em] text-white/80 uppercase">
            Vanguard
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-white/60">{profile.display_name}</span>
          <button
            onClick={handleSignOut}
            className="font-mono text-[10px] text-white/30 hover:text-red-400 tracking-widest transition-all duration-80 uppercase cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center px-6 py-12">
        <h2 className="font-syne text-2xl font-bold tracking-wider text-white/90 mb-2 uppercase text-center">
          Your Estates
        </h2>
        <p className="font-mono text-[10px] text-white/20 tracking-[0.2em] mb-10 uppercase">
          Sovereign Intelligence Monitoring
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl">
          {estates.map((estate) => (
            <EstateAreaCard
              key={estate.id}
              id={estate.id}
              name={estate.name}
              areaHa={estate.area_ha}
              onClick={() => navigate('/estate/' + estate.id)}
              onEdit={() => navigate('/estate/new?edit=' + estate.id)}
              onDelete={() => handleDeleteEstate(estate.id)}
            />
          ))}
          <button
            onClick={() => navigate('/estate/new')}
            className="group flex flex-col items-center justify-center min-h-[180px] rounded-[24px] border border-dashed border-white/10 hover:border-emerald-500/40 bg-white/[0.01] transition-all duration-80 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full border border-white/10 group-hover:border-emerald-500/50 flex items-center justify-center mb-3 transition-all duration-80">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/30 group-hover:text-emerald-500/70"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span className="font-mono text-[9px] text-white/20 group-hover:text-emerald-500/60 tracking-[0.2em] uppercase">
              Activate New Estate
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}

function EstateAreaCard({ name, areaHa, onClick, onEdit, onDelete }: any) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className="w-full text-left p-6 rounded-[24px] border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-80 cursor-pointer"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[9px] text-emerald-500/70 tracking-[0.2em] uppercase">
            Live
          </span>
        </div>
        <h3 className="font-syne text-lg font-bold text-white/90 group-hover:text-white mb-1 tracking-wide">
          {name}
        </h3>
        <p className="font-mono text-[10px] text-white/30 tracking-wide uppercase">
          {areaHa ? Math.round(areaHa) + ' hectares' : 'Initializing boundary'}
        </p>
      </button>
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-80">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-white/40 hover:text-emerald-400 transition-all cursor-pointer"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all cursor-pointer"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
