import { API_BASE_URL } from "./config";
import { getOrCreateTrialId } from "./trial";
import type { PaperRecord, PaperSummary } from "@/types/paper";

// ── Typed errors ──────────────────────────────────────────────────────────────

/** Thrown when the anonymous free trial has been used up. */
export class TrialExhaustedError extends Error {
  constructor() {
    super("trial_exhausted");
    this.name = "TrialExhaustedError";
  }
}

/** Thrown when the server rate-limits the request (HTTP 429). */
export class RateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter = 60) {
    super("rate_limited");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/** Thrown when a signed-in user has reached their paper limit. */
export class PaperLimitError extends Error {
  limit: number;
  constructor(limit = 5) {
    super("paper_limit_reached");
    this.name = "PaperLimitError";
    this.limit = limit;
  }
}

function _authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("runpaper_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function uploadAndAnalyze(file: File): Promise<{ paper_id: string }> {
  const form = new FormData();
  form.append("file", file);

  const trialId = getOrCreateTrialId();

  const res = await fetch(`${API_BASE_URL}/api/papers/upload-and-analyze`, {
    method: "POST",
    headers: { "X-Trial-ID": trialId, ..._authHeaders() },
    body: form,
  });

  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    if (body?.code === "trial_exhausted") throw new TrialExhaustedError();
    if (body?.code === "paper_limit_reached") throw new PaperLimitError(body.limit ?? 5);
  }

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
    throw new RateLimitError(retryAfter);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Upload failed");
  }
  return res.json();
}

export async function importFromArxiv(
  arxivUrl: string,
): Promise<{ paper_id: string; arxiv_id: string }> {
  const trialId = getOrCreateTrialId();

  const res = await fetch(`${API_BASE_URL}/api/papers/arxiv-import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Trial-ID": trialId,
      ..._authHeaders(),
    },
    body: JSON.stringify({ arxiv_url: arxivUrl }),
  });

  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    if (body?.code === "trial_exhausted") throw new TrialExhaustedError();
    if (body?.code === "paper_limit_reached") throw new PaperLimitError(body.limit ?? 5);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail || "Failed to import from arXiv");
  }
  return res.json();
}

export async function getPaper(paperId: string): Promise<PaperRecord> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}`);
  if (!res.ok) throw new Error("Failed to fetch paper");
  return res.json();
}

export async function listPapers(): Promise<PaperSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/papers`, { headers: _authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch papers");
  return res.json();
}

export async function downloadZip(paperId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}/download`);
  if (!res.ok) throw new Error("Download failed");
  return res.blob();
}

export async function getPdfUrl(paperId: string): Promise<{ url: string; source: string }> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}/pdf-url`);
  if (!res.ok) throw new Error("PDF not available");
  return res.json();
}

export async function deletePaper(paperId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete paper");
}

/**
 * After sign-in, call this to move any anonymous trial papers into the
 * user's account.  Silently no-ops if the user had no trial papers.
 */
export async function migrateTrialPapers(trialId: string): Promise<number> {
  const token = localStorage.getItem("access_token");
  if (!token || !trialId) return 0;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/migrate-trial`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ trial_id: trialId }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.migrated ?? 0;
  } catch {
    return 0;
  }
}
