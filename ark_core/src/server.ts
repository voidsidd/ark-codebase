import cors from "cors";
import express from "express";
import path from "path";
import { getRecentReports, getStats, getTelemetry, processEvent, updateIncidentReport } from "./agent";
import { demoEvents } from "./demo-events";
import {
  correlateIncident,
  getDetectionHistory,
  getIncidentLinks,
  getLatestDetection,
  getMonitoringSnapshot,
  getTimeline,
  getTrackedObjects,
  getZoneStatuses,
  ingestDetection
} from "./monitoring";
import { publishRawEvent } from "./pubsub";
import { StreamEnvelope } from "./types";

const app = express();
const monitoringControl = {
  enabled: (process.env.ARK_MONITORING_ENABLED ?? "true").toLowerCase() !== "false",
  updated_at: new Date().toISOString()
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Serve the MP4 video file from the project root
app.use("/media", express.static(path.join(__dirname, "..", ".."), {
  extensions: ["mp4"],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".mp4")) {
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Accept-Ranges", "bytes");
    }
  }
}));

const clients = new Set<express.Response>();
let processingChain: Promise<void> = Promise.resolve();

function streamWrite(res: express.Response, envelope: StreamEnvelope): void {
  res.write(`event: ${envelope.type}\n`);
  res.write(`data: ${JSON.stringify(envelope)}\n\n`);
}

function broadcast(type: StreamEnvelope["type"], payload: Record<string, unknown>): void {
  const envelope: StreamEnvelope = {
    type,
    timestamp: new Date().toISOString(),
    payload
  };

  for (const client of clients) {
    streamWrite(client, envelope);
  }
}

function getMonitoringControl(): typeof monitoringControl {
  return { ...monitoringControl };
}

function setMonitoringControl(enabled: boolean): typeof monitoringControl {
  monitoringControl.enabled = enabled;
  monitoringControl.updated_at = new Date().toISOString();
  const payload = getMonitoringControl();
  broadcast("monitoring_state", payload);
  return payload;
}

setInterval(() => {
  broadcast("heartbeat", { ok: true });
}, 15000);

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/api/events", (_req, res) => {
  res.json(demoEvents);
});

app.get("/api/monitoring", (_req, res) => {
  res.json(getMonitoringControl());
});

app.post("/api/monitoring/toggle", (req, res) => {
  const body = req.body as { enabled?: unknown };
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : !monitoringControl.enabled;
  res.json(setMonitoringControl(enabled));
});

app.post("/api/events", (req, res) => {
  const newEvent = req.body;
  if (!newEvent || !newEvent.id) {
    res.status(400).json({ error: "Invalid event payload" });
    return;
  }
  
  // Insert at the beginning of the queue
  demoEvents.unshift(newEvent);
  
  // Notify frontend client about the new ingested alert immediately
  broadcast("ingest", { event: newEvent });
  
  // Publish to Pub/Sub for enterprise-level decoupling
  publishRawEvent(newEvent).catch(err => console.error("Failed to publish raw event", err));
  
  // Trigger processing pipeline automatically
  broadcast("processing", { eventId: newEvent.id, stage: "queued" });
  processingChain = processingChain.then(async () => {
    await processAndBroadcast(newEvent.id);
  });
  
  res.status(201).json({ ok: true, event: newEvent });
});

// Receive bounding box detections from the Python sensor and broadcast to frontend
app.post("/api/detections", (req, res) => {
  const detection = ingestDetection(req.body || {});
  broadcast("detection", {
    detection,
    boxes: detection.raw_boxes,
    timestamp: detection.timestamp,
    camera_id: detection.camera_id,
    zone: detection.zone,
    summary: detection.summary,
    alerts: detection.alerts,
    threat_level: detection.threat_level,
    tracked_objects: detection.tracked_objects
  });
  broadcast("tracking", { tracks: detection.tracked_objects, zone: detection.zone, camera_id: detection.camera_id });
  broadcast("zone_status", { status: getZoneStatuses()[detection.zone], detection_id: detection.id });
  broadcast("timeline", { entries: getTimeline(4), latest_detection: detection.id });
  res.status(200).json({ ok: true });
});

