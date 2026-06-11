import sys
import os
import cv2
import time
import requests
import asyncio
import json
import base64
import re
import numpy as np
from datetime import datetime

from google import genai
from google.genai import types

# Load environment variables from sensor/.env or project root .env
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

_base_url = os.getenv("ARK_SERVER_URL", "http://localhost:3000")
API_ENDPOINT = f"{_base_url}/api/events"
DETECTION_ENDPOINT = f"{_base_url}/api/detections"
MONITORING_ENDPOINT = f"{_base_url}/api/monitoring"


def parse_api_keys(raw_value):
    if not raw_value:
        return []
    parts = re.split(r"[\n,;]+", raw_value)
    return [part.strip() for part in parts if part.strip()]


# Same-project keys do not increase quota, so the pool is quota-aware and cools
# down exhausted keys instead of hammering the next one immediately.
api_keys = parse_api_keys(os.getenv("GEMINI_API_KEYS", os.getenv("GEMINI_API_KEY", "")))

QUOTA_COOLDOWN_BASE_SECONDS = float(os.getenv("GEMINI_QUOTA_COOLDOWN_SECONDS", "30"))
TRANSIENT_RETRY_BASE_SECONDS = float(os.getenv("GEMINI_TRANSIENT_RETRY_SECONDS", "5"))
MAX_COOLDOWN_SECONDS = float(os.getenv("GEMINI_MAX_COOLDOWN_SECONDS", "300"))
FALLBACK_HEARTBEAT_SECONDS = float(os.getenv("VISION_FALLBACK_HEARTBEAT_SECONDS", "30"))
MONITORING_POLL_SECONDS = float(os.getenv("MONITORING_POLL_SECONDS", "3"))
LOCAL_MOTION_MIN_AREA = int(os.getenv("VISION_LOCAL_MOTION_MIN_AREA", "900"))
LOCAL_BOX_LIMIT = int(os.getenv("VISION_LOCAL_BOX_LIMIT", "3"))

key_pool = []
rotation_cursor = 0
last_fallback_event_time = 0.0
last_fallback_heartbeat_time = 0.0
monitoring_enabled = True
last_monitoring_poll = 0.0
event_counter_seed = 500

# GCS Cloud Storage Setup
gcs_bucket_name = os.getenv("GCS_BUCKET", "")
storage_client = None
if gcs_bucket_name:
    try:
        from google.cloud import storage

        storage_client = storage.Client()
        print(f"[*] Google Cloud Storage active (Bucket: {gcs_bucket_name})")
    except Exception as exc:
        print(f"[!] GCS unavailable, using local asset fallback: {exc}")


