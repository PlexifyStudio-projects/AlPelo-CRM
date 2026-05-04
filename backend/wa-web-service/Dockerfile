FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src ./src

# Persistent volume for auth files (one folder per session)
RUN mkdir -p /app/sessions
ENV SESSIONS_DIR=/app/sessions

EXPOSE 3100

CMD ["node", "src/index.js"]
