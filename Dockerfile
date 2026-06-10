FROM node:20-bullseye

# Install Python, pip, and Google Cloud SDK (for gsutil)
RUN apt-get update && \
    apt-get install -y python3 python3-pip libgl1-mesa-glx libglib2.0-0 curl gnupg && \
    pip3 install --no-cache-dir google-cloud-storage && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies for the sensor
RUN pip3 install --no-cache-dir opencv-python-headless google-genai requests python-dotenv google-cloud-storage

# Copy ark_core and install Node.js dependencies
COPY ark_core /app/ark_core/
WORKDIR /app/ark_core
RUN npm install
RUN npm run build

# Copy sensor
COPY sensor /app/sensor/

# Copy start script
COPY start.sh /app/
RUN chmod +x /app/start.sh

WORKDIR /app

# Download the MP4 from GCS at build time
# The GCS_BUCKET build arg must be passed during docker build
ARG GCS_BUCKET=ark-adk-artifacts-sidzy4-ark-codebase
RUN pip3 install --no-cache-dir google-cloud-storage && \
    python3 -c "\
from google.cloud import storage; \
import os; \
bucket_name = os.environ.get('GCS_BUCKET', '${GCS_BUCKET}'); \
client = storage.Client(); \
bucket = client.bucket(bucket_name); \
blob = bucket.blob('media/times_square_earthcam.mp4'); \
blob.download_to_filename('/app/times_square_earthcam.mp4'); \
print('MP4 downloaded successfully')" || \
    echo "MP4 download failed — sensor will run in simulation mode"

# Expose port
EXPOSE 3000

# Start both services
CMD ["/app/start.sh"]