def _coerce_seconds(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return max(0.0, float(value))
    if hasattr(value, "total_seconds"):
        try:
            return max(0.0, float(value.total_seconds()))
        except Exception:
            return None
    try:
        return max(0.0, float(str(value)))
    except Exception:
        return None


def _extract_http_status(exc):
    for attr in ("status_code", "status", "code"):
        value = getattr(exc, attr, None)
        try:
            if value is not None and int(value) > 0:
                return int(value)
        except Exception:
            pass

    response = getattr(exc, "response", None)
    if response is not None:
        for attr in ("status_code", "status"):
            value = getattr(response, attr, None)
            try:
                if value is not None and int(value) > 0:
                    return int(value)
            except Exception:
                pass

    return None


def _extract_retry_after_seconds(exc):
    candidates = []
    response = getattr(exc, "response", None)
    if response is not None:
        headers = getattr(response, "headers", None)
        if headers:
            for key in ("Retry-After", "retry-after"):
                if key in headers:
                    candidates.append(headers[key])

    for attr in ("retry_after", "retry_after_seconds", "retry_delay"):
        value = getattr(exc, attr, None)
        if value is not None:
            candidates.append(value)

    for candidate in candidates:
        seconds = _coerce_seconds(candidate)
        if seconds is not None:
            return seconds

    return None


def _classify_gemini_error(exc):
    message = str(exc).lower()
    status = _extract_http_status(exc)

    quota_signals = (
        "quota",
        "resource_exhausted",
        "rate limit",
        "too many requests",
        "429",
        "exceeded",
        "billing",
    )
    auth_signals = (
        "unauthorized",
        "invalid api key",
        "forbidden",
        "permission denied",
        "authentication",
        "401",
        "403",
    )

    if status == 429 or any(token in message for token in quota_signals):
        return "quota", _extract_retry_after_seconds(exc)
    if status in (401, 403) or any(token in message for token in auth_signals):
        return "auth", None
    return "transient", _extract_retry_after_seconds(exc)


def _build_key_state(api_key, index):
    state = {
        "index": index,
        "client": None,
        "disabled": False,
        "next_available_at": 0.0,
        "failures": 0,
        "last_error": "",
    }

    try:
        state["client"] = genai.Client(api_key=api_key)
    except Exception as exc:
        state["disabled"] = True
        state["next_available_at"] = float("inf")
        state["last_error"] = str(exc)
        print(f"[!] Gemini key #{index + 1} could not create a client and was disabled: {exc}")

    return state


def _init_key_pool():
    pool = [_build_key_state(api_key, index) for index, api_key in enumerate(api_keys)]
    active = len([state for state in pool if not state["disabled"]])
    if active > 0:
        print(f"[*] Loaded {active} Gemini API key(s) for quota-aware rotation.")
        if active > 1:
            print("[*] Note: keys from the same Google project still share quota; rotation only helps if the keys are backed by separate quota pools.")
    else:
        print("[*] No usable Gemini API keys loaded; vision will stay in fallback mode.")
    return pool


key_pool = _init_key_pool()


def _next_cooldown_wait(now):
    waits = [
        state["next_available_at"] - now
        for state in key_pool
        if not state["disabled"] and state["client"] is not None
    ]
    if not waits:
        return None
    return max(0.0, min(waits))


def _pool_is_cooling_down(now):
    active_states = [
        state
        for state in key_pool
        if not state["disabled"] and state["client"] is not None
    ]
    if not active_states:
        return False
    return all(state["next_available_at"] > now for state in active_states)


def _acquire_client(now):
    global rotation_cursor

    if not key_pool:
        return None, None

    for offset in range(len(key_pool)):
        index = (rotation_cursor + offset) % len(key_pool)
        state = key_pool[index]
        if state["disabled"] or state["client"] is None:
            continue
        if state["next_available_at"] <= now:
            rotation_cursor = (index + 1) % len(key_pool)
            return state["client"], state

    return None, None


def _mark_key_success(state):
    if state is None:
        return
    state["failures"] = 0
    state["next_available_at"] = 0.0
    state["last_error"] = ""


def _mark_key_failure(state, exc):
    if state is None:
        return "transient", 0.0

    category, retry_after = _classify_gemini_error(exc)
    now = time.time()
    state["failures"] += 1
    state["last_error"] = str(exc)

    if category == "auth":
        state["disabled"] = True
        state["next_available_at"] = float("inf")
        print(f"[!] Gemini key #{state['index'] + 1} disabled due to authentication error: {exc}")
        return category, 0.0

    if retry_after is None:
        if category == "quota":
            retry_after = min(
                MAX_COOLDOWN_SECONDS,
                QUOTA_COOLDOWN_BASE_SECONDS * (2 ** max(0, state["failures"] - 1)),
            )
        else:
            retry_after = min(
                MAX_COOLDOWN_SECONDS,
                TRANSIENT_RETRY_BASE_SECONDS * (2 ** max(0, state["failures"] - 1)),
            )

    state["next_available_at"] = now + retry_after
    return category, retry_after


def _sanitize_json_text(text):
    if not text:
        raise ValueError("Empty Gemini response")

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned


def _parse_generation_response(response):
    text = getattr(response, "text", None)
    if not text:
        candidate = getattr(response, "candidates", None)
        if candidate:
            first = candidate[0]
            parts = getattr(getattr(first, "content", None), "parts", None) or []
            if parts:
                text = getattr(parts[0], "text", "")
    return json.loads(_sanitize_json_text(text))


def _build_fallback_boxes(frame, fgmask):
    if fgmask is None or frame is None:
        return []

    try:
        mask = cv2.GaussianBlur(fgmask, (5, 5), 0)
        _, threshold = cv2.threshold(mask, 200, 255, cv2.THRESH_BINARY)
        kernel = np.ones((5, 5), np.uint8)
        cleaned = cv2.morphologyEx(threshold, cv2.MORPH_OPEN, kernel)
        cleaned = cv2.dilate(cleaned, kernel, iterations=1)
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    except Exception as exc:
        print(f"[!] Local fallback contour extraction failed: {exc}")
        return []

    if not contours:
        return []

    frame_h, frame_w = frame.shape[:2]
    boxes = []

    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        if area < LOCAL_MOTION_MIN_AREA:
            continue

        x, y, w, h = cv2.boundingRect(contour)
        pad_x = max(2, int(w * 0.1))
        pad_y = max(2, int(h * 0.1))
        x = max(0, x - pad_x)
        y = max(0, y - pad_y)
        w = min(frame_w - x, w + pad_x * 2)
        h = min(frame_h - y, h + pad_y * 2)

        if w <= 0 or h <= 0:
            continue

        motion_ratio = min(0.98, max(0.3, area / max(1.0, frame_w * frame_h * 0.015)))
        boxes.append(
            {
                "label": "motion_cluster",
                "confidence": round(motion_ratio, 2),
                "x": round(x / frame_w, 4),
                "y": round(y / frame_h, 4),
                "w": round(w / frame_w, 4),
                "h": round(h / frame_h, 4),
            }
        )

        if len(boxes) >= LOCAL_BOX_LIMIT:
            break

    return boxes


def push_health_event(camera_id, zone, description, analysis_state, retry_after=None, key_index=None, motion_pixels=None, fallback_boxes=0):
    """Push a lightweight camera health event so the dashboard stays alive during quota cooling."""
    global event_counter_seed

    event_counter_seed += 1
    event_id = f"SOC-TS-H{event_counter_seed}"

    payload = {
        "id": event_id,
        "timestamp": datetime.now().isoformat() + "Z",
        "source": "camera_harness",
        "location": zone,
        "event_type": "camera_vision_status",
        "severity": "low",
        "description": description,
        "sensor_id": camera_id,
        "analysis_state": analysis_state,
        "quota_retry_seconds": round(retry_after, 1) if isinstance(retry_after, (int, float)) else None,
        "quota_key_index": key_index,
        "motion_pixels": motion_pixels,
        "fallback_boxes": fallback_boxes,
    }

    try:
        resp = requests.post(API_ENDPOINT, json=payload, timeout=2)
        if resp.status_code != 201:
            print(f"    [!] Health event returned {resp.status_code}")
    except Exception as exc:
        print(f"    [!] Failed to push health event: {exc}")

    return event_id


def refresh_monitoring_state(force=False):
    global monitoring_enabled
    global last_monitoring_poll

    now = time.time()
    if not force and now - last_monitoring_poll < MONITORING_POLL_SECONDS:
        return monitoring_enabled

    last_monitoring_poll = now
    try:
        resp = requests.get(MONITORING_ENDPOINT, timeout=2)
        if resp.ok:
            payload = resp.json()
            if isinstance(payload, dict) and "enabled" in payload:
                monitoring_enabled = bool(payload["enabled"])
    except Exception:
        pass

    return monitoring_enabled


def upload_snapshot(frame, event_id):
    """Save threat frame locally (and optionally to GCS). Returns a URL usable by the frontend."""
    filename = f"{event_id}_threat.jpg"
    local_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ark_core", "public", "assets", filename)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    cv2.imwrite(local_path, frame)

    if storage_client and gcs_bucket_name:
        try:
            bucket = storage_client.bucket(gcs_bucket_name)
            blob = bucket.blob(f"threat_snapshots/{filename}")
            blob.upload_from_filename(local_path)
            # Return public HTTPS URL (not gs:// which browsers can't load)
            public_url = f"https://storage.googleapis.com/{gcs_bucket_name}/threat_snapshots/{filename}"
            print(f"    [GCS] Uploaded: {public_url}")
            return public_url
        except Exception as e:
            print(f"    [GCS Error] {e}")

    return f"/assets/{filename}"


async def run_gemini_vision_call(frame):
    """Call Gemini Vision to analyze a frame. Returns (result, status)."""
    now = time.time()
    client, state = _acquire_client(now)
    if not client or not state:
        wait_seconds = _next_cooldown_wait(now)
        return None, {
            "analysis_state": "cooldown" if wait_seconds else "unavailable",
            "retry_after": wait_seconds or 0.0,
            "key_index": None,
            "message": "No Gemini key is currently available.",
        }

    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    image_bytes = buffer.tobytes()

    prompt = """You are a security operations center (SOC) vision analyst monitoring a live Times Square camera feed.
Analyze this frame for physical security threats, anomalies, or notable crowd/traffic patterns.

Return ONLY valid JSON in this exact schema:
{
  "threat_detected": true or false,
  "anomaly_score": 0 to 100,
  "severity": "low" or "medium" or "high" or "critical",
  "description": "One sentence describing what you see - be specific about objects, people, vehicles.",
  "flags": ["FLAG_1", "FLAG_2"],
  "bounding_boxes": [
    {
      "label": "What this box identifies",
      "confidence": 0.0 to 1.0,
      "x": 0.0 to 1.0,
      "y": 0.0 to 1.0,
      "w": 0.0 to 1.0,
      "h": 0.0 to 1.0
    }
  ]
}

The bounding_boxes coordinates are NORMALIZED (0.0 to 1.0) relative to the full image dimensions.
x,y is the top-left corner. w,h are width and height fractions.
Include bounding boxes for ALL detected objects of interest (people clusters, vehicles, suspicious items).
If nothing notable is detected, set threat_detected to false and return an empty bounding_boxes array."""

    attempt_count = max(1, len(key_pool))
    last_status = {
        "analysis_state": "active",
        "retry_after": 0.0,
        "key_index": state["index"],
        "message": "",
    }

    for _ in range(attempt_count):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type="image/jpeg",
                    ),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            result = _parse_generation_response(response)
            print(f"    [Gemini] Score: {result.get('anomaly_score', 0)} | Severity: {result.get('severity', 'n/a')} | Boxes: {len(result.get('bounding_boxes', []))}")
            _mark_key_success(state)
            return result, {
                "analysis_state": "active",
                "retry_after": 0.0,
                "key_index": state["index"],
                "message": "Gemini analysis completed.",
            }
        except Exception as exc:
            category, retry_after = _mark_key_failure(state, exc)
            wait_text = f"retry in {retry_after:.1f}s" if retry_after else "retry later"
            print(f"[!] Gemini call failed (key #{state['index'] + 1}, {category}, {wait_text}): {exc}")

            if category == "auth":
                break

            client, state = _acquire_client(time.time())
            if not client or not state:
                break

            last_status = {
                "analysis_state": "cooldown" if _pool_is_cooling_down(time.time()) else "unavailable",
                "retry_after": _next_cooldown_wait(time.time()) or 0.0,
                "key_index": state["index"],
                "message": str(exc),
            }

    wait_seconds = _next_cooldown_wait(time.time())
    if wait_seconds is not None:
        return None, {
            "analysis_state": "cooldown",
            "retry_after": wait_seconds,
            "key_index": last_status.get("key_index"),
            "message": f"All Gemini keys are cooling down for about {wait_seconds:.1f}s.",
        }

    return None, {
        "analysis_state": "unavailable",
        "retry_after": 0.0,
        "key_index": last_status.get("key_index"),
        "message": last_status.get("message") or "Gemini vision unavailable.",
    }


