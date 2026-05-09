FROM node:20-alpine as builder

WORKDIR /app

# Build-time arg — must be passed via --build-arg in Cloud Build
# NEXT_PUBLIC_* vars are inlined by `next build` and cannot be set at runtime
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 appuser && adduser -D -u 1001 -G appuser appuser

COPY --from=builder --chown=appuser:appuser /app/.next ./.next
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/package*.json ./

# Safe copy of public folder - won't fail if empty/missing
RUN mkdir -p ./public
COPY --from=builder --chown=appuser:appuser /app/public ./public

USER appuser

ENV PORT=3000

CMD ["npm", "run", "start"]