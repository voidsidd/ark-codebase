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

load_dotenv()

@dataclass
class DetectionMeta:
    camera_id: str
    camera_zone: str
    timestamp: datetime
    camera_type: str = 'rgb'

class MotionFilter:
    def __init__(self, camera_type='rgb'):
        if camera_type == 'thermal':
            self.subtractor = cv2.createBackgroundSubtractorKNN(history=500, dist2Threshold=400, detectShadows=False)
        else:
            self.subtractor = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=50, detectShadows=True)
        self.min_area = 800

    def has_motion(self, frame) -> bool:
        if frame is None: return False
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        fg_mask = self.subtractor.apply(gray)
        _, fg_mask = cv2.threshold(fg_mask, 200, 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return any(cv2.contourArea(c) > self.min_area for c in contours)

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
    def __init__(self):
        self.motion = MotionFilter()
        self.detector = ThreatDetector()
        self.rules = SuspicionEngine()
        self.verifier = VisionVerifier()
    async def process_frame(self, frame, meta: DetectionMeta):
        if frame is None: return None
        if not self.motion.has_motion(frame): return None
        detections = self.detector.detect(frame)
        if not detections: return None
        assessment = self.rules.evaluate(detections, meta)
        if assessment['level'] in ['HIGH', 'MEDIUM']:
            assessment['verification'] = await self.verifier.verify(frame, assessment)
        return {'timestamp': meta.timestamp.isoformat(), 'camera_id': meta.camera_id, 'zone': meta.camera_zone, 'detections': detections, 'assessment': assessment}
