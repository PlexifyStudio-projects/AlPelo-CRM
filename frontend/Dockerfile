FROM node:22-slim

WORKDIR /app

# Copiar package files primero (Docker layer caching)
COPY package*.json ./

# Instalar dependencias DENTRO del container (no del bind mount)
RUN npm install

# En dev mode, el código fuente viene del bind mount
# pero node_modules vive dentro del container (rápido)
EXPOSE 3000

CMD ["npx", "vite", "--host", "0.0.0.0"]
