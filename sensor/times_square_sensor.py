import sys
import os
import cv2
import time
import requests
import asyncio
import json
import base64
import numpy as np
from datetime import datetime

from google import genai
from google.genai import types

# Load environment variables from sensor/.env or project root .env
from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

_base_url = os.getenv("ARK_SERVER_URL", "http://localhost:3000")
API_ENDPOINT = f"{_base_url}/api/events"
DETECTION_ENDPOINT = f"{_base_url}/api/detections"

# Load API keys pool for rotation
api_keys_str = os.getenv("GEMINI_API_KEYS", os.getenv("GEMINI_API_KEY", ""))
api_keys = [k.strip() for k in api_keys_str.split(",") if k.strip()]
key_index = 0

print(f"[*] Loaded {len(api_keys)} Gemini API key(s) for rotation.")

def get_next_client():
    global key_index
    if not api_keys:
        return None
    key = api_keys[key_index]
    key_index = (key_index + 1) % len(api_keys)
    try:
        return genai.Client(api_key=key)
    except Exception as e:
        print(f"[!] Error creating Gemini client: {e}")
        return None

# GCS Cloud Storage Setup
gcs_bucket_name = os.getenv("GCS_BUCKET", "")
storage_client = None
if gcs_bucket_name:
    try:
        from google.cloud import storage
        storage_client = storage.Client()
        print(f"[*] Google Cloud Storage active (Bucket: {gcs_bucket_name})")
    except Exception as e:
        print(f"[!] GCS unavailable, using local asset fallback: {e}")

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
    """Call Gemini Vision to analyze a frame. Returns structured detection JSON or None."""
    client = get_next_client()
    if not client:
        return None

    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    image_bytes = buffer.tobytes()

    prompt = """You are a security operations center (SOC) vision analyst monitoring a live Times Square camera feed.
Analyze this frame for physical security threats, anomalies, or notable crowd/traffic patterns.

Return ONLY valid JSON in this exact schema:
{
  "threat_detected": true or false,
  "anomaly_score": 0 to 100,
  "severity": "low" or "medium" or "high" or "critical",
  "description": "One sentence describing what you see — be specific about objects, people, vehicles.",
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

    for attempt in range(max(1, len(api_keys))):
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type='image/jpeg',
                    ),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                )
            )
            result = json.loads(response.text)
            print(f"    [Gemini] Score: {result.get('anomaly_score', 0)} | Severity: {result.get('severity', 'n/a')} | Boxes: {len(result.get('bounding_boxes', []))}")
            return result
        except Exception as e:
            print(f"[!] Gemini call failed (key {key_index-1}): {e}")
            if len(api_keys) > 1:
                print("[*] Rotating to next API key...")
                client = get_next_client()
            else:
                break

    return None


def push_detections(bounding_boxes, frame_time):
    """Push bounding box overlay data to the server for real-time canvas rendering."""
    try:
        requests.post(DETECTION_ENDPOINT, json={
            "boxes": bounding_boxes or [],
            "timestamp": frame_time
        }, timeout=2)
    except:
        pass


async def process_video_feed(video_source, camera_id="CAM-TS-01", zone="Times Square"):
    print(f"\n{'='*60}")
    print(f"  ARK CORE — Active Vision Ingestion Pipeline")
    print(f"  Camera: {camera_id} | Zone: {zone}")
    print(f"  API Keys: {len(api_keys)} loaded for rotation")
    print(f"  Source: {video_source}")
    print(f"{'='*60}\n")

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

    # Analysis interval: 1 frame every 8 seconds to stay within free-tier limits (7-8 RPM)
    analysis_interval = 8.0
    last_analysis_time = 0
    event_counter = 500
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
            ret, frame = cap.read()
            if not ret:
                if isinstance(video_source, str) and not video_source.startswith(("http://", "https://")):
                    print("[*] End of video — looping...")
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    last_analysis_time = 0
                    continue
                else:
                    break

            current_time = time.time()

            if current_time - last_analysis_time >= analysis_interval:
                last_analysis_time = current_time

                # Motion gate
                fgmask = fgbg.apply(frame)
                motion_pixels = np.sum(fgmask == 255)

                # Times Square is always busy — use a low threshold
                if motion_pixels < 500:
                    continue

                frames_analyzed += 1
                frame_time = datetime.now().isoformat() + "Z"
                print(f"\n[Frame #{frames_analyzed}] Analyzing at {datetime.now().strftime('%H:%M:%S')} (motion: {motion_pixels} px)")

                # ---- GEMINI VISION ANALYSIS ----
                result = await run_gemini_vision_call(frame)

                if result is None:
                    print("    [!] Vision API unavailable — skipping frame")
                    continue

                # Push bounding box data for real-time overlay regardless of threat level
                boxes = result.get("bounding_boxes", [])
                push_detections(boxes, frame_time)

                # Only create a SIEM event if a threat is actually detected
                if result.get("threat_detected", False) and result.get("anomaly_score", 0) >= 30:
                    event_counter += 1
                    event_id = f"SOC-TS-{event_counter}"

                    snapshot_url = upload_snapshot(frame, event_id)

                    severity_raw = result.get('severity', 'low').lower()
                    if severity_raw == 'critical':
                        severity_raw = 'high'

                    siem_event = {
                        "id": event_id,
                        "timestamp": frame_time,
                        "source": "camera_harness",
                        "location": zone,
                        "event_type": f"camera_{'threat' if severity_raw == 'high' else 'anomaly'}_detected",
                        "severity": severity_raw,
                        "description": f"Gemini Vision: {result.get('description', 'Anomaly detected')}",
                        "sensor_id": camera_id,
                        "snapshot_url": snapshot_url,
                        "bounding_boxes": boxes
                    }

                    try:
                        resp = requests.post(API_ENDPOINT, json=siem_event, timeout=5)
                        if resp.status_code == 201:
                            print(f"    [+] ALERT {event_id} → Ark Core SOC (Severity: {severity_raw.upper()}, Score: {result.get('anomaly_score')})")
                        else:
                            print(f"    [!] Server returned {resp.status_code}")
                    except Exception as ex:
                        print(f"    [!] Failed to push to SOC: {ex}")
                else:
                    print(f"    [—] No threat (score: {result.get('anomaly_score', 0)})")

            # Small sleep to prevent CPU spin (no cv2.waitKey needed — no GUI)
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
                "sensor_id": camera_id
            }

            try:
                resp = requests.post(API_ENDPOINT, json=siem_event, timeout=2)
                if resp.status_code == 201:
                    print(f"[Sim] {event_id} → SOC")
            except Exception as ex:
                print(f"[Sim] Push failed: {ex}")
    except KeyboardInterrupt:
        print("[*] Simulation stopped.")


if __name__ == "__main__":
    video_source = sys.argv[1] if len(sys.argv) > 1 else "times_square.mp4"
    if video_source.isdigit():
        video_source = int(video_source)

    asyncio.run(process_video_feed(video_source))
