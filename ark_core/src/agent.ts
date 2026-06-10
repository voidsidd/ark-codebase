import { recallSimilarIncidents, storeIncident } from "./memory";
import { routedCompletion } from "./router";
import { AgentStats, IncidentReport, SiemEvent, TelemetryPoint } from "./types";
import path from "path";

// ─── GCP BigQuery (optional — gracefully skipped if unconfigured) ────────────
let bqInsert: ((row: Record<string, unknown>) => Promise<void>) | null = null;
try {
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    const { BigQuery } = require("@google-cloud/bigquery");
    const bigquery = new BigQuery();
    bqInsert = async (row) => {
      await bigquery.dataset("soc_metrics").table("incidents").insert([row]);
    };
    console.log("[BigQuery] Streaming enabled.");
  }
} catch (e) {
  console.warn("[BigQuery] Unavailable — skipping streaming:", (e as Error).message);
}

// ─── ADK Artifact Service (optional — gracefully skipped if unconfigured) ────
let saveArtifact: ((filename: string, data: unknown) => Promise<void>) | null = null;
try {
  const bucketName = process.env.GCS_BUCKET || "";
  if (bucketName) {
    const { GcsArtifactService } = require("@google/adk");
    const svc = new GcsArtifactService(bucketName);
    saveArtifact = async (filename, data) => {
      await svc.saveArtifact({
        appName: "ark-core",
        userId: "Analyst",
        sessionId: "live-session",
        filename,
        artifact: {
          inlineData: {
            data: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
            mimeType: "application/json"
          }
        }
      });
    };
    console.log("[ADK] GCS artifact service enabled.");
  } else {
    // File-based fallback
    const { FileArtifactService } = require("@google/adk");
    const svc = new FileArtifactService(path.join(__dirname, "..", "data", "artifacts"));
    saveArtifact = async (filename, data) => {
      await svc.saveArtifact({
        appName: "ark-core",
        userId: "Analyst",
        sessionId: "live-session",
        filename,
        artifact: {
          inlineData: {
            data: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
            mimeType: "application/json"
          }
        }
      });
    };
    console.log("[ADK] File artifact service enabled.");
  }
} catch (e) {
  console.warn("[ADK] Unavailable — artifact persistence skipped:", (e as Error).message);
}

// ─── In-memory state ─────────────────────────────────────────────────────────
const stats: AgentStats = {
  total_incidents: 0,
  total_cost_usd: 0,
  avg_latency_ms: 0,
  model_breakdown: {},
  memory_hits: 0,
  high_severity_incidents: 0
};

const telemetry: TelemetryPoint[] = [];
const reports: IncidentReport[] = [];

// ─── LLM output parser ────────────────────────────────────────────────────────
function parseModelOutput(text: string): { summary: string; pattern: string; action: string; confidence: number } {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
        summary?: string;
        pattern?: string;
        action?: string;
        confidence?: number;
      };
      if (parsed.summary && parsed.pattern && parsed.action) {
        return {
          summary: parsed.summary,
          pattern: parsed.pattern,
          action: parsed.action,
          confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.7)))
        };
      }
    }
  } catch {
    // fall through
  }

  const summaryMatch = text.match(/SUMMARY\s*:\s*(.+)/i);
  const patternMatch = text.match(/PATTERN\s*:\s*(.+)/i);
  const actionMatch = text.match(/ACTION\s*:\s*(.+)/i);

  return {
    summary: summaryMatch?.[1]?.trim() ?? "Unable to extract summary.",
    pattern: patternMatch?.[1]?.trim() ?? "Unable to extract pattern.",
    action: actionMatch?.[1]?.trim() ?? "Escalate to on-site security supervisor.",
    confidence: 0.55
  };
}

// ─── Core event processor ─────────────────────────────────────────────────────
export async function processEvent(event: SiemEvent): Promise<IncidentReport> {
  const memory = await recallSimilarIncidents(event);

  const prompt = [
    "You are Axon, a SOC intelligence analyst for physical security telemetry.",
    "Correlate incoming SIEM alerts with historical context.",
    "Return strict JSON with keys: summary, pattern, action, confidence.",
    "",
    `EVENT ID: ${event.id}`,
    `EVENT SOURCE: ${event.source}`,
    `EVENT TYPE: ${event.event_type}`,
    `SEVERITY: ${event.severity}`,
    `LOCATION: ${event.location}`,
    `TIMESTAMP: ${event.timestamp}`,
    `DESCRIPTION: ${event.description}`,
    `ACTOR ID: ${event.actor_id ?? "n/a"}`,
    `SENSOR ID: ${event.sensor_id ?? "n/a"}`,
    "",
    "MEMORY CONTEXT:",
    memory.context || "No prior correlated incidents found.",
    "",
    "Rules:",
    "- summary: one sentence with concrete risk.",
    "- pattern: explicitly state recurrence count or state no pattern.",
    "- action: provide operational steps with urgency.",
    "- confidence: number 0 to 1."
  ].join("\n");

  const completion = await routedCompletion(prompt, event.severity);
  const parsed = parseModelOutput(completion.text);

  const report: IncidentReport = {
    event_id: event.id,
    severity: event.severity,
    summary: parsed.summary,
    pattern: parsed.pattern,
    recommended_action: parsed.action,
    model_used: completion.model_used,
    cost_usd: completion.cost_usd,
    latency_ms: completion.latency_ms,
    timestamp: new Date().toISOString(),
    memory_hits: memory.hits,
    memory_graph: memory.graph,
    memory_context: memory.context || "No prior correlated incidents found.",
    confidence: parsed.confidence
  };

  // Update in-memory stats
  const priorCount = stats.total_incidents;
  stats.total_incidents += 1;
  stats.total_cost_usd += report.cost_usd;
  stats.avg_latency_ms =
    priorCount === 0
      ? report.latency_ms
      : (stats.avg_latency_ms * priorCount + report.latency_ms) / stats.total_incidents;
  stats.model_breakdown[report.model_used] = (stats.model_breakdown[report.model_used] ?? 0) + 1;
  if (memory.hits.length > 0) stats.memory_hits += 1;
  if (event.severity === "high") stats.high_severity_incidents += 1;

  telemetry.push({ timestamp: report.timestamp, latency_ms: report.latency_ms, cost_usd: report.cost_usd });
  while (telemetry.length > 120) telemetry.shift();

  reports.unshift(report);
  while (reports.length > 80) reports.pop();

  // Persist to memory store
  await storeIncident(event, report);

  // Optional: ADK artifact persistence
  if (saveArtifact) {
    try {
      await saveArtifact(`analyst-report-${report.event_id}.json`, report);
      console.log(`[ADK] Artifact saved: ${report.event_id}`);
    } catch (err) {
      console.error("[ADK Error]", err);
    }
  }

  // Optional: BigQuery streaming
  if (bqInsert) {
    try {
      await bqInsert({
        event_id: report.event_id,
        severity: report.severity,
        summary: report.summary,
        cost_usd: report.cost_usd,
        latency_ms: report.latency_ms,
        timestamp: report.timestamp
      });
      console.log(`[BigQuery] Streamed ${report.event_id}`);
    } catch (err) {
      console.error("[BigQuery Error]", err);
    }
  }

  return report;
}

export function getStats(): AgentStats {
  return { ...stats, model_breakdown: { ...stats.model_breakdown } };
}

export function getTelemetry(): TelemetryPoint[] {
  return [...telemetry];
}

export function getRecentReports(): IncidentReport[] {
  return [...reports];
}
