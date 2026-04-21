# RunPaper Backend — GCP Deployment Guide

Deploy the backend to **Google Cloud Run** (serverless, auto-scaling) in minutes.

---

## Prerequisites

- **GCP Project** with billing enabled
- **gcloud CLI** installed (`gcloud --version`)
- **Docker** installed locally (for testing)
- Environment variables ready:
  - `ANTHROPIC_API_KEY` (or OpenAI/Gemini keys)
  - `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
  - `JWT_SECRET` (min 32 chars; generate: `python -c "import secrets; print(secrets.token_hex(32))"`)
  - `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`
  - `BACKEND_URL` (your Cloud Run service URL)

---

## Option 1: Deploy via GCP Cloud Build (Recommended)

### 1. Connect GitHub to Cloud Build

```bash
# In GCP Console:
# 1. Go to Cloud Build → Triggers
# 2. Click "Create trigger"
# 3. Select "GitHub (Cloud Build GitHub App)"
# 4. Authenticate with GitHub
# 5. Select the RunPaper repo
# 6. Create trigger
```

### 2. Set Substitution Variables

In your Cloud Build trigger settings, add these substitutions:

| Variable | Value | Notes |
|---|---|---|
| `_SERVICE_NAME` | `runpaper-backend` | Cloud Run service name |
| `_REGION` | `us-central1` | GCP region (or your preferred) |

### 3. Set Environment Variables (Secrets)

```bash
# Create secrets in GCP Secret Manager
gcloud secrets create anthropic-api-key --data-file=<(echo $ANTHROPIC_API_KEY)
gcloud secrets create google-client-id --data-file=<(echo $GOOGLE_CLIENT_ID)
gcloud secrets create google-client-secret --data-file=<(echo $GOOGLE_CLIENT_SECRET)
gcloud secrets create jwt-secret --data-file=<(echo $JWT_SECRET)
gcloud secrets create supabase-url --data-file=<(echo $SUPABASE_URL)
gcloud secrets create supabase-service-key --data-file=<(echo $SUPABASE_SERVICE_KEY)
```

### 4. Grant Cloud Build Access to Secrets

```bash
PROJECT_ID=$(gcloud config get-value project)
CLOUD_BUILD_SA="${PROJECT_ID}@cloudbuild.gserviceaccount.com"

for secret in anthropic-api-key google-client-id google-client-secret jwt-secret supabase-url supabase-service-key; do
  gcloud secrets add-iam-policy-binding $secret \
    --member=serviceAccount:$CLOUD_BUILD_SA \
    --role=roles/secretmanager.secretAccessor
done
```

### 5. Update cloudbuild.yaml with Secrets

Edit `backend/cloudbuild.yaml` and add secrets to the Cloud Run deployment step:

```yaml
- name: 'gcr.io/cloud-builders/gcloud'
  args:
    - 'run'
    - 'deploy'
    - '${_SERVICE_NAME}'
    - '--image=gcr.io/$PROJECT_ID/${_SERVICE_NAME}:$SHORT_SHA'
    - '--region=${_REGION}'
    - '--platform=managed'
    - '--allow-unauthenticated'
    - '--memory=2Gi'
    - '--timeout=600'
    - '--max-instances=100'
    - '--set-secrets=ANTHROPIC_API_KEY=anthropic-api-key:latest'
    - '--set-secrets=GOOGLE_CLIENT_ID=google-client-id:latest'
    - '--set-secrets=GOOGLE_CLIENT_SECRET=google-client-secret:latest'
    - '--set-secrets=JWT_SECRET=jwt-secret:latest'
    - '--set-secrets=SUPABASE_URL=supabase-url:latest'
    - '--set-secrets=SUPABASE_SERVICE_KEY=supabase-service-key:latest'
```

### 6. Push to GitHub

```bash
git add backend/Dockerfile backend/.dockerignore backend/cloudbuild.yaml
git commit -m "chore: Add GCP Cloud Build and Cloud Run deployment config"
git push origin main
```

Cloud Build will automatically trigger and deploy to Cloud Run.

---

## Option 2: Manual Docker Build & Deploy

### 1. Build Locally (Test)

```bash
cd backend

# Build image
docker build -t runpaper-backend:latest .

# Test locally
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
  -e GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET \
  -e JWT_SECRET=$JWT_SECRET \
  -e SUPABASE_URL=$SUPABASE_URL \
  -e SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY \
  runpaper-backend:latest

