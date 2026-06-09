import cv2
import numpy as np
import base64
import json
import os
import asyncio
from datetime import datetime
from dataclasses import dataclass
from ultralytics import YOLO
from anthropic import Anthropic
from dotenv import load_dotenv

from ai_engine.gmm_frame_gate import GmmBackgroundGate, GateResult

load_dotenv()

@dataclass
class DetectionMeta:
    camera_id: str
    camera_zone: str
    timestamp: datetime
    camera_type: str = 'rgb'


class MotionFilter(GmmBackgroundGate):
    """Backward-compatible: same GMM/MOG2 gate with legacy ``has_motion`` API."""

    def has_motion(self, frame) -> bool:
        return self.evaluate(frame).passed

class ThreatDetector:
    THREAT_CLASSES = {'person', 'car', 'truck', 'motorcycle', 'backpack', 'handbag', 'knife'}
    def __init__(self, model_path='yolov8n.pt'):
        # Check if model exists, if not it will be downloaded by Ultralytics
        self.model = YOLO(model_path)
    def detect(self, frame) -> dict:
        results = self.model(frame, conf=0.35, verbose=False)[0]
        detections = {}
        for box in results.boxes:
            cls_name = self.model.names[int(box.cls)]
            if cls_name not in self.THREAT_CLASSES: continue
            if cls_name not in detections: detections[cls_name] = {'count': 0, 'instances': []}
            detections[cls_name]['count'] += 1
            detections[cls_name]['instances'].append({'confidence': float(box.conf), 'bbox': box.xyxy[0].tolist()})
        return detections

class SuspicionEngine:
    def evaluate(self, detections: dict, meta: DetectionMeta) -> dict:
        score = 0
        flags = []
        if 'person' in detections:
            score += 40
            flags.append("PERSON_DETECTED")
            if 0 <= meta.timestamp.hour < 5:
                score += 40
                flags.append("PERSON_DEEP_NIGHT")
        if any(v in detections for v in ['car', 'truck', 'motorcycle']):
            score += 30
            flags.append("VEHICLE_DETECTED")
        level = 'LOW'
        if score >= 80: level = 'CRITICAL'
        elif score >= 50: level = 'HIGH'
        elif score >= 25: level = 'MEDIUM'
        return {'level': level, 'score': score, 'flags': flags}

class VisionVerifier:
    def __init__(self):
        key = os.getenv('ANTHROPIC_API_KEY')
        self.client = Anthropic(api_key=key) if key else None
    async def verify(self, frame, context: dict):
        if not self.client: return {"human_present": True, "threat_level": "high", "reasoning": "AI OFFLINE"}
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        img_b64 = base64.b64encode(buffer).decode('utf-8')
        try:
            response = self.client.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=300,
                messages=[{"role": "user", "content": [{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64}}, {"type": "text", "text": "Analyze for poaching."}]}]
            )
            return {"reasoning": response.content[0].text}
        except: return {"error": "Verifier failed"}

class HendricksEngine:
    """
    Per-frame pipeline (cheap -> expensive):

    1. ``GmmBackgroundGate`` — per-pixel mixture-of-Gaussians (MOG2) / KNN thermal:
       drop static frames before GPU-heavy detection.
    2. ``ThreatDetector`` — YOLO on remaining frames.
    3. ``SuspicionEngine`` — rule layer on detections.
    4. ``VisionVerifier`` — optional VLM only for selected threat levels.
    """

    def __init__(self):
        self.gate = GmmBackgroundGate(camera_type="rgb")
        self.motion = self.gate  # alias for tests / legacy attribute name
        self.detector = ThreatDetector()
        self.rules = SuspicionEngine()
        self.verifier = VisionVerifier()

    async def process_frame(self, frame, meta: DetectionMeta):
        if frame is None:
            return None
        gate_result: GateResult = self.gate.evaluate(frame)
        if not gate_result.passed:
            return None
        detections = self.detector.detect(frame)
        if not detections: return None
        assessment = self.rules.evaluate(detections, meta)
        if assessment['level'] in ['HIGH', 'MEDIUM']:
            assessment['verification'] = await self.verifier.verify(frame, assessment)
        return {'timestamp': meta.timestamp.isoformat(), 'camera_id': meta.camera_id, 'zone': meta.camera_zone, 'detections': detections, 'assessment': assessment}