def push_detections(bounding_boxes, frame_time, camera_id, zone, threat_detected=False):
    """Push bounding box overlay data to the server for real-time canvas rendering."""
    try:
        requests.post(
            DETECTION_ENDPOINT,
            json={
                "boxes": bounding_boxes or [],
                "timestamp": frame_time,
                "camera_id": camera_id,
                "zone": zone,
                "source": "camera_harness",
                "threat_detected": bool(threat_detected),
            },
            timeout=2,
        )
    except Exception:
        pass


async def process_video_feed(video_source, camera_id="CAM-TS-01", zone="Times Square"):
    global last_fallback_event_time
    global last_fallback_heartbeat_time
    global event_counter_seed

    print(f"\n{'=' * 60}")
    print("  ARK CORE - Active Vision Ingestion Pipeline")
    print(f"  Camera: {camera_id} | Zone: {zone}")
    print(f"  API Keys: {len([state for state in key_pool if not state['disabled']])} loaded for quota-aware rotation")
    print(f"  Source: {video_source}")
    print(f"{'=' * 60}\n")

    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"[!] Could not open video source: {video_source}")
        print("[*] Falling back to simulation loop...")
        await run_simulation_loop(camera_id, zone)
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    print(f"[*] Video: {total_frames} frames, {fps:.1f} FPS, {duration:.1f}s duration")

    # Analysis interval: 1 frame every 8 seconds to stay within free-tier limits.
    analysis_interval = 8.0
    last_analysis_time = 0
    frames_analyzed = 0

    # Background subtraction for motion gating
    fgbg = cv2.createBackgroundSubtractorMOG2(history=200, varThreshold=40, detectShadows=False)

    # Warm up the background model with first few frames
    print("[*] Warming up background model...")
    for _ in range(min(30, total_frames)):
        ret, frame = cap.read()
        if ret:
            fgbg.apply(frame)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    print("[*] Pipeline active. Analyzing frames and pushing to Ark Core SOC dashboard...\n")

    try:
        while True:
            if not refresh_monitoring_state():
                current_time = time.time()
                if current_time - last_fallback_heartbeat_time >= FALLBACK_HEARTBEAT_SECONDS:
                    last_fallback_heartbeat_time = current_time
                    push_health_event(
                        camera_id,
                        zone,
                        "Monitoring paused by operator; analysis is disabled.",
                        "paused",
                        retry_after=0.0,
                        key_index=None,
                        motion_pixels=None,
                        fallback_boxes=0,
                    )
                await asyncio.sleep(0.5)
                continue

            ret, frame = cap.read()
            if not ret:
                if isinstance(video_source, str) and not video_source.startswith(("http://", "https://")):
                    print("[*] End of video - looping...")
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    last_analysis_time = 0
                    continue
                break

            current_time = time.time()

            if current_time - last_analysis_time >= analysis_interval:
                last_analysis_time = current_time

                fgmask = fgbg.apply(frame)
                motion_pixels = int(np.sum(fgmask == 255))
                frame_time = datetime.now().isoformat() + "Z"

                if _pool_is_cooling_down(current_time) or not key_pool:
                    frames_analyzed += 1
                    fallback_boxes = _build_fallback_boxes(frame, fgmask)
                    retry_after = _next_cooldown_wait(current_time) or 0.0
                    if not key_pool:
                        cooldown_text = (
                            f"No Gemini keys are configured; using local motion fallback with {len(fallback_boxes)} box(es)."
                            if fallback_boxes
                            else "No Gemini keys are configured; keeping the feed alive with a status heartbeat."
                        )
                    else:
                        cooldown_text = (
                            f"Gemini quota cooling down for about {retry_after:.1f}s; using local motion fallback with {len(fallback_boxes)} box(es)."
                            if fallback_boxes
                            else f"Gemini quota cooling down for about {retry_after:.1f}s; keeping the feed alive with a status heartbeat."
                        )
                    print(f"\n[Frame #{frames_analyzed}] {cooldown_text}")

                    if fallback_boxes:
                        push_detections(fallback_boxes, frame_time, camera_id, zone, False)

                    if current_time - last_fallback_heartbeat_time >= FALLBACK_HEARTBEAT_SECONDS:
                        last_fallback_heartbeat_time = current_time
                        last_fallback_event_time = current_time
                        push_health_event(
                            camera_id,
                            zone,
                            cooldown_text,
                            "cooldown",
                            retry_after=retry_after,
                            key_index=None,
                            motion_pixels=motion_pixels,
                            fallback_boxes=len(fallback_boxes),
                        )
                    continue

                # Times Square is always busy - use a low threshold.
                if motion_pixels < 500:
                    continue

                frames_analyzed += 1
                print(f"\n[Frame #{frames_analyzed}] Analyzing at {datetime.now().strftime('%H:%M:%S')} (motion: {motion_pixels} px)")

                result, status = await run_gemini_vision_call(frame)

                if result is None:
                    print(f"    [!] Vision API unavailable - {status.get('message', 'skipping frame')}")
                    fallback_boxes = _build_fallback_boxes(frame, fgmask)
                    if fallback_boxes:
                        push_detections(fallback_boxes, frame_time, camera_id, zone, False)
                    if status.get("analysis_state") in ("cooldown", "unavailable"):
                        push_health_event(
                            camera_id,
                            zone,
                            status.get("message") or "Vision fallback engaged.",
                            status.get("analysis_state", "unavailable"),
                            retry_after=status.get("retry_after"),
                            key_index=status.get("key_index"),
                            motion_pixels=motion_pixels,
                            fallback_boxes=len(fallback_boxes),
                        )
                    continue

                # Push bounding box data to keep overlay active regardless of threat level.
                boxes = result.get("bounding_boxes", [])
                is_threat = result.get("threat_detected", False)
                push_detections(boxes, frame_time, camera_id, zone, is_threat)

                # Create a SIEM event if a threat is detected or if there are any detections.
                if is_threat or len(boxes) > 0:
                    event_counter_seed += 1
                    event_id = f"SOC-TS-{event_counter_seed}"

                    snapshot_url = upload_snapshot(frame, event_id)

                    severity_raw = result.get("severity", "low").lower()
                    if severity_raw == "critical":
                        severity_raw = "high"
                    if not is_threat:
                        severity_raw = "low"

                    siem_event = {
                        "id": event_id,
                        "timestamp": frame_time,
                        "source": "camera_harness",
                        "location": zone,
                        "event_type": f"camera_{'threat' if severity_raw == 'high' else 'anomaly'}_detected",
                        "severity": severity_raw,
                        "description": f"Gemini Vision: {result.get('description', 'Detected objects in frame')}",
                        "sensor_id": camera_id,
                        "snapshot_url": snapshot_url,
                        "bounding_boxes": boxes,
                    }

                    try:
                        resp = requests.post(API_ENDPOINT, json=siem_event, timeout=5)
                        if resp.status_code == 201:
                            print(f"    [+] ALERT {event_id} -> Ark Core SOC (Severity: {severity_raw.upper()}, Score: {result.get('anomaly_score')})")
                        else:
                            print(f"    [!] Server returned {resp.status_code}")
                    except Exception as ex:
                        print(f"    [!] Failed to push to SOC: {ex}")
                else:
                    print(f"    [-] No threat (score: {result.get('anomaly_score', 0)})")

            # Small sleep to prevent CPU spin (no cv2.waitKey needed - no GUI)
            await asyncio.sleep(0.01)

    except KeyboardInterrupt:
        print("\n[*] Pipeline stopped by user.")
    finally:
        cap.release()
        print(f"\n[*] Session complete. Frames analyzed: {frames_analyzed}")


