import { GoogleGenerativeAI } from "@google/generative-ai";
import { Severity } from "./types";

const apiKey = process.env.GEMINI_API_KEY ?? process.env.GROQ_API_KEY ?? "";
const simulationMode = apiKey.trim().length === 0;

const genAI = new GoogleGenerativeAI(apiKey);

const MODEL_NAME: Record<Severity, string> = {
  high: "gemini-1.5-pro",
  medium: "gemini-2.5-flash",
  low: "gemini-2.5-flash"
};

function pickAction(eventType: string, severity: Severity, location: string): string {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("tailgating")) {
    return `Deploy badge verification at ${location}, enable anti-passback for next shift, and open a supervisor review ticket.`;
  }
  if (normalized.includes("motion")) {
    return `Dispatch rover to ${location}, cross-check maintenance rosters, and harden after-hours access profile for the zone.`;
  }
  if (normalized.includes("door") || normalized.includes("gate")) {
    return `Send security response to ${location}, validate door or gate integrity, and trigger perimeter exception protocol.`;
  }
  if (normalized.includes("loiter")) {
    return `Assign focused monitoring on ${location}, add temporary zone patrol, and correlate with visitor and vendor movement logs.`;
  }
  return severity === "high"
    ? `Initiate priority incident workflow at ${location} with immediate on-site verification and SOC escalation.`
    : `Queue targeted follow-up at ${location} and monitor for recurrence in next 24 hours.`;
}

function simulateCompletion(prompt: string, severity: Severity): { text: string; model_used: string; cost_usd: number; latency_ms: number } {
  const locationMatch = prompt.match(/LOCATION:\s*(.+)/i);
  const eventMatch = prompt.match(/EVENT TYPE:\s*(.+)/i);
  const memoryMatches = prompt.match(/^\d+\.\s+\[/gm) ?? [];

  const location = (locationMatch?.[1] ?? "Unknown Location").trim();
  const eventType = (eventMatch?.[1] ?? "security_anomaly").trim();
  const recurrence = memoryMatches.length;
  const confidenceBase = severity === "high" ? 0.88 : severity === "medium" ? 0.79 : 0.71;
  const confidence = Math.min(0.97, confidenceBase + Math.min(0.09, recurrence * 0.02));
  const latency_ms = Math.round(120 + Math.random() * 280 + (severity === "high" ? 120 : 0));
  const promptTokens = Math.max(120, Math.round(prompt.length / 4));
  const completionTokens = severity === "high" ? 280 : severity === "medium" ? 200 : 150;
  const pricing =
    severity === "high"
      ? { inPerM: 1.25, outPerM: 5.00 } // Approx Gemini 1.5 Pro cost
      : { inPerM: 0.075, outPerM: 0.30 }; // Approx Gemini Flash cost
  const cost_usd = Number(
    ((promptTokens / 1_000_000) * pricing.inPerM + (completionTokens / 1_000_000) * pricing.outPerM).toFixed(6)
  );

  const summary =
    recurrence > 0
      ? `${eventType} at ${location} matches a previously observed operational risk pattern and is likely not isolated.`
      : `${eventType} at ${location} appears as a new anomaly requiring controlled verification.`;
  const pattern =
    recurrence > 0
      ? `Recurrence detected: ${recurrence} similar memory hit${recurrence > 1 ? "s" : ""}; behavior indicates repeatable access-control weakness at ${location}.`
      : "No strong historical recurrence found; monitor this anomaly for repeat signatures across shift windows.";
  const action = pickAction(eventType, severity, location);

  return {
    text: JSON.stringify({ summary, pattern, action, confidence }),
    model_used: `sim/${MODEL_NAME[severity]}`,
    cost_usd,
    latency_ms
  };
}

export async function routedCompletion(
  prompt: string,
  severity: Severity
): Promise<{ text: string; model_used: string; cost_usd: number; latency_ms: number }> {
  if (simulationMode) {
    return simulateCompletion(prompt, severity);
  }

  try {
    const modelId = MODEL_NAME[severity];
    const model = genAI.getGenerativeModel({ model: modelId });
    const start = Date.now();
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 700,
        temperature: 0.2
      }
    });
    
    const latency_ms = Date.now() - start;
    const response = await result.response;
    const text = response.text();
    
    // Estimate cost based on tokens
    const promptTokens = prompt.length / 4; 
    const completionTokens = text.length / 4;
    const pricing =
      severity === "high"
        ? { inPerM: 1.25, outPerM: 5.00 }
        : { inPerM: 0.075, outPerM: 0.30 };
        
    const cost_usd = Number(
      ((promptTokens / 1_000_000) * pricing.inPerM + (completionTokens / 1_000_000) * pricing.outPerM).toFixed(6)
    );

    return {
      text,
      model_used: modelId,
      cost_usd,
      latency_ms
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed routed completion for '${severity}' severity: ${message}`);
  }
}
