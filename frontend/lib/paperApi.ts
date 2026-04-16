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

// ── API calls ─────────────────────────────────────────────────────────────────

export async function uploadAndAnalyze(file: File): Promise<{ paper_id: string }> {
  const form = new FormData();
  form.append("file", file);

  const trialId = getOrCreateTrialId();

  const res = await fetch(`${API_BASE_URL}/api/papers/upload-and-analyze`, {
    method: "POST",
    headers: { "X-Trial-ID": trialId },
    body: form,
  });

  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    if (body?.code === "trial_exhausted") throw new TrialExhaustedError();
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

export async function getPaper(paperId: string): Promise<PaperRecord> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}`);
  if (!res.ok) throw new Error("Failed to fetch paper");
  return res.json();
}

export async function listPapers(): Promise<PaperSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/papers`);
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
