export type Severity = "low" | "medium" | "high";

export type EventSource =
  | "badge_reader"
  | "door_contact"
  | "motion_sensor"
  | "camera_metadata"
  | "camera_harness"
  | "access_control"
  | "perimeter_sensor";

export interface BoundingBox {
  label: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SiemEvent {
  id: string;
  timestamp: string;
  source: EventSource;
  location: string;
  event_type: string;
  severity: Severity;
  description: string;
  actor_id?: string;
  sensor_id?: string;
  ticket_ref?: string;
  snapshot_url?: string;
  bounding_boxes?: BoundingBox[];
}

export interface MemoryHit {
  id: string;
  text: string;
  timestamp?: string | null;
  location?: string;
  source?: string;
  severity?: Severity;
  similarity: number;
}

export interface MemoryGraphNode {
  id: string;
  label: string;
  timestamp?: string | null;
  severity?: Severity;
  source?: string;
  location?: string;
  is_current?: boolean;
}

export interface MemoryGraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  reason: string;
}

export interface MemoryGraph {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
}

export interface IncidentReport {
  event_id: string;
  severity: Severity;
  summary: string;
  pattern: string;
  recommended_action: string;
  model_used: string;
  cost_usd: number;
  latency_ms: number;
  timestamp: string;
  memory_hits: MemoryHit[];
  memory_graph: MemoryGraph;
  memory_context: string;
  confidence: number;
}

export interface AgentStats {
  total_incidents: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  model_breakdown: Record<string, number>;
  memory_hits: number;
  high_severity_incidents: number;
}

export interface TelemetryPoint {
  timestamp: string;
  latency_ms: number;
  cost_usd: number;
}

export type StreamEventType =
  | "ingest"
  | "processing"
  | "report"
  | "stats"
  | "error"
  | "heartbeat"
  | "detection";

export interface StreamEnvelope {
  type: StreamEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}
