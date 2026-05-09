import React, { useState, useCallback } from 'react';
import { ShieldAlert, FileDown, Loader2, IndianRupee, AlertTriangle } from 'lucide-react';
import { AlertEvent } from '../lib/parksData';
import NarrativePanel from './NarrativePanel';
import LegalProfileModal, { loadLegalProfile } from './LegalProfileModal';
import { generateEvidenceReport, LegalProfile, TreeInventoryEntry } from '../services/evidenceReport';

// Re-export so EstateIntelPage can import from one place
export type { TreeInventoryEntry } from '../services/evidenceReport';

const INVENTORY_KEY = (estateId: string) => `vanguard_inventory_${estateId}`;

export function loadInventory(estateId: string): TreeInventoryEntry[] {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY(estateId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

interface Props {
  alert: AlertEvent;
  recentAlerts: AlertEvent[];
  estateId: string;
  ownerName: string;
  estateName: string;
}

type ReportState = 'idle' | 'need-profile' | 'generating' | 'done' | 'error';

const PrivateAlertDetail: React.FC<Props> = ({
  alert, recentAlerts, estateId, ownerName, estateName,
}) => {
  const [reportState, setReportState] = useState<ReportState>('idle');
  const [reportError, setReportError] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const zoneInventory = loadInventory(estateId).filter(
    i => i.zone.toLowerCase() === (alert.zone ?? '').toLowerCase()
  );
  const totalExposure = zoneInventory.reduce((s, i) => s + i.count * i.valuePerTree, 0);

  const handleGenerateReport = useCallback(async (profile: LegalProfile) => {
    setShowProfileModal(false);
    setReportState('generating');
    setReportError(null);
    try {
      await generateEvidenceReport({
        alert,
        recentAlerts,
        ownerName,
        estateName,
        legalProfile: profile,
        inventory: loadInventory(estateId),
      });
      setReportState('done');
    } catch (err: any) {
      setReportState('error');
      setReportError(err?.message ?? 'Report generation failed');
    }
  }, [alert, recentAlerts, ownerName, estateName, estateId]);

  const handleReportClick = () => {
    const existing = loadLegalProfile();
    if (!existing?.district || !existing?.state) {
      setShowProfileModal(true);
    } else {
      handleGenerateReport(existing);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Layer A: Incident brief (Gemini narrative for private user) ── */}
      <div>
        <div className="text-[9px] font-mono tracking-widest text-white/30 mb-2 uppercase">
          Incident Brief
        </div>
        <NarrativePanel
          alert={alert}
          recentAlerts={recentAlerts}
          userRole="private"
          autoGenerate={alert.priority === 'CRITICAL' || alert.priority === 'ELEVATED'}
        />
      </div>

      {/* ── Layer B: Damage assessment ─────────────────────────────────── */}
      <div>
        <div className="text-[9px] font-mono tracking-widest text-white/30 mb-2 uppercase">
          Financial Exposure
        </div>
        <div className="border border-vanguard-border rounded-lg bg-black/40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-vanguard-border bg-black/40">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-mono tracking-widest text-white/60 uppercase">
                Zone {alert.zone ?? 'Unknown'} — Tree Inventory
              </span>
            </div>
            {zoneInventory.length > 0 && (
              <div className="text-[10px] font-mono text-amber-400 font-bold">
                ₹{totalExposure.toLocaleString('en-IN')} at risk
              </div>
            )}
          </div>

          {/* Content */}
          {zoneInventory.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <AlertTriangle className="w-4 h-4 text-white/20 mx-auto mb-2" />
              <div className="text-[10px] font-mono text-white/30">
                No inventory for this zone.
              </div>
              <div className="text-[9px] font-mono text-white/20 mt-1">
                Add trees in Estate Intelligence to calculate exposure.
              </div>
            </div>
          ) : (
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="bg-black/60">
                  <th className="text-left px-3 py-1.5 text-white/40 font-normal">Species</th>
                  <th className="text-right px-3 py-1.5 text-white/40 font-normal">Trees</th>
                  <th className="text-right px-3 py-1.5 text-white/40 font-normal">Per Tree</th>
                  <th className="text-right px-3 py-1.5 text-white/40 font-normal">Exposure</th>
                </tr>
              </thead>
              <tbody>
                {zoneInventory.map((row, i) => (
                  <tr key={i} className="border-t border-vanguard-border/40">
                    <td className="px-3 py-1.5 text-white/80">{row.species}</td>
                    <td className="px-3 py-1.5 text-right text-white/60">{row.count}</td>
                    <td className="px-3 py-1.5 text-right text-white/60">₹{row.valuePerTree.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-1.5 text-right text-amber-400 font-bold">
                      ₹{(row.count * row.valuePerTree).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-vanguard-border bg-black/60">
                  <td colSpan={3} className="px-3 py-2 text-white/40 font-bold">TOTAL EXPOSURE</td>
                  <td className="px-3 py-2 text-right text-amber-400 font-bold text-xs">
                    ₹{totalExposure.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ── Layer C: Evidence report ───────────────────────────────────── */}
      <div>
        <div className="text-[9px] font-mono tracking-widest text-white/30 mb-2 uppercase">
          Evidence Documentation
        </div>

        <div className="border border-vanguard-border rounded-lg bg-black/40 p-3 space-y-3">
          <div className="text-[10px] font-mono text-white/50 leading-relaxed">
            Generate a court-admissible PDF with a cryptographic integrity hash, timeline of events, sensor exhibit images, and financial exposure — ready to submit to law enforcement or insurance.
          </div>

          {reportState === 'error' && (
            <div className="text-[10px] font-mono text-red-400 bg-red-950/40 border border-red-500/30 rounded px-3 py-2">
              {reportError}
            </div>
          )}

          {reportState === 'done' && (
            <div className="text-[10px] font-mono text-green-400 bg-green-950/40 border border-green-500/30 rounded px-3 py-2">
              Report downloaded. Check your Downloads folder.
            </div>
          )}

          <button
            onClick={handleReportClick}
            disabled={reportState === 'generating'}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded font-mono font-bold text-xs tracking-widest transition-all ${
              reportState === 'generating'
                ? 'bg-white/5 text-white/30 cursor-not-allowed border border-vanguard-border'
                : 'bg-vanguard-camera text-[#0A0F1A] hover:brightness-110 border border-transparent'
            }`}
          >
            {reportState === 'generating' ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> GENERATING REPORT…</>
            ) : (
              <><FileDown className="w-3.5 h-3.5" />
                {reportState === 'done' ? 'DOWNLOAD AGAIN' : 'GENERATE EVIDENCE REPORT'}</>
            )}
          </button>

          <div className="flex items-center gap-1.5 text-[9px] font-mono text-white/25">
            <ShieldAlert className="w-3 h-3" />
            SHA-256 integrity hash embedded — tamper-evident
          </div>
        </div>
      </div>

      {/* Legal profile modal */}
      {showProfileModal && (
        <LegalProfileModal
          onSave={handleGenerateReport}
          onCancel={() => { setShowProfileModal(false); setReportState('idle'); }}
        />
      )}
    </div>
  );
};

export default PrivateAlertDetail;
