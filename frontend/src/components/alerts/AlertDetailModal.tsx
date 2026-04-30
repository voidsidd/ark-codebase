import React, { useState, useCallback } from 'react';
import { AlertTriangle, MapPin, Camera, Radio, ShieldAlert, Activity, X, Leaf, FileText, Loader2, Download, Brain } from 'lucide-react';
import { AlertEvent }  $matches[0] -replace "lib/parksData", "lib/data/parksData" ;
import NarrativePanel from './NarrativePanel';
import HypothesisCard from './HypothesisCard';
import PrivateAlertDetail from './PrivateAlertDetail';
import { getCachedHypothesis } from '../../services/hypothesisEngine';
import { useAuth } from '../../hooks/useAuth';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY_1 || import.meta.env.VITE_GROQ_API_KEY_2 || '';

interface AlertDetailModalProps {
  alert: AlertEvent;
  recentAlerts: AlertEvent[];
  onClose: () => void;
  estateId?: string;
}

const TYPE_LABELS: Record<string, string> = {
  ACOUSTIC:             'Acoustic Sensor',
  CAMERA:               'Camera Trap',
  COMMUNITY:            'Community Report',
  CORRELATED:           'Correlated Incident',
  ONE_HEALTH:           'One Health Flag',
  WILDLIFE_CORRELATION: 'Wildlife Correlation',
};

