import cv2
import numpy as np
from dataclasses import dataclass

@dataclass
class GateResult:
    passed: bool
    foreground_ratio: float

class GmmBackgroundGate:
    def __init__(self, camera_type="rgb", history=500, varThreshold=16, detectShadows=False, min_foreground_ratio=0.005):
        self.camera_type = camera_type
        # Using MOG2 background subtractor
        self.subtractor = cv2.createBackgroundSubtractorMOG2(
            history=history, 
            varThreshold=varThreshold, 
            detectShadows=detectShadows
        )
        self.min_foreground_ratio = min_foreground_ratio

    def evaluate(self, frame) -> GateResult:
        if frame is None:
            return GateResult(passed=False, foreground_ratio=0.0)
        
        # Apply background subtraction
        fg_mask = self.subtractor.apply(frame)
        
        # Calculate ratio of foreground pixels
        non_zero = cv2.countNonZero(fg_mask)
        total_pixels = frame.shape[0] * frame.shape[1]
        ratio = non_zero / total_pixels if total_pixels > 0 else 0.0
        
        # If ratio exceeds threshold, motion/threat is passed
        passed = ratio >= self.min_foreground_ratio
        
        return GateResult(passed=passed, foreground_ratio=ratio)
