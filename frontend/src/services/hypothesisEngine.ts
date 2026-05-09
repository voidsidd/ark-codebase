import { supabase } from '../lib/supabaseClient';
import { AlertEvent } from '../lib/parksData';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface HypothesisResult {
  hypothesis: string;
  confidence: number;
  supporting_evidence: string;
  recommended_action: string;
  assessed_at: string;
}

// ─── In-memory cache ─────────────────────────────────────────────────────────
interface CacheEntry {
  hypothesis: HypothesisResult;
  loading: boolean;
}

const hypothesisCache = new Map<string, CacheEntry>();

export function getCachedHypothesis(alertId: string): CacheEntry | null {
  return hypothesisCache.get(alertId) ?? null;
}

// ─── Historical incident lookup from Supabase ─────────────────────────────────
async function fetchHistoricalIncidents(zoneId: string, hourOfDay: number) {
  const { data, error } = await supabase
    .from('alerts')
    .select('source_type, description, confidence, outcome, created_at')
    .eq('zone_id', zoneId)
    .not('outcome', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.warn('[hypothesisEngine] Historical fetch failed:', error.message);
    return [];
  }

  // Filter ±2 hours client-side
  return (data ?? []).filter(record => {
    const hour = new Date(record.created_at).getHours();
    return Math.abs(hour - hourOfDay) <= 2;
  }).slice(0, 15);
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function runHypothesis(alert: AlertEvent): Promise<HypothesisResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set');

  // Approximate hour of day — parse from alert timestamp or use now
  const hourOfDay = (() => {
    const t = alert.timestamp;
    if (t && /\d{2}:\d{2}/.test(t)) {
      return parseInt(t.replace(/.*(\d{2}):(\d{2}).*/, '$1'), 10);
    }
    return new Date().getHours();
  })();

  const historical = await fetchHistoricalIncidents(alert.zone, hourOfDay);

  const context = {
    incoming_event: {
      zone_id: alert.zone,
      source_type: alert.type,
      description: alert.description,
      confidence: alert.confidence ?? null,
      time_of_day: `${hourOfDay.toString().padStart(2, '0')}:00`,
      sub_type: alert.subType,
    },
    historical_incidents: historical.map(i => ({
      source_type: i.source_type,
      description: i.description,
      confidence: i.confidence,
      outcome: i.outcome,
      time_of_day: new Date(i.created_at).toTimeString().slice(0, 5),
    })),
    confirmed_incident_count: historical.filter(i => i.outcome === 'confirmed_incident').length,
    false_positive_count: historical.filter(i => i.outcome === 'false_positive').length,
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: `You are a wildlife security intelligence analyst with 15 years of field experience. You assess incoming sensor alerts against historical incident data to determine whether an alert represents a genuine threat.

You must return ONLY a valid JSON object. No preamble. No explanation. No markdown code fences. Just the raw JSON object.

The JSON object must have exactly these four fields:
- "hypothesis": string — one sentence stating your assessed scenario. Start with "ASSESSED:" then state what you believe is happening. Be decisive.
- "confidence": integer between 0 and 100 — your confidence that this is a genuine incident, not a false positive. Base this on the ratio of confirmed incidents to false positives in the historical data, weighted by similarity to the current event.
- "supporting_evidence": string — two to three sentences explaining which historical patterns support your assessment. Reference specific data points (e.g. "4 of 7 historical ACOUSTIC events in this zone during the 01:00–03:00 window were confirmed incidents").
- "recommended_action": string — one specific, actionable instruction starting with a verb. Name a specific gate, road, or patrol unit if the zone context allows. Include timing (e.g. "within 8 minutes").

Do not hedge. Do not use passive voice. If confidence is above 70, be assertive. If below 40, still commit to a recommendation but qualify it with "Possible:" at the start of the hypothesis.`
          }]
        },
        contents: [{
          parts: [{
            text: `Assess this incoming alert:\n\n${JSON.stringify(context, null, 2)}`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip accidental markdown fences
  rawText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Hypothesis parsing failed: invalid response structure');
  }

  if (
    typeof parsed.hypothesis !== 'string' ||
    typeof parsed.confidence !== 'number' ||
    typeof parsed.supporting_evidence !== 'string' ||
    typeof parsed.recommended_action !== 'string'
  ) {
    throw new Error('Hypothesis parsing failed: invalid response structure');
  }

  const result: HypothesisResult = {
    hypothesis: parsed.hypothesis,
    confidence: parsed.confidence,
    supporting_evidence: parsed.supporting_evidence,
    recommended_action: parsed.recommended_action,
    assessed_at: new Date().toISOString(),
  };

  // Cache it
  hypothesisCache.set(alert.id, { hypothesis: result, loading: false });

  // Write to Supabase (non-blocking)
  supabase
    .from('alerts')
    .upsert({
      id: alert.id,
      zone_id: alert.zone,
      severity: alert.priority,
      source_type: alert.type,
      description: alert.description,
      hypothesis: result,
    }, { onConflict: 'id' })
    .then(({ error }) => {
      if (error) console.warn('[hypothesisEngine] Supabase write failed:', error.message);
    });

  return result;
}

// ─── Auto-trigger on CRITICAL events (called from liveStream interceptor) ────
export async function autoRunHypothesis(alert: AlertEvent): Promise<void> {
  if (hypothesisCache.has(alert.id)) return; // already cached

  // Set loading state immediately
  hypothesisCache.set(alert.id, { hypothesis: null as any, loading: true });

  try {
    await runHypothesis(alert);
  } catch (err) {
    console.error('[hypothesisEngine] Auto-run failed:', err);
    hypothesisCache.delete(alert.id);
  }
}
