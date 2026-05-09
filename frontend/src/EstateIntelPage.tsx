import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Leaf, Plus, Trash2, Save, TreePine, IndianRupee, Edit3 } from 'lucide-react';
import Header from './components/Header';
import { supabase } from './lib/supabaseClient';
import { TreeInventoryEntry } from './services/evidenceReport';
import { loadInventory } from './components/PrivateAlertDetail';

// ─── Storage key (mirrors PrivateAlertDetail) ─────────────────────────────────
const INVENTORY_KEY = (estateId: string) => `vanguard_inventory_${estateId}`;

function saveInventory(estateId: string, entries: TreeInventoryEntry[]) {
  localStorage.setItem(INVENTORY_KEY(estateId), JSON.stringify(entries));
}

const SPECIES_PRESETS = ['Sandalwood', 'Agarwood', 'Teak', 'Rosewood', 'Bamboo', 'Mahogany'];

interface EditRow {
  zone: string;
  species: string;
  count: string;
  valuePerTree: string;
}

const EstateIntelPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [estateName, setEstateName] = useState('My Estate');
  const [inventory, setInventory] = useState<TreeInventoryEntry[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newRow, setNewRow] = useState<EditRow>({ zone: '', species: '', count: '', valuePerTree: '' });
  const [saved, setSaved] = useState(false);

  // Load estate name
  useEffect(() => {
    if (!id) return;
    supabase.from('estates').select('name').eq('id', id).single().then(({ data }) => {
      if (data?.name) setEstateName(data.name);
    });
  }, [id]);

  // Load inventory from localStorage
  useEffect(() => {
    if (!id) return;
    setInventory(loadInventory(id));
  }, [id]);

  const persist = (updated: TreeInventoryEntry[]) => {
    if (!id) return;
    setInventory(updated);
    saveInventory(id, updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddNew = () => {
    if (!newRow.zone.trim() || !newRow.species.trim()) return;
    const entry: TreeInventoryEntry = {
      zone: newRow.zone.trim(),
      species: newRow.species.trim(),
      count: parseInt(newRow.count) || 0,
      valuePerTree: parseInt(newRow.valuePerTree) || 0,
    };
    persist([...inventory, entry]);
    setNewRow({ zone: '', species: '', count: '', valuePerTree: '' });
    setAddingNew(false);
  };

  const handleDelete = (idx: number) => {
    persist(inventory.filter((_, i) => i !== idx));
  };

  const handleEdit = (idx: number, field: keyof TreeInventoryEntry, value: string) => {
    const updated = inventory.map((row, i) => {
      if (i !== idx) return row;
      if (field === 'count' || field === 'valuePerTree') {
        return { ...row, [field]: parseInt(value) || 0 };
      }
      return { ...row, [field]: value };
    });
    persist(updated);
  };

  const totalValue = inventory.reduce((s, r) => s + r.count * r.valuePerTree, 0);

  // Group by zone for display
  const zones = Array.from(new Set(inventory.map(r => r.zone))).sort();

  return (
    <div className="h-screen w-screen flex flex-col bg-vanguard-bg text-white overflow-hidden">
      <Header
        onBack={() => id ? navigate(`/estate/${id}`) : navigate('/dashboard')}
        backLabel="← BACK"
        parkId={estateName}
        onSpeciesIntel={() => {}}
      />

      <div className="flex-1 flex flex-col overflow-hidden border-t border-vanguard-border">
        {/* Sub-header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-vanguard-border bg-black/60">
          <div className="flex items-center gap-3">
            <Leaf className="w-5 h-5 text-green-400" />
            <div>
              <div className="text-xs font-mono tracking-[0.25em] text-gray-400 uppercase">
                Estate Intelligence
              </div>
              <div className="text-sm font-syne text-gray-300">
                Tree inventory for {estateName} — used in financial exposure calculations
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-[10px] font-mono text-green-400 tracking-widest animate-pulse">
                SAVED
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0A0F1A] p-5 space-y-5">
          {/* Estate value summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Tree Species', value: Array.from(new Set(inventory.map(r => r.species))).length.toString() },
              { label: 'Total Trees Logged', value: inventory.reduce((s, r) => s + r.count, 0).toLocaleString('en-IN') },
              { label: 'Total Estate Value', value: `₹${totalValue.toLocaleString('en-IN')}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-vanguard-panel border border-vanguard-border rounded-lg p-4">
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">{label}</div>
                <div className="text-xl font-bold font-syne text-white">{value}</div>
              </div>
            ))}
          </div>

          {/* Inventory table */}
          <div className="bg-vanguard-panel border border-vanguard-border rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-vanguard-border bg-black/40">
              <div className="flex items-center gap-2">
                <TreePine className="w-4 h-4 text-green-400" />
                <span className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">
                  Tree Inventory
                </span>
                <span className="text-[9px] font-mono text-white/25">
                  — {inventory.length} entries across {zones.length} zone{zones.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => setAddingNew(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono border border-green-500/40 text-green-400 rounded bg-green-950/40 hover:bg-green-950/80 transition-colors"
              >
                <Plus className="w-3 h-3" />
                ADD TREES
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1.2fr_80px_110px_110px_40px] gap-0 bg-black/60 border-b border-vanguard-border">
              {['Zone', 'Species', 'Trees', 'Value / Tree', 'Total Value', ''].map(h => (
                <div key={h} className="px-4 py-2 text-[9px] font-mono text-white/30 uppercase tracking-widest">
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {inventory.length === 0 && !addingNew ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <TreePine className="w-8 h-8 text-white/10 mb-3" />
                <div className="text-sm font-syne text-white/30">No trees logged yet</div>
                <div className="text-[10px] font-mono text-white/20 mt-1">
                  Add your tree inventory to enable financial exposure calculations in incident reports
                </div>
              </div>
            ) : (
              inventory.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_1.2fr_80px_110px_110px_40px] gap-0 border-b border-vanguard-border/50 hover:bg-black/20 transition-colors group"
                >
                  {/* Zone */}
                  <div className="px-4 py-3">
                    {editingIdx === idx ? (
                      <input
                        autoFocus
                        value={row.zone}
                        onChange={e => handleEdit(idx, 'zone', e.target.value)}
                        onBlur={() => setEditingIdx(null)}
                        className="w-full bg-black/60 border border-vanguard-border rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-green-500"
                      />
                    ) : (
                      <span className="text-xs font-mono text-white/70">{row.zone}</span>
                    )}
                  </div>

                  {/* Species */}
                  <div className="px-4 py-3">
                    {editingIdx === idx ? (
                      <select
                        value={SPECIES_PRESETS.includes(row.species) ? row.species : ''}
                        onChange={e => handleEdit(idx, 'species', e.target.value)}
                        className="w-full bg-black/60 border border-vanguard-border rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-green-500"
                      >
                        {SPECIES_PRESETS.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value={row.species}>{row.species}</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Leaf className="w-3 h-3 text-green-500/50 shrink-0" />
                        <span className="text-xs font-mono text-white/80">{row.species}</span>
                      </div>
                    )}
                  </div>

                  {/* Count */}
                  <div className="px-4 py-3">
                    {editingIdx === idx ? (
                      <input
                        type="number"
                        value={row.count}
                        onChange={e => handleEdit(idx, 'count', e.target.value)}
                        min={0}
                        className="w-full bg-black/60 border border-vanguard-border rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-green-500"
                      />
                    ) : (
                      <span className="text-xs font-mono text-white/60">{row.count.toLocaleString('en-IN')}</span>
                    )}
                  </div>

                  {/* Value per tree */}
                  <div className="px-4 py-3">
                    {editingIdx === idx ? (
                      <input
                        type="number"
                        value={row.valuePerTree}
                        onChange={e => handleEdit(idx, 'valuePerTree', e.target.value)}
                        min={0}
                        className="w-full bg-black/60 border border-vanguard-border rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-green-500"
                      />
                    ) : (
                      <span className="text-xs font-mono text-white/60">
                        ₹{row.valuePerTree.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>

                  {/* Total */}
                  <div className="px-4 py-3">
                    <span className="text-xs font-mono text-green-400 font-bold">
                      ₹{(row.count * row.valuePerTree).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="px-2 py-3 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                      className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white/70"
                      title="Edit"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(idx)}
                      className="p-1 rounded hover:bg-red-950/40 text-white/40 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Add new row */}
            {addingNew && (
              <div className="grid grid-cols-[1fr_1.2fr_80px_110px_110px_40px] gap-0 border-b border-green-500/20 bg-green-950/10 p-1">
                <div className="px-3">
                  <input
                    autoFocus
                    value={newRow.zone}
                    onChange={e => setNewRow(p => ({ ...p, zone: e.target.value }))}
                    placeholder="Zone name"
                    className="w-full bg-black/60 border border-vanguard-border rounded px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-green-500 placeholder:text-white/20"
                  />
                </div>
                <div className="px-3">
                  <select
                    value={newRow.species}
                    onChange={e => setNewRow(p => ({ ...p, species: e.target.value }))}
                    className="w-full bg-black/60 border border-vanguard-border rounded px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-green-500"
                  >
                    <option value="">Select species</option>
                    {SPECIES_PRESETS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="px-3">
                  <input
                    type="number"
                    value={newRow.count}
                    onChange={e => setNewRow(p => ({ ...p, count: e.target.value }))}
                    placeholder="0"
                    min={0}
                    className="w-full bg-black/60 border border-vanguard-border rounded px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-green-500 placeholder:text-white/20"
                  />
                </div>
                <div className="px-3">
                  <input
                    type="number"
                    value={newRow.valuePerTree}
                    onChange={e => setNewRow(p => ({ ...p, valuePerTree: e.target.value }))}
                    placeholder="₹ per tree"
                    min={0}
                    className="w-full bg-black/60 border border-vanguard-border rounded px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-green-500 placeholder:text-white/20"
                  />
                </div>
                <div className="px-3 flex items-center">
                  <span className="text-xs font-mono text-white/30">
                    {newRow.count && newRow.valuePerTree
                      ? `₹${(parseInt(newRow.count) * parseInt(newRow.valuePerTree)).toLocaleString('en-IN')}`
                      : '—'
                    }
                  </span>
                </div>
                <div className="px-2 flex items-center gap-1">
                  <button
                    onClick={handleAddNew}
                    className="p-1.5 rounded bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30"
                    title="Save"
                  >
                    <Save className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setAddingNew(false); setNewRow({ zone: '', species: '', count: '', valuePerTree: '' }); }}
                    className="p-1.5 rounded hover:bg-white/5 text-white/30 hover:text-white/60"
                    title="Cancel"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Total footer */}
            {inventory.length > 0 && (
              <div className="grid grid-cols-[1fr_1.2fr_80px_110px_110px_40px] bg-black/60 border-t border-vanguard-border">
                <div className="px-4 py-2.5 col-span-4 text-[10px] font-mono text-white/30 uppercase tracking-widest">
                  Total estate value
                </div>
                <div className="px-4 py-2.5">
                  <span className="text-sm font-mono font-bold text-green-400">
                    ₹{totalValue.toLocaleString('en-IN')}
                  </span>
                </div>
                <div />
              </div>
            )}
          </div>

          {/* Guidance note */}
          <div className="flex items-start gap-3 p-4 bg-black/40 border border-vanguard-border/50 rounded-lg">
            <IndianRupee className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[10px] font-mono text-white/40 leading-relaxed">
              This inventory is stored locally on your device and used to calculate financial exposure in evidence reports. Zones must match exactly what appears in your incident alerts for accurate damage assessment.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstateIntelPage;
