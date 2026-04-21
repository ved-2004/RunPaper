# ══════════════════════════════════════════════════════════
# RunPaper Backend — Production Dockerfile for GCP Cloud Run
# ══════════════════════════════════════════════════════════

# Build stage: compile Python dependencies
FROM python:3.11-slim as builder

WORKDIR /tmp

# Install build essentials for packages that need compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and pre-compile wheels
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /tmp/wheels -r requirements.txt

# ──────────────────────────────────────────────────────────

# Runtime stage: lean production image
FROM python:3.11-slim

WORKDIR /app

# Install only runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libffi8 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security (GCP best practice)
RUN useradd -m -u 1000 appuser

# Copy pre-built wheels from builder stage
COPY --from=builder /tmp/wheels /tmp/wheels
COPY --from=builder /tmp/requirements.txt .

# Install wheels
RUN pip install --no-cache /tmp/wheels/* && rm -rf /tmp/wheels

# Copy application code
COPY . .

# Set ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port (Cloud Run listens on $PORT env var, default 8080)
# But we use 8000 in uvicorn and let Cloud Run map it
ENV PORT=8000

# Health check (optional, useful for monitoring)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health').read()"

# Run uvicorn with proper signal handling for graceful shutdown
# --host 0.0.0.0 listens on all interfaces (required in containers)
# --port $PORT uses the environment variable (Cloud Run default: 8080)
# Use PORT env var if set, otherwise default to 8000
CMD exec uvicorn api.main:app \
    --host 0.0.0.0 \
    --port ${PORT:-8000} \
    --workers 3 \
    --access-log
