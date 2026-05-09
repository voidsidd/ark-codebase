import { supabase } from '../lib/supabaseClient';
import { AlertEvent } from '../lib/parksData';

// ─── In-memory narrative cache (keyed by alert ID) ───────────────────────────
const narrativeCache = new Map<string, { text: string; generatedAt: string }>();

// ─── In-flight deduplication map ─────────────────────────────────────────────
// Prevents React Strict Mode double-invoke from firing two concurrent
// API cascades for the same alertId.
const inFlight = new Map<string, Promise<string>>();

// ─── Per-key rate-limit cooldown tracker ──────────────────────────────────
// When a provider returns 429, record the timestamp.
// Skip that provider for COOLDOWN_MS (60 s) so we don't burn the
// next API key in the cascade on a known-exhausted provider.
const COOLDOWN_MS = 60_000;
const rateLimitedUntil = new Map<string, number>(); // label -> epoch ms

function isOnCooldown(label: string): boolean {
  const until = rateLimitedUntil.get(label);
  if (!until) return false;
  if (Date.now() < until) return true;
  rateLimitedUntil.delete(label); // cooldown expired
  return false;
}

function markRateLimited(label: string): void {
  const until = Date.now() + COOLDOWN_MS;
  rateLimitedUntil.set(label, until);
  const readableUntil = new Date(until).toLocaleTimeString();
  console.warn(`[narrativeEngine] ${label} rate-limited — skipping for 60 s (available again at ${readableUntil}).`);
}

export function getCachedNarrative(alertId: string) {
  return narrativeCache.get(alertId) ?? null;
}

// ─── Context builder ──────────────────────────────────────────────────────────
function buildContext(triggerAlert: AlertEvent, recentAlerts: AlertEvent[]) {
  return {
    trigger_event: {
      zone_id:     triggerAlert.zone,
      severity:    triggerAlert.priority,
      source_type: triggerAlert.type,
      description: triggerAlert.description,
      confidence:  triggerAlert.confidence ?? null,
      timestamp:   triggerAlert.timestamp,
      sub_type:    triggerAlert.subType,
    },
    recent_zone_events: recentAlerts
      .filter(a => a.zone === triggerAlert.zone && a.id !== triggerAlert.id)
      .slice(-10)
      .map(e => ({
        source_type: e.type,
        description: e.description,
        confidence:  e.confidence ?? null,
        severity:    e.priority,
        timestamp:   e.timestamp,
        sub_type:    e.subType,
      })),
    zone_id:                   triggerAlert.zone,
    event_count_last_60_min:   recentAlerts.filter(a => a.zone === triggerAlert.zone).length,
  };
}

// ─── System prompts ───────────────────────────────────────────────────────────
const GOVERNMENT_PROMPT = `You are an operational intelligence officer embedded with a wildlife protection ranger unit.
You receive structured JSON data from a sensor network and generate urgent operational briefings for rangers in the field.

Your briefings must follow this exact structure:
1. A timestamp and one-sentence situation summary on the first line (format: "HH:MM — [situation]")
2. A blank line
3. "PRECEDING EVENTS:" followed by 2-4 bullet points of key events in chronological order, each starting with a timestamp offset (e.g. "−43 min:")
4. A blank line
5. "THREAT ASSESSMENT:" — one sentence on direction of movement or likely target if determinable, or "Insufficient data to determine movement vector" if not
6. A blank line
7. "RECOMMENDED ACTION:" — one specific, actionable instruction with timing. Name a gate, road, or coordinate if zone context allows. Start with a verb.

Rules: Write for a ranger who has 6 seconds to read this while running. Every word must earn its place. No hedging. No passive voice. No filler like "it appears". If confidence is high, be decisive. If moderate, say "Probable:" or "Possible:" then commit.`;

