#!/bin/bash
set -e

echo "Starting Node.js server..."
cd /app/ark_core
node dist/index.js &
NODE_PID=$!

echo "Waiting for server to start on port ${PORT:-3000}..."
for i in $(seq 1 30); do
  if curl -s "http://localhost:${PORT:-3000}/api/stats" > /dev/null 2>&1; then
    echo "Server is up!"
    break
  fi
  sleep 1
done

echo "Starting Python sensor..."
cd /app
ARK_SERVER_URL="http://localhost:${PORT:-3000}" python3 sensor/times_square_sensor.py times_square_earthcam.mp4 &

# Keep container alive — wait on Node process
wait $NODE_PID
