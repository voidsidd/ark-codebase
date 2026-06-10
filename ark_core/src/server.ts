import cors from "cors";
import express from "express";
import path from "path";
import { getRecentReports, getStats, getTelemetry, processEvent } from "./agent";
import { demoEvents } from "./demo-events";
import { publishRawEvent } from "./pubsub";
import { StreamEnvelope } from "./types";

const app = express();

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

// Latest bounding box detections for real-time overlay
let latestDetections: { boxes: unknown[]; timestamp: string } = { boxes: [], timestamp: "" };

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

setInterval(() => {
  broadcast("heartbeat", { ok: true });
}, 15000);

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/api/events", (_req, res) => {
  res.json(demoEvents);
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
  const { boxes, timestamp } = req.body || {};
  latestDetections = { boxes: boxes || [], timestamp: timestamp || new Date().toISOString() };
  broadcast("detection", { boxes: latestDetections.boxes, timestamp: latestDetections.timestamp });
  res.status(200).json({ ok: true });
});

app.get("/api/detections", (_req, res) => {
  res.json(latestDetections);
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
    broadcast("report", { report, event });
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
