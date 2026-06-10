FROM node:20-bullseye

# Install Python and pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip libgl1-mesa-glx libglib2.0-0 curl && \
    rm -rf /var/lib/apt/lists/*

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

# Copy the MP4 directly (managed via Git LFS)
COPY times_square_earthcam.mp4 /app/times_square_earthcam.mp4

EXPOSE 3000
CMD ["/app/start.sh"]
