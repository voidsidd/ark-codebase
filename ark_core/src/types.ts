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

export interface BoundingBoxSample extends BoundingBox {
  timestamp: string;
}

export interface TrackedObject {
  id: string;
  label: string;
  camera_id: string;
  zone: string;
  first_seen: string;
  last_seen: string;
  frames_seen: number;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
  centroid: { x: number; y: number };
  velocity: { x: number; y: number };
  speed: number;
  state: "new" | "tracking" | "resolved" | "alert";
  risk_score: number;
  history: BoundingBoxSample[];
  alerts: string[];
}

export interface ZoneStatus {
  zone: string;
  camera_id: string;
  active_tracks: number;
  threat_level: Severity;
  alerts: string[];
  summary: string;
  updated_at: string;
  person_count: number;
  vehicle_count: number;
  suspicious_count: number;
}

export interface DetectionAlert {
  rule_id: string;
  severity: Severity;
  message: string;
  track_ids: string[];
}

export interface DetectionRecord {
  id: string;
  timestamp: string;
  camera_id: string;
  zone: string;
  raw_boxes: BoundingBox[];
  tracked_objects: TrackedObject[];
  alerts: DetectionAlert[];
  summary: string;
  threat_level: Severity;
  frame_score: number;
  event_id?: string;
  persisted_path?: string;
}

export interface IncidentCorrelation {
  detection_id?: string;
  track_ids: string[];
  correlation_score: number;
  summary: string;
  zone: string;
  camera_id: string;
  matched_alerts: string[];
}

export interface TimelineEntry {
  id: string;
  timestamp: string;
  kind: "detection" | "tracking" | "rule" | "incident";
  title: string;
  detail: string;
  severity: Severity;
  zone: string;
  camera_id: string;
  related_id?: string;
  event_id?: string;
  report_id?: string;
}

export interface IncidentLink {
  id: string;
  timestamp: string;
  event_id: string;
  report_id: string;
  detection_id?: string;
  track_ids: string[];
  zone: string;
  camera_id: string;
  correlation_score: number;
  summary: string;
}

export interface MonitoringSnapshot {
  latest_detection: DetectionRecord | null;
  detections: DetectionRecord[];
  tracked_objects: TrackedObject[];
  timeline: TimelineEntry[];
  zone_statuses: Record<string, ZoneStatus>;
  incident_links: IncidentLink[];
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
  correlation?: IncidentCorrelation;
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
  | "monitoring_state"
  | "detection"
  | "timeline"
  | "tracking"
  | "zone_status";

export interface StreamEnvelope {
  type: StreamEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}