async def run_simulation_loop(camera_id, zone):
    """Fallback: generate simulated events when no video source is available."""
    event_counter = 700
    print("[Sim] Running simulation mode (no video source)...")
    try:
        while True:
            await asyncio.sleep(10)
            event_counter += 1
            event_id = f"SOC-SIM-{event_counter}"

            siem_event = {
                "id": event_id,
                "timestamp": datetime.now().isoformat() + "Z",
                "source": "camera_harness",
                "location": zone,
                "event_type": "camera_anomaly_detected",
                "severity": "high" if event_counter % 3 == 0 else "medium",
                "description": "Simulated: Vehicle cluster detected in restricted pedestrian zone.",
                "sensor_id": camera_id,
            }

            try:
                resp = requests.post(API_ENDPOINT, json=siem_event, timeout=2)
                if resp.status_code == 201:
                    print(f"[Sim] {event_id} -> SOC")
            except Exception as ex:
                print(f"[Sim] Push failed: {ex}")
    except KeyboardInterrupt:
        print("[*] Simulation stopped.")


if __name__ == "__main__":
    video_source = sys.argv[1] if len(sys.argv) > 1 else "times_square.mp4"
    if video_source.isdigit():
        video_source = int(video_source)

    asyncio.run(process_video_feed(video_source))
