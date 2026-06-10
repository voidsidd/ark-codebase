FROM node:20-bullseye

# Install Python and pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip libgl1-mesa-glx libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy root files
COPY times_square_earthcam.mp4 /app/

# Install Python dependencies for the sensor
RUN pip3 install --no-cache-dir opencv-python-headless google-genai requests python-dotenv

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

# Expose port
EXPOSE 3000

# Start both services
CMD ["/app/start.sh"]
