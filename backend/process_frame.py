import sys
import cv2
import asyncio
import json
from datetime import datetime
from ai_engine.hendricks_engine import HendricksEngine, DetectionMeta

async def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Missing arguments"}))
        return

    image_path = sys.argv[1]
    camera_id = sys.argv[2]
    zone = sys.argv[3]

    try:
        frame = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if frame is None:
            print(json.dumps({"error": "Failed to read image file"}))
            return

        meta = DetectionMeta(
            camera_id=camera_id,
            camera_zone=zone,
            timestamp=datetime.now()
        )
        
        engine = HendricksEngine()
        result = await engine.process_frame(frame, meta)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
