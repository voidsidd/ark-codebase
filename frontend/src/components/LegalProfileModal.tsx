import React, { useState } from 'react';
import { X, FileText } from 'lucide-react';
import { LegalProfile } from '../services/evidenceReport';

const STORAGE_KEY = 'vanguard_legal_profile';

export function loadLegalProfile(): LegalProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLegalProfile(p: LegalProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

interface Props {
  onSave: (profile: LegalProfile) => void;
  onCancel: () => void;
}

const LegalProfileModal: React.FC<Props> = ({ onSave, onCancel }) => {
  const existing = loadLegalProfile();
  const [district, setDistrict] = useState(existing?.district ?? '');
  const [state, setState] = useState(existing?.state ?? '');
  const [surveyNumber, setSurveyNumber] = useState(existing?.surveyNumber ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const profile: LegalProfile = {
      district: district.trim(),
      state: state.trim(),
      surveyNumber: surveyNumber.trim() || undefined,
    };
    saveLegalProfile(profile);
    onSave(profile);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-vanguard-panel border border-vanguard-border rounded-xl shadow-2xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-vanguard-border">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-vanguard-camera" />
            <div>
              <div className="text-xs font-mono tracking-widest text-white">REPORT DETAILS</div>
              <div className="text-[10px] font-mono text-white/40">
                Required for evidence report header
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-[10px] font-mono text-white/40 leading-relaxed">
            These details appear on your evidence report cover page. Only district and state are
            required.
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-mono text-white/50 mb-1 tracking-widest">
                DISTRICT *
              </label>
              <input
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Mysuru"
                className="w-full bg-black/60 border border-vanguard-border rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-vanguard-camera placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-white/50 mb-1 tracking-widest">
                STATE *
              </label>
              <input
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Karnataka"
                className="w-full bg-black/60 border border-vanguard-border rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-vanguard-camera placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-white/50 mb-1 tracking-widest">
                SURVEY / PLOT NUMBER <span className="text-white/25">(optional)</span>
              </label>
              <input
                value={surveyNumber}
                onChange={(e) => setSurveyNumber(e.target.value)}
                placeholder="e.g. 204/3B"
                className="w-full bg-black/60 border border-vanguard-border rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-vanguard-camera placeholder:text-white/20"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-vanguard-camera text-[#0A0F1A] font-bold font-mono text-xs tracking-widest rounded hover:brightness-110 transition-all"
          >
            SAVE AND GENERATE REPORT
          </button>
        </form>
      </div>
    </div>
  );
};

export default LegalProfileModal;
