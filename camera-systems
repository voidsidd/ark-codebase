# 🦁 Anti-Poaching AI Detection Pipeline
### Cascade Architecture · Edge-First · Real-Time Alerting
 
---
 
## Table of Contents
 
1. [Pipeline Overview](#pipeline-overview)
2. [Stage 0 — Preprocessing](#stage-0--preprocessing)
3. [Stage 1 — Background Subtraction](#stage-1--background-subtraction)
4. [Stage 2 — Blob & Contour Filtering](#stage-2--blob--contour-filtering)
5. [Stage 3 — YOLOv8n Multi-Class Detection](#stage-3--yolov8n-multi-class-detection)
6. [Stage 4 — Context Rules Engine](#stage-4--context-rules-engine)
7. [Stage 5 — Gemma 4 Vision LLM Verifier](#stage-5--gemma-4-vision-llm-verifier)
8. [Stage 6 — Alert Router](#stage-6--alert-router)
9. [Full Context Rules Engine — Source Code](#full-context-rules-engine--source-code)
---
 
## Pipeline Overview
 
The core philosophy is a **suspicion funnel** — each stage is cheaper and faster than the next, and aggressively kills false positives before they reach expensive compute. By the time a frame reaches Gemma 4, it has already survived 5 filters. Less than **0.5% of original frames** ever touch the LLM.
 
```
Raw Video Feed  (100% of frames)
        │
        ▼
┌─────────────────────────────┐
│  STAGE 0 · Preprocessing    │  CLAHE, denoise, normalize
└─────────────────────────────┘
        │ 100%
        ▼
┌─────────────────────────────┐
│  STAGE 1 · Background Sub   │  Kill static/empty frames
└─────────────────────────────┘
        │ ~12%
        ▼
┌─────────────────────────────┐
│  STAGE 2 · Blob Filter      │  Kill wrong size/shape blobs
└─────────────────────────────┘
        │ ~6%
        ▼
┌─────────────────────────────┐
│  STAGE 3 · YOLOv8n          │  Detect persons, vehicles, weapons
└─────────────────────────────┘
        │ ~2%
        ▼
┌─────────────────────────────┐
│  STAGE 4 · Rules Engine     │  Score across 7 rule groups
└─────────────────────────────┘
        │ ~0.5%
        ├──────────────────────────────────────────────┐
        │ score ≥ 80 (CRITICAL)                        │ score 25–79
        ▼                                              ▼
┌──────────────────┐                    ┌──────────────────────────────┐
│  IMMEDIATE       │                    │  STAGE 5 · Gemma 4 Verifier  │
│  RANGER DISPATCH │                    │  LLM final verification      │
└──────────────────┘                    └──────────────────────────────┘
                                                       │
                                                       ▼
                                        ┌──────────────────────────────┐
                                        │  STAGE 6 · Alert Router      │
                                        │  SMS · Radio · Dashboard     │
                                        └──────────────────────────────┘
```
 
---
 
## Stage 0 — Preprocessing
 
**Purpose:** Normalize all incoming frames before any analysis. Makes every downstream stage more accurate.
 
**Compute:** CPU only · Latency: ~2ms/frame
 
### What it does
 
| Operation | Tool | Why |
|---|---|---|
| CLAHE (Contrast Limited Adaptive Histogram Equalization) | OpenCV | Enhances human heat signatures in thermal footage |
| Gaussian blur (3×3) | OpenCV | Reduces sensor noise, prevents false motion triggers |
| Frame resize to 640×640 | OpenCV | Standardizes resolution for YOLO input |
| RGB → Grayscale (for motion stages) | OpenCV | Motion detection doesn't need color |
| Timestamp + metadata injection | Python | Attaches time, zone, camera ID to every frame object |
 
### Code
 
```python
import cv2
import numpy as np
from datetime import datetime
 
def preprocess_frame(frame, camera_meta: dict) -> dict:
    # Resize
    frame_resized = cv2.resize(frame, (640, 640))
 
    # CLAHE on thermal channel (or luminance if RGB)
    if camera_meta['type'] == 'thermal':
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        frame_enhanced = clahe.apply(frame_resized)
    else:
        lab = cv2.cvtColor(frame_resized, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        lab = cv2.merge([clahe.apply(l), a, b])
        frame_enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
 
    # Denoise
    frame_denoised = cv2.GaussianBlur(frame_enhanced, (3, 3), 0)
 
    return {
        'frame': frame_denoised,
        'gray': cv2.cvtColor(frame_denoised, cv2.COLOR_BGR2GRAY),
        'timestamp': datetime.utcnow(),
        'camera_id': camera_meta['id'],
        'camera_zone': camera_meta['zone'],
        'camera_type': camera_meta['type'],
    }
```
 
---
 
## Stage 1 — Background Subtraction
 
**Purpose:** Kill frames where nothing is moving. The single highest-volume filter in the pipeline.
 
**Compute:** CPU only · Latency: ~3ms/frame · Eliminates: ~88% of frames
 
### How it works
 
Uses **MOG2** (Mixture of Gaussians v2) — a statistical model that learns what "background" looks like for each camera and flags pixels that deviate from it. Automatically adapts to:
- Gradual lighting changes (sunrise/sunset)
- Slow-moving background elements (swaying trees)
- Camera shake
**KNN** (K-Nearest Neighbours) subtractor is used as a fallback for high-noise thermal cameras — it's more robust to temperature gradients.
 
### Tuning parameters
 
| Parameter | Value | Reasoning |
|---|---|---|
| `history` | 500 frames | How long background model remembers |
| `varThreshold` | 50 | Higher = less sensitive, fewer false triggers from wind |
| `detectShadows` | True | Shadows marked separately, not as foreground |
| Min foreground area | 800px² | Kills insects, small birds |
 
### Code
 
```python
import cv2
 
class MotionFilter:
    def __init__(self, camera_type='rgb'):
        if camera_type == 'thermal':
            self.subtractor = cv2.createBackgroundSubtractorKNN(
                history=500, dist2Threshold=400, detectShadows=False
            )
        else:
            self.subtractor = cv2.createBackgroundSubtractorMOG2(
                history=500, varThreshold=50, detectShadows=True
            )
        self.min_area = 800  # px²
 
    def has_motion(self, gray_frame) -> bool:
        fg_mask = self.subtractor.apply(gray_frame)
 
        # Remove shadows (value=127) — keep only hard foreground (255)
        _, fg_mask = cv2.threshold(fg_mask, 200, 255, cv2.THRESH_BINARY)
 
        # Morphological cleanup — remove noise specks
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_DILATE, kernel)
 
        # Check if any blob is large enough to matter
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL,
                                        cv2.CHAIN_APPROX_SIMPLE)
        return any(cv2.contourArea(c) > self.min_area for c in contours)
```
 
> **Output:** `True` (pass to Stage 2) or `False` (discard frame)
 
---
 
## Stage 2 — Blob & Contour Filtering
 
**Purpose:** Analyze the *shape* of what moved. Kill detections that are geometrically implausible for a human or vehicle.
 
**Compute:** CPU only · Latency: ~2ms/frame · Eliminates: ~50% of surviving frames
 
### Filters applied
 
| Filter | Human Range | Vehicle Range | Reject if |
|---|---|---|---|
| Blob area | 2,000–80,000 px² | 10,000–200,000 px² | Outside both ranges |
| Aspect ratio (H/W) | 1.5–4.5 (tall) | 0.4–2.0 (wide) | Outside combined range |
| Solidity (area/convex hull) | > 0.4 | > 0.5 | Too irregular (bush, foliage) |
| Movement coherence | Smooth centroid delta | Smooth centroid delta | Jittering in place = wind |
 
### Code
 
```python
import cv2
import numpy as np
 
class BlobFilter:
    HUMAN_AREA = (2000, 80000)
    VEHICLE_AREA = (10000, 200000)
 
    def filter(self, fg_mask) -> list[dict]:
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL,
                                        cv2.CHAIN_APPROX_SIMPLE)
        valid_blobs = []
 
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < self.HUMAN_AREA[0]:
                continue  # Too small — animal, bird, insect
 
            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = h / max(w, 1)
            hull = cv2.convexHull(contour)
            hull_area = cv2.contourArea(hull)
            solidity = area / max(hull_area, 1)
 
            is_human_shape = (
                self.HUMAN_AREA[0] <= area <= self.HUMAN_AREA[1] and
                1.5 <= aspect_ratio <= 4.5 and
                solidity > 0.4
            )
            is_vehicle_shape = (
                self.VEHICLE_AREA[0] <= area <= self.VEHICLE_AREA[1] and
                0.4 <= aspect_ratio <= 2.0 and
                solidity > 0.5
            )
 
            if is_human_shape or is_vehicle_shape:
                valid_blobs.append({
                    'bbox': (x, y, w, h),
                    'area': area,
                    'aspect_ratio': aspect_ratio,
                    'centroid': (x + w // 2, y + h // 2),
                    'likely_type': 'human' if is_human_shape else 'vehicle',
                })
 
        return valid_blobs  # Empty list = discard frame
```
 
---
 
## Stage 3 — YOLOv8n Multi-Class Detection
 
**Purpose:** Run actual object detection on frames that passed geometry filtering. Expanded beyond basic person detection to flag all threat-relevant classes.
 
**Compute:** CPU or light GPU · Latency: ~15–30ms/frame · Eliminates: ~65% of surviving frames
 
### Detection Classes
 
| Class | Source | Threat Relevance |
|---|---|---|
| `person` | COCO (built-in) | Primary target |
| `car`, `truck`, `motorcycle`, `boat` | COCO (built-in) | Vehicle intrusion |
| `backpack`, `handbag` | COCO (built-in) | Gear/equipment carrying |
| `knife` | COCO (built-in) | Weapon |
| `rifle`, `bow` | Fine-tune required | Weapons — not in COCO |
| `fire`, `smoke` | Fine-tune required | Arson, camp fire |
| `tent`, `tarp` | Fine-tune required | Overnight encampment |
| `wire`, `trap`, `snare` | Fine-tune required | Passive poaching devices |
| `animal` (species-level) | Fine-tune required | Distinguish from humans; detect distressed animals |
| `flashlight` / `light blob` | Fine-tune required | Night movement indicator |
 
### Confidence strategy
 
> Set confidence threshold **low (0.35)** at this stage. You want high recall — catch everything suspicious. Precision is the job of Stage 4 and Stage 5. Missing a real poacher is worse than passing a false positive to the next stage.
 
### Code
 
```python
from ultralytics import YOLO
import numpy as np
 
class ThreatDetector:
    THREAT_CLASSES = {
        'person', 'car', 'truck', 'motorcycle', 'boat',
        'backpack', 'handbag', 'knife', 'rifle', 'bow',
        'fire', 'smoke', 'tent', 'tarp', 'wire', 'trap',
        'flashlight', 'animal'
    }
 
    def __init__(self, model_path='yolov8n_reserve.pt'):
        self.model = YOLO(model_path)
 
    def detect(self, frame) -> dict:
        results = self.model(frame, conf=0.35, verbose=False)[0]
        detections = {}
 
        for box in results.boxes:
            cls_name = self.model.names[int(box.cls)]
            if cls_name not in self.THREAT_CLASSES:
                continue
 
            conf = float(box.conf)
            bbox = box.xyxy[0].tolist()
 
            if cls_name not in detections:
                detections[cls_name] = {'count': 0, 'instances': []}
 
            detections[cls_name]['count'] += 1
            detections[cls_name]['instances'].append({
                'confidence': conf,
                'bbox': bbox,
            })
 
        return detections  # Empty dict = discard frame
```
 
### Fine-tuning guidance
 
For classes not in COCO, collect training data from:
- **FLIR ADAS Dataset** — thermal human & vehicle imagery
- **OpenImages Dataset** — fire, smoke, weapons
- **Custom capture** — traps, snares, tents in your specific terrain
Use **Roboflow** to annotate and augment. Fine-tune with:
```bash
yolo train model=yolov8n.pt data=reserve.yaml epochs=100 imgsz=640
```
 
---
 
## Stage 4 — Context Rules Engine
 
**Purpose:** Score each detection across 7 independent rule groups. Assign a final suspicion score. Route to immediate dispatch, LLM verification, or log-only.
 
**Compute:** CPU only · Pure Python logic · Latency: ~0.5ms/frame
 
### Scoring thresholds
 
| Score | Level | Action |
|---|---|---|
| ≥ 80 | 🔴 CRITICAL | Skip LLM. Immediate ranger dispatch. |
| 50–79 | 🟠 HIGH | Send to Gemma 4 → alert if confirmed |
| 25–49 | 🟡 MEDIUM | Send to Gemma 4 → log if confirmed |
| < 25 | 🟢 LOW | Log only. No alert. |
 
> See [Full Context Rules Engine Source Code](#full-context-rules-engine--source-code) below for complete implementation.
 
### Rule groups summary
 
| Group | Rules | Max Score Impact |
|---|---|---|
| 1. Time Rules | Night movement, twilight windows, daytime suppression | +40 / −10 |
| 2. Zone Rules | Boundary proximity, no-go zones, waterhole activity | +50 / −30 |
| 3. Object Combinations | Weapons + person, vehicle + person, traps, fire | +80 / −0 |
| 4. Movement Rules | Direction, speed, stationary lurking, dismount | +40 / −0 |
| 5. Behavioral Rules | Evasion, flashlight sweep, posture, gait | +40 / −0 |
| 6. Historical Rules | Hot zones, repeat patterns, known vehicles | +80 / −15 |
| 7. Environmental Rules | Wind, rain, moon phase, migration season | +10 / −20 |
 
---
 
## Stage 5 — Gemma 4 Vision LLM Verifier
 
**Purpose:** Final human-level semantic verification on frames that scored HIGH or MEDIUM. Gemma 4 sees the frame fresh — its job is to confirm or reject the rules engine's suspicion.
 
**Compute:** GPU required · Latency: 2–5 seconds/frame · Only sees ~0.45% of original frames
 
### Prompt design
 
```python
SYSTEM_PROMPT = """
You are an anti-poaching detection assistant for a wildlife reserve.
You will receive an image from a security camera. Analyze it carefully.
Respond ONLY with a valid JSON object. No preamble, no explanation outside the JSON.
"""
 
USER_PROMPT = """
Camera zone: {zone}
Time: {time} UTC
Flags from detection system: {flags}
 
Analyze this image and respond with:
{{
  "human_present": true/false,
  "human_count": <integer>,
  "vehicle_present": true/false,
  "weapons_visible": true/false,
  "suspicious_equipment": true/false,
  "threat_level": "none" | "low" | "medium" | "high" | "critical",
  "reasoning": "<one sentence>"
}}
"""
```
 
### Code
 
```python
import anthropic
import base64
import json
import cv2
 
client = anthropic.Anthropic()
 
def llm_verify(frame, alert_context: dict) -> dict:
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    image_b64 = base64.b64encode(buffer).decode('utf-8')
 
    prompt = USER_PROMPT.format(
        zone=alert_context['camera_zone'],
        time=alert_context['timestamp'],
        flags=', '.join(alert_context['flags'])
    )
 
    response = client.messages.create(
        model="gemma-4-31b",  # or self-hosted endpoint
        max_tokens=300,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": image_b64
                }},
                {"type": "text", "text": prompt}
            ]
        }]
    )
 
    return json.loads(response.content[0].text)
```
 
---
 
## Stage 6 — Alert Router
 
**Purpose:** Take a confirmed alert and dispatch it through every relevant channel simultaneously.
 
**Compute:** CPU · Network I/O · Latency: ~500ms (async)
 
### Alert channels
 
| Channel | Tool | Use Case |
|---|---|---|
| SMS to rangers | Twilio | Primary alert — works on basic phones |
| Radio gateway | MQTT broker | For rangers with radios in the field |
| Dashboard | WebSocket push | Command centre live view |
| Database log | PostgreSQL | Full audit trail for every alert |
| Photo archive | S3 / local NAS | Store flagged frames with metadata |
 
### Code
 
```python
import asyncio
from twilio.rest import Client
import paho.mqtt.client as mqtt
 
class AlertRouter:
    def __init__(self, config):
        self.twilio = Client(config['twilio_sid'], config['twilio_token'])
        self.mqtt = mqtt.Client()
        self.mqtt.connect(config['mqtt_host'])
        self.ranger_phones = config['ranger_phones']
        self.db = config['db_connection']
 
    async def dispatch(self, alert: dict, frame, llm_result: dict):
        level = alert['level']
        zone = alert['camera_zone']
        flags = ', '.join(alert['flags'])
        reasoning = llm_result.get('reasoning', '')
 
        message = (
            f"🚨 {level} ALERT — Zone: {zone}\n"
            f"Flags: {flags}\n"
            f"AI Assessment: {reasoning}\n"
            f"Time: {alert['timestamp']} UTC"
        )
 
        tasks = [
            self.send_sms(message),
            self.send_mqtt(alert),
            self.log_to_db(alert, llm_result),
            self.save_frame(frame, alert),
        ]
 
        await asyncio.gather(*tasks)
 
    async def send_sms(self, message):
        for phone in self.ranger_phones:
            self.twilio.messages.create(
                body=message, from_='+1XXXXXXXX', to=phone
            )
 
    async def send_mqtt(self, alert):
        import json
        self.mqtt.publish('reserve/alerts', json.dumps(alert))
```
 
---
---
 
# Full Context Rules Engine — Source Code
 
```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
import json
 
 
# ─────────────────────────────────────────────
#  DATA STRUCTURES
# ─────────────────────────────────────────────
 
@dataclass
class Alert:
    level: str          # CRITICAL | HIGH | MEDIUM | LOW
    action: str         # IMMEDIATE_RANGER_DISPATCH | LLM_VERIFY_THEN_ALERT | LLM_VERIFY_LOG | LOG_ONLY
    score: int
    flags: list[str]
    camera_id: str
    camera_zone: str
    timestamp: datetime
 
 
@dataclass
class DetectionMeta:
    """
    All contextual metadata attached to a frame alongside YOLO detections.
    Populated from: camera firmware, GPS, ranger tracking system,
    weather API, moon phase API, and frame history tracker.
    """
    camera_id: str
    camera_zone: str                          # BOUNDARY | INTERIOR | WATERHOLE | NO_GO | ROAD | TOURIST_PATH | RANGER_STATION | CORRIDOR
    timestamp: datetime
    camera_type: str                          # rgb | thermal
 
    movement_trajectory: list[tuple] = field(default_factory=list)   # [(x,y), ...] centroid history
    movement_speed_mps: float = 0.0
    movement_direction: str = 'UNKNOWN'       # TOWARD_BOUNDARY | AWAY_BOUNDARY | PARALLEL | ERRATIC
    vehicle_stopped: bool = False
    person_appeared_after_stop: bool = False
 
    detection_disappeared_on_light: bool = False
    light_sweep_detected: bool = False
    posture: str = 'UNKNOWN'                  # STANDING | CROUCHING | PRONE
    gait: str = 'NORMAL'                      # NORMAL | LADEN | RUNNING | CRAWLING
    head_direction_changes: int = 0
 
    wind_speed_kph: float = 0.0
    raining: bool = False
    post_rain_window: bool = False
    moon_phase: str = 'UNKNOWN'               # FULL | WANING | NEW | WAXING
    migration_season: bool = False
 
    vehicle_match_known_flagged: bool = False
 
 
# ─────────────────────────────────────────────
#  HISTORY STORE (replace with DB in production)
# ─────────────────────────────────────────────
 
class CameraHistoryStore:
    """
    Tracks per-camera alert history.
    In production: back this with PostgreSQL or Redis.
    """
    def __init__(self):
        self._store: dict[str, dict] = {}
 
    def load(self, camera_id: str) -> dict:
        return self._store.get(camera_id, {
            'alerts_last_7d': 0,
            'confirmed_poaching_same_hour': False,
            'high_false_positive_zone': False,
        })
 
    def record_alert(self, camera_id: str, alert: Alert):
        if camera_id not in self._store:
            self._store[camera_id] = {'alerts_last_7d': 0,
                                       'confirmed_poaching_same_hour': False,
                                       'high_false_positive_zone': False}
        self._store[camera_id]['alerts_last_7d'] += 1
 
 
history_store = CameraHistoryStore()
 
 
# ─────────────────────────────────────────────
#  CONTEXT RULES ENGINE
# ─────────────────────────────────────────────
 
class SuspicionEngine:
    """
    Scores each detection event across 7 independent rule groups.
    Returns a classified Alert with action routing.
 
    Scoring:
        ≥ 80  →  CRITICAL  →  Immediate ranger dispatch (bypass LLM)
        50–79 →  HIGH      →  LLM verify → alert if confirmed
        25–49 →  MEDIUM    →  LLM verify → log if confirmed
        < 25  →  LOW       →  Log only
    """
 
    def evaluate(self, detections: dict, meta: DetectionMeta) -> Alert:
        score = 0
        flags: list[str] = []
 
        score, flags = self._time_rules(detections, meta, score, flags)
        score, flags = self._zone_rules(detections, meta, score, flags)
        score, flags = self._object_combination_rules(detections, score, flags)
        score, flags = self._movement_rules(detections, meta, score, flags)
        score, flags = self._behavioral_rules(meta, score, flags)
        score, flags = self._historical_rules(meta, score, flags)
        score, flags = self._environmental_rules(meta, score, flags)
 
        return self._classify(score, flags, meta)
 
    # ─────────────────────────────────────────
    #  RULE GROUP 1 · TIME RULES
    # ─────────────────────────────────────────
 
    def _time_rules(self, detections: dict, meta: DetectionMeta,
                    score: int, flags: list) -> tuple:
        """
        Time of day is one of the strongest poaching indicators.
        Deep night activity is the #1 red flag across all reserves globally.
        """
        hour = meta.timestamp.hour
        has_person  = 'person'  in detections
        has_vehicle = any(v in detections for v in ['car', 'truck', 'motorcycle', 'boat'])
 
        # ── Deep night (midnight to 5am) ──────────────────────────────
        if has_person and 0 <= hour < 5:
            score += 40
            flags.append("PERSON_DEEP_NIGHT")
            # The single strongest time signal. No legitimate reason for
            # a person to be in the reserve between midnight and 5am.
 
        if has_vehicle and (hour >= 22 or hour < 5):
            score += 30
            flags.append("VEHICLE_NIGHT")
 
        # ── Twilight windows (dusk & dawn) ────────────────────────────
        if has_person and (5 <= hour < 7 or 18 <= hour < 20):
            score += 15
            flags.append("PERSON_TWILIGHT")
            # Poachers favour low-light windows where cameras struggle
            # but enough visibility remains to operate.
 
        # ── Active ranger hours (daytime suppression) ─────────────────
        if has_person and 9 <= hour < 16:
            score -= 10
            flags.append("DAYTIME_SUPPRESSED")
            # Rangers are active, tourists may be present. Much lower base risk.
 
        return score, flags
 
    # ─────────────────────────────────────────
    #  RULE GROUP 2 · ZONE RULES
    # ─────────────────────────────────────────
 
    def _zone_rules(self, detections: dict, meta: DetectionMeta,
                    score: int, flags: list) -> tuple:
        """
        Geographic context. Where something is detected matters as much
        as what is detected. Reserve zones are pre-mapped per camera.
        """
        zone       = meta.camera_zone
        hour       = meta.timestamp.hour
        has_person = 'person'  in detections
        has_vehicle= any(v in detections for v in ['car', 'truck', 'motorcycle'])
 
        # ── Hard boundary ─────────────────────────────────────────────
        if zone == 'BOUNDARY' and has_person:
            score += 35
            flags.append("PERSON_AT_BOUNDARY")
            # Reserve borders are the primary ingress/egress for poachers.
 
        # ── No-go zone ────────────────────────────────────────────────
        if zone == 'NO_GO' and has_person:
            score += 50
            flags.append("PERSON_IN_NO_GO_ZONE")
            # Instant escalation. These zones are off-limits to everyone,
            # including rangers, without direct dispatch authorisation.
 
        # ── Waterhole at night ────────────────────────────────────────
        if zone == 'WATERHOLE' and 0 <= hour < 6:
            score += 25
            flags.append("WATERHOLE_NIGHT_ACTIVITY")
            # Waterholes are prime ambush sites. Animals are predictable
            # there; poachers exploit this heavily.
 
        # ── Vehicle off designated road ───────────────────────────────
        if zone == 'INTERIOR' and has_vehicle:
            score += 40
            flags.append("VEHICLE_OFF_ROAD")
            # All legitimate vehicles stay on roads. Off-road = intrusion.
 
        # ── Known safe zones ─────────────────────────────────────────
        if zone == 'TOURIST_PATH' and has_person:
            score -= 20
            flags.append("TOURIST_ZONE_SUPPRESSED")
 
        if zone == 'RANGER_STATION':
            score -= 30
            flags.append("RANGER_STATION_SUPPRESSED")
 
        # ── Migration corridors ───────────────────────────────────────
        if zone == 'CORRIDOR' and has_person:
            score += 20
            flags.append("PERSON_IN_MIGRATION_CORRIDOR")
            # Poachers target migration routes to intercept herds.
 
        return score, flags
 
    # ─────────────────────────────────────────
    #  RULE GROUP 3 · OBJECT COMBINATION RULES
    # ─────────────────────────────────────────
 
    def _object_combination_rules(self, detections: dict,
                                   score: int, flags: list) -> tuple:
        """
        Individual detections carry weight. Combinations carry much more.
        A person is ambiguous. A person with a rifle at night is not.
        """
        d = set(detections.keys())
        person_count = detections.get('person', {}).get('count', 0)
 
        # ── Weapons ───────────────────────────────────────────────────
        if 'person' in d and 'rifle' in d:
            score += 60
            flags.append("ARMED_PERSON_RIFLE")
 
        if 'person' in d and 'bow' in d:
            score += 45
            flags.append("ARMED_PERSON_BOW")
            # Bows are silent — preferred by poachers in some regions.
 
        if 'person' in d and 'knife' in d:
            score += 30
            flags.append("PERSON_WITH_BLADE")
 
        # ── Gear combinations ─────────────────────────────────────────
        if 'person' in d and 'backpack' in d:
            score += 20
            flags.append("PERSON_WITH_GEAR")
            # Backpacks at night suggest premeditated entry with supplies.
 
        # ── Vehicle + person ──────────────────────────────────────────
        if 'person' in d and any(v in d for v in ['car', 'truck', 'motorcycle']):
            score += 20
            flags.append("PERSON_VEHICLE_TOGETHER")
            # Coordinated poaching often uses vehicles for transport and
            # persons on foot for the actual kill.
 
        # ── Environmental threats (no person required) ─────────────────
        if 'fire' in d or 'smoke' in d:
            score += 45
            flags.append("FIRE_DETECTED")
            # Fire in a reserve is always critical — poaching or disaster.
 
        # ── Passive poaching devices (no person required) ──────────────
        if 'wire' in d or 'trap' in d or 'snare' in d:
            score += 70
            flags.append("TRAP_DETECTED")
            # A trap in a reserve is a crime regardless of who placed it.
            # Detect empty traps → priority sweep of the area.
 
        # ── Encampment ────────────────────────────────────────────────
        if 'tent' in d or 'tarp' in d:
            score += 35
            flags.append("ENCAMPMENT_DETECTED")
            # Overnight stays without permits = either poachers or
            # illegal settlers. Both require investigation.
 
        # ── Group size escalation ─────────────────────────────────────
        if person_count >= 3:
            bonus = 20 * (person_count - 2)
            score += bonus
            flags.append(f"GROUP_DETECTED_{person_count}_PERSONS")
            # Groups of 3+ are rarely accidental intrusions.
            # Organised poaching syndicates operate in coordinated groups.
 
        return score, flags
 
    # ─────────────────────────────────────────
    #  RULE GROUP 4 · MOVEMENT RULES
    # ─────────────────────────────────────────
 
    def _movement_rules(self, detections: dict, meta: DetectionMeta,
                         score: int, flags: list) -> tuple:
        """
        How something moves is as important as what it is.
        Poachers exhibit very specific movement signatures:
        moving toward boundaries, stationary lurking, and
        vehicle-to-foot transitions.
        """
        speed     = meta.movement_speed_mps
        direction = meta.movement_direction
        has_person= 'person' in detections
 
        # ── Boundary approach ─────────────────────────────────────────
        if direction == 'TOWARD_BOUNDARY':
            score += 20
            flags.append("MOVING_TO_BOUNDARY")
 
        # ── Erratic movement ──────────────────────────────────────────
        if direction == 'ERRATIC':
            score += 25
            flags.append("ERRATIC_MOVEMENT")
            # Checking surroundings, doubling back, evasive movement.
            # Classic surveillance-aware behaviour.
 
        # ── Fast off-road vehicle ─────────────────────────────────────
        vehicle_classes = [v for v in ['car', 'truck', 'motorcycle']
                           if v in detections]
        if vehicle_classes and speed > 15:
            score += 20
            flags.append("HIGH_SPEED_OFFROAD")
            # Fleeing or rushing to an extraction point.
 
        # ── Stationary lurking ────────────────────────────────────────
        dangerous_zones = {'BOUNDARY', 'WATERHOLE', 'INTERIOR', 'NO_GO', 'CORRIDOR'}
        if speed < 0.3 and has_person and meta.camera_zone in dangerous_zones:
            score += 30
            flags.append("STATIONARY_LURKING")
            # A person standing very still in a dangerous zone at night
            # is likely lying in wait. Rangers move constantly.
 
        # ── Vehicle stop + person dismount ────────────────────────────
        if meta.vehicle_stopped and meta.person_appeared_after_stop:
            score += 35
            flags.append("VEHICLE_PERSON_DISMOUNT")
            # Strong indicator of coordinated drop-off for a poaching team.
            # Driver stays with vehicle; hunters proceed on foot.
 
        return score, flags
 
    # ─────────────────────────────────────────
    #  RULE GROUP 5 · BEHAVIORAL RULES
    # ─────────────────────────────────────────
 
    def _behavioral_rules(self, meta: DetectionMeta,
                           score: int, flags: list) -> tuple:
        """
        Behavioural signals derived from pose estimation (YOLOv8-pose),
        optical flow, and light analysis. These require additional
        inference but add high-precision signals.
        """
 
        # ── Light evasion ─────────────────────────────────────────────
        if meta.detection_disappeared_on_light:
            score += 40
            flags.append("EVASIVE_BEHAVIOR")
            # Subject vanished when another light source activated nearby.
            # The strongest single behavioural indicator of awareness.
 
        # ── Flashlight sweep ──────────────────────────────────────────
        if meta.light_sweep_detected:
            score += 30
            flags.append("FLASHLIGHT_SWEEP")
            # Systematic scanning of terrain with a handheld light.
            # Rangers use vehicle lights; a sweeping handheld = on foot.
 
        # ── Crouching posture ─────────────────────────────────────────
        if meta.posture == 'CROUCHING':
            score += 20
            flags.append("CROUCHING_POSTURE")
            # Low-profile movement = deliberate concealment.
 
        # ── Prone posture ─────────────────────────────────────────────
        if meta.posture == 'PRONE':
            score += 30
            flags.append("PRONE_POSTURE")
            # Crawling or lying flat = high-level evasion or sniper position.
 
        # ── Repeated surveillance checking ────────────────────────────
        if meta.head_direction_changes > 4:
            score += 15
            flags.append("SURVEILLANCE_CHECKING")
            # Head turning left-right repeatedly = checking for observers.
            # Detected via YOLOv8-pose keypoint tracking.
 
        # ── Heavy load gait ───────────────────────────────────────────
        if meta.gait == 'LADEN':
            score += 20
            flags.append("CARRYING_HEAVY_LOAD")
            # Gait analysis showing weight-bearing posture.
            # On exit = potentially carrying ivory, carcass, or equipment.
 
        # ── Running ───────────────────────────────────────────────────
        if meta.gait == 'RUNNING':
            score += 15
            flags.append("RUNNING_DETECTED")
            # Fleeing behaviour, or rapid approach to target animal.
 
        return score, flags
 
    # ─────────────────────────────────────────
    #  RULE GROUP 6 · HISTORICAL RULES
    # ─────────────────────────────────────────
 
    def _historical_rules(self, meta: DetectionMeta,
                           score: int, flags: list) -> tuple:
        """
        Pattern recognition over time. Poachers return to the same
        areas, use the same timing, and sometimes the same vehicles.
        Historical data dramatically improves precision.
        """
        history = history_store.load(meta.camera_id)
        recent_alerts = history.get('alerts_last_7d', 0)
 
        # ── Hot zone ──────────────────────────────────────────────────
        if recent_alerts >= 3:
            bonus = 15 * recent_alerts
            score += bonus
            flags.append(f"HOT_ZONE_{recent_alerts}_ALERTS_THIS_WEEK")
            # Zone has been active recently. Elevate everything.
 
        # ── Repeat time pattern ───────────────────────────────────────
        if history.get('confirmed_poaching_same_hour'):
            score += 25
            flags.append("REPEAT_TIME_PATTERN")
            # Previous confirmed poaching occurred at this hour.
            # Poachers are often creatures of habit.
 
        # ── Known flagged vehicle ─────────────────────────────────────
        if meta.vehicle_match_known_flagged:
            score += 80
            flags.append("KNOWN_FLAGGED_VEHICLE")
            # Vehicle plate or silhouette matched against a database of
            # vehicles previously linked to poaching incidents.
            # Near-certain threat — treat as CRITICAL regardless of time/zone.
 
        # ── High false-positive zone discount ─────────────────────────
        if history.get('high_false_positive_zone'):
            score -= 15
            flags.append("HIGH_FP_ZONE_DISCOUNT")
            # Camera has historically triggered many false positives
            # (e.g., near a tree with overhanging branches).
            # Reduce score to avoid alert fatigue for rangers.
 
        return score, flags
 
    # ─────────────────────────────────────────
    #  RULE GROUP 7 · ENVIRONMENTAL RULES
    # ─────────────────────────────────────────
 
    def _environmental_rules(self, meta: DetectionMeta,
                              score: int, flags: list) -> tuple:
        """
        Environmental conditions affect both the likelihood of poaching
        and the reliability of upstream detection stages.
        Adjust scores accordingly.
        """
 
        # ── High wind ─────────────────────────────────────────────────
        if meta.wind_speed_kph > 30:
            score -= 10
            flags.append("HIGH_WIND_DISCOUNT")
            # MOG2 background subtraction degrades in high wind.
            # Grass, foliage, and debris movement increases FP rate.
 
        # ── Active rain ───────────────────────────────────────────────
        if meta.raining:
            score -= 15
            flags.append("RAIN_DISCOUNT")
            # Poachers rarely operate in heavy rain (noise, tracking,
            # equipment degradation). Camera performance also drops.
 
        # ── Post-rain window ──────────────────────────────────────────
        if meta.post_rain_window:
            score += 10
            flags.append("POST_RAIN_ELEVATED")
            # Poachers sometimes wait for post-rain windows:
            # tracks are visible, animals cluster at water, ground is soft.
 
        # ── Full moon ─────────────────────────────────────────────────
        if meta.moon_phase == 'FULL':
            score += 5
            flags.append("FULL_MOON_ADJUSTMENT")
            # Natural ambient light allows operation without torches,
            # making poachers harder to detect but more operational.
 
        # ── New moon ──────────────────────────────────────────────────
        if meta.moon_phase == 'NEW':
            score += 8
            flags.append("NEW_MOON_ELEVATED")
            # Pitch dark = poachers rely on NVGs or thermal.
            # Historically higher poaching activity on new moon nights.
 
        # ── Migration season corridor ─────────────────────────────────
        if meta.migration_season and meta.camera_zone == 'CORRIDOR':
            score -= 20
            flags.append("MIGRATION_CORRIDOR_DISCOUNT")
            # Elevated animal movement expected. High FP rate for
            # large-animal detections that passed blob filter.
 
        return score, flags
 
    # ─────────────────────────────────────────
    #  CLASSIFICATION
    # ─────────────────────────────────────────
 
    def _classify(self, score: int, flags: list,
                  meta: DetectionMeta) -> Alert:
 
        if score >= 80:
            level  = 'CRITICAL'
            action = 'IMMEDIATE_RANGER_DISPATCH'
        elif score >= 50:
            level  = 'HIGH'
            action = 'LLM_VERIFY_THEN_ALERT'
        elif score >= 25:
            level  = 'MEDIUM'
            action = 'LLM_VERIFY_LOG'
        else:
            level  = 'LOW'
            action = 'LOG_ONLY'
 
        return Alert(
            level=level,
            action=action,
            score=score,
            flags=flags,
            camera_id=meta.camera_id,
            camera_zone=meta.camera_zone,
            timestamp=meta.timestamp,
        )
 
 
# ─────────────────────────────────────────────
#  USAGE EXAMPLE
# ─────────────────────────────────────────────
 
if __name__ == '__main__':
    engine = SuspicionEngine()
 
    # Simulated input from Stage 3 (YOLO) and metadata pipeline
    detections = {
        'person': {'count': 2, 'instances': [{'confidence': 0.87}]},
        'backpack': {'count': 1, 'instances': [{'confidence': 0.72}]},
    }
 
    meta = DetectionMeta(
        camera_id='CAM_042',
        camera_zone='BOUNDARY',
        timestamp=datetime(2025, 6, 14, 2, 35, 0),   # 2:35am
        camera_type='thermal',
        movement_direction='TOWARD_BOUNDARY',
        movement_speed_mps=1.2,
        posture='CROUCHING',
        head_direction_changes=6,
        moon_phase='NEW',
        wind_speed_kph=8,
        raining=False,
    )
 
    alert = engine.evaluate(detections, meta)
 
    print(json.dumps({
        'level':     alert.level,
        'action':    alert.action,
        'score':     alert.score,
        'flags':     alert.flags,
        'camera':    alert.camera_id,
        'zone':      alert.camera_zone,
        'timestamp': str(alert.timestamp),
    }, indent=2))
```
 
---
 
*Pipeline designed for edge-first deployment. Stages 0–4 run entirely on-device with no network dependency. Only Stage 5 (Gemma 4) and Stage 6 (alert routing) require outbound connectivity.*

          
Each Stage In Detail
Stage 1 — Background Subtraction (OpenCV)
The cheapest filter imaginable. Runs on CPU, no GPU needed.

Use MOG2 (Mixture of Gaussians) or KNN background subtractor
Flags only frames where something moved
Kills wind-blown grass, lighting changes if tuned right
Kills ~85-90% of frames instantly

Stage 2 — Blob / Contour Filtering
Still pure OpenCV, essentially free compute.

After motion detection, analyze the contour of what moved
Filter by: size (too small = animal/bird, too large = vehicle dealt with separately), aspect ratio, and movement trajectory
A human walking has a distinct vertical contour. A deer doesn't.

Stage 3 — Lightweight YOLOv8n (Person Class Only)
This is your workhorse filter. YOLOv8 nano is tiny — runs real-time on a Raspberry Pi.

Only care about the person class output
Confidence threshold tunable — set it low here (you want recall, not precision — let the LLM handle precision)
Fine-tune it on your specific camera angles and terrain if you can gather training data
For thermal footage: use a YOLO model specifically fine-tuned on IR imagery (these exist — FLIR has released datasets)

Stage 4 — Context Rules Engine

Stage 5 — Gemma 4 (Final Verifier)
By now you're only sending genuinely suspicious frames. You ask it something precise:

"This is a wildlife reserve camera. Does this image show a human? If yes, are they carrying equipment consistent with poaching (weapons, traps, bags)? Respond JSON: {human: bool, threat_level: low/medium/high, reasoning: string}"

Structured output, fast, cheap, and now actually accurate because Stage 1-4 did the hard filtering.
