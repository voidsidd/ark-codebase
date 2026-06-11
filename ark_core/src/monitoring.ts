import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  BoundingBox,
  DetectionAlert,
  DetectionRecord,
  IncidentCorrelation,
  IncidentLink,
  IncidentReport,
  MonitoringSnapshot,
  SiemEvent,
  Severity,
  TimelineEntry,
  TrackedObject,
  ZoneStatus
} from "./types";

const runtimeDir = path.join(__dirname, "..", "data", "runtime");
const statePath = path.join(runtimeDir, "monitoring-state.json");

type DetectionIngestPayload = {
  boxes: BoundingBox[];
  timestamp: string;
  camera_id?: string;
  zone?: string;
  event_id?: string;
  source?: string;
  threat_detected?: boolean;
};

type BoxRect = Pick<BoundingBox, "x" | "y" | "w" | "h">;

const severityRank: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2
};

function emptyState(): MonitoringSnapshot {
  return {
    latest_detection: null,
    detections: [],
    tracked_objects: [],
    timeline: [],
    zone_statuses: {},
    incident_links: []
  };
}

function safeDate(value: string | undefined | null): string {
  if (!value) {
    return new Date().toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function cloneState(): MonitoringSnapshot {
  return JSON.parse(JSON.stringify(state)) as MonitoringSnapshot;
}

function loadState(): MonitoringSnapshot {
  try {
    if (!fs.existsSync(statePath)) {
      return emptyState();
    }

    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<MonitoringSnapshot>;
    return {
      latest_detection: parsed.latest_detection ?? null,
      detections: Array.isArray(parsed.detections) ? parsed.detections : [],
      tracked_objects: Array.isArray(parsed.tracked_objects) ? parsed.tracked_objects : [],
      timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
      zone_statuses: parsed.zone_statuses && typeof parsed.zone_statuses === "object" ? parsed.zone_statuses : {},
      incident_links: Array.isArray(parsed.incident_links) ? parsed.incident_links : []
    };
  } catch (error) {
    console.error("[Monitoring] Failed to load persisted state:", error);
    return emptyState();
  }
}

function persistState(): void {
  try {
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
  } catch (error) {
    console.error("[Monitoring] Failed to persist state:", error);
  }
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9\s_-]/g, " ").replace(/\s+/g, " ");
}

function labelCategory(label: string): "person" | "vehicle" | "suspicious" | "other" {
  const normalized = normalizeLabel(label);
  if (/(person|people|man|woman|crowd|pedestrian|guard|worker|intruder)/.test(normalized)) {
    return "person";
  }
  if (/(car|truck|van|bus|vehicle|bike|motorcycle|suv|taxi|cab)/.test(normalized)) {
    return "vehicle";
  }
  if (/(backpack|bag|package|box|parcel|duffel|luggage|suitcase)/.test(normalized)) {
    return "suspicious";
  }
  return "other";
}