const PRIORITY_STYLES: Record<string, React.CSSProperties> = {
  CRITICAL:   { background: 'rgba(255,68,68,0.12)',   color: '#FF4444', border: '1px solid rgba(255,68,68,0.4)' },
  HIGH:       { background: 'rgba(255,100,0,0.12)',   color: '#FF6400', border: '1px solid rgba(255,100,0,0.4)' },
  ELEVATED:   { background: 'rgba(255,149,0,0.12)',   color: '#FF9500', border: '1px solid rgba(255,149,0,0.4)' },
  PREDICTIVE: { background: 'rgba(255,149,0,0.10)',   color: '#FF9500', border: '1px solid rgba(255,149,0,0.25)' },
  NORMAL:     { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' },
};

function SourceIcon({ type }: { type: string }) {
  const size = 20;
  switch (type) {
    case 'ACOUSTIC':  return <Radio size={size} style={{ color: '#FF4444' }} />;
    case 'CAMERA':    return <Camera size={size} style={{ color: '#FF9500' }} />;
    case 'COMMUNITY': return <MapPin size={size} style={{ color: '#60A5FA' }} />;
    case 'CORRELATED':return <ShieldAlert size={size} style={{ color: '#FF4444' }} />;
    case 'ONE_HEALTH':return <Activity size={size} style={{ color: '#A78BFA' }} />;
    default:          return <AlertTriangle size={size} style={{ color: 'rgba(255,255,255,0.4)' }} />;
  }
}

interface IntelBrief {
  threat_assessment: string;
  recommended_actions: string[];
  risk_window: string;
  correlations: string;
  classification: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MONITOR';
}

async function generateIntelBrief(alert: AlertEvent, recentAlerts: AlertEvent[]): Promise<IntelBrief> {
  const relatedCount = recentAlerts.filter(a => a.zone === alert.zone && a.id !== alert.id).length;
  const prompt = `You are VANGUARD — an elite AI wildlife protection intelligence system serving a government national park.
Generate a concise tactical intelligence brief for the following alert (respond with valid JSON only):

ALERT:
- Type: ${alert.type} / ${alert.subType}
- Priority: ${alert.priority}
- Zone: ${alert.zone}
- Description: ${alert.description}
- Confidence: ${alert.confidence ? (alert.confidence * 100).toFixed(0) : 'N/A'}%
- Related alerts in same zone (last hour): ${relatedCount}

Respond ONLY with this JSON structure (no markdown, no codeblock):
{
  "threat_assessment": "2-3 sentence tactical assessment of the threat and its implications.",
  "recommended_actions": ["Action 1", "Action 2", "Action 3"],
  "risk_window": "Time window for elevated risk (e.g. Next 6 hours, Immediate, etc.)",
  "correlations": "Brief note on correlation with other sensor data or wildlife patterns.",
  "classification": "${alert.priority === 'CRITICAL' ? 'CRITICAL' : alert.priority === 'HIGH' ? 'HIGH' : 'ELEVATED'}"
}`;

  if (!GROQ_KEY) throw new Error('No Groq API key');
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error('Groq API error');
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(text.trim());
}

function printIntelBrief(alert: AlertEvent, brief: IntelBrief) {
  const classColors: Record<string, string> = {
    CRITICAL: '#FF4444', HIGH: '#FF6400', ELEVATED: '#FF9500', MONITOR: '#60A5FA',
  };
  const color = classColors[brief.classification] || '#FF9500';
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head>
<title>VANGUARD INTEL BRIEF – ${alert.subType}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; background: #fff; color: #111; padding: 40px; }
  .header { border-bottom: 3px solid ${color}; padding-bottom: 18px; margin-bottom: 24px; }
  .badge { display: inline-block; background: ${color}22; color: ${color}; border: 1px solid ${color}88;
           font-size: 10px; font-weight: 700; letter-spacing: 0.15em; padding: 3px 10px; border-radius: 4px; }
  .title { font-size: 22px; font-weight: 700; margin: 10px 0 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .subtitle { font-size: 11px; color: #666; letter-spacing: 0.12em; text-transform: uppercase; }
  .section { margin-bottom: 22px; }
  .section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.2em; color: #888; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 10px; }
  .body-text { font-size: 13px; line-height: 1.7; color: #222; }
  .action-list { list-style: none; }
  .action-list li { padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; padding-left: 16px; position: relative; }
  .action-list li::before { content: "▸"; position: absolute; left: 0; color: ${color}; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .meta-item { background: #f9f9f9; border: 1px solid #eee; border-radius: 4px; padding: 10px 14px; }
  .meta-label { font-size: 9px; color: #999; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 4px; }
  .meta-value { font-size: 13px; font-weight: 600; }
  .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #eee; font-size: 9px; color: #aaa; letter-spacing: 0.1em; display: flex; justify-content: space-between; }
  @media print { body { padding: 24px; } }
</style></head><body>
<div class="header">
  <div class="badge">${brief.classification} CLASSIFICATION</div>
  <div class="title">Alert Intelligence Brief</div>
  <div class="subtitle">Vanguard Intel System · ${alert.type} · Zone ${alert.zone} · ${new Date().toUTCString()}</div>
</div>
<div class="section"><div class="section-label">Threat Assessment</div><div class="body-text">${brief.threat_assessment}</div></div>
<div class="section">
  <div class="section-label">Alert Metadata</div>
  <div class="meta-grid">
    <div class="meta-item"><div class="meta-label">Alert Type</div><div class="meta-value">${TYPE_LABELS[alert.type] ?? alert.type}</div></div>
    <div class="meta-item"><div class="meta-label">Sub-Type</div><div class="meta-value">${alert.subType.replace(/_/g, ' ')}</div></div>
    <div class="meta-item"><div class="meta-label">Priority</div><div class="meta-value" style="color:${color}">${alert.priority}</div></div>
    <div class="meta-item"><div class="meta-label">Confidence</div><div class="meta-value">${alert.confidence ? (alert.confidence * 100).toFixed(1) + '%' : 'N/A'}</div></div>
  </div>
</div>
<div class="section"><div class="section-label">Description</div><div class="body-text">${alert.description}</div></div>
<div class="section">
  <div class="section-label">Recommended Actions</div>
  <ul class="action-list">${brief.recommended_actions.map(a => `<li>${a}</li>`).join('')}</ul>
</div>
<div class="section"><div class="section-label">Risk Window</div><div class="body-text">${brief.risk_window}</div></div>
<div class="section"><div class="section-label">Sensor Correlations</div><div class="body-text">${brief.correlations}</div></div>
<div class="footer"><span>VANGUARD INTELLIGENCE PLATFORM — GOVERNMENT USE ONLY</span><span>GENERATED ${new Date().toISOString()}</span></div>
<script>window.print(); window.onafterprint = () => window.close();</script>
</body></html>`);
  win.document.close();
}

const AlertDetailModal: React.FC<AlertDetailModalProps> = ({ alert, recentAlerts, onClose, estateId }) => {
  const { isPrivate, profile } = useAuth();
  const priorityStyle = PRIORITY_STYLES[alert.priority] ?? PRIORITY_STYLES.NORMAL;
  const cachedHypothesis = getCachedHypothesis(alert.id);
  const isPredictive = alert.priority === 'PREDICTIVE';

  // Government-specific features
  const showHypothesis = !isPrivate && alert.priority === 'CRITICAL';
  const showGovernmentNarrative = !isPrivate && (alert.priority === 'CRITICAL' || alert.priority === 'ELEVATED');
  const showIntelligence = !isPrivate; // All government users see intelligence panel

  const [intelLoading, setIntelLoading] = useState(false);
  const [intelBrief, setIntelBrief] = useState<IntelBrief | null>(null);
  const [intelError, setIntelError] = useState<string | null>(null);

  const ownerName = profile?.display_name ?? 'Estate Owner';

  const handleGenerateIntel = useCallback(async () => {
    setIntelLoading(true);
    setIntelError(null);
    try {
      const brief = await generateIntelBrief(alert, recentAlerts);
      setIntelBrief(brief);
    } catch {
      setIntelError('Intelligence generation offline. Using local assessment.');
      // Create a default brief without AI
      setIntelBrief({
        threat_assessment: `A ${alert.type} event of ${alert.priority} priority has been recorded in Zone ${alert.zone}. ${alert.description} Immediate assessment is recommended.`,
        recommended_actions: [
          'Dispatch nearest ranger unit to the incident zone.',
          'Cross-reference with adjacent camera traps and acoustic sensors.',
          'Log incident in the Daily Intelligence Report and notify sector commander.',
        ],
        risk_window: alert.priority === 'CRITICAL' ? 'Immediate — next 4 hours' : 'Next 12–24 hours',
        correlations: 'Sensor correlation data unavailable offline. Check adjacent zone feeds manually.',
        classification: alert.priority === 'CRITICAL' ? 'CRITICAL' : alert.priority === 'HIGH' ? 'HIGH' : 'ELEVATED',
      });
    } finally {
      setIntelLoading(false);
    }
  }, [alert, recentAlerts]);

  const classColors: Record<string, string> = {
    CRITICAL: '#FF4444', HIGH: '#FF6400', ELEVATED: '#FF9500', MONITOR: '#60A5FA',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      }}
    >
      {/* Drawer */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '500px', maxWidth: '95vw', height: '100vh',
          background: '#080D18',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SourceIcon type={alert.type} />
            <div>
              <div style={{
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: '10px', letterSpacing: '0.15em',
                color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '4px',
              }}>
                {TYPE_LABELS[alert.type] ?? alert.type}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>
                {alert.subType.replace(/_/g, ' ')}
              </div>
            </div>
          </div>

          {isPrivate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto', marginLeft: '12px' }}>
              <Leaf size={12} style={{ color: '#34C759' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#34C759', letterSpacing: '0.12em' }}>
                ESTATE MODE
              </span>
            </div>
          )}

          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
            padding: '4px', borderRadius: '4px',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Metadata block (shared for all roles) ─────────────── */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{
              ...priorityStyle,
              fontSize: '11px', fontFamily: 'monospace', fontWeight: 600,
              letterSpacing: '0.1em', padding: '3px 10px', borderRadius: '4px',
            }}>
              {isPredictive ? 'PREDICTIVE' : alert.priority}
            </span>
            <span style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: 'monospace',
              padding: '3px 10px', borderRadius: '4px',
            }}>
              ZONE {alert.zone?.replace('Z', '') ?? '—'}
            </span>
            {alert.confidence != null && (
              <span style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'monospace',
                padding: '3px 10px', borderRadius: '4px',
              }}>
                {(alert.confidence * 100).toFixed(0)}% CONF
              </span>
            )}
          </div>

          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, margin: 0 }}>
            {alert.description}
          </p>
          <div style={{ marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
            {alert.timestamp}
          </div>
        </div>

        {/* ── Predictive correlation block (government only) ─────── */}
        {isPredictive && !isPrivate && (
          <div style={{
            margin: '16px 24px 0',
            background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.2)',
            borderRadius: '8px', padding: '16px 20px',
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#FF9500', letterSpacing: '0.12em', marginBottom: '12px' }}>
              PREDICTIVE THREAT INTELLIGENCE
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#FF9500', lineHeight: 1 }}>
              {alert.confidence ? Math.round(alert.confidence * 100) : '—'}%
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
              of wildlife sightings in {alert.zone} preceded a poaching attempt
            </div>
            <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,149,0,0.15)', paddingTop: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
                ELEVATED RISK WINDOW
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>
                Next 48 hours
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '6px' }}>
                {alert.subType}
              </div>
            </div>
          </div>
        )}

        {/* ── GOVERNMENT ONLY: Alert Intelligence Panel ──────────── */}
        {showIntelligence && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{
              background: 'rgba(37, 244, 238, 0.04)',
              border: '1px solid rgba(37, 244, 238, 0.18)',
              borderRadius: '10px',
              padding: '16px 20px',
            }}>
              {/* Panel header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Brain size={16} style={{ color: '#25F4EE' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#25F4EE', letterSpacing: '0.15em', fontWeight: 700 }}>
                    ALERT INTELLIGENCE
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {intelBrief && (
                    <button
                      onClick={() => printIntelBrief(alert, intelBrief)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'rgba(37, 244, 238, 0.12)', border: '1px solid rgba(37, 244, 238, 0.35)',
                        borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                        color: '#25F4EE', fontFamily: 'monospace', fontSize: '10px',
                        letterSpacing: '0.1em', fontWeight: 700,
                      }}
                    >
                      <Download size={12} />
                      PDF BRIEF
                    </button>
                  )}
                  {!intelBrief && (
                    <button
                      onClick={handleGenerateIntel}
                      disabled={intelLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: intelLoading ? 'rgba(37,244,238,0.06)' : 'rgba(37, 244, 238, 0.15)',
                        border: '1px solid rgba(37, 244, 238, 0.35)',
                        borderRadius: '6px', padding: '5px 12px', cursor: intelLoading ? 'not-allowed' : 'pointer',
                        color: '#25F4EE', fontFamily: 'monospace', fontSize: '10px',
                        letterSpacing: '0.1em', fontWeight: 700,
                      }}
                    >
                      {intelLoading ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                      {intelLoading ? 'GENERATING...' : 'GENERATE INTEL'}
                    </button>
                  )}
                </div>
              </div>

              {/* No brief yet */}
              {!intelBrief && !intelLoading && (
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                  Generate a classified AI intelligence brief for this alert, including threat assessment, recommended actions, and PDF export.
                </p>
              )}

              {/* Loading state */}
              {intelLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                  <Loader2 size={14} style={{ color: '#25F4EE', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '12px', color: 'rgba(37,244,238,0.7)', fontFamily: 'monospace' }}>
                    VANGUARD AI ANALYZING THREAT VECTOR...
                  </span>
                </div>
              )}

              {/* Error fallback message */}
              {intelError && (
                <div style={{ fontSize: '10px', color: 'rgba(255,149,0,0.7)', fontFamily: 'monospace', marginBottom: '10px' }}>
                  ⚠ {intelError}
                </div>
              )}

              {/* Brief content */}
              {intelBrief && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* classification */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      background: `${classColors[intelBrief.classification]}22`,
                      border: `1px solid ${classColors[intelBrief.classification]}66`,
                      color: classColors[intelBrief.classification],
                      fontSize: '10px', fontFamily: 'monospace', fontWeight: 700,
                      letterSpacing: '0.12em', padding: '2px 8px', borderRadius: '4px',
                    }}>
                      {intelBrief.classification}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                      AI-CLASSIFIED
                    </span>
                  </div>

                  {/* Threat assessment */}
                  <div>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '5px' }}>
                      Threat Assessment
                    </div>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.65, margin: 0 }}>
                      {intelBrief.threat_assessment}
                    </p>
                  </div>

                  {/* Recommended actions */}
                  <div>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '5px' }}>
                      Recommended Actions
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {intelBrief.recommended_actions.map((a, i) => (
                        <li key={i} style={{
                          display: 'flex', gap: '8px', alignItems: 'flex-start',
                          fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6,
                        }}>
                          <span style={{ color: '#25F4EE', flexShrink: 0, marginTop: '2px' }}>▸</span>
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Risk window + correlations in a row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginBottom: '4px' }}>
                        RISK WINDOW
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: classColors[intelBrief.classification] }}>
                        {intelBrief.risk_window}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginBottom: '4px' }}>
                        CORRELATIONS
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                        {intelBrief.correlations}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AI panel — branches by role ────────────────────────── */}
        <div style={{ padding: '0 24px 32px', flex: 1 }}>
          {isPrivate ? (
            /* Private: 3-layer panel */
            <div style={{ marginTop: '20px' }}>
              <PrivateAlertDetail
                alert={alert}
                recentAlerts={recentAlerts}
                estateId={estateId ?? ''}
                ownerName={ownerName}
                estateName="My Estate"
              />
            </div>
          ) : (
            /* Government: Hypothesis + Narrative */
            <>
              {showHypothesis && (
                <HypothesisCard
                  hypothesis={cachedHypothesis?.hypothesis ?? null}
                  isLoading={cachedHypothesis?.loading ?? false}
                />
              )}
              {showGovernmentNarrative && (
                <NarrativePanel alert={alert} recentAlerts={recentAlerts} userRole="government" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertDetailModal;
