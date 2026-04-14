import { API_BASE_URL } from "./config";
import type { PaperRecord, PaperSummary } from "@/types/paper";

export async function uploadAndAnalyze(file: File): Promise<{ paper_id: string }> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/papers/upload-and-analyze`, {
    method: "POST",
    body: form,
  });

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
