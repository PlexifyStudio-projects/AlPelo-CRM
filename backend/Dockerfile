FROM python:3.11-slim

RUN apt-get update && apt-get install -y postgresql-client ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Then copy the rest of the app
COPY . .

RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["bash", "/app/entrypoint.sh"]
