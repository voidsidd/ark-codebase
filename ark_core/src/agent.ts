import { recallSimilarIncidents, storeIncident } from "./memory";
import { routedCompletion } from "./router";
import { AgentStats, IncidentReport, SiemEvent, TelemetryPoint } from "./types";
import { GcsArtifactService, FileArtifactService } from "@google/adk";
import { BigQuery } from "@google-cloud/bigquery";
import { publishCorrelatedReport } from "./pubsub";
import path from "path";

const bigquery = new BigQuery();
const BQ_DATASET = "soc_metrics";
const BQ_TABLE = "incidents";

const bucketName = process.env.GCS_BUCKET || "";
const artifactService = bucketName
  ? new GcsArtifactService(bucketName)
  : new FileArtifactService(path.join(__dirname, "..", "data", "artifacts"));

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
    // fall through to regex parser
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

  const priorCount = stats.total_incidents;
  stats.total_incidents += 1;
  stats.total_cost_usd += report.cost_usd;
  stats.avg_latency_ms =
    priorCount === 0
      ? report.latency_ms
      : (stats.avg_latency_ms * priorCount + report.latency_ms) / stats.total_incidents;
  stats.model_breakdown[report.model_used] = (stats.model_breakdown[report.model_used] ?? 0) + 1;
  if (memory.hits.length > 0) {
    stats.memory_hits += 1;
  }
  if (event.severity === "high") {
    stats.high_severity_incidents += 1;
  }

  telemetry.push({
    timestamp: report.timestamp,
    latency_ms: report.latency_ms,
    cost_usd: report.cost_usd
  });

  while (telemetry.length > 120) {
    telemetry.shift();
  }

  reports.unshift(report);
  while (reports.length > 80) {
    reports.pop();
  }

  await storeIncident(event, report);

  // Save report as an ADK artifact with Analyst and Commander roles
  try {
    await artifactService.saveArtifact({
      appName: "ark-core",
      userId: "Analyst",
      sessionId: "live-session",
      filename: `analyst-report-${report.event_id}.json`,
      artifact: {
        inlineData: {
          data: Buffer.from(JSON.stringify(report, null, 2)).toString("base64"),
          mimeType: "application/json"
        }
      }
    });
    
    await artifactService.saveArtifact({
      appName: "ark-core",
      userId: "Commander",
      sessionId: "live-session",
      filename: `commander-signoff-${report.event_id}.json`,
      artifact: {
        inlineData: {
          data: Buffer.from(JSON.stringify({
            event_id: report.event_id,
            approved: true,
            action_taken: report.recommended_action,
            timestamp: new Date().toISOString()
          }, null, 2)).toString("base64"),
          mimeType: "application/json"
        }
      }
    });
    console.log(`[ADK] Orchestrated artifacts saved for Analyst and Commander: ${report.event_id}`);
  } catch (err) {
    console.error("[ADK Error] Failed to persist report artifact:", err);
  }

  // Publish final report to Pub/Sub
  publishCorrelatedReport(report).catch(err => console.error("Failed to publish correlated report", err));

  // Stream structured output directly into BigQuery for real-time dashboarding
  try {
    await bigquery.dataset(BQ_DATASET).table(BQ_TABLE).insert([{
      event_id: report.event_id,
      severity: report.severity,
      summary: report.summary,
      cost_usd: report.cost_usd,
      latency_ms: report.latency_ms,
      timestamp: report.timestamp
    }]);
    console.log(`[BigQuery] Streamed report ${report.event_id} to ${BQ_DATASET}.${BQ_TABLE}`);
  } catch (err) {
    console.error(`[BigQuery Error] Failed to stream report ${report.event_id}:`, err);
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
