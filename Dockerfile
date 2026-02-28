# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Install backend dependencies
FROM node:20-alpine AS backend-build
RUN apk add --no-cache python3 make g++
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# Stage 3: Production image
FROM node:20-alpine
RUN apk add --no-cache nginx supervisor

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Copy backend
WORKDIR /app/backend
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY backend/ ./

# Copy config files
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisord.conf

# Create data directories
RUN mkdir -p /data/uploads /data/statements

EXPOSE 3010

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