const PRIVATE_PROMPT = `You are a security intelligence analyst for private landed estates that grow high-value timber — primarily sandalwood and agarwood plantations.
You receive structured sensor alert data and generate incident briefings for the estate owner or on-site security supervisor.

Your briefings must follow this exact structure:
1. A timestamp and one-sentence situation summary on the first line (format: "HH:MM — [situation]")
2. A blank line
3. "PRECEDING ACTIVITY:" followed by 2-4 bullet points in chronological order, each starting with a timestamp offset (e.g. "−32 min:")
4. A blank line
5. "RISK ASSESSMENT:" — one sentence on the likely nature of the intrusion (opportunistic trespass, organised felling crew, scout, etc.). Be direct.
6. A blank line
7. "RECOMMENDED ACTION:" — one specific, actionable instruction. Reference which zone boundary, gate, or access track to check. Start with a verb. Mention contacting local police if CRITICAL.

Rules: Write for a property owner who needs to make a decision in 10 seconds. Plain language — no jargon. No passive voice. Reference the plantation, not a ranger unit. If confidence is high, be decisive.`;

// ─── Provider definitions ─────────────────────────────────────────────────────
type Provider =
  | { kind: 'groq';   key: string; label: string }
  | { kind: 'gemini'; key: string; label: string };

function getProviders(): Provider[] {
  const groq1  = import.meta.env.VITE_GROQ_API_KEY_1;
  const groq2  = import.meta.env.VITE_GROQ_API_KEY_2;
  const gemini = import.meta.env.VITE_GEMINI_API_KEY;

  const providers: Provider[] = [];
  if (groq1  && groq1  !== 'undefined') providers.push({ kind: 'groq',   key: groq1,  label: 'Groq-Key-1' });
  if (groq2  && groq2  !== 'undefined') providers.push({ kind: 'groq',   key: groq2,  label: 'Groq-Key-2' });
  if (gemini && gemini !== 'undefined') providers.push({ kind: 'gemini', key: gemini, label: 'Gemini'      });
  return providers;
}

