import { BigQuery } from "@google-cloud/bigquery";
import { IncidentReport, MemoryGraph, MemoryHit, SiemEvent } from "./types";

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? "";
const simulationMode = projectId.trim().length === 0;

const bigquery = simulationMode ? null : new BigQuery({ projectId });

interface SimMemory {
  id: string;
  content: string;
  timestamp: string;
  location: string;
  source: string;
  event_type: string;
  severity: "low" | "medium" | "high";
}

const simMemoryStore: SimMemory[] = [
  {
    id: "SIM-HIST-001",
    content: "Incident HIST-001 | Source: badge_reader | Location: Loading Dock B | Type: tailgating | Severity: medium | Summary: Dual entry on one badge during morning receiving shift | Pattern: Similar entry timing seen in prior shift handovers | Action: Temporary escort checkpoint deployed at dock vestibule",
    timestamp: "2026-05-12T08:21:00Z",
    location: "Loading Dock B",
    source: "badge_reader",
    event_type: "tailgating",
    severity: "medium"
  },
  {
    id: "SIM-HIST-002",
    content: "Incident HIST-002 | Source: motion_sensor | Location: Server Room Corridor | Type: after_hours_motion | Severity: high | Summary: Corridor motion persisted without badge activity for 14 minutes | Pattern: Repeated after-hours movement tied to maintenance vendor window | Action: Vendor escort policy tightened and overnight access list reduced",
    timestamp: "2026-05-14T01:42:00Z",
    location: "Server Room Corridor",
    source: "motion_sensor",
    event_type: "after_hours_motion",
    severity: "high"
  }
];

function tokenize(input: string): Set<string> {
  return new Set(input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length > 2));
}

function similarity(query: string, text: string): number {
  const q = tokenize(query);
  const t = tokenize(text);
  if (!q.size || !t.size) return 0;
  let overlap = 0;
  for (const token of q) if (t.has(token)) overlap += 1;
  return overlap / Math.max(q.size, 1);
}

function mapSimMemory(mem: SimMemory, score: number): MemoryHit {
  return {
    id: mem.id,
    text: mem.content,
    timestamp: mem.timestamp,
    location: mem.location,
    source: mem.source,
    severity: mem.severity,
    similarity: score
  };
}

function buildGraph(event: SiemEvent, hits: MemoryHit[]): MemoryGraph {
  const nodes = [
    { id: event.id, label: `${event.event_type} @ ${event.location}`, timestamp: event.timestamp, severity: event.severity, source: event.source, location: event.location, is_current: true },
    ...hits.map(hit => ({ id: hit.id, label: hit.text.slice(0, 80), timestamp: hit.timestamp, severity: hit.severity, source: hit.source, location: hit.location, is_current: false }))
  ];
  const edges = hits.map((hit, index) => ({ id: `${event.id}-${hit.id}`, source: event.id, target: hit.id, weight: Math.max(0.25, 1 - index * 0.15), reason: "event correlation" }));
  return { nodes, edges };
}

function formatContext(hits: MemoryHit[]): string {
  if (!hits.length) return "No prior correlated incidents found.";
  return hits.slice(0, 5).map((hit, index) => `${index + 1}. [${hit.timestamp}] (${hit.source}) ${hit.location}: ${hit.text}`).join("\n");
}

function recallSimulated(event: SiemEvent): { context: string; hits: MemoryHit[]; graph: MemoryGraph } {
  const query = `${event.location} ${event.event_type} ${event.source} ${event.description}`;
  const hits = simMemoryStore
    .map(mem => ({ mem, score: similarity(query, `${mem.content} ${mem.location} ${mem.event_type}`) }))
    .filter(item => item.score >= 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => mapSimMemory(item.mem, item.score));
  return { context: formatContext(hits), hits, graph: buildGraph(event, hits) };
}

export async function recallSimilarIncidents(event: SiemEvent): Promise<{ context: string; hits: MemoryHit[]; graph: MemoryGraph }> {
  if (simulationMode || !bigquery) return recallSimulated(event);

  try {
    const query = `SELECT id, content, timestamp, location, source, event_type, severity FROM \`ark_core.incident_memory\` WHERE location = @location LIMIT 5`;
    const options = {
      query: query,
      params: { location: event.location },
    };
    
    const [rows] = await bigquery.query(options);
    if (!rows || rows.length === 0) return recallSimulated(event);

    const hits = rows.map((r: any) => mapSimMemory({
      id: r.id, content: r.content, timestamp: r.timestamp?.value || new Date().toISOString(),
      location: r.location, source: r.source, event_type: r.event_type, severity: r.severity
    }, 0.85));

    return { context: formatContext(hits), hits, graph: buildGraph(event, hits) };
  } catch (err) {
    console.error("BigQuery recall failed:", err);
    return recallSimulated(event);
  }
}

export async function storeIncident(event: SiemEvent, report: IncidentReport): Promise<void> {
  const content = `Incident ${event.id} | Source: ${event.source} | Location: ${event.location} | Type: ${event.event_type} | Severity: ${event.severity} | Summary: ${report.summary}`;
  if (simulationMode || !bigquery) {
    simMemoryStore.unshift({ id: `${event.id}-sim-${Date.now()}`, content, timestamp: event.timestamp, location: event.location, source: event.source, event_type: event.event_type, severity: event.severity });
    return;
  }

  try {
    await bigquery.dataset('ark_core').table('incident_memory').insert([{
      id: event.id, content, timestamp: bigquery.datetime(event.timestamp),
      location: event.location, source: event.source, event_type: event.event_type, severity: event.severity
    }]);
  } catch (err) {
    console.error("BigQuery insert failed:", err);
  }
}

export function isMemorySimulationMode(): boolean {
  return simulationMode;
}
