#!/bin/bash

# Navigate to ark_core and start the Express server in the background
echo "Starting Node.js server..."
cd /app/ark_core
npm start &

# Wait briefly for the server to be ready to accept connections
echo "Waiting for server to start..."
sleep 5

# Start the Python sensor in the foreground so the container stays alive
echo "Starting Python sensor..."
cd /app
python3 sensor/times_square_sensor.py times_square_earthcam.mp4
