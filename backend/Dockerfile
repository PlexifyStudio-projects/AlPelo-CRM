FROM python:3.11-slim

# System deps + Node.js 20 (for the embedded WhatsApp Web Baileys service)
# Both processes run side-by-side in this single container so we deploy as ONE Railway service.
RUN apt-get update && apt-get install -y \
        postgresql-client \
        curl \
        ca-certificates \
        gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node deps for the embedded WA Web service before copying the app
# (so changes in Python code don't bust the npm cache layer)
COPY wa-web-service/package.json /app/wa-web-service/package.json
RUN cd /app/wa-web-service && npm install --omit=dev

# Then copy the rest of the app
COPY . .

# Persistent dir for Baileys auth files (mount a Railway volume here to survive redeploys)
RUN mkdir -p /app/sessions

RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["bash", "/app/entrypoint.sh"]
