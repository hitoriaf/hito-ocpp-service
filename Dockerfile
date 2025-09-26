# Multi-stage Dockerfile for OCPP Server

# Builder stage
FROM node:20-slim AS builder

# Install system dependencies including OpenSSL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm i

# Copy source code and config files
COPY . .

# Set a placeholder DATABASE_URL for prisma generate (it won't connect during build)
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder?schema=public"

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim AS production

# Install system dependencies including OpenSSL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci && \
    npm cache clean --force

# Copy built application and necessary files from builder stage
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/prisma ./prisma

# Set runtime DATABASE_URL (will be overridden by docker-compose)
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder?schema=public"

# Generate Prisma client for production environment
RUN npx prisma generate

# Change to non-root user
USER nodejs

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: 8080, path: '/health', timeout: 2000 }; const req = http.request(options, (res) => { if (res.statusCode === 200) process.exit(0); else process.exit(1); }); req.on('error', () => process.exit(1)); req.end();" || exit 1

# Start the application
CMD ["npm", "start"]