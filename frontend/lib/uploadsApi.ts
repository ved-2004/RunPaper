import { API_BASE_URL } from "./config";
import { authHeaders } from "@/contexts/AuthContext";

export interface UploadRecord {
  upload_id: string;
  user_id: string;
  filename: string;
  file_size_bytes: number;
  bucket_path: string;
  paper_id: string | null;
  uploaded_at: string;  // ISO 8601
  expires_at: string;   // ISO 8601
  presigned_url: string | null;
}

export async function fetchUserUploads(): Promise<UploadRecord[]> {
  const res = await fetch(`${API_BASE_URL}/uploads`, { headers: authHeaders() });
  if (res.status === 401) return []; // not logged in — silently empty
  if (!res.ok) throw new Error(`Failed to fetch uploads: ${res.status}`);
  return res.json();
}

/** Returns the number of whole days until the ISO date string, or null if in the past. */
export function daysUntilExpiry(expiresAt: string): number | null {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