// ─── Groq call (OpenAI-compatible) ───────────────────────────────────────────
async function callGroq(
  key: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model:       'llama3-70b-8192',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
      temperature: 0.3,
      max_tokens:  400,
    }),
  });

  if (res.status === 429) {
    throw Object.assign(new Error('RATE_LIMITED'), { isRateLimit: true });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq API ${res.status}: ${body || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq.');
  return text as string;
}

// ─── Gemini call ──────────────────────────────────────────────────────────────
async function callGemini(
  key: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
      }),
    },
  );

  if (res.status === 429) {
    throw Object.assign(new Error('RATE_LIMITED'), { isRateLimit: true });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${body || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini.');
  return text as string;
}

// ─── Offline fallback (no API needed) ────────────────────────────────────────
function buildFallbackNarrative(alert: AlertEvent, userRole: 'government' | 'private'): string {
  const now  = new Date();
  const hhmm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const zone = alert.zone ?? 'Unknown Zone';
  const conf = alert.confidence != null ? `${Math.round(alert.confidence * 100)}%` : 'Unknown';

  if (userRole === 'private') {
    const risk   = alert.priority === 'CRITICAL' ? 'high-risk intrusion requiring immediate response'
                 : alert.priority === 'ELEVATED'  ? 'suspicious activity requiring investigation'
                 : 'low-level perimeter anomaly';
    const action = alert.priority === 'CRITICAL'
      ? `Dispatch security to ${zone} perimeter immediately and contact local police (dial 100).`
      : alert.priority === 'ELEVATED'
      ? `Send security to inspect ${zone} boundary fence and access tracks.`
      : `Log the event and monitor ${zone} sensors for further activity.`;

    return `${hhmm} — ${alert.type} alert in plantation ${zone} indicates ${risk}.

PRECEDING ACTIVITY:
• Detection source: ${alert.type} sensor array in ${zone}
• Sensor description: "${alert.description}"
• Confidence: ${conf}
• Priority: ${alert.priority}

RISK ASSESSMENT: Pattern consistent with ${alert.priority === 'CRITICAL' ? 'organised trespass or active felling crew' : 'opportunistic trespass or scout activity'} targeting the ${zone} boundary.

RECOMMENDED ACTION: ${action}

⚠ AI brief unavailable (all providers quota-exhausted) — system-generated from sensor data only.`;
  }

  const action = alert.priority === 'CRITICAL'
    ? `Deploy patrol to ${zone} immediately via nearest access road.`
    : `Dispatch reconnaissance unit to ${zone}. Maintain radio contact.`;

  return `${hhmm} — ${alert.type} contact in ${zone}, priority ${alert.priority}, confidence ${conf}.

PRECEDING EVENTS:
• Trigger: ${alert.type} sensor activated in ${zone}
• Description: "${alert.description}"
• Confidence: ${conf}
• Classification: ${alert.priority}

THREAT ASSESSMENT: ${alert.priority === 'CRITICAL' ? 'Active threat — movement toward high-value asset probable.' : 'Insufficient data to determine movement vector.'}

RECOMMENDED ACTION: ${action}

⚠ AI brief unavailable (all providers quota-exhausted) — system-generated from sensor data only.`;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateNarrative(
  alert: AlertEvent,
  recentAlerts: AlertEvent[],
  userRole: 'government' | 'private' = 'government',
): Promise<string> {
  // Return cached result immediately if available
  const cached = narrativeCache.get(alert.id);
  if (cached) return cached.text;

  // If a request is already in-flight for this alertId, piggyback on it
  // instead of firing a second independent cascade.
  const existing = inFlight.get(alert.id);
  if (existing) {
    console.log(`[narrativeEngine] Deduplicating in-flight request for ${alert.id}`);
    return existing;
  }

  const promise = _doGenerate(alert, recentAlerts, userRole);
  inFlight.set(alert.id, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(alert.id);
  }
}

async function _doGenerate(
  alert: AlertEvent,
  recentAlerts: AlertEvent[],
  userRole: 'government' | 'private',
): Promise<string> {
  const providers  = getProviders();
  const context    = buildContext(alert, recentAlerts);
  const systemPrompt = userRole === 'private' ? PRIVATE_PROMPT : GOVERNMENT_PROMPT;
  const userMessage  = `Generate an incident briefing for this alert:\n\n${JSON.stringify(context, null, 2)}`;

  if (providers.length === 0) {
    console.warn('[narrativeEngine] No API keys configured — using offline fallback.');
    return buildFallbackNarrative(alert, userRole);
  }

  for (const provider of providers) {
    // Skip this provider if it's still in its rate-limit cooldown window
    if (isOnCooldown(provider.label)) {
      console.log(`[narrativeEngine] Skipping ${provider.label} — still in rate-limit cooldown.`);
      continue;
    }

    try {
      console.log(`[narrativeEngine] Trying ${provider.label}…`);

      const text = provider.kind === 'groq'
        ? await callGroq(provider.key, systemPrompt, userMessage)
        : await callGemini(provider.key, systemPrompt, userMessage);

      console.log(`[narrativeEngine] ✓ ${provider.label} succeeded.`);

      const generatedAt = new Date().toISOString();
      narrativeCache.set(alert.id, { text, generatedAt });

      // Write to Supabase non-blocking, best-effort
      supabase.from('alerts').upsert({
        id:                    alert.id,
        zone_id:               alert.zone,
        severity:              alert.priority,
        source_type:           alert.type,
        description:           alert.description,
        confidence:            alert.confidence ? Math.round(alert.confidence * 100) : null,
        narrative:             text,
        narrative_generated_at: generatedAt,
      }, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.warn('[narrativeEngine] Supabase write (non-critical):', error.message);
      });

      return text;
    } catch (err: any) {
      if (err?.isRateLimit) {
        markRateLimited(provider.label); // sets 60 s cooldown
        continue;
      }
      // Non-quota error (bad key, network, etc.) — try next provider but don't cooldown
      console.warn(`[narrativeEngine] ${provider.label} failed (${err?.message}) — trying next provider…`);
      continue;
    }
  }

  // All providers exhausted
  console.warn('[narrativeEngine] All providers failed — using offline fallback.');
  const fallback    = buildFallbackNarrative(alert, userRole);
  const generatedAt = new Date().toISOString();
  narrativeCache.set(alert.id, { text: fallback, generatedAt });
  return fallback;
}
