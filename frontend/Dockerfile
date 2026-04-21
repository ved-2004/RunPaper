# ══════════════════════════════════════════════════════════
# RunPaper Frontend — Production Dockerfile for GCP Cloud Run
# ══════════════════════════════════════════════════════════

# Build stage: compile Next.js application
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js app (outputs to .next/)
RUN npm run build

# ──────────────────────────────────────────────────────────

# Runtime stage: minimal production image
FROM node:20-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1000 appuser && adduser -D -u 1000 -G appuser appuser

# Copy only built artifacts and runtime dependencies from builder
COPY --from=builder --chown=appuser:appuser /app/.next ./.next
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/package*.json ./
COPY --from=builder --chown=appuser:appuser /app/public ./public

# Switch to non-root user
USER appuser

# Expose port (Cloud Run listens on $PORT env var, default 3000)
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start Next.js production server
CMD ["npm", "run", "start"]