function centroid(box: BoundingBox): { x: number; y: number } {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

function iou(a: BoxRect, b: BoxRect): number {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;

  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(ax2, bx2);
  const y2 = Math.min(ay2, by2);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function severityFromScore(score: number): Severity {
  if (score >= 2.5) {
    return "high";
  }
  if (score >= 1.2) {
    return "medium";
  }
  return "low";
}

function trackScore(track: TrackedObject, box: BoundingBox): number {
  const currentBox: BoxRect = { x: track.x, y: track.y, w: track.w, h: track.h };
  const overlap = iou(currentBox, box);
  const centerDistance = distance(track.centroid, centroid(box));
  const proximity = Math.max(0, 1 - centerDistance / 0.5);
  const labelMatch = normalizeLabel(track.label) === normalizeLabel(box.label) ? 1 : 0.6;
  return overlap * 0.55 + proximity * 0.35 + labelMatch * 0.1;
}

function createTrack(box: BoundingBox, timestamp: string, cameraId: string, zone: string): TrackedObject {
  const center = centroid(box);
  return {
    id: `trk-${randomUUID()}`,
    label: box.label,
    camera_id: cameraId,
    zone,
    first_seen: timestamp,
    last_seen: timestamp,
    frames_seen: 1,
    confidence: box.confidence,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    centroid: center,
    velocity: { x: 0, y: 0 },
    speed: 0,
    state: "new",
    risk_score: 0,
    history: [{ ...box, timestamp }],
    alerts: []
  };
}

function updateTrack(track: TrackedObject, box: BoundingBox, timestamp: string): TrackedObject {
  const center = centroid(box);
  const velocity = {
    x: center.x - track.centroid.x,
    y: center.y - track.centroid.y
  };
  const speed = Math.hypot(velocity.x, velocity.y);

  track.label = box.label;
  track.last_seen = timestamp;
  track.frames_seen += 1;
  track.confidence = box.confidence;
  track.x = box.x;
  track.y = box.y;
  track.w = box.w;
  track.h = box.h;
  track.centroid = center;
  track.velocity = velocity;
  track.speed = speed;
  track.state = track.frames_seen > 1 ? "tracking" : "new";
  track.history.push({ ...box, timestamp });
  if (track.history.length > 12) {
    track.history.shift();
  }

  return track;
}

function findTrackMatch(box: BoundingBox, cameraId: string, zone: string): TrackedObject | undefined {
  const candidates = state.tracked_objects.filter((track) => {
    if (track.camera_id !== cameraId || track.zone !== zone || track.state === "resolved") {
      return false;
    }
    const ageMs = Date.now() - new Date(track.last_seen).getTime();
    if (Number.isFinite(ageMs) && ageMs > 30_000) {
      return false;
    }
    return labelCategory(track.label) === labelCategory(box.label) || normalizeLabel(track.label) === normalizeLabel(box.label);
  });

  let best: TrackedObject | undefined;
  let bestScore = 0.3;
  for (const candidate of candidates) {
    const score = trackScore(candidate, box);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function computeAlerts(tracks: TrackedObject[], zone: string, timestamp: string): DetectionAlert[] {
  const alerts: DetectionAlert[] = [];
  const normalizedZone = zone.toLowerCase();
  const personTracks = tracks.filter((track) => labelCategory(track.label) === "person");
  const vehicleTracks = tracks.filter((track) => labelCategory(track.label) === "vehicle");
  const suspiciousTracks = tracks.filter((track) => labelCategory(track.label) === "suspicious");

  if (personTracks.length >= 5) {
    alerts.push({
      rule_id: "crowd-surge",
      severity: personTracks.length >= 8 ? "high" : "medium",
      message: `Crowd surge detected with ${personTracks.length} tracked people in ${zone}.`,
      track_ids: personTracks.map((track) => track.id)
    });
  }

  if (vehicleTracks.length > 0 && !/(garage|loading|dock|dropoff|service|parking)/.test(normalizedZone)) {
    alerts.push({
      rule_id: "vehicle-in-pedestrian-zone",
      severity: "high",
      message: `Vehicle presence detected in non-vehicle zone ${zone}.`,
      track_ids: vehicleTracks.map((track) => track.id)
    });
  }

  if (suspiciousTracks.length > 0) {
    const stationarySuspicious = suspiciousTracks.filter((track) => track.frames_seen >= 2 && track.speed < 0.02);
    alerts.push({
      rule_id: "unattended-object",
      severity: stationarySuspicious.length > 0 ? "high" : "medium",
      message: stationarySuspicious.length > 0
        ? `Stationary suspicious object(s) detected in ${zone}.`
        : `Suspicious object detected in ${zone}.`,
      track_ids: suspiciousTracks.map((track) => track.id)
    });
  }

  const loiteringTracks = personTracks.filter((track) => track.frames_seen >= 3 && track.speed < 0.015);
  if (loiteringTracks.length > 0) {
    alerts.push({
      rule_id: "loitering",
      severity: loiteringTracks.length >= 2 ? "high" : "medium",
      message: `Loitering behavior detected for ${loiteringTracks.length} person track(s) in ${zone}.`,
      track_ids: loiteringTracks.map((track) => track.id)
    });
  }

  const timestampMs = new Date(timestamp).getTime();
  const afterHours = Number.isFinite(timestampMs) ? new Date(timestampMs).getUTCHours() : 12;
  if (/(server room|control room|restricted|vault|security)/.test(normalizedZone) && personTracks.length > 0 && (afterHours < 6 || afterHours > 20)) {
    alerts.push({
      rule_id: "after-hours-access",
      severity: "high",
      message: `After-hours presence detected in restricted zone ${zone}.`,
      track_ids: personTracks.map((track) => track.id)
    });
  }

  return alerts;
}

function summarizeDetection(zone: string, tracks: TrackedObject[], alerts: DetectionAlert[]): string {
  const personCount = tracks.filter((track) => labelCategory(track.label) === "person").length;
  const vehicleCount = tracks.filter((track) => labelCategory(track.label) === "vehicle").length;
  const suspiciousCount = tracks.filter((track) => labelCategory(track.label) === "suspicious").length;
  const alertText = alerts.length ? alerts.map((alert) => alert.message).join(" ") : "No active behavioral rules triggered.";
  return `${zone}: ${tracks.length} active track(s) (${personCount} person, ${vehicleCount} vehicle, ${suspiciousCount} suspicious). ${alertText}`;
}

function updateZoneStatus(zone: string, cameraId: string, tracks: TrackedObject[], alerts: DetectionAlert[], timestamp: string): ZoneStatus {
  const personCount = tracks.filter((track) => labelCategory(track.label) === "person").length;
  const vehicleCount = tracks.filter((track) => labelCategory(track.label) === "vehicle").length;
  const suspiciousCount = tracks.filter((track) => labelCategory(track.label) === "suspicious").length;
  const riskScore = alerts.reduce((sum, alert) => sum + severityRank[alert.severity] + 1, 0) + suspiciousCount * 0.5 + vehicleCount * 0.8;
  const threat_level = severityFromScore(riskScore);

  const summary = summarizeDetection(zone, tracks, alerts);
  const zoneStatus: ZoneStatus = {
    zone,
    camera_id: cameraId,
    active_tracks: tracks.length,
    threat_level,
    alerts: alerts.map((alert) => alert.message),
    summary,
    updated_at: timestamp,
    person_count: personCount,
    vehicle_count: vehicleCount,
    suspicious_count: suspiciousCount
  };

  state.zone_statuses[zone] = zoneStatus;
  return zoneStatus;
}

function createTimelineEntry(kind: TimelineEntry["kind"], title: string, detail: string, severity: Severity, zone: string, cameraId: string, relatedId?: string, eventId?: string, reportId?: string): TimelineEntry {
  return {
    id: `${kind}-${randomUUID()}`,
    timestamp: new Date().toISOString(),
    kind,
    title,
    detail,
    severity,
    zone,
    camera_id: cameraId,
    related_id: relatedId,
    event_id: eventId,
    report_id: reportId
  };
}

function trimArrays(): void {
  if (state.detections.length > 300) {
    state.detections = state.detections.slice(0, 300);
  }
  if (state.timeline.length > 500) {
    state.timeline = state.timeline.slice(0, 500);
  }
  if (state.tracked_objects.length > 300) {
    state.tracked_objects = state.tracked_objects.slice(0, 300);
  }
  if (state.incident_links.length > 200) {
    state.incident_links = state.incident_links.slice(0, 200);
  }
}

let state: MonitoringSnapshot = loadState();

export function ingestDetection(payload: DetectionIngestPayload): DetectionRecord {
  const timestamp = safeDate(payload.timestamp);
  const cameraId = payload.camera_id?.trim() || "CAM-TS-01";
  const zone = payload.zone?.trim() || "Unassigned Zone";
  const boxes = Array.isArray(payload.boxes) ? payload.boxes : [];

  const updatedTrackIds = new Set<string>();
  const activeTracks: TrackedObject[] = [];

  for (const box of boxes) {
    const cleanBox: BoundingBox = {
      label: box.label || "object",
      confidence: Number.isFinite(box.confidence) ? box.confidence : 0,
      x: Number.isFinite(box.x) ? box.x : 0,
      y: Number.isFinite(box.y) ? box.y : 0,
      w: Number.isFinite(box.w) ? box.w : 0.1,
      h: Number.isFinite(box.h) ? box.h : 0.1
    };

    const matched = findTrackMatch(cleanBox, cameraId, zone);
    let track: TrackedObject;

    if (matched) {
      track = updateTrack(matched, cleanBox, timestamp);
    } else {
      track = createTrack(cleanBox, timestamp, cameraId, zone);
      state.tracked_objects.unshift(track);
    }

    track.risk_score += labelCategory(track.label) === "suspicious" ? 1.2 : labelCategory(track.label) === "vehicle" ? 0.8 : 0.35;
    if (track.frames_seen >= 3 && track.speed < 0.02) {
      track.risk_score += 0.8;
      track.state = "alert";
      if (!track.alerts.includes("persistent-low-motion")) {
        track.alerts.push("persistent-low-motion");
      }
    }
    if (track.risk_score > 3) {
      track.state = "alert";
    }

    updatedTrackIds.add(track.id);
    activeTracks.push(track);
  }

  for (const track of state.tracked_objects) {
    if (track.camera_id !== cameraId || track.zone !== zone || updatedTrackIds.has(track.id) || track.state === "resolved") {
      continue;
    }
    const ageMs = new Date(timestamp).getTime() - new Date(track.last_seen).getTime();
    if (Number.isFinite(ageMs) && ageMs > 20_000) {
      track.state = "resolved";
    }
  }

  const alerts = computeAlerts(activeTracks, zone, timestamp);
  const zoneStatus = updateZoneStatus(zone, cameraId, activeTracks, alerts, timestamp);
  const summary = summarizeDetection(zone, activeTracks, alerts);
  const threat_level = zoneStatus.threat_level;
  const frame_score = activeTracks.reduce((score, track) => score + track.risk_score, 0) + alerts.reduce((score, alert) => score + severityRank[alert.severity] + 0.5, 0);

  const detection: DetectionRecord = {
    id: `det-${randomUUID()}`,
    timestamp,
    camera_id: cameraId,
    zone,
    raw_boxes: boxes,
    tracked_objects: activeTracks.map((track) => ({ ...track, history: [...track.history] })),
    alerts,
    summary,
    threat_level,
    frame_score,
    event_id: payload.event_id
  };

  state.latest_detection = detection;
  state.detections.unshift(detection);
  state.timeline.unshift(
    createTimelineEntry("detection", `Detection batch in ${zone}`, summary, threat_level, zone, cameraId, detection.id, payload.event_id)
  );
  state.timeline.unshift(
    createTimelineEntry(
      "tracking",
      `${activeTracks.length} tracked object(s) in ${zone}`,
      activeTracks.length
        ? activeTracks
            .map((track) => `${track.label}#${track.id.slice(-6)} ${Math.round(track.confidence * 100)}%`)
            .join("; ")
        : "No objects tracked in this frame.",
      threat_level,
      zone,
      cameraId,
      detection.id,
      payload.event_id
    )
  );

  for (const alert of alerts) {
    state.timeline.unshift(
      createTimelineEntry(
        "rule",
        alert.rule_id,
        alert.message,
        alert.severity,
        zone,
        cameraId,
        detection.id,
        payload.event_id
      )
    );
  }

  trimArrays();
  persistState();
  return detection;
}

function findBestDetectionForEvent(event: SiemEvent): DetectionRecord | null {
  const eventTimestamp = new Date(event.timestamp).getTime();
  const normalizedLocation = event.location.toLowerCase();

  let best: DetectionRecord | null = null;
  let bestScore = 0;

  for (const detection of state.detections) {
    const detectionTimestamp = new Date(detection.timestamp).getTime();
    const timeDelta = Number.isFinite(eventTimestamp) && Number.isFinite(detectionTimestamp)
      ? Math.abs(eventTimestamp - detectionTimestamp)
      : 60_000;
    if (timeDelta > 120_000) {
      continue;
    }

    let score = 0;
    if (detection.zone.toLowerCase() === normalizedLocation) {
      score += 0.45;
    } else if (detection.zone.toLowerCase().includes(normalizedLocation) || normalizedLocation.includes(detection.zone.toLowerCase())) {
      score += 0.3;
    }
    if (event.sensor_id && event.sensor_id.toLowerCase().includes(detection.camera_id.toLowerCase())) {
      score += 0.25;
    }
    score += Math.max(0, 0.25 - Math.min(timeDelta, 120_000) / 480_000);
    score += detection.alerts.length > 0 ? 0.15 : 0;
    score += detection.tracked_objects.some((track) => {
      const category = labelCategory(track.label);
      return category === "vehicle" || category === "suspicious";
    }) ? 0.1 : 0;

    if (score > bestScore) {
      best = detection;
      bestScore = score;
    }
  }

  return best;
}

export function correlateIncident(event: SiemEvent, report: IncidentReport): { correlation: IncidentCorrelation; link: IncidentLink; timelineEntry: TimelineEntry } {
  const detection = findBestDetectionForEvent(event);
  const trackIds = detection ? detection.tracked_objects.map((track) => track.id) : [];
  const correlationScore = detection
    ? Math.min(1, 0.35 + detection.alerts.reduce((score, alert) => score + severityRank[alert.severity] * 0.1, 0) + (trackIds.length > 0 ? 0.2 : 0))
    : 0.15;
  const matchedAlerts = detection ? detection.alerts.map((alert) => alert.message) : [];

  const correlation: IncidentCorrelation = {
    detection_id: detection?.id,
    track_ids: trackIds,
    correlation_score: Number(correlationScore.toFixed(2)),
    summary: detection
      ? `Incident ${event.id} correlated to ${detection.tracked_objects.length} live track(s) in ${detection.zone}.`
      : `Incident ${event.id} recorded without a nearby detection match.`,
    zone: detection?.zone || event.location,
    camera_id: detection?.camera_id || event.sensor_id || "unknown",
    matched_alerts: matchedAlerts
  };

  const link: IncidentLink = {
    id: `inc-${randomUUID()}`,
    timestamp: new Date().toISOString(),
    event_id: event.id,
    report_id: report.event_id,
    detection_id: detection?.id,
    track_ids: trackIds,
    zone: correlation.zone,
    camera_id: correlation.camera_id,
    correlation_score: correlation.correlation_score,
    summary: correlation.summary
  };

  const timelineEntry = createTimelineEntry(
    "incident",
    `Incident ${event.id} correlated`,
    `${correlation.summary} Confidence ${Math.round(correlation.correlation_score * 100)}%.`,
    report.severity,
    correlation.zone,
    correlation.camera_id,
    detection?.id,
    event.id,
    report.event_id
  );

  state.incident_links.unshift(link);
  state.timeline.unshift(timelineEntry);
  trimArrays();
  persistState();

  return { correlation, link, timelineEntry };
}

export function getMonitoringSnapshot(): MonitoringSnapshot {
  return cloneState();
}

export function getLatestDetection(): DetectionRecord | null {
  return state.latest_detection ? JSON.parse(JSON.stringify(state.latest_detection)) as DetectionRecord : null;
}

export function getDetectionHistory(limit = 50): DetectionRecord[] {
  return state.detections.slice(0, limit).map((entry) => JSON.parse(JSON.stringify(entry)) as DetectionRecord);
}

export function getTimeline(limit = 100): TimelineEntry[] {
  return state.timeline.slice(0, limit).map((entry) => JSON.parse(JSON.stringify(entry)) as TimelineEntry);
}

export function getTrackedObjects(): TrackedObject[] {
  return state.tracked_objects.map((track) => JSON.parse(JSON.stringify(track)) as TrackedObject);
}

export function getZoneStatuses(): Record<string, ZoneStatus> {
  return JSON.parse(JSON.stringify(state.zone_statuses)) as Record<string, ZoneStatus>;
}

export function getIncidentLinks(): IncidentLink[] {
  return state.incident_links.map((link) => JSON.parse(JSON.stringify(link)) as IncidentLink);
}

export function updateDetectionEventId(detectionId: string, eventId: string): void {
  const detection = state.detections.find((entry) => entry.id === detectionId);
  if (!detection) {
    return;
  }
  detection.event_id = eventId;
  if (state.latest_detection?.id === detectionId) {
    state.latest_detection.event_id = eventId;
  }
  persistState();
}

export function appendDetectionTimeline(note: { zone: string; camera_id: string; title: string; detail: string; severity: Severity; kind?: TimelineEntry["kind"]; related_id?: string; event_id?: string; report_id?: string; }): TimelineEntry {
  const entry = createTimelineEntry(
    note.kind ?? "tracking",
    note.title,
    note.detail,
    note.severity,
    note.zone,
    note.camera_id,
    note.related_id,
    note.event_id,
    note.report_id
  );
  state.timeline.unshift(entry);
  trimArrays();
  persistState();
  return entry;
}