# Check health
curl http://localhost:8000/api/health
```

### 2. Push to Google Container Registry

```bash
PROJECT_ID=$(gcloud config get-value project)

# Tag image
docker tag runpaper-backend:latest gcr.io/$PROJECT_ID/runpaper-backend:latest

# Push
docker push gcr.io/$PROJECT_ID/runpaper-backend:latest
```

### 3. Deploy to Cloud Run

```bash
PROJECT_ID=$(gcloud config get-value project)
REGION=us-central1

gcloud run deploy runpaper-backend \
  --image gcr.io/$PROJECT_ID/runpaper-backend:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 600 \
  --max-instances 100 \
  --set-env-vars \
    ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY,\
    GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID,\
    GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET,\
    JWT_SECRET=$JWT_SECRET,\
    SUPABASE_URL=$SUPABASE_URL,\
    SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY,\
    ENVIRONMENT=production
```

The command will output your Cloud Run service URL:
```
Service URL: https://runpaper-backend-xxxxx.run.app
```

---

## Cloud Run Configuration

| Setting | Value | Notes |
|---|---|---|
| **Memory** | 2 Gi | Sufficient for PDF processing + LLM calls |
| **Timeout** | 600s | Max pipeline runtime |
| **Max Instances** | 100 | Auto-scale up to 100 concurrent instances |
| **Min Instances** | 0 | Scale down to 0 when idle (save costs) |
| **Concurrency** | Default (80) | Max concurrent requests per instance |

---

## Post-Deployment Verification

```bash
SERVICE_URL="https://runpaper-backend-xxxxx.run.app"

# Health check
curl $SERVICE_URL/api/health

# Check logs
gcloud run logs read runpaper-backend --region us-central1 --limit 50

# View metrics
gcloud run describe runpaper-backend --region us-central1
```

---

## Cost Optimization

### Reduce Memory

If you don't process many large PDFs concurrently:

```bash
gcloud run update runpaper-backend --memory=1Gi --region=us-central1
```

### Use Cloud Scheduler for Cleanup Tasks

If using APScheduler for TTL cleanup, consider moving to Cloud Scheduler:

```bash
# Create a Cloud Task to trigger cleanup via HTTP
gcloud scheduler jobs create http cleanup-expired-papers \
  --location=us-central1 \
  --schedule="0 2 * * *" \
  --uri="https://runpaper-backend-xxxxx.run.app/api/cleanup" \
  --http-method=POST
```

---

## Troubleshooting

### "Build Failed" in Cloud Build

Check build logs:
```bash
gcloud builds log <BUILD_ID> --stream
```

### "Container fails to start" on Cloud Run

Check Cloud Run logs:
```bash
gcloud run logs read runpaper-backend --region us-central1
```

### "Permission denied" accessing secrets

Ensure Cloud Build service account has Secret Manager access:
```bash
gcloud secrets add-iam-policy-binding JWT_SECRET \
  --member=serviceAccount:$(gcloud config get-value project)@cloudbuild.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

---

## Advanced: Custom Domain

```bash
gcloud run services update-traffic runpaper-backend \
  --to-revisions LATEST=100 \
  --region us-central1

# Map custom domain (via GCP Console → Cloud Run → runpaper-backend → Manage Custom Domains)
```

---

## Environment Variables Reference

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | For Claude models |
| `GOOGLE_CLIENT_ID` | Yes | OAuth2 |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth2 |
| `JWT_SECRET` | Yes | Min 32 chars; must match frontend |
| `SUPABASE_URL` | Yes | PostgreSQL + Storage |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key (RLS bypass) |
| `BACKEND_URL` | Yes | Your Cloud Run URL |
| `FRONTEND_URL` | Yes | Frontend domain (CORS) |
| `LLM_PROVIDER` | No | `anthropic` (default), `openai`, `gemini` |
| `PIPELINE_TIMEOUT_SECONDS` | No | Default 600 (10 min) |
| `ENVIRONMENT` | No | `production`, `development`, `staging` |
| `SENTRY_DSN` | No | Error monitoring (optional) |

---

## Next Steps

1. Set up the **frontend** on Vercel or Cloud Run
2. Configure **CORS** in backend to match frontend domain
3. Run database migrations against Supabase
4. Test the full pipeline with a sample paper
