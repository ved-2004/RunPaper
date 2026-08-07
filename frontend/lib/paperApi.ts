import { API_BASE_URL } from "./config";
import type { PaperRecord, PaperSummary } from "@/types/paper";

// ── Typed errors ──────────────────────────────────────────────────────────────

/** Thrown when the user has 0 credits remaining. */
export class InsufficientCreditsError extends Error {
  constructor() {
    super("insufficient_credits");
    this.name = "InsufficientCreditsError";
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

function _throwIfRateLimited(res: Response): void {
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
    throw new RateLimitError(Number.isFinite(retryAfter) ? retryAfter : 60);
  }
}

function _authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function uploadAndAnalyze(file: File): Promise<{ paper_id: string }> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/papers/upload-and-analyze`, {
    method: "POST",
    headers: { ..._authHeaders() },
    body: form,
  });

  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    if (body?.code === "insufficient_credits") throw new InsufficientCreditsError();
  }

  _throwIfRateLimited(res);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Upload failed");
  }
  return res.json();
}

export async function importFromArxiv(
  arxivUrl: string,
): Promise<{ paper_id: string; arxiv_id: string }> {
  const res = await fetch(`${API_BASE_URL}/api/papers/arxiv-import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ..._authHeaders(),
    },
    body: JSON.stringify({ arxiv_url: arxivUrl }),
  });

  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    if (body?.code === "insufficient_credits") throw new InsufficientCreditsError();
  }

  _throwIfRateLimited(res);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail || "Failed to import from arXiv");
  }
  return res.json();
}

export async function getPaper(paperId: string): Promise<PaperRecord> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}`, {
    headers: _authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch paper");
  return res.json();
}

export async function rerunPaper(paperId: string): Promise<{ paper_id: string; status: string }> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}/rerun`, {
    method: "POST",
    headers: _authHeaders(),
  });
  _throwIfRateLimited(res);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail || "Failed to rerun paper");
  }
  return res.json();
}

export async function listPapers(): Promise<PaperSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/papers`, { headers: _authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch papers");
  return res.json();
}

export async function downloadZip(paperId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}/download`, {
    headers: _authHeaders(),
  });
  if (!res.ok) throw new Error("Download failed");
  return res.blob();
}

export async function downloadNotebook(
  paperId: string,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}/notebook`, {
    headers: _authHeaders(),
  });
  if (!res.ok) throw new Error("Notebook not available");
  const blob = await res.blob();
  // Extract filename from Content-Disposition header if present
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `runpaper_${paperId}.ipynb`;
  return { blob, filename };
}

export async function getPdfUrl(paperId: string): Promise<{ url: string; source: string }> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}/pdf-url`, {
    headers: _authHeaders(),
  });
  if (!res.ok) throw new Error("PDF not available");
  return res.json();
}

export async function deletePaper(paperId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}`, {
    method: "DELETE",
    headers: _authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete paper");
}

export interface FeedbackPayload {
  name: string;
  role: string;
  organization: string;
  why_credits: string;
  improvements: string;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ..._authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail || "Failed to submit feedback");
  }
  return res.json();
}