app.get("/api/detections", (_req, res) => {
  const latest = getLatestDetection();
  if (!latest) {
    res.json({ boxes: [], timestamp: "", tracked_objects: [], alerts: [], summary: "", threat_level: "low" });
    return;
  }

  res.json({
    ...latest,
    boxes: latest.raw_boxes
  });
});

app.get("/api/detections/history", (req, res) => {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));
  res.json(getDetectionHistory(limit));
});

app.get("/api/timeline", (req, res) => {
  const limit = Math.max(1, Math.min(250, Number(req.query.limit ?? 100)));
  res.json(getTimeline(limit));
});

app.get("/api/tracks", (_req, res) => {
  res.json(getTrackedObjects());
});

app.get("/api/zones", (_req, res) => {
  res.json(getZoneStatuses());
});

app.get("/api/state", (_req, res) => {
  res.json(getMonitoringSnapshot());
});

app.get("/api/incident-links", (_req, res) => {
  res.json(getIncidentLinks());
});

app.get("/api/stats", (_req, res) => {
  res.json(getStats());
});

app.get("/api/telemetry", (_req, res) => {
  res.json(getTelemetry());
});

app.get("/api/reports", (_req, res) => {
  res.json(getRecentReports());
});

app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  clients.add(res);
  streamWrite(res, {
    type: "heartbeat",
    timestamp: new Date().toISOString(),
    payload: { connected: true }
  });
  streamWrite(res, {
    type: "monitoring_state",
    timestamp: new Date().toISOString(),
    payload: getMonitoringControl()
  });

  req.on("close", () => {
    clients.delete(res);
  });
});

async function processAndBroadcast(eventId: string): Promise<void> {
  const event = demoEvents.find((entry) => entry.id === eventId);
  if (!event) {
    broadcast("error", { eventId, message: "Event not found" });
    return;
  }

  broadcast("processing", { eventId, stage: "memory_recall" });

  try {
    const report = await processEvent(event);
    const correlationResult = correlateIncident(event, report);
    const correlation = correlationResult.correlation;
    const enrichedReport = updateIncidentReport(event.id, { correlation }) ?? report;

    broadcast("report", { report: enrichedReport, event, correlation });
    broadcast("timeline", { entries: getTimeline(5), correlation, eventId: event.id });
    broadcast("tracking", { tracks: getTrackedObjects(), zone: correlation.zone, camera_id: correlation.camera_id });
    broadcast("zone_status", { status: getZoneStatuses()[correlation.zone], correlation });
    broadcast("stats", { stats: getStats(), telemetry: getTelemetry() });
  } catch (error) {
    broadcast("error", {
      eventId,
      message: error instanceof Error ? error.message : "Unknown processing failure"
    });
  }
}

app.post("/api/process", async (req, res) => {
  const { eventId } = req.body as { eventId?: string };
  if (!eventId) {
    res.status(400).json({ error: "eventId is required" });
    return;
  }

  const event = demoEvents.find((entry) => entry.id === eventId);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  broadcast("processing", { eventId, stage: "queued" });

  processingChain = processingChain.then(async () => {
    await processAndBroadcast(eventId);
  });

  await processingChain;

  const report = getRecentReports().find((entry) => entry.event_id === eventId);
  if (!report) {
    res.status(500).json({ error: "Failed to generate report" });
    return;
  }

  res.json(report);
});

app.post("/api/process-all", async (_req, res) => {
  broadcast("processing", { stage: "batch_start", count: demoEvents.length });

  processingChain = processingChain.then(async () => {
    for (let index = 0; index < demoEvents.length; index += 1) {
      const event = demoEvents[index];
      broadcast("processing", { eventId: event.id, stage: "queued", index: index + 1, total: demoEvents.length });
      await processAndBroadcast(event.id);
      if (index < demoEvents.length - 1) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 650);
        });
      }
    }

    broadcast("processing", { stage: "batch_complete" });
  });

  await processingChain;
  res.json({ ok: true });
});

export default app;
